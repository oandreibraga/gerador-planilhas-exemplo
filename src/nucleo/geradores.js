/* Geradores de dados falsos por tipo. Nunca copiam valores reais (exceto colunas marcadas "manter valores reais"). Sem DOM. */
import { A } from './amostra.js';

var U = A.util, D = A.dados;
var TENTATIVAS = 30;

function det() { return A.detectar; }

function vazouTexto(ctx, s) {
  return !!(ctx.textosReais && ctx.textosReais.has(String(s).trim()));
}

function escolherPonderado(lista, rng) {
  var total = 0, i;
  for (i = 0; i < lista.length; i++) total += lista[i].n;
  var x = rng.num() * total;
  for (i = 0; i < lista.length; i++) {
    x -= lista[i].n;
    if (x < 0) return lista[i];
  }
  return lista[lista.length - 1];
}

function clonarCelula(c) {
  var o = { t: c.t, v: c.v };
  if (c.z != null) o.z = c.z;
  return o;
}

// ---------- números ----------
function sortearMagnitude(lo, hi, rng) {
  if (hi <= lo) return lo;
  if (lo > 0 && hi / lo >= 100) return Math.exp(Math.log(lo) + rng.num() * (Math.log(hi) - Math.log(lo)));
  return lo + rng.num() * (hi - lo);
}

// Sorteia pela distribuição do original (pontos a cada 5%), para manter "muitos pequenos, poucos grandes".
function sortearPorQuantis(q, rng) {
  var u = rng.num() * 20, i = Math.min(19, Math.floor(u)), t = u - i;
  var a = q[i], b = q[i + 1];
  if (a > 0 && b / a > 1.5) return a * Math.pow(b / a, t);
  return a + (b - a) * t;
}

function sortearNumero(p, rng, expandir) {
  if (!expandir && p.fracZero && rng.num() < p.fracZero) return 0;
  var negativo = !!p.neg && (!p.pos || rng.num() < p.fracNeg);
  var faixa = negativo ? p.neg : p.pos;
  var q = negativo ? p.qNeg : p.qPos;
  var passo = Math.pow(10, -p.casas);
  var bruto;
  if (q && !expandir) {
    bruto = sortearPorQuantis(q, rng);
  } else {
    var lo = faixa.min, hi = faixa.max;
    if (lo === hi) { lo = lo * 0.5; hi = hi * 1.5; }
    if (expandir) hi = hi + Math.max(hi - lo, passo * 10) * expandir;
    bruto = sortearMagnitude(lo, hi, rng);
  }
  var x = U.arredondar(bruto, p.casas);
  if (x === 0) x = passo;
  return negativo ? -x : x;
}

function textoNumero(x, p) {
  var mostrado = p.tipo === 'percentual' ? x * 100 : x;
  return U.formatarNumeroTexto(U.arredondar(mostrado, p.texto.casas), p.texto);
}

function numeroValido(p, x, ctx, usados) {
  if (x === 0) return true; // zero não identifica nada e aparece na mesma proporção do original
  if (usados && usados.has(x)) return false;
  if (p.reais.has(U.chaveNumero(x, p.casas))) return false;
  if (p.arm === 'texto' && vazouTexto(ctx, textoNumero(x, p))) return false;
  return true;
}

function numeroUnico(p, rng, ctx, usados) {
  for (var t = 0; t < TENTATIVAS; t++) {
    var x = sortearNumero(p, rng, t < 10 ? 0 : (t - 9) * 0.25);
    if (numeroValido(p, x, ctx, usados)) return x;
  }
  var passo = Math.pow(10, -p.casas);
  var sinal = p.pos ? 1 : -1;
  var y = sinal * U.arredondar((p.pos ? p.pos.max : p.neg.max) + passo, p.casas);
  while (!numeroValido(p, y, ctx, usados)) y = U.arredondar(y + sinal * passo, p.casas);
  return y;
}

function celulaNumero(x, p) {
  if (p.arm === 'texto') {
    var c = { t: 's', v: textoNumero(x, p) };
    if (p.zTexto) c.z = p.zTexto;
    return c;
  }
  var o = { t: 'n', v: x };
  if (p.z && p.z !== 'General') o.z = p.z;
  return o;
}

