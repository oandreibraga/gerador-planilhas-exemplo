import { test } from 'node:test';
import assert from 'node:assert/strict';
import { A } from '../apoio/ambiente.mjs';
import { fixtures } from '../fixtures/definicoes.js';

function erroDe(fn) {
  try { fn(); return null; } catch (e) { return e; }
}

test('CSV com ";" e Windows-1252', () => {
  const fx = fixtures();
  const arq = A.leitura.abrir({ nome: fx.csv.nome, bytes: fx.csv.bytes });
  assert.equal(arq.separador, ';');
  assert.equal(arq.codificacao, 'Windows-1252');
  assert.equal(arq.abas[0].nome, 'contatos_exemplo');
});

test('mensagens de erro amigáveis', () => {
  const fx = fixtures();
  const casos = [
    [fx.senha.nome, fx.senha.bytes, 'senha'],
    [fx.corrompido.nome, fx.corrompido.bytes, 'corrompido'],
    [fx.zipQuebrado.nome, fx.zipQuebrado.bytes, 'corrompido'],
    ['relatorio.pdf', new Uint8Array([37, 80, 68, 70]), 'formato'],
    ['vazio.xlsx', new Uint8Array(0), 'vazio']
  ];
  for (const [nome, bytes, tipo] of casos) {
    const e = erroDe(() => A.leitura.abrir({ nome, bytes }));
    assert.ok(e && e.amigavel, nome + ': deveria dar erro amigável');
    assert.equal(e.tipo, tipo, nome);
  }
});

test('.zip: lista só planilhas (ignora texto, __MACOSX e temporários)', () => {
  const fx = fixtures();
  const itens = A.leitura.listarZip(fx.zips.varias.bytes).map((i) => i.caminho).sort();
  assert.deepEqual(itens, ['entrada/contatos_exemplo.csv', 'vendas_exemplo.xlsx']);
  const e = erroDe(() => A.leitura.listarZip(fx.zips.nenhuma.bytes));
  assert.equal(e && e.tipo, 'vazio');
});

test('cabeçalho colado do Excel (tab e aspas)', () => {
  const arq = A.leitura.deCabecalho('"Nome\ncompleto"\tIdade\r\n', 'Planilha1', 'x');
  A.detectar.analisarArquivo(arq);
  assert.deepEqual(arq.abas[0].colunas.map((c) => c.nome), ['Nome\ncompleto', 'Idade']);
});
