// Arquivos quebrados de propósito: cada um tem que terminar com sucesso ou com mensagem amigável,
// nunca com erro cru nem travando. Quantidade e semente ajustáveis: FUZZ_CASOS, FUZZ_SEMENTE.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';

const QUANTIDADE = Number(process.env.FUZZ_CASOS || 160);
const SEMENTE = Number(process.env.FUZZ_SEMENTE || 20260930);
const LIMITE_POR_CASO_MS = 15000;

test('fuzz: ' + QUANTIDADE + ' arquivos quebrados (semente ' + SEMENTE + ')', { timeout: 20 * 60 * 1000 }, async () => {
  const problemas = [];
  let atual = null, concluidos = 0;
  await new Promise((resolver, rejeitar) => {
    const w = new Worker(new URL('./fuzz-trabalho.mjs', import.meta.url), { workerData: { quantidade: QUANTIDADE, semente: SEMENTE } });
    let vigia = null;
    const armar = () => {
      clearTimeout(vigia);
      vigia = setTimeout(() => {
        problemas.push('TRAVOU (> ' + LIMITE_POR_CASO_MS / 1000 + ' s): ' + atual);
        w.terminate().then(resolver);
      }, LIMITE_POR_CASO_MS);
    };
    armar();
    w.on('message', (m) => {
      if (m.tipo === 'inicio') { atual = m.nome; armar(); }
      if (m.tipo === 'fim') { concluidos++; if (!m.ok) problemas.push(m.nome + ': erro sem mensagem amigável — ' + m.erro); }
      if (m.tipo === 'concluido') { clearTimeout(vigia); w.terminate().then(resolver); }
    });
    w.on('error', (e) => { clearTimeout(vigia); problemas.push('thread caiu em "' + atual + '": ' + e.message); resolver(); });
    w.on('exit', () => { clearTimeout(vigia); resolver(); });
    void rejeitar;
  });
  assert.deepEqual(problemas.slice(0, 15), [], problemas.length + ' problema(s) em ' + concluidos + ' casos concluídos');
});
