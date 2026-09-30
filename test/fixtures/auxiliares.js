// Funções auxiliares dos testes, independentes do código testado (dígitos verificadores, datas, RNG...).

function RNG(semente) {
  var a = semente >>> 0;
  var r = {
    num: function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int: function (x, y) { return x + Math.floor(r.num() * (y - x + 1)); },
    pick: function (l) { return l[Math.floor(r.num() * l.length)]; },
    unif: function (x, y) { return x + r.num() * (y - x); }
  };
  return r;
}
function pad(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }
function serialDe(y, m, d) { return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 864e5; }
function partes(serial) {
  var dt = new Date(Date.UTC(1899, 11, 30) + Math.round(serial * 86400) * 1000);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}
function dataBR(s) { var p = partes(s); return pad(p.d, 2) + '/' + pad(p.m, 2) + '/' + p.y; }
function dataISO(s) { var p = partes(s); return p.y + '-' + pad(p.m, 2) + '-' + pad(p.d, 2); }
function dataBRValida(v) {
  var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  if (!m) return false;
  var dt = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  return dt.getUTCDate() === +m[1] && dt.getUTCMonth() === +m[2] - 1;
}
function numBR(x, casas) {
  var s = x.toFixed(casas).split('.');
  var i = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return s[1] ? i + ',' + s[1] : i;
}
function r2(x) { return Math.round(x * 100) / 100; }
function logUnif(R, a, b) { return Math.exp(Math.log(a) + R.num() * (Math.log(b) - Math.log(a))); }
function ponderado(R, pares) {
  var x = R.num(), acc = 0;
  for (var i = 0; i < pares.length; i++) { acc += pares[i][1]; if (x < acc) return pares[i][0]; }
  return pares[pares.length - 1][0];
}
function semAcentoT(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function igual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function pct(x) { return Math.round(x * 100) + '%'; }
function log10(x) { return Math.log(x) / Math.LN10; }
function chaveN(v) { return Number(v).toFixed(6); }
function quadro() { return new Promise(function (ok) { setTimeout(ok, 0); }); }

// Dígitos verificadores calculados de outro jeito (independente de fonte/util.js)
function dvCpfT(b9) {
  var s = 0, i;
  for (i = 0; i < 9; i++) s += +b9.charAt(i) * (10 - i);
  var d1 = (s * 10) % 11; if (d1 === 10) d1 = 0;
  var b10 = b9 + d1; s = 0;
  for (i = 0; i < 10; i++) s += +b10.charAt(i) * (11 - i);
  var d2 = (s * 10) % 11; if (d2 === 10) d2 = 0;
  return '' + d1 + d2;
}
function dvCnpjT(base) {
  function calc(s) {
    var soma = 0, peso = 2;
    for (var i = s.length - 1; i >= 0; i--) { soma += (s.charCodeAt(i) - 48) * peso; peso = peso === 9 ? 2 : peso + 1; }
    var r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  }
  var d1 = calc(base);
  return '' + d1 + calc(base + d1);
}
function dvChaveT(b43) {
  var soma = 0;
  for (var i = 0; i < 43; i++) soma += +b43.charAt(42 - i) * (2 + (i % 8));
  var r = soma % 11;
  return String(r < 2 ? 0 : 11 - r);
}
function cpfValidoT(v) {
  var d = String(v).replace(/\D/g, '');
  return d.length === 11 && !/^(\d)\1+$/.test(d) && dvCpfT(d.slice(0, 9)) === d.slice(9);
}
function cnpjValidoT(v) {
  var d = String(v).replace(/[^0-9A-Z]/gi, '').toUpperCase();
  return d.length === 14 && !/^(\d)\1+$/.test(d) && dvCnpjT(d.slice(0, 12)) === d.slice(12);
}
function cpfT(R) {
  var b;
  do { b = ''; for (var i = 0; i < 9; i++) b += R.int(0, 9); } while (/^(\d)\1+$/.test(b));
  return b + dvCpfT(b);
}
function cnpjT(R) {
  var b = '';
  for (var i = 0; i < 8; i++) b += R.int(0, 9);
  b += '0001';
  return b + dvCnpjT(b);
}
function mascCpf(d) { return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9); }
function mascCnpj(d) { return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/' + d.slice(8, 12) + '-' + d.slice(12); }
function cp1252(texto) {
  var out = new Uint8Array(texto.length);
  for (var i = 0; i < texto.length; i++) {
    var c = texto.charCodeAt(i);
    if (c > 255) throw new Error('caractere fora do Windows-1252 no exemplo: ' + texto.charAt(i));
    out[i] = c;
  }
  return out;
}
function bytesAleatorios(n, semente) {
  var R = RNG(semente), b = new Uint8Array(n);
  for (var i = 0; i < n; i++) b[i] = R.int(0, 255);
  return b;
}

var NOMES_T = ['Ana', 'Bruno', 'Camila', 'Daniel', 'Fernanda', 'Gabriel', 'Helena', 'Igor', 'Juliana', 'Lucas',
  'Mariana', 'Pedro', 'Renata', 'Samuel', 'Tatiane', 'Vitor', 'José', 'Márcia', 'Antônio', 'Sônia'];
var SOBRENOMES_T = ['Silva', 'Souza', 'Oliveira', 'Pereira', 'Costa', 'Lima', 'Almeida', 'Ribeiro', 'Carvalho', 'Gomes', 'Araújo', 'Conceição'];
var PALAVRAS_T = ['entrega', 'agendada', 'conforme', 'combinado', 'cliente', 'solicitou', 'ajuste', 'nota', 'revisada',
  'aguardando', 'retorno', 'financeiro', 'prazo', 'estendido', 'produto', 'conferido', 'embalagem', 'reforçada', 'urgente',
  'sem', 'pendências', 'transportadora', 'avisada', 'volume', 'extra'];
var DDDS_T = ['11', '21', '31', '41', '51', '61', '71', '81'];
var RE_NOME = /^[A-ZÀ-Ý][a-zà-ÿ]+( [A-ZÀ-Ý][a-zà-ÿ]+)+$/;
var RE_EMAIL_T = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

function frase(R, min, max) {
  var n = R.int(min, max), p = [];
  for (var i = 0; i < n; i++) p.push(R.pick(PALAVRAS_T));
  var s = p.join(' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function coluna(n, nome, t, z, esp, saida, gerar) {
  var v = [];
  for (var i = 0; i < n; i++) v.push(gerar(i));
  return { nome: nome, t: t, z: z, esp: esp, saida: saida, valores: v };
}


export {
  RNG, pad, serialDe, partes, dataBR, dataISO, dataBRValida, numBR, r2, logUnif, ponderado, semAcentoT, igual, pct, log10, chaveN, quadro, dvCpfT, dvCnpjT, dvChaveT, cpfValidoT, cnpjValidoT, cpfT, cnpjT, mascCpf, mascCnpj, cp1252, bytesAleatorios, NOMES_T, SOBRENOMES_T, PALAVRAS_T, DDDS_T, RE_NOME, RE_EMAIL_T, frase, coluna
};
