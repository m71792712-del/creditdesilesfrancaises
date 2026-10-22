import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';

// Tests d'intégration via l'API (PostgREST) — comme le feront le frontend et l'admin.
// À lancer UNIQUEMENT sur un projet Supabase de TEST, migrations + seed appliqués, confirmation e-mail désactivée :
//   SUPABASE_TEST_URL=... SUPABASE_TEST_ANON_KEY=... npm test
// Les tests liés au rôle admin et au MFA sont dans tests/sql/security_tests.sql (le rôle ne se change que par SQL).
const url = process.env.SUPABASE_TEST_URL;
const key = process.env.SUPABASE_TEST_ANON_KEY;
const DESCRIPTION = 'Demande fictive créée par un test automatisé de démonstration.';

async function newUser() {
  const client = createClient(url!, key!, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signUp({
    email: `test-${randomUUID()}@example.com`,
    password: 'Motdepasse12',
    options: { data: { first_name: 'Test', last_name: 'Utilisateur', phone: '+590 690 00 00 00', demo_color: 'Bleu', demo_city: 'Test', demo_digit: '7', role: 'admin' } },
  });
  if (error || !data.user || !data.session) throw new Error(`inscription impossible : ${error?.message ?? 'pas de session'}`);
  return { client, id: data.user.id };
}

const createLoan = (c: SupabaseClient, over: Record<string, unknown> = {}) =>
  c.rpc('create_loan_request', {
    p_amount: 1000, p_currency: 'EUR', p_purpose_code: 'personal', p_purpose_details: null,
    p_description: DESCRIPTION, p_bank_id: null, p_custom_bank_name: null, p_card_type_id: null, ...over,
  });

describe.skipIf(!url || !key)('API Supabase de test', () => {
  let a: Awaited<ReturnType<typeof newUser>>;
  let b: Awaited<ReturnType<typeof newUser>>;
  let bankId: string;
  let loanId: string;

  beforeAll(async () => {
    a = await newUser();
    b = await newUser();
    const { data } = await a.client.from('banks').select('id').eq('slug', 'lcl').single();
    bankId = data!.id;
  });

  it('crée le profil avec le rôle « user » même si les métadonnées demandent « admin »', async () => {
    const { data } = await a.client.from('profiles').select('role, first_name, demo_digit').eq('id', a.id).single();
    expect(data).toEqual({ role: 'user', first_name: 'Test', demo_digit: 7 });
  });

  it('refuse un deuxième admin et toute auto-promotion', async () => {
    const { error } = await a.client.from('profiles').update({ role: 'admin' }).eq('id', a.id);
    expect(error).not.toBeNull();
    const { data } = await a.client.from('profiles').select('role').eq('id', a.id).single();
    expect(data!.role).toBe('user');
  });

  it('crée une demande (statut pending) et la relit avec son historique', async () => {
    const { data, error } = await createLoan(a.client, { p_bank_id: bankId });
    expect(error).toBeNull();
    loanId = data as string;
    const { data: loan } = await a.client.from('loan_requests').select('status, amount').eq('id', loanId).single();
    expect(loan!.status).toBe('pending');
    const { data: hist } = await a.client.from('loan_status_history').select('id').eq('loan_id', loanId);
    expect(hist).toHaveLength(1);
  });

  it('isole les données : B ne voit pas la demande de A', async () => {
    const { data } = await b.client.from('loan_requests').select('id').eq('id', loanId);
    expect(data).toEqual([]);
  });

  it('interdit les écritures directes et les fonctions admin', async () => {
    expect((await a.client.from('loan_requests').insert({ user_id: a.id, amount: 1, purpose_code: 'personal', description: DESCRIPTION, bank_id: bankId })).error).not.toBeNull();
    await a.client.from('loan_requests').update({ status: 'approved' }).eq('id', loanId);
    const { data } = await a.client.from('loan_requests').select('status').eq('id', loanId).single();
    expect(data!.status).toBe('pending');
    expect((await a.client.rpc('admin_stats')).error?.message).toContain('forbidden');
    expect((await a.client.rpc('admin_update_loan_status', { p_loan_id: loanId, p_new_status: 'approved', p_comment: 'test' })).error?.message).toContain('forbidden');
    expect((await a.client.from('audit_logs').select('id')).data).toEqual([]);
  });

  it('valide les entrées côté base', async () => {
    expect((await createLoan(a.client, { p_bank_id: bankId, p_amount: -1 })).error?.message).toContain('invalid_amount');
    expect((await createLoan(a.client, { p_bank_id: bankId, p_purpose_code: 'hack' })).error?.message).toContain('invalid_purpose');
    expect((await createLoan(a.client, { p_bank_id: bankId, p_purpose_code: 'other' })).error?.message).toContain('purpose_details_required');
    expect((await createLoan(a.client, {})).error?.message).toContain('invalid_bank');
  });

  it('accepte « Autre banque » et limite le débit', async () => {
    expect((await createLoan(a.client, { p_custom_bank_name: `Banque Test ${Date.now()}` })).error).toBeNull();
    for (let i = 0; i < 3; i++) await createLoan(a.client, { p_bank_id: bankId });
    expect((await createLoan(a.client, { p_bank_id: bankId })).error?.message).toContain('rate_limited');
  });

  it('supprime le compte et ses données', async () => {
    expect((await b.client.rpc('delete_my_account')).error).toBeNull();
    const { data } = await b.client.from('profiles').select('id');
    expect(data ?? []).toEqual([]);
  });
});
