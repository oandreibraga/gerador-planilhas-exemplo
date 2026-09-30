// Modo "arquivo inteiro" (pseudonimização): troca os dados sensíveis no arquivo todo, mantendo o resto.
// .xlsx/.xlsm: edita o arquivo por dentro, em fluxo — só as células das colunas escolhidas mudam; estilos,
// mesclagens, larguras, fórmulas e imagens ficam como estão. A tabela de textos compartilhados é refeita
// (sem sobrar nenhum texto antigo). Metadados são limpos e partes que podem esconder dados (comentários,
// miniatura, macros, vínculos externos, tabelas dinâmicas) são removidas. Partes desconhecidas: o arquivo é
// recusado (o que não conhecemos não passa). .csv: reescrito no mesmo separador e codificação.
import { A } from '../nucleo/amostra.js';

var X, Z, U;
function iniciar() { X = A.xml; Z = A.zipFluxo; U = A.util; }

function erro(tipo, mensagem, detalhe) {
  var e = new Error(mensagem);
  e.tipo = tipo;
  e.detalhe = detalhe || '';
  e.amigavel = true;
  return e;
}

// ---------- ações por coluna ----------
var PSEUDONIMIZAVEIS = { pessoa: 1, empresa: 1, cpf: 1, cnpj: 1, email: 1, telefone: 1, cep: 1, endereco: 1, bairro: 1, cidade: 1, chave: 1, codigo: 1, texto: 1 };
var TEXTUAIS = { pessoa: 1, empresa: 1, email: 1, endereco: 1, bairro: 1, cidade: 1, texto: 1 };
var POR_PADRAO = { pessoa: 1, empresa: 1, cpf: 1, cnpj: 1, email: 1, telefone: 1, cep: 1, endereco: 1, bairro: 1, chave: 1, codigo: 1, texto: 1 };

function acaoPadrao(tipo) { return POR_PADRAO[tipo] ? 'pseudonimizar' : 'manter'; }
function acoesPossiveis(tipo) {
  var fam = A.detectar.FAMILIA[tipo];
  if (PSEUDONIMIZAVEIS[tipo]) return ['pseudonimizar', 'manter', 'limpar'];
  if (fam === 'numero' || fam === 'data') return ['manter', 'generalizar', 'limpar'];
  return ['manter', 'limpar'];
}

// ---------- caminhos e relações (Open Packaging Conventions) ----------
function dirDe(p) { var i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i + 1); }
function resolver(base, alvo) {
  if (alvo.charAt(0) === '/') return alvo.slice(1);
  var saida = [];
  (base + alvo).split('/').forEach(function (s) { if (s === '..') saida.pop(); else if (s !== '.' && s !== '') saida.push(s); });
  return saida.join('/');
}
function origemDoRels(rels) { var m = /^(.*?)_rels\/(.*)\.rels$/.exec(rels); return m ? m[1] + m[2] : null; }

function tokens(texto) {
  var lista = [];
  var l = X.criarLeitor(function (t) { lista.push(t); });
  l.escrever(texto);
  l.fim();
  return lista;
}

function lerRels(texto, origem) {
  var base = dirDe(origem || '');
  return tokens(texto).filter(function (t) { return t.k === 'abre' && X.local(t.nome) === 'Relationship'; }).map(function (t) {
    var a = X.atributos(t.bruto), externo = a.TargetMode === 'External';
    return { id: a.Id, tipo: String(a.Type || '').split('/').pop(), alvo: externo ? null : resolver(base, a.Target || ''), externo: externo, bruto: t.bruto };
  });
}

// ---------- política das partes do arquivo ----------
var POLITICA = [
  [/^\[Content_Types\]\.xml$/, 'tipos'],
  [/(^|\/)_rels\/[^/]*\.rels$/, 'rels'],
  [/^docProps\/core\.xml$/, 'core'],
  [/^docProps\/app\.xml$/, 'app'],
  [/^docProps\/custom\.xml$/, 'remover', 'propriedades personalizadas do documento'],
  [/^docProps\/thumbnail\.[A-Za-z]+$/, 'remover', 'miniatura da primeira aba'],
  [/^xl\/workbook\.xml$/, 'workbook'],
  [/^xl\/worksheets\/[^/]+\.xml$/, 'planilha'],
  [/^xl\/sharedStrings\.xml$/, 'sst'],
  [/^xl\/(styles|metadata|sheetMetadata)\.xml$/, 'copiar'],
  [/^xl\/theme\/[^/]+\.xml$/, 'copiar'],
  [/^xl\/featurePropertyBag\/[^/]+$/, 'copiar'],
  [/^xl\/media\/[^/]+$/, 'copiar'],
  [/^xl\/chartsheets\/[^/]+\.xml$/, 'copiar'],
  [/^xl\/charts\/(colors|style)[^/]*\.xml$/, 'copiar'],
  [/^xl\/drawings\/drawing[^/]*\.xml$/, 'desenho'],
  [/^xl\/charts\/chart[^/]*\.xml$/, 'grafico'],
  [/^xl\/tables\/[^/]+\.xml$/, 'tabela'],
  [/^xl\/calcChain\.xml$/, 'remover'],
  [/^xl\/printerSettings\/[^/]+$/, 'remover'],
  [/^xl\/drawings\/vmlDrawing[^/]*\.vml$/, 'remover', 'comentários (notas)'],
  [/^xl\/comments[^/]*\.xml$/, 'remover', 'comentários (notas)'],
  [/^xl\/threadedComments\/[^/]+\.xml$/, 'remover', 'comentários'],
  [/^xl\/persons\/[^/]+\.xml$/, 'remover', 'autores dos comentários'],
  [/^xl\/pivotTables\/[^/]+\.xml$/, 'remover', 'tabelas dinâmicas (o resultado já calculado nas células foi tratado como o resto da aba)'],
  [/^xl\/pivotCache\/[^/]+\.xml$/, 'remover', 'tabelas dinâmicas (o resultado já calculado nas células foi tratado como o resto da aba)'],
  [/^xl\/externalLinks\/[^/]+\.xml$/, 'remover', 'vínculos com outros arquivos'],
  [/^xl\/vbaProject(Signature)?\.bin$/, 'remover', 'macros (o arquivo gerado é .xlsx)'],
  [/^customUI\/.+$/, 'remover', 'personalização da faixa de opções'],
  [/^customXml\/.+$/, 'remover', 'dados XML personalizados'],
  [/^xl\/(connections\.xml|queryTables\/.+)$/, 'bloquear', 'conexões de dados (Power Query ou consultas externas)'],
  [/^xl\/revisions\/.+$/, 'bloquear', 'histórico de alterações de pasta compartilhada'],
  [/^xl\/model\/.+$/, 'bloquear', 'modelo de dados (Power Pivot)'],
  [/^xl\/(slicers|slicerCaches|timelines|timelineCaches)\/.+$/, 'bloquear', 'segmentações de dados ou linhas do tempo'],
  [/^xl\/(activeX|ctrlProps)\/.+$/, 'bloquear', 'controles de formulário ou ActiveX'],
  [/^xl\/embeddings\/.+$/, 'bloquear', 'objetos incorporados (outros arquivos dentro da planilha)'],
  [/^xl\/(richData|webextensions)\/.+$/, 'bloquear', 'tipos de dados vinculados ou suplementos'],
  [/^xl\/(macrosheets|dialogsheets)\/.+$/, 'bloquear', 'macros antigas (Excel 4.0)']
];
function classificar(nome) {
  if (/\/$/.test(nome)) return { acao: 'pasta' };
  for (var i = 0; i < POLITICA.length; i++) if (POLITICA[i][0].test(nome)) return { acao: POLITICA[i][1], motivo: POLITICA[i][2] };
  return { acao: 'bloquear', motivo: 'parte desconhecida: ' + nome };
}

