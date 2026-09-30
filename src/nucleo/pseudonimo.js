// Troca consistente de dados sensíveis (modo "arquivo inteiro"): cada valor real vira sempre o mesmo valor
// fictício, em todas as abas e colunas do mesmo tipo, e dois valores reais diferentes nunca viram o mesmo
// fictício (um-para-um). O fictício nunca é igual a um valor real do arquivo e é redesenhado no formato de
// cada ocorrência (máscara, maiúsculas/minúsculas, número de palavras).
//
// Os fictícios são sorteados por um gerador com semente aleatória a cada execução: não dependem do valor
// real, então não dá para descobrir o original testando palpites. O mapa fica só na memória.
import { A } from './amostra.js';

var U, D;
function iniciar() { U = A.util; D = A.dados; }

var MASCARA = { cpf: 11, cnpj: 14, cep: 8, chave: 44 };
var CLASSES = ['cpf', 'cnpj', 'cep', 'chave', 'telefone', 'email', 'pessoa', 'empresa', 'endereco', 'bairro', 'cidade', 'codigo', 'texto'];
var LOGRADOUROS = /^(rua|r|avenida|av|travessa|tv|alameda|al|rodovia|rod|estrada|est|praca|pca|largo|via|viela|beco|servidao|quadra|qd)\.?$/;

function textoDe(cel) { return cel.t === 'n' ? String(cel.v) : String(cel.v == null ? '' : cel.v); }
function soDigitos(s) { return s.replace(/\D/g, ''); }
function preencher(s, n) { while (s.length < n) s = '0' + s; return s; }
function tituloDe(s) { return s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, function (m, a, b) { return a + b.toUpperCase(); }).replace(/\b(Da|De|Do|Das|Dos|E)\b/g, function (m) { return m.toLowerCase(); }); }

// Chave de comparação: o mesmo valor escrito de jeitos diferentes (com/sem máscara, caixa, acento) é o mesmo.
function chave(classe, cel) {
  var s = textoDe(cel).trim();
  if (!s) return null;
  if (MASCARA[classe]) {
    var k = classe === 'cnpj' ? s.replace(/[^0-9A-Za-z]/g, '').toUpperCase() : soDigitos(s);
    if (cel.t === 'n') k = preencher(k, MASCARA[classe]);
    return k.length === MASCARA[classe] ? k : null; // fora do formato: tratado como código
  }
  if (classe === 'telefone') {
    var d = soDigitos(s);
    if (d.length >= 12 && d.slice(0, 2) === '55') d = d.slice(2);
    if (d.length === 11 && d.charAt(0) === '0') d = d.slice(1);
    return d.length >= 8 ? d : null;
  }
  if (classe === 'email') return s.toLowerCase();
  if (classe === 'codigo') return s.toUpperCase();
  return U.normalizar(s);
}

