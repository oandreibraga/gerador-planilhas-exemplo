# Histórico de mudanças

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versões seguem [versionamento semântico](https://semver.org/lang/pt-BR/).

## [Não publicado]

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
- Aba com nome que o Excel não aceita (arquivo danificado) impedia gerar a amostra; o nome é ajustado (até 31 caracteres, sem repetir).
- Arquivo que o navegador não consegue ler do disco (pasta de rede desconectada, arquivo só na nuvem) mostra mensagem clara em vez de "erro inesperado".

## [2.0.0]

Versão de uso interno: tipos com significado (cidade, UF, CPF/CNPJ, chave NF-e, endereço, bairro, CFOP, 0/1, valores fixos), relações entre colunas, `.zip` com escolha da planilha, nova tela.

## [1.0.0]

Versão de uso interno: amostra de 10/20/30 linhas com a mesma estrutura, descrição das colunas para colar em pedidos.