function gerarNumeros(p, k, rng, ctx) {
  var vals = [], i;
  if (p.seq) {
    var passo = p.seq.passo;
    var fimEstimado = p.seq.ultimo + passo * p.seq.restantes;
    var inicio = fimEstimado + passo * rng.int(1, 20);
    for (i = 0; i < k; i++) vals.push(inicio + i * passo);
  } else {
    var usados = p.unico ? new Set() : null;
    for (i = 0; i < k; i++) {
      var x = numeroUnico(p, rng, ctx, usados);
      if (usados) usados.add(x);
      vals.push(x);
    }
    if (p.ordem === 'asc') vals.sort(function (a, b) { return a - b; });
    else if (p.ordem === 'desc') vals.sort(function (a, b) { return b - a; });
  }
  return vals.map(function (x) { return celulaNumero(x, p); });
}

// ---------- datas e horas ----------
function arredondarTempo(x, segundos) {
  var u = segundos ? 86400 : 1440;
  return Math.round(x * u) / u;
}

function sortearTempo(p, rng, expandir) {
  var lo = p.min, hi = p.max;
  if (p.tipo === 'data') {
    lo = Math.floor(lo); hi = Math.floor(hi);
    if (hi - lo < 1) { lo -= 30; hi += 30; }
    if (expandir) hi += Math.ceil((hi - lo + 1) * expandir);
    return lo + rng.int(0, hi - lo);
  }
  if (p.tipo === 'hora') {
    if (expandir) { lo = 0; hi = 1; }
    else if (hi - lo < 1 / 1440) { lo = Math.max(0, lo - 1 / 24); hi = Math.min(1, hi + 1 / 24); }
    var u = p.segundos ? 86400 : 1440;
    var h = arredondarTempo(lo + rng.num() * (hi - lo), p.segundos);
    if (h >= 1) h = (u - 1) / u;
    return h;
  }
  if (hi - lo < 1) { lo -= 15; hi += 15; }
  if (expandir) hi += (hi - lo) * expandir;
  return arredondarTempo(lo + rng.num() * (hi - lo), p.segundos);
}

function textoTempo(x, p) {
  return p.tipo === 'hora' ? U.formatarHoraTexto(x, p.texto) : U.formatarDataTexto(x, p.texto);
}

function tempoValido(p, x, ctx) {
  var chave = p.tipo === 'data' ? Math.floor(x) : U.chaveTempo(x);
  if (p.reais.has(chave)) return false;
  if (p.arm === 'texto' && vazouTexto(ctx, textoTempo(x, p))) return false;
  return true;
}

function tempoUnico(p, rng, ctx) {
  var x;
  for (var t = 0; t < TENTATIVAS * 2; t++) {
    x = sortearTempo(p, rng, t < 10 ? 0 : (t - 9) * 0.25);
    if (tempoValido(p, x, ctx)) return x;
  }
  return x;
}

function celulaTempo(x, p) {
  if (p.arm === 'texto') {
    var c = { t: 's', v: textoTempo(x, p) };
    if (p.zTexto) c.z = p.zTexto;
    return c;
  }
  return { t: 'n', v: x, z: p.z };
}

function gerarTempos(p, k, rng, ctx) {
  var vals = [];
  for (var i = 0; i < k; i++) vals.push(tempoUnico(p, rng, ctx));
  if (p.ordem === 'asc') vals.sort(function (a, b) { return a - b; });
  else if (p.ordem === 'desc') vals.sort(function (a, b) { return b - a; });
  return vals.map(function (x) { return celulaTempo(x, p); });
}

