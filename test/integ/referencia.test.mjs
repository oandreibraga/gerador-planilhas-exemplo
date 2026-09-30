// Com a mesma semente, a amostra gerada tem que ser igual (célula a célula) à referência gravada.
// A primeira referência foi gravada com a v2, antes da migração para ES modules (prova de que nada mudou).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { raiz } from '../apoio/ambiente.mjs';
import { fotografar, casos } from './fotografia.mjs';

const referencia = JSON.parse(fs.readFileSync(path.join(raiz, 'test/integ/referencia.json'), 'utf8'));

for (const { f, n, chave } of casos()) {
  test('igual à referência: ' + f.nome + ' com ' + n + ' linhas', () => {
    const atual = fotografar(f, n), antes = referencia[chave];
    assert.ok(antes, 'sem referência para ' + chave + ' (rode node scripts/atualizar-referencia.mjs)');
    assert.equal(atual.nome, antes.nome);
    assert.deepEqual(atual.tipos, antes.tipos);
    assert.deepEqual(Object.keys(atual.abas), Object.keys(antes.abas));
    for (const aba of Object.keys(antes.abas)) assert.deepEqual(atual.abas[aba], antes.abas[aba], 'aba ' + aba);
    assert.equal(atual.resumo, antes.resumo);
  });
}
