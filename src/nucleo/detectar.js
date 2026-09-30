/* Detecção: linha do cabeçalho, tipo de cada coluna e perfil (formato, faixa, padrão) sob demanda. Sem DOM. */
import { A } from './amostra.js';

var U = A.util, D = A.dados, L = A.LIMITES;

var TIPOS = {
  data: { rotulo: 'Data', arm: ['nativo', 'texto'] },
  datahora: { rotulo: 'Data e hora', arm: ['nativo', 'texto'] },
  hora: { rotulo: 'Hora', arm: ['nativo', 'texto'] },
  inteiro: { rotulo: 'Número inteiro', arm: ['nativo', 'texto'] },
  decimal: { rotulo: 'Número com casas decimais', arm: ['nativo', 'texto'] },
  moeda: { rotulo: 'Valor em dinheiro (R$)', arm: ['nativo', 'texto'] },
  percentual: { rotulo: 'Porcentagem', arm: ['nativo', 'texto'] },
  cpf: { rotulo: 'CPF', arm: ['texto', 'nativo'] },
  cnpj: { rotulo: 'CNPJ', arm: ['texto', 'nativo'] },
  email: { rotulo: 'E-mail', arm: ['texto'] },
  telefone: { rotulo: 'Telefone', arm: ['texto', 'nativo'] },
  cep: { rotulo: 'CEP', arm: ['texto', 'nativo'] },
  pessoa: { rotulo: 'Nome de pessoa', arm: ['texto'] },
  empresa: { rotulo: 'Nome de empresa', arm: ['texto'] },
  codigo: { rotulo: 'Código (ex.: PED-0012)', arm: ['texto'] },
  categoria: { rotulo: 'Lista de opções (ex.: status)', arm: ['texto'] },
  simnao: { rotulo: 'Sim ou não', arm: ['texto', 'nativo'] },
  texto: { rotulo: 'Texto livre', arm: ['texto'] },
  chave: { rotulo: 'Chave de acesso (NF-e/CT-e)', arm: ['texto'] },
  cidade: { rotulo: 'Cidade', arm: ['texto'] },
  uf: { rotulo: 'Estado (UF)', arm: ['texto'] },
  endereco: { rotulo: 'Endereço', arm: ['texto'] },
  bairro: { rotulo: 'Bairro', arm: ['texto'] },
  constante: { rotulo: 'Sempre o mesmo valor', arm: ['texto'] },
  vazia: { rotulo: 'Coluna vazia', arm: ['texto'] }
};
var ORDEM_TIPOS = ['data', 'datahora', 'hora', 'inteiro', 'decimal', 'moeda', 'percentual', 'cpf', 'cnpj', 'chave', 'email',
  'telefone', 'cep', 'cidade', 'uf', 'endereco', 'bairro', 'pessoa', 'empresa', 'codigo', 'categoria', 'simnao', 'texto', 'constante', 'vazia'];
var FAMILIA = {
  data: 'data', datahora: 'data', hora: 'data',
  inteiro: 'numero', decimal: 'numero', moeda: 'numero', percentual: 'numero',
  cpf: 'mascara', cnpj: 'mascara', cep: 'mascara', telefone: 'mascara', chave: 'mascara',
  email: 'texto', pessoa: 'texto', empresa: 'texto', codigo: 'texto', categoria: 'texto', simnao: 'texto', texto: 'texto',
  cidade: 'texto', uf: 'texto', endereco: 'texto', bairro: 'texto',
  constante: 'constante',
  vazia: 'vazia'
};
// Tipos cujo valor identifica algo: nunca são copiados, nem quando a coluna tem um valor só.
var SENSIVEIS = { cpf: 1, cnpj: 1, chave: 1, email: 1, telefone: 1, pessoa: 1, empresa: 1, cep: 1, codigo: 1, cidade: 1, uf: 1, endereco: 1, bairro: 1 };
// Tipos em que a repetição de valores do original é imitada (poucos valores que se repetem x sempre muda).
var REPETEM = { cpf: 1, cnpj: 1, chave: 1, cep: 1, telefone: 1, email: 1, pessoa: 1, empresa: 1, codigo: 1, texto: 1, cidade: 1, uf: 1, endereco: 1, bairro: 1 };
// Tipos em que uma coluna pode repetir o valor de outra na mesma linha (ex.: cidade de origem = destino).
var TIPOS_IGUALDADE = { cidade: 1, uf: 1, endereco: 1, bairro: 1, pessoa: 1, empresa: 1, codigo: 1, cpf: 1, cnpj: 1, chave: 1, email: 1, telefone: 1, cep: 1, texto: 1, data: 1, datahora: 1 };
var TIPOS_CONTA = { inteiro: 1, decimal: 1, moeda: 1, percentual: 1 };

var FORMATO_PADRAO = {
  data: 'dd/mm/yyyy', datahora: 'dd/mm/yyyy hh:mm', hora: 'hh:mm',
  inteiro: '0', decimal: '#,##0.00', moeda: '"R$" #,##0.00', percentual: '0.00%',
  cpf: '000\\.000\\.000\\-00', cnpj: '00\\.000\\.000\\/0000\\-00', cep: '00000\\-000', telefone: '\\(00\\) 00000\\-0000'
};
var TEXTO_PADRAO = {
  data: { ordem: 'dmy', sep: '/', dPad: true, mPad: true, ano: 4, hora: null },
  datahora: { ordem: 'dmy', sep: '/', dPad: true, mPad: true, ano: 4, hora: { sep: ' ', seg: false, hPad: true } },
  hora: { seg: false, hPad: true },
  inteiro: { prefixo: '', sufixo: '', dec: ',', milhar: '', casas: 0, sinalAntes: false },
  decimal: { prefixo: '', sufixo: '', dec: ',', milhar: '.', casas: 2, sinalAntes: false },
  moeda: { prefixo: 'R$ ', sufixo: '', dec: ',', milhar: '.', casas: 2, sinalAntes: false },
  percentual: { prefixo: '', sufixo: '%', dec: ',', milhar: '', casas: 1, sinalAntes: false }
};
var MASCARA_PADRAO = { cpf: '999.999.999-99', cnpj: '99.999.999/9999-99', cep: '99999-999', telefone: '(99) 99999-9999', chave: new Array(45).join('9') };

var RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
var RE_CPF_MASC = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
var RE_CNPJ_MASC = /^[0-9A-Z]{2}\.[0-9A-Z]{3}\.[0-9A-Z]{3}\/[0-9A-Z]{4}-\d{2}$/i;
var RE_CEP = /^(\d{5}-\d{3}|\d{2}\.\d{3}-\d{3})$/;
var RE_TEL = /^(?:\+?55[\s\-]?)?(?:\(\d{2}\)\s?|\d{2}[\s\-])?9?\d{4}[\s\-]?\d{4}$/;
var RE_EMPRESA_SUF = /(?:^|[\s,])(ltda|s\.?\/?a\.?|me|epp|eireli|mei)\.?$/;
var RE_EMPRESA_PAL = /\b(cia|companhia|comercio|industria|servicos|distribuidora|transportes|logistica|holding|grupo|associados|consultoria|engenharia|tecnologia|informatica|atacadista|varejista|construtora|metalurgica|farmacia|laticinios|representacoes)\b/;
var RE_PALAVRAS_NOME = /^[A-Za-zÀ-ÖØ-öø-ÿ'’.\-]+(?: [A-Za-zÀ-ÖØ-öø-ÿ'’.\-]+){0,6}$/;

