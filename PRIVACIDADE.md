# Privacidade e limites

Este texto explica o que acontece com a sua planilha e o que o arquivo gerado contém. Vale para o site e para o arquivo baixado (`anonimizador.html`), que são o mesmo arquivo.

## O que acontece com a sua planilha

- **Ela é lida só no seu computador**, na memória do navegador, e descartada quando você fecha ou recarrega a página.
- **Nada é enviado para a internet.** A página não tem servidor, não usa cookies, não guarda nada no navegador (nem `localStorage`) e não tem nenhum tipo de estatística de uso ou rastreamento.
- **O bloqueio é técnico, não só uma promessa:**
  - uma regra de segurança dentro do próprio arquivo (Content-Security-Policy, com `connect-src 'none'` e `default-src 'none'`) impede o navegador de fazer conexões a partir da página;
  - a página não carrega nenhum script, fonte ou imagem de fora: tudo vem dentro do arquivo, e só os trechos de código conferidos no build podem rodar;
  - a cada mudança no código, testes automáticos abrem a página em Chrome, Firefox e Safari (WebKit), pelo site e pelo arquivo, e confirmam que ela não faz nenhuma requisição, que funciona sem internet e que uma tentativa proposital de conexão é bloqueada.
- **O código é aberto** e o arquivo publicado pode ser conferido: o hash (SHA-256) de cada versão e o atestado de proveniência mostram que o arquivo foi montado pelo GitHub a partir deste código.

**Sobre o site:** quando você abre o site, o serviço que hospeda a página (GitHub Pages) recebe o pedido da página, como em qualquer site: o endereço IP e o navegador aparecem nos registros dele. **A planilha nunca faz parte desse pedido.** Para arquivos muito sensíveis, ou se preferir não acessar nenhum site, use o arquivo baixado, sem internet.

## O que o arquivo gerado contém

O arquivo gerado é uma **amostra fictícia**: tem a mesma estrutura da sua planilha e poucas linhas (10, 20 ou 30) com valores inventados.

| | |
|---|---|
| **Valores inventados** | Nomes, documentos (CPF, CNPJ, chaves de NF-e), e-mails, telefones, endereços, cidades, códigos, datas, valores e textos. Textos acima do cabeçalho (como o título de um relatório) viram um texto genérico. As cidades inventadas são municípios reais do IBGE, **nunca** os que estão no original. A ferramenta também confere que nenhum texto inventado coincide com um texto real da planilha. |
| **Continua igual ao original** | Nomes das abas; títulos das colunas; opções de listas curtas (como "Pago/Pendente"), a não ser que você escolha trocá-las; colunas com um valor fixo; colunas 0/1; e qualquer coluna que você marcar como "usar dados reais". |

Por isso, **a amostra não é uma versão anonimizada da sua planilha.** Títulos, nomes de abas e listas mantidas podem revelar informações da empresa ou, em casos específicos, de pessoas (por exemplo, uma aba chamada com o nome de um cliente). **Confira o arquivo antes de compartilhar.**

### A descrição copiada

O botão "Copiar descrição das colunas" gera um texto com: nome do arquivo, nomes das abas, títulos das colunas, tipo e formato de cada coluna, quantidades de linhas, as opções das listas curtas (com o percentual de cada uma) e os valores fixos. **Não traz os valores das demais colunas.** Leia o texto antes de colar em outro lugar.

## Linguagem e LGPD

- Esta ferramenta **não** promete "anonimização conforme a LGPD". Anonimização, no sentido da lei (art. 12), exige que a pessoa não possa mais ser identificada por meios razoáveis. Quem decide se um arquivo pode ser compartilhado é você e a sua organização.
- A próxima etapa do projeto (substituir dados no **arquivo inteiro**, trocando cada valor sempre pelo mesmo substituto) produz **dado pseudonimizado** (LGPD art. 13 §4): ele continua sendo dado pessoal e deve ser tratado como tal.

## Limites conhecidos

- A análise usa as primeiras 500 linhas de cada aba. Uma coluna que só tem dados sensíveis mais abaixo pode ser classificada de outro jeito; confira os tipos no passo 2.
- Planilhas protegidas por senha não podem ser lidas.
- Macros, gráficos, tabelas dinâmicas, comentários e imagens **não** vão para a amostra (ela é montada do zero, não copiada).
- Texto livre (como uma coluna "Observação") é substituído por frases inventadas; nomes que estejam dentro de outras colunas de texto não são procurados um a um nesta versão.

## Dúvidas ou problemas

Abra uma issue **sem anexar planilhas nem dados reais**. Para problemas de segurança (por exemplo, um valor real que apareceu no arquivo gerado, ou qualquer conexão feita pela página), siga o [SEGURANCA.md](SEGURANCA.md).
