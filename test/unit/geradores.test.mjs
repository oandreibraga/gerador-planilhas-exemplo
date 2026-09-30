import { test } from 'node:test';
import assert from 'node:assert/strict';
import { A, abrir, gerarERelar } from '../apoio/ambiente.mjs';
import { fixtures } from '../fixtures/definicoes.js';

test('mesma semente → mesma amostra; semente diferente → amostra diferente', () => {
  const fx = fixtures();
  const arq = abrir(fx.fretes.nome, fx.fretes.bytes);
  const cel = (wb) => JSON.stringify(wb.Sheets.Fretes);
  const a = gerarERelar(arq, 10, 5).wb, b = gerarERelar(arq, 10, 5).wb, c = gerarERelar(arq, 10, 6).wb;
  assert.equal(cel(a), cel(b));
  assert.notEqual(cel(a), cel(c));
});

test('quantidade de linhas escolhida (10/20/30)', () => {
  const fx = fixtures();
  const arq = abrir(fx.fretes.nome, fx.fretes.bytes);
  for (const n of [10, 20, 30]) {
    const ref = A.saida.gerar(arq, n, 1).wb.Sheets.Fretes['!ref'];
    assert.equal(ref.split(':')[1].replace(/[A-Z]+/, ''), String(n + 1));
  }
});

test('cidades geradas são reais e nunca estão no original', () => {
  const fx = fixtures();
  const arq = abrir(fx.fretes.nome, fx.fretes.bytes);
  const col = arq.abas[0].colunas.find((c) => c.nome === 'Cid Origem Prestação');
  const originais = new Set(col.valores.filter(Boolean).map((c) => A.detectar.nomeLugar(c.v)));
  const { wb } = gerarERelar(arq, 30, 3);
  const ws = wb.Sheets.Fretes;
  for (let r = 1; r <= 30; r++) {
    const c = ws['B' + (r + 1)];
    if (!c) continue;
    assert.ok(A.detectar.ufsDaCidade(c.v), c.v + ' deveria ser município do IBGE');
    assert.ok(!originais.has(A.detectar.nomeLugar(c.v)), c.v + ' veio do original');
  }
});
