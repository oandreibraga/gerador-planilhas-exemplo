# Histórico de mudanças

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versões seguem [versionamento semântico](https://semver.org/lang/pt-BR/).

## [Não publicado]

## [3.2.0]

### Adicionado
- **Arquivo inteiro com dados trocados** (pseudonimização) para `.xlsx`, `.xlsm` e `.csv`: todas as linhas, com nomes, documentos, e-mails, telefones, endereços, códigos e textos trocados por fictícios consistentes (o mesmo valor vira sempre o mesmo fictício, em todas as abas); o resto fica como está. Escolha por coluna: trocar, manter, generalizar ou apagar. O arquivo é editado por dentro, em fluxo: formatação, fórmulas, larguras, mesclagens e imagens ficam; metadados, comentários, macros, links e tabelas dinâmicas saem; recursos que ainda não são tratados com segurança fazem o arquivo ser recusado com explicação. Relatório no fim, sem mostrar nenhum valor real.
- Listas extras de nomes e sobrenomes (montadas para o projeto) para ter fictícios suficientes em arquivos grandes.
- Desempenho: 67 mil linhas × 86 colunas em cerca de 1 minuto, com menos de 1,5 GB de memória.

## [3.1.0]

### Adicionado
- Botão "Baixar para usar sem internet" no site: um `.zip` com a ferramenta (o mesmo arquivo do site), um LEIA-ME em português, os hashes para conferir e as licenças. O pacote também vai em cada Release, com atestado de proveniência, e a verificação semanal confere que o `.zip` do site é o da Release.

## [3.0.0]

Primeira versão pública.

### Adicionado
- Marca neutra; temas de marca podem ser aplicados só no build interno (`--tema`).
- Leitura dos arquivos fora da tela (Web Worker): a página não trava com planilhas grandes.
- Leitor de `.zip` próprio, com conferência de integridade e limites contra arquivos que inflam demais. Arquivos danificados param com mensagem clara, sem travar.
- Seção "Privacidade e limites" e "Licenças" no rodapé.
- Arquivos `SHA256SUMS`, SBOM e atestado de proveniência em cada Release.

### Mudado
- Regra de segurança da página (CSP) passa a liberar só os trechos de código conferidos no build, sem `unsafe-inline`.
- Textos de privacidade revistos: deixam claro o que continua igual ao original (títulos, nomes de abas, listas curtas, valores fixos).
- Nomes de pessoas e bairros inventados não coincidem com o original nem com outra caixa, sem acento ou como parte de um texto real.

### Corrigido
- "Estado civil" voltou a ser reconhecido como lista de opções (e não como UF).
- Arquivo danificado com uma célula numa coluna impossível (ex.: coluna 50.000 num .xls) travava a análise; agora dá a mensagem de arquivo danificado na hora.
- Busca de relações entre colunas ignora colunas vazias (planilhas largas ficam mais rápidas).
- Leitura que não responde é interrompida em 20 s + 2 s por MB (antes, sempre 3 minutos).
- Acessibilidade: área de escolha do arquivo sem controle dentro de controle (leitores de tela) e subtítulo do topo com contraste suficiente.
- Aba com nome que o Excel não aceita (arquivo danificado) impedia gerar a amostra; o nome é ajustado (até 31 caracteres, sem repetir). Texto maior que o limite do Excel (32.767 caracteres por célula) é cortado.
- Arquivo que o navegador não consegue ler do disco (pasta de rede desconectada, arquivo só na nuvem) mostra mensagem clara em vez de "erro inesperado".

## [2.0.0]

Versão de uso interno: tipos com significado (cidade, UF, CPF/CNPJ, chave NF-e, endereço, bairro, CFOP, 0/1, valores fixos), relações entre colunas, `.zip` com escolha da planilha, nova tela.

## [1.0.0]

Versão de uso interno: amostra de 10/20/30 linhas com a mesma estrutura, descrição das colunas para colar em pedidos.
