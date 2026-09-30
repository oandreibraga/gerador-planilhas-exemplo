// Acessibilidade (WCAG 2.1 A/AA) com axe, no Chromium. Falha com problemas graves ou críticos.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { MODOS, abrirApp, carregarPlanilha, esperarEstrutura } from './apoio.mjs';

// O axe é injetado pelo próprio Playwright; a CSP da página não é o que se testa aqui.
test.use({ bypassCSP: true });

async function problemasGraves(page) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return r.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => v.id + ' (' + v.impact + '): ' + v.help + ' → ' + v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | '));
}

test.beforeEach(({ browserName }) => {
  test.skip(browserName !== 'chromium', 'axe roda só no Chromium');
});

test('tela inicial sem problemas graves de acessibilidade', async ({ page }) => {
  await abrirApp(page, MODOS[0].url);
  expect(await problemasGraves(page)).toEqual([]);
});

test('tela com a planilha carregada sem problemas graves de acessibilidade', async ({ page }) => {
  await abrirApp(page, MODOS[0].url);
  await carregarPlanilha(page, 'vendas_exemplo.xlsx');
  await esperarEstrutura(page);
  expect(await problemasGraves(page)).toEqual([]);
});

test('dá para chegar ao botão de escolher planilha só com o teclado', async ({ page }) => {
  await abrirApp(page, MODOS[0].url);
  let achou = false;
  for (let i = 0; i < 15 && !achou; i++) {
    await page.keyboard.press('Tab');
    achou = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('aria-label') === 'Escolher planilha');
  }
  expect(achou).toBe(true);
});
