import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Tests statiques : s'exécutent sans base de données (npm run test:static).
const root = new URL('../supabase/', import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), 'utf8');
const migrations = readdirSync(new URL('migrations/', root)).filter((f) => f.endsWith('.sql')).sort();
const allMigrations = migrations.map((f) => read(`migrations/${f}`)).join('\n');
const seed = read('seed.sql');
const stripComments = (sql: string) => sql.replace(/--.*$/gm, '');
const code = stripComments(allMigrations);

describe('migrations', () => {
  it('sont numérotées et ordonnées', () => {
    expect(migrations).toHaveLength(4);
    expect([...migrations].sort()).toEqual(migrations);
  });

  it('activent la RLS sur chaque table du schéma public', () => {
    const tables = [...code.matchAll(/create table public\.(\w+)/g)].map((m) => m[1]);
    expect(tables.length).toBeGreaterThanOrEqual(11);
    for (const t of tables) {
      expect(code, `RLS manquante sur ${t}`).toMatch(new RegExp(`alter table public\\.${t}\\s+enable row level security`));
    }
  });

  it('fixent search_path sur TOUTES les fonctions', () => {
    const chunks = code.split(/create or replace function /i).slice(1);
    expect(chunks.length).toBeGreaterThanOrEqual(20);
    for (const chunk of chunks) {
      const name = chunk.split('(')[0];
      const header = chunk.split(/\$\$/)[0];
      expect(header, `search_path manquant : ${name}`).toMatch(/set search_path\s*=\s*''/);
    }
  });

  it('n\'accordent rien à anon et n\'utilisent jamais service_role', () => {
    expect(code).not.toMatch(/service_role/i);
    expect(code).not.toMatch(/grant[^;]*\bto\b[^;]*\banon\b/i);
  });

  it('exposent les RPC uniquement à authenticated', () => {
    for (const fn of ['create_loan_request', 'admin_update_loan_status', 'admin_moderate_bank_suggestion', 'admin_stats', 'admin_update_setting', 'delete_my_account']) {
      expect(code).toMatch(new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to authenticated`));
    }
    expect(code).not.toMatch(/grant execute on function public\.(check_rate_limit|clean_text|handle_new_user)/);
  });

  it('les fonctions admin vérifient admin_access_ok()', () => {
    for (const fn of ['admin_update_loan_status', 'admin_moderate_bank_suggestion', 'admin_stats', 'admin_update_setting']) {
      const body = code.split(new RegExp(`create or replace function public\\.${fn}`))[1].split(/\n\$\$;/)[0];
      expect(body, fn).toMatch(/admin_access_ok\(\)/);
    }
  });

  it('garantissent un seul admin, un audit en ajout seul et aucun champ carte/CVV', () => {
    expect(code).toMatch(/create unique index profiles_single_admin on public\.profiles \(\(role\)\) where role = 'admin'/);
    expect(code).toMatch(/audit_logs_are_append_only/);
    expect(code).toMatch(/before truncate on public\.audit_logs/);
    expect(/\b(cvv|iban|card_number|pan)\b/i.test(code)).toBe(false);
  });

  it('empêchent les écritures directes sur les demandes', () => {
    expect(code).not.toMatch(/grant[^;]*(insert|update|delete)[^;]*on public\.loan_requests/i);
    expect(code).not.toMatch(/grant[^;]*(insert|update|delete)[^;]*on public\.audit_logs/i);
  });
});

describe('seed.sql', () => {
  const rows = (table: string) => {
    const block = seed.split(new RegExp(`insert into public\\.${table} `))[1].split(/on conflict/)[0];
    return [...block.matchAll(/^\s+\((.*)\),?$/gm)].map((m) => m[1]);
  };

  it('contient 31 motifs uniques dont « other » en dernier', () => {
    const r = rows('loan_purposes');
    expect(r).toHaveLength(31);
    expect(new Set(r.map((x) => x.split(',')[0])).size).toBe(31);
    expect(r[30].startsWith("'other'")).toBe(true);
  });

  it('contient les 34 types de carte du fichier Word', () => {
    expect(rows('card_types')).toHaveLength(34);
  });

  it('contient les 12 banques (slugs uniques, correspondant aux logos)', () => {
    const r = rows('banks');
    expect(r).toHaveLength(12);
    const slugs = r.map((x) => x.match(/^'([^']+)'/)![1]);
    expect(new Set(slugs).size).toBe(12);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('est idempotent', () => {
    expect((seed.match(/on conflict/g) ?? []).length).toBe(4);
  });
});

describe('setup_complete.sql', () => {
  it('est à jour (migrations + seed)', () => {
    const setup = read('setup_complete.sql');
    for (const f of migrations) expect(setup).toContain(read(`migrations/${f}`).trim());
    expect(setup).toContain(seed.trim());
  });
});
