// Leitor de XML em fluxo e sem perdas, para as partes de um arquivo do Office (Office Open XML).
// Recebe o texto em pedaços de qualquer tamanho (uma aba grande tem centenas de MB e não cabe numa string) e
// entrega cada pedaço de XML ("token") com o texto original: quem não mexe num token o devolve igual, byte a byte.
// Os Workers não têm DOMParser, e este leitor não expande entidades nem aceita DOCTYPE (proteção contra
// "billion laughs" e entidades externas).
import { A } from '../nucleo/amostra.js';

function erroXml(detalhe) {
  var e = new Error('O arquivo pode estar danificado ou não ser uma planilha. Tente abrir no Excel e salvar de novo como .xlsx.');
  e.tipo = 'corrompido';
  e.detalhe = detalhe;
  e.amigavel = true;
  return e;
}

// Tipos de token (k): 'abre' (<a ...> ou <a .../>, com vazio=true), 'fecha' (</a>), 'texto', 'outro'
// (declaração <?xml?>, comentário, CDATA). Em todos, `bruto` é o texto exato do arquivo.
function criarLeitor(aoToken) {
  var resto = '';

  function emitirTag(bruto) {
    var c1 = bruto.charCodeAt(1);
    if (c1 === 47) { // </
      aoToken({ k: 'fecha', nome: nomeDaTag(bruto, 2), bruto: bruto });
    } else if (c1 === 63 || c1 === 33) { // <? ou <!
      if (/^<!DOCTYPE/i.test(bruto)) throw erroXml('XML com DOCTYPE');
      aoToken({ k: 'outro', bruto: bruto });
    } else {
      aoToken({ k: 'abre', nome: nomeDaTag(bruto, 1), vazio: bruto.charCodeAt(bruto.length - 2) === 47, bruto: bruto });
    }
  }

  // Fim da tag que começa em `i` (posição do '<'), respeitando aspas, comentários e CDATA; -1 se incompleta.
  function fimDaTag(s, i) {
    if (s.startsWith('<!--', i)) { var f = s.indexOf('-->', i + 4); return f < 0 ? -1 : f + 3; }
    if (s.startsWith('<![CDATA[', i)) { var g = s.indexOf(']]>', i + 9); return g < 0 ? -1 : g + 3; }
    if (s.startsWith('<!', i) && s.length - i < 9 && '<![CDATA['.startsWith(s.slice(i))) return -1; // pode ser CDATA partido
    if (s.startsWith('<!-', i) && s.length - i < 4) return -1;
    var aspas = 0;
    for (var j = i + 1; j < s.length; j++) {
      var c = s.charCodeAt(j);
      if (aspas) { if (c === aspas) aspas = 0; } else if (c === 34 || c === 39) aspas = c; else if (c === 62) return j + 1;
    }
    return -1;
  }

  function processar(s, final) {
    var i = 0;
    while (i < s.length) {
      var lt = s.indexOf('<', i);
      if (lt < 0) {
        // Texto até o fim do pedaço: guarda o final se puder ser o começo de uma entidade partida (&am…)
        var amp = s.lastIndexOf('&');
        var corte = !final && amp >= i && s.indexOf(';', amp) < 0 ? amp : s.length;
        if (corte > i) aoToken({ k: 'texto', bruto: s.slice(i, corte) });
        return s.slice(corte);
      }
      if (lt > i) aoToken({ k: 'texto', bruto: s.slice(i, lt) });
      var fim = fimDaTag(s, lt);
      if (fim < 0) {
        if (final) throw erroXml('tag incompleta no fim do XML');
        return s.slice(lt);
      }
      emitirTag(s.slice(lt, fim));
      i = fim;
    }
    return '';
  }

  return {
    escrever: function (pedaco) { resto = processar(resto + pedaco, false); },
    fim: function () { resto = processar(resto, true); if (resto) aoToken({ k: 'texto', bruto: resto }); resto = ''; }
  };
}

function nomeDaTag(bruto, inicio) {
  var j = inicio;
  while (j < bruto.length) {
    var c = bruto.charCodeAt(j);
    if (c === 32 || c === 9 || c === 10 || c === 13 || c === 47 || c === 62) break;
    j++;
  }
  return bruto.slice(inicio, j);
}

// Nome sem prefixo de namespace: "x:c" → "c".
function local(nome) { var p = nome.indexOf(':'); return p < 0 ? nome : nome.slice(p + 1); }

// Atributos de uma tag de abertura, com os valores já decodificados.
function atributos(bruto) {
  var r = {}, re = /([^\s=<>/]+)\s*=\s*("([^"]*)"|'([^']*)')/g, m;
  var inicio = bruto.indexOf(' ');
  if (inicio < 0) return r;
  re.lastIndex = inicio;
  while ((m = re.exec(bruto))) r[m[1]] = decodificar(m[3] != null ? m[3] : m[4]);
  return r;
}

var ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function decodificar(s) {
  if (s.indexOf('&') < 0) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos);/g, function (m, e) {
    if (e.charCodeAt(0) === 35) {
      var n = e.charCodeAt(1) === 120 ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return n > 0 && n <= 0x10FFFF ? String.fromCodePoint(n) : '';
    }
    return ENT[e];
  });
}

// Texto seguro para o conteúdo de um elemento ou atributo. Tira caracteres que o XML não aceita.
function escapar(s) {
  return String(s)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '') // eslint-disable-line no-control-regex
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Monta uma tag de abertura a partir do nome e de uma lista de [atributo, valor] (na ordem dada).
function tag(nome, lista, vazio) {
  var s = '<' + nome;
  for (var i = 0; i < lista.length; i++) if (lista[i][1] != null) s += ' ' + lista[i][0] + '="' + escapar(lista[i][1]) + '"';
  return s + (vazio ? '/>' : '>');
}

// Atributos na ordem original (para reescrever uma tag mudando só um ou dois valores).
function atributosEmOrdem(bruto) {
  var r = [], re = /([^\s=<>/]+)\s*=\s*("([^"]*)"|'([^']*)')/g, m;
  var inicio = bruto.indexOf(' ');
  if (inicio < 0) return r;
  re.lastIndex = inicio;
  while ((m = re.exec(bruto))) r.push([m[1], decodificar(m[3] != null ? m[3] : m[4])]);
  return r;
}

A.xml = { criarLeitor: criarLeitor, atributos: atributos, atributosEmOrdem: atributosEmOrdem, decodificar: decodificar, escapar: escapar, tag: tag, local: local };
