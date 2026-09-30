// "Fotografia" das amostras geradas com semente fixa: detecta qualquer mudança de comportamento.
// Se a mudança for intencional, regrave com: node scripts/atualizar-referencia.mjs (e explique no commit).
import { A, XLSX, abrir } from '../apoio/ambiente.mjs';
import { fixtures } from '../fixtures/definicoes.js';

export function fotografar(f, n) {
  const arq = abrir(f.nome, f.bytes);
  const r = A.saida.gerar(arq, n, 123);
  const wb = XLSX.read(new Uint8Array(r.bytes), { type: 'array', cellNF: true });
  const abas = {};
  wb.SheetNames.forEach((nome) => {
    const ws = wb.Sheets[nome], cels = {};
    Object.keys(ws).filter((k) => k[0] !== '!').sort().forEach((k) => { const c = ws[k]; cels[k] = [c.t, c.v, c.z || null]; });
    abas[nome] = { ref: ws['!ref'] || null, merges: (ws['!merges'] || []).map(XLSX.utils.encode_range), cels };
  });
  return { nome: r.nome, abas, tipos: arq.abas.map((a) => a.colunas.map((c) => c.tipoDetectado)), resumo: A.resumo.texto(arq) };
}

export function casos() {
  const fx = fixtures();
  const lista = [];
  for (const f of [fx.vendas, fx.fretes, fx.csv, fx.xls]) for (const n of [10, 20]) lista.push({ f, n, chave: f.nome + '|' + n });
  return lista;
}
