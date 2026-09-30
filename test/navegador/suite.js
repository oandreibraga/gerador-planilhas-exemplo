// Suíte de testes que roda na página dist/testes.html (navegador de verdade ou jsdom).
import { semAcentoT, igual, pct, log10, chaveN, quadro, dvChaveT, cpfValidoT } from '../fixtures/auxiliares.js';
import { fixtures, redefinirFixtures } from '../fixtures/definicoes.js';
var A = window.Amostra || {};
var SEMENTES = [11, 22, 33];
var ISENTOS = new Set(['Sim', 'Não', 'S', 'N']);

// Conta chamadas de XLSX.read para provar que trocar tipo/quantidade não relê o arquivo.
var chamadasRead = 0;
if (window.XLSX) {
  var readOriginal = XLSX.read;
  XLSX.read = function () { chamadasRead++; return readOriginal.apply(this, arguments); };
}

// ================= registro de resultados =================
var resultados = [];
var grupoAtual = '';
function reg(status, nome, detalhe) {
  resultados.push({ grupo: grupoAtual, nome: nome, status: status, detalhe: detalhe || '' });
}
function checar(nome, cond, detalhe) {
  reg(cond ? 'ok' : 'falhou', nome, cond ? '' : (typeof detalhe === 'function' ? detalhe() : detalhe));
  return !!cond;
}
function avisar(nome, detalhe) { reg('aviso', nome, detalhe); }
function info(nome, detalhe) { reg('info', nome, detalhe); }
function msgErro(e) {
  var s = (e && e.message) || String(e);
  var pilha = e && e.stack ? String(e.stack).split('\n').slice(1, 4).map(function (l) {
    return l.trim().replace(/file:\/\/\/[^\s)]*\/([^\/\s)]+)/g, '$1');
  }).join(' | ') : '';
  return s + (pilha ? ' [' + pilha + ']' : '');
}
function agregador() {
  var falhas = {}, ordem = [];
  return {
    conferir: function (nome, cond, detalhe) {
      if (!(nome in falhas)) { falhas[nome] = []; ordem.push(nome); }
      if (!cond) falhas[nome].push(typeof detalhe === 'function' ? detalhe() : detalhe);
    },
    registrar: function () {
      ordem.forEach(function (nome) {
        var f = falhas[nome];
        reg(f.length ? 'falhou' : 'ok', nome, f.length ? f.slice(0, 4).join(' || ') + (f.length > 4 ? ' (+' + (f.length - 4) + ' ocorrências)' : '') : '');
      });
    }
  };
}

// ================= utilitários independentes do código testado =================
// ================= conjuntos de valores reais (para provar que nada vaza) =================
function linhasAmostra(a, dc) { return a.amostra ? dc.valores.slice(0, a.amostra) : dc.valores; }
function conjuntoReal(a, dc) {
  if (dc._reais) return dc._reais;
  var nums = new Set(), strs = new Set();
  linhasAmostra(a, dc).forEach(function (v) {
    if (typeof v === 'number') nums.add(chaveN(v));
    else if (typeof v === 'string') strs.add(v.trim());
  });
  (dc.reaisNum || []).forEach(function (v) { nums.add(chaveN(v)); });
  dc._reais = { nums: nums, strs: strs };
  return dc._reais;
}
function textosReaisGlobais(def) {
  if (def._globais) return def._globais;
  var set = new Set();
  def.abas.forEach(function (a) {
    (a.acima || []).forEach(function (l) { l.forEach(function (v) { if (typeof v === 'string') set.add(v.trim()); }); });
    (a.colunas || []).forEach(function (dc) {
      linhasAmostra(a, dc).forEach(function (v) { if (typeof v === 'string') set.add(v.trim()); });
    });
  });
  def._globais = set;
  return set;
}
function valoresReaisLongos(def) {
  var cabs = new Set();
  def.abas.forEach(function (a) { cabs.add(a.nome); (a.colunas || []).forEach(function (dc) { cabs.add(dc.nome); }); });
  var out = [];
  def.abas.forEach(function (a) {
    (a.acima || []).forEach(function (l) { l.forEach(function (v) { if (typeof v === 'string' && v.length >= 5) out.push(v); }); });
    (a.colunas || []).forEach(function (dc) {
      if (dc.esp && (dc.esp.tipo === 'categoria' || dc.esp.tipo === 'constante')) return;
      dc.valores.forEach(function (v) { if (typeof v === 'string' && v.trim().length >= 5 && !cabs.has(v)) out.push(v.trim()); });
    });
  });
  return Array.from(new Set(out));
}
function frequenciasReais(a, dc) {
  var cont = {}, tot = 0;
  linhasAmostra(a, dc).slice(0, 500).forEach(function (v) { if (v != null) { cont[v] = (cont[v] || 0) + 1; tot++; } });
  return Object.keys(cont).map(function (k) { return { v: k, q: cont[k] / tot }; }).sort(function (x, y) { return y.q - x.q; });
}
function razaoVaziosReal(a, dc) {
  var amostra = linhasAmostra(a, dc).slice(0, 500);
  return amostra.filter(function (v) { return v == null; }).length / amostra.length;
}

// ================= conferência de um arquivo gerado =================
function conferirSaida(def, wb, n, ag, opts) {
  opts = opts || {};
  var rot = opts.rotulo || '';
  ag.conferir('abas com os mesmos nomes, na mesma ordem', igual(wb.SheetNames, def.abas.map(function (a) { return a.nome; })),
    function () { return rot + ' gerado: ' + wb.SheetNames.join(', '); });
  var infoAbas = (wb.Workbook && wb.Workbook.Sheets) || [];
  ag.conferir('aba oculta continua oculta (e as visíveis, visíveis)', def.abas.every(function (a, i) {
    return (+((infoAbas[i] || {}).Hidden) || 0) === (a.oculta || 0);
  }), function () { return rot + ' Hidden gerado: ' + infoAbas.map(function (s) { return s.Hidden; }).join(','); });

  def.abas.forEach(function (a) {
    var ws = wb.Sheets[a.nome];
    if (!ws) { ag.conferir('todas as abas presentes', false, rot + ' faltou "' + a.nome + '"'); return; }
    if (a.cab < 0) {
      ag.conferir('aba vazia continua vazia', Object.keys(ws).filter(function (k) { return k.charAt(0) !== '!'; }).length === 0, rot + ' "' + a.nome + '" tem células');
      return;
    }
    var ref = XLSX.utils.decode_range(ws['!ref']);
    ag.conferir('linhas de dados = quantidade escolhida (10/20/30)', ref.e.r === a.cab + n,
      function () { return rot + ' "' + a.nome + '": última linha ' + (ref.e.r + 1) + ', esperado ' + (a.cab + n + 1); });

    var errosCab = [];
    a.colunas.forEach(function (dc, j) {
      var end = XLSX.utils.encode_cell({ r: a.cab, c: (a.colInicio || 0) + j });
      var cel = ws[end];
      if (!cel || cel.t !== 's' || cel.v !== dc.nome) errosCab.push(end + '=' + (cel ? JSON.stringify(cel.v) : 'vazio') + ' (esperado ' + JSON.stringify(dc.nome) + ')');
    });
    ag.conferir('cabeçalho na mesma linha e coluna, com o texto idêntico (acentos, espaços, maiúsculas)', !errosCab.length,
      function () { return rot + ' "' + a.nome + '": ' + errosCab.slice(0, 3).join(', '); });

    var errosAcima = [];
    for (var r = 0; r < a.cab; r++) {
      var linha = (a.acima || [])[r] || [];
      var cMax = Math.max(ref.e.c, linha.length - 1);
      for (var c = 0; c <= cMax; c++) {
        var end2 = XLSX.utils.encode_cell({ r: r, c: c });
        var cel2 = ws[end2];
        var temOriginal = linha[c] != null;
        if (temOriginal && !(cel2 && (cel2.v === A.saida.TITULO || cel2.v === A.saida.INFO))) errosAcima.push(end2 + '=' + (cel2 ? JSON.stringify(cel2.v) : 'vazio'));
        if (!temOriginal && cel2) errosAcima.push(end2 + ' deveria estar vazia');
      }
    }
    if (a.cab > 0) {
      ag.conferir('linhas acima do cabeçalho com texto genérico nas mesmas posições', !errosAcima.length,
        function () { return rot + ' "' + a.nome + '": ' + errosAcima.slice(0, 3).join(', '); });
    }
    if (a.merges) {
      var gerados = (ws['!merges'] || []).map(XLSX.utils.encode_range);
      var faltam = a.merges.map(XLSX.utils.encode_range).filter(function (m) { return gerados.indexOf(m) < 0; });
      ag.conferir('título mesclado acima do cabeçalho continua mesclado', !faltam.length, function () { return rot + ' "' + a.nome + '": faltou ' + faltam.join(', '); });
    }

    var linhasGeradas = [];
    for (var li = 0; li < n; li++) {
      linhasGeradas.push(a.colunas.map(function (_, jj) { return ws[XLSX.utils.encode_cell({ r: a.cab + 1 + li, c: (a.colInicio || 0) + jj })] || null; }));
    }
    if (a.igualdade) {
      var ig = a.igualdade, ambos = 0, iguais = 0;
      linhasGeradas.forEach(function (l) { if (l[ig.base] && l[ig.dep]) { ambos++; if (l[ig.base].v === l[ig.dep].v) iguais++; } });
      ag.conferir('colunas iguais na mesma linha mantêm a proporção do original (ex.: origem = destino)', ambos && Math.abs(iguais / ambos - ig.taxa) <= 0.25,
        function () { return rot + ' "' + a.nome + '": gerado ' + pct(iguais / (ambos || 1)) + ', original ' + pct(ig.taxa); });
    }
    a.colunas.forEach(function (dc, j) {
      var cels = linhasGeradas.map(function (l) { return l[j]; });
      if (opts.manter && opts.manter[a.nome + '|' + dc.nome]) {
        var amostra = linhasAmostra(a, dc);
        var difs = [];
        for (var k = 0; k < n; k++) {
          var esperado = amostra[k % amostra.length];
          var veio = cels[k] ? cels[k].v : null;
          if (esperado !== veio) difs.push('linha ' + (k + 1) + ': esperado ' + JSON.stringify(esperado) + ', veio ' + JSON.stringify(veio));
        }
        ag.conferir('coluna marcada "manter valores reais" copia os valores reais, na ordem', !difs.length, function () { return rot + ' ' + difs.slice(0, 2).join('; '); });
        return;
      }
      conferirColuna(a, dc, cels, n, ag, rot, linhasGeradas);
      conferirPrivacidade(a, dc, cels, ag, rot);
    });
  });
  conferirPrivacidadeGlobal(def, wb, ag, rot, opts);
}

