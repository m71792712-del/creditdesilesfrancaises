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
