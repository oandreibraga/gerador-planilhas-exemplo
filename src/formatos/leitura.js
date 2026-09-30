/* Leitura: abre o arquivo UMA vez e converte para um modelo compacto em memória. Sem DOM. */
import { A } from '../nucleo/amostra.js';

var L = A.LIMITES;
var EXT_PLANILHA = { xlsx: 1, xlsm: 1, xls: 1, xlsb: 1, ods: 1 };
var MSG_SENHA = 'Planilhas com senha não podem ser lidas. Para resolver: abra o arquivo no Excel, vá em ' +
  'Arquivo › Informações › Proteger Pasta de Trabalho › Criptografar com Senha, apague a senha, salve e tente de novo.';
var MSG_CORROMPIDO = 'O arquivo pode estar danificado ou não ser uma planilha. ' +
  'Tente abrir no Excel e salvar de novo como .xlsx.';

var leitura = { contador: 0 };

function erro(tipo, mensagem, detalhe) {
  var e = new Error(mensagem);
  e.tipo = tipo;
  e.detalhe = detalhe || '';
  e.amigavel = true;
  return e;
}

function extensao(nome) {
  var m = /\.([^.\\\/]+)$/.exec(nome || '');
  return m ? m[1].toLowerCase() : '';
}
function semExtensao(nome) {
  return String(nome || 'planilha').replace(/^.*[\\\/]/, '').replace(/\.[^.]+$/, '') || 'planilha';
}
function nomeAbaValido(nome) {
  var s = String(nome || '').replace(/[\[\]:*?\/\\]/g, ' ').replace(/^'+|'+$/g, '').trim().slice(0, 31);
  s = s.replace(/^'+|'+$/g, '').trim(); // o corte pode deixar um apóstrofo no fim, que o Excel não aceita
  return s || 'Planilha1';
}

function ehZip(b) { return b.length >= 4 && b[0] === 0x50 && b[1] === 0x4B && (b[2] === 3 || b[2] === 5 || b[2] === 7); }
function ehCfb(b) {
  return b.length >= 8 && b[0] === 0xD0 && b[1] === 0xCF && b[2] === 0x11 && b[3] === 0xE0 &&
    b[4] === 0xA1 && b[5] === 0xB1 && b[6] === 0x1A && b[7] === 0xE1;
}
function pareceTexto(b) {
  var n = Math.min(b.length, 2048), ruins = 0;
  for (var i = 0; i < n; i++) {
    var x = b[i];
    if (x < 9 || (x > 13 && x < 32 && x !== 27)) ruins++;
  }
  return n > 0 && ruins / n < 0.02;
}

function traduzirErro(e, ext, cfb) {
  var msg = String((e && e.message) || e);
  // Senha do Office sempre vem num contêiner CFB; "ZIP encryption" num .xlsx é só um zip corrompido.
  if (/password/i.test(msg) || (cfb && (/encrypt/i.test(msg) || ext === 'xlsx' || ext === 'xlsm' || ext === 'xlsb'))) {
    return erro('senha', MSG_SENHA, msg);
  }
  return erro('corrompido', MSG_CORROMPIDO, msg);
}

// ---------- planilhas (xlsx, xls, ods...) ----------
function limparCelula(cel, textos) {
  if (!cel || cel.t === 'z' || cel.v == null) return null;
  var t = cel.t, v = cel.v;
  if (t === 'd' && v instanceof Date) {
    v = (v.getTime() - Date.UTC(1899, 11, 30)) / 86400000;
    t = 'n';
  }
  if (t === 'e') return { t: 'e', v: v };
  if (t === 's') {
    v = String(v);
    var aparado = v.trim();
    if (!aparado) return null;
    if (aparado.length >= 2) textos.add(aparado);
  }
  var o = { t: t, v: v };
  if (typeof cel.z === 'string' && cel.z !== 'General') o.z = cel.z;
  return o;
}

function extrairLinhas(ws, ref, textos) {
  var linhas = [];
  if (!ref) return linhas;
  var fimR = Math.min(ref.e.r, L.LINHAS_LIDAS - 1);
  var dados = ws['!data'];
  for (var r = 0; r <= fimR; r++) {
    var linha = null, c, cel;
    if (dados) {
      var origem = dados[r];
      if (origem) {
        for (c = 0; c < origem.length; c++) {
          cel = origem[c] ? limparCelula(origem[c], textos) : null;
          if (cel) (linha = linha || [])[c] = cel;
        }
      }
    } else if (r >= ref.s.r) {
      for (c = ref.s.c; c <= ref.e.c; c++) {
        var bruta = ws[XLSX.utils.encode_cell({ r: r, c: c })];
        cel = bruta ? limparCelula(bruta, textos) : null;
        if (cel) (linha = linha || [])[c] = cel;
      }
    }
    linhas[r] = linha;
  }
  return linhas;
}

