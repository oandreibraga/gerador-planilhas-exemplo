// Nenhum valor sensível plantado nos exemplos pode aparecer em nenhuma parte do arquivo gerado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { A, abrir } from '../apoio/ambiente.mjs';
import { fixtures } from '../fixtures/definicoes.js';
import { canariosDe, varrerXlsx } from '../fixtures/canarios.js';

const fx = fixtures();
const SEMENTES = [11, 22, 33];

for (const def of [fx.vendas, fx.fretes, fx.csv, fx.xls]) {
  test('nenhum canário vaza: ' + def.nome, async () => {
    const canarios = canariosDe(def);
    assert.ok(canarios.textos.length > 0, 'deveria haver canários');
    const arq = abrir(def.nome, def.bytes);
    const achados = [];
    for (const semente of SEMENTES) {
      for (const n of [10, 30]) {
        const r = A.saida.gerar(arq, n, semente);
        const v = await varrerXlsx(new Uint8Array(r.bytes), canarios, JSZip);
        v.forEach((x) => achados.push('[n=' + n + ', semente ' + semente + '] ' + x));
      }
    }
    assert.deepEqual(achados.slice(0, 10), [], achados.length + ' vazamento(s)');
  });
}

test('a varredura acha um canário plantado de propósito (controle positivo)', async () => {
  const def = fx.fretes;
  const canarios = canariosDe(def);
  const arq = abrir(def.nome, def.bytes);
  const col = arq.abas[0].colunas.find((c) => c.nome === 'Cid Origem Prestação');
  col.manter = true; // "usar dados reais": a cidade real TEM que aparecer
  try {
    const r = A.saida.gerar(arq, 10, 1);
    const v = await varrerXlsx(new Uint8Array(r.bytes), canarios, JSZip);
    assert.ok(v.length > 0, 'a varredura deveria encontrar as cidades reais');
  } finally {
    col.manter = false;
  }
});
