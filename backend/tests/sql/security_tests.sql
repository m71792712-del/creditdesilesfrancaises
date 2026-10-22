-- =====================================================================
-- TESTS DE SÉCURITÉ SQL — à exécuter sur un projet Supabase de TEST (jamais la production).
-- Comment : SQL Editor > coller ce fichier > Run. Tout est annulé à la fin (ROLLBACK) : aucune donnée ne reste.
-- Résultat attendu : la dernière ligne « NOTICE: TOUS LES TESTS SQL SONT PASSÉS ». En cas d'échec :
-- une erreur « TEST_FAILED ... » ou « Assertion failed » indique le test fautif.
-- Prérequis : migrations + seed appliqués (supabase/setup_complete.sql).
-- NB : ce fichier n'a pas pu être exécuté dans l'environnement où il a été écrit.
-- =====================================================================
begin;

create schema tests_tmp;
grant usage on schema tests_tmp to authenticated;

-- Simule la session d'un utilisateur (claims JWT lus par auth.uid() / auth.jwt()).
create function tests_tmp.claims(p_uid uuid, p_aal text default 'aal1') returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'aal', p_aal)::text, true);
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end;
$f$;

-- Vérifie qu'une instruction échoue avec un message contenant `p_fragment`.
create function tests_tmp.expect_error(p_sql text, p_fragment text) returns void language plpgsql as $f$
begin
  begin
    execute p_sql;
  exception when others then
    if position(p_fragment in sqlerrm) = 0 then
      raise exception 'TEST_FAILED: erreur attendue "%" mais reçu "%" (SQL : %)', p_fragment, sqlerrm, p_sql;
    end if;
    return;
  end;
  raise exception 'TEST_FAILED: aucune erreur pour : %', p_sql;
end;
$f$;

grant execute on all functions in schema tests_tmp to authenticated;

-- Utilisateurs de test (le trigger crée les profils). '00000000-0000-4000-8000-000000000009' n'a pas de métadonnées : valeurs de repli.
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-8000-000000000001', 'u1@test.invalid', '{"first_name":"Test","last_name":"Un","phone":"+590 690 00 00 01","demo_color":"Bleu","demo_city":"Test","demo_digit":"7"}'::jsonb, 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000002', 'u2@test.invalid', '{"first_name":"Test","last_name":"Deux","phone":"+590 690 00 00 02"}'::jsonb, 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000003', 'u3@test.invalid', '{"first_name":"Test","last_name":"Trois","role":"admin"}'::jsonb, 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000009', 'adm@test.invalid', '{}'::jsonb, 'authenticated', 'authenticated');

