// Prova, em Chromium, Firefox e WebKit, pelo site e pelo arquivo offline, que o app:
// não faz nenhuma requisição, não viola a própria CSP, funciona sem internet e não vaza os canários.
import { test, expect } from '@playwright/test';
import {
  MODOS, vigiarRede, registrarViolacoes, violacoes, abrirApp, carregarPlanilha, esperarEstrutura, baixarAmostra, vazamentos
} from './apoio.mjs';

for (const modo of MODOS) {
  test.describe('pelo ' + modo.nome, () => {
    test('fluxo completo sem nenhuma requisição e sem vazamento', async ({ page, context }, info) => {
      const rede = await vigiarRede(context, modo.url);
      await registrarViolacoes(context);
      await abrirApp(page, modo.url);
      await carregarPlanilha(page, 'vendas_exemplo.xlsx');
      await esperarEstrutura(page);
      if (modo.nome === 'site') {
        // No site, a leitura tem que acontecer no Worker (a tela não trava com arquivo grande)
        await expect(page.locator('#app')).toHaveAttribute('data-leitura', 'trabalhador');
      } else {
        info.annotations.push({ type: 'leitura', description: String(await page.locator('#app').getAttribute('data-leitura')) });
      }
      const saida = await baixarAmostra(page, info.outputDir);
      expect(saida.nome).toBe('vendas_exemplo_amostra.xlsx');
      expect(saida.bytes.subarray(0, 2).toString('latin1')).toBe('PK');
      expect(await vazamentos(saida.bytes, 'vendas_exemplo.xlsx')).toEqual([]);
      expect(await violacoes(page)).toEqual([]);
      expect(rede.externos()).toEqual([]);
    });

    test('a CSP barra tentativas de acesso à rede (teste negativo)', async ({ page, context }) => {
      await vigiarRede(context, modo.url);
      await registrarViolacoes(context);
      await abrirApp(page, modo.url);
      const resultado = await page.evaluate(async () => {
        const r = {};
        try { await fetch('https://example.com/vazou'); r.fetch = 'saiu'; } catch (e) { r.fetch = 'bloqueado'; }
        await new Promise((fim) => {
          const img = new Image();
          img.onload = () => { r.imagem = 'saiu'; fim(); };
          img.onerror = () => { r.imagem = 'bloqueado'; fim(); };
          img.src = 'https://example.com/vazou.png';
        });
        // Só conta como "saiu" se a conexão abrir; erro, exceção ou silêncio por 3 s contam como bloqueio.
        r.websocket = await new Promise((fim) => {
          setTimeout(() => fim('bloqueado'), 3000);
          try {
            const ws = new WebSocket('wss://example.com/vazou');
            ws.onopen = () => fim('saiu');
            ws.onerror = () => fim('bloqueado');
          } catch (e) { fim('bloqueado'); }
        });
        await new Promise((fim) => setTimeout(fim, 300));
        return r;
      });
      expect(resultado).toEqual({ fetch: 'bloqueado', imagem: 'bloqueado', websocket: 'bloqueado' });
      const v = (await violacoes(page)).join('\n');
      expect(v).toMatch(/connect-src/);
      expect(v).toMatch(/img-src/);
    });

    test('.zip com várias planilhas: escolher uma e gerar', async ({ page, context }, info) => {
      const rede = await vigiarRede(context, modo.url);
      await abrirApp(page, modo.url);
      await carregarPlanilha(page, 'planilhas_exemplo.zip');
      const itens = page.locator('.escolha-item');
      await expect(itens).toHaveCount(2, { timeout: 60000 });
      await itens.filter({ hasText: 'vendas_exemplo.xlsx' }).click();
      await esperarEstrutura(page);
      const saida = await baixarAmostra(page, info.outputDir);
      expect(await vazamentos(saida.bytes, 'vendas_exemplo.xlsx')).toEqual([]);
      expect(rede.externos()).toEqual([]);
    });

    test('arquivo danificado ou com senha: mensagem clara, sem travar', async ({ page, context }) => {
      await vigiarRede(context, modo.url);
      await abrirApp(page, modo.url);
      const alerta = page.getByRole('alert');
      await carregarPlanilha(page, 'corrompido_zip.xlsx');
      await expect(alerta).toBeVisible({ timeout: 60000 });
      await expect(alerta).toContainText(/danificad|corrompid|abrir/i);
      await carregarPlanilha(page, 'senha_exemplo.xlsx');
      await expect(alerta).toContainText(/senha/i, { timeout: 60000 });
      // A página continua respondendo: dá para abrir uma planilha boa em seguida
      await carregarPlanilha(page, 'fretes_exemplo.xlsx');
      await esperarEstrutura(page);
    });
  });
}

test('sem internet: o site continua funcionando depois de carregado', async ({ page, context }, info) => {
  const rede = await vigiarRede(context, MODOS[0].url);
  await abrirApp(page, MODOS[0].url);
  await context.setOffline(true);
  await carregarPlanilha(page, 'contatos_exemplo.csv');
  await esperarEstrutura(page);
  const saida = await baixarAmostra(page, info.outputDir);
  expect(await vazamentos(saida.bytes, 'contatos_exemplo.csv')).toEqual([]);
  expect(rede.externos()).toEqual([]);
});
