import { test } from 'node:test';
import assert from 'node:assert/strict';
import { A } from '../apoio/ambiente.mjs';

const U = A.util;
const s = (v) => ({ t: 's', v });

test('pseudônimo: o mesmo valor vira sempre o mesmo fictício, em qualquer formato de escrita', () => {
  const P = A.pseudonimo.criar({ semente: 1 });
  for (const v of ['529.982.247-25', '111.444.777-35']) P.registrarReal('cpf', s(v));
  const a = P.trocar('cpf', s('529.982.247-25'));
  const b = P.trocar('cpf', s('52998224725'));
  const c = P.trocar('cpf', { t: 'n', v: 52998224725 });
  assert.match(a.v, /^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 'mantém a máscara');
  assert.match(b.v, /^\d{11}$/);
  assert.equal(a.v.replace(/\D/g, ''), b.v);
  assert.equal(String(c.v).padStart(11, '0'), b.v);
  assert.equal(c.t, 'n');
  assert.ok(U.cpfValido(b.v), 'CPF fictício com dígito verificador válido');
  assert.notEqual(b.v, '52998224725');
  assert.notEqual(P.trocar('cpf', s('111.444.777-35')).v, a.v, 'dois reais diferentes → dois fictícios diferentes');

  const n1 = P.trocar('pessoa', s('JOSÉ DA SILVA SAURO'));
  const n2 = P.trocar('pessoa', s('José da Silva Sauro'));
  const n3 = P.trocar('pessoa', s('jose da silva sauro'));
  assert.equal(n1.v, n1.v.toUpperCase(), 'maiúsculas como a ocorrência');
  assert.equal(U.normalizar(n1.v), U.normalizar(n2.v));
  assert.equal(n3.v, n3.v.toLowerCase());
  assert.equal(n1.v.split(' ').length, 3, 'mesmo número de palavras (sem contar "da")');
});

test('pseudônimo: fictício nunca é igual a um valor real do arquivo, nem contém um nome real', () => {
  // Registra como reais todas as combinações de 2 palavras de uma lista pequena: o sorteio tem de evitá-las
  const reais = [];
  for (const n of A.dados.nomesMasculinos.slice(0, 20)) for (const sb of A.dados.sobrenomes.slice(0, 20)) reais.push(n + ' ' + sb);
  const P = A.pseudonimo.criar({ semente: 2, textosReais: new Set(reais) });
  reais.forEach((v) => P.registrarReal('pessoa', s(v)));
  const reaisNorm = new Set(reais.map((v) => U.normalizar(v)));
  for (const v of reais.slice(0, 200)) {
    const f = P.trocar('pessoa', s(v)).v;
    assert.ok(!reaisNorm.has(U.normalizar(f)), 'fictício igual a um real: ' + f);
  }
});

test('pseudônimo: 200 mil valores distintos viram 200 mil fictícios distintos (um-para-um)', { timeout: 120000 }, () => {
  const P = A.pseudonimo.criar({ semente: 3 });
  const N = 200000, vistos = new Set();
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    const cpf = String(100000000 + i * 7);
    const real = cpf + U.dvCpf(cpf);
    const f = P.trocar('cpf', s(real)).v;
    vistos.add(f);
  }
  assert.equal(vistos.size, N);
  const nomes = new Set();
  for (let i = 0; i < 50000; i++) nomes.add(U.normalizar(P.trocar('pessoa', s('Pessoa Real ' + i)).v));
  assert.equal(nomes.size, 50000);
  const est = P.estatisticas();
  assert.equal(est.cpf.distintos, N);
  assert.ok(Date.now() - t0 < 60000, 'demorou ' + (Date.now() - t0) + ' ms');
});