// ---------- tabela de textos compartilhados ----------
async function lerSst(blob, e) {
  var xml = [], textos = [], raiz = null, nomeRaiz = 'sst', atual = null, emT = false, emFonetico = 0, textoAtual = '';
  var leitor = X.criarLeitor(function (t) {
    var n = t.k === 'abre' || t.k === 'fecha' ? X.local(t.nome) : '';
    if (!raiz && t.k === 'abre' && n === 'sst') { raiz = t.bruto; nomeRaiz = t.nome; return; }
    if (t.k === 'abre' && n === 'si') { atual = [t.bruto]; textoAtual = ''; if (t.vazio) { xml.push(t.bruto); textos.push(''); atual = null; } return; }
    if (!atual) return;
    atual.push(t.bruto);
    if (n === 'rPh') emFonetico += t.k === 'abre' && !t.vazio ? 1 : t.k === 'fecha' ? -1 : 0;
    if (n === 't') emT = t.k === 'abre' && !t.vazio;
    else if (t.k === 'texto' && emT && !emFonetico) textoAtual += X.decodificar(t.bruto);
    if (t.k === 'fecha' && n === 'si') { xml.push(atual.join('')); textos.push(textoAtual); atual = null; }
  });
  await Z.textoEmPedacos(blob, e, function (s) { leitor.escrever(s); });
  leitor.fim();
  return { raiz: raiz || '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">', nome: nomeRaiz, xml: xml, textos: textos };
}

// ---------- células ----------

