// Regressão visual no Chromium. As capturas de referência ficam em test/e2e/__capturas__/;
// na primeira execução elas são criadas (artefato do CI) e depois passam a ser comparadas.
import { test, expect } from '@playwright/test';
import { MODOS, abrirApp, carregarPlanilha, esperarEstrutura } from './apoio.mjs';

test.beforeEach(({ browserName }) => {
  test.skip(browserName !== 'chromium', 'capturas só no Chromium');
});

const opcoes = (page) => ({
  fullPage: true,
  maxDiffPixelRatio: 0.01,
  mask: [page.locator('.rodape-versao'), page.locator('.toasts')]
});

test('tela inicial', { tag: '@visual' }, async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await abrirApp(page, MODOS[0].url);
  await expect(page).toHaveScreenshot('inicio.png', opcoes(page));
});

test('planilha carregada', { tag: '@visual' }, async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await abrirApp(page, MODOS[0].url);
  await carregarPlanilha(page, 'fretes_exemplo.xlsx');
  await esperarEstrutura(page);
  await expect(page).toHaveScreenshot('planilha-carregada.png', opcoes(page));
});

test('celular: tela inicial sem rolagem lateral', { tag: '@visual' }, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await abrirApp(page, MODOS[0].url);
  const larguras = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(larguras[0]).toBeLessThanOrEqual(larguras[1]);
  await expect(page).toHaveScreenshot('celular-inicio.png', opcoes(page));
});
