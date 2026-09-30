/* Saída: monta o .xlsx de amostra com a mesma estrutura do original. Sem DOM. */
import { A } from '../nucleo/amostra.js';

var U = A.util;
var TITULO = 'Título do relatório';
var INFO = 'Informação do relatório';

function nomeSaida(arquivo) {
  return arquivo.base + '_amostra.xlsx';
}

function copiaCabecalho(cel) {
  var o = { t: cel.t, v: cel.v };
  if (cel.z != null) o.z = cel.z;
  return o;
}

// Mantém as relações entre colunas da mesma linha (ex.: origem = destino, UF compatível com a cidade).
function aplicarRelacoes(aba, porColuna, n, rng, ctx) {
  var DET = A.detectar, G = A.geradores;
  var cols = {};
  aba.colunas.forEach(function (c) { cols[c.c] = c; });
  function ativa(c, tipo) { return c && !c.manter && c.tipo === tipo; }
  // Escolhe exatamente taxa × (linhas elegíveis) linhas, com arredondamento aleatório, em vez de sortear linha a linha.
  function escolherLinhas(elegiveis, taxa) {
    var q = taxa * elegiveis.length;
    var m = Math.floor(q) + (rng.num() < q - Math.floor(q) ? 1 : 0);
    return new Set(rng.embaralhar(elegiveis.slice()).slice(0, m));
  }
  var rels = aba.relacoes || [];
  rels.forEach(function (r) {
    if (r.tipo !== 'igual') return;
    var b = cols[r.base], d = cols[r.dep];
    if (!ativa(b, r.tipoCol) || !ativa(d, r.tipoCol)) return;
    var vb = porColuna[r.base], vd = porColuna[r.dep], elegiveis = [];
    for (var i = 0; i < n; i++) if (vb[i] && vd[i]) elegiveis.push(i);
    var copiar = escolherLinhas(elegiveis, r.taxa);
    for (i = 0; i < n; i++) {
      if (copiar.has(i)) vd[i] = G.clonarCelula(vb[i]);
      else if (vb[i] && vd[i] && vd[i].v === vb[i].v) {
        // igualdade que surgiu por acaso: troca por outro valor já usado na coluna
        for (var k = 0; k < n; k++) if (vd[k] && vd[k].v !== vb[i].v && !copiar.has(k)) { vd[i] = G.clonarCelula(vd[k]); break; }
      }
    }
  });
  rels.forEach(function (r) {
    if (r.tipo !== 'mesmaUF') return;
    var b = cols[r.base], d = cols[r.dep];
    if (!ativa(b, 'cidade') || !ativa(d, 'cidade')) return;
    var vb = porColuna[r.base], vd = porColuna[r.dep], pd = DET.perfil(d), elegiveis = [];
    for (var i = 0; i < n; i++) {
      if (vb[i] && vd[i] && DET.nomeLugar(vb[i].v) !== DET.nomeLugar(vd[i].v)) elegiveis.push(i);
    }
    var mesma = escolherLinhas(elegiveis, r.taxa);
    for (i = 0; i < n; i++) {
      if (!mesma.has(i)) continue;
      var ufs = DET.ufsDaCidade(vb[i].v);
      var nova = ufs && G.cidadeDaUF(pd, ufs[0], rng, ctx);
      if (nova) vd[i] = nova;
    }
  });
  rels.forEach(function (r) {
    if (r.tipo !== 'ufDaCidade') return;
    var c = cols[r.cidade], u = cols[r.uf];
    if (!ativa(c, 'cidade') || !ativa(u, 'uf')) return;
    var vc = porColuna[r.cidade], vu = porColuna[r.uf], pu = DET.perfil(u);
    for (var i = 0; i < n; i++) {
      if (!vc[i] || !vu[i]) continue;
      var ufs = DET.ufsDaCidade(vc[i].v);
      if (ufs) vu[i] = G.formatarUF(pu, ufs[0]);
    }
  });
  // Formato do código conforme a opção da mesma linha (ex.: MINUTA → MIN-0000).
  rels.forEach(function (r) {
    if (r.tipo !== 'formatoPorOpcao') return;
    var k = cols[r.cat], x = cols[r.dep];
    if (!ativa(k, 'categoria') || !ativa(x, 'codigo')) return;
    var pk = DET.perfil(k), px = DET.perfil(x), vk = porColuna[r.cat], vx = porColuna[r.dep];
    for (var i = 0; i < n; i++) {
      if (!vk[i] || !vx[i]) continue;
      var chave = chaveDaOpcao(pk, vk[i]);
      var mascara = chave && r.mapa[chave];
      if (mascara) vx[i] = G.codigoComMascara(px, mascara, rng, ctx);
    }
  });
  // Data que vem depois de outra, com a diferença típica do original.
  rels.forEach(function (r) {
    if (r.tipo !== 'ordemData' || !r.qDelta) return;
    var a = cols[r.antes], b = cols[r.depois];
    if (!a || !b || a.manter || b.manter || DET.FAMILIA[a.tipo] !== 'data' || DET.FAMILIA[b.tipo] !== 'data' || a.tipo === 'hora' || b.tipo === 'hora') return;
    var pb = DET.perfil(b), va = porColuna[r.antes], vb = porColuna[r.depois];
    if (pb.arm !== 'nativo' || DET.perfil(a).arm !== 'nativo') return;
    for (var i = 0; i < n; i++) {
      if (!va[i] || !vb[i]) continue;
      var novo = null;
      for (var t = 0; t < 40 && novo == null; t++) {
        var delta = t < 15 ? G.sortearPorQuantis(r.qDelta, rng) : r.qDelta[20] + (t - 14);
        var x = va[i].v + Math.max(0, delta);
        x = b.tipo === 'data' ? Math.round(x) : G.arredondarTempo(x, pb.segundos);
        var k = b.tipo === 'data' ? Math.floor(x) : U.chaveTempo(x);
        if (!pb.reais.has(k)) novo = x;
      }
      if (novo != null) vb[i] = { t: 'n', v: novo, z: vb[i].z || pb.z };
    }
  });
  // Contas entre colunas: total = qtd × preço, total = frete + imposto, líquido = bruto − desconto.
  // Duas voltas, para contas encadeadas (ex.: imposto = frete × alíquota e total = frete + imposto).
  var pendentes = rels.filter(function (r) { return r.tipo === 'conta'; });
  for (var volta = 0; volta < 2 && pendentes.length; volta++) {
    pendentes.forEach(function (r) {
      var ca = cols[r.a], cb = cols[r.b], cc = cols[r.c];
      if (!ca || !cb || !cc || cc.manter || DET.FAMILIA[cc.tipo] !== 'numero' || DET.FAMILIA[ca.tipo] !== 'numero' || DET.FAMILIA[cb.tipo] !== 'numero') return;
      var pc = DET.perfil(cc), pb = DET.perfil(cb), va = porColuna[r.a], vb = porColuna[r.b], vc = porColuna[r.c];
      if (pc.arm !== 'nativo') return;
      for (var i = 0; i < n; i++) {
        if (!va[i] || !vb[i] || !vc[i] || va[i].t !== 'n' || vb[i].t !== 'n') continue;
        for (var t = 0; t < 12; t++) {
          var res = U.arredondar(conta(r.op, va[i].v, vb[i].v), pc.casas);
          if (res === 0 || !pc.reais.has(U.chaveNumero(res, pc.casas)) || cb.manter) { vc[i] = { t: 'n', v: res, z: vc[i].z }; break; }
          var novoB = A.geradores.gerarValores(pb, 1, rng, ctx)[0];
          if (novoB && novoB.t === 'n') vb[i] = novoB;
        }
      }
    });
  }
}

