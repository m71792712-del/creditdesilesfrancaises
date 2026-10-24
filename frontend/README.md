# Crédit des îles françaises — frontend.zip

> **Projet universitaire — utilisez uniquement des données fictives. Aucune décision de financement réelle n'est prise.**

Application Next.js 15 (App Router, TypeScript strict, Tailwind) : site public + espace utilisateur, déployée sur `https://erere.vercel.app` (remplacez « erere » par le vrai nom de votre projet Vercel). Elle se branche sur le **backend Supabase** déjà livré (`backend.zip`, voir son `docs/CONTRACT.md`). L'admin est une application **séparée** (`admin.zip`).

## Ce qui est testé, ce qui ne l'est pas (lisez ceci d'abord)

| | État |
|---|---|
| Syntaxe de tous les fichiers TypeScript/TSX | vérifiée |
| Imports `@/…` tous résolus ; aucun hook dans un composant serveur | vérifié |
| Tests purs exécutés ici : animation (3), i18n (6), erreurs backend (3), CSP (4), tests statiques (11) | **27/27 réussis** |
| Tests de validation Zod (`tests/validations.test.ts`) | écrits, **non exécutés** (zod absent de l'environnement de rédaction) |
| `npm install`, `npm run typecheck`, `npm run build`, `npm run dev` | **jamais exécutés** (pas d'accès Internet) |
| Parcours Playwright (`e2e/`), Lighthouse (≥ 90), LCP < 2,5 s | écrits / visés, **non mesurés** |
| Connexion réelle à Supabase (inscription, demande, historique) | **non testée** : à faire sur votre projet de test |

Conséquence : **lancez d'abord `npm install`, `npm run typecheck`, `npm test` puis `npm run dev`** sur votre machine (ou GitHub Codespaces). Si une erreur apparaît, envoyez-moi le message exact : je corrige.

## Installation locale

```bash
npm install
cp .env.example .env.local     # renseignez les variables (voir ci-dessous)
npm run dev                    # http://localhost:3000
npm run typecheck && npm test
```

## Variables d'environnement

| Variable | Valeur | Remarque |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase | Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clé **anon / publishable** | publique par conception, protégée par la RLS. **Jamais** la clé `service_role` |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` / `https://erere.vercel.app` | utilisée pour les liens des e-mails |
| `NEXT_PUBLIC_CAPTCHA_ENABLED` | `false` (défaut) | `true` active Turnstile |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | clé publique Turnstile | seulement si CAPTCHA |

## Branchement sur Supabase

1. Appliquez le backend (`backend.zip`) : `supabase/setup_complete.sql` dans le SQL Editor d'un projet de **test**, puis lancez `tests/sql/security_tests.sql`.
2. Authentication → URL Configuration : *Site URL* = `https://erere.vercel.app` ; *Redirect URLs* : `https://erere.vercel.app/**`, `https://erereadmin.vercel.app/**`, `http://localhost:3000/**`.
3. Mot de passe : 8 caractères min., lettres + chiffres ; confirmation d'e-mail désactivée pour la démo (sinon configurez un SMTP).
4. Copiez l'URL et la clé `anon` dans `.env.local`.

## GitHub

```bash
git init && git add . && git commit -m "Frontend : Crédit des îles françaises"
git branch -M main
git remote add origin https://github.com/VOTRE_COMPTE/credit-iles-frontend.git
git push -u origin main
```
Vérifiez avec `git status` que `.env.local` n'est **pas** listé. La CI (`.github/workflows/ci.yml`) lance typecheck, tests, `npm audit --audit-level=high` et build.

## Déploiement Vercel

1. vercel.com → **Add New → Project** → importez le dépôt. Nom du projet : **le nom qui donnera votre domaine** (ex. `erere` → `erere.vercel.app`). S'il est pris, Vercel ajoute un suffixe : utilisez alors l'adresse réellement attribuée partout.
2. **Environment Variables** : les 3 premières variables du tableau (+ CAPTCHA si besoin), pour *Production* et *Preview*. Utilisez les clés du projet Supabase de **production** pour Production et celles du projet de **test** pour Preview.
3. **Deploy**, puis vérifiez que `NEXT_PUBLIC_SITE_URL` = l'URL finale (redéployez sinon) et que cette URL est dans les *Redirect URLs* de Supabase.

## Activer le CAPTCHA (Turnstile)

1. Cloudflare → Turnstile → nouveau widget (hostnames : votre domaine Vercel et `localhost`).
2. Supabase → Authentication → Attack Protection : activer le CAPTCHA (Turnstile) avec la clé **secrète**.
3. Vercel : `NEXT_PUBLIC_CAPTCHA_ENABLED=true` et `NEXT_PUBLIC_TURNSTILE_SITE_KEY=…`, puis redéployer.
⚠ Activez Supabase **et** le frontend ensemble : sans jeton, les appels d'authentification sont refusés une fois le CAPTCHA activé côté Supabase.

## Images, logos et photos

| Fichier | Origine | Détails |
|---|---|---|
| `public/banks/<slug>.webp` (12) | vos 12 JPG | marges rognées, ≤ 240 px, 1 à 4 Ko chacun ; affichés sur badge blanc, texte alternatif = nom de la banque ; **initiales** si le fichier manque (ex. banque ajoutée par l'admin) |
| `public/images/hero-1536.webp` | votre photo d'accueil | la photo fait **1536 px de large** : pas de version 1920 px possible sans l'agrandir (flou). `next/image` génère automatiquement AVIF/WebP aux bonnes tailles |
| `public/images/panel.webp` | **provisoire** : découpe de la photo d'accueil (zone sans texte) | à remplacer par votre photo d'interface (voir ci-dessous) |
| `public/images/logo-icon.png`, `src/app/icon.png` | icône extraite de la photo d'accueil | **91 px natifs** : net jusqu'à ~90 px (barre de navigation, pied de page), flou au-delà. Remplacez-le par le logo seul (PNG transparent ou SVG) quand vous l'aurez |

Ajouter/remplacer une image :
```bash
npm run images -- photo ~/Downloads/interface.jpg panel 800        # -> public/images/panel.webp + .avif
npm run images -- logo  ~/Downloads/nouvelle-banque.png mon-slug   # -> public/banks/mon-slug.webp
```
Le slug d'un logo = le champ `slug` de la banque (voir le tableau du `CONTRACT.md` du backend).

## Sécurité

- **CSP avec nonce** générée à chaque requête par `src/middleware.ts` (`strict-dynamic`, pas d'`unsafe-eval` en production, `connect-src` limité à l'origine Supabase, `frame-ancestors 'none'`) + HSTS, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` (`next.config.mjs`).
- **Rendu dynamique volontaire** : la langue (cookie / navigateur) et le nonce rendent toutes les pages dynamiques, **y compris l'accueil** (pas de statique). Le coût reste faible : l'accueil n'interroge pas la base et le middleware n'appelle Supabase que si un cookie de session existe.
- Cookies de session **httpOnly** (`@supabase/ssr`), aucun jeton dans le navigateur ; `getUser()` (vérifié par le serveur Auth) à chaque page et action, jamais `getSession()`.
- Toutes les requêtes Supabase partent du **serveur** avec la clé anon ; la RLS s'applique. Aucune clé `service_role`.
- Validation Zod côté client **et** serveur, puis validation en base (`create_loan_request`) ; messages d'erreur du backend traduits, jamais affichés bruts.
- Redirections `?next=` filtrées (`safeNext`) ; aucun `dangerouslySetInnerHTML` (test statique) ; textes saisis toujours échappés par React.
- Dépendances **épinglées** (versions exactes) + `npm audit` en CI.
- Pas de limiteur maison sur la connexion/inscription : les limites sont celles de Supabase Auth (par IP) et le CAPTCHA optionnel.

## Tests

| Commande | Contenu |
|---|---|
| `npm test` | animation 1 → 81 → 94 % (~8 s) · parité FR/EN et codes d'erreur traduits · CSP · validations Zod · tests statiques (pas de HTML injecté, pas de secret, pas de stockage navigateur, clés de traduction existantes, logos présents) |
| `npm run e2e` | Playwright : bandeau et CSP, redirections des pages privées, formulaire d'inscription, redirection ouverte refusée (nécessite un serveur lancé) |

## Écarts avec la maquette (à signaler à votre encadreur)

- Bandeau « données fictives » ajouté sur **toutes** les pages ; pied de page : « Banques affichées à titre d'exemple — aucun partenariat » (au lieu de « partenaires en Guadeloupe »).
- Avantage « Accompagnement / une équipe à votre écoute » remplacé par « Suivi clair » (aucune équipe n'existe).
- « Se souvenir de moi » supprimé (la session Supabase est déjà persistante) ; ajout d'un champ **e-mail** à l'inscription et d'un bouton afficher/masquer le mot de passe.
- Hero : la photo contient déjà le logo et le slogan → titre en `sr-only`, sous-titre et bouton sur un cartouche en bas à gauche.
- Les champs couleur / ville / chiffre « préférés » sont enregistrés dans le **profil** (`demo_*`), pas dans la demande ; étiquetés « fictif ».
- Statuts : « En attente » (pending) distinct de « En cours d'examen » ; le tableau de bord regroupe les deux dans « En cours ».
- Ajout de pages : mot de passe oublié / réinitialisation, mentions légales (`/legal`), suppression du compte (profil).
- Mot de passe : 8 caractères (maquette) avec lettre + chiffre.

## Ce que le backend ne fournit pas (rien de bloquant)

- Pas de fonction de statistiques côté utilisateur : le tableau de bord fait 4 requêtes `count` (suffisant ; un RPC `get_my_stats` serait plus économique à grande échelle).
- La limitation de débit de la connexion/inscription repose sur Supabase Auth (par IP) : des personnes partageant la même IP partagent le quota.
- Le trigger d'inscription ne bloque pas un profil incomplet (valeurs de repli) : c'est ce frontend qui impose les champs obligatoires.

## Limites

« Lighthouse ≥ 90 », « LCP < 2,5 s » et « accueillir beaucoup d'utilisateurs » sont des **objectifs non mesurés ici**. Mesurez avec Lighthouse sur le déploiement Vercel, et testez la charge côté Supabase avec `loadtest/k6-read.js` du backend. La photo d'accueil (≈ 290 Ko) est la ressource la plus lourde : `priority` + AVIF/WebP automatiques ; surveillez le LCP.
