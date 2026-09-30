// Zip em fluxo, para o modo "arquivo inteiro": lê o índice e as partes direto do arquivo (File/Blob) sem
// carregá-lo inteiro na memória, e monta o zip de saída. Partes que não mudam são copiadas como estão (os
// mesmos bytes compactados); partes novas ou alteradas são compactadas com o CompressionStream do navegador.
// Sem ZIP64: arquivos e partes de até 4 GB (o limite de 1 GB descompactado vem de src/formatos/zip.js).
import { A } from '../nucleo/amostra.js';

var LIMITE_PARTE = 1024 * 1024 * 1024;

function erro(tipo, mensagem, detalhe) {
  var e = new Error(mensagem);
  e.tipo = tipo;
  e.detalhe = detalhe || '';
  e.amigavel = true;
  return e;
}
function corrompido(detalhe) {
  return erro('corrompido', 'O arquivo pode estar danificado ou não ser uma planilha. Tente abrir no Excel e salvar de novo como .xlsx.', detalhe);
}

function u16(b, o) { return b[o] | (b[o + 1] << 8); }
function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }
function p16(b, o, v) { b[o] = v & 0xFF; b[o + 1] = (v >>> 8) & 0xFF; }
function p32(b, o, v) { b[o] = v & 0xFF; b[o + 1] = (v >>> 8) & 0xFF; b[o + 2] = (v >>> 16) & 0xFF; b[o + 3] = (v >>> 24) & 0xFF; }

async function lerFatia(blob, inicio, fim) {
  return new Uint8Array(await blob.slice(inicio, fim).arrayBuffer());
}

// ---------- CRC32 incremental ----------
var tabela = null;
function crcAtualizar(crc, bytes) {
  if (!tabela) {
    tabela = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      tabela[n] = c >>> 0;
    }
  }
  crc = ~crc >>> 0;
  for (var i = 0; i < bytes.length; i++) crc = tabela[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  return ~crc >>> 0;
}

// ---------- leitura ----------
// Índice do zip lido do fim do arquivo: [{nome, metodo, flags, crc, tamanhoCompactado, tamanho, local, hora, data}]
async function indice(blob) {
  var tamanhoArquivo = blob.size;
  var cauda = await lerFatia(blob, Math.max(0, tamanhoArquivo - 22 - 65535), tamanhoArquivo);
  var fim = -1;
  for (var i = cauda.length - 22; i >= 0; i--) {
    if (cauda[i] === 0x50 && cauda[i + 1] === 0x4B && cauda[i + 2] === 5 && cauda[i + 3] === 6) { fim = i; break; }
  }
  if (fim < 0) throw corrompido('fim do índice do zip não encontrado');
  var total = u16(cauda, fim + 10), tamanhoIndice = u32(cauda, fim + 12), inicioIndice = u32(cauda, fim + 16);
  if (total === 0xFFFF || inicioIndice === 0xFFFFFFFF || tamanhoIndice === 0xFFFFFFFF) {
    throw erro('grande', 'Este arquivo compactado é grande demais (formato ZIP64) e ainda não é aceito.', 'zip64');
  }
  var posFim = tamanhoArquivo - cauda.length + fim;
  if (inicioIndice + tamanhoIndice > posFim) throw corrompido('índice do zip fora do arquivo');
  var cd = await lerFatia(blob, inicioIndice, inicioIndice + tamanhoIndice);
  var entradas = [], p = 0, soma = 0;
  for (var k = 0; k < total; k++) {
    if (p + 46 > cd.length || u32(cd, p) !== 0x02014b50) throw corrompido('entrada ' + k + ' inválida no índice do zip');
    var flags = u16(cd, p + 8), lNome = u16(cd, p + 28), lExtra = u16(cd, p + 30), lComentario = u16(cd, p + 32);
    if (p + 46 + lNome > cd.length) throw corrompido('nome da entrada ' + k + ' fora do índice');
    var e = {
      nome: new TextDecoder(flags & 0x800 ? 'utf-8' : 'windows-1252').decode(cd.subarray(p + 46, p + 46 + lNome)),
      flags: flags,
      metodo: u16(cd, p + 10),
      hora: u16(cd, p + 12),
      data: u16(cd, p + 14),
      crc: u32(cd, p + 16),
      tamanhoCompactado: u32(cd, p + 20),
      tamanho: u32(cd, p + 24),
      local: u32(cd, p + 42)
    };
    if (e.local + 30 + e.tamanhoCompactado > inicioIndice) throw corrompido('parte fora do arquivo: ' + e.nome);
    soma += e.tamanho;
    entradas.push(e);
    p += 46 + lNome + lExtra + lComentario;
  }
  if (soma > 4 * LIMITE_PARTE) throw erro('grande', 'Este arquivo fica grande demais quando descompactado. Divida em arquivos menores.', 'descompactado: ' + soma);
  return entradas;
}

