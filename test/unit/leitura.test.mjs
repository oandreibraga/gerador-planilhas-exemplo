import { test } from 'node:test';
import assert from 'node:assert/strict';
import { A, XLSX } from '../apoio/ambiente.mjs';
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

test('.zip: lista só planilhas (ignora texto, __MACOSX e temporários)', async () => {
  const fx = fixtures();
  const itens = (await A.leitura.listarZip(fx.zips.varias.bytes)).map((i) => i.caminho).sort();
  assert.deepEqual(itens, ['entrada/contatos_exemplo.csv', 'vendas_exemplo.xlsx']);
  const e = await A.leitura.listarZip(fx.zips.nenhuma.bytes).then(() => null, (x) => x);
  assert.equal(e && e.tipo, 'vazio');
});

// .xls com uma célula "empurrada" para a coluna 50.000 (achado do fuzz: travava a análise de colunas)
function xlsComColunaImpossivel(bytes) {
  const cfb = XLSX.CFB.read(bytes, { type: 'array' });
  const i = cfb.FullPaths.findIndex((p) => /\/Workbook$/.test(p));
  const livro = new Uint8Array(cfb.FileIndex[i].content);
  const CELULAS = new Set([0x00FD, 0x0203, 0x027E, 0x0204, 0x0205]);
  let pos = 0, feito = false;
  while (pos + 4 <= livro.length && !feito) {
    const tipo = livro[pos] | (livro[pos + 1] << 8), tam = livro[pos + 2] | (livro[pos + 3] << 8);
    if (CELULAS.has(tipo)) { livro[pos + 6] = 50000 & 0xFF; livro[pos + 7] = 50000 >> 8; feito = true; }
    pos += 4 + tam;
  }
  assert.ok(feito, 'nenhuma célula encontrada no .xls de exemplo');
  cfb.FileIndex[i].content = livro;
  return new Uint8Array(XLSX.CFB.write(cfb, { type: 'array' }));
}

test('coluna além do limite do formato: mensagem clara, sem travar', () => {
  const fx = fixtures();
  const inicio = Date.now();
  const e = erroDe(() => A.leitura.abrir({ nome: 'legado.xls', bytes: xlsComColunaImpossivel(fx.xls.bytes) }));
  assert.ok(e && e.amigavel, '.xls com coluna 50.000 deveria dar erro amigável');
  assert.equal(e.tipo, 'corrompido');
  const csv = new TextEncoder().encode(Array.from({ length: 16385 }, (_, k) => 'c' + k).join(';') + '\n' + '1;'.repeat(16384) + '1\n');
  const e2 = erroDe(() => A.leitura.abrir({ nome: 'largo.csv', bytes: csv }));
  assert.ok(e2 && e2.amigavel, 'CSV com 16.385 colunas deveria dar erro amigável');
  assert.equal(e2.tipo, 'grande');
  const e3 = erroDe(() => A.leitura.deCabecalho(Array.from({ length: 16385 }, (_, k) => 'c' + k).join('\t'), 'P', 'x'));
  assert.equal(e3 && e3.tipo, 'grande');
  assert.ok(Date.now() - inicio < 5000, 'demorou ' + (Date.now() - inicio) + ' ms');
});

test('muitas colunas vazias entre as preenchidas: análise rápida', () => {
  const linhas = [['Código', 'Nome'], ['A1', 'Ana'], ['A2', 'Bia']].map((l) => {
    const r = []; r[0] = { t: 's', v: l[0] }; r[9000] = { t: 's', v: l[1] }; return r;
  });
  const arq = { nome: 'x.xlsx', base: 'x', ext: 'xlsx', origem: 'arquivo', data1904: false, textosReais: new Set(),
    abas: [{ nome: 'P', indice: 0, oculta: 0, linhas, totalLinhas: 3, merges: [], cols: [] }] };
  const inicio = Date.now();
  A.detectar.analisarArquivo(arq);
  assert.equal(arq.abas[0].colunas.length, 9001);
  assert.ok(Date.now() - inicio < 5000, 'demorou ' + (Date.now() - inicio) + ' ms');
});

test('cabeçalho colado do Excel (tab e aspas)', () => {
  const arq = A.leitura.deCabecalho('"Nome\ncompleto"\tIdade\r\n', 'Planilha1', 'x');
  A.detectar.analisarArquivo(arq);
  assert.deepEqual(arq.abas[0].colunas.map((c) => c.nome), ['Nome\ncompleto', 'Idade']);
});
