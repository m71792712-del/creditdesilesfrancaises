# CONTRACT.md — contrat d'interface du backend

> Projet « Crédit des îles françaises » — **données fictives uniquement**.
> Le **frontend** et l'**admin** se conforment à ce document. Toute modification du backend qui change ce contrat doit être reportée ici (version en bas).
> ⚠ Ce contrat décrit le SQL livré ; il n'a pas pu être exécuté contre une vraie base dans l'environnement de rédaction (voir README, « Ce qui est testé »).

## 1. Architecture

```
 Navigateur ──► Frontend (https://creditdesilesfrancaises.vercel.app)      ─┐
 Navigateur ──► Admin    (https://creditdesilesfrancaisesadmin.vercel.app) ─┼─► Supabase : Auth + PostgREST (tables protégées par RLS + fonctions RPC)
```

- Les deux applications utilisent **uniquement** l'URL du projet et la clé **anon/publishable**. Aucune clé `service_role`.
- Les cookies de session sont **séparés** (deux domaines `*.vercel.app` distincts) : se connecter au site ne connecte pas à l'admin.
- Toute écriture sensible passe par une **fonction RPC** (validation, limitation de débit, audit en base). Le frontend valide aussi (Zod) pour l'ergonomie, mais **la base fait foi**.

## 2. Variables d'environnement

| Variable | Frontend | Admin | Rôle |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | oui | oui | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | oui | oui | clé anon / publishable (publique, protégée par RLS) |
| `NEXT_PUBLIC_SITE_URL` | `https://creditdesilesfrancaises.vercel.app` | `https://creditdesilesfrancaisesadmin.vercel.app` | URL de **l'application elle-même** (redirections e-mail) |
| `NEXT_PUBLIC_CAPTCHA_ENABLED` | `false` par défaut | — | active Turnstile (voir SECURITY.md) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | si CAPTCHA | — | clé publique Turnstile |
| `ADMIN_REQUIRE_MFA` | — | `false` par défaut | l'admin impose l'enrôlement/la vérification MFA (en plus du réglage base `require_admin_mfa`) |

Côté Supabase (Dashboard ou `config.toml`) : `site_url` = URL du site, redirections autorisées = les **deux** domaines + localhost.
Aucune variable secrète n'est nécessaire dans les applications.

## 3. Authentification

- Inscription : `supabase.auth.signUp({ email, password, options: { data: { first_name, last_name, phone, demo_color, demo_city, demo_digit }, captchaToken? } })`.
  - `first_name`, `last_name` (≤ 60 car.), `phone` (6–20 car. : chiffres, espaces, `+ ( ) . -`), `demo_color` (≤ 30), `demo_city` (≤ 60), `demo_digit` (`"0"`–`"9"`) : **fictifs**.
  - Le **trigger** `handle_new_user` crée la ligne `profiles` avec le rôle `user` **toujours** (le rôle des métadonnées est ignoré). Il ne lève pas d'erreur : valeurs de repli si un champ manque. **Le frontend doit donc imposer les champs obligatoires.**
- Mot de passe : **8 caractères minimum, au moins une lettre et un chiffre** (appliqué par Supabase Auth ; le frontend le vérifie aussi).
- Connexion : e-mail + mot de passe (`signInWithPassword`). Pas de SMS.
- Rôle : `profiles.role` ∈ `user | admin`. **Un seul admin** (index unique). Promotion uniquement par SQL (`supabase/promote_admin.sql`).
- MFA : TOTP disponible. Imposé aux fonctions/lectures admin si `app_settings.require_admin_mfa = true` (alors le JWT doit avoir `aal = aal2`). Défaut : `false`.

## 4. Tables (RLS activée partout)

Légende accès : **L** = lecture via API, **—** = aucun accès direct (passer par les RPC).

