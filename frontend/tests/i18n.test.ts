import { describe, expect, it } from 'vitest';
import { BACKEND_ERROR_CODES } from '@/lib/errors';
import { createT, dictionaries, pickLocaleFromHeader } from '@/lib/i18n/shared';

describe('internationalisation', () => {
  it('fr et en ont exactement les mêmes clés', () => {
    expect(Object.keys(dictionaries.en).sort()).toEqual(Object.keys(dictionaries.fr).sort());
  });
  it('contient l’avertissement de démonstration exact (FR) et la marque corrigée', () => {
    expect(dictionaries.fr['demo.warning']).toBe('Projet universitaire — utilisez uniquement des données fictives. Aucune décision de financement réelle n’est prise.');
    expect(dictionaries.fr['brand.name']).toBe('Crédit des îles françaises');
    expect(dictionaries.en['brand.name']).toBe('Crédit des îles françaises');
  });
  it('traduit tous les codes d’erreur du backend dans les deux langues', () => {
    for (const code of BACKEND_ERROR_CODES) {
      expect(dictionaries.fr[`err.${code}`], code).toBeTruthy();
      expect(dictionaries.en[`err.${code}`], code).toBeTruthy();
    }
  });
  it('étiquette comme fictifs les champs de démonstration', () => {
    for (const k of ['auth.demoColor', 'auth.demoCity', 'apply.demo.color', 'apply.demo.year', 'apply.demo.digit']) {
      expect(dictionaries.fr[k]).toContain('(fictif)');
      expect(dictionaries.en[k]).toContain('(fictional)');
    }
  });
  it('détecte la langue du navigateur', () => {
    expect(pickLocaleFromHeader('fr-FR,fr;q=0.9,en;q=0.8')).toBe('fr');
    expect(pickLocaleFromHeader('en-US,en;q=0.9')).toBe('en');
    expect(pickLocaleFromHeader('de-DE,de;q=0.9,en;q=0.5')).toBe('en');
    expect(pickLocaleFromHeader('ja-JP')).toBe('fr');
    expect(pickLocaleFromHeader(null)).toBe('fr');
  });
  it('interpole les paramètres', () => {
    expect(createT('fr')('common.page', { page: 2, total: 5 })).toBe('Page 2 sur 5');
    expect(createT('en')('apply.stepOf', { current: 3, total: 5 })).toBe('Step 3/5');
  });
});
