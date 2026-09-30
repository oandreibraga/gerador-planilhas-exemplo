// Modo "arquivo inteiro" (pseudonimização): o arquivo todo é tratado, nenhum canário sobra em nenhuma parte,
// o que não é sensível fica igual e o resultado abre em outras bibliotecas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import { A, XLSX } from '../apoio/ambiente.mjs';
import { fixtures } from '../fixtures/definicoes.js';
import { canariosPseudonimo, varrerXlsx, normalizarCanario } from '../fixtures/canarios.js';

function modeloDe(nome, bytes) {
  const arq = A.leitura.abrir({ nome, bytes });
  A.detectar.analisarArquivo(arq);
  return arq;
}
async function processar(nome, bytes, opcoes) {
  const modelo = modeloDe(nome, bytes);
  const r = await A.inteiro.processar(new Blob([bytes]), nome, modelo, Object.assign({ semente: 7 }, opcoes));
  return { modelo, r, bytes: new Uint8Array(await r.blob.arrayBuffer()) };
}
const linhasDe = (wb, aba) => XLSX.utils.sheet_to_json(wb.Sheets[aba], { header: 1, raw: true, defval: null });

test('arquivo inteiro (.xlsx): nenhum canário em nenhuma parte, inclusive depois da linha 551', { timeout: 120000 }, async () => {
  const fx = fixtures();
  const { r, bytes } = await processar(fx.vendas.nome, fx.vendas.bytes);
  const vazamentos = await varrerXlsx(bytes, canariosPseudonimo(fx.vendas), JSZip);
  assert.deepEqual(vazamentos.slice(0, 10), [], vazamentos.length + ' vazamento(s)');
  const mov = r.relatorio.abas.find((a) => a.nome === 'Movimentos');
  assert.equal(mov.colunas.find((c) => c.nome === 'Histórico').trocadas, 20000, 'as 20 mil linhas, não só as primeiras');
  assert.equal(r.nome, 'vendas_exemplo_pseudonimizado.xlsx');
});

test('arquivo inteiro (.xlsx): o que não é sensível fica igual; o sensível muda sempre e de forma consistente', { timeout: 120000 }, async () => {
  const fx = fixtures();
  const { modelo, bytes } = await processar(fx.vendas.nome, fx.vendas.bytes);
  const orig = XLSX.read(fx.vendas.bytes, { type: 'array', cellNF: true });
  const novo = XLSX.read(bytes, { type: 'array', cellNF: true });
  assert.deepEqual(novo.SheetNames, orig.SheetNames);
  assert.deepEqual(novo.Workbook.Sheets.map((s) => s.Hidden), orig.Workbook.Sheets.map((s) => s.Hidden), 'abas ocultas continuam ocultas');
  const mapa = new Map();
  for (const aba of modelo.abas) {
    const a = linhasDe(orig, aba.nome), b = linhasDe(novo, aba.nome);
    assert.equal(b.length, a.length, aba.nome + ': mesmo número de linhas');
    if (aba.linhaCab >= 0) assert.deepEqual(b[aba.linhaCab], a[aba.linhaCab], aba.nome + ': cabeçalho igual');
    for (const col of aba.colunas) {
      const acao = A.inteiro.acaoPadrao(col.tipo);
      for (let i = aba.linhaCab + 1; i < a.length; i++) {
        const va = a[i][col.c], vb = b[i][col.c];
        if (acao === 'manter') assert.deepEqual(vb, va, aba.nome + ' ' + col.letra + (i + 1) + ' (' + col.tipo + ') deveria ficar igual');
        else if (va != null && String(va).trim()) {
          assert.notEqual(String(vb), String(va), aba.nome + ' ' + col.letra + (i + 1) + ' (' + col.tipo + ') deveria mudar');
          if (col.tipo === 'pessoa') {
            const k = normalizarCanario(va);
            if (mapa.has(k)) assert.equal(normalizarCanario(vb), mapa.get(k), 'mesma pessoa, mesmo fictício (' + va + ')');
            mapa.set(k, normalizarCanario(vb));
          }
        }
      }
    }
  }
  // Mesclagens, larguras e formatos de número intactos
  const ws0 = orig.Sheets.Vendas, ws1 = novo.Sheets.Vendas;
  assert.deepEqual(ws1['!merges'], ws0['!merges']);
  assert.equal(ws1.B5.z, ws0.B5.z);
  assert.equal(ws1.K5.z, ws0.K5.z);
});

