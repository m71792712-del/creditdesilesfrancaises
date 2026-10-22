import { defineConfig } from '@playwright/test';

// Parcours de bout en bout : à lancer contre un déploiement de TEST (npm run dev + projet Supabase de test, ou URL Preview).
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: { baseURL: process.env.BASE_URL ?? 'http://localhost:3000', trace: 'on-first-retry' },
  projects: [{ name: 'desktop', use: { viewport: { width: 1280, height: 800 } } }, { name: 'mobile', use: { viewport: { width: 390, height: 844 } } }],
});