// Posição onde começam os dados compactados de uma parte (depois do cabeçalho local).
async function inicioDosDados(blob, e) {
  var cab = await lerFatia(blob, e.local, e.local + 30);
  if (cab.length < 30 || u32(cab, 0) !== 0x04034b50) throw corrompido('cabeçalho local inválido: ' + e.nome);
  return e.local + 30 + u16(cab, 26) + u16(cab, 28);
}

function conferirParte(e) {
  if (e.flags & 1) throw erro('senha', 'Planilhas com senha não podem ser lidas. Tire a senha no Excel e tente de novo.', 'parte criptografada: ' + e.nome);
  if (e.metodo !== 0 && e.metodo !== 8) throw corrompido('método de compressão ' + e.metodo + ' não suportado em ' + e.nome);
  if (e.tamanho > LIMITE_PARTE || (e.tamanho > 64 * 1024 * 1024 && e.tamanhoCompactado > 0 && e.tamanho / e.tamanhoCompactado > 1000)) {
    throw erro('grande', 'Uma parte deste arquivo infla demais ao descompactar e foi recusada por segurança.', e.nome);
  }
}

// Conteúdo descompactado de uma parte, em fluxo (ReadableStream de Uint8Array). Confere tamanho e CRC no fim.
async function fluxo(blob, e) {
  conferirParte(e);
  var inicio = await inicioDosDados(blob, e);
  var bruto = blob.slice(inicio, inicio + e.tamanhoCompactado).stream();
  var dados = e.metodo === 8 ? bruto.pipeThrough(new DecompressionStream('deflate-raw')) : bruto;
  var crc = 0, total = 0;
  return dados.pipeThrough(new TransformStream({
    transform: function (pedaco, controle) {
      total += pedaco.length;
      if (total > e.tamanho) throw corrompido('parte maior do que o índice informa: ' + e.nome);
      crc = crcAtualizar(crc, pedaco);
      controle.enqueue(pedaco);
    },
    flush: function () {
      if (total !== e.tamanho || crc !== e.crc) throw corrompido('conteúdo danificado em ' + e.nome);
    }
  }));
}

async function bytes(blob, e) {
  var leitor = (await fluxo(blob, e)).getReader(), partes = [], total = 0;
  for (;;) {
    var r;
    try { r = await leitor.read(); } catch (err) { throw err && err.amigavel ? err : corrompido('não foi possível descompactar ' + e.nome + ': ' + ((err && err.message) || err)); }
    if (r.done) break;
    partes.push(r.value);
    total += r.value.length;
  }
  var saida = new Uint8Array(total), p = 0;
  for (var i = 0; i < partes.length; i++) { saida.set(partes[i], p); p += partes[i].length; }
  return saida;
}

async function texto(blob, e) { return new TextDecoder('utf-8').decode(await bytes(blob, e)); }

// Lê uma parte como texto em pedaços, chamando aoTexto(pedaço) — para XML grande demais para uma string.
async function textoEmPedacos(blob, e, aoTexto) {
  var leitor = (await fluxo(blob, e)).getReader(), dec = new TextDecoder('utf-8');
  for (;;) {
    var r;
    try { r = await leitor.read(); } catch (err) { throw err && err.amigavel ? err : corrompido('não foi possível descompactar ' + e.nome + ': ' + ((err && err.message) || err)); }
    if (r.done) break;
    var s = dec.decode(r.value, { stream: true });
    if (s) await aoTexto(s);
  }
  var final = dec.decode();
  if (final) await aoTexto(final);
}

