// Conferência independente do SheetJS: abre o exemplo original e a amostra gerada com outra biblioteca (ExcelJS)
// e compara abas, visibilidade, cabeçalho, mesclagens, larguras, tipo e formato de cada coluna e vazamentos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { A, abrir } from '../apoio/ambiente.mjs';
import { fixtures } from '../fixtures/definicoes.js';

const GENERICOS = new Set(['Título do relatório', 'Informação do relatório']);
const ISENTOS = new Set(['Sim', 'Não', 'S', 'N']);
const N = 20;

function tipo(v) {
  if (v == null || v === '') return 'vazio';
  if (v instanceof Date) return 'data';
  if (typeof v === 'object' && v.richText) return 'texto';
  if (typeof v === 'object' && (v.formula || v.sharedFormula)) return 'formula';
  return { number: 'numero', string: 'texto', boolean: 'booleano' }[typeof v] || typeof v;
}
function chave(v) {
  if (v instanceof Date) return 'd' + v.toISOString();
  if (typeof v === 'number') return 'n' + v.toFixed(6);
  if (typeof v === 'string') return 's' + v.trim();
  return null;
}
async function carregar(bytes) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(bytes));
  return wb;
}

async function conferir(def, bytesOriginal, bytesGerado) {
  const falhas = [];
  const checar = (nome, cond, detalhe) => { if (!cond) falhas.push(nome + (detalhe ? ' — ' + detalhe : '')); };
  const cabecalho = {}, liberadas = new Set();
  def.abas.forEach((a) => {
    cabecalho[a.nome] = a.cab >= 0 ? a.cab + 1 : 0;
    (a.colunas || []).forEach((dc) => {
      const t = dc.esp.tipo;
      if (t === 'categoria' || t === 'constante' || (t === 'uf' && dc.saida && dc.saida.ufDe != null)) liberadas.add(a.nome + '|' + dc.nome);
    });
  });
  const orig = await carregar(bytesOriginal), ger = await carregar(bytesGerado);
  checar('abas: mesmos nomes e ordem', JSON.stringify(orig.worksheets.map((w) => w.name)) === JSON.stringify(ger.worksheets.map((w) => w.name)));
  for (const wo of orig.worksheets) {
    const wg = ger.getWorksheet(wo.name);
    if (!wg) { checar('aba presente ' + wo.name, false); continue; }
    checar(`"${wo.name}": visibilidade`, wo.state === wg.state, wo.state + ' vs ' + wg.state);
    const lc = cabecalho[wo.name];
    if (!lc) {
      let celulas = 0;
      wg.eachRow({ includeEmpty: false }, (row) => { row.eachCell(() => celulas++); });
      checar(`"${wo.name}": aba vazia continua vazia`, celulas === 0, celulas + ' células');
      continue;
    }
    for (let r = 1; r < lc; r++) {
      const po = [], pg = [];
      wo.getRow(r).eachCell((c) => po.push(c.address));
      wg.getRow(r).eachCell((c) => { pg.push(c.address); checar(`"${wo.name}"!${c.address}: texto genérico acima do cabeçalho`, GENERICOS.has(c.value), String(c.value)); });
      checar(`"${wo.name}": linha ${r} acima do cabeçalho nas mesmas posições`, po.join() === pg.join(), po.join() + ' vs ' + pg.join());
    }
    const mo = (wo.model.merges || []).slice().sort().join(), mg = (wg.model.merges || []).slice().sort().join();
    checar(`"${wo.name}": mesclagens`, mo === mg, mo + ' vs ' + mg);
    const cabO = [], cabG = [];
    wo.getRow(lc).eachCell((c) => cabO.push(c.address + '=' + c.value));
    wg.getRow(lc).eachCell((c) => cabG.push(c.address + '=' + c.value));
    checar(`"${wo.name}": cabeçalho idêntico na linha ${lc}`, cabO.join('|') === cabG.join('|'));
    const largO = wo.columns ? wo.columns.map((c) => c.width || '') : [];
    const largG = wg.columns ? wg.columns.map((c) => c.width || '') : [];
    checar(`"${wo.name}": larguras de coluna`, largO.slice(0, 5).join() === largG.slice(0, 5).join(), largO.slice(0, 5).join() + ' vs ' + largG.slice(0, 5).join());
    wo.getRow(lc).eachCell((cab, col) => {
      const tiposO = new Set(), fmtsO = new Set(), reais = new Set();
      let vaziosO = 0, totalO = 0;
      for (let r = lc + 1; r <= Math.min(wo.rowCount, lc + 500); r++) {
        const c = wo.getCell(r, col);
        totalO++;
        const t = tipo(c.value);
        if (t === 'vazio') { vaziosO++; continue; }
        tiposO.add(t); fmtsO.add(c.numFmt || 'General');
        const k = chave(c.value); if (k) reais.add(k);
      }
      const tiposG = new Set(), fmtsG = new Set(), vazados = [];
      let vaziosG = 0;
      for (let r = lc + 1; r <= lc + N; r++) {
        const c = wg.getCell(r, col);
        const t = tipo(c.value);
        if (t === 'vazio') { vaziosG++; continue; }
        tiposG.add(t); fmtsG.add(c.numFmt || 'General');
        const k = chave(c.value);
        if (k && reais.has(k) && !ISENTOS.has(c.value) && c.value !== 0 && !liberadas.has(wo.name + '|' + cab.value)) vazados.push(c.value);
      }
      const nome = `"${wo.name}" › "${cab.value}"`;
      checar(nome + ': tipo das células', [...tiposG].every((t) => tiposO.has(t)), [...tiposO].join('/') + ' vs ' + [...tiposG].join('/'));
      checar(nome + ': formato de exibição', [...fmtsG].every((f) => fmtsO.has(f)), [...fmtsO].join(' ; ') + ' vs ' + [...fmtsG].join(' ; '));
      checar(nome + ': proporção de vazios', Math.abs(vaziosO / totalO - vaziosG / N) <= 0.1 + 1 / N, (vaziosO / totalO).toFixed(2) + ' vs ' + (vaziosG / N).toFixed(2));
      checar(nome + ': nenhum valor real', vazados.length === 0, vazados.slice(0, 3).join(', '));
    });
  }
  return falhas;
}

const fx = fixtures();
for (const def of [fx.vendas, fx.fretes]) {
  test('ExcelJS confere original × amostra: ' + def.nome, async () => {
    const r = A.saida.gerar(abrir(def.nome, def.bytes), N, 123);
    const falhas = await conferir(def, def.bytes, new Uint8Array(r.bytes));
    assert.deepEqual(falhas, []);
  });
}

for (const def of [fx.csv, fx.xls]) {
  test('ExcelJS abre a amostra gerada de ' + def.nome, async () => {
    const r = A.saida.gerar(abrir(def.nome, def.bytes), N, 123);
    const wb = await carregar(new Uint8Array(r.bytes));
    assert.ok(wb.worksheets.length > 0);
    assert.ok(wb.worksheets[0].rowCount >= N);
  });
}
