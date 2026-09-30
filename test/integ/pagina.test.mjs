// Conferências estáticas da página publicada: CSP exata, nada externo, nenhuma API de rede no código do app,
// SheetJS idêntico ao registrado e build determinístico. Não executa a página.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { JSDOM } from 'jsdom';
import { montarApp, lerSheetJS, escaparScript } from '../../scripts/build.mjs';

const { html, csp } = await montarApp();
const doc = new JSDOM(html).window.document;
const hashCsp = (s) => "'sha256-" + crypto.createHash('sha256').update(s, 'utf8').digest('base64') + "'";

function diretivas(texto) {
  const d = {};
  for (const parte of texto.split(';').map((s) => s.trim()).filter(Boolean)) {
    const [nome, ...valores] = parte.split(/\s+/);
    assert.ok(!(nome in d), 'diretiva repetida: ' + nome);
    d[nome] = valores;
  }
  return d;
}

// Scripts que o navegador executa (o do Worker é text/plain e só roda dentro do Blob).
const executaveis = [...doc.querySelectorAll('script')].filter((s) => !s.type || s.type === 'text/javascript');
const codigoApp = () => ['biblioteca', 'trabalhador'].map((id) => doc.getElementById(id).textContent).join('\n') +
  executaveis.filter((s) => !s.id).map((s) => s.textContent).join('\n');

test('CSP da página: exatamente as diretivas esperadas, sem unsafe-*', () => {
  const meta = doc.querySelector('meta[http-equiv="Content-Security-Policy"]');
  assert.ok(meta, 'meta CSP ausente');
  assert.equal(meta.getAttribute('content'), csp);
  const d = diretivas(csp);
  assert.deepEqual(Object.keys(d).sort(), ['base-uri', 'connect-src', 'default-src', 'form-action', 'img-src', 'script-src', 'style-src', 'worker-src']);
  assert.deepEqual(d['default-src'], ["'none'"]);
  assert.deepEqual(d['connect-src'], ["'none'"]);
  assert.deepEqual(d['form-action'], ["'none'"]);
  assert.deepEqual(d['base-uri'], ["'none'"]);
  assert.deepEqual(d['worker-src'], ['blob:']);
  assert.deepEqual(d['img-src'], ['data:']);
  assert.doesNotMatch(csp, /unsafe-|\*|https?:/);
});

test('CSP: cada script e estilo embutido tem o hash liberado, e só eles', () => {
  const d = diretivas(csp);
  assert.deepEqual([...d['script-src']].sort(), executaveis.map((s) => hashCsp(s.textContent)).sort());
  const estilos = [...doc.querySelectorAll('style')];
  assert.equal(estilos.length, 1);
  assert.deepEqual(d['style-src'], [hashCsp(estilos[0].textContent)]);
  assert.equal(doc.querySelectorAll('[style]').length, 0, 'atributo style="" seria bloqueado pela CSP');
  const comEvento = [...doc.querySelectorAll('*')].filter((el) => [...el.attributes].some((a) => /^on/i.test(a.name)));
  assert.equal(comEvento.length, 0, 'atributo onclick="" etc. seria bloqueado pela CSP');
});

test('nenhum recurso externo: todo src/href é data: ou âncora', () => {
  const externos = [];
  for (const el of doc.querySelectorAll('[src],[href],[action],[srcset],[poster],[data]')) {
    for (const at of ['src', 'href', 'action', 'srcset', 'poster', 'data']) {
      const v = el.getAttribute(at);
      if (v != null && !/^(data:|#)/.test(v.trim())) externos.push(el.tagName + '[' + at + ']=' + v);
    }
  }
  assert.deepEqual(externos, []);
  assert.equal(doc.querySelector('meta[name="referrer"]').getAttribute('content'), 'no-referrer');
  assert.equal(doc.querySelectorAll('iframe,object,embed,base,form').length, 0);
});

test('código do app não usa APIs de rede, eval nem armazenamento', () => {
  const codigo = codigoApp();
  const proibidos = [/\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /EventSource/, /sendBeacon/, /importScripts/,
    /window\.open/, /\beval\s*\(/, /new Function/, /localStorage/, /sessionStorage/, /indexedDB/, /serviceWorker/,
    /RTCPeerConnection/, /https?:\/\//, /document\.write/, /outerHTML/, /insertAdjacentHTML/];
  for (const re of proibidos) assert.doesNotMatch(codigo, re, 'encontrado no código do app: ' + re);
  // innerHTML: um único uso, nos ícones SVG fixos
  assert.equal((codigo.match(/innerHTML/g) || []).length, 1, 'innerHTML só pode aparecer no desenho dos ícones');
});

test('SheetJS embutido é o arquivo registrado (hash conferido no build)', () => {
  const s = doc.getElementById('sheetjs').textContent;
  const sha = (x) => crypto.createHash('sha256').update(x.trim(), 'utf8').digest('hex');
  assert.equal(sha(s), sha(escaparScript(lerSheetJS())), 'SheetJS da página difere do arquivo registrado');
  assert.doesNotMatch(s, /\bfetch\s*\(|XMLHttpRequest|WebSocket|importScripts/);
});

test('marca neutra e avisos de licença na página pública', () => {
  // Sem --tema, nenhum tema interno entra: nem o marcador do build nem outras cores de marca
  assert.ok(!html.includes('/* tema:'), 'tema interno na versão pública');
  assert.match(doc.querySelector('style').textContent, /--marca:\s*#1f3b57/);
  const licencas = doc.querySelector('pre.licenca');
  assert.ok(licencas && /Apache License/.test(licencas.textContent), 'texto da licença ausente');
  assert.match(html, /SheetJS/);
  assert.doesNotMatch(html, /@@[A-Z_]+@@/, 'marcador do modelo sobrou sem troca');
});

test('build determinístico: duas montagens dão os mesmos bytes', async () => {
  const outra = await montarApp();
  assert.equal(outra.html, html);
});

test('versão do SheetJS registrada em vendor/sheetjs/VERSAO confere com o arquivo', async () => {
  const { XLSX } = await import('../apoio/ambiente.mjs');
  const fs = await import('node:fs');
  const registrada = fs.readFileSync(new URL('../../vendor/sheetjs/VERSAO', import.meta.url), 'utf8').trim();
  assert.equal(XLSX.version, registrada);
});