var REGRAS_NOME = [
  [/\bcpf\b/, 'cpf'],
  [/\bcnpj\b/, 'cnpj'],
  [/\bchave\b/, 'chave'],
  [/\bcfop\b/, 'categoria'],
  [/\bncm\b/, 'codigo'],
  [/\b(endereco|logradouro|rua|end)\b/, 'endereco'],
  [/\bbairro\b/, 'bairro'],
  [/\be ?mail\b/, 'email'],
  [/\b(telefone|fone|celular|whatsapp|whats|tel|ramal)\b/, 'telefone'],
  [/\bcep\b/, 'cep'],
  [/\b(uf|sigla uf)\b|\bestado\b(?! civil)/, 'uf'],
  [/\b(cidade|municipio|mun|localidade)\b|\bcid (origem|destino|entrega|coleta|emitente|emit|destinatario|dest|remetente|rem|tomador|cliente|prestacao)\b/, 'cidade'],
  [/\b(data hora|datahora|timestamp|data e hora|dt hr|carimbo)\b/, 'datahora'],
  [/\b(hora|horario|hr)\b/, 'hora'],
  [/\b(data|dt|nascimento|vencimento|emissao|admissao|demissao|validade|competencia)\b/, 'data'],
  [/%|\b(percentual|porcentagem|perc|pct|aliquota|margem|taxa)\b/, 'percentual'],
  [/\b(valor|vlr|vl|preco|custo|total|saldo|salario|receita|faturamento|pagamento|montante|frete|juros|multa|desconto|credito|debito|limite|ticket)\b/, 'moeda'],
  [/\b(qtd|qtde|quantidade|qte|idade|estoque|unidades|dias|parcelas|pedidos|itens|volumes|ano)\b/, 'inteiro'],
  [/\b(peso|altura|largura|comprimento|media|indice|fator|kg|km|metros|litros|score)\b/, 'decimal'],
  [/\b(ativo|ativa|flag|possui|habilitado|bloqueado|entregue|aprovado|confirmado)\b/, 'simnao'],
  [/\b(codigo|cod|id|pedido|nf|nfe|sku|matricula|protocolo|chamado|registro|numero|n|nro|num|ref|referencia|lote|serie|placa|conta)\b/, 'codigo'],
  [/\b(status|situacao|sit|tipo|tp|categoria|estado civil|classe|classificacao|setor|departamento|area|segmento|regiao|grupo|canal|origem|prioridade|nivel|genero|sexo|turno|filial|unidade|forma|modalidade|etapa|fase|modal)\b/, 'categoria'],
  [/\b(empresa|razao social|fornecedor|fabricante|transportadora|transp|companhia|fantasia|parceiro|banco|instituicao|remetente|destinatario|tomador|emitente|expedidor|recebedor)\b/, 'empresa'],
  [/\b(nome|cliente|responsavel|vendedor|funcionario|colaborador|contato|motorista|paciente|aluno|titular|solicitante|gerente|atendente|usuario|autor|representante|comprador|tecnico|operador|supervisor)\b/, 'pessoa'],
  [/\b(descricao|observacao|observacoes|obs|comentario|detalhe|historico|motivo|mensagem|texto|complemento|produto|item)\b/, 'texto']
];

var primeirosNomes = null;
var vocabSimNao = null;
function listaPrimeirosNomes() {
  if (!primeirosNomes) {
    primeirosNomes = new Set();
    D.nomesMasculinos.concat(D.nomesFemininos).forEach(function (n) { primeirosNomes.add(U.normalizar(n)); });
  }
  return primeirosNomes;
}
function listaSimNao() {
  if (!vocabSimNao) vocabSimNao = new Set(D.simNao);
  return vocabSimNao;
}

