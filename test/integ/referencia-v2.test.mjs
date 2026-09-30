// Prova que a migração para ES modules não mudou o comportamento: com a mesma semente, a amostra gerada
// hoje é igual (célula a célula) à que a v2 gerava. A "fotografia" foi gravada antes da migração.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { A, XLSX, raiz, abrir } from '../apoio/ambiente.mjs';
import { fixtures } from '../fixtures/definicoes.js';

const referencia = JSON.parse(fs.readFileSync(path.join(raiz, 'test/integ/referencia-v2.json'), 'utf8'));

function fotografar(f, n) {
  const arq = abrir(f.nome, f.bytes);
  const r = A.saida.gerar(arq, n, 123);
  const wb = XLSX.read(new Uint8Array(r.bytes), { type: 'array', cellNF: true });
  const abas = {};
  wb.SheetNames.forEach((nome) => {
    const ws = wb.Sheets[nome], cels = {};
    Object.keys(ws).filter((k) => k[0] !== '!').sort().forEach((k) => { const c = ws[k]; cels[k] = [c.t, c.v, c.z || null]; });
    abas[nome] = { ref: ws['!ref'] || null, merges: (ws['!merges'] || []).map(XLSX.utils.encode_range), cels };
  });
  return { nome: r.nome, abas, tipos: arq.abas.map((a) => a.colunas.map((c) => c.tipoDetectado)), resumo: A.resumo.texto(arq) };
}

const fx = fixtures();
for (const f of [fx.vendas, fx.fretes, fx.csv, fx.xls]) {
  for (const n of [10, 20]) {
    test('igual à v2: ' + f.nome + ' com ' + n + ' linhas', () => {
      const atual = fotografar(f, n), antes = referencia[f.nome + '|' + n];
      assert.ok(antes, 'sem referência para ' + f.nome);
      assert.equal(atual.nome, antes.nome);
      assert.deepEqual(atual.tipos, antes.tipos);
      assert.deepEqual(Object.keys(atual.abas), Object.keys(antes.abas));
      for (const aba of Object.keys(antes.abas)) assert.deepEqual(atual.abas[aba], antes.abas[aba], 'aba ' + aba);
      assert.equal(atual.resumo, antes.resumo);
    });
  }
}
