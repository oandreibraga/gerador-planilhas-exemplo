# Segurança

## Como relatar um problema

**Não abra issue pública** para problemas de segurança. Use o relato privado do GitHub: aba **Security** do repositório → **Report a vulnerability**. Descreva o problema com dados inventados; **nunca envie planilhas ou dados reais**, nem para demonstrar o problema.

Respondemos em até 5 dias úteis com a avaliação inicial. Correções saem numa nova versão, com o problema descrito nas notas da Release depois que a correção estiver disponível.

## O que consideramos problema de segurança

- Um valor real da planilha aparece no arquivo gerado quando não deveria (qualquer coluna que não esteja na lista "continua igual ao original" do [PRIVACIDADE.md](PRIVACIDADE.md)).
- A página faz qualquer conexão de rede, carrega algo de fora ou guarda dados no navegador.
- Uma forma de contornar a Content-Security-Policy da página.
- Um arquivo preparado que faz a página executar código, travar sem mensagem ou consumir memória sem limite.
- O arquivo publicado (site ou Release) diferente do que o código e o build produzem.
- Problemas na cadeia de build: dependência comprometida, workflow com permissão além do necessário.

Fora do escopo: o conteúdo que a própria pessoa escolhe manter (títulos, listas curtas, colunas marcadas como "usar dados reais") e a revisão do arquivo antes de compartilhar.

## Versões com suporte

Só a versão mais recente recebe correções. O site sempre publica a versão mais recente.

## Medidas em vigor

**Na página**
- CSP só com hashes: `default-src 'none'`, `connect-src 'none'`, `form-action 'none'`, `base-uri 'none'`; só os scripts e o estilo conferidos no build podem rodar. O build falha se algum trecho embutido não tiver o hash liberado.
- Nenhum recurso externo, nenhum `eval`, nenhum HTML montado a partir de texto do arquivo (a tela usa só `textContent`; a única exceção são os ícones fixos). Regras do ESLint e testes estáticos barram essas APIs no código.
- A leitura dos arquivos roda num Web Worker, que herda o bloqueio de rede. Arquivos danificados param com mensagem clara: leitor de `.zip` próprio com conferência de CRC, limites de tamanho e de taxa de compressão (proteção contra "zip bomb"), e um vigia que encerra leituras que não respondem.

**No código e no build**
- A única biblioteca que vai no arquivo (SheetJS) fica no repositório com versão e hash fixos; o build se recusa a usar um arquivo com hash diferente, e o workflow semanal confere o original publicado.
- Build reprodutível: o mesmo código gera os mesmos bytes em Linux e Windows (conferido no CI). O site recebe exatamente o arquivo da Release.
- Cada Release traz `SHA256SUMS`, SBOM (CycloneDX) e atestado de proveniência do GitHub.
- Workflows com permissão só de leitura por padrão, actions fixadas por hash de commit, instalação sem scripts de pacotes (`npm ci --ignore-scripts`), sem `pull_request_target`. Um teste confere essas regras.
- Dependabot, revisão de dependências nos PRs, CodeQL e OpenSSF Scorecard.

**No desenvolvimento**
- Só dados inventados. Os testes plantam "canários" (valores sensíveis de mentira) nas planilhas de exemplo e procuram cada um, com e sem acento e em qualquer caixa, em todas as partes do arquivo gerado.
- Testes com arquivos quebrados de propósito (fuzz) a cada mudança e numa rodada longa semanal.

## Recomendações para quem publica

- Ative autenticação em dois fatores para todos com acesso de escrita.
- Proteja a branch `main` (PR obrigatório, CI verde, revisão do dono do código) e o ambiente `github-pages` (aprovação antes de publicar).
- Ative o relato privado de vulnerabilidades (Settings → Code security).