// ---------- máscaras: CPF, CNPJ, CEP, telefone ----------
function caracteresMascara(p, qtd, rng) {
  if (p.tipo === 'cpf') {
    var b;
    do { b = rng.digitos(9); } while (/^(\d)\1{8}$/.test(b));
    return b + U.dvCpf(b);
  }
  if (p.tipo === 'cnpj') {
    var raiz = '';
    for (var i = 0; i < 8; i++) {
      raiz += p.alfanumerico && rng.chance(0.4) ? String.fromCharCode(65 + rng.int(0, 25)) : String(rng.int(0, 9));
    }
    var base = raiz + '0001';
    return base + U.dvCnpj(base);
  }
  if (p.tipo === 'cep') return U.pad2(rng.int(1, 99)) + rng.digitos(6);
  if (p.tipo === 'chave') {
    // UF (código IBGE) + AAMM + CNPJ do emitente + modelo + série + número + tipo de emissão + código + DV
    var cuf = rng.escolher(['11', '12', '13', '14', '15', '16', '17', '21', '22', '23', '24', '25', '26', '27', '28', '29',
      '31', '32', '33', '35', '41', '42', '43', '50', '51', '52', '53']);
    var aamm = U.pad2(rng.int(20, 26)) + U.pad2(rng.int(1, 12));
    var cnpjBase = rng.digitos(8) + '0001';
    var chave43 = cuf + aamm + cnpjBase + U.dvCnpj(cnpjBase) + (p.modelo || '55') + rng.digitos(3) + rng.digitos(9) + '1' + rng.digitos(8);
    return chave43 + U.dvChave(chave43);
  }
  var celular = qtd === 13 || qtd === 11 || qtd === 9;
  var numero = celular ? '9' + rng.int(6, 9) + rng.digitos(7) : rng.int(2, 5) + rng.digitos(7);
  var ddd = rng.escolher(D.ddds);
  if (qtd >= 12) return '55' + ddd + numero;
  if (qtd >= 10) return ddd + numero;
  return numero;
}

function valorMascara(p, rng) {
  var modelo = escolherPonderado(p.mascaras, rng).m;
  var qtd = U.contarPosicoes(modelo);
  var chars = caracteresMascara(p, qtd, rng);
  while (chars.length < qtd) chars += rng.digitos(1);
  if (chars.length > qtd) chars = chars.slice(chars.length - qtd);
  if (p.arm === 'nativo' && /^\d+$/.test(chars)) {
    var o = { t: 'n', v: Number(chars) };
    if (p.z && p.z !== 'General') o.z = p.z;
    return o;
  }
  var c = { t: 's', v: U.preencherMascara(modelo, chars) };
  if (p.zTexto) c.z = p.zTexto;
  return c;
}

function chaveMascara(p, cel) {
  if (cel.t === 'n') {
    var tam = { cpf: 11, cnpj: 14, cep: 8, chave: 44 }[p.tipo] || 0;
    var s = String(cel.v);
    while (s.length < tam) s = '0' + s;
    return s;
  }
  return String(cel.v).replace(/[^0-9A-Z]/gi, '').toUpperCase();
}

// ---------- textos ----------
var todosNomes = null;
function primeirosNomes() {
  if (!todosNomes) todosNomes = D.nomesMasculinos.concat(D.nomesFemininos);
  return todosNomes;
}

function valorEmail(p, rng) {
  var nome = U.semAcento(rng.escolher(primeirosNomes())).toLowerCase();
  var sobrenome = U.semAcento(rng.escolher(D.sobrenomes)).toLowerCase();
  var sep = rng.escolher(['.', '_', '.', '']);
  var num = rng.chance(0.35) ? String(rng.int(1, 99)) : '';
  var s = nome + sep + sobrenome + num + '@' + rng.escolher(D.dominiosEmail);
  return { t: 's', v: p.caixa === 'maiusculo' ? s.toUpperCase() : s };
}

function valorPessoa(p, rng) {
  var palavras = rng.escolher(p.palavras);
  var partes = [rng.chance(0.5) ? rng.escolher(D.nomesMasculinos) : rng.escolher(D.nomesFemininos)];
  var usados = {};
  while (partes.length < palavras) {
    var s = rng.escolher(D.sobrenomes);
    if (usados[s]) continue;
    usados[s] = 1;
    partes.push(s);
  }
  return { t: 's', v: U.aplicarCaixa(partes.join(' '), p.caixa) };
}

function valorEmpresa(p, rng) {
  var sufixo = rng.escolher(p.sufixos);
  var nome = rng.escolher(D.empresaBase) + ' ' + rng.escolher(D.empresaRamo) + (sufixo ? ' ' + sufixo : '');
  return { t: 's', v: U.aplicarCaixa(nome, p.caixa) };
}

