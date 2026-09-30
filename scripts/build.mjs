// Monta os arquivos publicados em dist/:
//   gerador-planilhas-exemplo.html  app completo em um arquivo (offline)
//   index.html                      o mesmo arquivo, para o site (mesmo hash)
//   testes.html        suíte de testes para abrir no navegador
//   SHA256SUMS         hashes para quem baixa conferir
// Uso: node scripts/build.mjs [--tema caminho/para/tema.css]
// Não acessa a rede. O resultado é determinístico (mesma entrada → mesmos bytes).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ler = (p) => fs.readFileSync(path.join(raiz, p), 'utf8').replace(/\r\n/g, '\n');
const sha256 = (s, formato) => crypto.createHash('sha256').update(s, 'utf8').digest(formato || 'hex');

function argumento(nome) {
  const i = process.argv.indexOf(nome);
  return i >= 0 ? process.argv[i + 1] : null;
}

// SheetJS: só é usado se o hash bater com o registrado em vendor/sheetjs/SHA256.
export function lerSheetJS() {
  const bytes = fs.readFileSync(path.join(raiz, 'vendor/sheetjs/xlsx.full.min.js'));
  const esperado = ler('vendor/sheetjs/SHA256').split(/\s+/)[0].toLowerCase();
  const real = crypto.createHash('sha256').update(bytes).digest('hex');
  if (real !== esperado) throw new Error('vendor/sheetjs/xlsx.full.min.js com hash inesperado: ' + real);
  return bytes.toString('utf8');
}

// Impede que o código embutido feche a tag <script> ou abra comentário HTML.
export function escaparScript(s) {
  return s.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
}
function escaparHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function empacotar(entrada) {
  const r = await esbuild.build({
    entryPoints: [path.join(raiz, entrada)],
    bundle: true,
    format: 'iife',
    target: 'es2019',
    charset: 'utf8',
    legalComments: 'inline',
    write: false,
    logLevel: 'silent'
  });
  return r.outputFiles[0].text.replace(/\r\n/g, '\n');
}

function versao() {
  return process.env.VERSAO || JSON.parse(ler('package.json')).version;
}

// Monta a página do app com CSP baseada em hashes: só estes scripts e este estilo podem rodar.
export async function montarApp(opcoes) {
  opcoes = opcoes || {};
  const sheetjs = escaparScript(lerSheetJS());
  const biblioteca = escaparScript(await empacotar('src/biblioteca.js'));
  const trabalhador = escaparScript(ler('src/trabalhador.js'));
  const iniciar = "Amostra.app.montar(document.getElementById('app'));";
  let estilo = ler('src/ui/estilo.css');
  if (opcoes.tema) estilo += '\n/* tema: ' + path.basename(opcoes.tema) + ' */\n' + fs.readFileSync(opcoes.tema, 'utf8').replace(/\r\n/g, '\n');
  const hash = (s) => "'sha256-" + sha256(s, 'base64') + "'";
  const csp = [
    "default-src 'none'",
    'script-src ' + [sheetjs, biblioteca, iniciar].map(hash).join(' '),
    'style-src ' + hash(estilo),
    'worker-src blob:',
    'img-src data:',
    "connect-src 'none'",
    "form-action 'none'",
    "base-uri 'none'"
  ].join('; ');
  let html = ler('src/ui/pagina.html');
  const trocas = {
    '@@CSP@@': csp,
    '@@VERSAO@@': versao(),
    '/*@@ESTILO@@*/': estilo,
    '/*@@XLSX@@*/': sheetjs,
    '/*@@BIBLIOTECA@@*/': biblioteca,
    '/*@@TRABALHADOR@@*/': trabalhador,
    '/*@@INICIAR@@*/': iniciar,
    '@@LICENCA_APP@@': escaparHtml(ler('LICENSE')),
    '@@AVISOS@@': escaparHtml(ler('NOTICE'))
  };
  for (const [marca, valor] of Object.entries(trocas)) {
    if (!html.includes(marca)) throw new Error('marcador ausente em src/ui/pagina.html: ' + marca);
    html = html.split(marca).join(valor);
  }
  conferirHashes(html, csp, hash);
  return { html, csp };
}

// O navegador calcula o hash sobre o texto exato entre as tags (espaços e quebras de linha contam).
// Se algum script executável ou estilo não tiver o hash liberado, a página abriria quebrada: o build falha.
function conferirHashes(html, csp, hash) {
  const blocos = [...html.matchAll(/<(script|style)([^>]*)>([\s\S]*?)<\/\1>/g)];
  for (const [, tag, atributos, conteudo] of blocos) {
    if (tag === 'script' && /type="text\/plain"/.test(atributos)) continue;
    if (!csp.includes(hash(conteudo))) throw new Error('CSP sem o hash de um <' + tag + atributos + '> embutido');
  }
}

export async function montarTestes() {
  const sheetjs = escaparScript(lerSheetJS());
  const biblioteca = escaparScript(await empacotar('src/biblioteca.js'));
  const suite = escaparScript(await empacotar('test/navegador/suite.js'));
  let html = ler('test/navegador/testes.html');
  for (const [marca, valor] of Object.entries({ '/*@@XLSX@@*/': sheetjs, '/*@@BIBLIOTECA@@*/': biblioteca, '/*@@SUITE@@*/': suite })) {
    if (!html.includes(marca)) throw new Error('marcador ausente em test/navegador/testes.html: ' + marca);
    html = html.split(marca).join(valor);
  }
  return html;
}

async function principal() {
  const dist = path.join(raiz, 'dist');
  fs.mkdirSync(dist, { recursive: true });
  const tema = argumento('--tema');
  const { html } = await montarApp({ tema: tema ? path.resolve(tema) : null });
  const testes = await montarTestes();
  const arquivos = { 'gerador-planilhas-exemplo.html': html, 'index.html': html, 'testes.html': testes };
  const somas = [];
  for (const [nome, conteudo] of Object.entries(arquivos)) {
    fs.writeFileSync(path.join(dist, nome), conteudo);
    somas.push(sha256(conteudo) + '  ' + nome);
  }
  fs.writeFileSync(path.join(dist, 'SHA256SUMS'), somas.join('\n') + '\n');
  for (const s of somas) console.log(s);
  console.log('Build ' + versao() + (tema ? ' com tema ' + path.basename(tema) : ' (marca neutra)') + ' em ' + path.relative(raiz, dist));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal().catch((e) => { console.error(e.message || e); process.exit(1); });
}