function conferirColuna(a, dc, cels, n, ag, rot, linhasGeradas) {
  var s = dc.saida, nome = '"' + a.nome + '" › "' + dc.nome + '"';
  var cheias = cels.filter(Boolean);
  if (s.vazia) {
    ag.conferir('coluna totalmente vazia continua vazia', !cheias.length, rot + ' ' + nome + ' tem ' + cheias.length + ' células');
    return;
  }
  var realVaz = razaoVaziosReal(a, dc), genVaz = 1 - cheias.length / n;
  ag.conferir('proporção de células vazias parecida com o original', Math.abs(genVaz - realVaz) <= 0.1 + 1 / n,
    function () { return rot + ' ' + nome + ': original ' + pct(realVaz) + ', gerado ' + pct(genVaz); });
  if (!cheias.length) return;
  function primeiro(lista, fn) { return lista.filter(fn)[0]; }
  var tRuim = primeiro(cheias, function (c) { return c.t !== s.t; });
  ag.conferir('tipo real da célula preservado (data, número, texto, booleano)', !tRuim,
    function () { return rot + ' ' + nome + ': esperado t=' + s.t + ', veio t=' + tRuim.t + ' ' + JSON.stringify(tRuim.v); });
  if (s.z) {
    var zRuim = primeiro(cheias, function (c) { return c.z !== s.z; });
    ag.conferir('formato de exibição igual ao original (casas, data, moeda, %)', !zRuim,
      function () { return rot + ' ' + nome + ': esperado ' + s.z + ', veio ' + zRuim.z; });
  }
  if (s.re) {
    var reRuim = primeiro(cheias, function (c) { return !s.re.test(String(c.v)); });
    ag.conferir('mesmo padrão/máscara do original', !reRuim, function () { return rot + ' ' + nome + ': ' + JSON.stringify(reRuim.v); });
  }
  if (s.valida) {
    var vRuim = primeiro(cheias, function (c) { return !s.valida(String(c.v)); });
    ag.conferir('CPF, CNPJ e datas gerados são válidos', !vRuim, function () { return rot + ' ' + nome + ': ' + JSON.stringify(vRuim.v); });
  }
  if (s.casas != null) {
    var f = Math.pow(10, s.casas);
    var cRuim = primeiro(cheias, function (c) { return Math.abs(c.v * f - Math.round(c.v * f)) > 1e-6; });
    ag.conferir('mesmas casas decimais do original', !cRuim, function () { return rot + ' ' + nome + ': ' + cRuim.v + ' (esperado ' + s.casas + ' casas)'; });
  }
  if (s.inteiro) {
    var iRuim = primeiro(cheias, function (c) { return Math.floor(c.v) !== c.v; });
    ag.conferir('números inteiros continuam inteiros', !iRuim, function () { return rot + ' ' + nome + ': ' + iRuim.v; });
  }
  if (s.grandeza) {
    var lo = Math.floor(log10(s.grandeza[0])) - 1, hi = Math.floor(log10(s.grandeza[1])) + 1;
    var gRuim = primeiro(cheias, function (c) { var e = Math.floor(log10(Math.abs(c.v))); return e < lo || e > hi; });
    ag.conferir('mesma ordem de grandeza do original', !gRuim, function () { return rot + ' ' + nome + ': ' + gRuim.v + ' fora de ' + s.grandeza.join('–'); });
  }
  if (s.entre) {
    var eRuim = primeiro(cheias, function (c) { return c.v < s.entre[0] || c.v >= s.entre[1]; });
    ag.conferir('valores dentro da faixa válida (hora < 1 dia, % entre 0 e 100%)', !eRuim, function () { return rot + ' ' + nome + ': ' + eRuim.v; });
  }
  if (s.data) {
    var dRuim = primeiro(cheias, function (c) { return !(c.v >= 1 && c.v < 2958466); });
    ag.conferir('datas são datas válidas do Excel', !dRuim, function () { return rot + ' ' + nome + ': ' + dRuim.v; });
  }
  if (s.ordem === 'asc') {
    var desord = cheias.some(function (c, i) { return i > 0 && c.v < cheias[i - 1].v; });
    ag.conferir('coluna em ordem crescente continua em ordem', !desord, rot + ' ' + nome);
  }
  if (s.acimaDe != null) {
    var sRuim = primeiro(cheias, function (c) { return !(c.v > s.acimaDe); });
    ag.conferir('código sequencial continua a sequência depois do maior valor real', !sRuim, function () { return rot + ' ' + nome + ': ' + sRuim.v; });
  }
  if (s.maiusculo) {
    var mRuim = primeiro(cheias, function (c) { return c.v !== String(c.v).toUpperCase(); });
    ag.conferir('texto em MAIÚSCULAS continua em maiúsculas', !mRuim, function () { return rot + ' ' + nome + ': ' + mRuim.v; });
  }
  if (s.log && n >= 20) {
    var ordens = new Set(cheias.map(function (c) { return Math.floor(log10(Math.abs(c.v))); }));
    ag.conferir('faixa larga sorteada em escala logarítmica (várias ordens de grandeza)', ordens.size >= 3,
      function () { return rot + ' ' + nome + ': só ' + ordens.size + ' ordem(ns) de grandeza'; });
  }
  if (s.sinais && n >= 20) {
    var neg = cheias.some(function (c) { return c.v < 0; }), pos = cheias.some(function (c) { return c.v > 0; });
    ag.conferir('coluna com positivos e negativos mantém os dois sinais', neg && pos, rot + ' ' + nome);
  }
  if (s.cat) conferirCategoria(a, dc, cheias, ag, rot, nome);
  if (s.simnao) conferirSimNao(a, dc, cheias, ag, rot, nome);
  if (s.cidade || s.uf || s.ufDe != null || s.fixo !== undefined) conferirLugares(a, dc, cheias, ag, rot, nome, linhasGeradas);
  if (s.chave || s.depoisDe != null || s.conta || s.formatoDe) conferirLigacoesDaLinha(a, dc, cheias, ag, rot, nome, linhasGeradas);
}

function conferirLigacoesDaLinha(a, dc, cheias, ag, rot, nome, linhas) {
  var s = dc.saida, j = a.colunas.indexOf(dc), erros;
  if (s.chave) {
    var ruim = cheias.filter(function (c) { var d = String(c.v); return !/^\d{44}$/.test(d) || dvChaveT(d.slice(0, 43)) !== d.charAt(43) || d.slice(20, 22) !== s.chave; })[0];
    ag.conferir('chave de acesso com 44 dígitos, dígito verificador válido e o mesmo modelo (CT-e = 57)', !ruim, function () { return rot + ' ' + nome + ': ' + ruim.v; });
  }
  if (s.depoisDe != null) {
    erros = linhas.filter(function (l) { return l[j] && l[s.depoisDe] && l[j].v < l[s.depoisDe].v; });
    ag.conferir('data que vem depois de outra continua depois (ex.: entrega depois da emissão)', !erros.length,
      function () { return rot + ' ' + nome + ': ' + erros.length + ' linhas fora de ordem'; });
  }
  if (s.conta) {
    var op = s.conta[0], ia = s.conta[1], ib = s.conta[2];
    erros = linhas.filter(function (l) {
      if (!l[j] || !l[ia] || !l[ib]) return false;
      var esperado = op === 'produto' ? l[ia].v * l[ib].v : op === 'soma' ? l[ia].v + l[ib].v : l[ia].v - l[ib].v;
      return Math.abs(esperado - l[j].v) > 0.0051;
    });
    ag.conferir('coluna que é conta de outras continua batendo (total = qtd × preço, total = frete + ICMS)', !erros.length,
      function () { var l = erros[0]; return rot + ' ' + nome + ': ' + l[ia].v + (op === 'produto' ? ' × ' : ' + ') + l[ib].v + ' ≠ ' + l[j].v; });
  }
  if (s.formatoDe) {
    erros = linhas.filter(function (l) {
      if (!l[j] || !l[s.formatoDe.cat]) return false;
      var re = s.formatoDe.mapa[l[s.formatoDe.cat].v];
      return re && !re.test(l[j].v);
    });
    ag.conferir('formato do código segue a opção da mesma linha (ex.: MINUTA → MIN-0000)', !erros.length,
      function () { var l = erros[0]; return rot + ' ' + nome + ': ' + l[s.formatoDe.cat].v + ' → ' + l[j].v; });
  }
}