function valorCodigo(p, rng) {
  var modelo = escolherPonderado(p.modelos, rng);
  var s = '';
  for (var i = 0; i < modelo.tokens.length; i++) {
    var t = modelo.tokens[i];
    if (t.k === '9') s += rng.int(0, 9);
    else if (t.k === 'A') s += String.fromCharCode(65 + rng.int(0, 25));
    else if (t.k === 'a') s += String.fromCharCode(97 + rng.int(0, 25));
    else s += t.ch;
  }
  var c = { t: 's', v: s };
  if (p.zTexto) c.z = p.zTexto;
  return c;
}

function palavraParecida(alvo, rng) {
  var candidatas = D.palavras.filter(function (w) { return w.length >= 4 && Math.abs(w.length - alvo) <= 2; });
  if (!candidatas.length) candidatas = D.palavras.filter(function (w) { return w.length >= 4; });
  return rng.escolher(candidatas);
}

function valorTexto(p, rng) {
  var alvo = rng.escolher(p.comprimentos);
  var s;
  if (p.umaPalavra) {
    s = palavraParecida(alvo, rng);
    s = s.charAt(0).toUpperCase() + s.slice(1);
  } else {
    var palavras = [], tam = 0;
    while (!palavras.length || (tam < alvo - 2 && palavras.length < 60)) {
      var w = rng.escolher(D.palavras);
      palavras.push(w);
      tam += w.length + 1;
    }
    s = palavras.join(' ');
    s = s.charAt(0).toUpperCase() + s.slice(1);
  }
  var c = { t: 's', v: U.aplicarCaixa(s, p.caixa) };
  if (p.zTexto) c.z = p.zTexto;
  return c;
}

// ---------- lugares: cidades e UFs reais do IBGE que NÃO aparecem na planilha original ----------
var cacheLugares = new WeakMap();
function lugares(ctx) {
  var chave = ctx.textosReais || (ctx.textosReais = new Set());
  var l = cacheLugares.get(chave);
  if (l) return l;
  var DET = det(), cidadesReais = new Set(), ufsReais = new Set();
  chave.forEach(function (t) {
    cidadesReais.add(DET.nomeLugar(t));
    var sigla = DET.siglaUF(t);
    if (sigla) ufsReais.add(sigla);
  });
  var livres = (D.municipios || []).filter(function (m) { return !cidadesReais.has(DET.nomeLugar(m.nome)); });
  var porUF = {};
  livres.forEach(function (m) { (porUF[m.uf] = porUF[m.uf] || []).push(m); });
  var ufsLivres = (D.ufs || []).map(function (u) { return u.sigla; }).filter(function (s) { return !ufsReais.has(s); });
  l = { cidades: livres, porUF: porUF, ufsLivres: ufsLivres, ufsTodas: (D.ufs || []).map(function (u) { return u.sigla; }) };
  cacheLugares.set(chave, l);
  return l;
}
function formatarCidade(nome, p) {
  var s = p.acento === false ? U.semAcento(nome) : nome;
  return U.aplicarCaixa(s, p.caixa);
}
function valorCidade(p, rng, ctx) {
  var l = lugares(ctx);
  var m = l.cidades.length ? rng.escolher(l.cidades) : { nome: 'Cidade Fictícia' };
  return { t: 's', v: formatarCidade(m.nome, p) };
}
function cidadeDaUF(p, uf, rng, ctx) {
  var lista = lugares(ctx).porUF[uf];
  return lista && lista.length ? { t: 's', v: formatarCidade(rng.escolher(lista).nome, p) } : null;
}
// UF como sigla (SP) ou por extenso (São Paulo), no mesmo estilo do original.
function formatarUF(p, sigla) {
  if (p.extenso) return { t: 's', v: formatarCidade(det().nomeDaUF(sigla), p) };
  return { t: 's', v: p.caixa === 'minusculo' ? sigla.toLowerCase() : sigla };
}
function valorUF(p, rng, ctx) {
  var l = lugares(ctx);
  return formatarUF(p, rng.escolher(l.ufsLivres.length ? l.ufsLivres : l.ufsTodas));
}

