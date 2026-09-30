/* Resumo em texto da estrutura (sem valores reais) e descrições curtas de formato. Sem DOM. */
import { A } from './amostra.js';

var U = A.util;
var AVISO_AMOSTRA = 'Tipos e vazios analisados nas primeiras ' + A.LIMITES.AMOSTRA +
  ' linhas de dados de cada aba (não na planilha inteira). Os valores do arquivo de amostra são fictícios.';

var ORDENS = ['milésimos', 'centésimos', 'décimos', 'unidades', 'dezenas', 'centenas', 'milhares',
  'dezenas de milhar', 'centenas de milhar', 'milhões', 'dezenas de milhões', 'centenas de milhões', 'bilhões'];

function nomeOrdem(x) {
  var e = Math.floor(Math.log(x) / Math.LN10 + 1e-9);
  var i = e + 3;
  if (i >= 0 && i < ORDENS.length) return ORDENS[i];
  return '10^' + e;
}

function pct(x) { return Math.round(x * 100) + '%'; }

function padraoData(d, tipo) {
  if (tipo === 'hora') return (d.hPad ? 'hh' : 'h') + ':mm' + (d.seg ? ':ss' : '');
  var dd = d.dPad ? 'dd' : 'd', mm = d.mPad ? 'mm' : 'm', aa = d.ano === 2 ? 'aa' : 'aaaa';
  var partes = d.ordem === 'ymd' ? [aa, mm, dd] : d.ordem === 'mdy' ? [mm, dd, aa] : [dd, mm, aa];
  var s = partes.join(d.sep);
  if (tipo === 'datahora' && d.hora) s += (d.hora.sep === 'T' ? 'T' : ' ') + padraoData(d.hora, 'hora');
  return s;
}

function padraoNumero(p) {
  var exemplo = p.texto.casas > 0 ? 1234.5 : 1234;
  return U.formatarNumeroTexto(exemplo, p.texto).replace(/\d/g, '9');
}

function descreverFormato(col) {
  var DET = A.detectar;
  if (col.tipo === 'vazia') return 'sem valores';
  var p = DET.perfil(col);
  var fam = DET.FAMILIA[col.tipo];
  if (fam === 'data') return p.arm === 'nativo' ? 'Excel: ' + p.z : 'Texto: ' + padraoData(p.texto, col.tipo);
  if (fam === 'numero') {
    if (p.arm === 'nativo') {
      var z = !p.z || p.z === 'General' ? 'Geral' : p.z;
      return 'Excel: ' + z + (z === 'Geral' ? ' · ' + p.casas + ' casas' : '');
    }
    return 'Texto: ' + padraoNumero(p);
  }
  if (fam === 'mascara') {
    if (p.arm === 'nativo') return 'Excel: ' + (p.z === 'General' ? 'Geral (número)' : p.z);
    if (col.tipo === 'chave') return 'Texto: 44 dígitos com dígito verificador válido; modelo ' + p.modelo + (p.modelo === '57' ? ' (CT-e)' : p.modelo === '55' ? ' (NF-e)' : '');
    return 'Texto: ' + p.mascaras.slice(0, 2).map(function (m) { return m.m; }).join(' ou ');
  }
  var caixa = p.caixa === 'maiusculo' ? ' em MAIÚSCULAS' : p.caixa === 'minusculo' ? ' em minúsculas' : '';
  if (col.tipo === 'codigo') return 'Padrão: ' + p.modelos.slice(0, 2).map(function (m) { return m.descricao; }).join(' ou ');
  if (col.tipo === 'categoria') return p.pesos.length + ' opções' + caixa;
  if (col.tipo === 'simnao') {
    return p.arm === 'nativo' ? 'VERDADEIRO/FALSO do Excel' : p.tokens.map(function (t) { return t.v; }).join(' / ');
  }
  if (col.tipo === 'constante') return 'valor fixo';
  if (col.tipo === 'cidade') return 'nome de município brasileiro' + caixa + (p.acento === false ? ', sem acentos' : '');
  if (col.tipo === 'uf') return (p.extenso ? 'nome do estado por extenso' : 'sigla de 2 letras') + caixa;
  if (col.tipo === 'endereco') return 'logradouro (' + p.inicios[0] + ' …)' + (p.numero ? ' com número' : '') + caixa;
  if (col.tipo === 'bairro') return 'nome de bairro' + caixa;
  return 'Texto' + caixa;
}

function valorLegivel(c) {
  if (!c) return '(vazio)';
  return A.app && A.app.exibir ? A.app.exibir(c) : String(c.v);
}

// Repetição dos valores na coluna, em palavras.
function descreverRepeticao(col) {
  var n = col.preenchidas || 0, d = col.distintos || 0;
  if (!n) return null;
  var txt;
  if (d === 1) txt = 'sempre o mesmo valor';
  else if (d === n) txt = 'nunca se repete (cada linha tem um valor diferente)';
  else if (d / n >= 0.9) txt = 'quase nunca se repete (' + d + ' valores diferentes em ' + n + ' linhas)';
  else txt = 'se repete (' + d + ' valores diferentes em ' + n + ' linhas)';
  if (d > 1 && (col.taxaBlocos || 0) >= 0.5) txt += '; valores iguais aparecem em linhas seguidas';
  return txt;
}

