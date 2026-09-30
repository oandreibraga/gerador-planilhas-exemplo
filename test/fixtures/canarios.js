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
  const vazamentos = [];
  for (const parte of partes) {
    const texto = normalizarCanario(parte.texto);
    for (const c of canarios.textos) {
      let i = texto.indexOf(c);
      while (i >= 0) {
        const antes = texto.charAt(i - 1), depois = texto.charAt(i + c.length);
        if (!/[\p{L}\p{N}]/u.test(antes) && !/[\p{L}\p{N}]/u.test(depois)) { vazamentos.push(parte.nome + ': "' + c + '"'); break; }
        i = texto.indexOf(c, i + 1);
      }
    }
    for (const d of canarios.digitos) {
      let i = parte.texto.indexOf(d);
      while (i >= 0) {
        if (!/\d/.test(parte.texto.charAt(i - 1)) && !/\d/.test(parte.texto.charAt(i + d.length))) { vazamentos.push(parte.nome + ': ' + d); break; }
        i = parte.texto.indexOf(d, i + 1);
      }
    }
  }
  return vazamentos;
}
