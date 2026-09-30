// Roda a suíte do navegador (test/navegador/suite.js) no jsdom, montada em memória a partir do código atual.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarTestes } from '../../scripts/build.mjs';
import { rodar } from '../navegador/rodar-no-jsdom.mjs';

test('suíte do navegador no jsdom: todos aprovados, sem erro de script', { timeout: 300000 }, async () => {
  const r = await rodar({ html: await montarTestes() });
  const resultado = (r.relatorio.match(/Resultado: .*/) || [r.relatorio.slice(0, 300)])[0];
  assert.deepEqual(r.erros, [], 'erros de script no jsdom');
  assert.ok(r.ok, resultado + '\n' + r.relatorio.split('\n').filter((l) => /REPROVADO|FALHOU|✗/.test(l)).slice(0, 20).join('\n'));
});
