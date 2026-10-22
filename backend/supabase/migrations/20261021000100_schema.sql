-- =====================================================================
-- Crédit des îles françaises — BACKEND SUPABASE
-- PROJET : données fictives uniquement.
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
