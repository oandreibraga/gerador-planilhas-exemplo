// Regras de segurança dos workflows do GitHub: YAML válido, toda action fixada por hash de commit,
// permissões mínimas declaradas, checkout sem guardar a credencial e instalação sem scripts de pacotes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { raiz } from '../apoio/ambiente.mjs';

const pasta = path.join(raiz, '.github', 'workflows');
const workflows = fs.readdirSync(pasta).filter((n) => /\.ya?ml$/.test(n)).map((nome) => {
  const texto = fs.readFileSync(path.join(pasta, nome), 'utf8');
  return { nome, texto, doc: YAML.parse(texto) };
});

function passos(doc) {
  return Object.entries(doc.jobs || {}).flatMap(([job, j]) => (j.steps || []).map((s) => ({ job, ...s })));
}

test('workflows existem e são YAML válido', () => {
  assert.deepEqual(workflows.map((w) => w.nome).sort(), ['agendado.yml', 'ci.yml', 'release.yml']);
  for (const w of workflows) assert.ok(w.doc && w.doc.jobs, w.nome + ': sem jobs');
  for (const outro of ['dependabot.yml', 'ISSUE_TEMPLATE/config.yml', 'ISSUE_TEMPLATE/problema.yml', 'ISSUE_TEMPLATE/sugestao.yml']) {
    assert.ok(YAML.parse(fs.readFileSync(path.join(raiz, '.github', outro), 'utf8')), outro);
  }
});

test('toda action externa fixada por hash de commit (40 caracteres), com a versão em comentário', () => {
  const soltas = [];
  for (const w of workflows) {
    for (const p of passos(w.doc)) {
      if (!p.uses || p.uses.startsWith('./')) continue;
      if (!/^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/.test(p.uses)) soltas.push(w.nome + ' › ' + p.job + ': ' + p.uses);
    }
    for (const linha of w.texto.split('\n').filter((l) => /uses: [^.]/.test(l))) {
      if (!/@[0-9a-f]{40} # v\d/.test(linha)) soltas.push(w.nome + ': sem comentário de versão: ' + linha.trim());
    }
  }
  assert.deepEqual(soltas, []);
});

test('permissões mínimas: só leitura por padrão, escrita só nos jobs que precisam', () => {
  for (const w of workflows) {
    assert.deepEqual(w.doc.permissions, { contents: 'read' }, w.nome + ': permissions do topo');
    for (const [nome, j] of Object.entries(w.doc.jobs)) {
      const escrita = Object.entries(j.permissions || {}).filter(([, v]) => v === 'write').map(([k]) => k);
      const permitido = {
        'release.yml': { ci: ['security-events', 'pull-requests'], publicar: ['contents', 'id-token', 'attestations'], site: ['pages', 'id-token'] },
        'ci.yml': { codeql: ['security-events'], dependencias: ['pull-requests'] },
        'agendado.yml': { scorecard: ['security-events'], avisar: ['issues'] }
      }[w.nome][nome] || [];
      assert.deepEqual(escrita.filter((k) => !permitido.includes(k)), [], w.nome + ' › ' + nome + ': escrita não prevista');
    }
  }
});

test('checkout sem credencial guardada e npm sem scripts de instalação', () => {
  for (const w of workflows) {
    for (const p of passos(w.doc)) {
      if (p.uses && p.uses.startsWith('actions/checkout@')) {
        assert.equal(p.with && p.with['persist-credentials'], false, w.nome + ' › ' + p.job + ': checkout sem persist-credentials: false');
      }
      if (p.run && /\bnpm (ci|install)\b/.test(p.run)) {
        assert.match(p.run, /--ignore-scripts/, w.nome + ' › ' + p.job + ': ' + p.run);
      }
    }
  }
});

test('nenhum workflow usa pull_request_target nem interpola dados do PR em comandos', () => {
  for (const w of workflows) {
    assert.ok(!('pull_request_target' in (w.doc.on || {})), w.nome);
    assert.doesNotMatch(w.texto, /\$\{\{\s*github\.event\.(pull_request|issue|comment|head_commit)\./, w.nome);
  }
});
