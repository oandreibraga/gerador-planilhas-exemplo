// Gera amostras a partir das planilhas de exemplo e grava numa pasta, para outro programa abrir
// (no CI, o LibreOffice confere que cada arquivo abre sem erro).
// Uso: node scripts/gerar-amostras.mjs [pasta]   (padrão: test/saida/amostras)
import fs from 'node:fs';
import path from 'node:path';
import { A, abrir, raiz } from '../test/apoio/ambiente.mjs';
import { fixtures } from '../test/fixtures/definicoes.js';

const destino = path.resolve(process.argv[2] || path.join(raiz, 'test', 'saida', 'amostras'));
fs.mkdirSync(destino, { recursive: true });
const fx = fixtures();
let total = 0;
for (const def of [fx.vendas, fx.fretes, fx.csv, fx.xls]) {
  const arq = abrir(def.nome, def.bytes);
  for (const n of [10, 30]) {
    const r = A.saida.gerar(arq, n, 7);
    const nome = r.nome.replace(/\.xlsx$/, '_' + n + '.xlsx');
    fs.writeFileSync(path.join(destino, nome), new Uint8Array(r.bytes));
    total++;
  }
}
// Arquivo inteiro com dados trocados (modo pseudonimização)
for (const def of [fx.vendas, fx.fretes]) {
  const r = await A.inteiro.processar(new Blob([def.bytes]), def.nome, abrir(def.nome, def.bytes), { semente: 7 });
  fs.writeFileSync(path.join(destino, r.nome), new Uint8Array(await r.blob.arrayBuffer()));
  total++;
}
console.log(total + ' amostras em ' + destino);
