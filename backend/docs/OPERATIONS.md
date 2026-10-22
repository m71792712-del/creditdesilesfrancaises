# OPERATIONS.md — exploitation sur la durée

> Objectif : que la plateforme reste **maintenable, sauvegardée et surveillée** sur plusieurs années. Une démonstration ne garantit pas un service réel : les limites des plans gratuits (veille des projets inactifs, ressources, e-mails) changent — **vérifiez les conditions actuelles sur supabase.com/pricing et vercel.com/pricing**.

## 1. Environnements

| Environnement | Supabase | Vercel | Usage |
|---|---|---|---|
| Développement | `supabase start` (local) ou projet `-dev` | `localhost` | développer, tester les migrations |
| Test | projet `credit-iles-test` | déploiements *Preview* | tests SQL/API/charge (données fictives) |
| Production | projet `credit-iles-prod` | domaines `erere` et `erereadmin` | présentation / usage réel |

Chaque projet Supabase a **ses propres clés** ; ne jamais réutiliser la clé de production dans un autre environnement.

## 2. Migrations (versionnées)

- Un changement de base = **un nouveau fichier** `supabase/migrations/AAAAMMJJHHMMSS_description.sql`. **Ne jamais modifier une migration déjà appliquée.**
- Flux : écrire la migration → l'appliquer en local/test → lancer `npm run test:static` et `tests/sql/security_tests.sql` → régénérer `setup_complete.sql` (`npm run build:setup`) → appliquer en production (`supabase db push`, ou SQL Editor) → mettre à jour `CONTRACT.md` si l'interface change.
- Les données de référence (`seed.sql`) sont **idempotentes** : relançables sans risque.
- Avant toute migration en production : **sauvegarde** (§3).

## 3. Sauvegardes et restauration

- Sauvegardes gérées : selon le plan Supabase (à vérifier ; en général payantes pour la restauration à un instant donné). **Ne comptez pas dessus sur un plan gratuit.**
- Sauvegarde manuelle (à planifier chaque semaine, stockée **hors** Supabase, chiffrée) :
  ```bash
  # URI de connexion : Supabase > Project Settings > Database > Connection string (mot de passe de la base)
  pg_dump "$DATABASE_URL" --no-owner --no-privileges --schema=public --format=custom -f backup-$(date +%F).dump
  ```
  Le schéma `auth` (comptes) se sauvegarde aussi : `--schema=auth` (sinon les utilisateurs sont perdus).
- **Restauration** (testez-la au moins une fois, sur un projet vide) :
  1. créer un projet vide et appliquer `setup_complete.sql` ;
  2. `pg_restore --data-only --disable-triggers -d "$DATABASE_URL_NEW" backup.dump` ;
  3. vérifier : nombre d'utilisateurs, demandes, un seul admin ; relancer `tests/sql/security_tests.sql`.
- Conservez les migrations dans Git : elles reconstruisent le **schéma** ; seules les sauvegardes restaurent les **données**.

## 4. Supervision

| Quoi | Où | Seuil / action |
|---|---|---|
| Disponibilité | un moniteur externe gratuit (UptimeRobot, Better Stack…) sur la page d'accueil et sur `…/auth/v1/health` | alerte e-mail si indisponible > 2 min |
| Erreurs API et Auth | Supabase → *Logs* (API, Auth, Postgres) | pics de 4xx/5xx, échecs de connexion répétés |
| Charge base | Supabase → *Reports* (CPU, mémoire, connexions, E/S) | CPU > 70 % durable ou connexions proches du plafond → optimiser/monter de taille |
| Erreurs front/admin | Vercel → *Observability / Logs* | erreurs 5xx, fonctions lentes |
| Activité sensible | `select * from audit_logs order by created_at desc limit 50;` | changements de statut, de rôle, de réglages inattendus |
| Quotas e-mail | Supabase → *Auth* | e-mails refusés → configurer un SMTP dédié |

Alertes : activez les notifications e-mail Supabase/Vercel de votre compte.

## 5. Rotation des secrets

| Secret | Quand | Comment |
|---|---|---|
| Mot de passe de la base | tous les 12 mois, ou en cas de fuite | Dashboard → Database → Reset password ; mettre à jour les tâches de sauvegarde |
| Clés API (anon/publishable) | en cas de fuite d'un secret, ou tous les 12 mois | régénérer dans Dashboard → API ; mettre à jour les variables Vercel (les deux projets) et redéployer ; les clés anon sont publiques par conception : la sécurité vient de la RLS |
| Secret Turnstile | tous les 12 mois | régénérer chez Cloudflare, mettre à jour Supabase |
| Mot de passe admin | tous les 6 mois, ou si doute | via le tableau de bord Supabase ; MFA recommandé |