// ---------- escrita ----------
// Monta um zip novo. As partes ficam como Blobs/Uint8Array; o resultado é um Blob (sem juntar tudo num buffer).
function criarEscritor() {
  var partes = [], diretorio = [], posicao = 0, nomes = {};
  var codificador = new TextEncoder();

  function cabecalhoLocal(nomeBytes, info) {
    var h = new Uint8Array(30 + nomeBytes.length);
    p32(h, 0, 0x04034b50); p16(h, 4, 20); p16(h, 6, 0x800); p16(h, 8, info.metodo);
    p16(h, 10, info.hora); p16(h, 12, info.data); p32(h, 14, info.crc);
    p32(h, 18, info.tamanhoCompactado); p32(h, 22, info.tamanho); p16(h, 26, nomeBytes.length); p16(h, 28, 0);
    h.set(nomeBytes, 30);
    return h;
  }

  function registrar(nome, info, dados) {
    if (nomes[nome]) throw new Error('parte repetida no zip de saída: ' + nome);
    nomes[nome] = true;
    var nomeBytes = codificador.encode(nome);
    var cab = cabecalhoLocal(nomeBytes, info);
    if (posicao + cab.length + info.tamanhoCompactado > 0xFFFFFFFF) {
      throw erro('grande', 'O arquivo gerado passaria de 4 GB, o limite deste formato. Divida a planilha em arquivos menores.', 'saida > 4GB');
    }
    diretorio.push({ nomeBytes: nomeBytes, info: info, local: posicao });
    partes.push(cab, dados);
    posicao += cab.length + info.tamanhoCompactado;
  }

  // Compacta um fluxo de bytes (ReadableStream) calculando CRC e tamanhos.
  async function compactar(fluxoBytes) {
    var crc = 0, tamanho = 0, pedacos = [], tamanhoCompactado = 0;
    var medido = fluxoBytes.pipeThrough(new TransformStream({
      transform: function (p, c) { crc = crcAtualizar(crc, p); tamanho += p.length; c.enqueue(p); }
    }));
    var leitor = medido.pipeThrough(new CompressionStream('deflate-raw')).getReader();
    for (;;) {
      var r = await leitor.read();
      if (r.done) break;
      pedacos.push(r.value);
      tamanhoCompactado += r.value.length;
    }
    if (tamanho > 0xFFFFFFFF) throw erro('grande', 'Uma parte do arquivo gerado passaria de 4 GB.', 'parte > 4GB');
    return { crc: crc, tamanho: tamanho, tamanhoCompactado: tamanhoCompactado, dados: new Blob(pedacos) };
  }

  var api = {
    // Copia a parte do zip original sem descompactar (mesmos bytes, mesmo CRC).
    copiar: async function (blob, e, nome) {
      conferirParte(e);
      var inicio = await inicioDosDados(blob, e);
      registrar(nome || e.nome, { metodo: e.metodo, hora: e.hora, data: e.data, crc: e.crc, tamanhoCompactado: e.tamanhoCompactado, tamanho: e.tamanho },
        blob.slice(inicio, inicio + e.tamanhoCompactado));
    },
    // Adiciona uma parte a partir de um ReadableStream de bytes (compactada aqui).
    adicionarFluxo: async function (nome, fluxoBytes, modelo) {
      var c = await compactar(fluxoBytes);
      registrar(nome, { metodo: 8, hora: modelo ? modelo.hora : 0, data: modelo ? modelo.data : 0x21, crc: c.crc, tamanhoCompactado: c.tamanhoCompactado, tamanho: c.tamanho }, c.dados);
    },
    // Adiciona uma parte pequena (texto ou bytes).
    adicionar: async function (nome, conteudo, modelo) {
      var b = typeof conteudo === 'string' ? codificador.encode(conteudo) : conteudo;
      await api.adicionarFluxo(nome, new Blob([b]).stream(), modelo);
    },
    finalizar: function () {
      var inicioIndice = posicao, blocos = [];
      for (var i = 0; i < diretorio.length; i++) {
        var d = diretorio[i], info = d.info;
        var c = new Uint8Array(46 + d.nomeBytes.length);
        p32(c, 0, 0x02014b50); p16(c, 4, 20); p16(c, 6, 20); p16(c, 8, 0x800); p16(c, 10, info.metodo);
        p16(c, 12, info.hora); p16(c, 14, info.data); p32(c, 16, info.crc); p32(c, 20, info.tamanhoCompactado);
        p32(c, 24, info.tamanho); p16(c, 28, d.nomeBytes.length); p32(c, 42, d.local);
        c.set(d.nomeBytes, 46);
        blocos.push(c);
      }
      var tamanhoIndice = blocos.reduce(function (s, b) { return s + b.length; }, 0);
      var f = new Uint8Array(22);
      p32(f, 0, 0x06054b50); p16(f, 8, diretorio.length); p16(f, 10, diretorio.length);
      p32(f, 12, tamanhoIndice); p32(f, 16, inicioIndice);
      return new Blob(partes.concat(blocos, [f]), { type: 'application/zip' });
    }
  };
  return api;
}

A.zipFluxo = { indice: indice, fluxo: fluxo, bytes: bytes, texto: texto, textoEmPedacos: textoEmPedacos, criarEscritor: criarEscritor, crcAtualizar: crcAtualizar };
