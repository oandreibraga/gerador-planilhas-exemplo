import { test } from 'node:test';
import assert from 'node:assert/strict';
import { A, XLSX, abrir } from '../apoio/ambiente.mjs';

const DET = A.detectar;

function planilha(linhas, nome = 'teste.xlsx') {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(linhas), 'Aba1');
  return abrir(nome, new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' })));
}

test('tipo pelo título da coluna', () => {
  const casos = {
    'CPF': 'cpf', 'CNPJ': 'cnpj', 'E-mail': 'email', 'Telefone do cliente': 'telefone', 'CEP': 'cep',
    'UF Origem Prestação': 'uf', 'Estado civil': 'categoria', 'Cid Origem Prestação': 'cidade', 'Data de emissão': 'data',
    'Desconto %': 'percentual', 'Valor total': 'moeda', 'Qtd': 'inteiro', 'Código do pedido': 'codigo', 'Status': 'categoria',
    'Razão Social': 'empresa', 'Cliente': 'pessoa', 'Chave CT-e': 'chave', 'CFOP': 'categoria', 'Endereço de entrega': 'endereco',
    'Bairro': 'bairro', 'Observações': 'texto'
  };
  for (const [nome, tipo] of Object.entries(casos)) assert.equal(DET.tipoPorNome(nome), tipo, nome);
});

test('cabeçalho fora da linha 1, abaixo de título e linha vazia', () => {
  const linhas = [['Relatório de teste'], [], ['Nome', 'Idade', 'Cidade']];
  for (let i = 0; i < 20; i++) linhas.push(['Ana Silva', 30 + i, 'CAMPINAS']);
  const arq = planilha(linhas);
  assert.equal(arq.abas[0].linhaCab, 2);
  assert.deepEqual(arq.abas[0].colunas.map((c) => c.nome), ['Nome', 'Idade', 'Cidade']);
});

test('significado: cidade, UF, flag 0/1, valor fixo e lista', () => {
  const cid = [['SAO PAULO', 'SP'], ['CAMPINAS', 'SP'], ['RECIFE', 'PE'], ['SALVADOR', 'BA'], ['CURITIBA', 'PR']];
  const linhas = [['Cidade', 'UF', 'Selecionar', 'Globalizado', 'Tipo Doc']];
  for (let i = 0; i < 60; i++) {
    const c = cid[i % cid.length];
    linhas.push([c[0], c[1], i % 3 === 0 ? 1 : 0, 0, i % 5 === 0 ? 'MINUTA' : 'CTRC/CTE']);
  }
  const cols = planilha(linhas).abas[0].colunas;
  assert.deepEqual(cols.map((c) => c.tipoDetectado), ['cidade', 'uf', 'categoria', 'constante', 'categoria']);
});

test('relações: UF da cidade e conta produto', () => {
  const cid = [['SAO PAULO', 'SP'], ['CAMPINAS', 'SP'], ['RECIFE', 'PE'], ['SALVADOR', 'BA'], ['CURITIBA', 'PR'], ['MANAUS', 'AM']];
  const linhas = [['Cidade', 'UF', 'Qtd', 'Preço', 'Total']];
  for (let i = 0; i < 40; i++) {
    const c = cid[(i * 7) % cid.length], q = 1 + (i * 3) % 17, p = Math.round((5 + i * 1.37) * 100) / 100;
    linhas.push([c[0], c[1], q, p, Math.round(q * p * 100) / 100]);
  }
  const rel = planilha(linhas).abas[0].relacoes;
  assert.ok(rel.some((r) => r.tipo === 'ufDaCidade' && r.cidade === 0 && r.uf === 1), JSON.stringify(rel));
  assert.ok(rel.some((r) => r.tipo === 'conta' && r.op === 'produto' && r.c === 4), JSON.stringify(rel));
});

test('trocar o tipo não relê o arquivo', () => {
  const linhas = [['Nome', 'Valor']];
  for (let i = 0; i < 20; i++) linhas.push(['Ana Silva ' + i, i * 10.5]);
  const arq = planilha(linhas);
  const antes = A.leitura.contador;
  DET.definirTipo(arq.abas[0].colunas[1], 'moeda');
  A.saida.gerar(arq, 10, 1);
  assert.equal(A.leitura.contador, antes);
});