| Table | Colonnes principales | Utilisateur | Admin |
|---|---|---|---|
| `profiles` | `id`, `first_name`, `last_name`, `phone`, `email`, `role`, `demo_color`, `demo_city`, `demo_digit`, `created_at`, `updated_at` | L sa ligne ; **U** (update) de `first_name,last_name,phone,demo_*` uniquement | L tout |
| `banks` | `id`, `slug`, `name`, `territory`, `type` (`bank`/`fintech`), `is_active`, `created_at`, `updated_at` | L tout | L, insert, update, delete (audités) |
| `bank_suggestions` | `id`, `name`, `name_key`, `submit_count`, `status` (`pending`/`approved`/`rejected`/`merged`), `resolved_bank_id`, `reviewed_by`, `reviewed_at`, `created_at` | — | L (écriture via `admin_moderate_bank_suggestion`) |
| `bank_suggestion_votes` | `suggestion_id`, `user_id` | — | — |
| `card_types` | `id`, `family`, `name`, `sort_order`, `is_active` | L | L |
| `loan_purposes` | `code`, `sort_order`, `label_fr`, `label_en`, `requires_details` | L | L |
| `loan_requests` | `id`, `user_id`, `amount`, `currency`, `purpose_code`, `purpose_details`, `description`, `bank_id`, `custom_bank_name`, `bank_suggestion_id`, `card_type_id`, `status`, `created_at`, `updated_at` | L les siennes | L toutes |
| `loan_status_history` | `id`, `loan_id`, `old_status`, `new_status`, `comment`, `changed_by`, `created_at` | L (ses demandes) | L tout |
| `audit_logs` | `id`, `actor_id`, `action`, `entity_type`, `entity_id`, `details`, `created_at` | — | L (append-only) |
| `app_settings` | `key`, `value` (jsonb) | L `loan_min_amount`, `loan_max_amount` | L tout (écriture via `admin_update_setting`) |
| `rate_limits` | — | — | — |

Règles de données importantes :
- `loan_requests` : **soit** `bank_id` **soit** `custom_bank_name` (jamais les deux, jamais aucun) ; `purpose_details` renseigné **uniquement** si `purpose_code = 'other'`.
- `status` ∈ `pending | under_review | approved | rejected`. À la création : toujours `pending`. Le « refus » affiché à l'utilisateur après l'animation est une **simulation visuelle** : il n'est pas enregistré.
- `amount` : `numeric(14,2)`, renvoyé par PostgREST comme nombre ; limites = `app_settings` (défaut 500 – 100 000).
- `currency` ∈ `EUR | USD | GBP | CAD`.

### Exemples de requêtes (PostgREST / supabase-js)

```ts
// Mes demandes (pagination par clé : created_at desc, id desc)
supabase.from('loan_requests')
  .select('id,amount,currency,purpose_code,status,created_at,banks(name,slug),loan_purposes(label_fr,label_en)')
  .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(10)
// page suivante : .or(`created_at.lt.${last.created_at},and(created_at.eq.${last.created_at},id.lt.${last.id})`)

// Admin : demandes avec filtres et demandeur
supabase.from('loan_requests')
  .select('*, profiles(first_name,last_name,email,phone), banks(name), loan_purposes(label_fr)', { count: 'estimated' })
  .eq('status', 'pending').eq('purpose_code', 'personal').order('created_at', { ascending: false }).range(0, 9)
```
Utilisez `count: 'estimated'` ou 'planned' sur les grandes listes ; `exact` seulement si nécessaire. Le serveur plafonne à 500 lignes (`max_rows`).
Recherche admin sur les utilisateurs : `.or('first_name.ilike.%x%,last_name.ilike.%x%,email.ilike.%x%')` après **échappement** de `%`, `,`, `(`, `)`, `*` côté application.

## 5. Fonctions RPC

Toutes : `supabase.rpc(nom, params)`, réservées aux utilisateurs connectés. Erreur = `error.message` contient un **code machine** (ci-dessous).

