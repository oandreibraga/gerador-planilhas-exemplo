/* Utilitários do núcleo: aleatoriedade, datas do Excel, CPF/CNPJ, formatos e máscaras. Sem DOM. */
import { A } from './amostra.js';

var U = {};
var BASE_SERIAL = Date.UTC(1899, 11, 30);
var DIA_MS = 86400000;

A.LIMITES = {
  AMOSTRA: 500,        // linhas de dados analisadas por aba
  BUSCA_CABECALHO: 50, // linhas onde o cabeçalho é procurado
  LINHAS_LIDAS: 551,   // linhas lidas do arquivo por aba (cabeçalho + amostra)
  COLUNAS: 16384,      // máximo de colunas do Excel (A até XFD)
  COLUNAS_XLS: 256     // máximo de colunas do .xls antigo (A até IV)
};

// ---------- texto ----------
U.semAcento = function (s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
};
U.normalizar = function (s) {
  return U.semAcento(String(s).toLowerCase()).replace(/\s+/g, ' ').trim();
};
U.letraColuna = function (c) {
  var s = '';
  c = c + 1;
  while (c > 0) {
    var m = (c - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    c = Math.floor((c - 1) / 26);
  }
  return s;
};
U.pad2 = function (n) { return n < 10 ? '0' + n : String(n); };

U.estiloCaixa = function (valores) {
  var maius = 0, minus = 0, total = 0;
  for (var i = 0; i < valores.length; i++) {
    var v = valores[i];
    if (!/[A-Za-zÀ-ÿ]/.test(v)) continue;
    total++;
    if (v === v.toUpperCase()) maius++;
    else if (v === v.toLowerCase()) minus++;
  }
  if (!total) return 'misto';
  if (maius / total >= 0.8) return 'maiusculo';
  if (minus / total >= 0.8) return 'minusculo';
  return 'misto';
};
U.aplicarCaixa = function (s, estilo) {
  if (estilo === 'maiusculo') return s.toUpperCase();
  if (estilo === 'minusculo') return s.toLowerCase();
  return s;
};

// ---------- aleatoriedade (sfc32, semente de crypto) ----------
U.criarAleatorio = function (semente) {
  if (semente == null) {
    var buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    semente = buf[0];
  }
  semente = semente >>> 0;
  var a = 0x9E3779B9, b = 0x243F6A88, c = 0xB7E15162, d = semente;
  function prox() {
    a |= 0; b |= 0; c |= 0; d |= 0;
    var t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  }
  for (var i = 0; i < 15; i++) prox();
  return {
    semente: semente,
    num: prox,
    int: function (min, max) { return min + Math.floor(prox() * (max - min + 1)); },
    escolher: function (lista) { return lista[Math.floor(prox() * lista.length)]; },
    chance: function (p) { return prox() < p; },
    embaralhar: function (lista) {
      for (var i = lista.length - 1; i > 0; i--) {
        var j = Math.floor(prox() * (i + 1));
        var t = lista[i]; lista[i] = lista[j]; lista[j] = t;
      }
      return lista;
    },
    digitos: function (n) {
      var s = '';
      for (var i = 0; i < n; i++) s += Math.floor(prox() * 10);
      return s;
    }
  };
};

// Distribui n posições entre grupos proporcionalmente aos pesos (maior resto) e embaralha.
U.distribuir = function (pesos, n, rng) {
  var total = 0, i;
  for (i = 0; i < pesos.length; i++) total += pesos[i];
  if (!total || n <= 0) return [];
  var cotas = [], usados = 0;
  for (i = 0; i < pesos.length; i++) {
    var q = pesos[i] * n / total;
    var base = Math.floor(q);
    cotas.push({ i: i, base: base, resto: q - base });
    usados += base;
  }
  var ordem = cotas.slice().sort(function (x, y) { return (y.resto - x.resto) || (x.i - y.i); });
  for (var k = 0; usados < n; k++, usados++) ordem[k % ordem.length].base++;
  var res = [];
  for (i = 0; i < cotas.length; i++) for (var j = 0; j < cotas[i].base; j++) res.push(cotas[i].i);
  return rng.embaralhar(res);
};

// ---------- datas do Excel (sistema 1900, em UTC para não sofrer com fuso/horário de verão) ----------
U.serialDeData = function (y, m, d, h, mi, s) {
  return (Date.UTC(y, m - 1, d, h || 0, mi || 0, s || 0) - BASE_SERIAL) / DIA_MS;
};
U.partesDeSerial = function (serial) {
  var dt = new Date(BASE_SERIAL + Math.round(serial * 86400) * 1000);
  return {
    y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(),
    h: dt.getUTCHours(), mi: dt.getUTCMinutes(), s: dt.getUTCSeconds()
  };
};
U.chaveTempo = function (serial) { return Math.round(serial * 86400); };

// ---------- CPF / CNPJ ----------
U.dvCpf = function (base9) {
  var s = 0, i, r;
  for (i = 0; i < 9; i++) s += (+base9.charAt(i)) * (10 - i);
  r = s % 11;
  var d1 = r < 2 ? 0 : 11 - r;
  var b10 = base9 + d1;
  s = 0;
  for (i = 0; i < 10; i++) s += (+b10.charAt(i)) * (11 - i);
  r = s % 11;
  var d2 = r < 2 ? 0 : 11 - r;
  return '' + d1 + d2;
};
U.cpfValido = function (dig) {
  dig = String(dig);
  return /^\d{11}$/.test(dig) && !/^(\d)\1{10}$/.test(dig) && U.dvCpf(dig.slice(0, 9)) === dig.slice(9);
};
function valorCnpj(ch) { return ch.charCodeAt(0) - 48; }
U.dvCnpj = function (base12) {
  var p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  var p2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  var s = 0, i, r;
  for (i = 0; i < 12; i++) s += valorCnpj(base12.charAt(i)) * p1[i];
  r = s % 11;
  var d1 = r < 2 ? 0 : 11 - r;
  var b13 = base12 + d1;
  s = 0;
  for (i = 0; i < 13; i++) s += valorCnpj(b13.charAt(i)) * p2[i];
  r = s % 11;
  var d2 = r < 2 ? 0 : 11 - r;
  return '' + d1 + d2;
};
U.cnpjValido = function (s) {
  s = String(s).toUpperCase();
  return /^[0-9A-Z]{12}\d{2}$/.test(s) && !/^(\d)\1{13}$/.test(s) && U.dvCnpj(s.slice(0, 12)) === s.slice(12);
};

// Chave de acesso de NF-e/CT-e: 44 dígitos, o último é dígito verificador (módulo 11, pesos 2 a 9 da direita).
U.dvChave = function (base43) {
  var soma = 0, peso = 2;
  for (var i = base43.length - 1; i >= 0; i--) {
    soma += (+base43.charAt(i)) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  var r = soma % 11;
  return String(r < 2 ? 0 : 11 - r);
};
U.chaveValida = function (s) {
  var d = String(s).replace(/\s+/g, '');
  return /^\d{44}$/.test(d) && U.dvChave(d.slice(0, 43)) === d.charAt(43);
};

// ---------- máscaras (9 = dígito, A = letra maiúscula, a = letra minúscula, resto literal) ----------
U.mascaraDe = function (s) {
  return String(s).replace(/[0-9]/g, '9').replace(/[A-ZÀ-Ý]/g, 'A').replace(/[a-zß-ÿ]/g, 'a');
};
U.preencherMascara = function (mascara, chars) {
  var k = 0, out = '';
  for (var i = 0; i < mascara.length; i++) {
    var ch = mascara.charAt(i);
    if (ch === '9' || ch === 'A' || ch === 'a') out += chars.charAt(k++);
    else out += ch;
  }
  return out;
};
U.contarPosicoes = function (mascara) { return (mascara.match(/[9Aa]/g) || []).length; };

// ---------- formatos de número do Excel ----------
U.secoes = function (z) {
  var partes = [], atual = '', aspas = false, colchete = false;
  z = String(z);
  for (var i = 0; i < z.length; i++) {
    var ch = z.charAt(i);
    if (ch === '\\' && !aspas && i + 1 < z.length) { atual += ch + z.charAt(i + 1); i++; continue; }
    if (ch === '"') aspas = !aspas;
    else if (!aspas && ch === '[') colchete = true;
    else if (!aspas && ch === ']') colchete = false;
    if (ch === ';' && !aspas && !colchete) { partes.push(atual); atual = ''; continue; }
    atual += ch;
  }
  partes.push(atual);
  return partes;
};
U.limparFormato = function (secao) {
  return String(secao)
    .replace(/"[^"]*"/g, '')
    .replace(/\\./g, '')
    .replace(/[_*]./g, '')
    .replace(/\[(?:h+|m+|s+)\]/gi, 'h')
    .replace(/\[[^\]]*\]/g, '');
};
U.tipoDoFormato = function (z) {
  if (z == null) return 'geral';
  z = String(z);
  if (z === '' || z === 'General') return 'geral';
  if (z === '@') return 'texto';
  var secao = U.secoes(z)[0];
  var limpo = U.limparFormato(secao);
  if (/%/.test(limpo)) return 'percentual';
  var temData = /[dy]/i.test(limpo) || /m{3,}/i.test(limpo);
  var temHora = /[hs]/i.test(limpo) || /am\/pm|a\/p/i.test(limpo);
  if (temData && temHora) return 'datahora';
  if (temData) return 'data';
  if (temHora) return 'hora';
  if (/R\$|US\$|[$€£¥]/.test(secao)) return 'moeda';
  if (/[0#?]/.test(limpo)) return 'numero';
  if (/@/.test(limpo)) return 'texto';
  return 'geral';
};
U.casasDoFormato = function (z) {
  var t = U.tipoDoFormato(z);
  if (t === 'geral' || t === 'texto') return null;
  var limpo = U.limparFormato(U.secoes(z)[0]);
  var m = /\.([0#?]+)/.exec(limpo);
  return m ? m[1].length : 0;
};
U.formatoTemSegundos = function (z) {
  return /s/i.test(U.limparFormato(U.secoes(z || '')[0]));
};
U.decimaisDe = function (v) {
  if (!isFinite(v) || Math.floor(v) === v) return 0;
  var s = String(Number(v.toPrecision(12)));
  var e = /e-(\d+)$/.exec(s);
  if (e) return Math.min(10, +e[1]);
  var p = s.indexOf('.');
  return p < 0 ? 0 : s.length - p - 1;
};
U.arredondar = function (x, casas) {
  var f = Math.pow(10, casas);
  return Number((Math.round(x * f) / f).toFixed(casas));
};
U.chaveNumero = function (x, casas) {
  return Number(x).toFixed(Math.min(Math.max(casas, 0), 10));
};

// ---------- números escritos como texto (pt-BR e en) ----------
var RE_NUM_TEXTO = /^(-?)(\s*)(R\$|US\$|\$|€)?(\s*)(-?)(\d[\d.,]*)(\s*)(%?)$/;
U.lerNumeroTexto = function (s) {
  s = String(s).trim();
  var m = RE_NUM_TEXTO.exec(s);
  if (!m) return null;
  if (m[1] && m[5]) return null;
  if (!m[3] && (m[2] || m[4])) return null;
  var corpo = m[6], dec = null, milhar = '', inteiro, fracao = '';
  var temPonto = corpo.indexOf('.') >= 0, temVirgula = corpo.indexOf(',') >= 0;
  if (temPonto && temVirgula) {
    var ult = Math.max(corpo.lastIndexOf('.'), corpo.lastIndexOf(','));
    dec = corpo.charAt(ult);
    milhar = dec === ',' ? '.' : ',';
    inteiro = corpo.slice(0, ult);
    fracao = corpo.slice(ult + 1);
    var reMilhar = milhar === '.' ? /^\d{1,3}(\.\d{3})*$/ : /^\d{1,3}(,\d{3})*$/;
    if (!reMilhar.test(inteiro) || !/^\d+$/.test(fracao)) return null;
  } else if (temVirgula) {
    var pv = corpo.split(',');
    if (pv.length !== 2 || !/^\d+$/.test(pv[0]) || !/^\d+$/.test(pv[1])) return null;
    dec = ','; inteiro = pv[0]; fracao = pv[1];
  } else if (temPonto) {
    if (/^\d{1,3}(\.\d{3})+$/.test(corpo)) { milhar = '.'; inteiro = corpo; }
    else {
      var pp = corpo.split('.');
      if (pp.length !== 2 || !/^\d+$/.test(pp[0]) || !/^\d+$/.test(pp[1])) return null;
      dec = '.'; inteiro = pp[0]; fracao = pp[1];
    }
  } else {
    inteiro = corpo;
    if (!/^\d+$/.test(inteiro)) return null;
  }
  var intLimpo = milhar ? inteiro.split(milhar).join('') : inteiro;
  var valor = parseFloat(intLimpo + (fracao ? '.' + fracao : ''));
  var neg = !!(m[1] || m[5]);
  return {
    valor: neg ? -valor : valor,
    casas: fracao.length,
    dec: dec,
    milhar: milhar,
    prefixo: m[3] ? m[3] + (m[4] ? ' ' : '') : '',
    sufixo: m[8] ? (m[7] ? ' ' : '') + '%' : '',
    sinalAntes: !!m[1],
    zeroEsquerda: intLimpo.length > 1 && intLimpo.charAt(0) === '0',
    soDigitos: !m[3] && !m[8] && !milhar && !dec && !neg
  };
};
U.formatarNumeroTexto = function (valor, d) {
  var neg = valor < 0;
  var s = Math.abs(valor).toFixed(d.casas);
  var partes = s.split('.');
  var inteiro = partes[0];
  if (d.milhar) inteiro = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, d.milhar);
  var num = inteiro + (partes[1] ? (d.dec || ',') + partes[1] : '');
  var sinal = neg ? '-' : '';
  return d.sinalAntes ? sinal + d.prefixo + num + d.sufixo : d.prefixo + sinal + num + d.sufixo;
};

// ---------- datas e horas escritas como texto ----------
var RE_DATA_TEXTO = /^(\d{1,4})([\/.\-])(\d{1,2})\2(\d{1,4})(?:([ T])(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
var RE_HORA_TEXTO = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
U.lerDataTexto = function (s) {
  var m = RE_DATA_TEXTO.exec(String(s).trim());
  if (!m) return null;
  var hora = null;
  if (m[6] != null) {
    var h = +m[6], mi = +m[7], se = m[8] != null ? +m[8] : 0;
    if (h > 23 || mi > 59 || se > 59) return null;
    hora = { h: h, mi: mi, s: se, seg: m[8] != null, sep: m[5], hPad: m[6].length === 2 };
  }
  return { partes: [m[1], m[3], m[4]], sep: m[2], hora: hora };
};
U.interpretarData = function (partes, ordem) {
  var y, mo, d;
  if (ordem === 'ymd') { y = partes[0]; mo = partes[1]; d = partes[2]; }
  else if (ordem === 'mdy') { mo = partes[0]; d = partes[1]; y = partes[2]; }
  else { d = partes[0]; mo = partes[1]; y = partes[2]; }
  if (y.length !== 2 && y.length !== 4) return null;
  if (d.length > 2 || mo.length > 2) return null;
  var ano = +y;
  if (y.length === 2) ano = ano < 50 ? 2000 + ano : 1900 + ano;
  var mes = +mo, dia = +d;
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  var dt = new Date(Date.UTC(ano, mes - 1, dia));
  if (dt.getUTCMonth() !== mes - 1) return null;
  return { y: ano, m: mes, d: dia };
};
U.lerHoraTexto = function (s) {
  var m = RE_HORA_TEXTO.exec(String(s).trim());
  if (!m) return null;
  var h = +m[1], mi = +m[2], se = m[3] != null ? +m[3] : 0;
  if (h > 23 || mi > 59 || se > 59) return null;
  return { fracao: (h * 3600 + mi * 60 + se) / 86400, seg: m[3] != null, hPad: m[1].length === 2 };
};
U.formatarDataTexto = function (serial, d) {
  var p = U.partesDeSerial(serial);
  var dd = d.dPad ? U.pad2(p.d) : String(p.d);
  var mm = d.mPad ? U.pad2(p.m) : String(p.m);
  var yy = d.ano === 2 ? U.pad2(p.y % 100) : String(p.y);
  var ordem = d.ordem === 'ymd' ? [yy, mm, dd] : d.ordem === 'mdy' ? [mm, dd, yy] : [dd, mm, yy];
  var s = ordem.join(d.sep);
  if (d.hora) s += d.hora.sep + U.formatarHoraPartes(p, d.hora);
  return s;
};
U.formatarHoraPartes = function (p, h) {
  return (h.hPad ? U.pad2(p.h) : String(p.h)) + ':' + U.pad2(p.mi) + (h.seg ? ':' + U.pad2(p.s) : '');
};
U.formatarHoraTexto = function (fracao, h) {
  return U.formatarHoraPartes(U.partesDeSerial(fracao), h);
};

A.util = U;