// ---------- lugares (listas públicas do IBGE) ----------
function nomeLugar(s) { return U.semAcento(String(s)).toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
var mapaCidades = null, siglasUF = null;
function cidades() {
  if (!mapaCidades) {
    mapaCidades = new Map();
    (D.municipios || []).forEach(function (m) {
      var k = nomeLugar(m.nome);
      var l = mapaCidades.get(k);
      if (!l) { l = []; mapaCidades.set(k, l); }
      l.push(m.uf);
    });
  }
  return mapaCidades;
}
var nomesUF = null;
function ufs() {
  if (!siglasUF) {
    siglasUF = new Set();
    nomesUF = new Map();
    (D.ufs || []).forEach(function (u) { siglasUF.add(u.sigla); nomesUF.set(nomeLugar(u.nome), u.sigla); });
  }
  return siglasUF;
}
function ehSiglaUF(v) { v = String(v).trim(); return v.length === 2 && ufs().has(v.toUpperCase()); }
function ehNomeUF(v) { ufs(); return nomesUF.has(nomeLugar(v)); }
// Sigla da UF a partir da sigla ou do nome por extenso ("São Paulo" → SP).
function siglaUF(v) {
  if (ehSiglaUF(v)) return String(v).trim().toUpperCase();
  ufs();
  return nomesUF.get(nomeLugar(v)) || null;
}
function nomeDaUF(sigla) {
  var u = (D.ufs || []).filter(function (x) { return x.sigla === sigla; })[0];
  return u ? u.nome : sigla;
}
function ufsDaCidade(nome) { return cidades().get(nomeLugar(nome)) || null; }
function ehUF(vals) { return fracao(vals, function (v) { return ehSiglaUF(v) || ehNomeUF(v); }) >= 0.9; }
var RE_LOGRADOURO = /^(RUA|R|AV|AVENIDA|TRAVESSA|TV|TRAV|ALAMEDA|AL|RODOVIA|ROD|ESTRADA|EST|PRACA|PC|PCA|LARGO|VIA|VIELA|SERVIDAO|BECO|QUADRA|QD)\b/;
function ehEndereco(vals, dica) {
  var f = fracao(vals, function (v) { return RE_LOGRADOURO.test(nomeLugar(v)); });
  return f >= 0.6 || (dica === 'endereco' && fracao(vals, function (v) { return /[A-Za-zÀ-ÿ]{3}/.test(v); }) >= 0.8);
}
function ehBairro(vals, dica) {
  var f = fracao(vals, function (v) { return /^(JARDIM|JD|VILA|VL|PARQUE|PQ|RESIDENCIAL|CONJUNTO|CJ|NUCLEO|SETOR|CENTRO|BAIRRO)\b/.test(nomeLugar(v)); });
  return f >= 0.5 || (dica === 'bairro' && fracao(vals, function (v) { return /[A-Za-zÀ-ÿ]{3}/.test(v); }) >= 0.8);
}
function ehCidade(vals, dica) {
  var f = fracao(vals, function (v) { return cidades().has(nomeLugar(v)); });
  return f >= 0.7 || (dica === 'cidade' && f >= 0.4);
}
function chaveCelula(c) { return c.t === 's' ? 's:' + String(c.v).trim() : c.t + ':' + c.v; }

// ---------- auxiliares ----------
function vazia(cel) {
  if (!cel || cel.v == null || cel.t === 'z') return true;
  return cel.t === 's' && String(cel.v).trim() === '';
}
function contarLinha(linha) {
  if (!linha) return 0;
  var n = 0;
  for (var c = 0; c < linha.length; c++) if (!vazia(linha[c])) n++;
  return n;
}
function mediana(lista) {
  var o = lista.slice().sort(function (a, b) { return a - b; });
  return o[Math.floor(o.length / 2)];
}
function modal(lista) {
  var m = new Map(), melhor, max = 0;
  for (var i = 0; i < lista.length; i++) {
    var k = lista[i];
    var n = (m.get(k) || 0) + 1;
    m.set(k, n);
    if (n > max) { max = n; melhor = k; }
  }
  return melhor;
}
function frequencias(lista) {
  var m = new Map();
  for (var i = 0; i < lista.length; i++) m.set(lista[i], (m.get(lista[i]) || 0) + 1);
  return m;
}
function fracao(lista, fn) {
  if (!lista.length) return 0;
  var k = 0;
  for (var i = 0; i < lista.length; i++) if (fn(lista[i])) k++;
  return k / lista.length;
}
function minimo(lista) { var m = Infinity; for (var i = 0; i < lista.length; i++) if (lista[i] < m) m = lista[i]; return m; }
function maximo(lista) { var m = -Infinity; for (var i = 0; i < lista.length; i++) if (lista[i] > m) m = lista[i]; return m; }
function copiar(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
function hojeSerial() {
  var h = new Date();
  return U.serialDeData(h.getFullYear(), h.getMonth() + 1, h.getDate());
}
function textoDaCelula(cel) {
  if (cel.t === 's') return String(cel.v).trim();
  if (cel.t === 'b') return cel.v ? 'TRUE' : 'FALSE';
  return String(cel.v);
}
function ordemDe(vals) {
  if (vals.length < 5) return null;
  var cresc = 0, decr = 0, pares = vals.length - 1, iguais = 0;
  for (var i = 1; i < vals.length; i++) {
    if (vals[i] > vals[i - 1]) cresc++;
    else if (vals[i] < vals[i - 1]) decr++;
    else iguais++;
  }
  if (iguais === pares) return null;
  if ((cresc + iguais) / pares >= 0.95 && cresc > decr) return 'asc';
  if ((decr + iguais) / pares >= 0.95 && decr > cresc) return 'desc';
  return null;
}

function tipoPorNome(nome) {
  var n = ' ' + U.normalizar(nome).replace(/[^a-z0-9%]+/g, ' ').trim() + ' ';
  for (var i = 0; i < REGRAS_NOME.length; i++) if (REGRAS_NOME[i][0].test(n)) return REGRAS_NOME[i][1];
  return null;
}

// ---------- cabeçalho ----------
function detectarCabecalho(aba) {
  var linhas = aba.linhas, n = linhas.length;
  var memo = [];
  function cont(r) {
    if (memo[r] === undefined) memo[r] = contarLinha(linhas[r]);
    return memo[r];
  }
  var primeira = -1;
  var limite = Math.min(n, L.BUSCA_CABECALHO);
  for (var r = 0; r < limite; r++) {
    var qtd = cont(r);
    if (!qtd) continue;
    if (primeira < 0) primeira = r;
    var prox = [];
    for (var k = r + 1; k < n && prox.length < 10; k++) if (cont(k)) prox.push(cont(k));
    var largura = prox.length ? mediana(prox) : qtd;
    if (qtd < Math.ceil(0.6 * largura)) continue;
    if (largura >= 2 && qtd < 2) continue;
    var cels = [];
    var linha = linhas[r];
    for (var c = 0; c < linha.length; c++) if (!vazia(linha[c])) cels.push(linha[c]);
    var textos = 0;
    var unicos = new Set();
    for (var j = 0; j < cels.length; j++) {
      if (cels[j].t === 's') textos++;
      unicos.add(U.normalizar(cels[j].v));
    }
    if (textos / cels.length < 0.8) continue;
    if (unicos.size / cels.length < 0.9) continue;
    return r;
  }
  return primeira;
}

// ---------- colunas ----------
function construirColunas(aba, arquivo) {
  var linhas = aba.linhas, lc = aba.linhaCab;
  aba.colunas = [];
  aba.nDados = 0;
  aba.cMin = 0;
  aba.cMax = -1;
  if (lc < 0) return;
  var fim = Math.min(linhas.length, lc + 1 + L.AMOSTRA);
  var ultima = lc;
  for (var r = lc + 1; r < fim; r++) if (contarLinha(linhas[r])) ultima = r;
  aba.nDados = ultima - lc;
  aba.totalDados = Math.max(aba.nDados, (aba.totalLinhas || 0) - lc - 1);
  var cMin = Infinity, cMax = -1, c;
  for (r = lc; r <= ultima; r++) {
    var linha = linhas[r];
    if (!linha) continue;
    for (c = 0; c < linha.length; c++) {
      if (!vazia(linha[c])) {
        if (c < cMin) cMin = c;
        if (c > cMax) cMax = c;
      }
    }
  }
  if (cMax < 0) return;
  aba.cMin = cMin;
  aba.cMax = cMax;
  var cab = linhas[lc] || [];
  for (c = cMin; c <= cMax; c++) {
    var celCab = vazia(cab[c]) ? null : cab[c];
    var valores = new Array(aba.nDados);
    for (var i = 0; i < aba.nDados; i++) {
      var lin = linhas[lc + 1 + i];
      var cel = lin ? lin[c] : null;
      valores[i] = vazia(cel) ? null : cel;
    }
    var col = {
      c: c,
      letra: U.letraColuna(c),
      cab: celCab,
      nome: celCab ? String(celCab.v) : '',
      valores: valores,
      origem: arquivo.origem,
      data1904: !!arquivo.data1904,
      restantes: Math.max(0, aba.totalDados - aba.nDados),
      manter: false,
      cache: {}
    };
    analisarColuna(col, aba.nDados);
    aba.colunas.push(col);
  }
  aba.relacoes = detectarRelacoes(aba.colunas, aba.nDados);
}

// Relações entre colunas da mesma linha que a amostra precisa manter.
function detectarRelacoes(todas, nDados) {
  var rel = [], i, j, r;
  // Colunas vazias nunca entram em relação; tirá-las evita comparar milhares de pares à toa
  var cols = todas.filter(function (c) { return c.tipoDetectado !== 'vazia'; });
  function norm(c) { return c.t === 's' ? U.normalizar(c.v) : c.t + ':' + c.v; }
  for (i = 0; i < cols.length; i++) {
    for (j = i + 1; j < cols.length; j++) {
      var a = cols[i], b = cols[j];
      if (a.tipoDetectado !== b.tipoDetectado || !TIPOS_IGUALDADE[a.tipoDetectado]) continue;
      var ambos = 0, iguais = 0, mesmaUF = 0, comUF = 0;
      for (r = 0; r < nDados; r++) {
        var va = a.valores[r], vb = b.valores[r];
        if (!va || !vb) continue;
        ambos++;
        var igual = norm(va) === norm(vb);
        if (igual) iguais++;
        if (a.tipoDetectado === 'cidade' && !igual) {
          var ua = ufsDaCidade(va.v), ub = ufsDaCidade(vb.v);
          if (ua && ub) { comUF++; if (ua.some(function (u) { return ub.indexOf(u) >= 0; })) mesmaUF++; }
        }
      }
      if (ambos >= 5 && iguais / ambos >= 0.02) rel.push({ tipo: 'igual', base: a.c, dep: b.c, tipoCol: a.tipoDetectado, taxa: iguais / ambos });
      if (comUF >= 5 && mesmaUF / comUF >= 0.05) rel.push({ tipo: 'mesmaUF', base: a.c, dep: b.c, taxa: mesmaUF / comUF });
    }
  }
  cols.forEach(function (u) {
    if (u.tipoDetectado !== 'uf') return;
    var melhor = null, melhorTaxa = 0;
    cols.forEach(function (c) {
      if (c.tipoDetectado !== 'cidade') return;
      var ambos = 0, ok = 0;
      for (r = 0; r < nDados; r++) {
        var vc = c.valores[r], vu = u.valores[r];
        if (!vc || !vu) continue;
        ambos++;
        var l = ufsDaCidade(vc.v);
        if (l && l.indexOf(siglaUF(vu.v)) >= 0) ok++;
      }
      if (ambos >= 5 && ok / ambos >= 0.8 && ok / ambos > melhorTaxa) { melhor = c; melhorTaxa = ok / ambos; }
    });
    if (melhor) rel.push({ tipo: 'ufDaCidade', cidade: melhor.c, uf: u.c, taxa: melhorTaxa });
  });
  relacoesDeFormato(cols, nDados, rel);
  relacoesDeDatas(cols, nDados, rel);
  relacoesDeContas(cols, nDados, rel);
  return rel;
}

// Uma lista curta que define o formato de um código (ex.: MINUTA → MIN-0000, CTRC/CTE → CTE-000000).
function relacoesDeFormato(cols, nDados, rel) {
  cols.forEach(function (k) {
    if (k.tipoDetectado !== 'categoria') return;
    cols.forEach(function (x) {
      if (x.tipoDetectado !== 'codigo') return;
      var grupos = new Map(), total = 0;
      for (var r = 0; r < nDados; r++) {
        var vk = k.valores[r], vx = x.valores[r];
        if (!vk || !vx) continue;
        total++;
        var g = grupos.get(chaveCelula(vk));
        if (!g) { g = new Map(); grupos.set(chaveCelula(vk), g); }
        var m = U.mascaraDe(textoDaCelula(vx));
        g.set(m, (g.get(m) || 0) + 1);
      }
      if (total < 10 || grupos.size < 2) return;
      var coerentes = 0, mapa = {}, mascaras = new Set();
      grupos.forEach(function (g, chave) {
        var melhor = null, max = 0;
        g.forEach(function (q, m) { if (q > max) { max = q; melhor = m; } });
        coerentes += max;
        mapa[chave] = melhor;
        mascaras.add(melhor);
      });
      if (mascaras.size >= 2 && coerentes / total >= 0.9) rel.push({ tipo: 'formatoPorOpcao', cat: k.c, dep: x.c, mapa: mapa });
    });
  });
}

function serialDaCelula(c) {
  if (!c || c.t !== 'n') return null;
  var k = U.tipoDoFormato(c.z);
  return k === 'data' || k === 'datahora' ? c.v : null;
}

// Data que vem sempre depois de outra (ex.: entrega depois da emissão), com a diferença típica entre elas.
function relacoesDeDatas(cols, nDados, rel) {
  var datas = cols.filter(function (c) { return c.tipoDetectado === 'data' || c.tipoDetectado === 'datahora'; });
  datas.forEach(function (b) {
    var melhor = null;
    datas.forEach(function (a) {
      if (a === b) return;
      var deltas = [], antes = 0;
      for (var r = 0; r < nDados; r++) {
        var sa = serialDaCelula(a.valores[r]), sb = serialDaCelula(b.valores[r]);
        if (sa == null || sb == null) continue;
        deltas.push(sb - sa);
        if (sb < sa) antes++;
      }
      if (deltas.length < 5 || antes / deltas.length > 0.05 || !deltas.some(function (d) { return d > 0; })) return;
      deltas.sort(function (x, y) { return x - y; });
      var mediana = deltas[Math.floor(deltas.length / 2)];
      if (!melhor || mediana < melhor.mediana) melhor = { tipo: 'ordemData', antes: a.c, depois: b.c, qDelta: quantis(deltas.filter(function (d) { return d >= 0; })), mediana: mediana };
    });
    if (melhor) rel.push(melhor);
  });
}

// Coluna que é conta de outras duas (total = qtd × preço, total = frete + imposto, líquido = bruto − desconto).
function relacoesDeContas(cols, nDados, rel) {
  var nums = cols.filter(function (c) { return TIPOS_CONTA[c.tipoDetectado] && c.cels.length >= 5 && c.cels.every(function (x) { return x.t === 'n'; }); });
  if (nums.length < 3) return;
  var limite = Math.min(nDados, 300);
  var OPS = [
    ['produto', function (a, b) { return a * b; }],
    ['soma', function (a, b) { return a + b; }],
    ['diferenca', function (a, b) { return a - b; }]
  ];
  var trios = new Set(), alvos = new Set();
  // Uma forma por trio de colunas (total = frete + icms, e não também frete = total − icms), preferindo × e +.
  OPS.forEach(function (op) {
    nums.forEach(function (c) {
      if (alvos.has(c.c)) return;
      var casas = U.casasDoFormato(c.cels[0].z);
      if (casas == null) casas = Math.min(6, maximo(c.cels.map(function (x) { return U.decimaisDe(x.v); })));
      var tol = 0.51 * Math.pow(10, -casas) + 1e-9;
      for (var i = 0; i < nums.length; i++) {
        for (var j = 0; j < nums.length; j++) {
          var a = nums[i], b = nums[j];
          if (a === c || b === c || a === b) continue;
          if (op[0] !== 'diferenca' && j < i) continue; // produto e soma não dependem da ordem
          var trio = [a.c, b.c, c.c].sort(function (x, y) { return x - y; }).join(',');
          if (trios.has(trio)) continue;
          var ambos = 0, ok = 0, falhas = 0;
          for (var r = 0; r < limite && falhas <= 3; r++) {
            var va = a.valores[r], vb = b.valores[r], vc = c.valores[r];
            if (!va || !vb || !vc) continue;
            ambos++;
            if (Math.abs(op[1](va.v, vb.v) - vc.v) <= tol) ok++; else falhas++;
          }
          if (ambos >= 10 && ok / ambos >= 0.95) {
            rel.push({ tipo: 'conta', op: op[0], a: a.c, b: b.c, c: c.c, casas: casas });
            trios.add(trio);
            alvos.add(c.c);
            return;
          }
        }
      }
    });
  });
}

function analisarColuna(col, nDados) {
  var cels = [];
  for (var i = 0; i < col.valores.length; i++) if (col.valores[i]) cels.push(col.valores[i]);
  col.cels = cels;
  col.preenchidas = cels.length;
  col.razaoVazios = nDados ? 1 - cels.length / nDados : 0;
  col.dica = tipoPorNome(col.nome);
  var r;
  if (!nDados) {
    var t = col.dica || 'texto';
    r = { tipo: t, arm: FAMILIA[t] === 'data' || FAMILIA[t] === 'numero' ? 'nativo' : 'texto' };
  } else if (!cels.length) {
    r = { tipo: 'vazia', arm: 'texto' };
  } else {
    r = classificar(cels, col.dica);
  }
  // Repetição: quantos valores diferentes e se valores iguais vêm em linhas seguidas.
  var chaves = new Set(), pares = 0, iguais = 0;
  for (var k = 0; k < cels.length; k++) chaves.add(chaveCelula(cels[k]));
  for (k = 1; k < col.valores.length; k++) {
    var a = col.valores[k - 1], b = col.valores[k];
    if (a && b) { pares++; if (chaveCelula(a) === chaveCelula(b)) iguais++; }
  }
  col.distintos = chaves.size;
  col.taxaBlocos = pares ? iguais / pares : 0;
  if (cels.length >= 2 && chaves.size === 1 && !SENSIVEIS[r.tipo]) {
    r = { tipo: 'constante', arm: 'texto' };
  } else if (r.tipo === 'inteiro' && (col.dica === 'categoria'
    ? chaves.size <= 30 && cels.length / chaves.size >= 2
    : chaves.size <= 12 && cels.length / chaves.size >= 3)) {
    r = { tipo: 'categoria', arm: 'texto' }; // flags 0/1 e códigos numéricos curtos: vocabulário do sistema
  }
  col.rotulosReais = true;
  if (col.origem === 'csv' && (FAMILIA[r.tipo] === 'data' || FAMILIA[r.tipo] === 'numero')) r.arm = 'nativo';
  col.tipoDetectado = col.tipo = r.tipo;
  col.armDetectado = col.armazenamento = r.arm;
  var textos = 0;
  for (var j = 0; j < cels.length; j++) if (cels[j].t === 's') textos++;
  col.maioriaTexto = cels.length ? textos / cels.length >= 0.5 : true;
}

// ---------- classificação ----------
function classificar(cels, dica) {
  var s = 0, b = 0, e = 0, nTotal = 0, n = {};
  for (var i = 0; i < cels.length; i++) {
    var cel = cels[i];
    if (cel.t === 's') s++;
    else if (cel.t === 'b') b++;
    else if (cel.t === 'n') {
      var k = U.tipoDoFormato(cel.z);
      if (k === 'texto' || k === 'geral') k = 'numero';
      n[k] = (n[k] || 0) + 1;
      nTotal++;
    } else e++;
  }
  var total = cels.length - e;
  if (!total) return { tipo: 'texto', arm: 'texto' };
  if (s / total >= 0.8) {
    var textos = [];
    for (i = 0; i < cels.length; i++) if (cels[i].t === 's') textos.push(String(cels[i].v).trim());
    return { tipo: classificarTextos(textos, dica), arm: 'texto' };
  }
  if (b / total >= 0.8) return { tipo: 'simnao', arm: 'nativo' };
  if (nTotal / total >= 0.8) {
    var nums = [];
    for (i = 0; i < cels.length; i++) if (cels[i].t === 'n') nums.push(cels[i]);
    return { tipo: classificarNumeros(nums, n, nTotal, dica), arm: 'nativo' };
  }
  return { tipo: 'texto', arm: 'texto' };
}

function classificarNumeros(nums, n, nTotal, dica) {
  var datas = (n.data || 0) + (n.datahora || 0) + (n.hora || 0);
  if (datas / nTotal >= 0.8) {
    var dd = n.data || 0, dh = n.datahora || 0, hh = n.hora || 0;
    if (dh >= dd && dh >= hh) return 'datahora';
    return dd >= hh ? 'data' : 'hora';
  }
  if ((n.percentual || 0) / nTotal >= 0.8) return 'percentual';
  if ((n.moeda || 0) / nTotal >= 0.8) return 'moeda';
  var zs = [];
  for (var i = 0; i < nums.length; i++) zs.push(nums[i].z || 'General');
  var z = modal(zs);
  var especial = especialNumerico(nums, z, dica);
  if (especial) return especial;
  var tz = U.tipoDoFormato(z);
  if (tz === 'numero') return U.casasDoFormato(z) > 0 ? 'decimal' : 'inteiro';
  var maxDec = 0;
  for (i = 0; i < nums.length; i++) maxDec = Math.max(maxDec, Math.min(6, U.decimaisDe(nums[i].v)));
  return maxDec > 0 ? 'decimal' : 'inteiro';
}

function preencherZeros(v, n) {
  var s = String(Math.round(v));
  while (s.length < n) s = '0' + s;
  return s;
}

function especialNumerico(nums, z, dica) {
  var tz = U.tipoDoFormato(z);
  if (tz !== 'numero' && tz !== 'geral') return null;
  var vals = [];
  for (var i = 0; i < nums.length; i++) {
    var v = nums[i].v;
    if (Math.floor(v) !== v || v < 0) return null;
    vals.push(v);
  }
  var secs = U.secoes(z).map(U.limparFormato);
  var maxPh = 0, temDecimal = false;
  for (i = 0; i < secs.length; i++) {
    maxPh = Math.max(maxPh, (secs[i].match(/[0#?]/g) || []).length);
    if (/\.[0#?]/.test(secs[i])) temDecimal = true;
  }
  if (temDecimal) return null;
  if (/\(/.test(z) && /\)/.test(z) && maxPh >= 8) return 'telefone';
  var fCpf = fracao(vals, function (v) { return v >= 1e8 && v < 1e11 && U.cpfValido(preencherZeros(v, 11)); });
  var fCnpj = fracao(vals, function (v) { return v >= 1e11 && v < 1e14 && U.cnpjValido(preencherZeros(v, 14)); });
  if (fCpf >= 0.8 && (maxPh === 11 || maxPh === 0 || dica === 'cpf')) return 'cpf';
  if (fCnpj >= 0.8 && (maxPh === 14 || maxPh === 0 || dica === 'cnpj')) return 'cnpj';
  if (maxPh === 8 && /-/.test(z)) return 'cep';
  if (dica === 'cep' && fracao(vals, function (v) { return v >= 1000000 && v < 1e8; }) >= 0.8) return 'cep';
  if (dica === 'telefone' && fracao(vals, function (v) { return v >= 1e7 && v < 1e13; }) >= 0.8) return 'telefone';
  return null;
}

function ehCpfTexto(v) { return RE_CPF_MASC.test(v) || (/^\d{11}$/.test(v) && U.cpfValido(v)); }
function ehCnpjTexto(v) { return RE_CNPJ_MASC.test(v) || (/^[0-9A-Z]{12}\d{2}$/i.test(v) && U.cnpjValido(v)); }
function ehCep(v) { return RE_CEP.test(v); }
function ehTelefone(v) {
  if (/^\d+$/.test(v)) {
    if (v.length === 10) return /^[1-9]{2}[2-5]/.test(v);
    if (v.length === 11) return /^[1-9]{2}9/.test(v);
    if ((v.length === 12 || v.length === 13) && v.slice(0, 2) === '55') return ehTelefone(v.slice(2));
    return false;
  }
  return RE_TEL.test(v);
}
var VALIDA_MASCARA = {
  chave: function (v) { return U.chaveValida(v); },
  cpf: function (v) { return ehCpfTexto(v); },
  cnpj: function (v) { return ehCnpjTexto(v); },
  cep: function (v) { return ehCep(v) || /^\d{8}$/.test(v); },
  telefone: ehTelefone
};

function descritorDataTexto(vals) {
  if (!vals.length) return null;
  var ok = [];
  for (var i = 0; i < vals.length; i++) {
    var p = U.lerDataTexto(vals[i]);
    if (p) ok.push(p);
  }
  if (ok.length / vals.length < 0.8) return null;
  var ordem;
  if (fracao(ok, function (p) { return p.partes[0].length === 4; }) >= 0.8) ordem = 'ymd';
  else {
    var dmy = fracao(ok, function (p) { return !!U.interpretarData(p.partes, 'dmy'); });
    var mdy = fracao(ok, function (p) { return !!U.interpretarData(p.partes, 'mdy'); });
    ordem = mdy > dmy ? 'mdy' : 'dmy';
  }
  var validos = ok.filter(function (p) { return !!U.interpretarData(p.partes, ordem); });
  if (validos.length / vals.length < 0.8) return null;
  var iD = ordem === 'ymd' ? 2 : ordem === 'mdy' ? 1 : 0;
  var iM = ordem === 'ymd' ? 1 : ordem === 'mdy' ? 0 : 1;
  var iY = ordem === 'ymd' ? 0 : 2;
  function preenchido(idx) {
    var baixos = validos.filter(function (p) { return +p.partes[idx] < 10; });
    if (!baixos.length) return true;
    return fracao(baixos, function (p) { return p.partes[idx].length === 2; }) >= 0.5;
  }
  var comHora = validos.filter(function (p) { return !!p.hora; });
  var hora = null;
  if (comHora.length / validos.length >= 0.5) {
    var baixas = comHora.filter(function (p) { return p.hora.h < 10; });
    hora = {
      sep: modal(comHora.map(function (p) { return p.hora.sep; })),
      seg: comHora.some(function (p) { return p.hora.seg; }),
      hPad: !baixas.length || fracao(baixas, function (p) { return p.hora.hPad; }) >= 0.5
    };
  }
  return {
    ordem: ordem,
    sep: modal(validos.map(function (p) { return p.sep; })),
    dPad: preenchido(iD),
    mPad: preenchido(iM),
    ano: modal(validos.map(function (p) { return p.partes[iY].length; })) === 2 ? 2 : 4,
    hora: hora
  };
}

function descritorHoraTexto(vals) {
  if (!vals.length) return null;
  var ok = [];
  for (var i = 0; i < vals.length; i++) {
    var h = U.lerHoraTexto(vals[i]);
    if (h) ok.push({ h: h, s: vals[i] });
  }
  if (ok.length / vals.length < 0.8) return null;
  var baixas = ok.filter(function (o) { return /^\d:/.test(o.s) || /^0\d:/.test(o.s); });
  return {
    seg: ok.some(function (o) { return o.h.seg; }),
    hPad: !baixas.length || fracao(baixas, function (o) { return o.h.hPad; }) >= 0.5
  };
}

function descritorNumeroTexto(lidos, tipo) {
  var d = copiar(TEXTO_PADRAO[tipo] || TEXTO_PADRAO.decimal);
  if (!lidos.length) return d;
  d.prefixo = modal(lidos.map(function (x) { return x.prefixo; }));
  d.sufixo = modal(lidos.map(function (x) { return x.sufixo; }));
  d.sinalAntes = modal(lidos.map(function (x) { return x.sinalAntes; }));
  var decs = lidos.filter(function (x) { return x.dec; }).map(function (x) { return x.dec; });
  d.dec = decs.length ? modal(decs) : ',';
  var milhares = lidos.filter(function (x) { return x.milhar; }).map(function (x) { return x.milhar; });
  d.milhar = milhares.length ? modal(milhares) : '';
  d.casas = Math.min(6, maximo(lidos.map(function (x) { return x.casas; })));
  return d;
}

function ehSimNao(vals) {
  var distintos = new Set(vals);
  if (distintos.size > 3) return false;
  var voc = listaSimNao();
  return fracao(vals, function (v) { return voc.has(U.normalizar(v)); }) >= 0.9;
}

function ehCodigo(vals) {
  var n = vals.length;
  if (fracao(vals, function (v) { return /\d/.test(v); }) < 0.8) return false;
  if (fracao(vals, function (v) { return (v.match(/\s/g) || []).length > 2 || v.length > 40; }) > 0.1) return false;
  function cobertura(fn) {
    var cont = [];
    frequencias(vals.map(fn)).forEach(function (q) { cont.push(q); });
    cont.sort(function (a, b) { return b - a; });
    return { top1: cont[0] / n, top3: (cont[0] + (cont[1] || 0) + (cont[2] || 0)) / n };
  }
  var exata = cobertura(U.mascaraDe);
  if (exata.top1 >= 0.5 && exata.top3 >= 0.8) return true;
  var colapsada = cobertura(function (v) { return U.mascaraDe(v).replace(/9+/g, '9'); });
  return colapsada.top1 >= 0.5 && colapsada.top3 >= 0.8;
}

function ehEmpresa(vals, dica) {
  var f = fracao(vals, function (v) {
    var n = U.normalizar(v);
    return RE_EMPRESA_SUF.test(n) || RE_EMPRESA_PAL.test(n);
  });
  if (f >= 0.5) return true;
  return dica === 'empresa' && fracao(vals, function (v) { return /[A-Za-zÀ-ÿ]/.test(v) && v.length >= 3; }) >= 0.8;
}

function ehPessoa(vals, dica) {
  var nomes = listaPrimeirosNomes();
  var parece = 0, comPrimeiro = 0;
  for (var i = 0; i < vals.length; i++) {
    var v = vals[i];
    if (!RE_PALAVRAS_NOME.test(v)) continue;
    var palavras = v.split(' ');
    if (palavras.length < 2 && dica !== 'pessoa') continue;
    parece++;
    if (nomes.has(U.normalizar(palavras[0]))) comPrimeiro++;
  }
  if (comPrimeiro / vals.length >= 0.6) return true;
  return dica === 'pessoa' && parece / vals.length >= 0.8;
}

function classificarTextos(vals, dica) {
  var n = vals.length;
  if (!n) return 'texto';
  var fCpf = fracao(vals, ehCpfTexto), fCnpj = fracao(vals, ehCnpjTexto);
  if (fCpf >= 0.8) return 'cpf';
  if (fCnpj >= 0.8) return 'cnpj';
  if (fCpf + fCnpj >= 0.8) return fCpf >= fCnpj ? 'cpf' : 'cnpj';
  if (fracao(vals, U.chaveValida) >= 0.8) return 'chave';
  if (fracao(vals, function (v) { return RE_EMAIL.test(v); }) >= 0.8) return 'email';
  var dt = descritorDataTexto(vals);
  if (dt) return dt.hora ? 'datahora' : 'data';
  if (descritorHoraTexto(vals)) return 'hora';
  if (fracao(vals, ehCep) >= 0.8 || (dica === 'cep' && fracao(vals, function (v) { return /^\d{8}$/.test(v); }) >= 0.8)) return 'cep';
  if (fracao(vals, ehTelefone) >= 0.8 && (dica !== 'codigo' || fracao(vals, function (v) { return /\(/.test(v); }) >= 0.8)) return 'telefone';
  var lidos = [];
  for (var i = 0; i < n; i++) {
    var x = U.lerNumeroTexto(vals[i]);
    if (x && !x.zeroEsquerda) lidos.push(x);
  }
  if (lidos.length / n >= 0.8) {
    var soDigitos = lidos.every(function (x) { return x.soDigitos; });
    var comprimentos = new Set(vals.map(function (v) { return v.length; }));
    var pareceId = soDigitos && comprimentos.size === 1 && vals[0].length >= 5;
    if (!pareceId) {
      if (fracao(lidos, function (x) { return !!x.sufixo; }) >= 0.5) return 'percentual';
      if (fracao(lidos, function (x) { return !!x.prefixo; }) >= 0.5) return 'moeda';
      return lidos.some(function (x) { return x.casas > 0; }) ? 'decimal' : 'inteiro';
    }
  }
  if (ehSimNao(vals)) return 'simnao';
  if (ehUF(vals)) return 'uf';
  if (ehCidade(vals, dica)) return 'cidade';
  if (ehEndereco(vals, dica)) return 'endereco';
  if (ehBairro(vals, dica)) return 'bairro';
  var distintosLista = new Set(vals).size;
  if (dica === 'categoria' && distintosLista <= 30 && n / distintosLista >= 2) return 'categoria';
  if (ehCodigo(vals)) return 'codigo';
  if (ehEmpresa(vals, dica)) return 'empresa';
  if (ehPessoa(vals, dica)) return 'pessoa';
  var distintos = new Set(vals).size;
  if (distintos <= 30 && distintos < n && n / distintos >= 2) return 'categoria';
  if (dica === 'categoria' && distintos <= 30) return 'categoria';
  return 'texto';
}

// ---------- perfis (calculados só quando pedidos e guardados em cache por tipo/armazenamento) ----------
function perfil(col) {
  var chave = col.tipo + '|' + col.armazenamento + (col.tipo === 'categoria' ? '|' + (col.rotulosReais !== false) : '');
  var p = col.cache[chave];
  if (!p) {
    p = montarPerfil(col, col.tipo, col.armazenamento);
    col.cache[chave] = p;
  }
  return p;
}

function montarPerfil(col, tipo, arm) {
  var cels = col.cels || [];
  var p = { tipo: tipo, arm: arm, semDados: !cels.length };
  var textosArroba = 0, textos = 0;
  for (var i = 0; i < cels.length; i++) {
    if (cels[i].t === 's') {
      textos++;
      if (cels[i].z === '@') textosArroba++;
    }
  }
  p.zTexto = textos && textosArroba / textos >= 0.5 ? '@' : undefined;
  p.blocos = (col.taxaBlocos || 0) >= 0.5;
  var fam = FAMILIA[tipo];
  if (fam === 'data') perfilData(p, cels, col);
  else if (fam === 'numero') perfilNumero(p, cels, col);
  else if (fam === 'mascara') perfilMascara(p, cels);
  else if (fam === 'texto') perfilTexto(p, cels, col);
  else if (fam === 'constante') perfilConstante(p, cels, col);
  return p;
}

function perfilConstante(p, cels, col) {
  var c = cels[0];
  if (!c) { p.cel = { t: 's', v: '' }; return; }
  p.cel = { t: c.t, v: c.v };
  if (c.z != null) p.cel.z = c.z;
  var k = U.tipoDoFormato(c.z);
  if (c.t === 'n' && col.data1904 && (k === 'data' || k === 'datahora')) p.cel.v += 1462;
}

// Frequência de cada valor, da mais comum para a menos comum (sem guardar os valores).
function frequenciasOrdenadas(chaves) {
  var pesos = [];
  frequencias(chaves).forEach(function (q) { pesos.push(q); });
  return pesos.sort(function (a, b) { return b - a; });
}

function quantis(ordenados) {
  if (!ordenados.length) return null;
  var q = [];
  for (var j = 0; j <= 20; j++) {
    var pos = j / 20 * (ordenados.length - 1), i = Math.floor(pos), t = pos - i;
    q.push(i + 1 < ordenados.length ? ordenados[i] + (ordenados[i + 1] - ordenados[i]) * t : ordenados[i]);
  }
  return q;
}

function zDeDescritorData(d, tipo) {
  var h = null;
  if (tipo === 'hora') h = d;
  else if (tipo === 'datahora') h = d.hora || TEXTO_PADRAO.datahora.hora;
  var hz = h ? (h.hPad ? 'hh' : 'h') + ':mm' + (h.seg ? ':ss' : '') : '';
  if (tipo === 'hora') return hz;
  var dd = d.dPad ? 'dd' : 'd', mm = d.mPad ? 'mm' : 'm', yy = d.ano === 2 ? 'yy' : 'yyyy';
  var partes = d.ordem === 'ymd' ? [yy, mm, dd] : d.ordem === 'mdy' ? [mm, dd, yy] : [dd, mm, yy];
  var sep = d.sep === '.' ? '\\.' : d.sep;
  return partes.join(sep) + (tipo === 'datahora' ? ' ' + hz : '');
}

function perfilData(p, cels, col) {
  var tipo = p.tipo, serials = [], textos = [], zs = [];
  for (var i = 0; i < cels.length; i++) {
    var cel = cels[i];
    if (cel.t === 'n') {
      var k = U.tipoDoFormato(cel.z);
      if (k !== 'data' && k !== 'datahora' && k !== 'hora') continue;
      if (tipo !== 'hora' && k === 'hora') continue;
      var v = cel.v;
      if (tipo === 'hora') v = v - Math.floor(v);
      else if (col.data1904) v += 1462;
      serials.push(v);
      if (k === tipo) zs.push(cel.z);
    } else if (cel.t === 's') {
      textos.push(String(cel.v).trim());
    }
  }
  var desc;
  if (tipo === 'hora') {
    desc = descritorHoraTexto(textos);
    if (desc) {
      for (i = 0; i < textos.length; i++) {
        var h = U.lerHoraTexto(textos[i]);
        if (h) serials.push(h.fracao);
      }
    }
  } else {
    desc = descritorDataTexto(textos);
    if (desc) {
      for (i = 0; i < textos.length; i++) {
        var dt = U.lerDataTexto(textos[i]);
        if (!dt) continue;
        var ymd = U.interpretarData(dt.partes, desc.ordem);
        if (!ymd) continue;
        var hr = dt.hora || { h: 0, mi: 0, s: 0 };
        serials.push(U.serialDeData(ymd.y, ymd.m, ymd.d, hr.h, hr.mi, hr.s));
      }
    }
  }
  var texto = desc ? copiar(desc) : copiar(TEXTO_PADRAO[tipo]);
  if (tipo === 'data') texto.hora = null;
  if (tipo === 'datahora' && !texto.hora) texto.hora = copiar(TEXTO_PADRAO.datahora.hora);
  p.texto = texto;
  p.z = modal(zs) || (desc ? zDeDescritorData(desc, tipo) : FORMATO_PADRAO[tipo]);
  if (tipo === 'data') {
    p.segundos = false;
  } else {
    var comSeg = serials.some(function (s) { return U.chaveTempo(s) % 60 !== 0; });
    var descSeg = tipo === 'hora' ? texto.seg : texto.hora.seg;
    p.segundos = comSeg || (p.arm === 'nativo' ? U.formatoTemSegundos(p.z) : descSeg);
  }
  if (serials.length) {
    p.min = minimo(serials);
    p.max = maximo(serials);
    p.ordem = ordemDe(serials);
  } else if (tipo === 'hora') {
    p.min = 8 / 24; p.max = 18 / 24; p.ordem = null;
  } else {
    var hoje = hojeSerial();
    p.min = hoje - 730; p.max = hoje; p.ordem = null;
  }
  p.reais = new Set(serials.map(function (s) { return tipo === 'data' ? Math.floor(s) : U.chaveTempo(s); }));
}

function zPadraoNumero(tipo, desc, casas) {
  var zeros = function (k) { return k > 0 ? '.' + new Array(k + 1).join('0') : ''; };
  if (tipo === 'inteiro') return desc && desc.milhar ? '#,##0' : '0';
  if (tipo === 'decimal') return (desc && !desc.milhar ? '0' : '#,##0') + zeros(casas);
  if (tipo === 'moeda') return '"R$" #,##0' + zeros(casas);
  return '0' + zeros(Math.max(casas - 2, 0)) + '%';
}

function perfilNumero(p, cels, col) {
  var tipo = p.tipo, nums = [], lidos = [], zs = [], nativos = 0;
  var famDetectada = FAMILIA[col.tipoDetectado];
  function compat(z) {
    var k = U.tipoDoFormato(z);
    if (tipo === 'moeda') return k === 'moeda';
    if (tipo === 'percentual') return k === 'percentual';
    return k === 'numero' || k === 'geral' || k === 'moeda';
  }
  for (var i = 0; i < cels.length; i++) {
    var cel = cels[i];
    if (cel.t === 'n') {
      var k = U.tipoDoFormato(cel.z);
      if ((k === 'data' || k === 'datahora' || k === 'hora') && famDetectada !== 'numero') continue;
      nums.push(cel.v);
      nativos++;
      if (compat(cel.z || 'General')) zs.push(cel.z || 'General');
    } else if (cel.t === 's') {
      var x = U.lerNumeroTexto(cel.v);
      if (x && !x.zeroEsquerda) {
        lidos.push(x);
        nums.push(x.sufixo ? x.valor / 100 : x.valor);
      }
    }
  }
  var zModal = modal(zs);
  var desc = lidos.length ? descritorNumeroTexto(lidos, tipo) : null;
  var casas;
  if (tipo === 'inteiro') casas = 0;
  else if (zModal && zModal !== 'General') casas = U.casasDoFormato(zModal) + (tipo === 'percentual' ? 2 : 0);
  else if (desc && !nativos) casas = desc.casas + (tipo === 'percentual' && desc.sufixo ? 2 : 0);
  else if (nums.length) {
    casas = 0;
    for (i = 0; i < nums.length; i++) casas = Math.max(casas, Math.min(6, U.decimaisDe(nums[i])));
  } else casas = tipo === 'percentual' ? 4 : 2;
  if (casas === 0 && (tipo === 'decimal' || tipo === 'moeda')) casas = 2;
  p.casas = casas;
  if (zModal && (zModal !== 'General' || tipo === 'inteiro' || tipo === 'decimal')) p.z = zModal;
  else p.z = zPadraoNumero(tipo, desc, casas);
  var texto = desc || copiar(TEXTO_PADRAO[tipo]);
  texto.casas = tipo === 'percentual' ? Math.max(casas - 2, 0) : casas;
  if (tipo === 'percentual' && !texto.sufixo) texto.sufixo = '%';
  p.texto = texto;
  var pos = [], neg = [];
  for (i = 0; i < nums.length; i++) {
    if (nums[i] > 0) pos.push(nums[i]);
    else if (nums[i] < 0) neg.push(-nums[i]);
  }
  p.pos = pos.length ? { min: minimo(pos), max: maximo(pos) } : null;
  p.neg = neg.length ? { min: minimo(neg), max: maximo(neg) } : null;
  p.fracNeg = pos.length + neg.length ? neg.length / (pos.length + neg.length) : 0;
  p.fracZero = nums.length ? (nums.length - pos.length - neg.length) / nums.length : 0;
  var ord = function (a, b) { return a - b; };
  p.qPos = pos.length >= 5 ? quantis(pos.slice().sort(ord)) : null;
  p.qNeg = neg.length >= 5 ? quantis(neg.slice().sort(ord)) : null;
  p.unico = nums.length >= 5 && new Set(nums).size === nums.length;
  if (!p.pos && !p.neg) {
    var padrao = { inteiro: [1, 1000], decimal: [1, 1000], moeda: [10, 5000], percentual: [0.01, 0.5] }[tipo];
    p.pos = { min: padrao[0], max: padrao[1] };
  }
  p.ordem = ordemDe(nums);
  p.seq = null;
  if (tipo === 'inteiro' && nums.length >= 5 && nums.every(function (v) { return Math.floor(v) === v; })) {
    var difs = [];
    for (i = 1; i < nums.length; i++) difs.push(nums[i] - nums[i - 1]);
    var passo = modal(difs);
    if (passo > 0 && fracao(difs, function (d) { return d === passo; }) >= 0.9) {
      p.seq = { passo: passo, ultimo: nums[nums.length - 1], restantes: col.restantes || 0 };
    }
  }
  p.reais = new Set(nums.map(function (v) { return U.chaveNumero(v, casas); }));
}

function perfilMascara(p, cels) {
  var tipo = p.tipo, textos = [], nativos = [];
  for (var i = 0; i < cels.length; i++) {
    if (cels[i].t === 's') textos.push(String(cels[i].v).trim());
    else if (cels[i].t === 'n') nativos.push(cels[i]);
  }
  var valida = VALIDA_MASCARA[tipo];
  var mascaras = new Map();
  for (i = 0; i < textos.length; i++) {
    if (!valida(textos[i])) continue;
    var m = U.mascaraDe(textos[i]);
    if (tipo === 'cnpj') m = m.replace(/[Aa]/g, '9');
    mascaras.set(m, (mascaras.get(m) || 0) + 1);
  }
  var lista = [];
  mascaras.forEach(function (n, m) { lista.push({ m: m, n: n }); });
  lista.sort(function (a, b) { return b.n - a.n; });
  p.mascaras = lista.length ? lista.slice(0, 5) : [{ m: MASCARA_PADRAO[tipo], n: 1 }];
  p.alfanumerico = tipo === 'cnpj' && textos.some(function (v) {
    return /[A-Z]/i.test(v.replace(/[^0-9A-Z]/gi, '').slice(0, 12));
  });
  var zs = nativos.map(function (c) { return c.z; }).filter(function (z) { return z && z !== 'General'; });
  p.z = modal(zs) || (nativos.length ? 'General' : FORMATO_PADRAO[tipo]);
  if (tipo === 'chave') {
    p.modelo = modal(textos.filter(U.chaveValida).map(function (v) { return v.replace(/\s+/g, '').slice(20, 22); })) || '55';
  }
  var tam = { cpf: 11, cnpj: 14, cep: 8, telefone: 0, chave: 44 }[tipo];
  var reais = new Set();
  textos.forEach(function (v) { reais.add(v.replace(/[^0-9A-Z]/gi, '').toUpperCase()); });
  nativos.forEach(function (c) { reais.add(tam ? preencherZeros(c.v, tam) : String(c.v)); });
  p.reais = reais;
  p.freqs = frequenciasOrdenadas(textos.concat(nativos.map(function (c) { return String(c.v); })));
}

function sufixoEmpresa(v) {
  var n = U.normalizar(v);
  if (/(^|\s)ltda\.?$/.test(n)) return 'Ltda';
  if (/(^|\s)(s\.?a\.?|s\/a)$/.test(n)) return 'S.A.';
  if (/(^|\s)me$/.test(n)) return 'ME';
  if (/(^|\s)eireli$/.test(n)) return 'EIRELI';
  if (/(^|\s)epp$/.test(n)) return 'EPP';
  return '';
}

function modelosCodigo(textos) {
  var grupos = new Map();
  textos.forEach(function (v) {
    var m = U.mascaraDe(v);
    var g = grupos.get(m);
    if (!g) { g = { m: m, n: 0, amostra: v, constante: [] }; grupos.set(m, g); }
    if (g.n === 0) {
      for (var i = 0; i < v.length; i++) g.constante.push(v.charAt(i));
    } else {
      for (var j = 0; j < v.length; j++) if (g.constante[j] !== v.charAt(j)) g.constante[j] = null;
    }
    g.n++;
  });
  var lista = [];
  grupos.forEach(function (g) { lista.push(g); });
  lista.sort(function (a, b) { return b.n - a.n; });
  return lista.slice(0, 5).map(function (g) {
    var tokens = [];
    for (var i = 0; i < g.m.length; i++) {
      var ch = g.m.charAt(i);
      if (ch === '9') tokens.push({ k: '9' });
      else if (ch === 'A' || ch === 'a') tokens.push(g.constante[i] != null && g.n > 1 ? { k: 'L', ch: g.constante[i] } : { k: ch });
      else tokens.push({ k: 'L', ch: ch });
    }
    return { tokens: tokens, n: g.n, m: g.m };
  });
}

function descreverModelo(tokens) {
  return tokens.map(function (t) { return t.k === 'L' ? t.ch : t.k; }).join('');
}

function perfilTexto(p, cels, col) {
  var tipo = p.tipo;
  var textos = [];
  for (var i = 0; i < cels.length; i++) {
    var t = textoDaCelula(cels[i]);
    if (t !== '') textos.push(t);
  }
  p.caixa = U.estiloCaixa(textos);
  if (REPETEM[tipo]) p.freqs = frequenciasOrdenadas(textos);
  var freq = frequencias(textos);
  p.distintos = freq.size;
  if (tipo === 'cidade' || tipo === 'endereco' || tipo === 'bairro' || tipo === 'uf') {
    p.acento = textos.length ? textos.some(function (v) { return /[À-ÿ]/.test(v); }) : true;
  }
  if (tipo === 'uf') {
    p.extenso = textos.length ? fracao(textos, ehNomeUF) >= 0.5 : false;
    if (!textos.length) p.caixa = 'maiusculo';
  } else if (tipo === 'endereco') {
    // Como o logradouro começa (RUA, R., AV...) e como o número vem depois do nome.
    var inicios = [];
    textos.forEach(function (v) { var m = /^\s*([A-Za-zÀ-ÿ]+\.?)\s/.exec(v); if (m && RE_LOGRADOURO.test(nomeLugar(m[1]))) inicios.push(m[1]); });
    p.inicios = inicios.length ? inicios : ['Rua', 'Avenida', 'Rua', 'Travessa'];
    p.numero = fracao(textos, function (v) { return /,\s*\d+/.test(v); }) >= 0.5 ? ', '
      : fracao(textos, function (v) { return /\s\d+\s*$/.test(v); }) >= 0.5 ? ' ' : '';
  }
  if (tipo === 'pessoa') {
    p.palavras = textos.map(function (v) { return Math.min(5, Math.max(2, v.split(/\s+/).length)); });
    if (!p.palavras.length) p.palavras = [2, 3];
  } else if (tipo === 'empresa') {
    p.sufixos = textos.map(sufixoEmpresa);
    if (!p.sufixos.length) p.sufixos = ['Ltda', 'S.A.', 'ME', ''];
  } else if (tipo === 'codigo') {
    var comDigito = textos.filter(function (v) { return /\d/.test(v); });
    p.modelos = modelosCodigo(comDigito.length ? comDigito : textos);
    if (!p.modelos.length) p.modelos = modelosCodigo(['ABC-12345', 'XYZ-67890']);
    p.modelos.forEach(function (m) { m.descricao = descreverModelo(m.tokens); });
  } else if (tipo === 'categoria') {
    // Opções da lista com a frequência de cada uma. Os rótulos reais só são usados se a coluna permitir.
    var porChave = new Map();
    cels.forEach(function (c) {
      var k = chaveCelula(c);
      var o = porChave.get(k);
      if (!o) {
        o = { cel: { t: c.t, v: c.t === 's' ? String(c.v).trim() : c.v }, n: 0 };
        if (c.z != null) o.cel.z = c.z;
        porChave.set(k, o);
      }
      o.n++;
    });
    var opcoes = [];
    porChave.forEach(function (o) { opcoes.push(o); });
    opcoes.sort(function (a, b) { return b.n - a.n; });
    p.opcoes = opcoes;
    p.pesos = opcoes.length ? opcoes.map(function (o) { return o.n; }) : [4, 3, 2, 1];
    p.rotulosReais = col ? col.rotulosReais !== false : true;
  } else if (tipo === 'simnao') {
    var nativos = cels.filter(function (c) { return c.t === 'b'; });
    var voc = listaSimNao();
    var tokens = [];
    freq.forEach(function (q, v) { if (voc.has(U.normalizar(v))) tokens.push({ v: v, n: q }); });
    tokens.sort(function (a, b) { return b.n - a.n; });
    if (nativos.length) {
      p.fracVerdadeiro = nativos.filter(function (c) { return c.v; }).length / nativos.length;
    } else {
      var positivos = { sim: 1, s: 1, yes: 1, y: 1, 'true': 1, verdadeiro: 1, v: 1, x: 1, ok: 1 };
      var tot = 0, pos = 0;
      tokens.forEach(function (t) { tot += t.n; if (positivos[U.normalizar(t.v)]) pos += t.n; });
      p.fracVerdadeiro = tot ? pos / tot : 0.6;
    }
    var fv = p.fracVerdadeiro;
    p.tokens = tokens.length && !nativos.length ? tokens.slice(0, 3) :
      [{ v: 'Sim', n: Math.max(1, Math.round(fv * 10)) }, { v: 'Não', n: Math.max(1, Math.round((1 - fv) * 10)) }];
  } else if (tipo === 'texto') {
    p.comprimentos = textos.slice(0, 300).map(function (v) { return v.length; });
    if (!p.comprimentos.length) p.comprimentos = [20, 30, 40];
    p.umaPalavra = textos.length > 0 && fracao(textos, function (v) { return !/\s/.test(v); }) >= 0.8;
  }
}

// ---------- API ----------
function analisarAba(aba, arquivo, linhaForcada) {
  if (aba.linhaCabDetectada === undefined) {
    aba.linhaCabDetectada = aba.linhaCabFixa != null ? aba.linhaCabFixa : detectarCabecalho(aba);
  }
  aba.linhaCab = linhaForcada != null ? linhaForcada : aba.linhaCabDetectada;
  aba.cabecalhoManual = linhaForcada != null && linhaForcada !== aba.linhaCabDetectada;
  construirColunas(aba, arquivo);
}

function analisarArquivo(arquivo) {
  for (var i = 0; i < arquivo.abas.length; i++) analisarAba(arquivo.abas[i], arquivo, arquivo.abas[i].linhaCabFixa);
  return arquivo;
}

function armazenamentoPadrao(col, tipo) {
  var arms = TIPOS[tipo].arm;
  if (arms.length === 1) return arms[0];
  if (tipo === col.tipoDetectado) return col.armDetectado;
  var fam = FAMILIA[tipo];
  if (col.origem === 'csv' || col.origem === 'colado' || !col.cels || !col.cels.length) {
    return fam === 'data' || fam === 'numero' ? 'nativo' : 'texto';
  }
  return col.maioriaTexto ? 'texto' : 'nativo';
}

function definirTipo(col, tipo) {
  col.tipo = tipo;
  col.armazenamento = armazenamentoPadrao(col, tipo);
}

function definirArmazenamento(col, arm) {
  if (TIPOS[col.tipo].arm.indexOf(arm) >= 0) col.armazenamento = arm;
}

A.detectar = {
  TIPOS: TIPOS,
  ORDEM_TIPOS: ORDEM_TIPOS,
  FAMILIA: FAMILIA,
  tipoPorNome: tipoPorNome,
  celulaVazia: vazia,
  nomeLugar: nomeLugar,
  ufsDaCidade: ufsDaCidade,
  ehSiglaUF: ehSiglaUF,
  siglaUF: siglaUF,
  nomeDaUF: nomeDaUF,
  chaveCelula: chaveCelula,
  quantis: quantis,
  analisarArquivo: analisarArquivo,
  analisarAba: analisarAba,
  perfil: perfil,
  definirTipo: definirTipo,
  definirArmazenamento: definirArmazenamento,
  armazenamentoPadrao: armazenamentoPadrao
};