test('arquivo inteiro (.xlsx): partes que não mudam são copiadas byte a byte; metadados limpos', async () => {
  const fx = fixtures();
  const { bytes } = await processar(fx.fretes.nome, fx.fretes.bytes);
  const Z = A.zipFluxo;
  const antes = await Z.indice(new Blob([fx.fretes.bytes])), depois = await Z.indice(new Blob([bytes]));
  for (const nome of ['xl/styles.xml', 'xl/theme/theme1.xml']) {
    const a = antes.find((e) => e.nome === nome), b = depois.find((e) => e.nome === nome);
    if (!a) continue;
    assert.equal(b.crc, a.crc, nome);
    assert.equal(b.tamanhoCompactado, a.tamanhoCompactado, nome);
  }
  const z = await JSZip.loadAsync(bytes);
  assert.doesNotMatch(await z.file('docProps/core.xml').async('string'), /creator|lastModifiedBy/);
  assert.match(await z.file('xl/workbook.xml').async('string'), /fullCalcOnLoad="1"/);
  // O próprio leitor do app aceita o resultado (CRCs, zip) e o ExcelJS abre
  await A.leitura.abrirSeguro({ nome: 'x.xlsx', bytes });
  await new ExcelJS.Workbook().xlsx.load(bytes);
});

// Planilha "de verdade", montada pelo ExcelJS: comentário, link de e-mail, fórmula com texto, rodapé de
// impressão, autor do documento, mesclagem, largura, validação e nome definido.
async function planilhaRica() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Joana Prado Autora';
  wb.lastModifiedBy = 'Carlos Revisor Silveira';
  wb.company = 'Empresa Secreta Real Ltda';
  const ws = wb.addWorksheet('Clientes');
  ws.columns = [{ header: 'Nome', key: 'nome', width: 28 }, { header: 'E-mail', key: 'email', width: 34 }, { header: 'CPF', key: 'cpf', width: 16 },
    { header: 'Valor', key: 'valor', width: 12 }, { header: 'Status', key: 'status', width: 10 }, { header: 'Resumo', key: 'resumo', width: 40 }];
  const nomes = ['Joana Prado', 'Marcelo Quintas', 'Helena Barroso', 'Otávio Mesquita', 'Lívia Carneiro', 'Rui Tavares', 'Sofia Montenegro', 'Caio Rebouças'];
  const cpfs = ['529.982.247-25', '111.444.777-35', '390.533.447-05', '862.531.476-01', '145.382.206-20', '316.842.957-00', '768.412.395-60', '903.814.268-06'];
  for (let i = 0; i < 24; i++) {
    const n = nomes[i % nomes.length];
    ws.addRow({ nome: n, email: n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(' ', '.') + '@empresa-real.com.br', cpf: cpfs[i % cpfs.length], valor: 100 + i * 7.5, status: i % 3 ? 'Ativo' : 'Inativo' });
    const linha = ws.lastRow.number;
    ws.getCell('F' + linha).value = { formula: 'A' + linha + '&" - "&C' + linha, result: n + ' - ' + cpfs[i % cpfs.length] };
  }
  ws.getCell('A2').note = 'Ligar para Joana Prado amanhã';
  ws.getCell('B3').value = { text: 'marcelo.quintas@empresa-real.com.br', hyperlink: 'mailto:marcelo.quintas@empresa-real.com.br' };
  ws.headerFooter.oddFooter = 'Preparado por Joana Prado';
  ws.mergeCells('A30:C30');
  ws.getCell('A30').value = 'Conferido por Helena Barroso em reunião';
  ws.getCell('E2').dataValidation = { type: 'list', allowBlank: true, formulae: ['"Ativo,Inativo"'] };
  wb.definedNames.add('Clientes!$A$1:$F$25', 'Base');
  return { bytes: new Uint8Array(await wb.xlsx.writeBuffer()), nomes, cpfs };
}

