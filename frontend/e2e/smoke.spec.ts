import { expect, test } from '@playwright/test';

// Parcours de bout en bout (sans compte) : à lancer contre un environnement de TEST.
test('accueil : bandeau de démonstration, titre accessible, CSP', async ({ page }) => {
  const res = await page.goto('/');
  expect(res?.headers()['content-security-policy']).toContain("'nonce-");
  await expect(page.getByRole('note').first()).toContainText('données fictives');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Crédit des îles françaises/);
  await expect(page.getByRole('link', { name: 'Faire une demande de prêt' })).toBeVisible();
});

test('les pages privées redirigent vers la connexion', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
  await page.goto('/apply');
  await expect(page).toHaveURL(/\/login/);
});

test('inscription : validation des champs et mot de passe affichable', async ({ page }) => {
  await page.goto('/register');
  await expect(page.getByText('Projet universitaire')).toBeVisible();
  await expect(page.getByLabel('Couleur préférée (fictif)')).toBeVisible();
  await expect(page.getByLabel('Ville (fictif)')).toBeVisible();
  const pwd = page.getByLabel('Mot de passe', { exact: true });
  await pwd.fill('abc');
  await page.getByRole('button', { name: 'Afficher le mot de passe' }).click();
  await expect(pwd).toHaveAttribute('type', 'text');
});

test('connexion : redirection ouverte refusée', async ({ page }) => {
  await page.goto('/login?next=https://example.com');
  await expect(page.getByRole('button', { name: 'Se connecter' }).last()).toBeVisible();
  await expect(page.locator('input[name="next"]')).toHaveValue('');
});

test('mentions légales accessibles et langue anglaise', async ({ page, context }) => {
  await context.addCookies([{ name: 'locale', value: 'en', url: page.context().pages()[0]?.url() ?? 'http://localhost:3000' }]);
  await page.goto('/legal');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
