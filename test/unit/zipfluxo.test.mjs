import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { A, XLSX } from '../apoio/ambiente.mjs';
import { fixtures } from '../fixtures/definicoes.js';

const Z = A.zipFluxo;

test('zip em fluxo: índice e conteúdo iguais aos que o JSZip lê', async () => {
  const fx = fixtures();
  const blob = new Blob([fx.fretes.bytes]);
  const indice = await Z.indice(blob);
  const ref = await JSZip.loadAsync(fx.fretes.bytes);
  const nomes = Object.keys(ref.files).filter((n) => !ref.files[n].dir).sort();
  assert.deepEqual(indice.map((e) => e.nome).sort(), nomes);
  for (const e of indice) {
    const esperado = await ref.file(e.nome).async('uint8array');
    assert.deepEqual(await Z.bytes(blob, e), esperado, e.nome);
  }
  const pedacos = [];
  const planilha = indice.find((e) => /worksheets\/sheet1\.xml$/.test(e.nome));
  await Z.textoEmPedacos(blob, planilha, (s) => { pedacos.push(s); });
  assert.equal(pedacos.join(''), await ref.file(planilha.nome).async('string'));
});

test('zip em fluxo: parte danificada dá erro amigável (CRC conferido)', async () => {
  const fx = fixtures();
  const indice = await Z.indice(new Blob([fx.fretes.bytes]));
  const alvo = indice.find((e) => e.tamanhoCompactado > 200);
  const b = new Uint8Array(fx.fretes.bytes);
  const inicio = alvo.local + 30 + (b[alvo.local + 26] | (b[alvo.local + 27] << 8)) + (b[alvo.local + 28] | (b[alvo.local + 29] << 8));
  b[inicio + Math.floor(alvo.tamanhoCompactado / 2)] ^= 0xFF;
  const e = await Z.bytes(new Blob([b]), alvo).then(() => null, (x) => x);
  assert.ok(e && e.amigavel && e.tipo === 'corrompido', 'deveria acusar parte danificada: ' + (e && e.message));
  const lixo = await Z.indice(new Blob([new Uint8Array(100)])).then(() => null, (x) => x);
  assert.ok(lixo && lixo.amigavel);
});

test('zip em fluxo: copiar partes sem mexer e trocar uma parte gera zip válido', async () => {
  const fx = fixtures();
  const blob = new Blob([fx.fretes.bytes]);
  const indice = await Z.indice(blob);
  const esc = Z.criarEscritor();
  for (const e of indice) {
    if (e.nome === 'docProps/core.xml') await esc.adicionar(e.nome, '<?xml version="1.0"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"/>', e);
    else await esc.copiar(blob, e);
  }
  const saida = new Uint8Array(await esc.finalizar().arrayBuffer());
  const z = await JSZip.loadAsync(saida);
  const ref = await JSZip.loadAsync(fx.fretes.bytes);
  for (const e of indice) {
    const novo = await z.file(e.nome).async('string');
    if (e.nome === 'docProps/core.xml') assert.match(novo, /coreProperties/);
    else assert.equal(novo, await ref.file(e.nome).async('string'), e.nome);
  }
  // O leitor próprio aceita o resultado (CRCs e tamanhos certos) e o SheetJS abre a planilha
  const indiceSaida = await Z.indice(new Blob([saida]));
  for (const e of indiceSaida) await Z.bytes(new Blob([saida]), e);
  const wb = XLSX.read(saida, { type: 'array' });
  assert.deepEqual(wb.SheetNames, XLSX.read(fx.fretes.bytes, { type: 'array' }).SheetNames);
  // Partes copiadas mantêm exatamente os bytes compactados originais
  const orig = indice.find((e) => /sheet1\.xml$/.test(e.nome)), copia = indiceSaida.find((e) => e.nome === orig.nome);
  assert.equal(copia.crc, orig.crc);
  assert.equal(copia.tamanhoCompactado, orig.tamanhoCompactado);
});
