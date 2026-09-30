# Gerador de planilhas de exemplo

Cria uma cópia da sua planilha com **dados inventados**, mantendo a mesma estrutura: abas, colunas, posição do cabeçalho, tipos e formatos das células. Serve para pedir uma automação, tirar uma dúvida ou mostrar um problema para alguém (outra equipe, um fornecedor, uma IA) **sem mandar os dados reais**.

- **Roda só no seu navegador.** A planilha não sai do seu computador: a página não faz nenhuma conexão com a internet, e isso é testado automaticamente em Chrome, Firefox e Safari (WebKit).
- **Um arquivo só.** O mesmo arquivo funciona pelo site ou baixado, sem internet e sem instalar nada.
- **Entende o que cada coluna significa:** nomes, CPF/CNPJ (com dígito verificador válido), e-mail, telefone, CEP, cidade e UF (cidades reais do IBGE, nunca as do original), chave de NF-e, datas, valores, percentuais, listas de status e colunas calculadas a partir de outras.

> **Importante:** o arquivo gerado é uma **amostra fictícia**, não uma versão anonimizada da sua planilha. Nomes de abas, títulos das colunas, listas curtas (como status) e valores fixos continuam como no original. Confira antes de compartilhar. Detalhes em [PRIVACIDADE.md](PRIVACIDADE.md).

## Como usar

1. Abra o site (https://oandreibraga.github.io/gerador-planilhas-exemplo/) ou, para usar sem internet, clique em **Baixar para usar sem internet** no próprio site: vem um `.zip`; descompacte e abra o `gerador-planilhas-exemplo.html` no navegador, sem instalar nada. O mesmo pacote está na página de [Releases](../../releases).
2. Escolha a planilha (`.xlsx`, `.xlsm`, `.xls`, `.xlsb`, `.ods`, `.csv` ou um `.zip` com planilhas). Se só tiver os títulos das colunas, cole-os na aba "Só tenho os títulos das colunas".
3. Confira o tipo que a ferramenta identificou em cada coluna e corrija se precisar.
4. Escolha 10, 20 ou 30 linhas e clique em **Baixar planilha de exemplo**. O arquivo sai como `<nome original>_amostra.xlsx`.

O botão **Copiar descrição das colunas** gera um texto com a estrutura (abas, colunas, tipos, formatos) para colar num pedido de automação.

### O que muda e o que fica

| No arquivo gerado | |
|---|---|
| **Inventado** | Nomes de pessoas e empresas, documentos, e-mails, telefones, endereços, cidades, códigos, datas, valores e textos livres |
| **Igual ao original** | Nomes das abas e títulos das colunas; opções de listas curtas (status, tipo de documento…); colunas com um valor fixo; colunas 0/1; colunas que você marcar como "usar dados reais" |
| **Mantido** | Formatos das células (moeda, data, percentual…), larguras, células mescladas, abas ocultas e a posição do cabeçalho (textos acima dele, como o título de um relatório, viram um texto genérico) |

A análise usa até 500 linhas de cada aba (as primeiras); o arquivo gerado tem só as linhas de exemplo.

### Conferir o arquivo baixado

Cada versão publica o arquivo `SHA256SUMS`. Para conferir que o seu arquivo é o mesmo que foi montado pelo GitHub a partir deste código:

```powershell
Get-FileHash gerador-planilhas-exemplo.html -Algorithm SHA256        # Windows
```
```sh
sha256sum gerador-planilhas-exemplo.html                               # Linux/macOS
gh attestation verify gerador-planilhas-exemplo.html --repo oandreibraga/gerador-planilhas-exemplo   # proveniência (GitHub CLI)
```

## Para quem desenvolve

Requisitos: Node.js 22 ou mais novo. Nada é instalado fora da pasta do projeto.

```sh
npm ci --ignore-scripts        # ferramentas de build e teste
node scripts/verificar.mjs     # tudo: regras de código, testes, build e conferência (≈ 40 s)
node scripts/build.mjs         # só o build: dist/gerador-planilhas-exemplo.html, dist/index.html, dist/testes.html, SHA256SUMS
```

- **Testes no navegador de verdade:** abra `dist/testes.html` à mão no navegador. Os testes automatizados em Chrome/Firefox/WebKit (Playwright) rodam **só no CI**.
- **Planilhas de exemplo para testar à mão:** `node scripts/gerar-fixtures.mjs` grava em `test/fixtures/arquivos/` planilhas com dados inventados (nunca use planilhas reais).
- **Tema interno:** `node scripts/build.mjs --tema caminho/para/tema.css` aplica cores próprias. Temas de marca ficam fora do repositório (`temas-internos/` é ignorado pelo git).

### Estrutura

```
src/nucleo/     detecção de tipos, geradores de dados, resumo (sem tela)
src/formatos/   leitura de planilhas e .zip, montagem da amostra
src/dados/      listas embutidas (nomes, municípios do IBGE)
src/ui/         tela, estilo e modelo da página
src/trabalhador.js   leitura fora da tela (Web Worker)
vendor/sheetjs/ biblioteca de planilhas (versão e hash fixos)
scripts/        build, verificação, fixtures, SBOM
test/           unidade, integração, navegador (jsdom) e e2e (Playwright, só no CI)
.github/        CI, Release, verificação semanal, modelos de issue e PR
```

### Como é verificado

| Onde | O quê |
|---|---|
| `node scripts/verificar.mjs` | ESLint (proíbe rede, `eval` e HTML montado a partir de texto no app) · testes de unidade · amostra idêntica à referência · **canários** (nenhum valor sensível plantado aparece em nenhuma parte do arquivo gerado) · conferência independente com ExcelJS · arquivos quebrados (fuzz) · desempenho · CSP exata e build reprodutível · suíte do navegador no jsdom |
| CI a cada mudança (`ci.yml`) | Tudo acima em Linux e Windows · mesmo build nos dois · fuzz de 2 min · LibreOffice abrindo cada amostra · Playwright em 3 navegadores, pelo site e pelo arquivo: zero requisições, funciona sem internet, CSP sem violações, teste negativo de rede, acessibilidade (axe) e capturas de tela · CodeQL · revisão de dependências |
| Release (`release.yml`) | Tag `vX.Y.Z` → CI completo → HTML + `SHA256SUMS` + SBOM + atestado de proveniência → site atualizado com o mesmo arquivo |
| Semanal (`agendado.yml`) | SheetJS e lista do IBGE iguais aos registrados · `npm audit` · navegadores novos · fuzz longo · site no ar = Release · OpenSSF Scorecard |

## Próximas etapas

1. **Arquivo inteiro:** substituir dados sensíveis no arquivo todo (pseudonimização), mantendo a formatação.
2. **Texto livre:** encontrar nomes, CPFs, e-mails e telefones dentro de textos, com lista de termos da pessoa.
3. **Word e PowerPoint.**

## Licença

[Apache-2.0](LICENSE). Componentes de terceiros em [NOTICE](NOTICE); a lista completa vai em cada Release (SBOM).
