// Lista de componentes (SBOM, formato CycloneDX 1.5) do arquivo publicado: o que vai dentro do HTML
// (SheetJS e a lista de municípios do IBGE) e, como "excluded", as ferramentas usadas só para montar e testar.
// Uso: node scripts/sbom.mjs [saida.json]   (rode depois do build; padrão: dist/sbom.cdx.json)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ler = (p) => fs.readFileSync(path.join(raiz, p));
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
const pacote = JSON.parse(ler('package.json'));
const trava = JSON.parse(ler('package-lock.json'));
const versao = process.env.VERSAO || pacote.version;
const saida = path.resolve(process.argv[2] || path.join(raiz, 'dist', 'sbom.cdx.json'));
const versaoSheetJS = ler('vendor/sheetjs/VERSAO').toString('utf8').trim();

const ferramentas = Object.keys(pacote.devDependencies || {}).sort().map((nome) => {
  const info = trava.packages['node_modules/' + nome] || {};
  return {
    type: 'library',
    name: nome,
    version: info.version,
    scope: 'excluded',
    purl: 'pkg:npm/' + nome.replace('@', '%40') + '@' + info.version,
    description: 'Usado só para montar e testar; não vai no arquivo publicado.'
  };
});

const bom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  version: 1,
  metadata: {
    component: {
      type: 'application',
      name: pacote.name,
      version: versao,
      licenses: [{ license: { id: pacote.license } }],
      hashes: [{ alg: 'SHA-256', content: sha256(ler('dist/anonimizador.html')) }]
    }
  },
  components: [
    {
      type: 'library',
      name: 'xlsx',
      version: versaoSheetJS,
      scope: 'required',
      purl: 'pkg:npm/xlsx@' + versaoSheetJS,
      description: 'SheetJS Community Edition, embutida no HTML',
      licenses: [{ license: { id: 'Apache-2.0' } }],
      hashes: [{ alg: 'SHA-256', content: sha256(ler('vendor/sheetjs/xlsx.full.min.js')) }],
      externalReferences: [{ type: 'distribution', url: 'https://cdn.sheetjs.com/xlsx-' + versaoSheetJS + '/package/dist/xlsx.full.min.js' }]
    },
    {
      type: 'data',
      name: 'municipios-ibge',
      scope: 'required',
      description: 'Nomes de municípios e UFs (IBGE, dados públicos), embutidos no HTML',
      hashes: [{ alg: 'SHA-256', content: sha256(ler('src/dados/cidades.js')) }],
      externalReferences: [{ type: 'distribution', url: 'https://servicodados.ibge.gov.br/api/v1/localidades/municipios' }]
    }
  ].concat(ferramentas)
};

fs.mkdirSync(path.dirname(saida), { recursive: true });
fs.writeFileSync(saida, JSON.stringify(bom, null, 2) + '\n');
console.log('SBOM: ' + path.relative(raiz, saida) + ' (' + bom.components.length + ' componentes)');
