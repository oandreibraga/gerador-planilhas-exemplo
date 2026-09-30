// Simula o Web Worker: junta SheetJS + biblioteca + trabalhador do mesmo jeito que src/ui/app.js faz
// (um único texto) e roda num contexto isolado do Node, com `self`, `postMessage` e `onmessage`.
// Confere que a resposta passa pela cópia estruturada (structuredClone, como no postMessage real)
// e que a amostra gerada a partir dela é idêntica à gerada com a análise feita na tela.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { A, XLSX, raiz } from '../apoio/ambiente.mjs';
import { fixtures } from '../fixtures/definicoes.js';
import { lerSheetJS, empacotar } from '../../scripts/build.mjs';

const codigo = [lerSheetJS(), await empacotar('src/biblioteca.js'), fs.readFileSync(path.join(raiz, 'src/trabalhador.js'), 'utf8')].join('\n;\n');

function novoTrabalhador() {
  const respostas = [];
  const ctx = vm.createContext({
    TextDecoder, TextEncoder, DecompressionStream, crypto: webcrypto, setTimeout, clearTimeout, console, performance, queueMicrotask,
    CompressionStream, TextDecoderStream, TextEncoderStream, TransformStream, ReadableStream, WritableStream, Blob,
    postMessage(m) { respostas.push(structuredClone(m)); },
    // O Worker real não tem rede: qualquer tentativa vira erro
    fetch() { throw new Error('rede bloqueada no Worker'); }
  });
  ctx.self = ctx; // no Worker, self é o próprio escopo global
  vm.runInContext(codigo, ctx, { filename: 'trabalhador-blob.js' });
  return {
    // Devolve a resposta final; as mensagens de andamento ficam em `andamento`.
    async enviar(msg) {
      const final = () => respostas.filter((r) => r.progresso == null);
      const antes = final().length;
      ctx.onmessage({ data: structuredClone(msg) });
      for (let i = 0; i < 6000 && final().length === antes; i++) await new Promise((r) => setTimeout(r, 5));
      assert.equal(final().length, antes + 1, 'o trabalhador não respondeu');
      return final()[final().length - 1];
    },
    andamento: () => respostas.filter((r) => r.progresso != null)
  };
}

test('Worker: planilha analisada fora da tela gera a mesma amostra que na tela', async () => {
  const fx = fixtures();
  const t = novoTrabalhador();
  for (const f of [fx.vendas, fx.fretes, fx.xls, fx.csv]) {
    const nome = f.nome;
    const resp = await t.enviar({ id: 7, op: 'abrir', nome, bytes: f.bytes });
    assert.equal(resp.id, 7);
    assert.ok(resp.ok, nome + ': ' + JSON.stringify(resp.erro));
    const naTela = A.leitura.abrir({ nome, bytes: f.bytes });
    A.detectar.analisarArquivo(naTela);
    const deFora = resp.res;
    assert.deepEqual(deFora.abas.map((a) => a.colunas.map((c) => c.tipo)), naTela.abas.map((a) => a.colunas.map((c) => c.tipo)), nome + ': tipos detectados');
    const g1 = A.saida.gerar(deFora, 20, 42), g2 = A.saida.gerar(naTela, 20, 42);
    assert.ok(Buffer.from(g1.bytes).equals(Buffer.from(g2.bytes)), nome + ': amostra difere entre Worker e tela');
  }
});

test('Worker: .zip listado e erro amigável atravessam o postMessage', async () => {
  const fx = fixtures();
  const t = novoTrabalhador();
  const lista = await t.enviar({ id: 1, op: 'listarZip', nome: fx.zips.varias.nome, bytes: fx.zips.varias.bytes });
  assert.ok(lista.ok);
  assert.deepEqual(lista.res.map((i) => i.caminho).sort(), ['entrada/contatos_exemplo.csv', 'vendas_exemplo.xlsx']);
  for (const [f, tipo] of [[fx.senha, 'senha'], [fx.zipQuebrado, 'corrompido'], [fx.corrompido, 'corrompido']]) {
    const r = await t.enviar({ id: 2, op: 'abrir', nome: f.nome, bytes: f.bytes });
    assert.equal(r.ok, false, f.nome);
    assert.equal(r.erro.tipo, tipo, f.nome);
    assert.equal(r.erro.amigavel, true, f.nome);
    assert.ok(r.erro.message.length > 10);
  }
});

test('Worker: arquivo inteiro com andamento; o arquivo gerado (Blob) atravessa o postMessage', async () => {
  const fx = fixtures();
  const t = novoTrabalhador();
  const modelo = A.leitura.abrir({ nome: fx.fretes.nome, bytes: fx.fretes.bytes });
  A.detectar.analisarArquivo(modelo);
  const resp = await t.enviar({ id: 9, op: 'inteiro', nome: fx.fretes.nome, bytes: fx.fretes.bytes, modelo, acoes: {} });
  assert.ok(resp.ok, JSON.stringify(resp.erro));
  assert.ok(t.andamento().length > 0 && t.andamento().every((m) => m.id === 9 && m.progresso >= 0 && m.progresso <= 1), 'mensagens de andamento');
  assert.equal(resp.res.nome, 'fretes_exemplo_pseudonimizado.xlsx');
  const bytes = new Uint8Array(await resp.res.blob.arrayBuffer());
  const wb = XLSX.read(bytes, { type: 'array' });
  assert.deepEqual(wb.SheetNames, ['Fretes']);
  assert.ok(resp.res.relatorio.pseudonimos.chave.distintos > 0);
});