function conta(op, a, b) { return op === 'produto' ? a * b : op === 'soma' ? a + b : a - b; }

// Chave (no original) da opção gerada, também quando os rótulos foram trocados por "Categoria A".
function chaveDaOpcao(pk, cel) {
  if (!pk.opcoes) return null;
  if (pk.rotulosReais) return A.detectar.chaveCelula(cel);
  for (var i = 0; i < pk.opcoes.length; i++) {
    if (cel.v === 'Categoria ' + U.letraColuna(i)) return A.detectar.chaveCelula(pk.opcoes[i].cel);
  }
  return null;
}

function montarAba(aba, n, rng, ctx) {
  var DET = A.detectar;
  var ws = {};
  var maxR = 0, maxC = 0, tem = false;
  function por(r, c, cel) {
    // O Excel guarda no máximo 32.767 caracteres por célula (um arquivo danificado pode trazer mais)
    if (cel && typeof cel.v === 'string' && cel.v.length > 32767) cel = Object.assign({}, cel, { v: cel.v.slice(0, 32767) });
    ws[XLSX.utils.encode_cell({ r: r, c: c })] = cel;
    if (r > maxR) maxR = r;
    if (c > maxC) maxC = c;
    tem = true;
  }
  var lc = aba.linhaCab;
  var primeiro = true;
  for (var r = 0; r < lc; r++) {
    var linha = aba.linhas[r];
    if (!linha) continue;
    for (var c = 0; c < linha.length; c++) {
      if (DET.celulaVazia(linha[c])) continue;
      por(r, c, { t: 's', v: primeiro ? TITULO : INFO });
      primeiro = false;
    }
  }
  if (lc >= 0 && aba.colunas.length) {
    var porColuna = {};
    for (var i = 0; i < aba.colunas.length; i++) {
      porColuna[aba.colunas[i].c] = A.geradores.gerarColuna(aba.colunas[i], n, rng, ctx);
    }
    aplicarRelacoes(aba, porColuna, n, rng, ctx);
    for (i = 0; i < aba.colunas.length; i++) {
      var col = aba.colunas[i];
      if (col.cab) por(lc, col.c, copiaCabecalho(col.cab));
      var valores = porColuna[col.c];
      for (var j = 0; j < n; j++) if (valores[j]) por(lc + 1 + j, col.c, valores[j]);
    }
    maxR = Math.max(maxR, lc + n);
    maxC = Math.max(maxC, aba.cMax);
    tem = true;
  }
  ws['!ref'] = tem ? XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } }) : 'A1';
  var merges = (aba.merges || []).filter(function (m) {
    return lc >= 0 && (m.e.r < lc || (m.s.r === lc && m.e.r === lc));
  }).map(function (m) {
    return { s: { r: m.s.r, c: m.s.c }, e: { r: m.e.r, c: m.e.c } };
  });
  if (merges.length) ws['!merges'] = merges;
  if (aba.cols && aba.cols.length) {
    var cols = [];
    for (var k = 0; k < aba.cols.length; k++) if (aba.cols[k]) cols[k] = Object.assign({}, aba.cols[k]);
    ws['!cols'] = cols;
  }
  return ws;
}

