-- =====================================================================
-- Migration 4/4 : privilèges minimaux + Row Level Security.
-- Principe : tout est interdit par défaut ; on n'ouvre que ce qui est nécessaire.
-- =====================================================================

-- 1) Retirer les droits par défaut donnés par Supabase aux rôles de l'API.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

-- Aucune fonction du schéma public n'est appelable par défaut (y compris par PUBLIC).
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
  end loop;
end;
$$;

-- 2) Fonctions exposées aux utilisateurs connectés (jamais à anon).
grant execute on function public.create_loan_request(numeric, text, text, text, text, uuid, text, uuid) to authenticated;
grant execute on function public.admin_update_loan_status(uuid, text, text) to authenticated;
grant execute on function public.admin_moderate_bank_suggestion(uuid, text, uuid, text, text) to authenticated;
grant execute on function public.admin_stats() to authenticated;
grant execute on function public.admin_update_setting(text, jsonb) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
-- Utilisées par les politiques RLS et les index (fonctions pures ou de lecture de rôle).
grant execute on function public.is_admin() to authenticated;
grant execute on function public.admin_access_ok() to authenticated;
grant execute on function public.normalize_text(text) to authenticated;
grant execute on function public.slugify(text) to authenticated;
grant execute on function public.has_control_chars(text) to authenticated;

-- 3) Privilèges sur les tables (la RLS filtre ensuite les lignes).
grant select on public.profiles, public.banks, public.bank_suggestions, public.card_types,
                public.loan_purposes, public.loan_requests, public.loan_status_history,
                public.audit_logs, public.app_settings
  to authenticated;
-- Un utilisateur ne peut modifier que ces colonnes de SON profil (jamais rôle, e-mail, id).
grant update (first_name, last_name, phone, demo_color, demo_city, demo_digit) on public.profiles to authenticated;
-- Gestion des banques par l'admin (RLS : réservé à l'admin).
grant insert, update, delete on public.banks to authenticated;
-- Aucun accès direct en écriture à loan_requests, historique, audit, suggestions, votes, limites : tout passe par les RPC.
-- rate_limits et bank_suggestion_votes : aucun accès API.

-- 4) Row Level Security sur TOUTES les tables.
alter table public.profiles               enable row level security;
alter table public.banks                  enable row level security;
alter table public.bank_suggestions       enable row level security;
alter table public.bank_suggestion_votes  enable row level security;
alter table public.card_types             enable row level security;
alter table public.loan_purposes          enable row level security;
alter table public.loan_requests          enable row level security;
alter table public.loan_status_history    enable row level security;
alter table public.audit_logs             enable row level security;
alter table public.rate_limits            enable row level security;
alter table public.app_settings           enable row level security;

-- profiles
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_select_admin on public.profiles for select to authenticated
  using ((select public.admin_access_ok()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- banks : lecture pour tout utilisateur connecté, écriture admin
create policy banks_select_all on public.banks for select to authenticated using (true);
create policy banks_insert_admin on public.banks for insert to authenticated
  with check ((select public.admin_access_ok()));
create policy banks_update_admin on public.banks for update to authenticated
  using ((select public.admin_access_ok())) with check ((select public.admin_access_ok()));
create policy banks_delete_admin on public.banks for delete to authenticated
  using ((select public.admin_access_ok()));

-- suggestions « Autre banque » : lecture admin uniquement (votes : aucun accès)
create policy bank_suggestions_select_admin on public.bank_suggestions for select to authenticated
  using ((select public.admin_access_ok()));

-- listes de référence : lecture seule
create policy card_types_select_all on public.card_types for select to authenticated using (true);
create policy loan_purposes_select_all on public.loan_purposes for select to authenticated using (true);

-- demandes : chacun voit les siennes, l'admin voit tout ; aucune écriture directe
create policy loan_requests_select_own on public.loan_requests for select to authenticated
  using (user_id = (select auth.uid()));
create policy loan_requests_select_admin on public.loan_requests for select to authenticated
  using ((select public.admin_access_ok()));

-- historique : lecture seule
create policy loan_history_select_own on public.loan_status_history for select to authenticated
  using (exists (select 1 from public.loan_requests l where l.id = loan_id and l.user_id = (select auth.uid())));
create policy loan_history_select_admin on public.loan_status_history for select to authenticated
  using ((select public.admin_access_ok()));

-- audit : lecture admin uniquement
create policy audit_logs_select_admin on public.audit_logs for select to authenticated
  using ((select public.admin_access_ok()));

-- réglages : seules les limites de montant sont visibles des utilisateurs ; l'admin voit tout
create policy app_settings_select on public.app_settings for select to authenticated
  using (key in ('loan_min_amount', 'loan_max_amount') or (select public.admin_access_ok()));
