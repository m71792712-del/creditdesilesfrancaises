# SECURITY.md — sécurité du backend

> Projet : **données fictives uniquement**. Ce document décrit les protections **prévues et écrites** dans le SQL. Aucun test d'intrusion n'a été réalisé et le SQL n'a pas pu être exécuté dans l'environnement de rédaction : lancez `tests/sql/security_tests.sql` sur un projet de test avant toute présentation.

## 1. Modèle de menace (résumé)

| Menace | Réponse |
|---|---|
| Un utilisateur lit ou modifie les données d'un autre | RLS sur toutes les tables ; aucune écriture directe sur les demandes ; tests d'isolation |
| Un utilisateur se donne les droits admin | rôle modifiable **uniquement par SQL propriétaire** ; droits de colonne + trigger `profiles_guard` ; le rôle des métadonnées d'inscription est ignoré ; index unique : **un seul admin** |
| Contournement du frontend (appel direct de l'API) | validation complète **dans les fonctions SQL** (montant, motif, banque, longueurs, caractères de contrôle) |
| Injection SQL | aucune concaténation SQL ; paramètres typés ; fonctions `search_path = ''` ; listes fermées (statuts, devises, motifs) |
| XSS via texte saisi (ex. « Autre banque ») | stocké comme texte brut ; **le frontend/admin ne doivent jamais injecter de HTML** (React échappe par défaut) ; export CSV : neutraliser `= + - @` |
| Force brute / énumération / spam | limites Auth de Supabase (par IP) ; limitation de débit **durable en base** pour les demandes et suggestions ; CAPTCHA optionnel |
| Altération des traces | `audit_logs` en **ajout seul** (UPDATE/DELETE/TRUNCATE interdits par trigger, même pour le propriétaire) |
| Fuite de secrets | aucune clé `service_role` ; aucun mot de passe/compte admin dans le code, le seed, les tests ou le README ; `.env*` ignorés par Git |
| Abus de volume (aspiration) | `max_rows = 500`, pagination, `count` estimé conseillé |

## 2. Principes appliqués

- **Moindre privilège** : `REVOKE` explicite sur tout, puis `GRANT` ciblés (migration 4). `anon` n'a accès à **rien** (aucune table, aucune fonction). Les fonctions internes (`check_rate_limit`, `clean_text`, `handle_new_user`…) ne sont pas appelables par l'API.
- **Défense en profondeur** : RLS **et** contrôle de rôle dans chaque fonction admin (`admin_access_ok()`), **et** contrôle côté application.
- **Fonctions `SECURITY DEFINER`** : toutes avec `set search_path = ''` et objets qualifiés ; vérifié par `tests/static.test.ts`.
- **Erreurs génériques** : codes machine courts, sans détail interne ; le frontend ne montre jamais l'erreur brute.
- **Audit** : changements de statut, modération des suggestions, réglages, banques (création/modif./suppression), changement de rôle, suppression de compte.
- **Pas de données sensibles** : aucun numéro de carte, date d'expiration, CVV, PIN, IBAN ou pièce d'identité (vérifié par test statique). Les champs `demo_*` sont **fictifs** et **jamais** utilisés pour s'authentifier ou récupérer un compte.
- **Minimisation / RGPD** : `delete_my_account()` supprime compte, profil, demandes et historique ; l'audit ne conserve qu'un identifiant pseudonyme.

## 3. Mot de passe : 8 caractères, et pourquoi c'est acceptable ici

La politique (8 caractères minimum, une lettre et un chiffre) suit la maquette. Un mot de passe court est plus facile à deviner : la protection repose donc sur **la limitation des tentatives** plutôt que sur la longueur :
1. limites Auth de Supabase par adresse IP (`[auth.rate_limit]`) ;
2. CAPTCHA activable en une étape (§5) ;
3. jetons de courte durée (1 h) avec rotation des jetons de rafraîchissement ;
4. données de démonstration uniquement ; compte **admin** protégé par un mot de passe long (≥ 14 caractères) et MFA activable.

Limites à connaître : plusieurs personnes derrière la même IP (salle de classe, jury) partagent le quota ; la protection contre les mots de passe fuités est une option de Supabase réservée à certains plans.

## 4. Compte administrateur

- Un seul compte. Création : tableau de bord Supabase (*Authentication → Users → Add user*, e-mail + mot de passe ≥ 14 caractères **unique**), puis `supabase/promote_admin.sql`. **Jamais** de mot de passe dans le code, un fichier d'exemple ou le dépôt.
- Un second admin est impossible (index `profiles_single_admin`) ; pour changer d'admin : rétrograder l'ancien par SQL, puis promouvoir le nouveau.
- Les fonctions et lectures admin exigent le rôle **et**, si activé, une session MFA (`aal2`).

## 5. Activer le CAPTCHA et le MFA admin (une étape chacun)

**CAPTCHA (Cloudflare Turnstile)** — désactivé par défaut :
1. Créez un widget Turnstile (hostnames : `creditdesilesfrancaises.vercel.app`, `creditdesilesfrancaisesadmin.vercel.app`, `localhost`).
2. Supabase → *Authentication → Attack Protection* : activez le CAPTCHA, fournisseur Turnstile, collez la clé **secrète** (ou, en local, décommentez `[auth.captcha]` dans `config.toml`).
3. Frontend/Admin : `NEXT_PUBLIC_CAPTCHA_ENABLED=true` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY=...` puis redéployez.
⚠ Une fois activé côté Supabase, un appel d'authentification **sans jeton CAPTCHA est refusé** : activez les deux côtés ensemble.

**MFA admin** — disponible, non imposé par défaut :
1. Connectez-vous à l'admin et enrôlez l'application d'authentification (TOTP) dans le profil admin.
2. Connecté **avec le MFA**, imposez-le : page *Paramètres* de l'admin, ou SQL :
   `update public.app_settings set value = 'true'::jsonb where key = 'require_admin_mfa';`
   (la fonction `admin_update_setting` refuse l'activation depuis une session sans MFA, pour éviter de vous verrouiller).
3. Secours (authentificateur perdu) : `update public.app_settings set value = 'false'::jsonb where key = 'require_admin_mfa';` dans le SQL Editor.

## 6. Correspondance OWASP Top 10 (2021)

| Risque | Mesures dans ce backend | Reste à faire côté applications |
|---|---|---|
| A01 Contrôle d'accès défaillant | RLS partout, REVOKE/GRANT minimaux, contrôle admin dans les fonctions, un seul admin | revérifier la session et le rôle sur chaque page/action ; ne jamais se fier à l'interface |
| A02 Défaillances cryptographiques | mots de passe hachés et TLS gérés par Supabase ; aucune donnée sensible stockée | HTTPS partout, HSTS, cookies httpOnly |
| A03 Injection | RPC paramétrées, aucune SQL dynamique, listes fermées | échapper les filtres `ilike`, ne jamais injecter de HTML, neutraliser le CSV |
| A04 Conception non sécurisée | validation en base, limitation de débit, séparation site/admin, tests d'isolation | limiter les parcours abusables |
| A05 Mauvaise configuration | services inutiles désactivés, redirections restreintes, `max_rows`, aucune clé service | en-têtes de sécurité/CSP, variables d'environnement par environnement |
| A06 Composants vulnérables | peu de dépendances (tests uniquement) | `npm audit`, mises à jour régulières, CI |
| A07 Authentification | politique de mot de passe, limites Auth, CAPTCHA/MFA activables, rotation des jetons | gestion de session, déconnexion, expiration d'inactivité (admin) |
| A08 Intégrité logicielle | migrations versionnées, `setup_complete.sql` vérifié par test | CI, dépendances épinglées |
| A09 Journalisation | `audit_logs` en ajout seul, journaux Supabase | surveiller et alerter (OPERATIONS.md) |
| A10 SSRF | aucun appel sortant dans le backend | — |

## 7. Risques résiduels (à assumer ou à traiter)

- **Admin sans MFA par défaut** : seule la force du mot de passe protège l'admin. Activez le MFA si la plateforme dépasse le cadre de la démonstration.
- **Énumération d'e-mails** : avec la confirmation d'e-mail désactivée, l'inscription révèle si un e-mail existe déjà (comportement de Supabase). Atténué par les limites de débit et le CAPTCHA optionnel.
- **Quota d'IP partagé** (NAT) et **SMTP par défaut très limité** : voir OPERATIONS.md.
- **Téléphone** : donnée personnelle stockée (même fictive en démonstration) : pas de vrais numéros.
- **Dépendance à un fournisseur** (Supabase, Vercel) : sauvegardes et plan de reprise dans OPERATIONS.md.
- **Aucun test d'intrusion réel** ; cette checklist ne remplace pas un audit.

## 8. Vérifier

- `npm run test:static` (sans base) : RLS sur chaque table, `search_path` sur chaque fonction, aucun droit à `anon`, aucun `service_role`, seed cohérent.
- `tests/sql/security_tests.sql` (projet de **test**) : isolation, auto-promotion impossible, un seul admin, validations, limitation de débit, « Autre banque », fonctions admin, MFA optionnel, audit en ajout seul, suppression de compte.
- `tests/integration/api.test.ts` : mêmes garanties **via l'API**, comme le frontend.