| Fonction | Paramètres | Retour | Qui |
|---|---|---|---|
| `create_loan_request` | `p_amount numeric, p_currency text, p_purpose_code text, p_purpose_details text, p_description text, p_bank_id uuid, p_custom_bank_name text, p_card_type_id uuid default null` | `uuid` (id de la demande) | utilisateur |
| `admin_update_loan_status` | `p_loan_id uuid, p_new_status text, p_comment text` (3–500 car., obligatoire) | `void` | admin |
| `admin_moderate_bank_suggestion` | `p_suggestion_id uuid, p_action text` (`approve`/`reject`/`merge`)`, p_target_bank_id uuid default null, p_territory text default '', p_type text default 'bank'` | `uuid` (banque créée / retenue, ou null si rejet) | admin |
| `admin_stats` | — | `jsonb` : `users, loans, loans_last_7_days, banks_active, pending_suggestions, by_status{…}` | admin |
| `admin_update_setting` | `p_key text, p_value jsonb` ; clés : `loan_min_amount`, `loan_max_amount`, `loans_per_hour` (1–100), `suggestions_per_day` (1–50), `require_admin_mfa` (bool) | `void` | admin |
| `delete_my_account` | — | `void` (supprime compte + profil + demandes) | utilisateur (pas l'admin) |

`create_loan_request` :
- **Banque de la liste** : `p_bank_id` renseigné, `p_custom_bank_name = null`.
- **« Autre banque »** : `p_bank_id = null`, `p_custom_bank_name = 'nom saisi'`. Le nom est nettoyé (espaces, casse). S'il correspond à une banque existante, la demande est rattachée à cette banque ; sinon une **suggestion** est créée/votée (1 vote par utilisateur, 5 nouvelles suggestions/jour/utilisateur). Texte toujours affiché **échappé** (jamais en HTML).
- Le statut est toujours `pending`. Limite : **5 demandes/heure/utilisateur** (réglable).

### Codes d'erreur

| Code (`message`) | Signification | HTTP indicatif |
|---|---|---|
| `not_authenticated` | pas de session valide | 403 |
| `forbidden` | rôle admin requis (ou MFA requis si activé) | 403 |
| `invalid_amount` | montant non numérique, ≤ 0 ou plus de 2 décimales | 400 |
| `amount_out_of_range` | hors des limites configurées | 400 |
| `invalid_currency` | devise non autorisée | 400 |
| `invalid_purpose` | code de motif inconnu | 400 |
| `purpose_details_required` | « other » sans précision (3–300 car.) | 400 |
| `purpose_details_unexpected` | précision fournie pour un motif ≠ « other » | 400 |
| `invalid_description` | description hors 20–2000 caractères ou caractères de contrôle | 400 |
| `invalid_bank` | banque inconnue/inactive, deux choix ou aucun, nom invalide | 400 |
| `invalid_card_type` | type de carte inconnu/inactif | 400 |
| `rate_limited` | quota dépassé (demandes ou suggestions) | 400 |
| `invalid_status` / `invalid_comment` / `status_unchanged` | changement de statut invalide | 400 |
| `not_found` | élément introuvable | 404 |
| `invalid_action` / `invalid_type` / `already_reviewed` / `bank_exists` | modération de suggestion | 400 |
| `invalid_setting` / `mfa_enrollment_required` | réglage invalide / MFA à activer depuis une session MFA | 400 |
| `cannot_delete_admin` | le compte admin ne peut pas être supprimé | 400 |

Le frontend traduit ces codes (FR/EN) et n'affiche **jamais** le message technique brut.

## 6. Données de référence

### Motifs du prêt (31, ordre imposé)
| N° | Code (à stocker/envoyer) | Libellé FR | Label EN |
|---|---|---|---|
| 1 | `personal` | Projet personnel | Personal project |
| 2 | `family` | Projet familial | Family project |
| 3 | `real_estate` | Projet immobilier | Real estate project |
| 4 | `professional` | Projet professionnel | Professional project |
| 5 | `entrepreneurial` | Projet entrepreneurial | Entrepreneurial project |
| 6 | `commercial` | Projet commercial | Commercial project |
| 7 | `agricultural` | Projet agricole | Agricultural project |
| 8 | `livestock` | Projet d’élevage | Livestock farming project |
| 9 | `education` | Projet d’études et de formation | Education and training project |
| 10 | `construction` | Projet de construction | Construction project |
| 11 | `renovation` | Projet de rénovation | Renovation project |
| 12 | `equipment` | Projet d’équipement | Equipment project |
| 13 | `vehicle` | Projet d’achat de véhicule | Vehicle purchase project |
| 14 | `wedding` | Projet de mariage | Wedding project |
| 15 | `health` | Projet de santé | Health project |
| 16 | `travel` | Projet de voyage | Travel project |
| 17 | `investment` | Projet d’investissement | Investment project |
| 18 | `business_creation` | Projet de création d’entreprise | Business creation project |
| 19 | `business_extension` | Projet d’extension d’entreprise | Business expansion project |
| 20 | `land` | Projet d’achat de terrain | Land purchase project |
| 21 | `home_improvement` | Projet d’aménagement de maison | Home improvement project |
| 22 | `solar` | Projet d’énergie solaire | Solar energy project |
| 23 | `transport` | Projet de transport | Transport project |
| 24 | `restaurant` | Projet de restauration | Restaurant project |
| 25 | `agri_food` | Projet de transformation agroalimentaire | Food processing project |
| 26 | `professional_equipment` | Projet d’achat de matériel professionnel | Professional equipment purchase project |
| 27 | `stock` | Projet de financement de stock | Stock financing project |
| 28 | `activity_development` | Projet de développement d’activité | Business development project |
| 29 | `family_reunification` | Projet de regroupement familial | Family reunification project |
| 30 | `debt_consolidation` | Projet de consolidation de dettes | Debt consolidation project |
| 31 | `other` | Autre (à préciser) | Other (please specify) |

La précision (`purpose_details`) n'est demandée que pour `other` (« Autre (à préciser) »).

### Types de carte (34, depuis 2_1.docx — groupement indicatif)
| Famille | Types |
|---|---|
| Nickel / NewPay | NewPay, Nickel Classic, My Nickel, Nickel Chrome, Nickel Metal |
| Visa | Visa Classic, Visa Premier, Visa Electron, Visa Platinum, Visa Infinite, Visa Gold, Visa Business, Visa Infinite Business |
| Mastercard | Mastercard Standard, Mastercard Classic, Gold Mastercard, Mastercard Platinum, Mastercard World Elite, Mastercard Business |
| Autres réseaux | Maestro, V PAY, American Express, Carte CB (Cartes Bancaires) |
| Types de cartes | Carte prépayée, Carte virtuelle, Carte à autorisation systématique, Carte professionnelle, Carte de débit, Carte de crédit, Carte de retrait, Carte rechargeable, Carte cadeau bancaire |
| Cartes régionales | Carte SOCREDO, Carte Aircalin |

### Banques (12, depuis le zip de logos)
| Slug | Nom | Territoire (indicatif) | Type | Fichier logo fourni → fichier attendu par le frontend |
|---|---|---|---|---|
| `bnp-paribas-antilles-guyane` | BNP Paribas Antilles-Guyane | Antilles-Guyane | `bank` | `BNP_Paribas_Antilles-Guyane.jpg` → `public/banks/bnp-paribas-antilles-guyane.webp` |
| `bred-banque-populaire` | BRED Banque Populaire | France et outre-mer | `bank` | `BRED_Banque_Populaire.jpg` → `public/banks/bred-banque-populaire.webp` |
| `caisse-d-epargne-cepac` | Caisse dÉpargne CEPAC | France | `bank` | `Caisse_d_Epargne_CEPAC.jpg` → `public/banks/caisse-d-epargne-cepac.webp` |
| `credit-agricole-martinique-guyane` | Crédit Agricole Martinique-Guyane | Martinique-Guyane | `bank` | `Credit_Agricole_Martinique_Guyane.jpg` → `public/banks/credit-agricole-martinique-guyane.webp` |
| `lcl` | LCL | France | `bank` | `LCL.jpg` → `public/banks/lcl.webp` |
| `credit-mutuel` | Crédit Mutuel | France | `bank` | `Credit_Mutuel.jpg` → `public/banks/credit-mutuel.webp` |
| `la-banque-postale` | La Banque Postale | France | `bank` | `La_Banque_Postale.jpg` → `public/banks/la-banque-postale.webp` |
| `deblock` | DEBLOCK | Non précisé | `fintech` | `DEBLOCK.jpg` → `public/banks/deblock.webp` |
| `banque-de-tahiti` | Banque de Tahiti | Polynésie française | `bank` | `Banque_de_Tahiti.jpg` → `public/banks/banque-de-tahiti.webp` |
| `banque-de-polynesie` | Banque de Polynésie | Polynésie française | `bank` | `Banque_de_Polynesie.jpg` → `public/banks/banque-de-polynesie.webp` |
| `niupay` | NiuPay | Non précisé | `fintech` | `NiuPay.jpg` → `public/banks/niupay.webp` |
| `socredo` | SOCREDO | Polynésie française | `bank` | `SOCREDO.jpg` → `public/banks/socredo.webp` |

Convertir chaque JPG en WebP optimisé (≤ 240 px de large) nommé `public/banks/<slug>.webp` ; initiales si le fichier manque. Les territoires/types sont **indicatifs** et modifiables par l'admin.

## 7. Versionnage

| Version | Date | Changement |
|---|---|---|
| 1.0.0 | 2026-10-21 | Contrat initial (4 migrations + seed). |