// Lê os tokens de uma célula (<c>…</c>) e devolve o essencial.
// Célula = tag de abertura + conteúdo capturado até </c> (fórmula, valor, texto em linha, extensões).
// Dentro de uma célula, "<" só aparece em tags (no texto ele vem escapado), então buscas diretas bastam.
var RE_F = /<(?:[\w.-]+:)?f(?:\s[^>]*)?(?:\/>|>[\s\S]*?<\/(?:[\w.-]+:)?f>)/;
var RE_V = /<(?:[\w.-]+:)?v(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?v>/;
var RE_IS = /<(?:[\w.-]+:)?is(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?is>/;
var RE_RPH = /<(?:[\w.-]+:)?rPh[\s>][\s\S]*?<\/(?:[\w.-]+:)?rPh>/g;
var RE_TEXTO = /<(?:[\w.-]+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?t>/g;
var RE_EXT = /<(?:[\w.-]+:)?extLst[\s>][\s\S]*<\/(?:[\w.-]+:)?extLst>/;
function analisarCelula(abre, conteudo) {
  var attrs = X.atributosEmOrdem(abre), mapa = {};
  attrs.forEach(function (a) { mapa[X.local(a[0])] = a[1]; });
  var f = RE_F.exec(conteudo), v = RE_V.exec(conteudo), is = RE_IS.exec(conteudo), ext = RE_EXT.exec(conteudo);
  var cel = { attrs: attrs, a: mapa, f: f ? f[0] : null, v: v ? X.decodificar(v[1]) : null, texto: null, outros: ext ? [ext[0]] : [] };
  if (is) {
    var semFonetica = is[1].replace(RE_RPH, ''), txt = '', m;
    RE_TEXTO.lastIndex = 0;
    while ((m = RE_TEXTO.exec(semFonetica))) txt += X.decodificar(m[1]);
    cel.texto = txt;
  }
  return cel;
}
// Índice do texto compartilhado (<v>n</v>) de uma célula, sem analisar o resto.
function indiceSst(conteudo) {
  var v = RE_V.exec(conteudo);
  return v ? parseInt(v[1], 10) : -1;
}

// Valor da célula no formato usado pelo resto do app: {t: 's'|'n'|'b'|'e', v}.
function valorDe(cel, sst) {
  var t = cel.a.t || 'n';
  if (t === 's') { var i = parseInt(cel.v, 10); return sst && sst.textos[i] != null ? { t: 's', v: sst.textos[i], sst: i } : null; }
  if (t === 'inlineStr') return cel.texto != null ? { t: 's', v: cel.texto } : null;
  if (t === 'str') return cel.v != null ? { t: 's', v: cel.v } : null;
  if (t === 'b') return cel.v != null ? { t: 'b', v: cel.v === '1' } : null;
  if (t === 'e') return null;
  if (cel.v == null || cel.v === '') return null;
  var n = Number(cel.v);
  return isFinite(n) ? { t: 'n', v: n } : { t: 's', v: cel.v };
}

// ---------- regras por aba ----------
function regrasDaAba(aba, acoes) {
  var r = { linhaCab: aba ? aba.linhaCab : -1, colunas: {}, nome: aba ? aba.nome : null };
  if (!aba) return r;
  (aba.colunas || []).forEach(function (col) {
    var acao = (acoes && acoes[col.c]) || acaoPadrao(col.tipo);
    var perfil = null;
    if (acao === 'pseudonimizar' && col.tipo === 'codigo' && col.valores) { try { perfil = A.detectar.perfil(col); } catch (e) { perfil = null; } }
    r.colunas[col.c] = { acao: acao, classe: col.tipo, perfil: perfil, tipo: col.tipo, nome: col.nome, letra: col.letra, trocadas: 0 };
  });
  return r;
}
// Regra para uma célula: coluna conhecida abaixo do cabeçalho segue a coluna; textos em qualquer outro lugar
// (acima do cabeçalho, fora da tabela, abas sem tabela) são trocados por texto inventado; o cabeçalho fica.
var REGRA_TEXTO_SOLTO = { acao: 'pseudonimizar', classe: 'texto', solta: true, trocadas: 0 };
function regraPara(regras, r, c, val) {
  if (r === regras.linhaCab) return null;
  if (r > regras.linhaCab && regras.linhaCab >= 0 && regras.colunas[c]) return regras.colunas[c];
  return val && val.t === 's' ? REGRA_TEXTO_SOLTO : null;
}

function generalizar(regra, val) {
  if (!val || val.t !== 'n') return val;
  var fam = A.detectar.FAMILIA[regra.tipo];
  if (fam === 'data' && val.v >= 1) {
    var p = U.partesDeSerial(val.v);
    return { t: 'n', v: U.serialDeData(p.y, p.m, 1) };
  }
  if (fam === 'data') return val;
  if (!val.v) return val;
  return { t: 'n', v: Number(val.v.toPrecision(2)) };
}

// ---------- motor .xlsx ----------
async function processarXlsx(blob, modelo, opcoes) {
  if (!X) iniciar();
  opcoes = opcoes || {};
  var progresso = opcoes.progresso || function () {};
  var medir = opcoes.medir || function () {}; // medir(etapa): tempos por etapa, para testes de desempenho
  var indice = await Z.indice(blob), porNome = {};
  indice.forEach(function (e) { porNome[e.nome] = e; });
  if (!porNome['[Content_Types].xml'] || !porNome['xl/workbook.xml']) {
    throw erro('formato', 'Este arquivo não parece ser uma planilha do Excel (.xlsx). Abra no Excel e salve como .xlsx.', 'sem workbook.xml');
  }

  // Inventário: o que fazer com cada parte
  var removidas = {}, motivosRemocao = {}, bloqueios = [];
  indice.forEach(function (e) {
    var p = classificar(e.nome);
    e.politica = p.acao;
    if (p.acao === 'remover') { removidas[e.nome] = true; if (p.motivo) motivosRemocao[p.motivo] = true; }
    if (p.acao === 'bloquear') bloqueios.push(p.motivo);
  });
  if (bloqueios.length) {
    var lista = Array.from(new Set(bloqueios));
    throw erro('recurso', 'Este arquivo tem recursos que a troca do arquivo inteiro ainda não trata com segurança: ' + lista.join('; ') +
      '. Salve uma cópia sem eles no Excel ou use a amostra fictícia.', lista.join(' | '));
  }
  // .rels de partes removidas também saem
  indice.forEach(function (e) {
    if (e.politica === 'rels') { var o = origemDoRels(e.nome); if (o && removidas[o]) removidas[e.nome] = true; }
  });

  // Relações: quais IDs deixam de existir em cada parte (alvo removido ou link externo)
  var relsPorOrigem = {}, idsRemovidos = {};
  for (var i = 0; i < indice.length; i++) {
    var e = indice[i];
    if (e.politica !== 'rels' || removidas[e.nome]) continue;
    var origem = origemDoRels(e.nome) || '';
    var rels = lerRels(await Z.texto(blob, e), origem);
    relsPorOrigem[origem] = { entrada: e, rels: rels };
    idsRemovidos[origem] = {};
    rels.forEach(function (r) {
      if ((r.alvo && removidas[r.alvo]) || (r.externo && r.tipo !== 'officeDocument')) {
        idsRemovidos[origem][r.id] = true;
        if (r.externo) motivosRemocao[r.tipo === 'hyperlink' ? 'links para sites e e-mails' : 'vínculos externos'] = true;
      }
    });
  }

  // Abas: nome → parte, pela ordem do workbook
  var wbTexto = await Z.texto(blob, porNome['xl/workbook.xml']);
  var wbRels = (relsPorOrigem['xl/workbook.xml'] || { rels: [] }).rels, alvoPorId = {};
  wbRels.forEach(function (r) { alvoPorId[r.id] = r.alvo; });
  var abasXml = tokens(wbTexto).filter(function (t) { return t.k === 'abre' && X.local(t.nome) === 'sheet'; }).map(function (t) {
    var a = X.atributos(t.bruto), id = a['r:id'] || Object.keys(a).filter(function (k) { return X.local(k) === 'id' && k !== 'sheetId'; }).map(function (k) { return a[k]; })[0];
    return { nome: a.name, parte: alvoPorId[id] };
  });
  var modeloPorNome = {};
  (modelo && modelo.abas || []).forEach(function (a) { modeloPorNome[a.nome] = a; });
  var regrasPorParte = {};
  abasXml.forEach(function (a) { if (a.parte) regrasPorParte[a.parte] = regrasDaAba(modeloPorNome[a.nome], opcoes.acoes && opcoes.acoes[a.nome]); });

  // Textos compartilhados e textos reais do arquivo inteiro (para o fictício nunca repetir um real)
  var sst = porNome['xl/sharedStrings.xml'] ? await lerSst(blob, porNome['xl/sharedStrings.xml']) : null;
  var textosReais = new Set();
  if (sst) sst.textos.forEach(function (t) { if (t) textosReais.add(t); });
  var P = A.pseudonimo.criar({ semente: opcoes.semente, textosReais: textosReais });
  medir('textos compartilhados');

  var planilhas = indice.filter(function (e) { return e.politica === 'planilha'; });
  // Passada única (padrão): os textos compartilhados já são todos os textos reais do arquivo; valores fora deles
  // são conferidos no fim e, se colidirem com um fictício, a troca é refeita em duas passadas.
  var passadaUnica = !opcoes.doisPassos && !!sst, tardios = [];
  var totalBytes = planilhas.reduce(function (s, e) { return s + e.tamanho; }, 0) * (passadaUnica ? 1 : 2) || 1, feitos = 0;

  // Passo 1: registra os valores reais de todas as células que serão trocadas (o arquivo inteiro) e marca
  // quais textos compartilhados continuam em uso por células que ficam.
  var sstMantidos = sst ? new Uint8Array(sst.xml.length) : null;
  function marcarMantido(conteudo) {
    var k2 = indiceSst(conteudo);
    if (k2 >= 0 && k2 < sstMantidos.length) sstMantidos[k2] = 1;
  }
  if (passadaUnica) P.registrarFundo(sst.textos);
  for (var k = 0; !passadaUnica && k < planilhas.length; k++) {
    var regras = regrasPorParte[planilhas[k].nome] || regrasDaAba(null);
    await percorrerCelulas(blob, planilhas[k], regras, function (abre, conteudo, tri) {
      if (tri.tipo === 's' && sst) {
        // Caminho rápido (o mais comum): texto compartilhado, lido direto pelo índice
        var idx = indiceSst(conteudo), valS = idx >= 0 && sst.textos[idx] != null ? { t: 's', v: sst.textos[idx] } : null;
        if (!tri.analisar || !vaiTrocar(tri.regra, valS)) { marcarMantido(conteudo); return; }
        if (tri.regra.acao === 'pseudonimizar') P.registrarReal(tri.regra.classe, valS);
        return;
      }
      if (!tri.analisar && tri.tipo !== 'inlineStr') return;
      var cel = analisarCelula(abre, conteudo), val = valorDe(cel, sst);
      if (val && val.t === 's' && val.sst == null && val.v) textosReais.add(val.v);
      var regra = tri.analisar ? tri.regra : null;
      if (!vaiTrocar(regra, val)) { if (tri.tipo === 's' && sst) marcarMantido(conteudo); return; }
      if (regra.acao === 'pseudonimizar') P.registrarReal(regra.classe, val);
    }, function (n) { feitos += n; progresso(feitos / totalBytes); });
  }

  medir('passo 1 (valores reais)');
  // Passo 2: monta o arquivo novo. Os textos compartilhados mantêm os índices; os que não são mais usados por
  // nenhuma célula que fica viram vazios (nenhum texto antigo sobra) e os fictícios entram no fim.
  var esc = Z.criarEscritor();
  var novosTextos = [], porTexto = new Map(), baseSst = sst ? sst.xml.length : 0;
  var pfxSst = sst && sst.nome.indexOf(':') > 0 ? sst.nome.slice(0, sst.nome.indexOf(':') + 1) : '';
  function indiceNovo(texto) {
    var n = porTexto.get(texto);
    if (n === undefined) {
      n = baseSst + novosTextos.length;
      novosTextos.push('<' + pfxSst + 'si><' + pfxSst + 't xml:space="preserve">' + X.escapar(texto) + '</' + pfxSst + 't></' + pfxSst + 'si>');
      porTexto.set(texto, n);
    }
    return n;
  }
  var relatorio = { abas: [], formulas: 0, removidas: [], avisos: [], imagens: 0, textosSoltos: 0 };

  for (var j = 0; j < indice.length; j++) {
    var ent = indice[j], pol = ent.politica;
    if (removidas[ent.nome] || pol === 'pasta' || pol === 'sst') continue;
    if (pol === 'copiar') {
      if (/^xl\/media\//.test(ent.nome)) relatorio.imagens++;
      await esc.copiar(blob, ent);
    } else if (pol === 'planilha') {
      var rg = regrasPorParte[ent.nome] || regrasDaAba(null);
      var info = { parte: ent.nome, trocadas: 0, formulas: 0 };
      await reescreverPlanilha(blob, ent, esc, {
        regras: rg, sst: sst, P: P, removidos: idsRemovidos[ent.nome] || {}, info: info, indiceNovo: indiceNovo,
        marcar: sst ? marcarMantido : function () {}, unica: passadaUnica, tardios: tardios,
        progresso: function (n) { feitos += n; progresso(Math.min(0.99, feitos / totalBytes)); }
      });
      relatorio.formulas += info.formulas;
      var nomeAba = (abasXml.filter(function (a) { return a.parte === ent.nome; })[0] || {}).nome || ent.nome;
      relatorio.abas.push({
        nome: nomeAba,
        trocadas: info.trocadas,
        colunas: Object.keys(rg.colunas).map(function (c) { var x = rg.colunas[c]; return { letra: x.letra, nome: x.nome, tipo: x.tipo, acao: x.acao, trocadas: x.trocadas }; })
      });
    } else if (pol === 'rels') {
      var origemR = origemDoRels(ent.nome) || '';
      await esc.adicionar(ent.nome, reescreverRels(await Z.texto(blob, ent), idsRemovidos[origemR] || {}), ent);
    } else if (pol === 'tipos') {
      await esc.adicionar(ent.nome, reescreverTipos(await Z.texto(blob, ent), removidas), ent);
    } else if (pol === 'workbook') {
      await esc.adicionar(ent.nome, reescreverWorkbook(wbTexto, idsRemovidos['xl/workbook.xml'] || {}), ent);
    } else if (pol === 'core') {
      await esc.adicionar(ent.nome, CORE_VAZIO, ent);
    } else if (pol === 'app') {
      await esc.adicionar(ent.nome, APP_VAZIO, ent);
    } else if (pol === 'desenho' || pol === 'grafico' || pol === 'tabela') {
      await esc.adicionar(ent.nome, reescreverTextos(await Z.texto(blob, ent), pol, P, idsRemovidos[ent.nome] || {}, relatorio), ent);
    } else {
      throw erro('recurso', 'Parte não tratada: ' + ent.nome, ent.nome);
    }
  }
  if (passadaUnica && P.colisao(tardios)) {
    // Um valor real que só apareceu no meio do arquivo coincidiu com um fictício: refaz lendo tudo antes
    return processarXlsx(blob, modelo, Object.assign({}, opcoes, { doisPassos: true }));
  }
  // Textos compartilhados por último (os índices foram definidos ao reescrever as abas)
  if (sst) {
    var raiz = X.tag(sst.nome, X.atributosEmOrdem(sst.raiz).filter(function (a) { return a[0] !== 'count' && a[0] !== 'uniqueCount'; })
      .concat([['uniqueCount', String(baseSst + novosTextos.length)]]), false);
    var vazio = '<' + pfxSst + 'si><' + pfxSst + 't></' + pfxSst + 't></' + pfxSst + 'si>';
    var partesSst = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n', raiz];
    for (var s2 = 0; s2 < baseSst; s2++) partesSst.push(sstMantidos[s2] ? sst.xml[s2] : vazio);
    partesSst = partesSst.concat(novosTextos, ['</' + sst.nome + '>']);
    // Junta em blocos de ~1 MB: um Blob com centenas de milhares de pedaços pequenos vira um fluxo lento
    var blocos = [], atualB = [], tamB = 0;
    for (var b2 = 0; b2 < partesSst.length; b2++) {
      atualB.push(partesSst[b2]); tamB += partesSst[b2].length;
      if (tamB > 1048576) { blocos.push(atualB.join('')); atualB = []; tamB = 0; }
    }
    if (atualB.length) blocos.push(atualB.join(''));
    await esc.adicionarFluxo('xl/sharedStrings.xml', new Blob(blocos).stream(), porNome['xl/sharedStrings.xml']);
  }
  medir('passo 2 (reescrita)');
  progresso(1);

  relatorio.removidas = Object.keys(motivosRemocao);
  relatorio.pseudonimos = P.estatisticas();
  relatorio.textosSoltos += REGRA_TEXTO_SOLTO.trocadas;
  REGRA_TEXTO_SOLTO.trocadas = 0;
  if (relatorio.formulas) relatorio.avisos.push(relatorio.formulas + ' fórmula(s) em colunas trocadas foram mantidas e serão recalculadas quando o arquivo for aberto.');
  if (relatorio.imagens) relatorio.avisos.push(relatorio.imagens + ' imagem(ns) foram mantidas como estão: confira se não mostram dados reais.');
  return { blob: esc.finalizar(), relatorio: relatorio, nome: nomeSaida(modelo, 'xlsx') };
}

function nomeSaida(modelo, ext) {
  var base = (modelo && modelo.base) || 'planilha';
  return base + '_pseudonimizado.' + ext;
}

// Triagem rápida de uma célula pela tag de abertura (sem analisar o conteúdo): posição, tipo e regra.
// `analisar` = a célula talvez mude (ou é fórmula com resultado em texto) e precisa ser lida por inteiro;
// as demais — a grande maioria — são copiadas como estão.
var RE_REF = /\sr="([A-Za-z]{1,3})(\d+)"/, RE_TIPO = /\st="([A-Za-z]+)"/;
function indiceColuna(letras) {
  var c = 0;
  for (var i = 0; i < letras.length; i++) c = c * 26 + ((letras.charCodeAt(i) | 32) - 96);
  return c - 1;
}
function triagem(bruto, R, pos) {
  var m = RE_REF.exec(bruto), tm = RE_TIPO.exec(bruto), tipo = tm ? tm[1] : 'n';
  if (m) { pos.col = indiceColuna(m[1]); pos.linhaCel = parseInt(m[2], 10) - 1; } else { pos.col++; pos.linhaCel = pos.linha; }
  var texto = tipo === 's' || tipo === 'inlineStr' || tipo === 'str';
  var regra = regraPara(R, pos.linhaCel, pos.col, { t: texto ? 's' : 'n' });
  return {
    tipo: tipo, r: pos.linhaCel, c: pos.col, regra: regra,
    analisar: tipo === 'str' || !!(regra && regra.acao !== 'manter' && !(regra.acao === 'pseudonimizar' && TEXTUAIS[regra.classe] && !texto))
  };
}
function vaiTrocar(regra, val) {
  return !!(regra && regra.acao !== 'manter' && val && !(regra.acao === 'pseudonimizar' && TEXTUAIS[regra.classe] && val.t !== 's'));
}

// Percorre as células de uma aba (sem escrever nada): aoCelula(tagDeAbertura, conteúdo, triagem).
async function percorrerCelulas(blob, e, R, aoCelula, aoAvanco) {
  var abre = null, pos = { linha: -1, col: -1, linhaCel: -1 };
  var leitor = X.criarLeitor(function (t) {
    if (t.k === 'conteudo') { var a = abre; abre = null; aoCelula(a, t.bruto, triagem(a, R, pos)); return; }
    if (t.k !== 'abre') return;
    var n = X.local(t.nome);
    if (n === 'row') { var ar = /\sr="(\d+)"/.exec(t.bruto); pos.linha = ar ? parseInt(ar[1], 10) - 1 : pos.linha + 1; pos.col = -1; }
    else if (n === 'c') { if (t.vazio) triagem(t.bruto, R, pos); else { abre = t.bruto; leitor.capturar(t.nome); } }
  });
  await Z.textoEmPedacos(blob, e, function (s) { leitor.escrever(s); aoAvanco(s.length); });
  leitor.fim();
}

// Reescreve uma aba em fluxo, trocando as células conforme as regras.
async function reescreverPlanilha(blob, e, esc, o) {
  var R = o.regras, removidos = o.removidos;
  var pos = { linha: -1, col: -1, linhaCel: -1 }, abreCel = null, pular = 0, saida = [];
  var ELEMENTOS_REF = { legacyDrawing: 1, legacyDrawingHF: 1, hyperlink: 1 };

  function refRemovida(bruto) {
    var a = X.atributos(bruto);
    for (var k in a) if (X.local(k) === 'id' && removidos[a[k]]) return true;
    return false;
  }
  function escreverCelula(abre, nomeC, conteudo) {
    var tri = triagem(abre, R, pos);
    if (!tri.analisar) { if (tri.tipo === 's') o.marcar(conteudo); saida.push(abre + conteudo); return; } // fica como está
    if (tri.tipo === 's' && o.sst && tri.regra.acao === 'pseudonimizar') {
      // Caminho rápido: texto compartilhado trocado por outro texto; a tag de abertura (estilo etc.) fica igual
      var idx = indiceSst(conteudo), valS = idx >= 0 && o.sst.textos[idx] != null ? { t: 's', v: o.sst.textos[idx] } : null;
      if (!vaiTrocar(tri.regra, valS)) { o.marcar(conteudo); saida.push(abre + conteudo); return; }
      var novoS = o.P.trocar(tri.regra.classe, valS, tri.regra.perfil);
      if (novoS && novoS.t === 's' && novoS.v != null && novoS.v !== '') {
        var p0 = nomeC.indexOf(':') > 0 ? nomeC.slice(0, nomeC.indexOf(':') + 1) : '';
        tri.regra.trocadas++;
        o.info.trocadas++;
        saida.push(abre + '<' + p0 + 'v>' + o.indiceNovo(String(novoS.v).slice(0, 32767)) + '</' + p0 + 'v></' + nomeC + '>');
        return;
      }
    }
    var cel = analisarCelula(abre, conteudo), val = valorDe(cel, o.sst), regra = tri.regra;
    var trocar = vaiTrocar(regra, val);
    var pfx = nomeC.indexOf(':') > 0 ? nomeC.slice(0, nomeC.indexOf(':') + 1) : '';
    var attrs = cel.attrs.filter(function (a) { return X.local(a[0]) !== 't'; });
    if (!trocar && cel.f && (cel.a.t === 'str')) {
      // Fórmula com resultado em texto: o resultado guardado pode repetir um dado real (ex.: juntar nome e
      // sobrenome). Sai; o Excel recalcula ao abrir.
      o.info.formulas++;
      saida.push(X.tag(nomeC, attrs, false) + cel.f + cel.outros.join('') + '</' + nomeC + '>');
      return;
    }
    if (!trocar) { if (cel.a.t === 's') o.marcar(conteudo); saida.push(abre + conteudo); return; }
    if (o.unica && regra.acao === 'pseudonimizar' && val.sst == null) {
      // Valor fora dos textos compartilhados (número, texto na célula): registrado agora, conferido no fim
      o.P.registrarReal(regra.classe, val);
      o.tardios.push({ classe: regra.classe, cel: val });
    }
    regra.trocadas++;
    o.info.trocadas++;
    if (cel.f) {
      // Fórmula: mantém a fórmula e apaga o resultado guardado (o Excel recalcula ao abrir)
      o.info.formulas++;
      saida.push(X.tag(nomeC, attrs, false) + cel.f + cel.outros.join('') + '</' + nomeC + '>');
      return;
    }
    var novoVal = regra.acao === 'limpar' ? null : regra.acao === 'generalizar' ? generalizar(regra, val) : o.P.trocar(regra.classe, val, regra.perfil);
    var fim = '</' + nomeC + '>';
    if (!novoVal || novoVal.v == null || novoVal.v === '') { saida.push(X.tag(nomeC, attrs, true)); return; }
    if (novoVal.t === 'n') { saida.push(X.tag(nomeC, attrs, false) + '<' + pfx + 'v>' + numeroXml(novoVal.v) + '</' + pfx + 'v>' + fim); return; }
    if (novoVal.t === 'b') { saida.push(X.tag(nomeC, attrs.concat([['t', 'b']]), false) + '<' + pfx + 'v>' + (novoVal.v ? 1 : 0) + '</' + pfx + 'v>' + fim); return; }
    var texto = String(novoVal.v).slice(0, 32767);
    if (o.sst) saida.push(X.tag(nomeC, attrs.concat([['t', 's']]), false) + '<' + pfx + 'v>' + o.indiceNovo(texto) + '</' + pfx + 'v>' + fim);
    else saida.push(X.tag(nomeC, attrs.concat([['t', 'inlineStr']]), false) + '<' + pfx + 'is><' + pfx + 't xml:space="preserve">' + X.escapar(texto) + '</' + pfx + 't></' + pfx + 'is>' + fim);
  }

  var leitor = X.criarLeitor(function (t) {
    if (t.k === 'conteudo') { var ab = abreCel; abreCel = null; escreverCelula(ab.bruto, ab.nome, t.bruto); return; }
    var n = t.k === 'abre' || t.k === 'fecha' ? X.local(t.nome) : '';
    if (pular) { // dentro de um elemento que está sendo removido
      if (t.k === 'abre' && !t.vazio && n === pularNome) pular++;
      if (t.k === 'fecha' && n === pularNome) pular--;
      return;
    }
    if (t.k === 'abre' && n === 'c') {
      if (t.vazio) { saida.push(t.bruto); triagem(t.bruto, R, pos); }
      else { abreCel = t; leitor.capturar(t.nome); }
      return;
    }
    if (t.k === 'abre' && n === 'row') { var ar = /\sr="(\d+)"/.exec(t.bruto); pos.linha = ar ? parseInt(ar[1], 10) - 1 : pos.linha + 1; pos.col = -1; }
    // Remove: cabeçalho/rodapé de impressão, cenários (valores de entrada e usuário), filtros ativos (valores
    // filtrados), elementos que apontam para partes removidas; tira textos de exibição dos links que ficam.
    if (t.k === 'abre' && (n === 'headerFooter' || n === 'scenarios' || n === 'filterColumn' || n === 'protectedRanges' || n === 'customProperties' ||
        (ELEMENTOS_REF[n] && refRemovida(t.bruto)))) {
      if (!t.vazio) { pular = 1; pularNome = n; }
      return;
    }
    // Lista de links: só entra no arquivo se sobrar algum link (<hyperlinks> vazio é inválido no formato)
    if (t.k === 'abre' && n === 'hyperlinks' && !t.vazio) { links = { inicio: t.bruto, itens: [] }; return; }
    if (t.k === 'fecha' && n === 'hyperlinks' && links) {
      if (links.itens.length) saida.push(links.inicio + links.itens.join('') + t.bruto);
      links = null;
      return;
    }
    if (t.k === 'abre' && n === 'hyperlink') {
      var tagLink = X.tag(t.nome, X.atributosEmOrdem(t.bruto).filter(function (a) { return a[0] !== 'display' && a[0] !== 'tooltip'; }), t.vazio);
      if (links) links.itens.push(tagLink); else saida.push(tagLink);
      return;
    }
    if (t.k === 'abre' && n === 'pageSetup' && refRemovida(t.bruto)) {
      saida.push(X.tag(t.nome, X.atributosEmOrdem(t.bruto).filter(function (a) { return X.local(a[0]) !== 'id'; }), t.vazio));
      return;
    }
    if (links) { if (t.k !== 'texto' || t.bruto.trim()) links.itens.push(t.bruto); return; }
    saida.push(t.bruto);
  });
  var pularNome = '', links = null;

  // Uma etapa só: bytes → texto → reescrita → bytes (menos etapas de fluxo = menos custo por pedaço)
  var entrada = await Z.fluxo(blob, e), dec = new TextDecoder('utf-8'), enc = new TextEncoder();
  function descarregar(ctl) { if (saida.length) { ctl.enqueue(enc.encode(saida.join(''))); saida = []; } }
  var transformado = entrada.pipeThrough(new TransformStream({
    transform: function (pedaco, ctl) {
      var s = dec.decode(pedaco, { stream: true });
      leitor.escrever(s);
      o.progresso(s.length);
      descarregar(ctl);
    },
    flush: function (ctl) {
      var s = dec.decode();
      if (s) leitor.escrever(s);
      leitor.fim();
      descarregar(ctl);
    }
  }));
  try {
    await esc.adicionarFluxo(e.nome, transformado, e);
  } catch (err) {
    if (err && err.amigavel) throw err;
    throw erro('corrompido', 'O arquivo pode estar danificado. Tente abrir no Excel e salvar de novo como .xlsx.', e.nome + ': ' + ((err && err.message) || err));
  }
}

function numeroXml(v) {
  var s = String(v);
  return /e/i.test(s) ? v.toExponential().replace('e+', 'E').replace('e', 'E') : s;
}

// ---------- partes pequenas ----------
var CORE_VAZIO = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
  'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" ' +
  'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"></cp:coreProperties>';
var APP_VAZIO = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ' +
  'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Microsoft Excel</Application></Properties>';

function reescreverRels(texto, removidos) {
  return tokens(texto).filter(function (t) {
    return !(t.k === 'abre' && X.local(t.nome) === 'Relationship' && removidos[X.atributos(t.bruto).Id]);
  }).map(function (t) { return t.bruto; }).join('');
}

function reescreverTipos(texto, removidas) {
  return tokens(texto).map(function (t) {
    if (t.k === 'abre' && X.local(t.nome) === 'Override') {
      var a = X.atributos(t.bruto), parte = String(a.PartName || '').replace(/^\//, '');
      if (removidas[parte]) return '';
      if (/macroEnabled\.main\+xml$/.test(a.ContentType || '') && removidas['xl/vbaProject.bin']) {
        return t.bruto.replace(/application\/vnd\.ms-excel\.sheet\.macroEnabled\.main\+xml/, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml');
      }
    }
    return t.bruto;
  }).join('');
}

// workbook.xml: tira caminho local do arquivo, dados de compartilhamento e referências a partes removidas;
// pede recálculo ao abrir (os resultados guardados das fórmulas trocadas foram apagados).
function reescreverWorkbook(texto, removidos) {
  var toks = tokens(texto), saida = [], pular = 0, pularNome = '';
  var temCalc = toks.some(function (t) { return t.k === 'abre' && X.local(t.nome) === 'calcPr'; });
  var temNomes = toks.some(function (t) { return t.k === 'abre' && X.local(t.nome) === 'definedNames' && !t.vazio; });
  var calcAjustado = false;
  var REMOVER = { fileSharing: 1, absPath: 1, revisionPtr: 1 };
  for (var i = 0; i < toks.length; i++) {
    var t = toks[i], n = t.k === 'abre' || t.k === 'fecha' ? X.local(t.nome) : '';
    if (pular) {
      if (t.k === 'abre' && !t.vazio && n === pularNome) pular++;
      if (t.k === 'fecha' && n === pularNome) pular--;
      continue;
    }
    // Blocos mc:AlternateContent que só guardam o caminho local (x15ac:absPath) saem inteiros
    if (t.k === 'abre' && n === 'AlternateContent' && !t.vazio) {
      var fim = i, prof = 0, temAbs = false;
      for (; fim < toks.length; fim++) {
        var u = toks[fim], un = u.k === 'abre' || u.k === 'fecha' ? X.local(u.nome) : '';
        if (u.k === 'abre' && un === 'absPath') temAbs = true;
        if (u.k === 'abre' && un === 'AlternateContent' && !u.vazio) prof++;
        if (u.k === 'fecha' && un === 'AlternateContent' && --prof === 0) break;
      }
      if (temAbs) { i = fim; continue; }
    }
    if (t.k === 'abre' && (REMOVER[n] || ((n === 'pivotCache' || n === 'externalReference') && refRemovidaWb(t.bruto, removidos)))) {
      if (!t.vazio) { pular = 1; pularNome = n; }
      continue;
    }
    if (t.k === 'abre' && n === 'definedName' && !t.vazio) {
      // Nomes que apontam para outro arquivo ([1]Plan1!A1) deixam de funcionar sem o vínculo: saem
      var j = i + 1, conteudo = '';
      while (j < toks.length && !(toks[j].k === 'fecha' && X.local(toks[j].nome) === 'definedName')) { conteudo += toks[j].bruto; j++; }
      if (/\[\d+\]/.test(X.decodificar(conteudo)) && Object.keys(removidos).length) { i = j; continue; }
    }
    if (t.k === 'abre' && n === 'calcPr' && !calcAjustado) {
      calcAjustado = true;
      var attrs = X.atributosEmOrdem(t.bruto).filter(function (a) { return a[0] !== 'fullCalcOnLoad'; }).concat([['fullCalcOnLoad', '1']]);
      saida.push(X.tag(t.nome, attrs, t.vazio));
      continue;
    }
    saida.push(t.bruto);
    // Sem calcPr no original: entra logo depois de definedNames (ou de sheets), na ordem que o formato exige
    if (!temCalc && t.k === 'fecha' && (n === 'definedNames' || (n === 'sheets' && !temNomes))) {
      var pfx = t.nome.indexOf(':') > 0 ? t.nome.slice(0, t.nome.indexOf(':') + 1) : '';
      saida.push('<' + pfx + 'calcPr fullCalcOnLoad="1"/>');
      temCalc = true;
    }
  }
  var xml = saida.join('');
  // Listas que ficaram vazias (<pivotCaches></pivotCaches>) são inválidas: saem
  return xml.replace(/<(\w+:)?(pivotCaches|externalReferences)>\s*<\/(\w+:)?(pivotCaches|externalReferences)>/g, '');
}
function refRemovidaWb(bruto, removidos) {
  var a = X.atributos(bruto);
  for (var k in a) if (X.local(k) === 'id' && removidos[a[k]]) return true;
  return false;
}

// Desenhos, gráficos e tabelas: textos de caixas de texto e títulos viram textos inventados; valores
// guardados dos gráficos (caches) saem (o Excel refaz a partir das células); descrições de imagens saem;
// filtros ativos em tabelas saem; links externos saem.
function reescreverTextos(texto, politica, P, removidos, relatorio) {
  var toks = tokens(texto), saida = [], pular = 0, pularNome = '', emT = false;
  var CACHES = { strCache: 1, numCache: 1, multiLvlStrCache: 1, filterColumn: 1, externalData: 1 };
  for (var i = 0; i < toks.length; i++) {
    var t = toks[i], n = t.k === 'abre' || t.k === 'fecha' ? X.local(t.nome) : '';
    if (pular) {
      if (t.k === 'abre' && !t.vazio && n === pularNome) pular++;
      if (t.k === 'fecha' && n === pularNome) pular--;
      continue;
    }
    if (t.k === 'abre' && (CACHES[n] || ((n === 'hlinkClick' || n === 'hlinkHover') && refRemovidaWb(t.bruto, removidos)))) {
      if (!t.vazio) { pular = 1; pularNome = n; }
      continue;
    }
    if (t.k === 'abre' && n === 'cNvPr') {
      saida.push(X.tag(t.nome, X.atributosEmOrdem(t.bruto).filter(function (a) { return a[0] !== 'descr' && a[0] !== 'title'; }), t.vazio));
      continue;
    }
    // Imagem ligada a um endereço externo (r:link) que saiu: tira só o atributo
    if (t.k === 'abre' && refRemovidaWb(t.bruto, removidos)) {
      saida.push(X.tag(t.nome, X.atributosEmOrdem(t.bruto).filter(function (a) { return !removidos[a[1]] || !/^(id|link|embed)$/.test(X.local(a[0])); }), t.vazio));
      continue;
    }
    if (politica !== 'tabela' && n === 't' && t.k === 'abre') { emT = !t.vazio; saida.push(t.bruto); continue; }
    if (n === 't' && t.k === 'fecha') { emT = false; saida.push(t.bruto); continue; }
    if (emT && t.k === 'texto' && X.decodificar(t.bruto).trim()) {
      var novo = P.trocar('texto', { t: 's', v: X.decodificar(t.bruto) });
      relatorio.textosSoltos++;
      saida.push(X.escapar(novo.v));
      continue;
    }
    saida.push(t.bruto);
  }
  return saida.join('');
}

// ---------- motor .csv ----------
function codificarCp1252(texto) {
  var ESPECIAIS = { 0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89,
    0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96,
    0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F };
  var saida = new Uint8Array(texto.length), n = 0;
  for (var i = 0; i < texto.length; i++) {
    var c = texto.charCodeAt(i);
    saida[n++] = c < 0x80 || (c >= 0xA0 && c <= 0xFF) ? c : (ESPECIAIS[c] || 0x3F);
  }
  return saida.subarray(0, n);
}

function codificarUtf16le(texto) {
  var saida = new Uint8Array(texto.length * 2);
  for (var i = 0; i < texto.length; i++) { var c = texto.charCodeAt(i); saida[i * 2] = c & 0xFF; saida[i * 2 + 1] = c >> 8; }
  return saida;
}

async function processarCsv(blob, modelo, opcoes) {
  if (!X) iniciar();
  opcoes = opcoes || {};
  var bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.length > 300 * 1024 * 1024) throw erro('grande', 'Este .csv é grande demais para trocar inteiro no navegador (mais de 300 MB). Divida em arquivos menores.', 'csv > 300MB');
  var bom = bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF ? 'utf8' : bytes[0] === 0xFF && bytes[1] === 0xFE ? 'utf16' : null;
  var dec = A.leitura.decodificarCsv(bytes);
  var texto = dec.texto, sep = modelo.separador || A.leitura.detectarSeparador(texto);
  var quebra = /\r\n/.test(texto.slice(0, 100000)) ? '\r\n' : '\n';
  var aba = modelo.abas[0], regras = regrasDaAba(aba, opcoes.acoes && opcoes.acoes[aba.nome]);
  var registros = lerCsvCompleto(texto, sep);
  var textosReais = new Set();
  registros.forEach(function (reg) { reg.campos.forEach(function (c) { if (c.v) textosReais.add(c.v); }); });
  var P = A.pseudonimo.criar({ semente: opcoes.semente, textosReais: textosReais });

  function valorCsv(v) { return v === '' ? null : { t: 's', v: v }; }
  function regraCsv(r, c) {
    if (r === regras.linhaCab) return null;
    if (r > regras.linhaCab && regras.linhaCab >= 0 && regras.colunas[c]) return regras.colunas[c];
    return /[A-Za-zÀ-ÿ]/.test(registros[r].campos[c].v) ? REGRA_TEXTO_SOLTO : null;
  }
  registros.forEach(function (reg, r) {
    reg.campos.forEach(function (campo, c) {
      var regra = regraCsv(r, c), val = valorCsv(campo.v);
      if (regra && regra.acao === 'pseudonimizar' && val) P.registrarReal(regra.classe, val);
    });
  });
  var trocadas = 0;
  var linhas = registros.map(function (reg, r) {
    return reg.campos.map(function (campo, c) {
      var regra = regraCsv(r, c), val = valorCsv(campo.v), v = campo.v;
      if (regra && regra.acao !== 'manter' && val) {
        var fam = A.detectar.FAMILIA[regra.tipo];
        if (regra.acao === 'limpar') v = '';
        else if (regra.acao === 'generalizar') v = generalizarTexto(regra, fam, v);
        else v = String(P.trocar(regra.classe, val, regra.perfil).v);
        regra.trocadas = (regra.trocadas || 0) + 1;
        trocadas++;
      }
      return campo.aspas || v.indexOf(sep) >= 0 || /["\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }).join(sep);
  });
  var saidaTexto = linhas.join(quebra) + (/\r?\n$/.test(texto) ? quebra : '');
  var saidaBytes;
  if (dec.cod === 'Windows-1252') saidaBytes = codificarCp1252(saidaTexto);
  else if (dec.cod === 'UTF-16') saidaBytes = codificarUtf16le(saidaTexto);
  else saidaBytes = new TextEncoder().encode(saidaTexto);
  var partes = bom === 'utf8' ? [new Uint8Array([0xEF, 0xBB, 0xBF]), saidaBytes] : bom === 'utf16' ? [new Uint8Array([0xFF, 0xFE]), saidaBytes] : [saidaBytes];
  var relatorio = {
    abas: [{ nome: aba.nome, trocadas: trocadas, colunas: Object.keys(regras.colunas).map(function (c) { var x = regras.colunas[c]; return { letra: x.letra, nome: x.nome, tipo: x.tipo, acao: x.acao, trocadas: x.trocadas }; }) }],
    formulas: 0, removidas: [], avisos: [], imagens: 0, pseudonimos: P.estatisticas(), textosSoltos: REGRA_TEXTO_SOLTO.trocadas
  };
  REGRA_TEXTO_SOLTO.trocadas = 0;
  return { blob: new Blob(partes, { type: 'text/csv' }), relatorio: relatorio, nome: nomeSaida(modelo, 'csv') };
}

// Generaliza datas e números escritos como texto: data → dia 1 do mês (sem hora); número → 2 algarismos.
function generalizarTexto(regra, fam, v) {
  var t = String(v).trim();
  if (fam === 'data') {
    var iso = /^(\d{4})([\/.-])(\d{1,2})\2\d{1,2}/.exec(t);
    if (iso) return iso[1] + iso[2] + iso[3] + iso[2] + '01';
    var br = /^\d{1,2}([\/.-])(\d{1,2})\1(\d{2,4})/.exec(t);
    if (br) return '01' + br[1] + br[2] + br[1] + br[3];
    return v;
  }
  var n = U.lerNumeroTexto(v);
  if (n && isFinite(n.valor) && n.valor) return U.formatarNumeroTexto(Number(n.valor.toPrecision(2)), n);
  return v;
}

// CSV completo: [{campos: [{v, aspas}]}], respeitando aspas e quebras de linha dentro de campos.
function lerCsvCompleto(texto, sep) {
  var registros = [], campos = [], v = '', aspas = false, citado = false, i = 0, n = texto.length;
  if (texto.charCodeAt(0) === 0xFEFF) i = 1;
  function fecharCampo() { campos.push({ v: v, aspas: citado }); v = ''; citado = false; }
  while (i < n) {
    var ch = texto.charAt(i);
    if (aspas) {
      if (ch === '"') { if (texto.charAt(i + 1) === '"') { v += '"'; i += 2; continue; } aspas = false; i++; continue; }
      v += ch; i++; continue;
    }
    if (ch === '"' && v === '') { aspas = true; citado = true; i++; continue; }
    if (ch === sep) { fecharCampo(); i++; continue; }
    if (ch === '\r' || ch === '\n') {
      fecharCampo(); registros.push({ campos: campos }); campos = [];
      if (ch === '\r' && texto.charAt(i + 1) === '\n') i++;
      i++; continue;
    }
    v += ch; i++;
  }
  if (v !== '' || campos.length || citado) { fecharCampo(); registros.push({ campos: campos }); }
  return registros;
}

// ---------- ponto de entrada ----------
async function processar(blob, nome, modelo, opcoes) {
  if (!X) iniciar();
  var ext = String(nome || '').toLowerCase().split('.').pop();
  if (ext === 'csv' || ext === 'txt') return processarCsv(blob, modelo, opcoes);
  if (ext === 'xlsx' || ext === 'xlsm') return processarXlsx(blob, modelo, opcoes);
  throw erro('formato', 'A troca do arquivo inteiro aceita .xlsx, .xlsm e .csv. Para outros formatos, abra no Excel e salve como .xlsx.', ext);
}

A.inteiro = { processar: processar, acaoPadrao: acaoPadrao, acoesPossiveis: acoesPossiveis, classificar: classificar, lerCsvCompleto: lerCsvCompleto, codificarCp1252: codificarCp1252 };