function copiarCols(cols) {
  if (!cols) return [];
  var saida = [];
  for (var i = 0; i < cols.length; i++) {
    var c = cols[i];
    if (!c) continue;
    var o = {};
    if (c.wch != null) o.wch = c.wch;
    if (c.wpx != null) o.wpx = c.wpx;
    if (c.width != null) o.width = c.width;
    if (c.hidden) o.hidden = true;
    saida[i] = o;
  }
  return saida;
}

function montarArquivo(nome, ext, wb) {
  var data1904 = !!(wb.Workbook && wb.Workbook.WBProps && wb.Workbook.WBProps.date1904);
  var infoAbas = (wb.Workbook && wb.Workbook.Sheets) || [];
  var textosReais = new Set();
  var abas = wb.SheetNames.map(function (nomeAba, i) {
    var ws = wb.Sheets[nomeAba] || {};
    var ref = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : null;
    var cheio = ws['!fullref'] ? XLSX.utils.decode_range(ws['!fullref']) : ref;
    var oculta = infoAbas[i] ? +infoAbas[i].Hidden || 0 : 0;
    return {
      nome: nomeAba,
      indice: i,
      oculta: oculta,
      linhas: extrairLinhas(ws, ref, textosReais),
      totalLinhas: cheio ? cheio.e.r + 1 : 0,
      merges: (ws['!merges'] || []).map(function (m) {
        return { s: { r: m.s.r, c: m.s.c }, e: { r: m.e.r, c: m.e.c } };
      }),
      cols: copiarCols(ws['!cols'])
    };
  });
  return {
    nome: nome,
    base: semExtensao(nome),
    ext: ext,
    origem: 'planilha',
    data1904: data1904,
    abas: abas,
    textosReais: textosReais
  };
}

// ---------- CSV ----------
function decodificar(bytes) {
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) return { texto: new TextDecoder('utf-16le').decode(bytes.subarray(2)), cod: 'UTF-16' };
  var inicio = bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF ? 3 : 0;
  var corpo = bytes.subarray(inicio);
  try {
    return { texto: new TextDecoder('utf-8', { fatal: true }).decode(corpo), cod: 'UTF-8' };
  } catch (e) {
    return { texto: new TextDecoder('windows-1252').decode(corpo), cod: 'Windows-1252' };
  }
}

function contarForaAspas(linha, sep) {
  var n = 0, aspas = false;
  for (var i = 0; i < linha.length; i++) {
    var ch = linha.charAt(i);
    if (ch === '"') aspas = !aspas;
    else if (ch === sep && !aspas) n++;
  }
  return n;
}

function detectarSeparador(texto) {
  var amostra = texto.slice(0, 65536).split(/\r\n|\n|\r/).filter(function (l) { return l.trim() !== ''; }).slice(0, 30);
  var candidatos = [';', '\t', ',', '|'];
  var melhor = ';', melhorPontos = 0;
  candidatos.forEach(function (sep) {
    var freq = {};
    amostra.forEach(function (l) {
      var q = contarForaAspas(l, sep);
      if (q > 0) freq[q] = (freq[q] || 0) + 1;
    });
    var pontos = 0;
    Object.keys(freq).forEach(function (k) { if (freq[k] > pontos) pontos = freq[k]; });
    if (pontos > melhorPontos) { melhorPontos = pontos; melhor = sep; }
  });
  return melhor;
}

function lerRegistros(texto, sep, limite) {
  var registros = [], campo = '', linha = [], aspas = false, i = 0, n = texto.length;
  while (i < n) {
    var ch = texto.charAt(i);
    if (aspas) {
      if (ch === '"') {
        if (texto.charAt(i + 1) === '"') { campo += '"'; i += 2; continue; }
        aspas = false; i++; continue;
      }
      campo += ch; i++; continue;
    }
    if (ch === '"' && campo === '') { aspas = true; i++; continue; }
    if (ch === sep) { linha.push(campo); campo = ''; i++; continue; }
    if (ch === '\r' || ch === '\n') {
      linha.push(campo); campo = '';
      registros.push(linha); linha = [];
      if (ch === '\r' && texto.charAt(i + 1) === '\n') i++;
      i++;
      if (registros.length >= limite) return registros;
      continue;
    }
    campo += ch; i++;
  }
  if (campo !== '' || linha.length) { linha.push(campo); registros.push(linha); }
  return registros;
}

function contarLinhasTexto(texto) {
  var n = 0;
  for (var i = 0; i < texto.length; i++) if (texto.charCodeAt(i) === 10) n++;
  if (texto.length && texto.charCodeAt(texto.length - 1) !== 10) n++;
  return n;
}

