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
import { A, raiz } from '../apoio/ambiente.mjs';
import { fixtures } from '../fixtures/definicoes.js';
import { lerSheetJS, empacotar } from '../../scripts/build.mjs';

const codigo = [lerSheetJS(), await empacotar('src/biblioteca.js'), fs.readFileSync(path.join(raiz, 'src/trabalhador.js'), 'utf8')].join('\n;\n');

function novoTrabalhador() {
  const respostas = [];
  const ctx = vm.createContext({
    TextDecoder, TextEncoder, DecompressionStream, crypto: webcrypto, setTimeout, clearTimeout, console, performance, queueMicrotask,
    postMessage(m) { respostas.push(structuredClone(m)); },
    // O Worker real não tem rede: qualquer tentativa vira erro
    fetch() { throw new Error('rede bloqueada no Worker'); }
  });
  ctx.self = ctx; // no Worker, self é o próprio escopo global
  vm.runInContext(codigo, ctx, { filename: 'trabalhador-blob.js' });
  return {
    async enviar(msg) {
      const antes = respostas.length;
      ctx.onmessage({ data: structuredClone(msg) });
      for (let i = 0; i < 2000 && respostas.length === antes; i++) await new Promise((r) => setTimeout(r, 5));
      assert.equal(respostas.length, antes + 1, 'o trabalhador não respondeu');
      return respostas[respostas.length - 1];
    }
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
