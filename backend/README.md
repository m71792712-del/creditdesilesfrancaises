# Crédit des îles françaises — backend.zip

> **Projet**

Backend **Supabase** (PostgreSQL + Auth + RLS + fonctions RPC) partagé par le **frontend** (`https://interetdesilesfrancaises.vercel.app`) et l'**admin** (`https://interetdesilesfrancaises.vercel.app`) — . Ce paquet ne contient **aucune interface**.

## Ce qui est testé, ce qui ne l'est pas (lisez ceci d'abord)

| | État |
|---|---|
| Tests statiques (`npm run test:static` : RLS sur chaque table, `search_path` sur chaque fonction, rien pour `anon`, pas de `service_role`, seed : 31 motifs / 34 types de carte / 12 banques, `setup_complete.sql` à jour) | **exécutés ici : 13/13 réussis** |
| Équilibre des `$$` et des parenthèses des fichiers SQL | vérifié |
| **Exécution du SQL dans PostgreSQL** (migrations, seed) | **NON exécutée** : aucun PostgreSQL ni accès Internet dans l'environnement de rédaction |
| `tests/sql/security_tests.sql` (isolation, anti-promotion, un seul admin, validations, limite de débit, « Autre banque », admin, MFA, audit, suppression de compte) | écrit, **jamais exécuté** |
| `tests/integration/api.test.ts`, `loadtest/k6-read.js` | écrits, **jamais exécutés** |
| `config.toml` | à valider avec votre version de la CLI Supabase |
| Audit de sécurité / test d'intrusion | **non réalisé** |

Conséquence : **exécutez `setup_complete.sql` puis `tests/sql/security_tests.sql` sur un projet Supabase de TEST** avant de présenter. Si une erreur apparaît, envoyez-moi le message exact : je corrige.

## Contenu

```
backend/
├─ README.md  package.json  .env.example  .gitignore
├─ supabase/
│  ├─ config.toml                                 # Auth : mot de passe 8 car., redirections, MFA, limites, CAPTCHA (prêt, désactivé)
│  ├─ migrations/20261021000100_schema.sql        # tables, contraintes, index
│  ├─ migrations/20261021000200_helpers_triggers.sql
│  ├─ migrations/20261021000300_rpc.sql           # fonctions : demande, admin, réglages, suppression de compte
│  ├─ migrations/20261021000400_rls_privileges.sql
│  ├─ seed.sql                                    # réglages, 31 motifs, 34 types de carte, 12 banques (idempotent)
│  ├─ setup_complete.sql                          # migrations + seed en UN fichier (généré)
│  └─ promote_admin.sql                           # promotion de l'unique admin (SQL Editor)
├─ tests/  static.test.ts · sql/security_tests.sql · integration/api.test.ts
├─ loadtest/k6-read.js
├─ scripts/build_setup.sh
└─ docs/  CONTRACT.md · SECURITY.md · OPERATIONS.md
```

## Mise en route (projet Supabase hébergé)

1. **Créer deux projets** sur supabase.com : `credit-iles-test` et `credit-iles-prod` (mot de passe de base dans un gestionnaire de mots de passe).
2. **Schéma + données** : *SQL Editor* → coller **tout** `supabase/setup_complete.sql` → *Run*.
3. **Réglages Auth** (le `config.toml` ne s'applique pas tout seul à un projet hébergé ; équivalents dans le Dashboard) :
   - *Authentication → URL Configuration* : *Site URL* = `https://creditdesilesfrancaises.vercel.app` ; *Redirect URLs* : `https://creditdesilesfrancaises.vercel.app/**`, `https://creditdesilesfrancaisesadmin.vercel.app/**`, `http://localhost:3000/**`, `http://localhost:3001/**`.
   - *Authentication → Sign In / Providers → Email* : longueur minimale du mot de passe **8**, exigence **lettres + chiffres** ; confirmation d'e-mail **désactivée** pour la démonstration (le SMTP par défaut est très limité).
   - *Authentication → Multi-Factor* : TOTP activé (non imposé).
   - *Authentication → Rate Limits* : conserver les valeurs par défaut ou les resserrer.
   - Alternative en ligne de commande : `supabase link --project-ref …` puis `supabase config push` (après avoir remplacé « erere »).
4. **Compte admin** (un seul) : *Authentication → Users → Add user* (e-mail + mot de passe ≥ 14 caractères, « Auto Confirm User ») → éditer l'e-mail dans `supabase/promote_admin.sql` → *SQL Editor* → *Run*. **Ne mettez jamais ce mot de passe dans le code.**
5. **Récupérer les clés** : *Project Settings → API* : `Project URL` et clé `anon`/publishable → à donner au frontend et à l'admin (voir `docs/CONTRACT.md` §2). Jamais la clé `service_role`.
6. **Tester** (sur le projet de **test**) :
   - SQL : coller `tests/sql/security_tests.sql` → *Run* → attendre `TOUS LES TESTS SQL SONT PASSÉS` (tout est annulé à la fin).
   - API : `npm install` puis `SUPABASE_TEST_URL=… SUPABASE_TEST_ANON_KEY=… npm test`.
   - Sans base : `npm run test:static`.

## Mise en route locale (CLI Supabase, optionnel)

```bash
npm install -g supabase   # ou npx supabase
supabase start            # applique migrations + seed.sql automatiquement
supabase db reset         # repartir de zéro
```
Les e-mails de test arrivent dans Inbucket (http://localhost:54324).

## Règles métier réalisées dans la base

- **Un seul admin** (index unique) ; rôle changeable uniquement par SQL propriétaire.
- **31 motifs** verrouillés (table de référence + clé étrangère) ; précision obligatoire **uniquement** pour « Autre (à préciser) ».
- **« Autre banque »** : nom nettoyé, anti-doublon, un vote par utilisateur, modération admin (approuver → crée la banque ; fusionner ; rejeter) avec rattachement automatique des demandes.
- **Demande** : validée par `create_loan_request` (montant/limites, devise, motif, description, banque, type de carte), statut forcé `pending`, historique créé, **5 demandes/heure/utilisateur**.
- **Admin** : statut avec commentaire obligatoire (historique + audit atomiques), statistiques, réglages validés, MFA **optionnel** (`require_admin_mfa`).
- **Audit en ajout seul**, **suppression de compte** (RGPD), aucun champ carte/CVV/IBAN.

## Limites à connaître

- La limitation de débit **de la connexion et de l'inscription** est celle de Supabase Auth (par IP) ; la limitation **durable en base** protège les demandes et les suggestions. Le CAPTCHA est prêt mais désactivé par défaut (`docs/SECURITY.md` §5).
- Sans MFA, la sécurité de l'admin repose sur un mot de passe long et unique.
- Les territoires et types des 12 banques sont **indicatifs** ; l'admin peut les corriger.
- « Tenir plusieurs années » et « accueillir beaucoup d'utilisateurs » ne peuvent pas être **garantis** : voir `docs/OPERATIONS.md` (sauvegardes, supervision, mises à jour, test de charge, limites des plans).
