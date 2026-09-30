// "Canários": valores sensíveis plantados nas planilhas de exemplo. Nenhum pode aparecer no arquivo gerado,
// em nenhuma parte do .xlsx (células, textos compartilhados, metadados...), nem com outra caixa ou sem acento.
// Ficam de fora só os valores que, por decisão do produto, podem se repetir: listas curtas, valor fixo,
// sim/não e UF ligada a uma cidade (segue a cidade inventada).

const LIBERADOS = new Set(['categoria', 'constante', 'simnao', 'vazia']);
const DIGITOS = new Set(['cpf', 'cnpj', 'telefone', 'chave']);

export function normalizarCanario(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function canariosDe(def) {
  const cabecalhos = new Set();
  def.abas.forEach((a) => {
    cabecalhos.add(normalizarCanario(a.nome));
    (a.colunas || []).forEach((dc) => cabecalhos.add(normalizarCanario(dc.nome)));
  });
  const textos = new Set(), digitos = new Set();
  function adicionar(v) {
    const n = normalizarCanario(v);
    if (n.length >= 5 && !cabecalhos.has(n)) textos.add(n);
  }
  def.abas.forEach((a) => {
    (a.acima || []).forEach((l) => l.forEach((v) => { if (typeof v === 'string') adicionar(v); }));
    (a.colunas || []).forEach((dc) => {
      if (LIBERADOS.has(dc.esp.tipo) || (dc.esp.tipo === 'uf' && dc.saida && dc.saida.ufDe != null)) return;
      const amostra = a.amostra ? dc.valores.slice(0, a.amostra) : dc.valores;
      amostra.forEach((v) => {
        if (typeof v !== 'string') return;
        adicionar(v);
        const d = v.replace(/\D/g, '');
        if (DIGITOS.has(dc.esp.tipo) && d.length >= 10) digitos.add(d);
      });
    });
  });
  return { textos: [...textos], digitos: [...digitos] };
}

function decodificarXml(s) {
  return s.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi, (m, e) => {
    const nomes = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    if (nomes[e.toLowerCase()]) return nomes[e.toLowerCase()];
    return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  });
}

// Procura os canários em todas as partes de um arquivo .xlsx (bytes). Devolve a lista de vazamentos.
export async function varrerXlsx(bytes, canarios, JSZip) {
  const zip = await JSZip.loadAsync(bytes);
  const partes = [];
  for (const nome of Object.keys(zip.files)) {
    if (zip.files[nome].dir) continue;
    partes.push({ nome, texto: decodificarXml(await zip.files[nome].async('string')) });
  }
  // Índice: cada canário fica sob a sua primeira "palavra" (sequência de letras/dígitos); no texto, só se
  // testam os canários cuja primeira palavra começa naquela posição. Mesmo resultado da busca simples,
  // em uma fração do tempo quando há dezenas de milhares de canários (arquivo inteiro).
  const RE_PALAVRA = /[\p{L}\p{N}]+/gu;
  const porPalavra = new Map();
  for (const c of canarios.textos) {
    RE_PALAVRA.lastIndex = 0;
    const m = RE_PALAVRA.exec(c);
    if (!m) continue;
    const lista = porPalavra.get(m[0]) || [];
    lista.push({ c, desloc: m.index });
    porPalavra.set(m[0], lista);
  }
  const digitos = new Set(canarios.digitos);
  const vazamentos = [];
  for (const parte of partes) {
    const texto = normalizarCanario(parte.texto), achados = new Set();
    RE_PALAVRA.lastIndex = 0;
    let m;
    while ((m = RE_PALAVRA.exec(texto))) {
      const lista = porPalavra.get(m[0]);
      if (!lista) continue;
      for (const { c, desloc } of lista) {
        const i = m.index - desloc;
        if (i < 0 || achados.has(c) || !texto.startsWith(c, i)) continue;
        if (/[\p{L}\p{N}]/u.test(texto.charAt(i - 1)) || /[\p{L}\p{N}]/u.test(texto.charAt(i + c.length))) continue;
        achados.add(c);
        vazamentos.push(parte.nome + ': "' + c + '"');
      }
    }
    const numeros = new Set(parte.texto.match(/\d+/g) || []);
    for (const d of numeros) if (digitos.has(d)) vazamentos.push(parte.nome + ': ' + d);
  }
  return vazamentos;
}

// Canários do modo "arquivo inteiro": todos os valores (não só as primeiras linhas) das colunas que são
// trocadas por padrão, e os textos acima do cabeçalho. Colunas mantidas (datas, valores, listas, cidade/UF)
// ficam de fora, porque continuam iguais de propósito.
const PSEUDONIMIZADAS = new Set(['pessoa', 'empresa', 'cpf', 'cnpj', 'email', 'telefone', 'cep', 'endereco', 'bairro', 'chave', 'codigo', 'texto']);
export function canariosPseudonimo(def) {
  const cabecalhos = new Set();
  def.abas.forEach((a) => {
    cabecalhos.add(normalizarCanario(a.nome));
    (a.colunas || []).forEach((dc) => cabecalhos.add(normalizarCanario(dc.nome)));
  });
  const textos = new Set(), digitos = new Set();
  const adicionar = (v) => { const n = normalizarCanario(v); if (n.length >= 5 && !cabecalhos.has(n)) textos.add(n); };
  def.abas.forEach((a) => {
    (a.acima || []).forEach((l) => l.forEach((v) => { if (typeof v === 'string') adicionar(v); }));
    (a.colunas || []).forEach((dc) => {
      if (!PSEUDONIMIZADAS.has(dc.esp.tipo)) return;
      dc.valores.forEach((v) => {
        if (v == null) return;
        if (typeof v === 'string') adicionar(v);
        const d = String(v).replace(/\D/g, '');
        if (DIGITOS.has(dc.esp.tipo) && d.length >= 10) digitos.add(d);
      });
    });
  });
  return { textos: [...textos], digitos: [...digitos] };
}
