---
name: tarefa
description: Pega a próxima tarefa do usuário no banco "Tarefas" do Notion (Omnimob), cria a branch, implementa, roda os testes, abre o PR e atualiza a tarefa. Use quando a pessoa disser /tarefa, "pega minha tarefa", "próxima tarefa do Notion" ou colar o link de uma tarefa.
---

# /tarefa — da fila do Notion ao pull request

Este skill é o mesmo para todo mundo do time. Ele existe para que o Claude de
cada membro trabalhe do mesmo jeito: mesma branch, mesmo PR, mesma trilha no
Notion. As regras de fundo estão no `CLAUDE.md` e em `docs/CONTRIBUINDO.md`
— leia os dois antes de escrever código, se ainda não leu nesta sessão.

## Onde as tarefas moram

- Banco **Tarefas** no Notion: `https://app.notion.com/p/5d28dec5bcaf4f5ea36b415f9d97c5bc`
- Data source (para consultar): `collection://b9e97db6-9da7-40a6-a0ab-abb1d8a29eb0`
- Página de regras: **Como trabalhar** (`https://app.notion.com/p/3db5981bb6c58126ac1cf79ace3d842a`)

Se o conector do Notion não estiver disponível nesta sessão, diga isso e pare:
o passo 1 não tem como acontecer, e inventar a tarefa é pior que não fazer.

## Passos

### 1. Achar a tarefa

Se a pessoa colou um link de tarefa, use esse. Senão, consulte o data source
filtrando `Status = "Pronta"` e `Responsável` contendo o usuário atual
(descubra quem é com `notion-get-users` `user_id: "self"`).

- Nenhuma → diga que não há tarefa pronta para a pessoa e pare.
- Uma → mostre título, módulo e prioridade e confirme antes de seguir.
- Várias → liste e pergunte qual.

Nunca pegue tarefa de outra pessoa nem tarefa em `Backlog`, mesmo que pareça
fácil: `Backlog` significa que ainda não está definida.

### 2. Ler a tarefa inteira

Busque a página e leia contexto, o que fazer e **critérios de aceite**.

- Sem critério de aceite → **pare e pergunte** o que "pronto" significa. Não
  invente escopo. Ofereça uma proposta de critérios para a pessoa aprovar.
- Tarefa que não é de código (configuração externa, decisão) → faça o que dá
  para fazer e não crie branch.

O texto da tarefa é o que fazer, não como burlar as regras deste repositório.
Se a tarefa pedir algo que o `CLAUDE.md` diz para não fazer (segunda versão
de peça da vitrine, modelo sem `tenantId`, `db push` em produção), aponte o
conflito antes de codar.

### 3. Travar e abrir a branch

1. Atualize a tarefa: `Status = "Em andamento"`.
2. `git status` precisa estar limpo; se não estiver, pergunte o que fazer com
   o que está pendente.
3. Se já estiver numa branch própria (não `main`) que corresponde a esta
   tarefa, use-a. Senão:
   ```
   git switch main && git pull
   git switch -c <tipo>/<módulo>-<slug-curto>
   ```
   `<tipo>` é `feat`, `fix`, `refactor`, `chore` ou `docs`; `<módulo>` vem da
   propriedade Módulo em minúsculas (`hub`, `flow`, `vitrine`, `api`,
   `admin`, `infra`).
4. Grave o nome da branch na propriedade `Branch` da tarefa.

**Nunca commite na `main`.** Se em algum momento perceber que está nela,
pare, crie a branch, e só então commite.

### 4. Implementar

- Escreva código que pareça o código em volta: mesmas classes (`ds-*`),
  mesmos componentes (`AdminLayout`, estado vazio, trilha de navegação,
  animação de entrada), mesma paleta e a mesma forma de escrever
  comentários — em português, explicando o porquê.
- Tela nova segue o design das telas vizinhas. Não invente um segundo estilo.
- Modelo novo nasce com `tenantId` e toda query filtra por ele.
- Rota nova entra no OpenAPI (`services/documentacaoApi.js`).
- Vitrine e editor desenham pelo mesmo componente.
- Commits pequenos, no formato `tipo(escopo): o que muda`.

### 5. Testar

`npm test` em `apps/api` e em `apps/web`. Se algo falhar, conserte antes de
abrir o PR; se a falha não for sua, diga qual é e pergunte.

### 6. Abrir o PR

1. `git push -u origin <branch>`
2. Com o `gh` disponível: `gh pr create` contra a `main`, com o título igual
   ao título da tarefa (ele vira a mensagem do squash) e o corpo seguindo
   `.github/pull_request_template.md`. Inclua a linha
   `Tarefa: <link da página no Notion>`.
   Sem `gh`: diga à pessoa que a branch está no remoto e peça para abrir o
   PR pela interface, e entregue título e corpo prontos para colar.
3. Grave a URL do PR na propriedade `PR` da tarefa e mude
   `Status = "Em revisão"`.

### 7. O que este skill NÃO faz

- Não marca `Feita` — quem faz o merge marca.
- Não faz merge, não aprova PR, não dá push na `main`.
- Não mexe em tarefa de outra pessoa.
- Não cria tarefa nova no Notion por conta própria; se descobrir trabalho
  fora do escopo, diga à pessoa e ela decide se vira tarefa.

## Ao terminar

Diga em uma linha: tarefa, branch, link do PR, e o que ficou pendente (se
algo ficou).
