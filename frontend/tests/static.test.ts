import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dictionaries } from '@/lib/i18n/shared';

// Tests statiques (sans navigateur ni base) : sécurité du code, traductions et ressources.
const root = new URL('..', import.meta.url).pathname;
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const srcFiles = walk(join(root, 'src')).filter((f) => /\.(ts|tsx)$/.test(f));
const source = srcFiles.map((f) => [f, readFileSync(f, 'utf8')] as const);

describe('sécurité du code', () => {
  it('n’injecte jamais de HTML brut', () => {
    for (const [f, s] of source) expect(s, f).not.toMatch(/dangerouslySetInnerHTML|innerHTML\s*=/);
  });
  it('n’utilise aucune clé service_role ni secret en dur', () => {
    for (const [f, s] of source) {
      expect(s, f).not.toMatch(/service_role/i);
      expect(s, f).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}\./); // jeton JWT en dur
    }
  });
  it('ne stocke aucun jeton dans le navigateur', () => {
    for (const [f, s] of source) expect(s, f).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
  });
  it('vérifie l’utilisateur avec getUser (jamais getSession) côté serveur', () => {
    for (const [f, s] of source) expect(s, f).not.toMatch(/auth\.getSession\(/);
  });
  it('n’affiche aucun champ de carte bancaire', () => {
    // Les dictionnaires affirment justement qu'aucune carte n'est demandée : on les exclut de ce contrôle.
    for (const [f, s] of source.filter(([f]) => !f.includes('dictionaries'))) expect(s, f).not.toMatch(/\bcvv\b|card[_ -]?number|numéro de carte|\biban\b/i);
  });
  it('les redirections ?next passent par safeNext', () => {
    const login = readFileSync(join(root, 'src/lib/actions/auth.ts'), 'utf8');
    expect(login).toContain("safeNext(formString(formData, 'next'))");
  });
});

describe('traductions', () => {
  it('toutes les clés utilisées littéralement dans le code existent', () => {
    const used = new Set<string>();
    for (const [, s] of source) for (const m of s.matchAll(/\bt\(\s*'([a-z0-9_.]+)'/g)) used.add(m[1]);
    for (const k of used) expect(dictionaries.fr[k], `clé manquante : ${k}`).toBeTruthy();
    expect(used.size).toBeGreaterThan(80);
  });
  it('les clés dynamiques (home, status, apply.s/t, err) existent', () => {
    for (const n of [1, 2, 3, 4]) for (const p of ['how', 'faq']) expect(dictionaries.fr[`${p}.${n}.${p === 'how' ? 'title' : 'q'}`]).toBeTruthy();
    for (const s of ['fast', 'secure', 'accessible', 'support']) expect(dictionaries.fr[`benefit.${s}.title`]).toBeTruthy();
    for (const s of ['pending', 'under_review', 'approved', 'rejected']) expect(dictionaries.fr[`status.${s}`]).toBeTruthy();
    for (let i = 1; i <= 5; i++) { expect(dictionaries.fr[`apply.s${i}`]).toBeTruthy(); expect(dictionaries.fr[`apply.t${i}`]).toBeTruthy(); }
    for (let i = 1; i <= 5; i++) expect(dictionaries.fr[`legal.p${i}`]).toBeTruthy();
  });
});

describe('ressources', () => {
  const slugs = ['bnp-paribas-antilles-guyane', 'bred-banque-populaire', 'caisse-d-epargne-cepac', 'credit-agricole-martinique-guyane', 'lcl', 'credit-mutuel', 'la-banque-postale', 'deblock', 'banque-de-tahiti', 'banque-de-polynesie', 'niupay', 'socredo'];
  it('les 12 logos WebP existent et pèsent moins de 10 Ko', () => {
    for (const s of slugs) {
      const p = join(root, 'public/banks', `${s}.webp`);
      expect(existsSync(p), s).toBe(true);
      expect(statSync(p).size, s).toBeLessThan(10 * 1024);
    }
  });
  it('les images du site existent', () => {
    for (const f of ['hero-1536.webp', 'panel.webp', 'logo-icon.png']) expect(existsSync(join(root, 'public/images', f)), f).toBe(true);
    expect(existsSync(join(root, 'src/app/icon.png'))).toBe(true);
  });
  it('le nom du projet est « Crédit des îles françaises » partout', () => {
    for (const [f, s] of source) expect(s, f).not.toMatch(/Financer Guadeloupe/i);
  });
});
