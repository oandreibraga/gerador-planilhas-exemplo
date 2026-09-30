// Orçamento do arquivo inteiro. Monta um .xlsx sintético grande (em fluxo, sem SheetJS) e mede tempo e memória
// da troca completa. Padrão: 20 mil linhas × 30 colunas. Meta do plano (67 mil × 86 em ~60 s e < 1,5 GB):
//   DESEMPENHO_INTEIRO_LINHAS=67000 DESEMPENHO_INTEIRO_COLUNAS=86 node --test test/integ/desempenho-inteiro.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { A } from '../apoio/ambiente.mjs';

const LINHAS = Number(process.env.DESEMPENHO_INTEIRO_LINHAS || 20000);
const COLUNAS = Number(process.env.DESEMPENHO_INTEIRO_COLUNAS || 30);
const FATOR = Number(process.env.DESEMPENHO_FATOR || 1);
// Limite de tempo: ~1 s a cada 60 mil células (a meta dá 5,7 milhões de células em 60 s → ~95 mil/s), com folga.
const LIMITE_MS = Math.max(20000, (LINHAS * COLUNAS) / 60) * FATOR;
const LIMITE_MEMORIA = 1.5 * 1024 * 1024 * 1024 * FATOR;

const TIPOS = ['Nome', 'CPF', 'E-mail', 'Cidade', 'Valor', 'Data', 'Status', 'Pedido'];
const CIDADES = ['Campinas', 'Santos', 'Sorocaba', 'Londrina', 'Joinville', 'Uberlândia'];
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function montar() {
  const U = A.util, nomes = A.dados.nomesMasculinos.concat(A.dados.nomesFemininos), sob = A.dados.sobrenomes;
  const sst = [], indice = new Map();
  const s = (texto) => { let i = indice.get(texto); if (i === undefined) { i = sst.length; sst.push(texto); indice.set(texto, i); } return i; };
  function valor(tipo, r) {
    if (tipo === 'Nome') return { s: s(nomes[r % nomes.length] + ' ' + sob[(r * 7) % sob.length] + ' ' + sob[(r * 13 + 5) % sob.length]) };
    if (tipo === 'CPF') { const b = String(100000000 + r * 37).slice(0, 9); const c = b + U.dvCpf(b); return { s: s(c.slice(0, 3) + '.' + c.slice(3, 6) + '.' + c.slice(6, 9) + '-' + c.slice(9)) }; }
    if (tipo === 'E-mail') return { s: s('cliente' + r + '@empresa-real.com.br') };
    if (tipo === 'Cidade') return { s: s(CIDADES[r % CIDADES.length]) };
    if (tipo === 'Valor') return { n: Math.round((r * 97) % 100000) / 100 };
    if (tipo === 'Data') return { n: 45000 + (r % 700), d: true };
    if (tipo === 'Status') return { s: s(r % 3 ? 'Pago' : 'Pendente') };
    return { s: s('PED-' + String(100000 + r).slice(-6)) };
  }
  const letra = (c) => A.util.letraColuna(c);
  let linha = 0;
  const cab = () => '<row r="1">' + Array.from({ length: COLUNAS }, (_, c) => '<c r="' + letra(c) + '1" t="s"><v>' +
    s(TIPOS[c % TIPOS.length] + (c >= TIPOS.length ? ' ' + (Math.floor(c / TIPOS.length) + 1) : '')) + '</v></c>').join('') + '</row>';
  const planilha = new ReadableStream({
    pull(ctl) {
      const enc = new TextEncoder();
      if (linha === 0) {
        ctl.enqueue(enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + cab()));
        linha = 1;
        return;
      }
      if (linha > LINHAS) { ctl.enqueue(enc.encode('</sheetData></worksheet>')); ctl.close(); return; }
      let x = '';
      for (let k = 0; k < 500 && linha <= LINHAS; k++, linha++) {
        const r = linha + 1;
        x += '<row r="' + r + '">';
        for (let c = 0; c < COLUNAS; c++) {
          const v = valor(TIPOS[c % TIPOS.length], linha + c * 1000);
          x += v.s !== undefined ? '<c r="' + letra(c) + r + '" t="s"><v>' + v.s + '</v></c>' : '<c r="' + letra(c) + r + '"' + (v.d ? ' s="1"' : '') + '><v>' + v.n + '</v></c>';
        }
        x += '</row>';
      }
      ctl.enqueue(enc.encode(x));
    }
  });
  return { planilha, sst };
}