Ne jamais mettre un secret dans Git (`.gitignore` protège `.env*`). En cas de secret commité par erreur : le **révoquer immédiatement** (réécrire l'historique ne suffit pas).

## 6. Dépendances et mises à jour

- Activer **Dependabot** (ou Renovate) sur les dépôts GitHub ; `npm audit` dans la CI.
- Rythme : correctifs de sécurité sous 7 jours ; mises à jour mineures chaque mois ; majeures planifiées avec tests.
- Versions épinglées (`package-lock.json` commité). Suivre les annonces de Supabase (CLI, Auth, PostgreSQL) et de Next.js.

## 7. Performances et capacité

- **Index** : chaque filtre/tri de l'application a son index (voir migration 1) : `loan_requests (user_id, created_at desc, id desc)`, `(status, created_at desc)`, `(purpose_code, created_at desc)`, `(created_at desc, id desc)` ; recherche utilisateurs par index trigram ; banques par `(is_active, name)`.
- **Pagination par clé** (`created_at, id`) pour les longues listes ; `max_rows = 500` ; `count: 'estimated'` sur les grandes tables.
- **Connexions** : l'API REST passe par un pooler ; si vous ajoutez des connexions directes, utilisez le pooler de Supabase.
- Vérifier un plan d'exécution :
  ```sql
  explain (analyze, buffers)
  select id, amount, status, created_at from public.loan_requests
   order by created_at desc, id desc limit 10;
  ```
- Index inutilisés / taille des tables :
  ```sql
  select relname, indexrelname, idx_scan from pg_stat_user_indexes where schemaname = 'public' order by idx_scan;
  select relname, pg_size_pretty(pg_total_relation_size(relid)) from pg_catalog.pg_statio_user_tables order by pg_total_relation_size(relid) desc;
  ```
- **Test de charge** : `loadtest/k6-read.js` (lecture, compte de test, projet de **test**). Paliers 20 → 100 → 200 utilisateurs virtuels ; seuils : erreurs < 1 %, p95 < 800 ms. Ces seuils sont des **objectifs à mesurer**, pas des garanties. Pendant le test, surveiller CPU/connexions (§4).
- **Capacité réelle** : elle dépend de la taille de calcul du projet, du plan et du nombre d'utilisateurs. Si le test montre un goulot : augmenter la taille de calcul, ajouter un index, mettre en cache les listes de référence (banques, motifs : elles changent rarement) côté frontend.

## 8. Rétention des données

- `rate_limits` : purge automatique opportuniste ; purge planifiée optionnelle (extension `pg_cron` à activer dans le Dashboard) :
  ```sql
  select cron.schedule('purge-rate-limits', '17 3 * * *', $$delete from public.rate_limits where window_start < now() - interval '2 days'$$);
  ```
- `audit_logs` : **ajout seul**. Pour archiver d'anciennes lignes, le propriétaire peut suspendre temporairement la protection, archiver, puis la rétablir :
  ```sql
  alter table public.audit_logs disable trigger audit_logs_no_change;
  -- 1) exporter les lignes à archiver  2) delete from public.audit_logs where created_at < now() - interval '3 years';
  alter table public.audit_logs enable trigger audit_logs_no_change;
  ```
  À faire exceptionnellement et à consigner par écrit.
- Utilisateurs : suppression sur demande via `delete_my_account()` ; durée de conservation à fixer et à publier (démonstration : données fictives, à purger après la présentation).

## 9. Procédures d'incident

**Accès admin perdu** : SQL Editor → `promote_admin.sql` (rétrograder l'ancien compte, promouvoir le nouveau) ; si le MFA bloque : `update public.app_settings set value = 'false'::jsonb where key = 'require_admin_mfa';`.

**Compromission suspectée** : (1) changer le mot de passe admin et déconnecter les sessions (Dashboard → Auth → Users) ; (2) régénérer les clés (§5) ; (3) lire `audit_logs` et les journaux Auth ; (4) activer CAPTCHA + MFA admin ; (5) restaurer une sauvegarde saine si des données sont altérées.

**Pic d'inscriptions abusives** : activer le CAPTCHA, baisser `sign_in_sign_ups`, bloquer l'IP chez Vercel (Firewall) si disponible.

**Base indisponible / projet suspendu** (plans gratuits) : restaurer le projet depuis le Dashboard ; sinon recréer depuis `setup_complete.sql` + dernière sauvegarde (§3).

## 10. Check-list avant la présentation

- [ ] Sauvegarde manuelle faite ; restauration déjà testée au moins une fois
- [ ] `security_tests.sql` passe sur le projet de test
- [ ] `select count(*) from profiles where role='admin'` = 1
- [ ] Redirections Auth = les deux domaines réels (plus d'« erere » fictif)
- [ ] Le projet Supabase n'est pas en veille ; moniteur de disponibilité actif
