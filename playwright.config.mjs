// Testes em navegadores de verdade (Chromium, Firefox e WebKit). Rodam SÓ no CI (GitHub Actions):
// nas máquinas da empresa não se abre navegador controlado por programa.
// Antes: node scripts/build.mjs && node scripts/gerar-fixtures.mjs
import { defineConfig, devices } from '@playwright/test';

if (!process.env.CI) {
  throw new Error('Os testes de navegador (Playwright) rodam só no CI. Localmente use: node scripts/verificar.mjs ' +
    'e abra dist/testes.html no navegador.');
}

export default defineConfig({
  testDir: 'test/e2e',
  outputDir: 'test-results',
  snapshotPathTemplate: '{testDir}/__capturas__/{projectName}/{arg}{ext}',
  // Primeira execução grava as capturas de referência (vão como artefato do CI para serem conferidas e versionadas).
  updateSnapshots: 'missing',
  fullyParallel: true,
  forbidOnly: true,
  retries: 1,
  timeout: 120000,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  globalSetup: './test/e2e/preparar.mjs',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    acceptDownloads: true,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo'
  },
  webServer: {
    command: 'node test/e2e/servidor.mjs',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: false,
    timeout: 30000
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } }
  ]
});
