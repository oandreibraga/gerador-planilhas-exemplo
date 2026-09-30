// Executado numa thread separada pelo fuzz.test.mjs: monta arquivos quebrados de propósito e tenta abrir cada um.
// Avisa o início de cada caso e de cada etapa, para que um travamento aponte o caso e a etapa exatos.
// Etapas: "conteiner" (nosso leitor de zip), "sheetjs" (biblioteca externa + montagem), "analise", "gerar".
import { parentPort, workerData } from 'node:worker_threads';
import JSZip from 'jszip';
import { A } from '../apoio/ambiente.mjs';
import { fixtures } from '../fixtures/definicoes.js';
import { RNG } from '../fixtures/auxiliares.js';

const fx = fixtures();
const R = RNG(workerData.semente);
const casos = [];

function adicionar(nome, arquivo, bytes) { casos.push({ nome, arquivo, bytes }); }

const bases = [
  [fx.fretes.nome, fx.fretes.bytes], [fx.xls.nome, fx.xls.bytes], [fx.csv.nome, fx.csv.bytes],
  [fx.zips.uma.nome, fx.zips.uma.bytes], [fx.senha.nome, fx.senha.bytes]
];
for (let i = 0; i < workerData.quantidade; i++) {
  const [nome, original] = bases[i % bases.length];
  const b = new Uint8Array(original);
  const tipo = i % 4;
  if (tipo === 0) {
    adicionar('truncado ' + i, nome, b.slice(0, R.int(0, b.length - 1)));
  } else if (tipo === 1) {
    const m = new Uint8Array(b);
    const trocas = R.int(1, 60);
    for (let k = 0; k < trocas; k++) m[R.int(0, m.length - 1)] = R.int(0, 255);
    adicionar('bytes trocados ' + i, nome, m);
  } else if (tipo === 2) {
    const lixo = new Uint8Array(R.int(1, 5000));
    for (let k = 0; k < lixo.length; k++) lixo[k] = R.int(0, 255);
    if (R.num() < 0.5) { lixo[0] = 0x50; lixo[1] = 0x4B; lixo[2] = 3; lixo[3] = 4; }
    adicionar('lixo ' + i, R.pick(['a.xlsx', 'a.xls', 'a.csv', 'a.zip']), lixo);
  } else {
    const m = new Uint8Array(b.length + R.int(1, 2000));
    m.set(b);
    for (let k = b.length; k < m.length; k++) m[k] = R.int(0, 255);
    adicionar('com sobra no fim ' + i, nome, m);
  }
}

// XML com DOCTYPE e entidades (ataque "billion laughs") e zip que infla muito
const xmlBomba = '<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;">' +
  '<!ENTITY c "&b;&b;&b;&b;&b;&b;&b;&b;&b;&b;"><!ENTITY d "&c;&c;&c;&c;&c;&c;&c;&c;&c;&c;">]>' +
  '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>&d;&d;&d;</t></is></c></row></sheetData></worksheet>';
const zipBomba = await JSZip.loadAsync(fx.fretes.bytes);
zipBomba.file('xl/worksheets/sheet1.xml', xmlBomba);
adicionar('XML com DOCTYPE/entidades', 'bomba.xlsx', await zipBomba.generateAsync({ type: 'uint8array' }));
const zipInfla = await JSZip.loadAsync(fx.fretes.bytes);
zipInfla.file('xl/worksheets/sheet1.xml', '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
  ' '.repeat(20 * 1024 * 1024) + '</sheetData></worksheet>');
adicionar('zip que infla 20 MB', 'infla.xlsx', await zipInfla.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }));

const etapa = (nome) => parentPort.postMessage({ tipo: 'etapa', etapa: nome });

// Mesmo caminho do app: contêiner validado por nós, leitura pela biblioteca (no Worker, com vigia),
// análise (no Worker) e geração (na tela, sem vigia: não pode travar nunca).
async function abrirEAnalisar(nome, bytes) {
  etapa('conteiner');
  await A.leitura.validarConteiner(nome, bytes);
  etapa('sheetjs');
  const arq = A.leitura.abrir({ nome, bytes });
  etapa('analise');
  A.detectar.analisarArquivo(arq);
  return arq;
}

parentPort.postMessage({ tipo: 'total', total: casos.length });
for (let i = workerData.inicio || 0; i < casos.length; i++) {
  const caso = casos[i];
  parentPort.postMessage({ tipo: 'inicio', nome: caso.nome, indice: i });
  let resultado;
  try {
    if (/\.zip$/.test(caso.arquivo)) {
      etapa('conteiner');
      const itens = await A.leitura.listarZip(caso.bytes);
      for (const it of itens) await abrirEAnalisar(it.nome, it.bytes);
    } else {
      const arq = await abrirEAnalisar(caso.arquivo, caso.bytes);
      etapa('gerar');
      A.saida.gerar(arq, 10, 1);
    }
    resultado = { ok: true };
  } catch (e) {
    resultado = { ok: !!(e && e.amigavel), erro: String((e && e.message) || e).slice(0, 200) };
  }
  parentPort.postMessage({ tipo: 'fim', nome: caso.nome, ...resultado });
}
parentPort.postMessage({ tipo: 'concluido' });
