// Grava as planilhas de exemplo (dados inventados, sementes fixas) em test/fixtures/arquivos/,
// para abrir à mão no navegador ou em outros programas. Junto vai canarios.json: os valores
// "sensíveis" plantados em cada planilha, que nunca podem aparecer num arquivo gerado.
// Uso: node scripts/gerar-fixtures.mjs
import fs from 'node:fs';
import path from 'node:path';
import { raiz } from '../test/apoio/ambiente.mjs';
import { fixtures, xlsQueTravaSheetJS } from '../test/fixtures/definicoes.js';
import { canariosDe, canariosPseudonimo } from '../test/fixtures/canarios.js';

const destino = path.join(raiz, 'test', 'fixtures', 'arquivos');
fs.mkdirSync(destino, { recursive: true });
const fx = fixtures();

const arquivos = [
  [fx.vendas.nome, fx.vendas.bytes],
  [fx.fretes.nome, fx.fretes.bytes],
  [fx.csv.nome, fx.csv.bytes],
  [fx.xls.nome, fx.xls.bytes],
  [fx.zips.varias.nome, fx.zips.varias.bytes],
  [fx.zips.uma.nome, fx.zips.uma.bytes],
  [fx.zips.nenhuma.nome, fx.zips.nenhuma.bytes],
  [fx.senha.nome, fx.senha.bytes],
  [fx.corrompido.nome, fx.corrompido.bytes],
  [fx.zipQuebrado.nome, fx.zipQuebrado.bytes],
  // Trava a biblioteca de leitura: só para o teste do vigia no navegador (nunca abrir fora do app)
  ['trava_leitura.xls', xlsQueTravaSheetJS(fx.xls.bytes)]
];
for (const [nome, bytes] of arquivos) fs.writeFileSync(path.join(destino, nome), bytes);

const manifesto = {};
for (const def of [fx.vendas, fx.fretes, fx.csv, fx.xls]) manifesto[def.nome] = canariosDe(def);
fs.writeFileSync(path.join(destino, 'canarios.json'), JSON.stringify(manifesto, null, 1) + '\n');
// Arquivo inteiro: canários de todas as linhas das colunas trocadas por padrão
const manifestoInteiro = {};
for (const def of [fx.vendas, fx.fretes, fx.csv]) manifestoInteiro[def.nome] = canariosPseudonimo(def);
fs.writeFileSync(path.join(destino, 'canarios-inteiro.json'), JSON.stringify(manifestoInteiro, null, 1) + '\n');

console.log(arquivos.length + ' arquivos + canarios.json + canarios-inteiro.json em ' + path.relative(raiz, destino));