// Valores que podem (por decisão) coincidir com o original: listas curtas, valor fixo, UF ligada a cidade e zero.
function isentoDePrivacidade(dc) {
  return dc.esp.tipo === 'categoria' || dc.esp.tipo === 'constante' || (dc.esp.tipo === 'uf' && dc.saida.ufDe != null);
}

function conferirCategoria(a, dc, cheias, ag, rot, nome) {
  var real = frequenciasReais(a, dc);
  var rotulosReais = real.map(function (x) { return x.v; });
  var ruim = cheias.filter(function (c) { return rotulosReais.indexOf(String(c.v)) < 0; })[0];
  ag.conferir('listas curtas mantêm os rótulos reais das opções', !ruim, function () { return rot + ' ' + nome + ': ' + JSON.stringify(ruim.v); });
  var cont = {};
  cheias.forEach(function (c) { cont[String(c.v)] = (cont[String(c.v)] || 0) + 1; });
  var topo = (cont[real[0].v] || 0) / cheias.length;
  ag.conferir('opções da lista repetem com frequência parecida com o original', Math.abs(topo - real[0].q) <= 0.15,
    function () { return rot + ' ' + nome + ': gerado ' + JSON.stringify(cont) + '; original mais frequente ' + real[0].v + ' ' + pct(real[0].q); });
}

