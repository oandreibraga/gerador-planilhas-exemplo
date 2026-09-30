# Como contribuir

Obrigado pelo interesse! Antes de tudo, quatro regras que não mudam:

1. **Nunca use dados reais.** Nem para testar, nem em issues, nem em capturas de tela. Use as planilhas de exemplo (`node scripts/gerar-fixtures.mjs`) ou invente as suas.
2. **O app não acessa a rede.** Nada de `fetch`, bibliotecas carregadas de fora, estatísticas de uso ou armazenamento no navegador. O ESLint e os testes barram isso.
3. **Texto da tela em português simples.** Frases curtas, sem jargão técnico. Nunca "anonimização conforme LGPD": o resultado é uma amostra fictícia (veja [PRIVACIDADE.md](PRIVACIDADE.md)).
4. **Toda mudança vem com teste.**

## Preparar o ambiente

Node.js 22 ou mais novo.

```sh
npm ci --ignore-scripts
node scripts/verificar.mjs
```

`verificar.mjs` roda, em ordem: ESLint → testes de unidade e integração (inclui a suíte do navegador no jsdom) → build → conferência dos arquivos em `dist/`. Se passar localmente, a maior parte do CI também passa.

Testes em navegadores de verdade (Playwright) rodam **só no CI**; a configuração se recusa a rodar fora dele. Para conferir à mão, abra `dist/testes.html` e `dist/anonimizador.html` no seu navegador.

## Onde fica cada coisa

| Quero mudar… | Arquivo | Teste |
|---|---|---|
| Como um tipo de coluna é reconhecido | `src/nucleo/detectar.js` | `test/unit/detectar.test.mjs` |
| Como os valores falsos são gerados | `src/nucleo/geradores.js` | `test/unit/geradores.test.mjs`, `test/integ/canarios.test.mjs` |
| Leitura de arquivos e `.zip` | `src/formatos/leitura.js`, `src/formatos/zip.js` | `test/unit/leitura.test.mjs`, `test/integ/fuzz.test.mjs` |
| Montagem da planilha de amostra | `src/formatos/amostra.js` | `test/integ/exceljs.test.mjs`, `test/integ/referencia.test.mjs` |
| Texto copiado ("descrição das colunas") | `src/nucleo/resumo.js` | `test/navegador/suite.js` |
| Tela | `src/ui/app.js`, `src/ui/estilo.css`, `src/ui/pagina.html` | `test/navegador/suite.js`, `test/e2e/` |
| Build e CSP | `scripts/build.mjs` | `test/integ/pagina.test.mjs` |
| Workflows | `.github/workflows/` | `test/integ/workflows.test.mjs` |

### Novo tipo de coluna (roteiro)

1. Regra de detecção em `detectar.js` (pelo título e pelo conteúdo).
2. Gerador em `geradores.js`: valores com o mesmo formato do original e que **nunca** coincidam com um valor real.
3. Uma coluna com esse tipo nas planilhas de exemplo (`test/fixtures/definicoes.js`). Os canários passam a cobri-la automaticamente.
4. Rótulo e descrição na tela (`app.js`) e no resumo (`resumo.js`).

### Amostra de referência

`test/integ/referencia.json` guarda a amostra exata gerada com semente fixa. Se a sua mudança altera a amostra **de propósito**, rode `node scripts/atualizar-referencia.mjs` e explique no PR por que mudou. Mudança sem explicação é tratada como regressão.

## Fluxo

1. Abra (ou pegue) uma issue com o critério de aceite.
2. Crie uma branch, faça a mudança com teste e rode `node scripts/verificar.mjs`.
3. Atualize o `CHANGELOG.md` na seção "Não publicado".
4. Abra o PR preenchendo o modelo (inclui o checklist de privacidade). O CI precisa estar verde e o dono do código precisa aprovar.
5. Versões seguem [versionamento semântico](https://semver.org/lang/pt-BR/). Para publicar: atualize a versão no `package.json` e no `CHANGELOG.md` e crie a tag `vX.Y.Z`; o workflow de Release faz o resto.

## Licença das contribuições

Ao contribuir, você concorda que a sua contribuição seja distribuída sob a licença do projeto ([LICENSE](LICENSE)).
