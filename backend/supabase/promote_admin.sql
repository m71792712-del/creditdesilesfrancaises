-- =====================================================================
-- Promotion du compte ADMINISTRATEUR (un seul compte admin possible).
-- À exécuter UNIQUEMENT par le propriétaire du projet, dans Supabase > SQL Editor.
-- Le rôle ne peut être changé ni depuis l'application, ni via l'API.
--
-- 1) Créez le compte : Supabase > Authentication > Users > « Add user » > « Create new user »
--    (e-mail + mot de passe d'au moins 14 caractères, unique, ne le réutilisez nulle part ;
--     cochez « Auto Confirm User »). Ne mettez JAMAIS ce mot de passe dans le code ou le dépôt.
-- 2) Remplacez l'e-mail ci-dessous puis exécutez le bloc.
-- =====================================================================

do $$
declare
  v_email text := 'creditdesilesfrancaise@gmail.com';   -- <-- À REMPLACER
  v_id uuid;
begin
  select id into v_id from public.profiles where lower(email) = lower(v_email);
  if v_id is null then
    raise exception 'Aucun compte avec cet e-mail. Créez-le d''abord dans Authentication > Users.';
  end if;
  if exists (select 1 from public.profiles where role = 'admin' and id <> v_id) then
    raise exception 'Un administrateur existe déjà (un seul est autorisé). Rétrogradez-le d''abord (voir plus bas).';
  end if;
  update public.profiles set role = 'admin' where id = v_id;
  raise notice 'Compte % promu administrateur.', v_email;
end;
$$;

-- Vérification : doit renvoyer exactement UNE ligne.
select id, email, role from public.profiles where role = 'admin';

-- Facultatif : donner un prénom / nom lisibles à l'admin (le compte créé depuis le tableau de bord n'en a pas).
-- update public.profiles set first_name = 'Prénom', last_name = 'Nom' where role = 'admin';

-- Retour arrière : retirer les droits admin.
-- update public.profiles set role = 'user' where lower(email) = lower('VOTRE_EMAIL@exemple.com');

-- Secours si le MFA est imposé et que l'authentificateur est perdu :
-- update public.app_settings set value = 'false'::jsonb where key = 'require_admin_mfa';