// ---------- endereço e bairro (inventados) ----------
var PREFIXOS_BAIRRO = ['Jardim', 'Vila', 'Parque', 'Residencial', 'Conjunto', 'Vila Nova', 'Jardim São', 'Recanto'];
function nomeDeLugarInventado(rng) {
  return rng.chance(0.5)
    ? rng.escolher(D.nomesMasculinos.concat(D.nomesFemininos)) + ' ' + rng.escolher(D.sobrenomes)
    : rng.escolher(D.empresaBase);
}
function valorEndereco(p, rng) {
  var s = rng.escolher(p.inicios) + ' ' + nomeDeLugarInventado(rng);
  if (p.numero) s += p.numero + rng.int(1, 3999);
  return { t: 's', v: formatarCidade(s, p) };
}
function valorBairro(p, rng) {
  var s = rng.chance(0.08) ? 'Centro' : rng.escolher(PREFIXOS_BAIRRO) + ' ' + rng.escolher(D.empresaBase.concat(D.sobrenomes));
  return { t: 's', v: formatarCidade(s, p) };
}

var GERADORES = {
  cpf: valorMascara, cnpj: valorMascara, cep: valorMascara, telefone: valorMascara, chave: valorMascara,
  email: valorEmail, pessoa: valorPessoa, empresa: valorEmpresa, codigo: valorCodigo, texto: valorTexto,
  cidade: valorCidade, uf: valorUF, endereco: valorEndereco, bairro: valorBairro
};

// Código num formato específico (usado quando uma lista curta define o formato do código).
function codigoComMascara(p, mascara, rng, ctx) {
  var modelo = (p.modelos || []).filter(function (m) { return m.m === mascara; })[0];
  if (!modelo) {
    modelo = { tokens: mascara.split('').map(function (ch) { return ch === '9' || ch === 'A' || ch === 'a' ? { k: ch } : { k: 'L', ch: ch }; }), n: 1 };
  }
  var q = { modelos: [modelo], zTexto: p.zTexto }, c;
  for (var t = 0; t < TENTATIVAS; t++) {
    c = valorCodigo(q, rng);
    if (!vazouTexto(ctx, c.v)) return c;
  }
  return c;
}

function vazou(p, cel, ctx) {
  if (cel.t === 's' && vazouTexto(ctx, cel.v)) return true;
  if (det().FAMILIA[p.tipo] === 'mascara' && p.reais && p.reais.has(chaveMascara(p, cel))) return true;
  return false;
}

function unico(p, rng, ctx) {
  var gerar = GERADORES[p.tipo], c;
  var livre = p.tipo === 'uf' && !lugares(ctx).ufsLivres.length; // todas as UFs já aparecem no original
  for (var t = 0; t < TENTATIVAS; t++) {
    c = gerar(p, rng, ctx);
    if (livre || !vazou(p, c, ctx)) return c;
  }
  if (c.t === 's' && p.tipo !== 'uf') c.v = c.v + ' ' + rng.int(100, 999);
  return c;
}

// Quantos valores diferentes aparecem ao sortear k linhas com as mesmas frequências do original.
function distintosEsperados(freqs, k) {
  if (!freqs || !freqs.length) return k;
  var n = 0, e = 0, i;
  for (i = 0; i < freqs.length; i++) n += freqs[i];
  for (i = 0; i < freqs.length; i++) e += 1 - Math.pow(1 - freqs[i] / n, k);
  return Math.max(1, Math.min(k, Math.round(e)));
}

// Imita o padrão de repetição: coluna que "sempre muda" sai sem repetição; coluna que "se repete"
// sai com poucos valores inventados repetidos na mesma proporção; valores em blocos saem agrupados.
function gerarComRepeticao(p, k, rng, ctx) {
  var qtd = distintosEsperados(p.freqs, k);
  if (p.tipo === 'uf') { var l = lugares(ctx); qtd = Math.min(qtd, (l.ufsLivres.length || l.ufsTodas.length)); }
  var valores = [], vistos = new Set(), tentativas = 0;
  while (valores.length < qtd && tentativas < qtd * 40 + 40) {
    tentativas++;
    var c = unico(p, rng, ctx);
    var chave = c.t + ':' + c.v;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    valores.push(c);
  }
  while (valores.length < qtd) valores.push(unico(p, rng, ctx));
  if (qtd >= k) return valores.slice(0, k);
  var pesos = p.freqs && p.freqs.length ? p.freqs.slice(0, qtd) : valores.map(function () { return 1; });
  var indices = U.distribuir(pesos, k, rng);
  if (p.blocos) indices.sort(function (a, b) { return a - b; });
  return indices.map(function (i) { return clonarCelula(valores[i]); });
}

