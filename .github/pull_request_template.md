Tarefa: <!-- link da página no Notion, se houver -->

## O que muda

<!-- Uma ou duas frases. O diff já mostra os detalhes. -->

## Por quê

<!-- O motivo. É isto que alguém vai procurar daqui a seis meses. -->

## Como testar

<!-- Passos para quem revisa reproduzir. Usuário, tenant, rota, o que esperar. -->

## Checklist

- [ ] `npm test` passou em `apps/api` e em `apps/web`
- [ ] Modelo novo (se houver) nasceu com `tenantId` e toda query filtra por ele
- [ ] Rota nova (se houver) está no OpenAPI (`services/documentacaoApi.js`)
- [ ] Migration (se houver) está em `prisma/migrations/` e não trava tabela cheia
- [ ] Vitrine e editor continuam desenhando pelo mesmo componente (sem segunda versão de peça)
- [ ] Variável de ambiente nova (se houver) documentada no `CLAUDE.md`
- [ ] Textos, mensagens de erro e comentários em português

## Capturas

<!-- Se muda tela. Antes/depois ajuda. -->
