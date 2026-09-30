// Roda dist/testes.html no jsdom (sem navegador) e imprime o relatório. Sai com código 1 se algum teste falhar.
// Uso: node test/navegador/rodar-no-jsdom.mjs   (rode antes: node scripts/build.mjs)
import fs from 'node:fs';
import path from 'node:path';
import { webcrypto } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const arquivo = path.join(raiz, 'dist', 'testes.html');
if (!fs.existsSync(arquivo)) {
  console.error('dist/testes.html não existe. Rode antes: node scripts/build.mjs');
  process.exit(2);
}

export function rodar({ limiteMs = 240000 } = {}) {
  const erros = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => erros.push(e.message));
  return new Promise((resolver) => {
    const dom = new JSDOM(fs.readFileSync(arquivo, 'utf8'), {
      url: pathToFileURL(arquivo).href,
      runScripts: 'dangerously',
      pretendToBeVisual: true,
      virtualConsole: vc,
      beforeParse(w) {
        // APIs do navegador que o jsdom não expõe dentro da janela
        if (!w.TextDecoder) w.TextDecoder = TextDecoder;
        if (!w.TextEncoder) w.TextEncoder = TextEncoder;
        if (!w.DecompressionStream) w.DecompressionStream = DecompressionStream;
        if (!w.crypto || !w.crypto.getRandomValues) Object.defineProperty(w, 'crypto', { value: webcrypto, configurable: true });
      }
    });
    const inicio = Date.now();
    const timer = setInterval(() => {
      const rel = dom.window.__relatorioTestes;
      if (rel || Date.now() - inicio > limiteMs) {
        clearInterval(timer);
        const relatorio = rel || 'TEMPO ESGOTADO. ' + dom.window.document.getElementById('placar').textContent;
        dom.window.close();
        const ok = !!rel && /\d+ aprovados, 0 reprovados/.test(rel) && !erros.length;
        resolver({ ok, relatorio, erros });
      }
    }, 200);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = await rodar();
  console.log(r.relatorio);
  if (r.erros.length) console.error('Erros de script no jsdom:\n' + r.erros.join('\n'));
  process.exit(r.ok ? 0 : 1);
}
