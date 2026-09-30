import { test } from 'node:test';
import assert from 'node:assert/strict';
import { A } from '../apoio/ambiente.mjs';

const U = A.util;

test('CPF: dígitos verificadores', () => {
  assert.equal(U.cpfValido('52998224725'), true);
  assert.equal(U.cpfValido('52998224724'), false);
  assert.equal(U.cpfValido('11111111111'), false);
  assert.equal(U.dvCpf('529982247'), '25');
});

test('CNPJ numérico e alfanumérico', () => {
  assert.equal(U.cnpjValido('11222333000181'), true);
  assert.equal(U.cnpjValido('11222333000180'), false);
  assert.equal(U.cnpjValido('12ABC34501DE35'), true);
});

test('chave de acesso NF-e/CT-e (44 dígitos, módulo 11)', () => {
  const base = '3524051122233300018157001000000123100000001';
  const chave = base + U.dvChave(base);
  assert.equal(chave.length, 44);
  assert.equal(U.chaveValida(chave), true);
  assert.equal(U.chaveValida(chave.slice(0, 43) + ((+chave[43] + 1) % 10)), false);
});

test('números escritos como texto (pt-BR e en)', () => {
  assert.deepEqual(
    (({ valor, casas, prefixo }) => ({ valor, casas, prefixo }))(U.lerNumeroTexto('R$ 1.234,56')),
    { valor: 1234.56, casas: 2, prefixo: 'R$ ' });
  assert.equal(U.lerNumeroTexto('12,5%').valor, 12.5);
  assert.equal(U.lerNumeroTexto('1,234.56').valor, 1234.56);
  assert.equal(U.lerNumeroTexto('-3,75').valor, -3.75);
  assert.equal(U.lerNumeroTexto('004512').zeroEsquerda, true);
  assert.equal(U.lerNumeroTexto('abc'), null);
  assert.equal(U.formatarNumeroTexto(1234.5, { prefixo: '', sufixo: '', dec: ',', milhar: '.', casas: 2, sinalAntes: false }), '1.234,50');
});

test('datas: serial do Excel ida e volta, texto dia/mês/ano', () => {
  const s = U.serialDeData(2024, 2, 29);
  assert.equal(s, 45351);
  assert.deepEqual((({ y, m, d }) => ({ y, m, d }))(U.partesDeSerial(s)), { y: 2024, m: 2, d: 29 });
  assert.deepEqual(U.interpretarData(U.lerDataTexto('15/03/2024').partes, 'dmy'), { y: 2024, m: 3, d: 15 });
  assert.equal(U.interpretarData(['31', '02', '2024'], 'dmy'), null);
});

test('classificação de formatos do Excel', () => {
  assert.equal(U.tipoDoFormato('dd/mm/yyyy'), 'data');
  assert.equal(U.tipoDoFormato('[$-416]dd/mm/yyyy hh:mm'), 'datahora');
  assert.equal(U.tipoDoFormato('[h]:mm:ss'), 'hora');
  assert.equal(U.tipoDoFormato('_-"R$"* #,##0.00_-;-"R$"* #,##0.00_-'), 'moeda');
  assert.equal(U.tipoDoFormato('0.0%'), 'percentual');
  assert.equal(U.casasDoFormato('#,##0.000'), 3);
  assert.equal(U.tipoDoFormato('General'), 'geral');
});

test('máscaras e RNG determinístico', () => {
  assert.equal(U.mascaraDe('PED-004512'), 'AAA-999999');
  assert.equal(U.preencherMascara('999.999', '123456'), '123.456');
  const a = U.criarAleatorio(42), b = U.criarAleatorio(42);
  const seqA = [a.num(), a.num(), a.int(1, 100)], seqB = [b.num(), b.num(), b.int(1, 100)];
  assert.deepEqual(seqA, seqB);
});

test('distribuir mantém proporções (maior resto)', () => {
  const rng = U.criarAleatorio(1);
  const idx = U.distribuir([50, 30, 20], 10, rng);
  const cont = [0, 0, 0];
  idx.forEach((i) => cont[i]++);
  assert.deepEqual(cont, [5, 3, 2]);
});