async function arquivoSintetico() {
  const Z = A.zipFluxo, esc2 = Z.criarEscritor();
  const { planilha, sst } = montar();
  await esc2.adicionarFluxo('xl/worksheets/sheet1.xml', planilha);
  await esc2.adicionar('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>');
  await esc2.adicionar('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  await esc2.adicionar('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Base" sheetId="1" r:id="rId1"/></sheets></workbook>');
  await esc2.adicionar('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>' +
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
  await esc2.adicionar('xl/styles.xml', '<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills>' +
    '<borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf numFmtId="14" applyNumberFormat="1"/></cellXfs></styleSheet>');
  const partesSst = ['<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" uniqueCount="' + sst.length + '">'];
  for (const t of sst) partesSst.push('<si><t>' + esc(t) + '</t></si>');
  partesSst.push('</sst>');
  const blocos = [];
  for (let i = 0; i < partesSst.length; i += 20000) blocos.push(partesSst.slice(i, i + 20000).join(''));
  await esc2.adicionarFluxo('xl/sharedStrings.xml', new Blob(blocos).stream());
  return esc2.finalizar();
}

test('arquivo inteiro: ' + LINHAS + ' linhas × ' + COLUNAS + ' colunas dentro do orçamento de tempo e memória', { timeout: 20 * 60 * 1000 }, async () => {
  const blob = await arquivoSintetico();
  let pico = process.memoryUsage().rss;
  const medidor = setInterval(() => { pico = Math.max(pico, process.memoryUsage().rss); }, 50);
  const t0 = Date.now();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const modelo = A.leitura.abrir({ nome: 'grande.xlsx', bytes });
  A.detectar.analisarArquivo(modelo);
  const t1 = Date.now();
  let tm = Date.now();
  const etapas = [];
  const r = await A.inteiro.processar(blob, 'grande.xlsx', modelo, { semente: 1, medir: (n) => { etapas.push(n + ' ' + (Date.now() - tm) + ' ms'); tm = Date.now(); } });
  console.log('  etapas: ' + etapas.join(' · '));
  const saida = await r.blob.arrayBuffer();
  const t2 = Date.now();
  clearInterval(medidor);
  pico = Math.max(pico, process.memoryUsage().rss);
  const trocadas = r.relatorio.abas[0].trocadas;
  console.log('  ' + (blob.size / 1048576).toFixed(1) + ' MB → ' + (saida.byteLength / 1048576).toFixed(1) + ' MB · leitura e análise ' + (t1 - t0) + ' ms · troca ' +
    (t2 - t1) + ' ms · ' + trocadas + ' células trocadas · memória máx. ' + Math.round(pico / 1048576) + ' MB');
  const colsTrocadas = [0, 1, 2, 7].filter((c) => c < COLUNAS).length * Math.ceil(COLUNAS / TIPOS.length);
  assert.ok(trocadas >= LINHAS * Math.min(colsTrocadas, COLUNAS) * 0.9, 'trocadas: ' + trocadas);
  assert.ok(t2 - t0 < LIMITE_MS, 'levou ' + (t2 - t0) + ' ms (limite ' + Math.round(LIMITE_MS) + ')');
  assert.ok(pico < LIMITE_MEMORIA, 'memória ' + Math.round(pico / 1048576) + ' MB');
});
