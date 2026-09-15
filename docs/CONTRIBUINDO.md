# Como contribuir — branches, commits e pull requests

Este guia diz como o código chega à `main`. A regra de fundo é uma só: **a
`main` é produção**. A Vercel (front) e o Render (API) fazem deploy dela a cada
push, então tudo que entra lá está no ar minutos depois.

---

## O modelo: GitHub Flow

Uma branch estável (`main`) e branches curtas que nascem dela e voltam por pull
request. Sem `develop`, sem `release/*`: com o time do tamanho que é e com
deploy contínuo, uma branch intermediária só acrescentaria um merge a mais — e
uma segunda fila de migrations do Prisma esperando para subir.

```
main ──●──────●──────────●──────●──▶  (produção)
        \    /            \    /
         ●──●  feat/…      ●──●  fix/…
```

> Quando houver ambiente de homologação, ele será uma branch `staging` com
> serviço próprio no Render e um terceiro projeto Supabase. Isso é infra, não
> git — até lá, o preview que a Vercel gera para cada PR cobre o front, e a API
> se testa localmente.

---

## Nomes de branch

`<tipo>/<módulo>-<o-que-faz>`, em minúsculas, com hífens. O módulo é opcional e
segue o vocabulário do código (`hub`, `flow`, `vitrine`, `api`, `admin`).

| Tipo | Quando | Exemplo |
|---|---|---|
| `feat/` | funcionalidade nova | `feat/flow-comissoes-split` |
| `fix/` | correção que não é urgente | `fix/vitrine-zebra-no-celular` |
| `hotfix/` | produção quebrada, entra hoje | `hotfix/api-cors-www` |
| `refactor/` | muda a forma, não o comportamento | `refactor/leads-parados-regra-unica` |
| `chore/` | dependência, script, config | `chore/prisma-6-2` |
| `docs/` | só documentação | `docs/claude-md-modulos` |

**Uma branch por tarefa, não por pessoa.** Quem fez fica no autor do commit;
a branch é o trabalho. Uma branch "do fulano" com cinco tarefas dentro vira um
PR que não dá para aprovar pela metade nem reverter pela metade. Se quiser ver
o nome no caminho, prefixe: `richard/feat-flow-comissoes`.

Branch é descartável: nasce da `main` atualizada, dura dias (não semanas) e é
apagada no merge. Se está durando semanas, provavelmente é mais de um PR.

```bash
git switch main && git pull
git switch -c feat/flow-comissoes-split
```

---

## Commits

Mensagem no formato **Conventional Commits, em português**:

```
<tipo>(<escopo>): <o que muda, no imperativo>

<por quê — opcional, mas é o que vale ouro daqui a seis meses>
```

```
feat(flow): congelar o split de comissão no negócio

Mudar a política de comissão não pode reescrever negócios já fechados;
o valor passa a ser gravado no Negocio no momento do fechamento.
```

Tipos: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`. Escopo é o
mesmo vocabulário dos nomes de branch.

Como a `main` recebe **squash merge**, o título do PR vira a mensagem do commit
final — então capriche no título do PR, mesmo que os commits da branch sejam
"wip".

---

## Pull requests

1. O PR abre **sozinho** no primeiro `git push` da branch, já pronto para
   revisão (`.github/workflows/abrir-pr.yml`) — então só dê push quando
   terminou. Trabalho pela metade fica local, ou vira rascunho à mão
   (`gh pr ready --undo`).
2. Preencha o template. O campo que mais importa é **"Por quê"**: o diff já
   diz o quê.
3. O CI precisa passar (`.github/workflows/ci.yml` roda os testes dos dois
   apps e o build do front).
4. Uma aprovação de alguém que não é o autor. Em PR que toca
   `prisma/schema.prisma`, `middlewares/` ou `services/flow/`, o CODEOWNERS
   chama o responsável automaticamente.
5. **Squash and merge**. A branch é apagada sozinha.

### O que o revisor procura

Além de "funciona?", as três perguntas que este projeto aprendeu a fazer da
forma difícil:

- **Modelo novo tem `tenantId`?** Toda query filtra por ele? (Os vazamentos
  entre imobiliárias passaram meses invisíveis porque com um cliente só o
  sintoma não aparece.)
- **Rota nova está no OpenAPI?** `test/documentacaoApi.test.js` falha se não
  estiver — mas o revisor confere antes de o CI reclamar.
- **Mexeu na vitrine sem mexer no editor (ou vice-versa)?** Os dois desenham
  pelo mesmo `ShowcaseRenderer`; se o PR cria uma segunda versão de qualquer
  peça, é o defeito, não a solução.

### Migrations

PR com migration do Prisma pede atenção dupla:

- A migration precisa estar em `apps/api/prisma/migrations/` — nunca
  `db push` em produção.
- Coluna nova em tabela grande: `NOT NULL` sem `DEFAULT` trava o deploy.
- Renomear coluna é `DROP` + `ADD` para o Prisma; se houver dado, escreva a
  migration à mão.

---

## Tarefas no Notion e o `/tarefa`

As tarefas vivem no banco **Tarefas** do Notion (página OmniMob → Como
trabalhar tem as regras). O skill `.claude/skills/tarefa/SKILL.md` faz o
caminho fila → branch → PR e vem junto com o repositório.

Para usá-lo, abra o Claude Code **na raiz do repositório** e escreva
`pega minha tarefa`. Na extensão do VS Code no Windows, digitar `/tarefa`
mostra "No matching commands" — é um bug conhecido do autocomplete
([anthropics/claude-code#58556](https://github.com/anthropics/claude-code/issues/58556));
o skill está carregado e responde à frase. No CLI `claude` do terminal o
`/tarefa` aparece normalmente.

Cada um precisa, uma vez: `gh auth login` e o Notion conectado ao Claude Code
com a própria conta (`claude mcp add --transport http notion https://mcp.notion.com/mcp`
ou pelo conector do claude.ai).

---

## Hotfix

Produção quebrada não espera revisão longa, mas **não pula o PR**: abre
`hotfix/…` da `main`, PR com o mínimo que resolve, uma aprovação rápida,
merge. O CI continua obrigatório — é ele que impede o hotfix de quebrar outra
coisa.

---

## Proteção da `main` (configurada no GitHub)

O que está ligado no repositório, em *Settings → Rules → Rulesets*:

- Push direto bloqueado — só via PR
- Force-push e exclusão da branch bloqueados
- 1 aprovação obrigatória; aprovação antiga é descartada quando entram commits novos
- Revisão do CODEOWNERS obrigatória onde ele se aplica
- Checks obrigatórios: `web` e `api` (do workflow **CI**)
- Conversas resolvidas antes do merge
- Histórico linear (squash ou rebase; merge commit desligado)

Administradores têm **uma** exceção, e ela é estreita: podem fazer merge de um
PR sem a aprovação de terceiro (`bypass_mode: pull_request`). Existe porque o
GitHub não deixa ninguém aprovar o próprio PR, e o mantenedor precisa entregar
código. O que a exceção **não** abre: push direto na `main`, force-push,
exclusão da branch, nem o CI — tudo isso vale para todo mundo, admin incluído.
`git push origin main` é recusado para qualquer pessoa, sempre.
