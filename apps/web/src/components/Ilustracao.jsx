import { FormaDeFundo } from "../styles/omnimobKit";
import "./Ilustracao.css";

/* ────────────────────────────────────────────────────────────────────────────
   Ilustracao — o encaixe para desenho de PESSOA.

   ── ONDE ELA ENTRA, E ONDE NÃO ──

   Só em tela sem conteúdo: um 404, uma lista vazia, o alto da página de
   contato. São os lugares onde a alternativa é espaço branco, e onde um
   desenho responde a pergunta "cadê a coisa?" melhor que uma frase.

   NUNCA como linguagem visual da página. A landing tem duas coisas melhores
   para isso: as formas da marca (`FormaDeFundo`, no kit) e as telas em DOM,
   que explicam o produto. Ilustração de banco — unDraw, Open Peeps — é
   reconhecível: quem já viu três landings de SaaS viu unDraw em duas. Usada
   como assinatura ela faz a página passar de crua a genérica, que é pior,
   porque genérico ninguém percebe como defeito.

   ── COMO PÔR UM DESENHO AQUI ──

   1. Baixe o SVG e salve em `apps/web/public/ilustracoes/<nome>.svg`.
      · unDraw (undraw.co) — sem atribuição, uso comercial livre. Escolha a cor
        de acento NO SITE antes de baixar: #6366f1 para o Hub, #ec0b5b para o
        Flow. Isso poupa editar o arquivo.
      · Open Peeps (openpeeps.com) e Humaaans (humaaans.com) — CC0, os
        "bonequinhos" de montar.
      · Storyset pede crédito no plano grátis; por isso ficou de fora.
   2. Passe `src="/ilustracoes/<nome>.svg"`.

   Sem `src`, o componente não fica com buraco: desenha as formas da marca no
   lugar. É proposital — a tela nunca depende de um arquivo que talvez ninguém
   tenha baixado ainda, e quem nunca puser desenho nenhum continua com uma
   página inteira e coerente.

   ── ACESSIBILIDADE ──

   `alt` é opcional e o padrão é vazio, porque ilustração de estado vazio é
   decoração: o texto ao lado já diz o que aconteceu, e um leitor de tela
   anunciando "desenho de pessoa com laptop" antes da mensagem só atrasa. Passe
   `alt` apenas quando o desenho carregar informação que o texto não tem.
   ──────────────────────────────────────────────────────────────────────────── */

export function Ilustracao({
  src,
  alt = "",
  altura = 200,
  cor = "rgba(99,102,241,0.10)",
  corSecundaria = "rgba(212,175,55,0.10)",
  className = "",
}) {
  return (
    <div
      className={`ilustracao ${className}`.trim()}
      style={{ "--ilustracao-altura": `${altura}px` }}
    >
      {src ? (
        <img src={src} alt={alt} loading="lazy" />
      ) : (
        /* O substituto: as duas formas da marca, sobrepostas. Não é "imagem
           faltando" — é o mesmo vocabulário que fecha o rodapé e abre a seção
           do Flow, e por isso lê como decisão e não como buraco. */
        <span className="ilustracao__formas" aria-hidden="true">
          <FormaDeFundo forma="flor" cor={cor} gira={70} className="ilustracao__forma--a" />
          <FormaDeFundo forma="luas" cor={corSecundaria} gira={55} inverso className="ilustracao__forma--b" />
        </span>
      )}
    </div>
  );
}

export default Ilustracao;
