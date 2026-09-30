import { test } from 'node:test';
import assert from 'node:assert/strict';
import { A } from '../apoio/ambiente.mjs';
import { RNG } from '../fixtures/auxiliares.js';

const X = A.xml;

function ler(texto, tamanhos) {
  const tokens = [];
  const leitor = X.criarLeitor((t) => tokens.push(t));
  let i = 0, k = 0;
  while (i < texto.length) {
    const n = tamanhos[k++ % tamanhos.length];
    leitor.escrever(texto.slice(i, i + n));
    i += n;
  }
  leitor.fim();
  return tokens;
}

const AMOSTRA = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' +
  '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="r">' +
  '<!-- comentário com <tag> dentro --><sheetData><row r="1" spans="1:3">' +
  '<c r="A1" t="s"><v>0</v></c><c r="B1" t="inlineStr"><is><t xml:space="preserve"> Ana &amp; Bia &lt;x&gt; &#231;&#xE3; </t></is></c>' +
  '<c r="C1" s="2"><f>IF(A1&gt;0,"a&gt;b",\'c\')</f><v>1.5</v></c><x:c r="D1" x:t="n"/></row></sheetData>' +
  '<extLst><ext uri="{X}"><![CDATA[ <não é tag> ]]></ext></extLst>' +
  '<hyperlinks><hyperlink ref="A1" display="a > b" r:id="rId1"/></hyperlinks></worksheet>';

test('XML: devolve exatamente o mesmo texto, qualquer que seja o tamanho dos pedaços', () => {
  const R = RNG(7);
  for (let rodada = 0; rodada < 200; rodada++) {
    const tamanhos = Array.from({ length: 8 }, () => R.int(1, rodada % 3 === 0 ? 3 : 40));
    const tokens = ler(AMOSTRA, tamanhos);
    assert.equal(tokens.map((t) => t.bruto).join(''), AMOSTRA, 'pedaços ' + tamanhos.join(','));
    const tags = tokens.filter((t) => t.k === 'abre').map((t) => X.local(t.nome));
    assert.deepEqual(tags.filter((n) => n === 'c'), ['c', 'c', 'c', 'c']);
  }
});

test('XML: tokens, atributos e entidades', () => {
  const tokens = ler(AMOSTRA, [1000]);
  const inline = tokens.findIndex((t) => t.k === 'abre' && t.nome === 't');
  assert.equal(X.decodificar(tokens[inline + 1].bruto), ' Ana & Bia <x> çã ');
  const link = tokens.find((t) => t.k === 'abre' && t.nome === 'hyperlink');
  assert.equal(link.vazio, true);
  assert.deepEqual(X.atributos(link.bruto), { ref: 'A1', display: 'a > b', 'r:id': 'rId1' });
  const d1 = tokens.find((t) => t.k === 'abre' && t.nome === 'x:c');
  assert.equal(X.local(d1.nome), 'c');
  assert.equal(X.atributos(d1.bruto)['x:t'], 'n');
  assert.ok(tokens.some((t) => t.k === 'outro' && t.bruto.startsWith('<![CDATA[')));
  assert.ok(tokens.some((t) => t.k === 'outro' && t.bruto.startsWith('<!--')));
});

test('XML: recusa DOCTYPE (entidades) e tag incompleta', () => {
  const erro = (fn) => { try { fn(); return null; } catch (e) { return e; } };
  const e1 = erro(() => ler('<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "b">]><x>&a;</x>', [5]));
  assert.ok(e1 && e1.amigavel && e1.tipo === 'corrompido', 'DOCTYPE deveria ser recusado');
  const e2 = erro(() => ler('<a><b attr="x', [100]));
  assert.ok(e2 && e2.amigavel);
});

test('XML: escapar e montar tag', () => {
  assert.equal(X.escapar('a<b & "c"\u0001'), 'a&lt;b &amp; &quot;c&quot;');
  assert.equal(X.tag('c', [['r', 'A1'], ['t', null], ['s', '3']], true), '<c r="A1" s="3"/>');
  assert.deepEqual(X.atributosEmOrdem('<c r="B2" s=\'1\' t="s">'), [['r', 'B2'], ['s', '1'], ['t', 's']]);
});
