// Arquivos quebrados de propósito: cada um tem que terminar com sucesso ou com mensagem amigável,
// nunca com erro cru nem travando. Quantidade e semente ajustáveis: FUZZ_CASOS, FUZZ_SEMENTE.
//
// Única tolerância: travamento DENTRO da biblioteca SheetJS (etapa "sheetjs"). No app essa etapa roda
// no Worker, e o vigia de src/ui/app.js interrompe a leitura e mostra a mensagem de arquivo danificado.
// Esses casos são contados e listados; o teste continua do caso seguinte. Travar em qualquer código
// nosso (contêiner, análise, geração) reprova.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';

const QUANTIDADE = Number(process.env.FUZZ_CASOS || 160);
const SEMENTE = Number(process.env.FUZZ_SEMENTE || 20260930);
const LIMITE_POR_CASO_MS = 10000;

// Roda a partir do caso `inicio` até o fim ou até travar; devolve onde parou.
function rodada(inicio, problemas, vigiados) {
  return new Promise((resolver) => {
    const w = new Worker(new URL('./fuzz-trabalho.mjs', import.meta.url), { workerData: { quantidade: QUANTIDADE, semente: SEMENTE, inicio } });
    let atual = null, indice = inicio - 1, etapa = '', concluidos = 0, vigia = null, fim = false;
    const terminar = (proximo) => { if (fim) return; fim = true; clearTimeout(vigia); w.terminate().then(() => resolver({ proximo, concluidos })); };
    const armar = () => {
      clearTimeout(vigia);
      vigia = setTimeout(() => {
        const descricao = atual + ' (etapa ' + etapa + ')';
        if (etapa === 'sheetjs') vigiados.push(descricao);
        else problemas.push('TRAVOU (> ' + LIMITE_POR_CASO_MS / 1000 + ' s): ' + descricao);
        terminar(indice + 1);
      }, LIMITE_POR_CASO_MS);
    };
    armar();
    w.on('message', (m) => {
      if (m.tipo === 'inicio') { atual = m.nome; indice = m.indice; etapa = ''; armar(); }
      if (m.tipo === 'etapa') etapa = m.etapa;
      if (m.tipo === 'fim') { concluidos++; if (!m.ok) problemas.push(m.nome + ': erro sem mensagem amigável — ' + m.erro); }
      if (m.tipo === 'concluido') terminar(null);
    });
    w.on('error', (e) => { problemas.push('thread caiu em "' + atual + '": ' + e.message); terminar(null); });
  });
}

test('fuzz: ' + QUANTIDADE + ' arquivos quebrados (semente ' + SEMENTE + ')', { timeout: Math.max(20 * 60 * 1000, QUANTIDADE * 100) }, async () => {
  const problemas = [], vigiados = [];
  let inicio = 0, concluidos = 0;
  while (inicio != null && problemas.length === 0) {
    const r = await rodada(inicio, problemas, vigiados);
    concluidos += r.concluidos;
    inicio = r.proximo;
  }
  if (vigiados.length) {
    console.log('  ' + vigiados.length + ' caso(s) travaram dentro da SheetJS e seriam interrompidos pelo vigia do app: ' + vigiados.join('; '));
  }
  assert.deepEqual(problemas.slice(0, 15), [], problemas.length + ' problema(s) em ' + concluidos + ' casos concluídos');
});