function lerCsv(nome, bytes) {
  var dec = decodificar(bytes);
  var texto = dec.texto;
  var sep = detectarSeparador(texto);
  var registros = lerRegistros(texto, sep, L.LINHAS_LIDAS);
  var textosReais = new Set();
  var linhas = registros.map(function (reg) {
    var l = null;
    for (var c = 0; c < reg.length; c++) {
      var v = reg[c], aparado = v.trim();
      if (!aparado) continue;
      (l = l || [])[c] = { t: 's', v: v };
      if (aparado.length >= 2) textosReais.add(aparado);
    }
    return l;
  });
  if (!linhas.some(Boolean)) throw erro('vazio', 'Este arquivo CSV está em branco.');
  var base = semExtensao(nome);
  return {
    nome: nome,
    base: base,
    ext: 'csv',
    origem: 'csv',
    data1904: false,
    separador: sep,
    codificacao: dec.cod,
    abas: [{
      nome: nomeAbaValido(base),
      indice: 0,
      oculta: 0,
      linhas: linhas,
      totalLinhas: contarLinhasTexto(texto),
      merges: [],
      cols: []
    }],
    textosReais: textosReais
  };
}

// Nenhuma aba pode passar do número de colunas que o formato permite. Um arquivo danificado pode "pôr"
// uma célula na coluna 50.000; sem este limite, a análise criaria dezenas de milhares de colunas e travaria.
function conferirColunas(arq, limite, tipo, mensagem) {
  arq.abas.forEach(function (aba) {
    aba.linhas.forEach(function (linha) {
      if (linha && linha.length > limite) throw erro(tipo, mensagem, 'célula na coluna ' + linha.length + ' (limite ' + limite + ')');
    });
    aba.merges = aba.merges.filter(function (m) { return m.e.c < limite; });
  });
  return arq;
}
var MSG_COLUNAS = 'Esta planilha tem mais colunas do que o Excel aceita (16.384). Confira o arquivo e tente de novo.';

// ---------- API ----------
leitura.abrir = function (entrada) {
  leitura.contador++;
  var nome = entrada.nome || 'planilha';
  var bytes = entrada.bytes instanceof Uint8Array ? entrada.bytes : new Uint8Array(entrada.bytes);
  var ext = extensao(nome);
  if (!bytes.length) throw erro('vazio', 'Este arquivo está em branco (0 bytes).');
  if (ext === 'csv' || ext === 'txt') return conferirColunas(lerCsv(nome, bytes), L.COLUNAS, 'grande', MSG_COLUNAS);
  if (!EXT_PLANILHA[ext]) {
    throw erro('formato', 'Este tipo de arquivo' + (ext ? ' (.' + ext + ')' : '') + ' não é aceito. Use uma planilha .xlsx, .xls ou .csv, ou um .zip com planilhas.');
  }
  var zip = ehZip(bytes), cfb = ehCfb(bytes);
  if ((ext === 'xlsx' || ext === 'xlsm' || ext === 'xlsb') && !zip && !cfb) throw erro('corrompido', MSG_CORROMPIDO, 'assinatura desconhecida');
  if ((ext === 'xls' || ext === 'ods') && !zip && !cfb && !pareceTexto(bytes)) throw erro('corrompido', MSG_CORROMPIDO, 'assinatura desconhecida');
  var wb;
  try {
    wb = XLSX.read(bytes, {
      type: 'array',
      dense: true,
      sheetRows: L.LINHAS_LIDAS,
      cellNF: true,
      cellStyles: true, // necessário para o SheetJS ler as larguras de coluna (!cols)
      cellText: false,
      cellHTML: false,
      cellFormula: false
    });
  } catch (e) {
    throw traduzirErro(e, ext, cfb);
  }
  if (!wb || !wb.SheetNames || !wb.SheetNames.length) throw erro('corrompido', MSG_CORROMPIDO, 'nenhuma aba');
  // .xls antigo (contêiner CFB) tem no máximo 256 colunas: além disso, o arquivo está danificado
  return cfb
    ? conferirColunas(montarArquivo(nome, ext, wb), L.COLUNAS_XLS, 'corrompido', MSG_CORROMPIDO)
    : conferirColunas(montarArquivo(nome, ext, wb), L.COLUNAS, 'grande', MSG_COLUNAS);
};

