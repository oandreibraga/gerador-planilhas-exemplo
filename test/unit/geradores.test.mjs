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

test('nomes de aba inválidos (arquivo danificado) viram nomes que o Excel aceita, sem repetir', () => {
  const longo = 'Relatório mensal de vendas por região e produto';
  const nomes = [longo, longo + ' (cópia)', 'Custos: 2024/2025', 'History', "'Resumo'", 'resumo', 'x'.repeat(30) + "'abc"];
  const arq = {
    nome: 'x.xlsx', base: 'x', ext: 'xlsx', origem: 'arquivo', data1904: false, textosReais: new Set(),
    abas: nomes.map((nome, i) => ({ nome, indice: i, oculta: 0, linhas: [[{ t: 's', v: 'Código' }], [{ t: 's', v: 'A1' }]], totalLinhas: 2, merges: [], cols: [] }))
  };
  A.detectar.analisarArquivo(arq);
  const { wb } = gerarERelar(arq, 10, 1);
  assert.equal(wb.SheetNames.length, nomes.length);
  for (const n of wb.SheetNames) {
    assert.ok(n.length >= 1 && n.length <= 31, 'tamanho: ' + n);
    assert.doesNotMatch(n, /[\[\]:*?\/\\]|^'|'$/, 'caracteres: ' + n);
  }
  const minusculos = wb.SheetNames.map((n) => n.toLowerCase());
  assert.equal(new Set(minusculos).size, minusculos.length, 'repetidos: ' + wb.SheetNames.join(' | '));
  assert.ok(!minusculos.includes('history'));
  assert.equal(wb.SheetNames[5], 'resumo (2)');
});
