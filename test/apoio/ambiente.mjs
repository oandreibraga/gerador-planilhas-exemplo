// Prepara o Node para rodar o código do app: carrega o SheetJS (mesmo arquivo com hash fixo) como global
// e importa a biblioteca a partir do código-fonte. Também bloqueia a rede: qualquer tentativa vira erro.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const tentativasDeRede = [];
function bloquear(nome) {
  return function () {
    tentativasDeRede.push(nome);
    throw new Error('Acesso à rede bloqueado nos testes: ' + nome);
  };
}
for (const nome of ['fetch', 'WebSocket', 'EventSource', 'XMLHttpRequest']) globalThis[nome] = bloquear(nome);

if (!globalThis.XLSX) {
  const codigo = fs.readFileSync(path.join(raiz, 'vendor/sheetjs/xlsx.full.min.js'), 'utf8');
  vm.runInThisContext(codigo, { filename: 'xlsx.full.min.js' });
}
export const XLSX = globalThis.XLSX;

const biblioteca = await import('../../src/biblioteca.js');
export const A = biblioteca.A;

// Gera a amostra e devolve o workbook relido (para conferir célula a célula).
export function gerarERelar(arquivo, n, semente) {
  const r = A.saida.gerar(arquivo, n, semente);
  return { r, wb: XLSX.read(new Uint8Array(r.bytes), { type: 'array', cellNF: true }) };
}

export function abrir(nome, bytes) {
  const arq = A.leitura.abrir({ nome, bytes });
  A.detectar.analisarArquivo(arq);
  return arq;
}