leitura.deCabecalho = function (texto, nomeAba, nomeArquivo) {
  leitura.contador++;
  texto = String(texto || '').replace(/^\uFEFF/, '');
  if (!texto.trim()) throw erro('vazio', 'Cole primeiro os títulos das colunas, copiados do Excel.');
  var reg = lerRegistros(texto, '\t', 1)[0] || [];
  while (reg.length && reg[reg.length - 1].trim() === '') reg.pop();
  if (!reg.length) throw erro('vazio', 'Não encontramos nenhum título de coluna no texto colado.');
  if (reg.length > L.COLUNAS) throw erro('grande', 'O texto colado tem mais títulos do que o Excel aceita (16.384 colunas).');
  var linha = [];
  for (var c = 0; c < reg.length; c++) if (reg[c].trim() !== '') linha[c] = { t: 's', v: reg[c] };
  var base = semExtensao(String(nomeArquivo || '').trim() || 'cabecalho');
  return {
    nome: base + '.xlsx',
    base: base,
    ext: 'xlsx',
    origem: 'colado',
    data1904: false,
    abas: [{
      nome: nomeAbaValido(nomeAba),
      indice: 0,
      oculta: 0,
      linhas: [linha],
      totalLinhas: 1,
      merges: [],
      cols: [],
      linhaCabFixa: 0
    }],
    textosReais: new Set()
  };
};

// Planilhas de dentro de um .zip (ignora pastas, arquivos do macOS, temporários do Excel e o que não é planilha).
// Usa o leitor de zip próprio (confere CRC de cada parte); se o navegador não souber descompactar, usa o do SheetJS.
function filtrarItensZip(lista) {
  var itens = lista.filter(function (it) {
    if (/(^|\/)(__MACOSX|\.)/.test(it.caminho) || /(^|\/)~\$/.test(it.caminho)) return false;
    var ext = extensao(it.caminho);
    return !!EXT_PLANILHA[ext] || ext === 'csv';
  });
  itens.sort(function (a, b) { return a.caminho.localeCompare(b.caminho, 'pt-BR'); });
  if (!itens.length) throw erro('vazio', 'Não encontramos nenhuma planilha (.xlsx, .xls ou .csv) dentro deste .zip.');
  return itens;
}

function listarZipPeloSheetJS(bytes) {
  var pasta;
  try {
    pasta = XLSX.CFB.read(bytes, { type: 'array' });
  } catch (e) {
    var msg = String((e && e.message) || e);
    if (/encrypt|passw/i.test(msg)) throw erro('senha', 'Este .zip tem senha. Descompacte no computador e envie a planilha diretamente.', msg);
    throw erro('corrompido', 'Não foi possível descompactar este .zip. Ele pode estar danificado.', msg);
  }
  var lista = [];
  pasta.FileIndex.forEach(function (f, i) {
    if (f.type !== 2 || !f.content || !f.content.length) return;
    var caminho = String(pasta.FullPaths[i] || f.name).replace(/^[^\/]*\//, '');
    lista.push({ nome: caminho.split('/').pop(), caminho: caminho, tamanho: f.content.length, bytes: new Uint8Array(f.content) });
  });
  return filtrarItensZip(lista);
}

leitura.ehZip = function (nome) { return extensao(nome) === 'zip'; };

leitura.listarZip = async function (bytes) {
  bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (!bytes.length) throw erro('vazio', 'Este arquivo .zip está em branco.');
  if (!ehZip(bytes)) throw erro('corrompido', 'Este arquivo não é um .zip válido. Tente compactar de novo.', 'assinatura desconhecida');
  if (!A.zip.disponivel()) return listarZipPeloSheetJS(bytes);
  var indice = A.zip.lerIndice(bytes);
  var candidatos = filtrarItensZip(indice.filter(function (e) { return !/\/$/.test(e.nome); }).map(function (e) {
    return { nome: e.nome.split('/').pop(), caminho: e.nome, tamanho: e.tamanho, entrada: e };
  }));
  for (var i = 0; i < candidatos.length; i++) {
    candidatos[i].bytes = await A.zip.extrair(bytes, candidatos[i].entrada);
    delete candidatos[i].entrada;
  }
  return candidatos;
};

// Confere o zip de dentro de .xlsx/.xlsm/.xlsb/.ods antes de entregar ao SheetJS (que pode travar com zip corrompido).
leitura.validarConteiner = async function (nome, bytes) {
  var ext = extensao(nome);
  if ((ext === 'xlsx' || ext === 'xlsm' || ext === 'xlsb' || ext === 'ods') && ehZip(bytes) && A.zip.disponivel()) {
    await A.zip.validar(bytes);
  }
};

// Caminho usado pela tela e pelo Worker: valida o contêiner e depois lê.
leitura.abrirSeguro = async function (entrada) {
  var bytes = entrada.bytes instanceof Uint8Array ? entrada.bytes : new Uint8Array(entrada.bytes);
  await leitura.validarConteiner(entrada.nome, bytes);
  return leitura.abrir({ nome: entrada.nome, bytes: bytes });
};

leitura.nomeAbaValido = nomeAbaValido;
leitura.detectarSeparador = detectarSeparador;
leitura.decodificarCsv = decodificar;
A.leitura = leitura;
