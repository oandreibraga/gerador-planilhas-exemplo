// Confere tudo de uma vez, na ordem em que um problema aparece mais cedo:
//   1. regras de código (ESLint)   2. testes em Node (unidade + integração, incluindo a suíte do navegador no jsdom)
//   3. build em dist/               4. conferência dos arquivos publicados
// Uso: node scripts/verificar.mjs        Sai com código 1 no primeiro passo que falhar.
// Não abre navegador e não acessa a rede. Os testes em navegadores de verdade rodam no CI (Playwright).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const node = process.execPath;
const resultados = [];

function passo(nome, fn) {
  const t0 = Date.now();
  process.stdout.write('\n=== ' + nome + ' ===\n');
  let ok;
  try { ok = fn() !== false; } catch (e) { console.error(e.message || e); ok = false; }
  const s = ((Date.now() - t0) / 1000).toFixed(1) + ' s';
  resultados.push([nome, ok, s]);
  if (!ok) terminar();
}

function rodar(args) {
  const r = spawnSync(node, args, { cwd: raiz, stdio: 'inherit' });
  return r.status === 0;
}

function conferirDist() {
  const dist = path.join(raiz, 'dist');
  const ler = (n) => fs.readFileSync(path.join(dist, n));
  if (!ler('index.html').equals(ler('gerador-planilhas-exemplo.html'))) throw new Error('index.html diferente de gerador-planilhas-exemplo.html');
  for (const linha of ler('SHA256SUMS').toString('utf8').trim().split('\n')) {
    const [hash, nome] = linha.split(/\s+/);
    const real = crypto.createHash('sha256').update(ler(nome)).digest('hex');
    if (real !== hash) throw new Error('SHA256SUMS não confere para ' + nome);
  }
  if (!ler('gerador-planilhas-exemplo.zip').includes(Buffer.from('LEIA-ME.txt'))) throw new Error('pacote .zip sem LEIA-ME');
  const tamanho = ler('gerador-planilhas-exemplo.html').length;
  console.log('dist/gerador-planilhas-exemplo.html: ' + (tamanho / 1048576).toFixed(2) + ' MB, hashes conferidos');
  return true;
}

function terminar() {
  console.log('\n=== Resumo ===');
  for (const [nome, ok, s] of resultados) console.log((ok ? 'OK    ' : 'FALHOU') + '  ' + nome + '  (' + s + ')');
  const falhou = resultados.some((r) => !r[1]);
  console.log(falhou ? '\nVerificação FALHOU.' : '\nTudo certo.');
  process.exit(falhou ? 1 : 0);
}

passo('Regras de código (ESLint)', () => rodar([path.join('node_modules', 'eslint', 'bin', 'eslint.js'), '.']));
passo('Testes (unidade e integração)', () => rodar(['--test', 'test/unit/*.test.mjs', 'test/integ/*.test.mjs']));
passo('Build', () => rodar(['scripts/build.mjs']));
passo('Arquivos publicados', conferirDist);
terminar();
