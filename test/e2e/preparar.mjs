// Confere, antes dos testes de navegador, que o build e as planilhas de exemplo existem.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export default function preparar() {
  const faltando = ['dist/gerador-planilhas-exemplo.html', 'dist/index.html', 'test/fixtures/arquivos/canarios.json', 'test/fixtures/arquivos/canarios-inteiro.json']
    .filter((p) => !fs.existsSync(path.join(raiz, p)));
  if (faltando.length) {
    throw new Error('Faltam ' + faltando.join(', ') + '. Rode antes: node scripts/build.mjs && node scripts/gerar-fixtures.mjs');
  }
}