function gerarCategorias(p, k, rng, ctx) {
  var celulas = p.pesos.map(function (_, i) {
    if (p.rotulosReais && p.opcoes && p.opcoes[i]) return clonarCelula(p.opcoes[i].cel);
    var r = 'Categoria ' + U.letraColuna(i);
    var c = { t: 's', v: vazouTexto(ctx, r) ? r + ' (fictícia)' : r };
    if (p.zTexto) c.z = p.zTexto;
    return c;
  });
  var indices = U.distribuir(p.pesos, k, rng);
  if (p.blocos) indices.sort(function (a, b) { return a - b; });
  return indices.map(function (i) { return clonarCelula(celulas[i]); });
}

function gerarSimNao(p, k, rng) {
  if (p.arm === 'nativo') {
    var fv = p.fracVerdadeiro;
    return U.distribuir([Math.round(fv * 1000), Math.round((1 - fv) * 1000)], k, rng).map(function (i) {
      return { t: 'b', v: i === 0 };
    });
  }
  return U.distribuir(p.tokens.map(function (t) { return t.n; }), k, rng).map(function (i) {
    var c = { t: 's', v: p.tokens[i].v };
    if (p.zTexto) c.z = p.zTexto;
    return c;
  });
}

function gerarValores(p, k, rng, ctx) {
  if (k <= 0) return [];
  var fam = det().FAMILIA[p.tipo];
  if (fam === 'numero') return gerarNumeros(p, k, rng, ctx);
  if (fam === 'data') return gerarTempos(p, k, rng, ctx);
  if (p.tipo === 'constante') {
    var fixos = [];
    for (var j = 0; j < k; j++) fixos.push(clonarCelula(p.cel));
    return fixos;
  }
  if (p.tipo === 'categoria') return gerarCategorias(p, k, rng, ctx);
  if (p.tipo === 'simnao') return gerarSimNao(p, k, rng);
  if (!GERADORES[p.tipo]) return [];
  return gerarComRepeticao(p, k, rng, ctx);
}

function copiaReal(col, i) {
  var src = col.valores[i % col.valores.length];
  if (!src) return null;
  var c = clonarCelula(src);
  if (col.data1904 && c.t === 'n') {
    var k = U.tipoDoFormato(c.z);
    if (k === 'data' || k === 'datahora') c.v += 1462;
  }
  return c;
}

// Gera n células para a coluna (null = célula vazia).
function gerarColuna(col, n, rng, ctx) {
  var saida = [], i;
  for (i = 0; i < n; i++) saida.push(null);
  if (col.manter) {
    if (!col.valores.length) return saida;
    for (i = 0; i < n; i++) saida[i] = copiaReal(col, i);
    return saida;
  }
  if (col.tipo === 'vazia') return saida;
  var p = det().perfil(col);
  var razao = col.tipoDetectado === 'vazia' ? 0 : col.razaoVazios;
  var vazios = razao >= 1 ? n : Math.min(n - 1, Math.floor(razao * n + rng.num()));
  if (vazios < 0) vazios = 0;
  var valores = gerarValores(p, n - vazios, rng, ctx);
  var posicoes = [];
  for (i = 0; i < n; i++) posicoes.push(i);
  rng.embaralhar(posicoes);
  var cheias = posicoes.slice(vazios).sort(function (a, b) { return a - b; });
  for (i = 0; i < cheias.length && i < valores.length; i++) saida[cheias[i]] = valores[i];
  return saida;
}

A.geradores = {
  gerarColuna: gerarColuna,
  gerarValores: gerarValores,
  cidadeDaUF: cidadeDaUF,
  formatarUF: formatarUF,
  codigoComMascara: codigoComMascara,
  sortearPorQuantis: sortearPorQuantis,
  arredondarTempo: arredondarTempo,
  clonarCelula: clonarCelula
};
