// Orçamento de tempo: planilha de vendas com 20 mil linhas (as 150 linhas de exemplo repetidas).
// Limites folgados para máquinas de CI; ajuste com DESEMPENHO_FATOR (ex.: 2 = dobra os limites).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { A, XLSX } from '../apoio/ambiente.mjs';
import { definirVendas, montarAbaFixture } from '../fixtures/definicoes.js';

const FATOR = Number(process.env.DESEMPENHO_FATOR || 1);
const LINHAS = 20000;

function planilhaGrande() {
  const def = definirVendas();
  const aba = def.abas[0];
  const colunas = aba.colunas.map((c) => {
    const valores = [];
    for (let i = 0; i < LINHAS; i++) valores.push(c.valores[i % c.valores.length]);
    return { ...c, valores };
  });
  const ws = montarAbaFixture({ ...aba, colunas });
  const wb = { SheetNames: [aba.nome], Sheets: { [aba.nome]: ws } };
  return new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }));
}

test('20 mil linhas: leitura + análise e geração dentro do orçamento', { timeout: 120000 }, async () => {
  const bytes = planilhaGrande();
  const t0 = performance.now();
  const arq = await A.leitura.abrirSeguro({ nome: 'vendas_grande.xlsx', bytes });
  A.detectar.analisarArquivo(arq);
  const t1 = performance.now();
  const r = A.saida.gerar(arq, 30, 1);
  const t2 = performance.now();
  const leitura = t1 - t0, geracao = t2 - t1;
  console.log('  ' + (bytes.length / 1048576).toFixed(1) + ' MB · leitura+análise ' + Math.round(leitura) + ' ms · geração ' + Math.round(geracao) + ' ms');
  assert.ok(r.bytes.byteLength > 0);
  assert.ok(arq.abas[0].totalLinhas >= LINHAS, 'total de linhas informado: ' + arq.abas[0].totalLinhas);
  assert.ok(leitura < 3000 * FATOR, 'leitura+análise levou ' + Math.round(leitura) + ' ms (limite ' + 3000 * FATOR + ')');
  assert.ok(geracao < 1000 * FATOR, 'geração levou ' + Math.round(geracao) + ' ms (limite ' + 1000 * FATOR + ')');
});
