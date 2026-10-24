-- Fichier généré par scripts/build_setup.sh : migrations + seed. Ne pas modifier à la main.

-- ============ migrations/20261021000100_schema.sql ============
-- =====================================================================
-- Crédit des îles françaises — BACKEND SUPABASE
-- PROJET
-- Migration 1/4 : schéma (tables, contraintes, index).
-- =====================================================================

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------
-- Fonctions pures de normalisation (utilisées par les index d'unicité)
-- ---------------------------------------------------------------------
-- Clé de comparaison : minuscules, sans accents, sans ponctuation, espaces réduits.
create or replace function public.normalize_text(p_text text)
returns text language sql immutable parallel safe set search_path = '' as $$
  select coalesce(
    nullif(btrim(regexp_replace(lower(translate(p_text, 'àÀâÂäÄáÁãÃåÅçÇéÉèÈêÊëËíÍìÌîÎïÏñÑóÓòÒôÔöÖõÕúÚùÙûÛüÜýÝÿŸœŒæÆøØß’‘`´', 'aaaaaaaaaaaacceeeeeeeeiiiiiiiinnoooooooooouuuuuuuuyyyyooaaoos''''''''')), '[^a-z0-9]+', ' ', 'g')), ''),
    lower(btrim(p_text))
  );
$$;

create or replace function public.slugify(p_text text)
returns text language sql immutable parallel safe set search_path = '' as $$
  select left(trim(both '-' from replace(public.normalize_text(p_text), ' ', '-')), 80);
$$;

-- Vrai si le texte contient des caractères de contrôle (hors retour à la ligne et tabulation).
create or replace function public.has_control_chars(p_text text)
returns boolean language sql immutable parallel safe set search_path = '' as $$
  select coalesce(p_text ~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]', false);
$$;

-- ---------------------------------------------------------------------
-- Tables de référence
-- ---------------------------------------------------------------------
create table public.app_settings (
  key         text primary key check (key ~ '^[a-z_]{3,60}$'),
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

create table public.loan_purposes (
  code              text primary key check (code ~ '^[a-z_]{2,40}$'),
  sort_order        smallint not null unique,
  label_fr          text not null,
  label_en          text not null,
  requires_details  boolean not null default false
);

create table public.card_types (
  id          uuid primary key default gen_random_uuid(),
  family      text not null check (char_length(family) between 2 and 60),
  name        text not null check (char_length(name) between 2 and 80),
  sort_order  smallint not null,
  is_active   boolean not null default true,
  unique (name)
);

create table public.banks (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  name        text not null check (char_length(btrim(name)) between 2 and 120),
  territory   text not null default '' check (char_length(territory) <= 80),
  type        text not null default 'bank' check (type in ('bank', 'fintech')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index banks_name_key on public.banks (public.normalize_text(name));
create index banks_active_name_idx on public.banks (is_active, name);
create index banks_territory_idx on public.banks (territory);
create index banks_type_idx on public.banks (type);

-- ---------------------------------------------------------------------
-- Utilisateurs
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  first_name  text not null check (char_length(first_name) between 1 and 60),
  last_name   text not null check (char_length(last_name) between 1 and 60),
  phone       text check (phone is null or phone ~ '^\+?[0-9 ().-]{6,20}$'),
  email       text not null check (char_length(email) between 3 and 254),
  role        text not null default 'user' check (role in ('user', 'admin')),
  -- Données de DÉMONSTRATION fictives : jamais utilisées pour s'authentifier ni récupérer un compte.
  demo_color  text check (demo_color is null or char_length(demo_color) between 1 and 30),
  demo_city   text check (demo_city is null or char_length(demo_city) between 1 and 60),
  demo_digit  smallint check (demo_digit is null or demo_digit between 0 and 9),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index profiles_email_key on public.profiles (lower(email));
-- Un seul compte administrateur possible, quoi qu'il arrive.
create unique index profiles_single_admin on public.profiles ((role)) where role = 'admin';
create index profiles_created_idx on public.profiles (created_at desc, id desc);
create index profiles_first_trgm_idx on public.profiles using gin (first_name extensions.gin_trgm_ops);
create index profiles_last_trgm_idx on public.profiles using gin (last_name extensions.gin_trgm_ops);
create index profiles_email_trgm_idx on public.profiles using gin (email extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------
-- Section « Autre banque » : suggestions des utilisateurs, modérées par l'admin
-- ---------------------------------------------------------------------
create table public.bank_suggestions (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (char_length(btrim(name)) between 2 and 100),
  name_key          text not null,
  submit_count      integer not null default 0 check (submit_count >= 0),
  status            text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'merged')),
  resolved_bank_id  uuid references public.banks (id) on delete set null,
  reviewed_by       uuid references public.profiles (id) on delete set null,
  reviewed_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index bank_suggestions_key on public.bank_suggestions (name_key);
create index bank_suggestions_status_idx on public.bank_suggestions (status, created_at desc);
create index bank_suggestions_resolved_idx on public.bank_suggestions (resolved_bank_id);

create table public.bank_suggestion_votes (
  suggestion_id  uuid not null references public.bank_suggestions (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (suggestion_id, user_id)
);
create index bank_suggestion_votes_user_idx on public.bank_suggestion_votes (user_id);

-- ---------------------------------------------------------------------
-- Demandes de prêt (démonstration)
-- ---------------------------------------------------------------------
create table public.loan_requests (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles (id) on delete cascade,
  amount              numeric(14, 2) not null check (amount > 0 and amount <= 10000000),
  currency            text not null default 'EUR' check (currency in ('EUR', 'USD', 'GBP', 'CAD')),
  purpose_code        text not null references public.loan_purposes (code),
  purpose_details     text check (purpose_details is null or char_length(btrim(purpose_details)) between 3 and 300),
  description         text not null check (char_length(btrim(description)) between 20 and 2000),
  bank_id             uuid references public.banks (id) on delete restrict,
  custom_bank_name    text check (custom_bank_name is null or char_length(btrim(custom_bank_name)) between 2 and 100),
  bank_suggestion_id  uuid references public.bank_suggestions (id) on delete set null,
  card_type_id        uuid references public.card_types (id) on delete restrict,
  status              text not null default 'pending' check (status in ('pending', 'under_review', 'approved', 'rejected')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint loan_requests_bank_choice_chk check (
    (bank_id is not null and custom_bank_name is null) or (bank_id is null and custom_bank_name is not null)
  ),
  constraint loan_requests_purpose_details_chk check (
    (purpose_code = 'other' and purpose_details is not null) or (purpose_code <> 'other' and purpose_details is null)
  )
);
create index loan_requests_user_idx on public.loan_requests (user_id, created_at desc, id desc);
create index loan_requests_created_idx on public.loan_requests (created_at desc, id desc);
create index loan_requests_status_idx on public.loan_requests (status, created_at desc);
create index loan_requests_purpose_idx on public.loan_requests (purpose_code, created_at desc);
create index loan_requests_bank_idx on public.loan_requests (bank_id);
create index loan_requests_suggestion_idx on public.loan_requests (bank_suggestion_id);
create index loan_requests_card_idx on public.loan_requests (card_type_id);

create table public.loan_status_history (
  id          uuid primary key default gen_random_uuid(),
  loan_id     uuid not null references public.loan_requests (id) on delete cascade,
  old_status  text,
  new_status  text not null check (new_status in ('pending', 'under_review', 'approved', 'rejected')),
  comment     text check (comment is null or char_length(comment) <= 500),
  changed_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index loan_status_history_loan_idx on public.loan_status_history (loan_id, created_at);
create index loan_status_history_actor_idx on public.loan_status_history (changed_by);

-- Journal d'audit : volontairement SANS clé étrangère (il survit à la suppression d'un compte) et append-only.
create table public.audit_logs (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid,
  action       text not null,
  entity_type  text not null,
  entity_id    uuid,
  details      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc, id desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

-- Compteurs de limitation de débit (fenêtre fixe), durables car stockés en base.
create table public.rate_limits (
  key           text not null,
  window_start  timestamptz not null,
  hits          integer not null default 0,
  primary key (key, window_start)
);
create index rate_limits_window_idx on public.rate_limits (window_start);

-- ============ migrations/20261021000200_helpers_triggers.sql ============
-- =====================================================================
-- Migration 2/4 : fonctions utilitaires et triggers.
-- Toutes les fonctions fixent search_path = '' (objets toujours qualifiés).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Utilitaires
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.setting_numeric(p_key text, p_default numeric)
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select (value #>> '{}')::numeric from public.app_settings where key = p_key and jsonb_typeof(value) = 'number'),
    p_default
  );
$$;

create or replace function public.setting_bool(p_key text, p_default boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select (value #>> '{}')::boolean from public.app_settings where key = p_key and jsonb_typeof(value) = 'boolean'),
    p_default
  );
$$;

-- Texte libre : trim, bornes de longueur, caractères de contrôle refusés. Lève le code d'erreur donné.
create or replace function public.clean_text(p_text text, p_min integer, p_max integer, p_error text)
returns text language plpgsql set search_path = '' as $$
declare
  v text := btrim(coalesce(p_text, ''));
begin
  if char_length(v) < p_min or char_length(v) > p_max or public.has_control_chars(v) then
    raise exception '%', p_error using errcode = 'P0001';
  end if;
  return v;
end;
$$;

-- Limitation de débit à fenêtre fixe. Renvoie true si l'appel est autorisé.
-- (Appelée uniquement depuis d'autres fonctions SECURITY DEFINER ; non exposée à l'API.)
create or replace function public.check_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_window timestamptz;
  v_hits integer;
begin
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;
  -- Nettoyage opportuniste (aucune dépendance à pg_cron).
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '2 days';
  end if;
  return v_hits <= p_max;
end;
$$;

-- ---------------------------------------------------------------------
-- Rôle administrateur
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Accès administrateur effectif : rôle admin ET, si le réglage est actif, session MFA (aal2).
create or replace function public.admin_access_ok()
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    return false;
  end if;
  if public.setting_bool('require_admin_mfa', false)
     and coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    return false;
  end if;
  return true;
end;
$$;

-- ---------------------------------------------------------------------
-- Profils
-- ---------------------------------------------------------------------
-- Création automatique du profil à l'inscription. Ne lit JAMAIS de rôle dans les métadonnées :
-- le rôle est toujours « user ». Ne lève pas d'erreur : valeurs de repli si les métadonnées sont absentes
-- (cas du compte créé depuis le tableau de bord Supabase). Les champs sont imposés par le frontend.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_email text := coalesce(new.email, '');
  v_first text := left(btrim(coalesce(m ->> 'first_name', '')), 60);
  v_last text := left(btrim(coalesce(m ->> 'last_name', '')), 60);
  v_phone text := left(btrim(coalesce(m ->> 'phone', '')), 20);
  v_color text := nullif(left(btrim(coalesce(m ->> 'demo_color', '')), 30), '');
  v_city text := nullif(left(btrim(coalesce(m ->> 'demo_city', '')), 60), '');
  v_digit smallint := null;
begin
  if v_first = '' then
    v_first := coalesce(nullif(left(split_part(v_email, '@', 1), 60), ''), 'Utilisateur');
  end if;
  if v_last = '' then
    v_last := '-';
  end if;
  if v_phone !~ '^\+?[0-9 ().-]{6,20}$' then
    v_phone := null;
  end if;
  if (m ->> 'demo_digit') ~ '^[0-9]$' then
    v_digit := (m ->> 'demo_digit')::smallint;
  end if;

  insert into public.profiles (id, first_name, last_name, phone, email, demo_color, demo_city, demo_digit)
  values (new.id, v_first, v_last, v_phone, v_email, v_color, v_city, v_digit);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Garde-fou : une requête API (auth.uid() non nul) ne peut jamais modifier identifiant, e-mail, rôle ni date de création.
-- Le rôle ne change que par SQL propriétaire (SQL Editor), où auth.uid() est nul.
create or replace function public.profiles_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null
     and (new.id <> old.id
          or new.role is distinct from old.role
          or new.email is distinct from old.email
          or new.created_at is distinct from old.created_at) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_trg before update on public.profiles
  for each row execute function public.profiles_guard();
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Audit des changements de rôle (même réalisés depuis le SQL Editor).
create or replace function public.audit_profile_role()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.role is distinct from old.role then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
    values (auth.uid(), 'profile.role_changed', 'profile', new.id,
            jsonb_build_object('from', old.role, 'to', new.role));
  end if;
  return null;
end;
$$;

create trigger audit_profile_role_trg after update on public.profiles
  for each row execute function public.audit_profile_role();

-- ---------------------------------------------------------------------
-- Banques
-- ---------------------------------------------------------------------
create trigger banks_set_updated_at before update on public.banks
  for each row execute function public.set_updated_at();
create trigger bank_suggestions_set_updated_at before update on public.bank_suggestions
  for each row execute function public.set_updated_at();

-- Audit des écritures de l'admin sur les banques (requêtes API authentifiées uniquement : le seed n'est pas journalisé).
create or replace function public.audit_banks()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    return null;
  end if;
  if tg_op = 'INSERT' then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
    values (auth.uid(), 'bank.created', 'bank', new.id, jsonb_build_object('name', new.name));
  elsif tg_op = 'UPDATE' then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
    values (auth.uid(), 'bank.updated', 'bank', new.id,
            jsonb_build_object('name', new.name, 'was_active', old.is_active, 'is_active', new.is_active));
  else
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
    values (auth.uid(), 'bank.deleted', 'bank', old.id, jsonb_build_object('name', old.name));
  end if;
  return null;
end;
$$;

create trigger audit_banks_trg after insert or update or delete on public.banks
  for each row execute function public.audit_banks();

-- ---------------------------------------------------------------------
-- Demandes de prêt
-- ---------------------------------------------------------------------
create trigger loan_requests_set_updated_at before update on public.loan_requests
  for each row execute function public.set_updated_at();

-- Première ligne d'historique à la création d'une demande.
create or replace function public.loan_requests_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.loan_status_history (loan_id, old_status, new_status, comment, changed_by)
  values (new.id, null, new.status, null, new.user_id);
  return null;
end;
$$;

create trigger loan_requests_after_insert_trg after insert on public.loan_requests
  for each row execute function public.loan_requests_after_insert();

-- ---------------------------------------------------------------------
-- Journal d'audit en ajout seul : UPDATE, DELETE et TRUNCATE interdits, pour tous les rôles.
-- ---------------------------------------------------------------------
create or replace function public.audit_logs_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'audit_logs_are_append_only' using errcode = '42501';
end;
$$;

create trigger audit_logs_no_change before update or delete on public.audit_logs
  for each row execute function public.audit_logs_immutable();
create trigger audit_logs_no_truncate before truncate on public.audit_logs
  for each statement execute function public.audit_logs_immutable();

-- ============ migrations/20261021000300_rpc.sql ============
-- =====================================================================
-- Migration 3/4 : fonctions RPC (toute la logique sensible est en base).
-- Codes d'erreur : message = code machine (voir docs/CONTRACT.md).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Utilisateur : créer une demande de prêt
-- ---------------------------------------------------------------------
create or replace function public.create_loan_request(
  p_amount numeric,
  p_currency text,
  p_purpose_code text,
  p_purpose_details text,
  p_description text,
  p_bank_id uuid,
  p_custom_bank_name text,
  p_card_type_id uuid default null
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_min numeric := public.setting_numeric('loan_min_amount', 500);
  v_max numeric := public.setting_numeric('loan_max_amount', 100000);
  v_details text := null;
  v_description text;
  v_bank uuid := p_bank_id;
  v_custom text := null;
  v_key text;
  v_sug_id uuid := null;
  v_sug_status text;
  v_sug_resolved uuid;
  v_loan uuid;
begin
  if v_uid is null or not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  -- Montant
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;
  if p_amount < v_min or p_amount > v_max then
    raise exception 'amount_out_of_range' using errcode = 'P0001';
  end if;

  -- Devise
  if p_currency is null or p_currency not in ('EUR', 'USD', 'GBP', 'CAD') then
    raise exception 'invalid_currency' using errcode = 'P0001';
  end if;

  -- Motif (liste fermée de 31 codes) et précision (obligatoire uniquement pour « other »)
  if p_purpose_code is null or not exists (select 1 from public.loan_purposes where code = p_purpose_code) then
    raise exception 'invalid_purpose' using errcode = 'P0001';
  end if;
  if p_purpose_code = 'other' then
    v_details := public.clean_text(p_purpose_details, 3, 300, 'purpose_details_required');
  elsif nullif(btrim(coalesce(p_purpose_details, '')), '') is not null then
    raise exception 'purpose_details_unexpected' using errcode = 'P0001';
  end if;

  v_description := public.clean_text(p_description, 20, 2000, 'invalid_description');

  -- Banque : exactement l'une des deux options (banque de la liste OU « Autre banque »)
  if (p_bank_id is null) = (nullif(btrim(coalesce(p_custom_bank_name, '')), '') is null) then
    raise exception 'invalid_bank' using errcode = 'P0001';
  end if;

  if p_bank_id is not null then
    if not exists (select 1 from public.banks where id = p_bank_id and is_active) then
      raise exception 'invalid_bank' using errcode = 'P0001';
    end if;
  else
    v_custom := regexp_replace(public.clean_text(p_custom_bank_name, 2, 100, 'invalid_bank'), '\s+', ' ', 'g');
    v_key := public.normalize_text(v_custom);
    if v_key !~ '[[:alnum:]]' then
      raise exception 'invalid_bank' using errcode = 'P0001';
    end if;

    -- Le nom correspond déjà à une banque de la liste : on utilise la banque existante.
    select id into v_bank from public.banks where public.normalize_text(name) = v_key and is_active limit 1;
    if v_bank is not null then
      v_custom := null;
    else
      insert into public.bank_suggestions (name, name_key)
      values (v_custom, v_key)
      on conflict (name_key) do nothing;

      select id, status, resolved_bank_id into v_sug_id, v_sug_status, v_sug_resolved
        from public.bank_suggestions where name_key = v_key;

      if v_sug_status in ('merged', 'approved') and v_sug_resolved is not null
         and exists (select 1 from public.banks where id = v_sug_resolved and is_active) then
        v_bank := v_sug_resolved;   -- déjà traitée par l'admin : on rattache à la banque retenue
        v_custom := null;
        v_sug_id := null;
      elsif v_sug_status = 'pending'
            and not exists (select 1 from public.bank_suggestion_votes where suggestion_id = v_sug_id and user_id = v_uid) then
        if not public.check_rate_limit('suggest:' || v_uid::text, public.setting_numeric('suggestions_per_day', 5)::integer, 86400) then
          raise exception 'rate_limited' using errcode = 'P0001';
        end if;
        insert into public.bank_suggestion_votes (suggestion_id, user_id) values (v_sug_id, v_uid) on conflict do nothing;
        update public.bank_suggestions set submit_count = submit_count + 1 where id = v_sug_id;
      end if;
    end if;
  end if;

  -- Type de carte (facultatif)
  if p_card_type_id is not null
     and not exists (select 1 from public.card_types where id = p_card_type_id and is_active) then
    raise exception 'invalid_card_type' using errcode = 'P0001';
  end if;

  -- Limitation de débit (après validation : une requête invalide ne consomme pas le quota)
  if not public.check_rate_limit('loan:' || v_uid::text, public.setting_numeric('loans_per_hour', 5)::integer, 3600) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.loan_requests
    (user_id, amount, currency, purpose_code, purpose_details, description,
     bank_id, custom_bank_name, bank_suggestion_id, card_type_id, status)
  values
    (v_uid, p_amount, p_currency, p_purpose_code, v_details, v_description,
     v_bank, v_custom, v_sug_id, p_card_type_id, 'pending')   -- statut TOUJOURS « pending »
  returning id into v_loan;

  return v_loan;
end;
$$;

-- ---------------------------------------------------------------------
-- Admin : changer le statut d'une demande (commentaire obligatoire)
-- ---------------------------------------------------------------------
create or replace function public.admin_update_loan_status(p_loan_id uuid, p_new_status text, p_comment text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_old text;
  v_comment text;
begin
  if not public.admin_access_ok() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_new_status is null or p_new_status not in ('pending', 'under_review', 'approved', 'rejected') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  v_comment := public.clean_text(p_comment, 3, 500, 'invalid_comment');

  select status into v_old from public.loan_requests where id = p_loan_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_old = p_new_status then
    raise exception 'status_unchanged' using errcode = 'P0001';
  end if;

  update public.loan_requests set status = p_new_status where id = p_loan_id;
  insert into public.loan_status_history (loan_id, old_status, new_status, comment, changed_by)
  values (p_loan_id, v_old, p_new_status, v_comment, auth.uid());
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'loan.status_changed', 'loan', p_loan_id,
          jsonb_build_object('from', v_old, 'to', p_new_status));
end;
$$;

-- ---------------------------------------------------------------------
-- Admin : modérer une suggestion « Autre banque » (approve | reject | merge)
-- ---------------------------------------------------------------------
create or replace function public.admin_moderate_bank_suggestion(
  p_suggestion_id uuid,
  p_action text,
  p_target_bank_id uuid default null,
  p_territory text default '',
  p_type text default 'bank'
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_sug public.bank_suggestions%rowtype;
  v_bank uuid := null;
  v_base text;
  v_slug text;
  v_i integer := 1;
begin
  if not public.admin_access_ok() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('approve', 'reject', 'merge') then
    raise exception 'invalid_action' using errcode = 'P0001';
  end if;

  select * into v_sug from public.bank_suggestions where id = p_suggestion_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_sug.status <> 'pending' then
    raise exception 'already_reviewed' using errcode = 'P0001';
  end if;

  if p_action = 'approve' then
    if p_type is null or p_type not in ('bank', 'fintech') then
      raise exception 'invalid_type' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.banks where public.normalize_text(name) = v_sug.name_key) then
      raise exception 'bank_exists' using errcode = 'P0001';   -- utiliser « merge »
    end if;
    v_base := public.slugify(v_sug.name);
    if v_base is null or v_base !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
      v_base := 'bank-' || substr(md5(v_sug.name_key), 1, 8);
    end if;
    v_slug := v_base;
    while exists (select 1 from public.banks where slug = v_slug) loop
      v_i := v_i + 1;
      v_slug := left(v_base, 74) || '-' || v_i::text;
    end loop;
    insert into public.banks (slug, name, territory, type)
    values (v_slug, v_sug.name, left(btrim(coalesce(p_territory, '')), 80), p_type)
    returning id into v_bank;
  elsif p_action = 'merge' then
    if p_target_bank_id is null or not exists (select 1 from public.banks where id = p_target_bank_id and is_active) then
      raise exception 'invalid_bank' using errcode = 'P0001';
    end if;
    v_bank := p_target_bank_id;
  end if;

  if v_bank is not null then
    -- Rattache les demandes concernées à la banque retenue (bank_id et custom_bank_name changent ensemble).
    update public.loan_requests set bank_id = v_bank, custom_bank_name = null
     where bank_suggestion_id = p_suggestion_id;
  end if;

  update public.bank_suggestions
     set status = case p_action when 'approve' then 'approved' when 'merge' then 'merged' else 'rejected' end,
         resolved_bank_id = v_bank,
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_suggestion_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'bank_suggestion.' || p_action, 'bank_suggestion', p_suggestion_id,
          jsonb_build_object('name', v_sug.name, 'bank_id', v_bank));
  return v_bank;
end;
$$;

-- ---------------------------------------------------------------------
-- Admin : statistiques du tableau de bord
-- ---------------------------------------------------------------------
create or replace function public.admin_stats()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.admin_access_ok() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'loans', (select count(*) from public.loan_requests),
    'loans_last_7_days', (select count(*) from public.loan_requests where created_at > now() - interval '7 days'),
    'banks_active', (select count(*) from public.banks where is_active),
    'pending_suggestions', (select count(*) from public.bank_suggestions where status = 'pending'),
    'by_status', coalesce(
      (select jsonb_object_agg(status, c) from (select status, count(*) as c from public.loan_requests group by status) s),
      '{}'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Admin : modifier un réglage (liste blanche de clés, validation stricte, audit)
-- ---------------------------------------------------------------------
create or replace function public.admin_update_setting(p_key text, p_value jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_num numeric;
  v_min numeric;
  v_max numeric;
begin
  if not public.admin_access_ok() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_key is null or p_value is null then
    raise exception 'invalid_setting' using errcode = 'P0001';
  end if;

  if p_key in ('loan_min_amount', 'loan_max_amount') then
    if jsonb_typeof(p_value) <> 'number' then
      raise exception 'invalid_setting' using errcode = 'P0001';
    end if;
    v_num := (p_value #>> '{}')::numeric;
    v_min := case when p_key = 'loan_min_amount' then v_num else public.setting_numeric('loan_min_amount', 500) end;
    v_max := case when p_key = 'loan_max_amount' then v_num else public.setting_numeric('loan_max_amount', 100000) end;
    if v_num <= 0 or v_num > 10000000 or v_min >= v_max then
      raise exception 'invalid_setting' using errcode = 'P0001';
    end if;
  elsif p_key in ('loans_per_hour', 'suggestions_per_day') then
    if jsonb_typeof(p_value) <> 'number' then
      raise exception 'invalid_setting' using errcode = 'P0001';
    end if;
    v_num := (p_value #>> '{}')::numeric;
    if v_num <> trunc(v_num) or v_num < 1 or v_num > case when p_key = 'loans_per_hour' then 100 else 50 end then
      raise exception 'invalid_setting' using errcode = 'P0001';
    end if;
  elsif p_key = 'require_admin_mfa' then
    if jsonb_typeof(p_value) <> 'boolean' then
      raise exception 'invalid_setting' using errcode = 'P0001';
    end if;
    -- Anti-verrouillage : on n'impose le MFA que depuis une session déjà en MFA (aal2).
    if (p_value #>> '{}')::boolean and coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
      raise exception 'mfa_enrollment_required' using errcode = 'P0001';
    end if;
  else
    raise exception 'invalid_setting' using errcode = 'P0001';
  end if;

  insert into public.app_settings (key, value, updated_at, updated_by)
  values (p_key, p_value, now(), auth.uid())
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = auth.uid();

  insert into public.audit_logs (actor_id, action, entity_type, details)
  values (auth.uid(), 'setting.updated', 'setting', jsonb_build_object('key', p_key, 'value', p_value));
end;
$$;

-- ---------------------------------------------------------------------
-- Utilisateur : supprimer son compte et ses données (RGPD)
-- ---------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if public.is_admin() then
    raise exception 'cannot_delete_admin' using errcode = 'P0001';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (v_uid, 'account.deleted', 'profile', v_uid, '{}'::jsonb);

  -- Cascade : profil, demandes, historique et votes sont supprimés avec le compte d'authentification.
  delete from auth.users where id = v_uid;
end;
$$;

-- ============ migrations/20261021000400_rls_privileges.sql ============
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

-- ============ seed.sql ============
-- =====================================================================
-- Crédit des îles françaises — données de référence (idempotent : rejouable sans risque).
-- PROJET. Contient : réglages, 31 motifs, types de carte (2_1.docx), 12 banques (logos fournis).
-- Les territoires et types de banques sont INDICATIFS : l'admin peut les corriger dans l'application.
-- =====================================================================

insert into public.app_settings (key, value) values
  ('loan_min_amount', '500'::jsonb),
  ('loan_max_amount', '100000'::jsonb),
  ('loans_per_hour', '5'::jsonb),
  ('suggestions_per_day', '5'::jsonb),
  ('require_admin_mfa', 'false'::jsonb)
on conflict (key) do nothing;

insert into public.loan_purposes (code, sort_order, label_fr, label_en, requires_details) values
  ('personal', 1, 'Projet personnel', 'Personal project', false),
  ('family', 2, 'Projet familial', 'Family project', false),
  ('real_estate', 3, 'Projet immobilier', 'Real estate project', false),
  ('professional', 4, 'Projet professionnel', 'Professional project', false),
  ('entrepreneurial', 5, 'Projet entrepreneurial', 'Entrepreneurial project', false),
  ('commercial', 6, 'Projet commercial', 'Commercial project', false),
  ('agricultural', 7, 'Projet agricole', 'Agricultural project', false),
  ('livestock', 8, 'Projet d’élevage', 'Livestock farming project', false),
  ('education', 9, 'Projet d’études et de formation', 'Education and training project', false),
  ('construction', 10, 'Projet de construction', 'Construction project', false),
  ('renovation', 11, 'Projet de rénovation', 'Renovation project', false),
  ('equipment', 12, 'Projet d’équipement', 'Equipment project', false),
  ('vehicle', 13, 'Projet d’achat de véhicule', 'Vehicle purchase project', false),
  ('wedding', 14, 'Projet de mariage', 'Wedding project', false),
  ('health', 15, 'Projet de santé', 'Health project', false),
  ('travel', 16, 'Projet de voyage', 'Travel project', false),
  ('investment', 17, 'Projet d’investissement', 'Investment project', false),
  ('business_creation', 18, 'Projet de création d’entreprise', 'Business creation project', false),
  ('business_extension', 19, 'Projet d’extension d’entreprise', 'Business expansion project', false),
  ('land', 20, 'Projet d’achat de terrain', 'Land purchase project', false),
  ('home_improvement', 21, 'Projet d’aménagement de maison', 'Home improvement project', false),
  ('solar', 22, 'Projet d’énergie solaire', 'Solar energy project', false),
  ('transport', 23, 'Projet de transport', 'Transport project', false),
  ('restaurant', 24, 'Projet de restauration', 'Restaurant project', false),
  ('agri_food', 25, 'Projet de transformation agroalimentaire', 'Food processing project', false),
  ('professional_equipment', 26, 'Projet d’achat de matériel professionnel', 'Professional equipment purchase project', false),
  ('stock', 27, 'Projet de financement de stock', 'Stock financing project', false),
  ('activity_development', 28, 'Projet de développement d’activité', 'Business development project', false),
  ('family_reunification', 29, 'Projet de regroupement familial', 'Family reunification project', false),
  ('debt_consolidation', 30, 'Projet de consolidation de dettes', 'Debt consolidation project', false),
  ('other', 31, 'Autre (à préciser)', 'Other (please specify)', true)
on conflict (code) do nothing;

insert into public.card_types (family, name, sort_order) values
  ('Nickel / NewPay', 'NewPay', 1),
  ('Nickel / NewPay', 'Nickel Classic', 2),
  ('Nickel / NewPay', 'My Nickel', 3),
  ('Nickel / NewPay', 'Nickel Chrome', 4),
  ('Nickel / NewPay', 'Nickel Metal', 5),
  ('Visa', 'Visa Classic', 6),
  ('Visa', 'Visa Premier', 7),
  ('Visa', 'Visa Electron', 8),
  ('Visa', 'Visa Platinum', 9),
  ('Visa', 'Visa Infinite', 10),
  ('Visa', 'Visa Gold', 11),
  ('Visa', 'Visa Business', 12),
  ('Visa', 'Visa Infinite Business', 13),
  ('Mastercard', 'Mastercard Standard', 14),
  ('Mastercard', 'Mastercard Classic', 15),
  ('Mastercard', 'Gold Mastercard', 16),
  ('Mastercard', 'Mastercard Platinum', 17),
  ('Mastercard', 'Mastercard World Elite', 18),
  ('Mastercard', 'Mastercard Business', 19),
  ('Autres réseaux', 'Maestro', 20),
  ('Autres réseaux', 'V PAY', 21),
  ('Autres réseaux', 'American Express', 22),
  ('Autres réseaux', 'Carte CB (Cartes Bancaires)', 23),
  ('Types de cartes', 'Carte prépayée', 24),
  ('Types de cartes', 'Carte virtuelle', 25),
  ('Types de cartes', 'Carte à autorisation systématique', 26),
  ('Types de cartes', 'Carte professionnelle', 27),
  ('Types de cartes', 'Carte de débit', 28),
  ('Types de cartes', 'Carte de crédit', 29),
  ('Types de cartes', 'Carte de retrait', 30),
  ('Types de cartes', 'Carte rechargeable', 31),
  ('Types de cartes', 'Carte cadeau bancaire', 32),
  ('Cartes régionales', 'Carte SOCREDO', 33),
  ('Cartes régionales', 'Carte Aircalin', 34)
on conflict (name) do nothing;

-- Le slug correspond au nom du fichier logo du frontend : public/banks/<slug>.webp
insert into public.banks (slug, name, territory, type) values
  ('bnp-paribas-antilles-guyane', 'BNP Paribas Antilles-Guyane', 'Antilles-Guyane', 'bank'),
  ('bred-banque-populaire', 'BRED Banque Populaire', 'France et outre-mer', 'bank'),
  ('caisse-d-epargne-cepac', 'Caisse dÉpargne CEPAC', 'France', 'bank'),
  ('credit-agricole-martinique-guyane', 'Crédit Agricole Martinique-Guyane', 'Martinique-Guyane', 'bank'),
  ('lcl', 'LCL', 'France', 'bank'),
  ('credit-mutuel', 'Crédit Mutuel', 'France', 'bank'),
  ('la-banque-postale', 'La Banque Postale', 'France', 'bank'),
  ('deblock', 'DEBLOCK', 'Non précisé', 'fintech'),
  ('banque-de-tahiti', 'Banque de Tahiti', 'Polynésie française', 'bank'),
  ('banque-de-polynesie', 'Banque de Polynésie', 'Polynésie française', 'bank'),
  ('niupay', 'NiuPay', 'Non précisé', 'fintech'),
  ('socredo', 'SOCREDO', 'Polynésie française', 'bank')
on conflict (slug) do nothing;