test('pseudônimo: formatos de CNPJ, telefone, CEP, e-mail, empresa, endereço, código e chave de acesso', () => {
  const P = A.pseudonimo.criar({ semente: 4 });
  const cnpj = P.trocar('cnpj', s('11.222.333/0001-81')).v;
  assert.match(cnpj, /^\d{2}\.\d{3}\.\d{3}\/0001-\d{2}$/);
  assert.ok(U.cnpjValido(cnpj.replace(/\D/g, '')));
  const alnum = P.trocar('cnpj', s('12.ABC.345/01DE-35')).v;
  assert.match(alnum, /^[0-9A-Z]{2}\.[0-9A-Z]{3}\.[0-9A-Z]{3}\/[0-9A-Z]{4}-\d{2}$/);

  const tel = P.trocar('telefone', s('(11) 98765-4321')).v;
  assert.match(tel, /^\(\d{2}\) 9\d{4}-\d{4}$/);
  assert.equal(P.trocar('telefone', s('+55 11 98765-4321')).v.replace(/\D/g, '').slice(2), tel.replace(/\D/g, ''), 'mesmo telefone com e sem +55');
  assert.match(P.trocar('cep', s('01310-100')).v, /^\d{5}-\d{3}$/);

  const email = P.trocar('email', s('Joao.Silva@EmpresaReal.com.br')).v;
  assert.match(email, /^[a-z._0-9]+@[a-z.]+$/);
  assert.doesNotMatch(email, /empresareal/);
  assert.equal(P.trocar('email', s('joao.silva@empresareal.com.br')).v, email, 'e-mail sem diferença de caixa');

  assert.match(P.trocar('empresa', s('Padaria Pão Quente Ltda')).v, / Ltda$/);
  assert.match(P.trocar('endereco', s('Av. Paulista, 1578')).v, /^Av\. .+, \d+$/);

  const cod = P.trocar('codigo', s('PED-004512'), { modelos: [{ m: 'AAA-999999', tokens: [{ k: 'L', ch: 'P' }, { k: 'L', ch: 'E' }, { k: 'L', ch: 'D' }, { k: 'L', ch: '-' }, { k: '9' }, { k: '9' }, { k: '9' }, { k: '9' }, { k: '9' }, { k: '9' }] }] }).v;
  assert.match(cod, /^PED-\d{6}$/);
  assert.notEqual(cod, 'PED-004512');

  const cnpjReal = '11222333000181';
  const base43 = '35' + '2401' + cnpjReal + '55' + '001' + '000012345' + '1' + '12345678';
  const chaveReal = base43 + U.dvChave(base43);
  const chave = P.trocar('chave', s(chaveReal)).v;
  assert.equal(chave.length, 44);
  assert.ok(U.chaveValida(chave), 'chave com dígito verificador válido');
  assert.equal(chave.slice(0, 6), '352401', 'mantém UF e ano/mês');
  assert.equal(chave.slice(6, 20), P.trocar('cnpj', s(cnpjReal)).v, 'emitente da chave = CNPJ fictício do mesmo CNPJ');
  assert.equal(chave.slice(20, 22), '55');
});

test('pseudônimo: sementes diferentes dão fictícios diferentes (não dá para adivinhar o real pelo fictício)', () => {
  const a = A.pseudonimo.criar({ semente: 10 }).trocar('pessoa', s('Maria Souza')).v;
  const b = A.pseudonimo.criar({ semente: 11 }).trocar('pessoa', s('Maria Souza')).v;
  assert.notEqual(a, b);
  const semSemente1 = A.pseudonimo.criar().trocar('cpf', s('529.982.247-25')).v;
  const semSemente2 = A.pseudonimo.criar().trocar('cpf', s('529.982.247-25')).v;
  assert.notEqual(semSemente1, semSemente2, 'sem semente fixa, cada execução sorteia outros fictícios');
});

test('pseudônimo: passada única detecta um real que aparece depois e coincide com um fictício', () => {
  const P = A.pseudonimo.criar({ semente: 21 });
  P.registrarFundo(['529.982.247-25', 'Maria Souza']);
  const fict = P.trocar('cpf', s('529.982.247-25')).v.replace(/\D/g, '');
  assert.notEqual(fict, '52998224725');
  assert.equal(P.colisao([{ classe: 'cpf', cel: { t: 'n', v: 12345678909 } }]), false, 'real tardio diferente: sem colisão');
  assert.equal(P.colisao([{ classe: 'cpf', cel: { t: 'n', v: Number(fict) } }]), true, 'real tardio igual ao fictício: colisão');
  const nome = P.trocar('pessoa', s('Maria Souza')).v;
  const trecho = nome.split(' ').slice(0, 2).join(' ');
  assert.equal(P.colisao([{ classe: 'texto', cel: s(trecho) }]), trecho.length >= 5, 'texto tardio contido num fictício');
  // O fundo evita que o fictício repita qualquer texto já conhecido do arquivo
  const Q = A.pseudonimo.criar({ semente: 22 });
  Q.registrarFundo(['Otávio Mesquita Rolim']);
  for (let i = 0; i < 300; i++) assert.notEqual(U.normalizar(Q.trocar('pessoa', s('Pessoa ' + i)).v), U.normalizar('Otávio Mesquita Rolim'));
});
