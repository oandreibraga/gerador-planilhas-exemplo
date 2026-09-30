// Ajudantes dos testes de navegador: vigiar a rede, registrar violações de CSP e percorrer o fluxo do app.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import JSZip from 'jszip';
import { expect } from '@playwright/test';
import { varrerXlsx } from '../fixtures/canarios.js';

export const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const fixtura = (nome) => path.join(raiz, 'test/fixtures/arquivos', nome);
export const canarios = () => JSON.parse(fs.readFileSync(fixtura('canarios.json'), 'utf8'));

// O mesmo app aberto de dois jeitos: pelo site e pelo arquivo baixado (file://).
export const MODOS = [
  { nome: 'site', url: 'http://127.0.0.1:4173/' },
  { nome: 'arquivo offline', url: pathToFileURL(path.join(raiz, 'dist/gerador-planilhas-exemplo.html')).href }
];

// Registra toda requisição do contexto (páginas e Workers) e bloqueia qualquer uma que não seja
// o próprio documento (e os `extras`, como o .zip que a pessoa escolhe baixar): se o app tentar sair para a rede,
// o teste vê e nada chega a sair do CI.
export async function vigiarRede(context, urlPagina, extras = []) {
  const pedidos = [];
  const permitido = (u) => u === urlPagina || extras.includes(u) || u.startsWith('blob:') || u.startsWith('data:');
  context.on('request', (r) => pedidos.push(r.url()));
  await context.route('**/*', (route) => (permitido(route.request().url()) ? route.continue() : route.abort('blockedbyclient')));
  return { externos: () => pedidos.filter((u) => !permitido(u)) };
}

// Guarda as violações de CSP numa lista da página (roda antes de qualquer script do app).
export async function registrarViolacoes(context) {
  await context.addInitScript(() => {
    window.__violacoes = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__violacoes.push(e.violatedDirective + ' ' + e.blockedURI);
    }, true);
  });
}
export const violacoes = (page) => page.evaluate(() => window.__violacoes || []);

export async function abrirApp(page, url) {
  await page.goto(url);
  // A área de escolha (label com role=button); o <input type=file> escondido dentro dela tem o mesmo nome
  await expect(page.locator('label.dropzone')).toBeVisible();
}

export async function carregarPlanilha(page, nome) {
  await page.locator('input[type=file]').setInputFiles(fixtura(nome));
}

export async function esperarEstrutura(page) {
  await expect(page.locator('section.estrutura')).toBeVisible({ timeout: 60000 });
}

// Clica em "Baixar planilha de exemplo" e devolve os bytes do arquivo baixado.
export async function baixarAmostra(page, pasta) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Baixar planilha de exemplo/ }).click()
  ]);
  const destino = path.join(pasta, download.suggestedFilename());
  await download.saveAs(destino);
  return { nome: download.suggestedFilename(), bytes: fs.readFileSync(destino) };
}

export async function vazamentos(bytes, nomeFixtura) {
  return varrerXlsx(bytes, canarios()[nomeFixtura], JSZip);
}
