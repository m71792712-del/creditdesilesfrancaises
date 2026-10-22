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
