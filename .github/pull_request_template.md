## O que muda

<!-- Uma ou duas frases. Se resolve uma issue: "Resolve #123". -->

## Risco para a privacidade

- [ ] Não acrescenta nenhum acesso à rede, armazenamento no navegador ou script externo
- [ ] Nenhum valor real de planilha aparece em mensagens, resumo ou arquivo gerado (canários verdes)
- [ ] Se mexe em texto da tela ou em PRIVACIDADE.md: continua dizendo "dados fictícios"/"pseudonimização", nunca "anonimização conforme LGPD"
- [ ] Não usei nenhuma planilha real para desenvolver ou testar (só dados inventados)

## Como foi testado

- [ ] `node scripts/verificar.mjs` passou na minha máquina
- [ ] Teste novo cobrindo a mudança (unidade, integração ou navegador)
- [ ] Se muda a tela: abri `dist/anonimizador.html` no navegador e conferi à mão

## Checklist

- [ ] CHANGELOG.md atualizado (seção "Não publicado")
- [ ] Se muda o comportamento da amostra de propósito: `node scripts/atualizar-referencia.mjs` e expliquei o motivo acima
