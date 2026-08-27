# Ilustrações

Coloque aqui os SVGs de desenho de **pessoa** e passe o caminho para o
componente `<Ilustracao src="/ilustracoes/<nome>.svg" />`.

## Onde usar — e onde não

Só em tela sem conteúdo: o 404, um estado vazio, o alto da página de contato.
São os lugares onde a alternativa é espaço branco.

**Nunca como linguagem visual da página.** Ilustração de banco é reconhecível —
quem já viu três landings de SaaS viu unDraw em duas. Usada como assinatura,
ela faz a página passar de crua a genérica, que é pior, porque genérico
ninguém percebe como defeito. A assinatura da Omnimob são as formas da marca
(`FormaDeFundo`, em `src/styles/omnimobKit.jsx`) e as telas em DOM.

## De onde baixar

| Fonte | Licença | Observação |
|---|---|---|
| [unDraw](https://undraw.co/) | Sem atribuição, uso comercial livre | Escolha a cor de acento **no site** antes de baixar |
| [Open Peeps](https://www.openpeeps.com/) | CC0 | Bonequinhos de montar, traço à mão |
| [Humaaans](https://www.humaaans.com/) | CC0 | Pessoas de montar (cabeça, corpo, pose) |
| [Storyset](https://storyset.com/) | **Exige crédito** no plano grátis | Por isso ficou de fora |

Cor de acento na hora do download:

- `#6366f1` — Omnimob Hub
- `#ec0b5b` — Omnimob Flow

Restrições do unDraw: não revender em pacote, não construir biblioteca
concorrente, não usar para treinar modelo. Usar no site é o caso previsto.

## Enquanto não houver arquivo

`<Ilustracao />` sem `src` desenha as formas da marca no lugar. É proposital:
nenhuma tela depende de um arquivo que talvez ninguém tenha baixado.
