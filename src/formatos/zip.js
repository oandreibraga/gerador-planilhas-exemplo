// Leitor de .zip próprio: lê o índice, descompacta com o DecompressionStream do navegador e confere o CRC32
// de cada parte. Serve para (1) validar .xlsx/.zip antes de entregar ao SheetJS, cujo leitor de zip pode travar
// com arquivos corrompidos, e (2) barrar "zip bomb" (arquivo pequeno que infla demais).
// Também é a base do modo "arquivo inteiro" (Fase 2).
import { A } from '../nucleo/amostra.js';

var LIMITE_DESCOMPACTADO = 1024 * 1024 * 1024; // 1 GB no total
var LIMITE_RAZAO = 1000;                       // taxa de compressão acima disso é suspeita...
var LIMITE_RAZAO_A_PARTIR = 64 * 1024 * 1024;  // ...para partes com mais de 64 MB descompactados

var MSG_CORROMPIDO = 'O arquivo pode estar danificado ou não ser uma planilha. Tente abrir no Excel e salvar de novo como .xlsx.';

function erro(tipo, mensagem, detalhe) {
  var e = new Error(mensagem);
  e.tipo = tipo;
  e.detalhe = detalhe || '';
  e.amigavel = true;
  return e;
}
function corrompido(detalhe) { return erro('corrompido', MSG_CORROMPIDO, detalhe); }

var tabelaCrc = null;
function crc32(bytes) {
  if (!tabelaCrc) {
    tabelaCrc = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      tabelaCrc[n] = c >>> 0;
    }
  }
  var crc = 0xFFFFFFFF;
  for (var i = 0; i < bytes.length; i++) crc = tabelaCrc[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function u16(b, o) { return b[o] | (b[o + 1] << 8); }
function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }

// Índice (diretório central) do zip: nome, método, CRC e tamanhos de cada parte.
function lerIndice(bytes) {
  var fim = -1;
  for (var i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4B && bytes[i + 2] === 5 && bytes[i + 3] === 6) { fim = i; break; }
  }
  if (fim < 0) throw corrompido('fim do índice do zip não encontrado');
  var total = u16(bytes, fim + 10), tamanhoIndice = u32(bytes, fim + 12), inicioIndice = u32(bytes, fim + 16);
  if (total === 0xFFFF || inicioIndice === 0xFFFFFFFF || tamanhoIndice === 0xFFFFFFFF) {
    throw erro('grande', 'Este arquivo compactado é grande demais (formato ZIP64) e ainda não é aceito.', 'zip64');
  }
  if (inicioIndice + tamanhoIndice > fim) throw corrompido('índice do zip fora do arquivo');
  var entradas = [], p = inicioIndice, somaDescompactada = 0;
  for (var k = 0; k < total; k++) {
    if (p + 46 > bytes.length || u32(bytes, p) !== 0x02014b50) throw corrompido('entrada ' + k + ' inválida no índice do zip');
    var flags = u16(bytes, p + 8), metodo = u16(bytes, p + 10);
    var lNome = u16(bytes, p + 28), lExtra = u16(bytes, p + 30), lComentario = u16(bytes, p + 32);
    if (p + 46 + lNome > bytes.length) throw corrompido('nome da entrada ' + k + ' fora do arquivo');
    var nomeBytes = bytes.subarray(p + 46, p + 46 + lNome);
    var entrada = {
      nome: new TextDecoder(flags & 0x800 ? 'utf-8' : 'windows-1252').decode(nomeBytes),
      flags: flags,
      metodo: metodo,
      crc: u32(bytes, p + 16),
      tamanhoCompactado: u32(bytes, p + 20),
      tamanho: u32(bytes, p + 24),
      local: u32(bytes, p + 42)
    };
    somaDescompactada += entrada.tamanho;
    entradas.push(entrada);
    p += 46 + lNome + lExtra + lComentario;
  }
  if (somaDescompactada > LIMITE_DESCOMPACTADO) {
    throw erro('grande', 'Este arquivo fica grande demais quando descompactado (mais de 1 GB). Divida em arquivos menores.', 'descompactado: ' + somaDescompactada);
  }
  return entradas;
}

function juntar(partes, total) {
  var saida = new Uint8Array(total), p = 0;
  for (var i = 0; i < partes.length; i++) { saida.set(partes[i], p); p += partes[i].length; }
  return saida;
}

async function descompactar(dados, esperado) {
  var ds = new DecompressionStream('deflate-raw');
  var escritor = ds.writable.getWriter();
  escritor.write(dados).catch(function () {});
  escritor.close().catch(function () {});
  var leitor = ds.readable.getReader(), partes = [], total = 0;
  for (;;) {
    var r = await leitor.read();
    if (r.done) break;
    total += r.value.length;
    if (total > esperado) {
      leitor.cancel().catch(function () {});
      throw corrompido('parte maior do que o índice informa');
    }
    partes.push(r.value);
  }
  return juntar(partes, total);
}

// Conteúdo descompactado de uma parte, com o CRC conferido. Devolve null se o navegador não souber descompactar.
async function extrair(bytes, e) {
  if (e.flags & 1) throw erro('senha', 'Este .zip tem senha. Descompacte no computador e envie a planilha diretamente.', 'entrada criptografada: ' + e.nome);
  if (e.tamanho > LIMITE_DESCOMPACTADO ||
      (e.tamanho > LIMITE_RAZAO_A_PARTIR && e.tamanhoCompactado > 0 && e.tamanho / e.tamanhoCompactado > LIMITE_RAZAO)) {
    throw erro('grande', 'Uma parte deste arquivo infla demais ao descompactar e foi recusada por segurança.', e.nome);
  }
  var p = e.local;
  if (p + 30 > bytes.length || u32(bytes, p) !== 0x04034b50) throw corrompido('cabeçalho local inválido: ' + e.nome);
  var inicio = p + 30 + u16(bytes, p + 26) + u16(bytes, p + 28);
  if (inicio + e.tamanhoCompactado > bytes.length) throw corrompido('parte fora do arquivo: ' + e.nome);
  var dados = bytes.subarray(inicio, inicio + e.tamanhoCompactado);
  var saida;
  if (e.metodo === 0) saida = dados;
  else if (e.metodo === 8) {
    if (typeof DecompressionStream === 'undefined') return null;
    try {
      saida = await descompactar(dados, e.tamanho);
    } catch (err) {
      if (err && err.amigavel) throw err;
      throw corrompido('não foi possível descompactar ' + e.nome + ': ' + ((err && err.message) || err));
    }
  } else throw corrompido('método de compressão ' + e.metodo + ' não suportado em ' + e.nome);
  if (saida.length !== e.tamanho || crc32(saida) !== e.crc) throw corrompido('conteúdo danificado em ' + e.nome);
  return saida;
}

// Confere todas as partes de um zip (índice, tamanhos e CRC). Lança erro amigável se algo estiver errado.
async function validar(bytes) {
  var indice = lerIndice(bytes);
  for (var i = 0; i < indice.length; i++) {
    if (/\/$/.test(indice[i].nome)) continue;
    await extrair(bytes, indice[i]);
  }
  return indice;
}

A.zip = {
  crc32: crc32,
  lerIndice: lerIndice,
  extrair: extrair,
  validar: validar,
  disponivel: function () { return typeof DecompressionStream !== 'undefined'; }
};