// Nomes de aba que o Excel aceita: até 31 caracteres, sem : \ / ? * [ ], sem apóstrofo nas pontas, sem
// repetir (maiúsculas e minúsculas contam como iguais) e diferentes de "History", que o Excel reserva.
// Nomes que já são válidos ficam como estão; um arquivo danificado pode trazer nomes que não são.
function nomesDeAba(abas) {
  var usados = { history: true };
  return abas.map(function (aba) {
    var base = A.leitura.nomeAbaValido(aba.nome), nome = base, k = 2;
    while (usados[nome.toLowerCase()]) {
      var sufixo = ' (' + (k++) + ')';
      nome = base.slice(0, 31 - sufixo.length).replace(/'+$/, '') + sufixo;
    }
    usados[nome.toLowerCase()] = true;
    return nome;
  });
}

function montar(arquivo, n, semente) {
  var rng = U.criarAleatorio(semente);
  var ctx = { textosReais: arquivo.textosReais || new Set() };
  var wb = { SheetNames: [], Sheets: {}, Workbook: { Sheets: [], WBProps: { date1904: false } } };
  var nomes = nomesDeAba(arquivo.abas);
  for (var i = 0; i < arquivo.abas.length; i++) {
    var aba = arquivo.abas[i];
    wb.SheetNames.push(nomes[i]);
    wb.Sheets[nomes[i]] = montarAba(aba, n, rng, ctx);
    wb.Workbook.Sheets.push({ name: nomes[i], Hidden: aba.oculta || 0 });
  }
  return { wb: wb, semente: rng.semente };
}

function gerar(arquivo, n, semente) {
  var r = montar(arquivo, n, semente);
  var bytes = XLSX.write(r.wb, { bookType: 'xlsx', type: 'array', compression: true });
  return { bytes: bytes, nome: nomeSaida(arquivo), wb: r.wb, semente: r.semente };
}

A.saida = {
  TITULO: TITULO,
  INFO: INFO,
  nomeSaida: nomeSaida,
  montar: montar,
  gerar: gerar
};