function descreverRelacoes(aba) {
  var porC = {};
  aba.colunas.forEach(function (c) { porC[c.c] = c; });
  function nome(c) { return porC[c] ? porC[c].letra + ' "' + porC[c].nome + '"' : U.letraColuna(c); }
  var SINAL = { produto: ' × ', soma: ' + ', diferenca: ' − ' };
  return (aba.relacoes || []).map(function (r) {
    if (r.tipo === 'igual') return nome(r.dep) + ' é igual a ' + nome(r.base) + ' em ' + pct(r.taxa) + ' das linhas';
    if (r.tipo === 'mesmaUF') return 'quando diferentes, ' + nome(r.dep) + ' fica na mesma UF de ' + nome(r.base) + ' em ' + pct(r.taxa) + ' das linhas';
    if (r.tipo === 'ufDaCidade') return nome(r.uf) + ' é a UF da cidade em ' + nome(r.cidade);
    if (r.tipo === 'formatoPorOpcao') {
      var pk = porC[r.cat] ? A.detectar.perfil(porC[r.cat]) : null;
      var partes = Object.keys(r.mapa).map(function (k) {
        var op = pk && pk.opcoes ? pk.opcoes.filter(function (o) { return A.detectar.chaveCelula(o.cel) === k; })[0] : null;
        var rot = op && pk.rotulosReais ? valorLegivel(op.cel) : 'uma opção';
        return rot + ' → ' + mascaraLegivel(porC[r.dep], r.mapa[k]);
      });
      return 'o formato de ' + nome(r.dep) + ' depende de ' + nome(r.cat) + ': ' + partes.join('; ');
    }
    if (r.tipo === 'ordemData') {
      var dias = Math.round(r.mediana * 10) / 10;
      return nome(r.depois) + ' é sempre igual ou posterior a ' + nome(r.antes) + ' (diferença típica: ' + String(dias).replace('.', ',') + (dias === 1 ? ' dia)' : ' dias)');
    }
    if (r.tipo === 'conta') return nome(r.c) + ' = ' + nome(r.a) + SINAL[r.op] + nome(r.b);
    return '';
  }).filter(Boolean);
}

// Máscara de código em notação legível: # = número, @ = letra, letras fixas mantidas (ex.: CTE-######).
function mascaraLegivel(col, mascara) {
  var p = col ? A.detectar.perfil(col) : null;
  var modelo = p && p.modelos ? p.modelos.filter(function (m) { return m.m === mascara; })[0] : null;
  if (modelo) return modelo.tokens.map(function (t) { return t.k === 'L' ? t.ch : t.k === '9' ? '#' : '@'; }).join('');
  return mascara.replace(/9/g, '#').replace(/[Aa]/g, '@');
}

function descreverArmazenamento(col, p) {
  var fam = A.detectar.FAMILIA[col.tipo];
  if (col.tipo === 'vazia') return 'vazia';
  var celFixa = col.tipo === 'constante' ? p.cel : col.tipo === 'categoria' && p.opcoes && p.opcoes[0] ? p.opcoes[0].cel : null;
  if (celFixa) {
    var k = U.tipoDoFormato(celFixa.z);
    if (celFixa.t === 'b') return 'booleano do Excel';
    if (celFixa.t !== 'n') return 'texto';
    return k === 'data' || k === 'datahora' || k === 'hora' ? 'data do Excel' : 'número do Excel';
  }
  if (p.arm === 'texto') return 'texto';
  if (fam === 'data') return 'data do Excel';
  if (col.tipo === 'simnao') return 'booleano do Excel';
  return 'número do Excel';
}

