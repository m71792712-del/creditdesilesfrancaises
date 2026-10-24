# Crédit des îles françaises — Administration

> Projet universitaire — **données fictives uniquement**.

Application Next.js séparée du site public, branchée sur le **même projet Supabase**. **Un seul compte admin** (garanti par la base : index unique + rôle modifiable uniquement par SQL).

## Fonctionnalités
- Connexion e-mail + mot de passe ; **tout compte non-admin est refusé et déconnecté** (message identique, pas d'énumération).
- Tableau de bord (`admin_stats`), demandes de prêt (filtres statut/motif, pagination), détail + **changement de statut avec commentaire obligatoire** (historique + audit faits par la base).
- Modération des suggestions « Autre banque » (approuver / fusionner / rejeter).
- **Fiche utilisateur** : un clic sur un nom (liste des utilisateurs) ouvre toutes les informations saisies à l'inscription (nom, e-mail, téléphone, données de démonstration fictives) et la liste de ses demandes. Le détail d'une demande affiche aussi le profil complet du demandeur.
- Gestion des banques (ajout, activation/désactivation), liste des utilisateurs (recherche), journal d'audit, réglages (limites de montant, quotas).

## Sécurité
- Chaque page **et** chaque action serveur revérifie le rôle admin (`requireAdmin`) ; le middleware n'est qu'une première barrière.
- La base fait foi : RLS + fonctions RPC (`admin_*`). Clé **anon** uniquement, jamais `service_role`.
- CSP avec nonce, `X-Frame-Options: DENY`, `noindex`, cookies httpOnly, `Cache-Control: no-store`.

## Déploiement sur Vercel
1. Importer ce dossier comme **nouveau projet Vercel** (framework : Next.js ; ne rien changer au build).
2. Variables d'environnement (mêmes valeurs Supabase que le frontend) :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` = l'URL Vercel de l'admin
3. Supabase → *Authentication → URL Configuration* : ajouter l'URL de l'admin dans *Redirect URLs* (`https://VOTRE-ADMIN.vercel.app/**`).
4. Créer le compte admin : *Authentication → Users → Add user* (mot de passe long, « Auto Confirm User »), puis exécuter `backend/supabase/promote_admin.sql` avec cet e-mail dans le *SQL Editor*.

## En local
```bash
cp .env.example .env.local   # renseigner les 2 clés Supabase
npm install
npm run dev                  # http://localhost:3001
```

## Limites connues
- Non testée contre une vraie base Supabase dans l'environnement de rédaction (compilée, typée et démarrée, mais sans connexion réelle).
- Pas d'écran d'enrôlement MFA : laissez `require_admin_mfa` à `false` (sinon l'admin serait bloqué).
