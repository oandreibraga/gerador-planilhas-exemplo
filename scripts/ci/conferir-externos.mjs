// Só para o CI agendado: este script ACESSA A INTERNET (o app nunca acessa).
// Confere se o que veio de fora continua igual ao registrado no repositório:
//   1. o SheetJS publicado na versão registrada tem o mesmo hash do arquivo em vendor/;
//   2. se existe versão mais nova do SheetJS (só aviso);
//   3. a lista de municípios do IBGE é a mesma embutida em src/dados/cidades.js.
// Sai com código 1 se algo não bater. Uso: node scripts/ci/conferir-externos.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ler = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');
const problemas = [], avisos = [], ok = [];

async function baixar(url) {
  const r = await fetch(url, { redirect: 'follow' });
  if (!r.ok) throw new Error(url + ': HTTP ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}

// 1 e 2. SheetJS
const versao = ler('vendor/sheetjs/VERSAO').trim();
const hashRegistrado = ler('vendor/sheetjs/SHA256').split(/\s+/)[0].toLowerCase();
try {
  const publicado = await baixar('https://cdn.sheetjs.com/xlsx-' + versao + '/package/dist/xlsx.full.min.js');
  const hash = crypto.createHash('sha256').update(publicado).digest('hex');
  if (hash === hashRegistrado) ok.push('SheetJS ' + versao + ': hash publicado igual ao registrado');
  else problemas.push('SheetJS ' + versao + ': o arquivo publicado mudou (hash ' + hash + ', registrado ' + hashRegistrado + ')');
} catch (e) { problemas.push('SheetJS: não deu para baixar (' + e.message + ')'); }
try {
  const ultima = JSON.parse((await baixar('https://cdn.sheetjs.com/xlsx-latest/package/package.json')).toString('utf8')).version;
  if (ultima !== versao) avisos.push('SheetJS: existe versão nova (' + ultima + '; em uso ' + versao + '). Avaliar atualização.');
  else ok.push('SheetJS: ' + versao + ' é a versão mais recente');
} catch (e) { avisos.push('SheetJS: não deu para consultar a última versão (' + e.message + ')'); }

// 3. Municípios do IBGE
try {
  await import('../../src/dados/cidades.js');
  const { A } = await import('../../src/nucleo/amostra.js');
  const embutidos = new Set(A.dados.municipios.split(';'));
  const lista = JSON.parse((await baixar('https://servicodados.ibge.gov.br/api/v1/localidades/municipios')).toString('utf8'));
  const uf = (m) => (m.microrregiao && m.microrregiao.mesorregiao.UF.sigla) ||
    (m['regiao-imediata'] && m['regiao-imediata']['regiao-intermediaria'].UF.sigla);
  const atuais = new Set(lista.map((m) => m.nome + '|' + uf(m)));
  const novos = [...atuais].filter((x) => !embutidos.has(x));
  const sairam = [...embutidos].filter((x) => !atuais.has(x));
  if (!novos.length && !sairam.length) ok.push('IBGE: ' + atuais.size + ' municípios, lista igual à embutida');
  else problemas.push('IBGE: lista mudou. Novos: ' + (novos.slice(0, 20).join(', ') || '-') + '. Saíram: ' + (sairam.slice(0, 20).join(', ') || '-'));
} catch (e) { problemas.push('IBGE: não deu para conferir (' + e.message + ')'); }

const linhas = ['## Conferência de dependências externas', '']
  .concat(ok.map((x) => '- ✅ ' + x), avisos.map((x) => '- ⚠️ ' + x), problemas.map((x) => '- ❌ ' + x));
console.log(linhas.join('\n'));
for (const a of avisos) console.log('::warning::' + a);
for (const p of problemas) console.log('::error::' + p);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, linhas.join('\n') + '\n');
process.exit(problemas.length ? 1 : 0);