test('arquivo inteiro (.xlsx do Excel): comentários, links, autor, rodapé e resultado de fórmula não sobram', { timeout: 120000 }, async () => {
  const { bytes: original, nomes, cpfs } = await planilhaRica();
  const { r, bytes } = await processar('rica.xlsx', original);
  const canarios = {
    textos: nomes.map(normalizarCanario).concat(['joana prado autora', 'carlos revisor silveira', 'empresa secreta real', 'empresa-real.com.br',
      'ligar para joana prado', 'preparado por joana prado', 'conferido por helena barroso']),
    digitos: cpfs.map((c) => c.replace(/\D/g, ''))
  };
  const vazamentos = await varrerXlsx(bytes, canarios, JSZip);
  assert.deepEqual(vazamentos, []);
  const z = await JSZip.loadAsync(bytes);
  assert.ok(!Object.keys(z.files).some((n) => /comments|vmlDrawing/.test(n)), 'comentários removidos');
  assert.ok(r.relatorio.removidas.some((m) => /comentários/.test(m)));
  assert.ok(r.relatorio.removidas.some((m) => /links/.test(m)), 'links externos listados no relatório');
  // Estrutura mantida: fórmula (sem o resultado guardado), mesclagem, larguras, validação, nome definido
  const planilha = await z.file('xl/worksheets/sheet1.xml').async('string');
  assert.match(planilha, /<f>A2&amp;(&quot;|") - (&quot;|")&amp;C2<\/f>/);
  assert.doesNotMatch(planilha, /<hyperlinks>\s*<\/hyperlinks>/, 'lista de links vazia é inválida');
  assert.doesNotMatch(planilha, /t="str"/);
  assert.match(planilha, /<mergeCell ref="A30:C30"\/>/);
  assert.match(planilha, /dataValidation/);
  assert.doesNotMatch(planilha, /headerFooter/);
  assert.match(await z.file('xl/workbook.xml').async('string'), /definedName name="Base"/);
  const lida = new ExcelJS.Workbook();
  await lida.xlsx.load(bytes);
  const ws = lida.getWorksheet('Clientes');
  assert.equal(ws.getColumn(1).width, 28);
  assert.equal(ws.getCell('D2').value, 100, 'valor numérico mantido');
  assert.equal(ws.getCell('E2').value, 'Inativo', 'lista curta mantida');
  assert.equal(ws.getCell('A1').value, 'Nome', 'cabeçalho mantido');
});

test('arquivo inteiro (.xlsm): macros saem e o resultado é .xlsx comum', async () => {
  const fx = fixtures();
  const z = await JSZip.loadAsync(fx.fretes.bytes);
  z.file('xl/vbaProject.bin', new Uint8Array([1, 2, 3, 4]));
  let tipos = await z.file('[Content_Types].xml').async('string');
  tipos = tipos.replace('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml', 'application/vnd.ms-excel.sheet.macroEnabled.main+xml')
    .replace('</Types>', '<Override PartName="/xl/vbaProject.bin" ContentType="application/vnd.ms-office.vbaProject"/></Types>');
  z.file('[Content_Types].xml', tipos);
  const rels = (await z.file('xl/_rels/workbook.xml.rels').async('string'))
    .replace('</Relationships>', '<Relationship Id="rIdVba" Type="http://schemas.microsoft.com/office/2006/relationships/vbaProject" Target="vbaProject.bin"/></Relationships>');
  z.file('xl/_rels/workbook.xml.rels', rels);
  const xlsm = await z.generateAsync({ type: 'uint8array' });
  const { r, bytes } = await processar('fretes.xlsm', xlsm);
  const s = await JSZip.loadAsync(bytes);
  assert.ok(!s.file('xl/vbaProject.bin'));
  assert.doesNotMatch(await s.file('[Content_Types].xml').async('string'), /<Override[^>]*(macroEnabled|vbaProject)/);
  assert.doesNotMatch(await s.file('xl/_rels/workbook.xml.rels').async('string'), /vbaProject/);
  assert.ok(r.relatorio.removidas.some((m) => /macros/.test(m)));
  XLSX.read(bytes, { type: 'array' });
});