var cidadesIBGE = null;
function lugarT(s) { return semAcentoT(String(s)).toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function ufsDe(nome) {
  if (!cidadesIBGE) {
    cidadesIBGE = new Map();
    A.dados.municipios.forEach(function (m) { var k = lugarT(m.nome); (cidadesIBGE.get(k) || cidadesIBGE.set(k, []).get(k)).push(m.uf); });
  }
  return cidadesIBGE.get(lugarT(nome)) || null;
}
function conferirLugares(a, dc, cheias, ag, rot, nome, linhasGeradas) {
  var s = dc.saida;
  if (s.cidade) {
    var originais = new Set();
    a.colunas.forEach(function (x) { if (x.esp.tipo === 'cidade') x.valores.forEach(function (v) { if (v) originais.add(lugarT(v)); }); });
    var ruim = cheias.filter(function (c) { return !ufsDe(c.v) || originais.has(lugarT(c.v)); })[0];
    ag.conferir('cidades reais do IBGE, nenhuma que já estava no original', !ruim,
      function () { return rot + ' ' + nome + ': ' + JSON.stringify(ruim.v) + (ufsDe(ruim.v) ? ' está no original' : ' não é município'); });
  }
  if (s.uf) {
    var ufsOrig = new Set(dc.valores.filter(Boolean));
    var r2 = cheias.filter(function (c) { return !A.dados.ufs.some(function (u) { return u.sigla === c.v; }) || ufsOrig.has(c.v); })[0];
    ag.conferir('UF sem cidade ligada: siglas reais que não estavam no original', !r2, function () { return rot + ' ' + nome + ': ' + JSON.stringify(r2.v); });
  }
  if (s.ufDe != null) {
    var erros = [];
    linhasGeradas.forEach(function (lin) {
      var cid = lin[s.ufDe], uf = lin[a.colunas.indexOf(dc)];
      if (cid && uf) {
        var sigla = String(uf.v).length === 2 ? uf.v : (A.dados.ufs.filter(function (u) { return lugarT(u.nome) === lugarT(uf.v); })[0] || {}).sigla;
        var l = ufsDe(cid.v);
        if (!l || l.indexOf(sigla) < 0) erros.push(cid.v + '/' + uf.v);
      }
    });
    ag.conferir('UF compatível com a cidade da mesma linha', !erros.length, function () { return rot + ' ' + nome + ': ' + erros.slice(0, 3).join(', '); });
  }
  if (s.fixo !== undefined) {
    ag.conferir('coluna com valor fixo continua com o mesmo valor', cheias.every(function (c) { return c.v === s.fixo; }), rot + ' ' + nome);
  }
}

function conferirSimNao(a, dc, cheias, ag, rot, nome) {
  var real = frequenciasReais(a, dc);
  var tokens = real.map(function (x) { return x.v; });
  var ruim = cheias.filter(function (c) { return tokens.indexOf(c.v) < 0; })[0];
  var topo = cheias.filter(function (c) { return c.v === real[0].v; }).length / cheias.length;
  ag.conferir('sim/não usa os mesmos rótulos, em proporção parecida', !ruim && Math.abs(topo - real[0].q) <= 0.15,
    function () { return rot + ' ' + nome + ': ' + (ruim ? 'rótulo ' + JSON.stringify(ruim.v) : pct(topo) + ' vs ' + pct(real[0].q)); });
}

function conferirPrivacidade(a, dc, cels, ag, rot) {
  if (isentoDePrivacidade(dc)) return;
  var reais = conjuntoReal(a, dc), vazados = [];
  cels.forEach(function (c) {
    if (!c || c.v === 0) return;
    if (c.t === 'n' && reais.nums.has(chaveN(c.v))) vazados.push(c.v);
    if (c.t === 's' && !ISENTOS.has(c.v) && reais.strs.has(String(c.v).trim())) vazados.push(c.v);
  });
  ag.conferir('nenhum valor real copiado para a coluna', !vazados.length,
    function () { return rot + ' "' + a.nome + '" › "' + dc.nome + '": ' + vazados.slice(0, 3).map(function (v) { return JSON.stringify(v); }).join(', '); });
}

function conferirPrivacidadeGlobal(def, wb, ag, rot, opts) {
  var reais = textosReaisGlobais(def), vazados = [];
  def.abas.forEach(function (a) {
    var ws = wb.Sheets[a.nome];
    if (!ws) return;
    Object.keys(ws).forEach(function (k) {
      if (k.charAt(0) === '!') return;
      var end = XLSX.utils.decode_cell(k);
      if (end.r === a.cab) return;
      var j = end.c - (a.colInicio || 0);
      var dc = a.colunas && a.colunas[j];
      if (dc && opts.manter && opts.manter[a.nome + '|' + dc.nome]) return;
      if (dc && isentoDePrivacidade(dc)) return;
      var c = ws[k];
      if (c.t !== 's' || ISENTOS.has(c.v)) return;
      var v = String(c.v).trim();
      if (v.length >= 4 && reais.has(v)) vazados.push(a.nome + '!' + k + '=' + JSON.stringify(v));
    });
  });
  ag.conferir('nenhum texto real (de nenhuma aba, nem do título) aparece no arquivo gerado', !vazados.length,
    function () { return rot + ' ' + vazados.slice(0, 3).join(', '); });
}

// ================= grupos de teste =================
function testarCarga() {
  checar('scripts carregados sem erro', !window.__errosCarga.length, window.__errosCarga.join(' | '));
  checar('SheetJS 0.20.3 disponível localmente', !!window.XLSX && XLSX.version === '0.20.3', window.XLSX ? XLSX.version : 'ausente');
  var faltando = ['dados', 'util', 'detectar', 'leitura', 'geradores', 'saida', 'resumo', 'app'].filter(function (m) { return !A[m]; });
  checar('módulos do gerador carregados', !faltando.length, 'faltando: ' + faltando.join(', '));
  return !faltando.length && !!window.XLSX;
}

function testarUtilitarios() {
  var U = A.util;
  var casos = [
    ['CPF válido aceito', U.cpfValido('52998224725')],
    ['CPF inválido recusado', !U.cpfValido('52998224724') && !U.cpfValido('11111111111')],
    ['CNPJ válido aceito', U.cnpjValido('11222333000181')],
    ['CNPJ alfanumérico válido aceito', U.cnpjValido('12ABC34501DE35')],
    ['número "R$ 1.234,56"', (function () { var x = U.lerNumeroTexto('R$ 1.234,56'); return x && x.valor === 1234.56 && x.prefixo === 'R$ ' && x.casas === 2; })()],
    ['número "12,5%"', (function () { var x = U.lerNumeroTexto('12,5%'); return x && x.valor === 12.5 && x.sufixo === '%'; })()],
    ['número "-3,75"', (function () { var x = U.lerNumeroTexto('-3,75'); return x && x.valor === -3.75; })()],
    ['"004512" tem zero à esquerda', U.lerNumeroTexto('004512').zeroEsquerda === true],
    ['formatar 1234.5 como "1.234,50"', U.formatarNumeroTexto(1234.5, { prefixo: '', sufixo: '', dec: ',', milhar: '.', casas: 2, sinalAntes: false }) === '1.234,50'],
    ['data "15/03/2024" (dia/mês/ano)', igual(U.interpretarData(U.lerDataTexto('15/03/2024').partes, 'dmy'), { y: 2024, m: 3, d: 15 })],
    ['data serial ida e volta', (function () { var s = U.serialDeData(2024, 2, 29); var p = U.partesDeSerial(s); return s === 45351 && p.d === 29 && p.m === 2; })()],
    ['formato "dd/mm/yyyy" é data', U.tipoDoFormato('dd/mm/yyyy') === 'data'],
    ['formato "[$-416]dd/mm/yyyy hh:mm" é data e hora', U.tipoDoFormato('[$-416]dd/mm/yyyy hh:mm') === 'datahora'],
    ['formato "[h]:mm:ss" é hora', U.tipoDoFormato('[h]:mm:ss') === 'hora'],
    ['formato "_-\\"R$\\"* #,##0.00_-" é moeda', U.tipoDoFormato('_-"R$"* #,##0.00_-;-"R$"* #,##0.00_-') === 'moeda'],
    ['formato "0.0%" é percentual com 1 casa', U.tipoDoFormato('0.0%') === 'percentual' && U.casasDoFormato('0.0%') === 1],
    ['formato "#,##0.000" tem 3 casas', U.casasDoFormato('#,##0.000') === 3],
    ['máscara de "PED-004512"', U.mascaraDe('PED-004512') === 'AAA-999999']
  ];
  var ruins = casos.filter(function (c) { return !c[1]; }).map(function (c) { return c[0]; });
  checar('funções básicas (CPF/CNPJ, números e datas em texto, formatos do Excel): ' + casos.length + ' casos', !ruins.length, 'falharam: ' + ruins.join('; '));
}

function testarLeituraXlsx(fx) {
  var def = fx.vendas;
  var cont0 = A.leitura.contador, reads0 = chamadasRead;
  var t0 = performance.now();
  var arq = A.leitura.abrir({ nome: def.nome, bytes: def.bytes });
  A.detectar.analisarArquivo(arq);
  var ms = performance.now() - t0;
  checar('arquivo lido uma única vez', A.leitura.contador === cont0 + 1 && chamadasRead === reads0 + 1,
    'leitura.abrir: ' + (A.leitura.contador - cont0) + ', XLSX.read: ' + (chamadasRead - reads0));
  checar('nomes e ordem das abas', igual(arq.abas.map(function (a) { return a.nome; }), def.abas.map(function (a) { return a.nome; })),
    function () { return arq.abas.map(function (a) { return a.nome; }).join(', '); });
  checar('aba oculta reconhecida', arq.abas.every(function (a, i) { return !!a.oculta === !!def.abas[i].oculta; }),
    function () { return arq.abas.map(function (a) { return a.nome + '=' + a.oculta; }).join(', '); });
  def.abas.forEach(function (d, i) {
    var aba = arq.abas[i];
    if (!aba) return;
    checar('aba "' + d.nome + '": cabeçalho ' + (d.cab < 0 ? 'inexistente (aba vazia)' : 'na linha ' + (d.cab + 1)), aba.linhaCab === d.cab, 'detectado: ' + (aba.linhaCab + 1));
    if (d.cab < 0 || aba.linhaCab !== d.cab) return;
    var nomes = aba.colunas.map(function (c) { return c.nome; });
    checar('aba "' + d.nome + '": nomes e ordem das colunas idênticos', igual(nomes, d.colunas.map(function (c) { return c.nome; })),
      function () { return 'detectado: ' + JSON.stringify(nomes); });
    checar('aba "' + d.nome + '": primeira coluna na posição original (' + A.util.letraColuna(d.colInicio || 0) + ')', aba.cMin === (d.colInicio || 0), 'detectado: ' + A.util.letraColuna(aba.cMin));
    var erros = [];
    d.colunas.forEach(function (dc, j) {
      var col = aba.colunas[j];
      if (!col) return;
      if (col.tipoDetectado !== dc.esp.tipo || (dc.esp.arm && col.armDetectado !== dc.esp.arm)) {
        erros.push('"' + dc.nome + '": esperado ' + dc.esp.tipo + '/' + (dc.esp.arm || '-') + ', detectado ' + col.tipoDetectado + '/' + col.armDetectado);
      }
    });
    checar('aba "' + d.nome + '": tipo detectado de cada coluna (' + d.colunas.length + ' colunas)', !erros.length, erros.join('; '));
  });
  var mov = arq.abas[4];
  if (mov) {
    checar('aba grande: lê só o necessário (até 551 linhas)', mov.linhas.length <= 551, 'linhas lidas: ' + mov.linhas.length);
    checar('aba grande: total de linhas do original estimado', mov.totalDados >= 19990, 'estimado: ' + mov.totalDados);
    var colId = mov.colunas[0];
    checar('aba grande: detecção usa no máximo 500 linhas de dados', colId && colId.valores.length === 500, colId ? 'usadas: ' + colId.valores.length : 'sem coluna');
  }
  checar('leitura + detecção em menos de 3 s (inclui aba com 20 mil linhas)', ms < 3000, Math.round(ms) + ' ms');
  info('tempo de leitura + detecção', Math.round(ms) + ' ms (montagem dos exemplos: ' + Math.round(fx.ms) + ' ms)');
  return arq;
}

function testarGeracao(fx, arq) {
  var def = fx.vendas, ag = agregador(), tempos = [], nome = '';
  [10, 20, 30].forEach(function (n) {
    SEMENTES.forEach(function (sem) {
      var t0 = performance.now();
      var r = A.saida.gerar(arq, n, sem);
      tempos.push(performance.now() - t0);
      nome = r.nome;
      var wb = XLSX.read(new Uint8Array(r.bytes), { type: 'array', cellNF: true });
      conferirSaida(def, wb, n, ag, { rotulo: '[n=' + n + ', semente ' + sem + ']' });
    });
  });
  ag.registrar();
  checar('nome do arquivo = nome original + "_amostra.xlsx"', nome === 'vendas_exemplo_amostra.xlsx', nome);
  var media = tempos.reduce(function (x, y) { return x + y; }, 0) / tempos.length;
  checar('geração rápida (média < 1 s)', media < 1000, Math.round(media) + ' ms');
  info('tempo médio de geração', Math.round(media) + ' ms por arquivo');
  info('aba com 20 mil linhas', 'na aba Movimentos, "nenhum valor real" é conferido contra as 500 linhas analisadas pela ferramenta; o resto do arquivo nunca é carregado');
}

function testarReabertura(fx, arq) {
  var r = A.saida.gerar(arq, 30, SEMENTES[0]);
  var arq2 = A.leitura.abrir({ nome: r.nome, bytes: new Uint8Array(r.bytes) });
  A.detectar.analisarArquivo(arq2);
  var difs = [];
  arq.abas.forEach(function (aba, i) {
    var b = arq2.abas[i];
    if (!b) { difs.push('faltou aba ' + aba.nome); return; }
    if (aba.linhaCab !== b.linhaCab) difs.push(aba.nome + ': cabeçalho linha ' + (b.linhaCab + 1));
    aba.colunas.forEach(function (col, j) {
      var c2 = b.colunas[j];
      if (!c2) { difs.push(aba.nome + ' › ' + col.nome + ': coluna sumiu'); return; }
      if (c2.tipoDetectado !== col.tipoDetectado || c2.armDetectado !== col.armDetectado) {
        difs.push(aba.nome + ' › "' + col.nome + '": ' + col.tipoDetectado + '/' + col.armDetectado + ' → ' + c2.tipoDetectado + '/' + c2.armDetectado);
      }
    });
  });
  checar('a própria ferramenta detecta no arquivo gerado os mesmos cabeçalhos e tipos do original (30 linhas)', !difs.length, difs.slice(0, 6).join('; '));
}

function acharColuna(aba, nome) { return aba.colunas.filter(function (c) { return c.nome === nome; })[0]; }

function testarSemReler(fx, arq) {
  var DET = A.detectar;
  var aba = arq.abas[0];
  var colCliente = acharColuna(aba, 'Cliente'), colQtd = acharColuna(aba, 'Quantidade'), colData = acharColuna(aba, 'Data do pedido');
  var c0 = A.leitura.contador, rd0 = chamadasRead;
  DET.definirTipo(colCliente, 'texto');
  DET.definirTipo(colQtd, 'decimal');
  DET.definirArmazenamento(colData, 'texto');
  var saidas = [10, 20, 30].map(function (n) { return A.saida.gerar(arq, n, 5); });
  A.resumo.texto(arq);
  checar('trocar tipo, formato e quantidade não relê nem reprocessa a planilha', A.leitura.contador === c0 && chamadasRead === rd0,
    'leitura.abrir: +' + (A.leitura.contador - c0) + ', XLSX.read: +' + (chamadasRead - rd0));
  var ws = XLSX.read(new Uint8Array(saidas[1].bytes), { type: 'array', cellNF: true }).Sheets.Vendas;
  function celulas(c) { var out = []; for (var i = 0; i < 20; i++) { var x = ws[XLSX.utils.encode_cell({ r: 4 + i, c: c })]; if (x) out.push(x); } return out; }
  var qtd = celulas(12), datas = celulas(1);
  checar('coluna trocada para Decimal passa a ter casas decimais', qtd.length && qtd.every(function (c) { return c.t === 'n'; }) && qtd.some(function (c) { return Math.floor(c.v) !== c.v; }),
    function () { return JSON.stringify(qtd.slice(0, 3).map(function (c) { return c.v; })); });
  checar('data gravada como texto quando escolhido "gravar como texto"', datas.length && datas.every(function (c) { return c.t === 's' && /^\d{2}\/\d{2}\/\d{4}$/.test(c.v); }),
    function () { return JSON.stringify(datas.slice(0, 3).map(function (c) { return c.v; })); });
  DET.definirTipo(colCliente, colCliente.tipoDetectado);
  DET.definirTipo(colQtd, colQtd.tipoDetectado);
  DET.definirArmazenamento(colData, colData.armDetectado);

  var c1 = A.leitura.contador, rd1 = chamadasRead;
  DET.analisarAba(aba, arq, 0);
  var nomeTitulo = aba.colunas[0] && aba.colunas[0].nome;
  DET.analisarAba(aba, arq, 3);
  checar('ajustar a linha do cabeçalho reprocessa só a aba, em memória', A.leitura.contador === c1 && chamadasRead === rd1 &&
    nomeTitulo === 'Relatório de Vendas — Empresa Fictícia Ltda' && aba.colunas.length === 25 && aba.colunas[0].nome === 'Pedido',
    'título como cabeçalho: ' + JSON.stringify(nomeTitulo) + '; colunas depois de voltar: ' + aba.colunas.length);
}

function testarManter(fx, arq) {
  var def = fx.vendas, aba = arq.abas[0];
  var col = acharColuna(aba, 'Status ');
  col.manter = true;
  var ag = agregador();
  [10, 30].forEach(function (n) {
    var r = A.saida.gerar(arq, n, 9);
    var wb = XLSX.read(new Uint8Array(r.bytes), { type: 'array', cellNF: true });
    conferirSaida(def, wb, n, ag, { rotulo: '[manter, n=' + n + ']', manter: { 'Vendas|Status ': true } });
  });
  col.manter = false;
  ag.registrar();
}

function testarResumo(fx, arq) {
  var txt = A.resumo.texto(arq);
  checar('avisa que tipos e vazios vêm das primeiras 500 linhas', txt.indexOf('primeiras 500 linhas') >= 0, txt.split('\n')[1]);
  checar('lista as abas, com a oculta marcada', fx.vendas.abas.every(function (a) { return txt.indexOf('"' + a.nome + '"') >= 0; }) && txt.indexOf('"Auditoria" (oculta)') >= 0);
  checar('informa a linha do cabeçalho', txt.indexOf('Linha do cabeçalho: 4') >= 0);
  checar('informa formatos do Excel (moeda, data)', txt.indexOf('"R$" #,##0.00') >= 0 && txt.indexOf('dd/mm/yyyy') >= 0);
  var vazados = valoresReaisLongos(fx.vendas).filter(function (v) { return txt.indexOf(v) >= 0; });
  checar('resumo não contém valores reais', !vazados.length, vazados.slice(0, 3).join(' | '));
  info('início do resumo', txt.split('\n').slice(0, 9).join('  ⏎  '));
}

function testarCsv(fx) {
  var def = fx.csv;
  var arq = A.leitura.abrir({ nome: def.nome, bytes: def.bytes });
  A.detectar.analisarArquivo(arq);
  var aba = arq.abas[0];
  checar('CSV lido com separador ";"', arq.origem === 'csv' && arq.separador === ';', arq.separador);
  checar('acentos lidos corretamente (Windows-1252)', arq.codificacao === 'Windows-1252' && aba.colunas.some(function (c) { return c.nome === 'Salário'; }),
    arq.codificacao + ' / ' + aba.colunas.map(function (c) { return c.nome; }).join(', '));
  checar('aba recebe o nome do arquivo (como o Excel faz)', aba.nome === 'contatos_exemplo', aba.nome);
  checar('campo entre aspas com ";" dentro não quebra as colunas', aba.colunas.length === 8, 'colunas: ' + aba.colunas.length);
  var erros = [];
  def.abas[0].colunas.forEach(function (dc, j) {
    var col = aba.colunas[j];
    if (col && (col.tipoDetectado !== dc.esp.tipo || col.armDetectado !== dc.esp.arm)) erros.push('"' + dc.nome + '": esperado ' + dc.esp.tipo + '/' + dc.esp.arm + ', detectado ' + col.tipoDetectado + '/' + col.armDetectado);
  });
  checar('tipos detectados no CSV (datas e números viram valores do Excel)', !erros.length, erros.join('; '));
  var ag = agregador();
  [10, 20].forEach(function (n) {
    SEMENTES.forEach(function (sem) {
      var r = A.saida.gerar(arq, n, sem);
      var wb = XLSX.read(new Uint8Array(r.bytes), { type: 'array', cellNF: true });
      conferirSaida(def, wb, n, ag, { rotulo: '[CSV n=' + n + ', semente ' + sem + ']' });
    });
  });
  ag.registrar();
  checar('nome do arquivo gerado', A.saida.nomeSaida(arq) === 'contatos_exemplo_amostra.xlsx', A.saida.nomeSaida(arq));
}

function testarXls(fx) {
  var def = fx.xls;
  var bruto = XLSX.read(def.bytes, { type: 'array', cellNF: true });
  var wsB = bruto.Sheets.Plan1 || {};
  var zData = (wsB.D3 || {}).z, zValor = (wsB.C3 || {}).z;
  var temMerge = (wsB['!merges'] || []).length > 0;
  var dcData = def.abas[0].colunas[3], dcValor = def.abas[0].colunas[2];
  if (!zData || !A.util.tipoDoFormato(zData).match(/data/)) {
    avisar('o .xls de exemplo saiu sem formato de data (limitação do gravador .xls do SheetJS); tipo da coluna "Data" não verificado', 'z=' + zData);
    dcData.esp = { tipo: A.util.tipoDoFormato(zData) === 'data' ? 'data' : 'inteiro', arm: 'nativo' };
  } else {
    dcData.saida.z = zData;
  }
  if (zValor) dcValor.saida.z = zValor;
  if (!temMerge) {
    avisar('o .xls de exemplo saiu sem a mesclagem do título (limitação do gravador .xls do SheetJS); mesclagem não verificada');
    delete def.abas[0].merges;
  }
  var arq = A.leitura.abrir({ nome: def.nome, bytes: def.bytes });
  A.detectar.analisarArquivo(arq);
  var aba = arq.abas[0];
  checar('.xls abre e mantém o nome da aba', aba && aba.nome === 'Plan1', aba && aba.nome);
  checar('.xls: cabeçalho na linha 2', aba.linhaCab === 1, 'detectado: ' + (aba.linhaCab + 1));
  checar('.xls: nomes das colunas', igual(aba.colunas.map(function (c) { return c.nome; }), ['Código', 'Descrição', 'Valor', 'Data']),
    JSON.stringify(aba.colunas.map(function (c) { return c.nome; })));
  var erros = [];
  def.abas[0].colunas.forEach(function (dc, j) {
    var col = aba.colunas[j];
    if (col && (col.tipoDetectado !== dc.esp.tipo || col.armDetectado !== dc.esp.arm)) erros.push('"' + dc.nome + '": esperado ' + dc.esp.tipo + ', detectado ' + col.tipoDetectado + '/' + col.armDetectado);
  });
  checar('.xls: tipos detectados', !erros.length, erros.join('; '));
  var ag = agregador();
  var r = A.saida.gerar(arq, 10, SEMENTES[0]);
  conferirSaida(def, XLSX.read(new Uint8Array(r.bytes), { type: 'array', cellNF: true }), 10, ag, { rotulo: '[.xls n=10]' });
  ag.registrar();
  checar('.xls gera um .xlsx', r.nome === 'legado_exemplo_amostra.xlsx', r.nome);
}

function testarFretes(fx) {
  var def = fx.fretes;
  var arq = A.leitura.abrir({ nome: def.nome, bytes: def.bytes });
  A.detectar.analisarArquivo(arq);
  var aba = arq.abas[0];
  var erros = [];
  def.abas[0].colunas.forEach(function (dc, j) {
    var col = aba.colunas[j];
    if (col && col.tipoDetectado !== dc.esp.tipo) erros.push('"' + dc.nome + '": esperado ' + dc.esp.tipo + ', detectado ' + col.tipoDetectado);
  });
  checar('entende o significado: tipo de documento, cidade, UF, valor fixo, flag 0/1', !erros.length, erros.join('; '));
  var rel = aba.relacoes || [];
  var ufs = rel.filter(function (r) { return r.tipo === 'ufDaCidade'; }).map(function (r) { return r.uf + '<-' + r.cidade; }).sort().join(',');
  checar('percebe que cada UF (sigla ou por extenso) é a UF da cidade ligada', ufs === '21<-3,2<-1,4<-3', 'relações: ' + ufs);
  checar('percebe que a cidade de destino às vezes é igual à de origem', rel.some(function (r) { return r.tipo === 'igual' && r.base === 1 && r.dep === 3; }), JSON.stringify(rel));
  checar('percebe que o formato do Nr Doc depende do Tipo Doc', rel.some(function (r) { return r.tipo === 'formatoPorOpcao' && r.cat === 0 && r.dep === 20; }),
    JSON.stringify(rel.filter(function (r) { return r.tipo === 'formatoPorOpcao'; })));
  checar('percebe que a entrega vem sempre depois da emissão', rel.some(function (r) { return r.tipo === 'ordemData' && r.antes === 12 && r.depois === 13; }),
    JSON.stringify(rel.filter(function (r) { return r.tipo === 'ordemData'; }).map(function (r) { return [r.antes, r.depois]; })));
  var contas = rel.filter(function (r) { return r.tipo === 'conta'; });
  checar('percebe as contas: Vlr Mercadoria = Qtd × Vlr Unit e Total = Frete + ICMS',
    contas.some(function (r) { return r.op === 'produto' && r.c === 16 && [r.a, r.b].sort().join() === '14,15'; }) &&
    contas.some(function (r) { return r.op === 'soma' && r.c === 19 && [r.a, r.b].sort().join() === '17,18'; }) && contas.length === 2,
    JSON.stringify(contas.map(function (r) { return r.c + '=' + r.a + r.op + r.b; })));
  var ag = agregador();
  [10, 20, 30].forEach(function (n) {
    SEMENTES.forEach(function (sem) {
      var r = A.saida.gerar(arq, n, sem);
      conferirSaida(def, XLSX.read(new Uint8Array(r.bytes), { type: 'array', cellNF: true }), n, ag, { rotulo: '[fretes n=' + n + ', semente ' + sem + ']' });
    });
  });
  ag.registrar();
  var txt = A.resumo.texto(arq);
  checar('descrição copiada explica repetição e ligações entre colunas',
    /é a UF da cidade em/.test(txt) && /se repete/.test(txt) && /nunca se repete/.test(txt) && /valor: 0/.test(txt) && /opções: CTRC\/CTE/.test(txt) &&
    /depende de A "Tipo Doc": .*MINUTA → MIN-####/.test(txt) && /sempre igual ou posterior/.test(txt) && /= .* × /.test(txt), txt.split('\n').slice(-10).join(' ⏎ '));
}

async function testarErros(fx) {
  function erroDe(nome, bytes) {
    try { A.leitura.abrir({ nome: nome, bytes: bytes }); return null; } catch (e) { return e; }
  }
  function desc(e) { return e ? (e.tipo || '?') + ': ' + e.message + (e.detalhe ? ' [' + e.detalhe + ']' : '') : 'nenhum erro foi gerado'; }
  var e1 = erroDe(fx.senha.nome, fx.senha.bytes);
  checar('arquivo protegido por senha: mensagem clara', e1 && e1.tipo === 'senha' && /senha/i.test(e1.message), desc(e1));
  var e2 = erroDe(fx.corrompido.nome, fx.corrompido.bytes);
  checar('arquivo corrompido: mensagem clara', e2 && e2.tipo === 'corrompido', desc(e2));
  var e3 = erroDe(fx.zipQuebrado.nome, fx.zipQuebrado.bytes);
  checar('.xlsx com conteúdo quebrado: mensagem clara', e3 && e3.tipo === 'corrompido', desc(e3));
  var e4 = erroDe('relatorio.pdf', new Uint8Array([37, 80, 68, 70]));
  checar('formato não suportado: mensagem clara', e4 && e4.tipo === 'formato', desc(e4));
  var e5 = erroDe('vazio.xlsx', new Uint8Array(0));
  checar('arquivo vazio: mensagem clara', e5 && e5.tipo === 'vazio', desc(e5));
  var itens = await A.leitura.listarZip(fx.zips.varias.bytes);
  checar('.zip: encontra só as planilhas (ignora texto, __MACOSX e temporários ~$)',
    igual(itens.map(function (i) { return i.caminho; }).sort(), ['entrada/contatos_exemplo.csv', 'vendas_exemplo.xlsx']),
    JSON.stringify(itens.map(function (i) { return i.caminho; })));
  var e6 = null;
  try { await A.leitura.listarZip(fx.corrompido.bytes); } catch (e) { e6 = e; }
  checar('.zip danificado: mensagem clara', e6 && e6.tipo === 'corrompido', desc(e6));
  // zip com bytes trocados no meio do conteúdo compactado: o CRC não bate e a leitura para com mensagem clara
  var alterado = new Uint8Array(fx.zips.uma.bytes);
  for (var k = 0; k < 40; k++) alterado[200 + k * 997] ^= 0x5A;
  var e7 = null;
  try { await A.leitura.listarZip(alterado); } catch (e) { e7 = e; }
  checar('.zip com conteúdo danificado (CRC não confere): mensagem clara, sem travar', e7 && e7.tipo === 'corrompido', desc(e7));
  var xlsxAlterado = new Uint8Array(fx.fretes.bytes);
  for (var j = 0; j < 40; j++) xlsxAlterado[300 + j * 773] ^= 0x5A;
  var e8 = null;
  try { await A.leitura.abrirSeguro({ nome: 'fretes.xlsx', bytes: xlsxAlterado }); } catch (e) { e8 = e; }
  checar('.xlsx com conteúdo danificado: mensagem clara, sem travar', e8 && e8.tipo === 'corrompido', desc(e8));
}

function testarColado() {
  var cab = ['Código do pedido', 'Data de emissão', 'Cliente', 'CPF', 'Valor total', 'Status', 'E-mail', 'Telefone', 'Observações', 'Desconto %', 'Qtd'];
  var esperado = ['codigo', 'data', 'pessoa', 'cpf', 'moeda', 'categoria', 'email', 'telefone', 'texto', 'percentual', 'inteiro'];
  var arq = A.leitura.deCabecalho(cab.join('\t') + '\r\n', 'Pedidos', 'pedidos_colados');
  A.detectar.analisarArquivo(arq);
  var aba = arq.abas[0];
  checar('colunas do texto colado (separadas por tabulação)', igual(aba.colunas.map(function (c) { return c.nome; }), cab),
    JSON.stringify(aba.colunas.map(function (c) { return c.nome; })));
  var tipos = aba.colunas.map(function (c) { return c.tipo; });
  var erros = esperado.map(function (t, i) { return tipos[i] === t ? null : '"' + cab[i] + '": esperado ' + t + ', deduzido ' + tipos[i]; }).filter(Boolean);
  checar('tipo deduzido pelo nome da coluna', !erros.length, erros.join('; '));
  var r = A.saida.gerar(arq, 10, 3);
  var wb = XLSX.read(new Uint8Array(r.bytes), { type: 'array', cellNF: true });
  var ws = wb.Sheets.Pedidos;
  checar('gera a aba com o nome informado e o arquivo com o nome informado', !!ws && r.nome === 'pedidos_colados_amostra.xlsx', r.nome + ' / ' + wb.SheetNames.join(','));
  if (!ws) return;
  var ref = XLSX.utils.decode_range(ws['!ref']);
  checar('cabeçalho na linha 1 e 10 linhas de dados', ref.e.r === 10 && cab.every(function (n, i) { return (ws[XLSX.utils.encode_cell({ r: 0, c: i })] || {}).v === n; }), ws['!ref']);
  function cels(c) { var o = []; for (var i = 1; i <= 10; i++) { var x = ws[XLSX.utils.encode_cell({ r: i, c: c })]; if (x) o.push(x); } return o; }
  checar('data como data do Excel (dd/mm/yyyy)', cels(1).every(function (c) { return c.t === 'n' && c.z === 'dd/mm/yyyy'; }), JSON.stringify(cels(1)[0]));
  checar('valor como moeda ("R$" #,##0.00)', cels(4).every(function (c) { return c.t === 'n' && c.z === '"R$" #,##0.00'; }), JSON.stringify(cels(4)[0]));
  checar('CPF válido com máscara', cels(3).every(function (c) { return /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(c.v) && cpfValidoT(c.v); }), JSON.stringify(cels(3)[0]));
  checar('percentual como % do Excel', cels(9).every(function (c) { return c.t === 'n' && /%$/.test(c.z); }), JSON.stringify(cels(9)[0]));
  checar('quantidade como número inteiro', cels(10).every(function (c) { return c.t === 'n' && Math.floor(c.v) === c.v; }), JSON.stringify(cels(10)[0]));
  var arq2 = A.leitura.deCabecalho('"Nome\ncompleto"\tIdade\r\n', 'Planilha1', 'x');
  A.detectar.analisarArquivo(arq2);
  checar('célula com quebra de linha copiada do Excel (entre aspas)', igual(arq2.abas[0].colunas.map(function (c) { return c.nome; }), ['Nome\ncompleto', 'Idade']),
    JSON.stringify(arq2.abas[0].colunas.map(function (c) { return c.nome; })));
}

async function testarArquivoInteiro(fx) {
  var palco = document.getElementById('palco');
  palco.textContent = '';
  var capturado = null;
  var api = A.app.montar(palco, { semEventosGlobais: true, baixar: function (nome, dados) { capturado = { nome: nome, dados: dados }; } });
  await api.carregarBytes(fx.fretes.nome, fx.fretes.bytes);
  var radioInteiro = palco.querySelector('input.modo-radio[value="inteiro"]');
  checar('arquivo inteiro: opção disponível para .xlsx', !!radioInteiro && !radioInteiro.disabled);
  radioInteiro.checked = true;
  radioInteiro.dispatchEvent(new Event('change'));
  var acoes = palco.querySelectorAll('select.sel-acao');
  var cabecalho = palco.querySelector('thead th:last-child');
  checar('arquivo inteiro: tabela mostra "O que fazer" em cada coluna, sem "usar reais"', acoes.length === 24 && !palco.querySelector('input.chk-manter') &&
    !!cabecalho && cabecalho.textContent === 'O que fazer', 'seletores: ' + acoes.length);
  checar('arquivo inteiro: barra sem a escolha de 10/20/30 e botão "Gerar arquivo com dados trocados"',
    palco.querySelector('.qtd').hidden && /Gerar arquivo com dados trocados/.test(api.botoes.gerar.textContent), api.botoes.gerar.textContent);
  var linhaPlaca = Array.prototype.filter.call(palco.querySelectorAll('tbody tr'), function (tr) { return /Placa/.test(tr.textContent); })[0];
  var selPlaca = linhaPlaca && linhaPlaca.querySelector('select.sel-acao');
  checar('arquivo inteiro: código (placa) vem marcado para trocar', !!selPlaca && selPlaca.value === 'pseudonimizar', selPlaca ? selPlaca.value : 'sem linha');
  if (selPlaca) { selPlaca.value = 'manter'; selPlaca.dispatchEvent(new Event('change')); }
  checar('arquivo inteiro: manter uma coluna sensível destaca a linha', !!linhaPlaca && linhaPlaca.classList.contains('manter'));
  await api.gerarInteiro();
  checar('arquivo inteiro: arquivo entregue com o nome certo', !!capturado && capturado.nome === 'fretes_exemplo_pseudonimizado.xlsx', capturado ? capturado.nome : 'nada baixado');
  if (capturado) {
    var bytes = new Uint8Array(await capturado.dados.arrayBuffer());
    var wb = XLSX.read(bytes, { type: 'array' }), orig = XLSX.read(fx.fretes.bytes, { type: 'array' });
    var a = XLSX.utils.sheet_to_json(orig.Sheets.Fretes, { header: 1 }), b = XLSX.utils.sheet_to_json(wb.Sheets.Fretes, { header: 1 });
    var iCidade = a[0].indexOf('Cid Origem Prestação'), iPlaca = a[0].indexOf('Placa'), iChave = a[0].indexOf('Chave CT-e');
    var mudouChave = true, manteveCidade = true, mantevePlaca = true;
    for (var i = 1; i < a.length; i++) {
      if (a[i][iChave] && a[i][iChave] === b[i][iChave]) mudouChave = false;
      if (a[i][iCidade] !== b[i][iCidade]) manteveCidade = false;
      if (a[i][iPlaca] !== b[i][iPlaca]) mantevePlaca = false;
    }
    checar('arquivo inteiro: mesmas linhas; chave trocada; cidade (padrão) e placa (escolha) mantidas',
      b.length === a.length && mudouChave && manteveCidade && mantevePlaca, 'linhas ' + b.length + '/' + a.length);
  }
  var resultado = api.resultado;
  checar('arquivo inteiro: resultado mostra o que foi trocado e o aviso de dado pseudonimizado',
    !resultado.hidden && /chaves de acesso/.test(resultado.textContent) && /pseudonimizado/.test(resultado.textContent), resultado.textContent.slice(0, 160));
  await api.analisarColado('Nome\tCPF\r\n', 'P', 'x');
  var radio2 = palco.querySelector('input.modo-radio[value="inteiro"]');
  checar('arquivo inteiro: indisponível quando só há os títulos colados (com explicação)',
    !!radio2 && radio2.disabled && !palco.querySelector('.modo-aviso').hidden);
  palco.textContent = '';
}

async function testarInterface(fx) {
  var palco = document.getElementById('palco');
  palco.textContent = '';
  var capturado = null, copiado = null;
  var api = A.app.montar(palco, {
    semEventosGlobais: true,
    baixar: function (nome, bytes) { capturado = { nome: nome, bytes: bytes }; },
    copiar: function (t) { copiado = t; }
  });
  var campo = function () { return palco.querySelector('fieldset'); };
  checar('página monta sem erros', !!api && !!palco.querySelector('.dropzone'));
  var p = api.carregarBytes(fx.vendas.nome, fx.vendas.bytes);
  checar('feedback imediato ao carregar ("Lendo…" e controles bloqueados)', !!palco.querySelector('.dropzone.carregando') && campo().disabled,
    palco.querySelector('.dropzone').className);
  await p;
  var cartoes = palco.querySelectorAll('details.aba');
  checar('mostra um cartão por aba', cartoes.length === 6, 'cartões: ' + cartoes.length);
  checar('aba oculta sinalizada', palco.querySelectorAll('.marca-oculta').length === 1);
  checar('controles liberados depois de carregar', !campo().disabled && palco.querySelector('.dropzone.carregado'));
  var linhas = cartoes[0] ? cartoes[0].querySelectorAll('tbody tr') : [];
  var linhasOk = linhas.length === 25 && Array.prototype.every.call(linhas, function (tr) {
    var chk = tr.querySelector('input.chk-manter');
    return tr.querySelector('select.sel-tipo') && chk && !chk.checked;
  });
  checar('uma linha por coluna, com seletor de tipo e "manter valores reais" desligado', linhasOk, 'linhas: ' + linhas.length);
  var tela = palco.textContent;
  // Datas e números curtos se repetem naturalmente entre dados inventados e reais; o teste olha textos identificáveis.
  var naTela = valoresReaisLongos(fx.vendas).filter(function (v) {
    return !/^[\d\s.,\/:\-]+$/.test(v) && tela.indexOf(v) >= 0;
  });
  checar('nenhum valor real aparece na tela', !naTela.length, naTela.slice(0, 3).join(' | '));
  if (linhas[3]) {
    var sel = linhas[3].querySelector('select.sel-tipo');
    sel.value = 'texto';
    sel.dispatchEvent(new Event('change'));
    checar('trocar o tipo marca a linha como "ajustado" na hora', linhas[3].classList.contains('ajustado') && !linhas[3].querySelector('.marca-ajuste').hidden);
    var chk = linhas[3].querySelector('input.chk-manter');
    chk.checked = true;
    chk.dispatchEvent(new Event('change'));
    checar('marcar "manter valores reais" destaca a linha na hora', linhas[3].classList.contains('manter'));
    chk.checked = false;
    chk.dispatchEvent(new Event('change'));
  }
  api.botoes.chips[2].click();
  checar('escolher 30 linhas atualiza o botão na hora', api.estado.n === 30 && api.botoes.chips[2].getAttribute('aria-pressed') === 'true' && /30/.test(api.botoes.gerar.textContent),
    api.botoes.gerar.textContent);
  var pg = api.gerar();
  checar('ao gerar: botão mostra "Gerando…" e os controles ficam desabilitados',
    api.botoes.gerar.classList.contains('carregando') && campo().disabled && /Gerando/.test(api.botoes.gerar.textContent), api.botoes.gerar.textContent);
  await pg;
  checar('ao terminar: confirmação no botão e download entregue', api.botoes.gerar.classList.contains('ok') && !!capturado && capturado.nome === 'vendas_exemplo_amostra.xlsx',
    capturado ? capturado.nome : 'nada baixado');
  if (capturado) {
    var wb = XLSX.read(new Uint8Array(capturado.bytes), { type: 'array', cellNF: true });
    var ref = XLSX.utils.decode_range(wb.Sheets.Vendas['!ref']);
    checar('arquivo gerado pela interface tem 30 linhas de dados', ref.e.r === 3 + 30, wb.Sheets.Vendas['!ref']);
  }
  await api.copiarResumo();
  checar('"Copiar resumo" entrega o texto da estrutura com confirmação', !!copiado && copiado.indexOf('ESTRUTURA DA PLANILHA') === 0 && api.botoes.resumo.classList.contains('ok'));
  await api.carregarBytes(fx.senha.nome, fx.senha.bytes);
  var caixa = palco.querySelector('.caixa-erro');
  checar('arquivo com senha: mensagem clara na tela', !!caixa && !caixa.hidden && /senha/i.test(caixa.textContent) && !!palco.querySelector('.dropzone.erro'),
    caixa ? caixa.textContent.slice(0, 120) : 'sem caixa');
  checar('controles liberados depois do erro', !campo().disabled);
  // .zip com várias planilhas: mostra a lista e deixa escolher (e trocar) sem abrir o .zip de novo
  capturado = null;
  await api.carregarBytes(fx.zips.varias.nome, fx.zips.varias.bytes);
  var itensZip = palco.querySelectorAll('.escolha-item');
  checar('.zip com várias planilhas: mostra a lista para escolher', !palco.querySelector('.escolha-zip').hidden && itensZip.length === 2 &&
    !palco.querySelectorAll('details.aba').length && !!palco.querySelector('.dropzone.escolha'),
    'itens: ' + Array.prototype.map.call(itensZip, function (b) { return b.textContent; }).join(' | '));
  var nomesZip = Array.prototype.map.call(itensZip, function (b) { return b.querySelector('.escolha-nome').textContent; });
  var iCsv = nomesZip.indexOf('contatos_exemplo.csv'), iVendas = nomesZip.indexOf('vendas_exemplo.xlsx');
  await api.escolherDoZip(iCsv);
  checar('.zip: escolher a planilha CSV de dentro de uma pasta abre essa planilha', palco.querySelectorAll('details.aba').length === 1 &&
    palco.querySelector('.aba-nome').textContent === 'contatos_exemplo' && itensZip[iCsv].getAttribute('aria-pressed') === 'true',
    palco.querySelector('.aba-nome') ? palco.querySelector('.aba-nome').textContent : 'nenhuma aba');
  await api.escolherDoZip(iVendas);
  await api.gerar();
  checar('.zip: trocar para outra planilha do mesmo .zip e gerar a amostra', palco.querySelectorAll('details.aba').length === 6 && !!capturado && capturado.nome === 'vendas_exemplo_amostra.xlsx',
    capturado ? capturado.nome : 'nada baixado');
  await api.carregarBytes(fx.zips.uma.nome, fx.zips.uma.bytes);
  checar('.zip com uma planilha só: abre direto, sem perguntar', palco.querySelector('.escolha-zip').hidden && palco.querySelectorAll('details.aba').length === 1 &&
    palco.querySelector('.aba-nome').textContent === 'Fretes');
  await api.carregarBytes(fx.zips.nenhuma.nome, fx.zips.nenhuma.bytes);
  var caixaZip = palco.querySelector('.caixa-erro');
  checar('.zip sem planilha: mensagem clara', !caixaZip.hidden && /nenhuma planilha/i.test(caixaZip.textContent), caixaZip.textContent.slice(0, 120));
  await api.analisarColado('Nome\tCPF\tValor\r\n', 'Planilha1', 'teste');
  checar('modo "colar cabeçalho" mostra as colunas com seletor', palco.querySelectorAll('details.aba').length === 1 && palco.querySelectorAll('tbody tr').length === 3,
    'linhas: ' + palco.querySelectorAll('tbody tr').length);
  palco.textContent = '';
}

function testarRede() {
  checar('nenhuma tentativa de acesso à rede durante os testes (fetch, XHR, WebSocket, beacon)', !window.__rede.length, window.__rede.join(', '));
  var entradas = performance.getEntriesByType ? performance.getEntriesByType('resource') : [];
  var externos = entradas.map(function (e) { return e.name; }).filter(function (u) { return !/^(file|blob|data):/i.test(u); });
  checar('só arquivos locais foram carregados', !externos.length, externos.join(', '));
}

// ================= execução e relatório =================
var placar = document.getElementById('placar');
var btnRodar = document.getElementById('btnRodar');
var btnCopiar = document.getElementById('btnCopiar');
var ultimoRelatorio = '';

function contar() {
  var c = { ok: 0, falhou: 0, aviso: 0, info: 0 };
  resultados.forEach(function (r) { c[r.status]++; });
  return c;
}

function relatorioTexto(ms) {
  var c = contar();
  var out = [
    'RELATÓRIO DE TESTES — gerador de amostras',
    'Data: ' + new Date().toLocaleString('pt-BR'),
    'Navegador: ' + navigator.userAgent,
    'SheetJS: ' + (window.XLSX ? XLSX.version : 'não carregado') + ' · sementes: ' + SEMENTES.join(', '),
    'Resultado: ' + c.ok + ' aprovados, ' + c.falhou + ' reprovados, ' + c.aviso + ' avisos · ' + Math.round(ms) + ' ms',
    ''
  ];
  if (window.__errosCarga.length) out.push('ERROS AO CARREGAR SCRIPTS: ' + window.__errosCarga.join(' | '), '');
  var PREF = { ok: '[OK]', falhou: '[FALHOU]', aviso: '[AVISO]', info: '[INFO]' };
  var grupo = null;
  resultados.forEach(function (r) {
    if (r.grupo !== grupo) { if (grupo !== null) out.push(''); out.push('## ' + r.grupo); grupo = r.grupo; }
    out.push(PREF[r.status] + ' ' + r.nome + (r.detalhe ? ' — ' + r.detalhe : ''));
  });
  return out.join('\n');
}

function renderizar(ms) {
  var lista = document.getElementById('lista');
  lista.textContent = '';
  var grupos = [], por = {};
  resultados.forEach(function (r) {
    if (!por[r.grupo]) { por[r.grupo] = []; grupos.push(r.grupo); }
    por[r.grupo].push(r);
  });
  var ICONE = { ok: '✔', falhou: '✘', aviso: '!', info: 'i' };
  grupos.forEach(function (g) {
    var itens = por[g];
    var falhas = itens.filter(function (r) { return r.status === 'falhou'; }).length;
    var aprovados = itens.filter(function (r) { return r.status === 'ok'; }).length;
    var sec = document.createElement('section');
    sec.className = 'grupo';
    var h3 = document.createElement('h3');
    h3.textContent = g;
    var badge = document.createElement('span');
    badge.className = 'contagem' + (falhas ? ' ruim' : '');
    badge.textContent = falhas ? falhas + ' reprovado(s)' : aprovados + ' ok';
    h3.appendChild(badge);
    sec.appendChild(h3);
    var ul = document.createElement('ul');
    itens.forEach(function (r) {
      var li = document.createElement('li');
      li.className = r.status;
      var ic = document.createElement('span'); ic.className = 'ic'; ic.textContent = ICONE[r.status];
      var nm = document.createElement('span'); nm.textContent = r.nome;
      li.appendChild(ic); li.appendChild(nm);
      if (r.detalhe) { var d = document.createElement('span'); d.className = 'det'; d.textContent = r.detalhe; li.appendChild(d); }
      ul.appendChild(li);
    });
    sec.appendChild(ul);
    lista.appendChild(sec);
  });
  var c = contar();
  placar.textContent = '';
  var partes = [['ok', c.ok + ' aprovados'], ['falhou', c.falhou + ' reprovados'], ['aviso', c.aviso + ' avisos']];
  partes.forEach(function (p, i) {
    var s = document.createElement('span'); s.className = p[0]; s.textContent = p[1];
    placar.appendChild(s);
    if (i < partes.length - 1) placar.appendChild(document.createTextNode('·'));
  });
  placar.appendChild(document.createTextNode(' · ' + (ms / 1000).toFixed(1).replace('.', ',') + ' s'));
}

function baixarExemplo(nome, bytes, tipo) {
  var url = URL.createObjectURL(new Blob([bytes], { type: tipo }));
  var a = document.createElement('a');
  a.href = url; a.download = nome; a.style.display = 'none';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
}

function montarDownloads(fx) {
  var area = document.getElementById('downloads');
  area.textContent = '';
  var XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  var itens = [
    [fx.vendas.nome, fx.vendas.bytes, XLSX_MIME],
    [fx.fretes.nome, fx.fretes.bytes, XLSX_MIME],
    [fx.zips.varias.nome, fx.zips.varias.bytes, 'application/zip'],
    [fx.csv.nome, fx.csv.bytes, 'text/csv'],
    [fx.xls.nome, fx.xls.bytes, 'application/vnd.ms-excel'],
    [fx.senha.nome, fx.senha.bytes, XLSX_MIME],
    [fx.corrompido.nome, fx.corrompido.bytes, XLSX_MIME]
  ];
  itens.forEach(function (it) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = it[0];
    b.addEventListener('click', function () {
      baixarExemplo(it[0], it[1], it[2]);
      b.classList.add('feito');
      setTimeout(function () { b.classList.remove('feito'); }, 1500);
    });
    area.appendChild(b);
  });
  var todas = document.createElement('button');
  todas.type = 'button';
  todas.className = 'pri';
  todas.textContent = 'Baixar todas';
  todas.addEventListener('click', function () {
    todas.disabled = true;
    todas.textContent = 'Baixando…';
    itens.forEach(function (it, i) { setTimeout(function () { baixarExemplo(it[0], it[1], it[2]); }, i * 400); });
    setTimeout(function () { todas.disabled = false; todas.textContent = '✔ Baixadas'; setTimeout(function () { todas.textContent = 'Baixar todas'; }, 1800); }, itens.length * 400);
  });
  area.appendChild(todas);
}

async function etapaAsync(grupo, fn) {
  grupoAtual = grupo;
  placar.textContent = 'Executando: ' + grupo + '…';
  try { return await fn(); } catch (e) { reg('falhou', 'erro inesperado nesta etapa', msgErro(e)); return undefined; }
}

function etapa(grupo, fn) {
  grupoAtual = grupo;
  placar.textContent = 'Executando: ' + grupo + '…';
  try { return fn(); } catch (e) { reg('falhou', 'erro inesperado nesta etapa', msgErro(e)); return undefined; }
}

async function executarTudo() {
  btnRodar.disabled = true;
  btnCopiar.disabled = true;
  btnRodar.textContent = 'Executando…';
  resultados = [];
  document.getElementById('lista').textContent = '';
  var t0 = performance.now();
  await quadro();
  var ok = etapa('Carregamento', testarCarga);
  if (ok) {
    etapa('Funções básicas', testarUtilitarios);
    placar.textContent = 'Montando planilhas de exemplo (inclui uma aba com 20 mil linhas)…';
    await quadro();
    var fx = etapa('Planilhas de exemplo', fixtures);
    if (fx) {
      montarDownloads(fx);
      await quadro();
      var arq = etapa('Planilha .xlsx: leitura e detecção (vendas_exemplo.xlsx)', function () { return testarLeituraXlsx(fx); });
      await quadro();
      if (arq) {
        etapa('Arquivo gerado: estrutura, tipos, formatos e privacidade', function () { testarGeracao(fx, arq); });
        await quadro();
        etapa('Arquivo gerado reaberto pela própria ferramenta', function () { testarReabertura(fx, arq); });
        etapa('Trocar tipo, formato e quantidade sem reler a planilha', function () { testarSemReler(fx, arq); });
        etapa('Manter valores reais', function () { testarManter(fx, arq); });
        etapa('Resumo copiado', function () { testarResumo(fx, arq); });
      }
      await quadro();
      etapa('Fretes no formato CT-e: significado, repetição e ligações (fretes_exemplo.xlsx)', function () { testarFretes(fx); });
      etapa('CSV com ";" e Windows-1252 (contatos_exemplo.csv)', function () { testarCsv(fx); });
      etapa('Excel antigo .xls (legado_exemplo.xls)', function () { testarXls(fx); });
      await etapaAsync('Mensagens de erro', function () { return testarErros(fx); });
      etapa('Colar cabeçalho (sem arquivo)', testarColado);
      grupoAtual = 'Interface (mesmo código do gerador-amostra.html)';
      placar.textContent = 'Executando: interface…';
      try { await testarInterface(fx); } catch (e) { reg('falhou', 'erro inesperado nesta etapa', msgErro(e)); }
      grupoAtual = 'Interface: arquivo inteiro com dados trocados';
      placar.textContent = 'Executando: arquivo inteiro…';
      try { await testarArquivoInteiro(fx); } catch (e) { reg('falhou', 'erro inesperado nesta etapa', msgErro(e)); }
    }
  }
  etapa('Sem acesso à rede', testarRede);
  var ms = performance.now() - t0;
  renderizar(ms);
  ultimoRelatorio = relatorioTexto(ms);
  window.__relatorioTestes = ultimoRelatorio;
  btnRodar.disabled = false;
  btnRodar.textContent = 'Executar de novo';
  btnCopiar.disabled = false;
}

window.__testes = { fixtures: fixtures };
btnRodar.addEventListener('click', function () { redefinirFixtures(); executarTudo(); });
btnCopiar.addEventListener('click', function () {
  function feito(ok) {
    btnCopiar.textContent = ok ? '✔ Relatório copiado' : 'Não deu para copiar — selecione a lista e use Ctrl+C';
    btnCopiar.classList.toggle('feito', ok);
    setTimeout(function () { btnCopiar.textContent = 'Copiar relatório'; btnCopiar.classList.remove('feito'); }, 2500);
  }
  function alternativo() {
    var ta = document.createElement('textarea');
    ta.value = ultimoRelatorio;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    var ok;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    feito(ok);
  }
  btnCopiar.textContent = 'Copiando…';
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ultimoRelatorio).then(function () { feito(true); }, alternativo);
  else alternativo();
});

executarTudo();
