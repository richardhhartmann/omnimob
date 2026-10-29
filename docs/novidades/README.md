# Novidades

Toda semana, uma apresentação conta aos clientes o que entrou na Omnimob, uma página por funcionalidade: **para que serve, como usar e onde fica**, com o print da tela. Porte do fluxo que já roda no VYA Manager (`nxc-webjs/docs/novidades`).

Nada técnico: sem servidor, banco, API interna ou nome de arquivo. Só o que a imobiliária vê e faz.

## A versão da Omnimob

`MAIOR.SEMANA.ENTREGA`, calculada do git por [apps/api/src/services/versao.js](../../apps/api/src/services/versao.js) — a mesma régua do VYA:

- **MAIOR** (hoje 1) só muda à mão, numa virada grande.
- **SEMANA** sobe toda terça às 15h01 (Brasília). A semana 1 começou em 27/10/2026; o que veio antes é a 1.0.
- **ENTREGA** é a ordem do commit na `main` dentro da semana. Aqui cada commit da `main` é um PR (merge por squash), então a 1.4.3 é o terceiro PR da semana 4.

Para o suporte: "corrigido na 1.4.3" quer dizer que quem está na 1.4.3 ou depois já tem a correção. O cliente vê a dele em **Ajuda › Notas de versão**; o super-admin mostra no rodapé da barra lateral (com o commit) e na aba **Versionamento**, que todo cargo do painel vê.

No servidor não há `.git`: o `npm run build` grava `apps/api/versoes.json` (`node scripts/versao.js --gravar`). Se o provedor clonar raso e não der para buscar o resto, o build segue e o painel mostra só o commit. Na imagem Docker o número chega por `--build-arg OMNIMOB_VERSAO=$(npm run -s versao -w apps/api)`.

## O fluxo

1. **Toda terça às 15h01** uma rotina do Claude Code na nuvem segue [AGENDAMENTO.md](AGENDAMENTO.md): lê os PRs que entraram na `main` desde a terça anterior, escreve o conteúdo e entrega como **rascunho** em `PUT /api/novidades/rascunho/<terça>`, com `Authorization: Bearer $NOVIDADES_TOKEN`. Semana sem nada que o cliente veja não gera rascunho.
2. **Revisão no super-admin**, aba **Novidades** (permissão `verNovidades`): a apresentação aparece como o cliente vai ver; clique no texto do slide para reescrever (Enter confirma, Esc desfaz). Embaixo do slide ficam o tipo, quem vê, o ícone, os prints (vão para o Cloudinary) e o botão de tirar a novidade. **Salvar** grava a revisão.
3. **Publicar** (permissão `publicarNovidades`): a apresentação abre **uma vez** para cada pessoa ao entrar no painel, nos 14 dias seguintes, e fica em **Ajuda › Notas de versão**. Com "mandar por e-mail" marcado, cada pessoa com e-mail recebe a lista do que ela alcança, com um botão para a apresentação (`/?novidades=<terça>`). A rotina nunca sobrescreve uma semana publicada (409).

Sem rotina, dá para começar a semana à mão: na aba, **Começar à mão** cria o rascunho com textos para reescrever, e **+ Novidade** / **+ Área** acrescentam.

## Quem vê o quê

As três perguntas do produto valem aqui. Cada novidade pode ter:

- `modulo: "FLOW"` — só quem tem o Omniflow contratado **e** o cargo com a porta (`acessarFlow`);
- `permissao` — uma coluna do `Cargo` (`gerenciarImoveis`, `verConfiguracoes`, `gerenciarNegocios`…). O corretor não vê a novidade de uma tela que não abre.

O corte é no servidor ([apps/api/src/services/novidades.js](../../apps/api/src/services/novidades.js)), e o e-mail usa o mesmo. Sem nenhum dos dois, todo mundo vê.

## Situação e prazo

O rascunho tem **7 dias** depois da terça em que chegou: *Aguardando*, *Sem apresentação* (passou da terça e nada chegou: a semana não teve novidade para o cliente, ou a rotina falhou), *Em dia*, *Atrasado*, *Publicado em dia* e *Publicado com atraso*.

## Quem viu

Embaixo da revisão: uma linha por pessoa que abriu a apresentação, com a imobiliária, a primeira e a última vez, quantas vezes, até qual slide chegou (ou "Até o fim"), o tempo aberto e o aparelho. A revisão no super-admin, a demonstração e o suporte dentro da conta não contam.

## PPTX

**Baixar PPTX** gera o PowerPoint no navegador, da versão que está na tela, com o mesmo desenho dos slides. É o que vai para a reunião com o suporte.

## Ligar a rotina

1. Defina `NOVIDADES_TOKEN` na API (Render e cofre) com um valor longo e aleatório. Sem ela a porta do rascunho não existe.
2. Em claude.ai/code, crie uma routine semanal, toda terça às 15h01 (America/Sao_Paulo), neste repositório, com o texto de [AGENDAMENTO.md](AGENDAMENTO.md) como instrução. No ambiente dela, cadastre `NOVIDADES_TOKEN` como segredo e libere a rede para `api.omnimob.app`.
3. O que **precisa** entrar numa semana, mesmo que o código não deixe claro, vai em [AVISOS.md](AVISOS.md).

Para entregar à mão: `npm run novidades -w apps/api -- <pasta>` (com `--conferir` só valida). O formato está em [exemplo/conteudo.json](exemplo/conteudo.json).