test('arquivo inteiro: recursos não tratados (conexões de dados) recusam o arquivo com mensagem clara', async () => {
  const fx = fixtures();
  const z = await JSZip.loadAsync(fx.fretes.bytes);
  z.file('xl/connections.xml', '<connections xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"/>');
  const comConexao = await z.generateAsync({ type: 'uint8array' });
  const e = await processar('com_conexao.xlsx', comConexao).then(() => null, (x) => x);
  assert.ok(e && e.amigavel && e.tipo === 'recurso', 'deveria recusar: ' + (e && e.message));
  assert.match(e.message, /conexões de dados/);
  const e2 = await A.inteiro.processar(new Blob([fx.xls.bytes]), fx.xls.nome, modeloDe(fx.xls.nome, fx.xls.bytes)).then(() => null, (x) => x);
  assert.ok(e2 && e2.amigavel && e2.tipo === 'formato', '.xls antigo: pedir para salvar como .xlsx');
});

test('arquivo inteiro (.csv): mesmo separador, codificação e linhas; sensível trocado, resto igual', async () => {
  const fx = fixtures();
  const modelo = modeloDe(fx.csv.nome, fx.csv.bytes);
  const r = await A.inteiro.processar(new Blob([fx.csv.bytes]), fx.csv.nome, modelo, { semente: 3 });
  const saida = new Uint8Array(await r.blob.arrayBuffer());
  const antes = new TextDecoder('windows-1252').decode(fx.csv.bytes), depois = new TextDecoder('windows-1252').decode(saida);
  assert.throws(() => new TextDecoder('utf-8', { fatal: true }).decode(saida), 'continua em Windows-1252 (não virou UTF-8)');
  const ra = A.inteiro.lerCsvCompleto(antes, ';'), rb = A.inteiro.lerCsvCompleto(depois, ';');
  assert.equal(rb.length, ra.length, 'mesmo número de linhas');
  assert.deepEqual(rb.map((r) => r.campos.length), ra.map((r) => r.campos.length), 'mesmo número de campos em cada linha');
  assert.deepEqual(rb[0].campos.map((c) => c.v), ra[0].campos.map((c) => c.v), 'cabeçalho igual');
  assert.equal(/\r\n/.test(depois), /\r\n/.test(antes), 'mesma quebra de linha');
  const canarios = canariosPseudonimo(fx.csv);
  const texto = normalizarCanario(depois);
  const vazou = canarios.textos.filter((c) => new RegExp('(^|[^\\p{L}\\p{N}])' + c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^\\p{L}\\p{N}])', 'u').test(texto));
  assert.deepEqual(vazou.slice(0, 5), []);
  assert.equal(r.nome, 'contatos_exemplo_pseudonimizado.csv');
});

test('arquivo inteiro: modo de duas passadas (usado quando há colisão) também não deixa canário', { timeout: 120000 }, async () => {
  const fx = fixtures();
  const { r, bytes } = await processar(fx.vendas.nome, fx.vendas.bytes, { doisPassos: true });
  const vazamentos = await varrerXlsx(bytes, canariosPseudonimo(fx.vendas), JSZip);
  assert.deepEqual(vazamentos.slice(0, 10), [], vazamentos.length + ' vazamento(s)');
  assert.equal(r.relatorio.abas.find((a) => a.nome === 'Movimentos').colunas.find((c) => c.nome === 'Histórico').trocadas, 20000);
});