function descreverColuna(col) {
  var DET = A.detectar;
  var partes = [DET.TIPOS[col.tipo].rotulo];
  if (col.tipo !== 'vazia') {
    var p = DET.perfil(col);
    var fam = DET.FAMILIA[col.tipo];
    partes.push('armazenado como ' + descreverArmazenamento(col, p));
    partes.push('formato ' + descreverFormato(col));
    if (fam === 'numero') {
      partes.push(p.casas + (p.casas === 1 ? ' casa decimal' : ' casas decimais'));
      if (!p.semDados) {
        var escala = p.tipo === 'percentual' ? 100 : 1;
        var faixas = [];
        if (p.pos) faixas.push('de ' + nomeOrdem(p.pos.min * escala) + ' a ' + nomeOrdem(p.pos.max * escala));
        if (p.neg) faixas.push('negativos de ' + nomeOrdem(p.neg.min * escala) + ' a ' + nomeOrdem(p.neg.max * escala));
        partes.push('ordem de grandeza ' + faixas.join(', ') + (p.tipo === 'percentual' ? ' (em %)' : ''));
      }
      if (p.seq) partes.push('sequencial');
      if (p.fracZero >= 0.05) partes.push(pct(p.fracZero) + ' das células são zero');
    }
    if ((fam === 'numero' || fam === 'data') && p.ordem && !p.seq) {
      partes.push(p.ordem === 'asc' ? 'em ordem crescente' : 'em ordem decrescente');
    }
    if (col.tipo === 'categoria') {
      partes.push(p.rotulosReais
        ? 'opções: ' + p.opcoes.slice(0, 15).map(function (o) { return valorLegivel(o.cel) + ' (' + pct(o.n / col.preenchidas) + ')'; }).join(', ') + (p.opcoes.length > 15 ? ', …' : '')
        : 'opções trocadas por "Categoria A", "Categoria B"…');
    }
    if (col.tipo === 'constante') partes.push('valor: ' + valorLegivel(p.cel));
  }
  var rep = descreverRepeticao(col);
  if (rep && col.tipo !== 'constante') partes.push(rep);
  partes.push('vazios ' + pct(col.razaoVazios || 0));
  if (col.manter) partes.push('valores reais mantidos na amostra');
  if (col.tipo !== col.tipoDetectado) partes.push('tipo ajustado manualmente (detectado: ' + DET.TIPOS[col.tipoDetectado].rotulo + ')');
  return partes.join('; ');
}

function mergeDaCelula(aba, r, c) {
  for (var i = 0; i < (aba.merges || []).length; i++) {
    var m = aba.merges[i];
    if (m.s.r === r && m.s.c === c) {
      return U.letraColuna(m.s.c) + (m.s.r + 1) + ':' + U.letraColuna(m.e.c) + (m.e.r + 1);
    }
  }
  return null;
}

function descreverLinhasAcima(aba) {
  var itens = [];
  for (var r = 0; r < aba.linhaCab; r++) {
    var linha = aba.linhas[r];
    var cels = [];
    if (linha) for (var c = 0; c < linha.length; c++) if (!A.detectar.celulaVazia(linha[c])) cels.push(c);
    if (!cels.length) { itens.push('linha ' + (r + 1) + ': vazia'); continue; }
    var desc = cels.map(function (c) {
      var m = mergeDaCelula(aba, r, c);
      return U.letraColuna(c) + (r + 1) + (m ? ' (mesclada ' + m + ')' : '');
    });
    itens.push('linha ' + (r + 1) + ': texto em ' + desc.join(', '));
  }
  return itens;
}

function texto(arquivo) {
  var DET = A.detectar;
  var out = [];
  out.push('ESTRUTURA DA PLANILHA: ' + arquivo.nome);
  out.push(AVISO_AMOSTRA);
  if (arquivo.origem === 'csv') {
    out.push('Origem: CSV (separador ' + (arquivo.separador === '\t' ? 'tabulação' : '"' + arquivo.separador + '"') +
      ', codificação ' + arquivo.codificacao + '). No arquivo de amostra vira uma aba de .xlsx.');
  }
  if (arquivo.origem === 'colado') out.push('Origem: cabeçalho colado; tipos deduzidos pelo nome da coluna.');
  out.push('Abas: ' + arquivo.abas.length);
  arquivo.abas.forEach(function (aba, i) {
    out.push('');
    out.push('Aba ' + (i + 1) + ': "' + aba.nome + '"' + (aba.oculta ? ' (oculta)' : ''));
    if (aba.linhaCab < 0) { out.push('  Aba vazia.'); return; }
    out.push('  Linha do cabeçalho: ' + (aba.linhaCab + 1) + (aba.cabecalhoManual && arquivo.origem !== 'colado' ? ' (ajustada manualmente)' : ''));
    var acima = descreverLinhasAcima(aba);
    if (acima.length) out.push('  Acima do cabeçalho: ' + acima.join('; '));
    if (arquivo.origem !== 'colado') {
      var lidas = aba.totalDados > aba.nDados ? 'cerca de ' + aba.totalDados + ' (analisadas ' + aba.nDados + ')' : String(aba.nDados);
      out.push('  Linhas de dados no original: ' + lidas);
    }
    out.push('  Colunas (' + aba.colunas.length + '):');
    aba.colunas.forEach(function (col) {
      out.push('  - ' + col.letra + ' "' + col.nome + '": ' + descreverColuna(col));
    });
    var rel = descreverRelacoes(aba);
    if (rel.length) {
      out.push('  Relações entre colunas:');
      rel.forEach(function (t) { out.push('  - ' + t); });
    }
  });
  return out.join('\n');
}

A.resumo = {
  AVISO_AMOSTRA: AVISO_AMOSTRA,
  texto: texto,
  descreverFormato: descreverFormato,
  padraoData: padraoData,
  descreverColuna: descreverColuna,
  descreverRepeticao: descreverRepeticao,
  descreverRelacoes: descreverRelacoes
};