-- ---------------------------------------------------------------------
-- A. Création des profils et données de référence
-- ---------------------------------------------------------------------
do $t$
begin
  reset role;
  assert (select count(*) from public.profiles where id in ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000009')) = 4, 'A1 profils non créés par le trigger';
  assert (select role from public.profiles where id = '00000000-0000-4000-8000-000000000001') = 'user', 'A2 rôle par défaut';
  assert (select role from public.profiles where id = '00000000-0000-4000-8000-000000000003') = 'user', 'A3 le rôle des métadonnées doit être ignoré';
  assert (select demo_digit from public.profiles where id = '00000000-0000-4000-8000-000000000001') = 7, 'A4 métadonnées démo';
  assert (select first_name from public.profiles where id = '00000000-0000-4000-8000-000000000009') = 'adm', 'A5 valeur de repli du prénom';
  assert (select count(*) from public.loan_purposes) = 31, 'A6 31 motifs attendus';
  assert (select count(*) from public.card_types) = 34, 'A7 34 types de carte attendus';
  assert (select count(*) from public.banks) >= 12, 'A8 12 banques attendues';
  raise notice 'OK A : profils et données de référence';
end;
$t$;

-- ---------------------------------------------------------------------
-- B. Un seul administrateur possible
-- ---------------------------------------------------------------------
do $t$
begin
  reset role;
  update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-000000000009';
  perform tests_tmp.expect_error($q$update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-000000000001'$q$, 'profiles_single_admin');
  assert (select count(*) from public.audit_logs where action = 'profile.role_changed') >= 1, 'B1 changement de rôle non journalisé';
  raise notice 'OK B : un seul admin';
end;
$t$;

-- ---------------------------------------------------------------------
-- C. Un utilisateur ne peut pas se promouvoir ni modifier le profil d'autrui
-- ---------------------------------------------------------------------
do $t$
declare n integer;
begin
  reset role;
  perform tests_tmp.claims('00000000-0000-4000-8000-000000000001');
  set local role authenticated;
  perform tests_tmp.expect_error($q$update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-000000000001'$q$, 'permission denied');
  perform tests_tmp.expect_error($q$update public.profiles set email = 'x@y.z' where id = '00000000-0000-4000-8000-000000000001'$q$, 'permission denied');
  update public.profiles set first_name = 'Nouveau' where id = '00000000-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  assert n = 1, 'C1 modification de son propre profil refusée';
  update public.profiles set first_name = 'Pirate' where id = '00000000-0000-4000-8000-000000000002';
  get diagnostics n = row_count;
  assert n = 0, 'C2 modification du profil d''un autre utilisateur possible !';
  assert (select count(*) from public.profiles) = 1, 'C3 un utilisateur ne doit voir que son profil';
  raise notice 'OK C : protection des profils';
end;
$t$;

-- ---------------------------------------------------------------------
-- D. Création d'une demande, isolation entre utilisateurs, écritures directes interdites
-- ---------------------------------------------------------------------
do $t$
declare v_bank uuid; v_loan uuid; n integer;
begin
  reset role;
  select id into v_bank from public.banks where slug = 'lcl';
  perform tests_tmp.claims('00000000-0000-4000-8000-000000000001');
  set local role authenticated;
  v_loan := public.create_loan_request(1500, 'EUR', 'personal', null,
    'Description de test suffisamment longue pour la validation.', v_bank, null, null);
  perform set_config('tests.loan1', v_loan::text, true);

  assert (select status from public.loan_requests where id = v_loan) = 'pending', 'D1 statut initial';
  assert (select count(*) from public.loan_status_history where loan_id = v_loan) = 1, 'D2 historique initial';

  perform tests_tmp.expect_error($q$insert into public.loan_requests (user_id, amount, purpose_code, description, bank_id, status)
    values ('00000000-0000-4000-8000-000000000001', 100, 'personal', 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxx', (select id from public.banks limit 1), 'approved')$q$, 'permission denied');
  perform tests_tmp.expect_error($q$update public.loan_requests set status = 'approved'$q$, 'permission denied');
  perform tests_tmp.expect_error($q$delete from public.loan_requests$q$, 'permission denied');
  perform tests_tmp.expect_error($q$insert into public.loan_status_history (loan_id, new_status) values (gen_random_uuid(), 'approved')$q$, 'permission denied');

  reset role;
  perform tests_tmp.claims('00000000-0000-4000-8000-000000000002');
  set local role authenticated;
  select count(*) into n from public.loan_requests where id = v_loan;
  assert n = 0, 'D3 un utilisateur voit la demande d''un autre !';
  select count(*) into n from public.loan_status_history where loan_id = v_loan;
  assert n = 0, 'D4 un utilisateur voit l''historique d''un autre !';
  raise notice 'OK D : isolation et écritures directes interdites';
end;
$t$;

-- ---------------------------------------------------------------------
-- E. Validation côté base (indépendante du frontend)
-- ---------------------------------------------------------------------
do $t$
begin
  reset role;
  perform tests_tmp.claims('00000000-0000-4000-8000-000000000001');
  set local role authenticated;
  perform tests_tmp.expect_error($q$select public.create_loan_request(10, 'EUR', 'personal', null, 'Description de test suffisamment longue.', (select id from public.banks where slug='lcl'), null, null)$q$, 'amount_out_of_range');
  perform tests_tmp.expect_error($q$select public.create_loan_request(-5, 'EUR', 'personal', null, 'Description de test suffisamment longue.', (select id from public.banks where slug='lcl'), null, null)$q$, 'invalid_amount');
  perform tests_tmp.expect_error($q$select public.create_loan_request(1000.123, 'EUR', 'personal', null, 'Description de test suffisamment longue.', (select id from public.banks where slug='lcl'), null, null)$q$, 'invalid_amount');
  perform tests_tmp.expect_error($q$select public.create_loan_request(1000, 'JPY', 'personal', null, 'Description de test suffisamment longue.', (select id from public.banks where slug='lcl'), null, null)$q$, 'invalid_currency');
  perform tests_tmp.expect_error($q$select public.create_loan_request(1000, 'EUR', 'hack', null, 'Description de test suffisamment longue.', (select id from public.banks where slug='lcl'), null, null)$q$, 'invalid_purpose');
  perform tests_tmp.expect_error($q$select public.create_loan_request(1000, 'EUR', 'other', null, 'Description de test suffisamment longue.', (select id from public.banks where slug='lcl'), null, null)$q$, 'purpose_details_required');
  perform tests_tmp.expect_error($q$select public.create_loan_request(1000, 'EUR', 'personal', 'texte', 'Description de test suffisamment longue.', (select id from public.banks where slug='lcl'), null, null)$q$, 'purpose_details_unexpected');
  perform tests_tmp.expect_error($q$select public.create_loan_request(1000, 'EUR', 'personal', null, 'trop court', (select id from public.banks where slug='lcl'), null, null)$q$, 'invalid_description');
  perform tests_tmp.expect_error($q$select public.create_loan_request(1000, 'EUR', 'personal', null, 'Description de test suffisamment longue.', (select id from public.banks where slug='lcl'), 'Autre', null)$q$, 'invalid_bank');
  perform tests_tmp.expect_error($q$select public.create_loan_request(1000, 'EUR', 'personal', null, 'Description de test suffisamment longue.', null, null, null)$q$, 'invalid_bank');
  perform tests_tmp.expect_error($q$select public.create_loan_request(1000, 'EUR', 'personal', null, 'Description de test suffisamment longue.', gen_random_uuid(), null, null)$q$, 'invalid_bank');
  perform tests_tmp.expect_error($q$select public.create_loan_request(1000, 'EUR', 'personal', null, 'Description de test suffisamment longue.', null, '!!!', null)$q$, 'invalid_bank');
  perform tests_tmp.expect_error($q$select public.create_loan_request(1000, 'EUR', 'personal', null, 'Description de test suffisamment longue.', (select id from public.banks where slug='lcl'), null, gen_random_uuid())$q$, 'invalid_card_type');
  raise notice 'OK E : validations';
end;
$t$;

-- ---------------------------------------------------------------------
-- F. Limitation de débit : 5 demandes par heure et par utilisateur
-- ---------------------------------------------------------------------
do $t$
declare i integer;
begin
  reset role;
  perform tests_tmp.claims('00000000-0000-4000-8000-000000000003');
  set local role authenticated;
  for i in 1..5 loop
    perform public.create_loan_request(1000, 'EUR', 'travel', null, 'Description de test suffisamment longue.',
      (select id from public.banks where slug = 'lcl'), null, null);
  end loop;
  perform tests_tmp.expect_error($q$select public.create_loan_request(1000, 'EUR', 'travel', null, 'Description de test suffisamment longue.', (select id from public.banks where slug='lcl'), null, null)$q$, 'rate_limited');
  raise notice 'OK F : limitation de débit';
end;
$t$;

-- ---------------------------------------------------------------------
-- G. « Autre banque » : normalisation, anti-doublon, un vote par utilisateur
-- ---------------------------------------------------------------------
do $t$
declare v_id uuid; v_bank uuid; v_custom text;
begin
  reset role;
  perform tests_tmp.claims('00000000-0000-4000-8000-000000000001');
  set local role authenticated;
  perform public.create_loan_request(1000, 'EUR', 'travel', null, 'Description de test suffisamment longue.', null, '  Banque   Locale ', null);
  perform public.create_loan_request(1000, 'EUR', 'travel', null, 'Description de test suffisamment longue.', null, 'BANQUE LOCALE', null);

  reset role;
  perform tests_tmp.claims('00000000-0000-4000-8000-000000000002');
  set local role authenticated;
  perform public.create_loan_request(1000, 'EUR', 'travel', null, 'Description de test suffisamment longue.', null, 'banque locale', null);
  -- un nom déjà présent dans la liste est rattaché à la banque existante
  v_id := public.create_loan_request(1000, 'EUR', 'travel', null, 'Description de test suffisamment longue.', null, 'lcl', null);
  -- « Autre (à préciser) » valide
  perform public.create_loan_request(1000, 'EUR', 'other', 'Achat de matériel agricole', 'Description de test suffisamment longue.',
    (select id from public.banks where slug = 'lcl'), null, null);

  reset role;
  select bank_id, custom_bank_name into v_bank, v_custom from public.loan_requests where id = v_id;
  assert v_bank is not null and v_custom is null, 'G1 « lcl » doit être rattaché à la banque existante';
  assert (select count(*) from public.bank_suggestions where name_key = 'banque locale') = 1, 'G2 doublon de suggestion';
  assert (select submit_count from public.bank_suggestions where name_key = 'banque locale') = 2, 'G3 un vote par utilisateur (2 attendus)';
  assert (select count(*) from public.bank_suggestion_votes) = 2, 'G4 votes';
  assert (select name from public.bank_suggestions where name_key = 'banque locale') = 'Banque Locale', 'G5 nom nettoyé';
  raise notice 'OK G : section Autre banque';
end;
$t$;

-- ---------------------------------------------------------------------
-- H. Un utilisateur simple n'a accès à aucune fonction ni donnée d'administration
-- ---------------------------------------------------------------------
do $t$
declare n integer;
begin
  reset role;
  perform tests_tmp.claims('00000000-0000-4000-8000-000000000001');
  set local role authenticated;
  perform tests_tmp.expect_error($q$select public.admin_stats()$q$, 'forbidden');
  perform tests_tmp.expect_error($q$select public.admin_update_loan_status(gen_random_uuid(), 'approved', 'commentaire')$q$, 'forbidden');
  perform tests_tmp.expect_error($q$select public.admin_moderate_bank_suggestion(gen_random_uuid(), 'reject')$q$, 'forbidden');
  perform tests_tmp.expect_error($q$select public.admin_update_setting('loans_per_hour', '50'::jsonb)$q$, 'forbidden');
  assert (select count(*) from public.audit_logs) = 0, 'H1 journal d''audit visible';
  assert (select count(*) from public.bank_suggestions) = 0, 'H2 suggestions visibles';
  assert (select count(*) from public.app_settings) = 2, 'H3 seules les limites de montant sont visibles';
  perform tests_tmp.expect_error($q$select * from public.rate_limits$q$, 'permission denied');
  perform tests_tmp.expect_error($q$select * from public.bank_suggestion_votes$q$, 'permission denied');
  perform tests_tmp.expect_error($q$insert into public.banks (slug, name) values ('pirate', 'Banque Pirate')$q$, 'row-level security');
  update public.banks set name = 'Banque piratée' where slug = 'lcl';
  get diagnostics n = row_count;
  assert n = 0, 'H4 modification d''une banque par un utilisateur !';
  delete from public.banks where slug = 'lcl';
  get diagnostics n = row_count;
  assert n = 0, 'H5 suppression d''une banque par un utilisateur !';
  raise notice 'OK H : aucune fonction admin pour un utilisateur';
end;
$t$;

-- ---------------------------------------------------------------------
-- I. Administrateur : changement de statut, historique, audit, réglages, MFA optionnel
-- ---------------------------------------------------------------------
do $t$
declare v_loan uuid := current_setting('tests.loan1')::uuid; n integer;
begin
  reset role;
  perform tests_tmp.claims('00000000-0000-4000-8000-000000000009', 'aal1');
  set local role authenticated;

  assert ((public.admin_stats()) ->> 'users')::integer >= 4, 'I1 statistiques';
  assert (select count(*) from public.loan_requests) >= 8, 'I2 l''admin doit voir toutes les demandes';
  assert (select count(*) from public.profiles) >= 4, 'I3 l''admin doit voir tous les profils';

  perform public.admin_update_loan_status(v_loan, 'under_review', 'Dossier en cours d''examen');
  assert (select count(*) from public.loan_status_history where loan_id = v_loan) = 2, 'I4 historique après changement';
  perform tests_tmp.expect_error(format($q$select public.admin_update_loan_status(%L, 'under_review', 'Encore')$q$, v_loan), 'status_unchanged');
  perform tests_tmp.expect_error(format($q$select public.admin_update_loan_status(%L, 'pirate', 'Commentaire')$q$, v_loan), 'invalid_status');
  perform tests_tmp.expect_error(format($q$select public.admin_update_loan_status(%L, 'approved', 'ab')$q$, v_loan), 'invalid_comment');
  perform tests_tmp.expect_error($q$select public.admin_update_loan_status(gen_random_uuid(), 'approved', 'Commentaire')$q$, 'not_found');
  assert (select count(*) from public.audit_logs where action = 'loan.status_changed') >= 1, 'I5 audit du changement de statut';

  -- réglages : validation stricte
  perform tests_tmp.expect_error($q$select public.admin_update_setting('loan_min_amount', '200000'::jsonb)$q$, 'invalid_setting');
  perform tests_tmp.expect_error($q$select public.admin_update_setting('loans_per_hour', '0'::jsonb)$q$, 'invalid_setting');
  perform tests_tmp.expect_error($q$select public.admin_update_setting('une_cle_inconnue', '1'::jsonb)$q$, 'invalid_setting');
  perform tests_tmp.expect_error($q$select public.admin_update_setting('loan_min_amount', '"abc"'::jsonb)$q$, 'invalid_setting');
  perform public.admin_update_setting('loan_min_amount', '300'::jsonb);
  -- anti-verrouillage : impossible d'imposer le MFA depuis une session sans MFA
  perform tests_tmp.expect_error($q$select public.admin_update_setting('require_admin_mfa', 'true'::jsonb)$q$, 'mfa_enrollment_required');

  -- l'utilisateur voit le commentaire administratif dans son historique
  reset role;
  perform tests_tmp.claims('00000000-0000-4000-8000-000000000001');
  set local role authenticated;
  assert (select count(*) from public.loan_status_history where loan_id = v_loan) = 2, 'I6 historique visible du propriétaire';

  reset role;
  assert (select value from public.app_settings where key = 'loan_min_amount') = '300'::jsonb, 'I7 réglage enregistré';
  update public.app_settings set value = '500'::jsonb where key = 'loan_min_amount';
  raise notice 'OK I : fonctions administrateur';
end;
$t$;

do $t$
declare n integer;
begin
  -- MFA imposé : une session aal1 est refusée, une session aal2 est acceptée.
  reset role;
  update public.app_settings set value = 'true'::jsonb where key = 'require_admin_mfa';

  perform tests_tmp.claims('00000000-0000-4000-8000-000000000009', 'aal1');
  set local role authenticated;
  perform tests_tmp.expect_error($q$select public.admin_stats()$q$, 'forbidden');
  assert (select count(*) from public.loan_requests) = 0, 'I8 admin sans MFA : lecture globale refusée';

  reset role;
  perform tests_tmp.claims('00000000-0000-4000-8000-000000000009', 'aal2');
  set local role authenticated;
  assert ((public.admin_stats()) ->> 'loans')::integer >= 8, 'I9 admin avec MFA';
  perform public.admin_update_setting('require_admin_mfa', 'false'::jsonb);

  reset role;
  assert (select value from public.app_settings where key = 'require_admin_mfa') = 'false'::jsonb, 'I10 MFA désactivé';
  raise notice 'OK I bis : MFA optionnel';
end;
$t$;

-- ---------------------------------------------------------------------
-- J. Modération des suggestions « Autre banque »
-- ---------------------------------------------------------------------
do $t$
declare v_sug uuid; v_bank uuid; v_sug2 uuid; v_sug3 uuid; v_mutuel uuid; v_loan uuid;
begin
  reset role;
  select id into v_sug from public.bank_suggestions where name_key = 'banque locale';
  select id into v_mutuel from public.banks where slug = 'credit-mutuel';

  perform tests_tmp.claims('00000000-0000-4000-8000-000000000009', 'aal1');
  set local role authenticated;
  v_bank := public.admin_moderate_bank_suggestion(v_sug, 'approve', null, 'Territoire test', 'bank');
  perform tests_tmp.expect_error(format($q$select public.admin_moderate_bank_suggestion(%L, 'approve')$q$, v_sug), 'already_reviewed');

  reset role;
  assert (select name from public.banks where id = v_bank) = 'Banque Locale', 'J1 banque créée';
  assert (select status from public.bank_suggestions where id = v_sug) = 'approved', 'J2 statut approuvé';
  assert (select count(*) from public.loan_requests where bank_suggestion_id = v_sug and bank_id = v_bank and custom_bank_name is null) = 3,
    'J3 les 3 demandes doivent être rattachées à la nouvelle banque';
  assert (select count(*) from public.audit_logs where action = 'bank_suggestion.approve') = 1, 'J4 audit';
  assert (select count(*) from public.audit_logs where action = 'bank.created') >= 1, 'J5 audit de la création de banque';

  -- rejet et fusion
  perform tests_tmp.claims('00000000-0000-4000-8000-000000000002');
  set local role authenticated;
  perform public.create_loan_request(1000, 'EUR', 'travel', null, 'Description de test suffisamment longue.', null, 'Zeta Crédit', null);
  perform public.create_loan_request(1000, 'EUR', 'travel', null, 'Description de test suffisamment longue.', null, 'Crédit Mutuel Antilles', null);

  reset role;
  select id into v_sug2 from public.bank_suggestions where name_key = 'zeta credit';
  select id into v_sug3 from public.bank_suggestions where name_key = 'credit mutuel antilles';
  assert v_sug2 is not null and v_sug3 is not null, 'J6 suggestions créées (accents ignorés dans la clé)';

  perform tests_tmp.claims('00000000-0000-4000-8000-000000000009', 'aal1');
  set local role authenticated;
  perform public.admin_moderate_bank_suggestion(v_sug2, 'reject');
  perform public.admin_moderate_bank_suggestion(v_sug3, 'merge', v_mutuel);
  perform tests_tmp.expect_error($q$select public.admin_moderate_bank_suggestion(gen_random_uuid(), 'merge', gen_random_uuid())$q$, 'not_found');

  reset role;
  assert (select status from public.bank_suggestions where id = v_sug2) = 'rejected', 'J7 rejet';
  assert (select count(*) from public.loan_requests where bank_suggestion_id = v_sug2 and custom_bank_name = 'Zeta Crédit') = 1, 'J8 la demande rejetée garde le nom saisi';
  assert (select count(*) from public.loan_requests where bank_suggestion_id = v_sug3 and bank_id = v_mutuel and custom_bank_name is null) = 1, 'J9 fusion';
  raise notice 'OK J : modération des suggestions';
end;
$t$;

-- ---------------------------------------------------------------------
-- K. Le journal d'audit est en ajout seul (même pour le propriétaire)
-- ---------------------------------------------------------------------
do $t$
begin
  reset role;
  perform tests_tmp.expect_error($q$update public.audit_logs set action = 'x'$q$, 'append_only');
  perform tests_tmp.expect_error($q$delete from public.audit_logs$q$, 'append_only');
  perform tests_tmp.expect_error($q$truncate public.audit_logs$q$, 'append_only');
  raise notice 'OK K : audit en ajout seul';
end;
$t$;

-- ---------------------------------------------------------------------
-- L. Suppression de compte (RGPD) : l'utilisateur oui, l'admin non
-- ---------------------------------------------------------------------
do $t$
begin
  reset role;
  perform tests_tmp.claims('00000000-0000-4000-8000-000000000009', 'aal1');
  set local role authenticated;
  perform tests_tmp.expect_error($q$select public.delete_my_account()$q$, 'cannot_delete_admin');

  reset role;
  perform tests_tmp.claims('00000000-0000-4000-8000-000000000002');
  set local role authenticated;
  perform public.delete_my_account();

  reset role;
  assert not exists (select 1 from auth.users where id = '00000000-0000-4000-8000-000000000002'), 'L1 compte d''authentification supprimé';
  assert not exists (select 1 from public.profiles where id = '00000000-0000-4000-8000-000000000002'), 'L2 profil supprimé';
  assert not exists (select 1 from public.loan_requests where user_id = '00000000-0000-4000-8000-000000000002'), 'L3 demandes supprimées';
  assert (select count(*) from public.audit_logs where action = 'account.deleted' and actor_id = '00000000-0000-4000-8000-000000000002') = 1, 'L4 suppression journalisée';
  raise notice 'OK L : suppression de compte';
end;
$t$;

do $t$
begin
  raise notice 'TOUS LES TESTS SQL SONT PASSÉS';
end;
$t$;

rollback;