function criar(opcoes) {
  if (!U) iniciar();
  opcoes = opcoes || {};
  var rng = U.criarAleatorio(opcoes.semente);
  var reais = {};        // classe -> Set de chaves reais (o arquivo inteiro)
  var mapas = {};        // classe -> Map(chave real -> base fictícia)
  var usados = {};       // classe -> Set de chaves fictícias já usadas
  var contagem = {};     // classe -> { distintos, ocorrencias }
  var ctx = { textosReais: opcoes.textosReais || new Set() };
  var G = A.geradores;
  CLASSES.forEach(function (c) { reais[c] = new Set(); mapas[c] = new Map(); usados[c] = new Set(); contagem[c] = { distintos: 0, ocorrencias: 0 }; });

  var listas = null;
  function L() {
    if (listas) return listas;
    function unir(a, b) { var s = new Set((a || []).concat(b || [])); return Array.from(s); }
    listas = {
      masc: unir(D.nomesMasculinos, D.nomesMasculinosExtra),
      fem: unir(D.nomesFemininos, D.nomesFemininosExtra),
      sobrenomes: unir(D.sobrenomes, D.sobrenomesExtra),
      empBase: unir(D.empresaBase, D.empresaBaseExtra),
      empPrefixo: D.empresaPrefixoExtra || [],
      empRamo: D.empresaRamo
    };
    return listas;
  }

  function registrarReal(classe, cel) {
    var k = chave(classe, cel);
    if (k != null) reais[classe].add(k);
    else if (classe !== 'codigo') { var kc = chave('codigo', cel); if (kc) reais.codigo.add(kc); }
  }

  // Sorteia até achar um fictício livre (não usado e diferente de qualquer real). `gerar(tentativa)` devolve
  // { chave, base } e pode crescer com o número de tentativas (mais palavras, mais dígitos).
  function sortearLivre(classe, gerar) {
    for (var t = 0; t < 400; t++) {
      var r = gerar(t);
      if (!r) continue;
      if (usados[classe].has(r.chave) || reais[classe].has(r.chave)) continue;
      if (r.texto && G.vazouTexto(ctx, r.texto)) continue;
      usados[classe].add(r.chave);
      return r.base;
    }
    throw new Error('Não foi possível criar valores fictícios diferentes para todos os valores de ' + classe);
  }

  // ---------- bases fictícias por classe ----------
  function baseMascara(classe, k) {
    return sortearLivre(classe, function (t) {
      var s;
      if (classe === 'cpf') {
        var b; do { b = rng.digitos(9); } while (/^(\d)\1{8}$/.test(b));
        s = b + U.dvCpf(b);
      } else if (classe === 'cnpj') {
        var alnum = /[A-Z]/.test(k.slice(0, 12)), raiz = '';
        for (var i = 0; i < 8; i++) raiz += alnum && rng.chance(0.4) ? String.fromCharCode(65 + rng.int(0, 25)) : String(rng.int(0, 9));
        var filial = k.slice(8, 12) === '0001' || t > 50 ? '0001' : preencher(String(rng.int(2, 99)), 4);
        s = raiz + filial + U.dvCnpj(raiz + filial);
      } else if (classe === 'cep') {
        s = U.pad2(rng.int(1, 99)) + rng.digitos(6);
      } else { // chave de acesso NF-e/CT-e: mantém UF, ano/mês, modelo, série e tipo; troca emitente, número e código
        var cnpj = trocarChave('cnpj', k.slice(6, 20));
        var base43 = k.slice(0, 6) + cnpj + k.slice(20, 25) + rng.digitos(9) + k.charAt(34) + rng.digitos(8);
        s = base43 + U.dvChave(base43);
      }
      return { chave: s, base: s };
    });
  }

  function baseTelefone(k) {
    return sortearLivre('telefone', function () {
      var n = k.length, s;
      if (n >= 10) {
        var ddd = rng.escolher(D.ddds);
        s = ddd + (n === 11 ? '9' + rng.int(6, 9) + rng.digitos(7) : rng.int(2, 5) + rng.digitos(7));
        if (s.length < n) s += rng.digitos(n - s.length);
      } else {
        s = (n === 9 ? '9' + rng.int(6, 9) : String(rng.int(2, 5))) + rng.digitos(n - (n === 9 ? 2 : 1));
      }
      return { chave: s, base: s };
    });
  }

  function palavrasDoNome(n, t) {
    var l = L(), extra = Math.floor(t / 60); // se ficar difícil achar um livre, usa mais um sobrenome
    var partes = [rng.chance(0.5) ? rng.escolher(l.masc) : rng.escolher(l.fem)], vistos = {};
    while (partes.length < Math.min(6, Math.max(2, n) + extra)) {
      var s = rng.escolher(l.sobrenomes);
      if (vistos[s]) continue;
      vistos[s] = 1;
      partes.push(s);
    }
    return partes;
  }

  function baseTexto(classe, k, real) {
    return sortearLivre(classe, function (t) {
      var s, l = L();
      if (classe === 'pessoa') {
        var n = real.split(/\s+/).filter(function (w) { return !/^(da|de|do|das|dos|e)$/i.test(w); }).length;
        s = palavrasDoNome(n, t).join(' ');
      } else if (classe === 'empresa') {
        var partes = [];
        if (t > 20 || rng.chance(0.3)) partes.push(rng.escolher(l.empPrefixo));
        partes.push(rng.escolher(l.empBase), rng.escolher(l.empRamo));
        if (t > 200) partes.push(String(rng.int(2, 999)));
        s = partes.join(' ');
      } else if (classe === 'email') {
        var nome = U.semAcento(rng.escolher(rng.chance(0.5) ? l.masc : l.fem)).toLowerCase();
        var sob = U.semAcento(rng.escolher(l.sobrenomes)).toLowerCase();
        var num = t > 5 || rng.chance(0.35) ? String(rng.int(1, 999)) : '';
        s = nome + rng.escolher(['.', '_', '.', '']) + sob + num + '@' + rng.escolher(D.dominiosEmail);
        return { chave: s, base: s };
      } else if (classe === 'endereco') {
        var nomeRua = rng.chance(0.5) ? rng.escolher(l.masc.concat(l.fem)) + ' ' + rng.escolher(l.sobrenomes) : rng.escolher(l.empBase);
        s = nomeRua + (t > 30 ? ' ' + rng.escolher(l.sobrenomes) : '');
      } else if (classe === 'bairro') {
        s = rng.escolher(['Jardim', 'Vila', 'Parque', 'Residencial', 'Conjunto', 'Recanto', 'Chácara', 'Alto']) + ' ' +
          rng.escolher(l.empBase.concat(l.sobrenomes)) + (t > 30 ? ' ' + rng.escolher(l.sobrenomes) : '');
      } else { // texto livre: frase inventada de tamanho parecido
        var alvo = Math.max(4, real.length), palavras = [], tam = 0;
        while (!palavras.length || (tam < alvo - 2 && palavras.length < 80)) { var w = rng.escolher(D.palavras); palavras.push(w); tam += w.length + 1; }
        if (t > 30) palavras.push(String(rng.int(10, 9999)));
        s = palavras.join(' ');
        s = s.charAt(0).toUpperCase() + s.slice(1);
      }
      return { chave: U.normalizar(s), base: s, texto: s };
    });
  }

  function baseCidade(k, real) {
    var det = A.detectar, ufs = det.ufsDaCidade(real) || [];
    return sortearLivre('cidade', function (t) {
      var c = t < 60 && ufs.length ? G.cidadeDaUF({ caixa: 'misto' }, rng.escolher(ufs), rng, ctx) : null;
      var nome = c ? c.v : null;
      if (!nome) { var m = (D.municipios || [])[rng.int(0, (D.municipios || []).length - 1)]; nome = m ? m.nome : 'Cidade Fictícia ' + rng.int(1, 999); }
      if (t > 300) nome += ' ' + rng.int(2, 99);
      return { chave: U.normalizar(nome), base: nome };
    });
  }

  function baseCodigo(k, real, perfil) {
    var mascara = U.mascaraDe(real);
    var modelo = perfil && perfil.modelos ? perfil.modelos.filter(function (m) { return m.m === mascara; })[0] : null;
    var tokens = modelo ? modelo.tokens : mascara.split('').map(function (ch) { return ch === '9' || ch === 'A' || ch === 'a' ? { k: ch } : { k: 'L', ch: ch }; });
    return sortearLivre('codigo', function (t) {
      var s = '';
      for (var i = 0; i < tokens.length; i++) {
        var tk = tokens[i];
        if (tk.k === '9') s += rng.int(0, 9);
        else if (tk.k === 'A') s += String.fromCharCode(65 + rng.int(0, 25));
        else if (tk.k === 'a') s += String.fromCharCode(97 + rng.int(0, 25));
        else s += tk.ch;
      }
      if (t > 100) s += '-' + rng.int(10, 99); // formato esgotado: acrescenta um sufixo
      return { chave: s.toUpperCase(), base: s };
    });
  }

  // Base fictícia (sem formatação) para uma chave real; a mesma chave dá sempre a mesma base.
  function baseDe(classe, k, real, perfil) {
    var m = mapas[classe], b = m.get(k);
    if (b !== undefined) return b;
    if (MASCARA[classe]) b = baseMascara(classe, k);
    else if (classe === 'telefone') b = baseTelefone(k);
    else if (classe === 'cidade') b = baseCidade(k, real);
    else if (classe === 'codigo') b = baseCodigo(k, real, perfil);
    else b = baseTexto(classe, k, real);
    m.set(k, b);
    contagem[classe].distintos++;
    return b;
  }
  function trocarChave(classe, k) { return baseDe(classe, k, k, null); }

  // ---------- desenho no formato da ocorrência ----------
  function caixaDe(s) {
    var e = U.estiloCaixa([s]);
    if (e !== 'misto') return e;
    return /\p{Lu}/u.test(s.charAt(0)) ? 'titulo' : 'misto';
  }
  function aplicarCaixa(s, estilo) {
    if (estilo === 'maiusculo') return s.toUpperCase();
    if (estilo === 'minusculo') return s.toLowerCase();
    if (estilo === 'titulo') return tituloDe(s);
    return s;
  }
  function comoOriginal(real, fict) {
    var s = /[À-ÿ]/.test(real) ? fict : (/[À-ÿ]/.test(fict) && /[A-Za-z]/.test(real) && !/[À-ÿ]/.test(real) ? U.semAcento(fict) : fict);
    return aplicarCaixa(s, caixaDe(real));
  }
  function celulaTexto(cel, v) {
    var c = { t: 's', v: v };
    if (cel.z) c.z = cel.z;
    return c;
  }

  function desenhar(classe, cel, real, base) {
    if (MASCARA[classe] || classe === 'telefone') {
      if (cel.t === 'n') { var o = { t: 'n', v: Number(soDigitos(base)) }; if (cel.z) o.z = cel.z; return o; }
      var chars = base;
      if (classe === 'telefone') {
        var d = soDigitos(real), prefixo = '';
        if (d.length >= 12 && d.slice(0, 2) === '55') { prefixo = '55'; d = d.slice(2); }
        if (d.length === 11 && d.charAt(0) === '0') prefixo += '0';
        chars = prefixo + base;
      }
      var mascara = U.mascaraDe(real), pos = U.contarPosicoes(mascara);
      if (pos !== chars.length) return celulaTexto(cel, chars);
      return celulaTexto(cel, U.preencherMascara(mascara, classe === 'cnpj' ? chars : chars));
    }
    if (classe === 'email') return celulaTexto(cel, real === real.toUpperCase() ? base.toUpperCase() : base);
    if (classe === 'codigo') return celulaTexto(cel, base);
    if (classe === 'empresa') {
      var suf = /(^|\s)(ltda\.?|s\.?\/?a\.?|me|eireli|epp)$/i.exec(real.trim());
      return celulaTexto(cel, comoOriginal(real, base + (suf ? ' ' + suf[2] : '')));
    }
    if (classe === 'endereco') {
      var primeira = /^\s*([A-Za-zÀ-ÿ]+\.?)\s/.exec(real);
      var inicio = primeira && LOGRADOUROS.test(U.normalizar(primeira[1]).replace(/\.$/, '')) ? primeira[1] : 'Rua';
      var numero = /\d/.test(real) ? ', ' + (1 + (Math.abs(hashTexto(base)) % 3999)) : '';
      return celulaTexto(cel, comoOriginal(real, inicio + ' ' + base + numero));
    }
    return celulaTexto(cel, comoOriginal(real, base));
  }
  function hashTexto(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

  // Troca uma célula. `perfil` (opcional) é o perfil da coluna (modelos de código). Célula vazia fica vazia.
  function trocar(classe, cel, perfil) {
    if (!cel || cel.v == null || textoDe(cel).trim() === '') return cel;
    var real = textoDe(cel), k = chave(classe, cel), c = classe;
    if (k == null) { c = 'codigo'; k = chave('codigo', cel); } // CPF com dígitos a menos etc.: troca como código
    contagem[c].ocorrencias++;
    return desenhar(c, cel, real, baseDe(c, k, real, perfil));
  }

  return {
    registrarReal: registrarReal,
    trocar: trocar,
    estatisticas: function () {
      var r = {};
      CLASSES.forEach(function (c) { if (contagem[c].ocorrencias) r[c] = { distintos: contagem[c].distintos, ocorrencias: contagem[c].ocorrencias }; });
      return r;
    }
  };
}

A.pseudonimo = { criar: criar, chave: function (classe, cel) { if (!U) iniciar(); return chave(classe, cel); }, CLASSES: CLASSES };
