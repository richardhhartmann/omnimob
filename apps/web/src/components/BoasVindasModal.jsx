import { useEffect, useState } from "react";
import { api } from "../api";
import { PLANOS } from "../utils/planos";
import { IconeCheck, IconeEstrela } from "./Icones.jsx";
import { PerfilInicialPasso, PERFIL_INICIAL_CSS } from "./PerfilInicialPasso.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   Boas-vindas de quem acabou de assinar, no primeiro acesso ao painel.

   POR QUE AQUI E NÃO SÓ NA PÁGINA DO LINK: aquela tela aparece antes do login,
   e boa parte das pessoas fecha a aba, entra por outro caminho ou cai direto na
   troca de senha obrigatória — e nunca vê. Este modal fecha essa lacuna: quem
   assinou é recebido dentro do produto, no momento em que vai usá-lo.

   Aparece uma vez só, e quem garante isso é uma marca no navegador — não o
   banco. O schema não guarda QUANDO a assinatura começou, e a idade do tenant
   não serve de pista: quem testa três semanas e só então assina tem um tenant
   velho. Registrar a data pediria coluna nova (e migração) para um detalhe de
   interface, então por ora o critério é "assinatura ativa e ainda não vista
   aqui". O custo é um cliente antigo, em máquina nova, ver boas-vindas fora de
   hora.
   ──────────────────────────────────────────────────────────────────────────── */

/* Chave separada por modo: quem viu as boas-vindas do teste e depois assina
   precisa ver as de assinante também — é outra mensagem, em outro momento. */
const chaveVisto = (slug, modo) => `domus_boas_vindas_${modo}_${slug}`;

// Duração da saída. Precisa bater com a das animações no CSS.
const SAIDA_MS = 260;

/* Chuva de festa de quem acabou de assinar. Assinar é o momento mais alto da
   relação com o produto e merece ser comemorado — o teste ganha o dourado
   sóbrio, este ganha confete.

   A lista é fixa, não sorteada: um sorteio mudaria o enquadramento a cada
   render (o modal re-renderiza ao fechar) e faria os emojis saltarem de lugar
   no meio do voo. Escrito à mão, também dá para espalhar as saídas pela
   largura em vez de torcer para o acaso não amontoar tudo num canto.

   x     de onde sai, em % da largura da tela
   dx    deriva lateral do arremesso, em px
   alto  altura do pulo, em % da altura da tela
   giro  rotação no percurso
   ms    atraso — duas levadas, para a festa não acabar num piscar
   tam   lado do desenho, em px */
/* Formas desenhadas, não emoji. O confete de emoji dependia da fonte do
   sistema — no Windows saía um 🎉 laranja-berrante que não tem nada a ver com o
   roxo e o dourado da marca, e no Linux vinha um retângulo vazio. Cinco formas
   simples em SVG resolvem, e ainda dá para pintá-las na cor certa. */
function Confete({ forma, cor, tam }) {
  const comum = { width: tam, height: tam, viewBox: "0 0 24 24", fill: cor, "aria-hidden": "true" };
  if (forma === "circulo") return <svg {...comum}><circle cx="12" cy="12" r="7.5" /></svg>;
  if (forma === "fita") return <svg {...comum}><rect x="4" y="8.5" width="16" height="7" rx="2.4" /></svg>;
  if (forma === "estrela") {
    return <svg {...comum}><path d="M12 2.6l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.44l-5.81 3.06 1.11-6.47L2.6 9.45l6.5-.95z" /></svg>;
  }
  // faísca
  return <svg {...comum}><path d="M12 1.5l2.6 7.9 7.9 2.6-7.9 2.6L12 22.5l-2.6-7.9L1.5 12l7.9-2.6z" /></svg>;
}

const CONFETES = [
  { forma: "fita", cor: "#a78bfa", x: 6,  dx: 90,   alto: 76, giro: 260,  ms: 0,    tam: 30 },
  { forma: "fita", cor: "#d4af37", x: 17, dx: 40,   alto: 88, giro: -200, ms: 90,   tam: 26 },
  { forma: "faisca", cor: "#e5c158", x: 27, dx: -30,  alto: 70, giro: 160,  ms: 220,  tam: 22 },
  { forma: "estrela", cor: "#d4af37", x: 38, dx: 25,   alto: 94, giro: -300, ms: 40,   tam: 32 },
  { forma: "circulo", cor: "#8b5cf6", x: 49, dx: -55,  alto: 82, giro: 120,  ms: 300,  tam: 27 },
  { forma: "fita", cor: "#a78bfa", x: 60, dx: -80,  alto: 90, giro: -240, ms: 150,  tam: 29 },
  { forma: "faisca", cor: "#a78bfa", x: 71, dx: 35,   alto: 66, giro: 340,  ms: 260,  tam: 23 },
  { forma: "fita", cor: "#d4af37", x: 82, dx: -45,  alto: 84, giro: 210,  ms: 60,   tam: 28 },
  { forma: "estrela", cor: "#e5c158", x: 92, dx: -95,  alto: 72, giro: -170, ms: 190,  tam: 26 },
  { forma: "faisca", cor: "#e5c158", x: 12, dx: 60,   alto: 62, giro: -280, ms: 340,  tam: 20 },
  // Segunda levada, meio segundo depois.
  { forma: "circulo", cor: "#8b5cf6", x: 22, dx: 70,   alto: 80, giro: 190,  ms: 620,  tam: 25 },
  { forma: "fita", cor: "#a78bfa", x: 34, dx: -40,  alto: 92, giro: -230, ms: 780,  tam: 28 },
  { forma: "faisca", cor: "#a78bfa", x: 45, dx: 50,   alto: 68, giro: 310,  ms: 700,  tam: 21 },
  { forma: "estrela", cor: "#d4af37", x: 56, dx: -65,  alto: 86, giro: -150, ms: 860,  tam: 30 },
  { forma: "fita", cor: "#d4af37", x: 67, dx: 30,   alto: 74, giro: 250,  ms: 660,  tam: 24 },
  { forma: "faisca", cor: "#e5c158", x: 78, dx: -25,  alto: 90, giro: -320, ms: 820,  tam: 22 },
  { forma: "fita", cor: "#a78bfa", x: 88, dx: 75,   alto: 78, giro: 180,  ms: 740,  tam: 27 },
  { forma: "circulo", cor: "#8b5cf6", x: 3,  dx: 110,  alto: 64, giro: -210, ms: 900,  tam: 23 },
];

/* `aoResolver` avisa quem está na fila que este modal já terminou o que tinha
   para fazer — mostrou e foi fechado, ou nem chegou a aparecer. Sem esse aviso,
   o tour de primeiro acesso subiria por cima deste no acesso de quem acabou de
   assinar (ou de abrir o teste), com dois modais disputando a mesma tela. */
export function BoasVindasModal({ tenantSlug, aoResolver, aoAtualizarTenant }) {
  const [dados, setDados] = useState(null);
  const [modo, setModo] = useState(null); // "assinante" | "teste"
  const [aberto, setAberto] = useState(false);
  const [saindo, setSaindo] = useState(false);
  /* "boas-vindas" → "perfil". O segundo passo é a ficha da imobiliária, que
     alimenta a vitrine; ver PerfilInicialPasso. */
  const [passo, setPasso] = useState("boas-vindas");

  useEffect(() => {
    if (!tenantSlug) return;

    api
      .getTrialStatus(tenantSlug)
      .then((r) => {
        const qual = r?.assinaturaAtiva ? "assinante" : r?.emTrial ? "teste" : null;
        if (!qual) { aoResolver?.(); return; }
        try {
          if (localStorage.getItem(chaveVisto(tenantSlug, qual))) { aoResolver?.(); return; }
        } catch {
          /* navegador sem storage: mostra, e no pior caso mostra de novo */
        }
        setDados(r);
        setModo(qual);
        setAberto(true);
      })
      .catch(() => { aoResolver?.(); });
  }, [tenantSlug]);

  useEffect(() => {
    if (!aberto) return undefined;
    function aoTeclar(e) {
      // No passo do perfil o Esc não fecha: há texto digitado em jogo, e as
      // saídas explícitas ("Preencher depois") continuam à mão.
      if (e.key === "Escape" && passo !== "perfil") fechar();
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto, passo]);

  if (!aberto || !dados) return null;

  function fechar() {
    if (saindo) return; // clique duplo não deve reiniciar a saída
    try {
      localStorage.setItem(chaveVisto(tenantSlug, modo), "1");
    } catch {
      /* sem storage o modal volta na próxima entrada — aceitável */
    }
    /* Desmonta só depois da animação. Tirar do DOM na hora cortaria o
       fechamento pela metade — o elemento sumiria antes de terminar. */
    setSaindo(true);
    setTimeout(() => { setAberto(false); aoResolver?.(); }, SAIDA_MS);
  }

  const info = PLANOS.find((p) => p.key === dados.plano);
  const liberados = [
    "Imóveis, vitrine, leads, clientes e equipe sem limite de uso",
    info?.redes && "Publicação em Facebook, Instagram e WhatsApp",
    info?.tour360 && "Tour virtual 360° nos imóveis",
    info?.ia && "Descrição, título e legendas gerados por IA",
  ].filter(Boolean);

  const valor = dados.valorMensal
    ? `R$ ${Number(dados.valorMensal).toFixed(2).replace(".", ",")}/mês`
    : null;

  const ehTeste = modo === "teste";
  const dias = dados.diasRestantes;
  const prazo =
    dias == null
      ? null
      : dias === 0
        ? "menos de um dia"
        : `${dias} ${dias === 1 ? "dia" : "dias"}`;

  return (
    /* O FUNDO NÃO FECHA NADA, em passo nenhum.

       Ele fechava, e no segundo passo isso apagava a ficha inteira que a pessoa
       tinha acabado de digitar — um clique fora por engano custando dez campos.
       Condicionar ao passo resolveria o caso grave e deixaria a armadilha de pé
       para o dia em que alguém acrescentasse outro formulário aqui. Tirar de vez
       é mais simples e não custa nada: sair continua sendo o botão, que está
       sempre visível. */
    <div className={`bv-veu${saindo ? " is-saindo" : ""}`}>
      <style>{`${CSS}
${PERFIL_INICIAL_CSS}`}</style>
      <div className={`bv-caixa${saindo ? " is-saindo" : ""}`} role="dialog" aria-modal="true" aria-labelledby="bv-titulo">
        {passo === "perfil" ? (
          <>
            <span className="bv-eyebrow bv-eyebrow--teste">● PASSO 2 DE 2</span>
            <h2 id="bv-titulo" className="bv-titulo bv-titulo--perfil">A ficha da sua imobiliária</h2>
            <p className="bv-texto bv-texto--fraco bv-texto--perfil">
              É o que a sua vitrine mostra para quem chega de fora. Já trouxemos o que você
              informou ao pedir o teste — confira e complete o que faltar.
            </p>
            <PerfilInicialPasso
              tenantSlug={tenantSlug}
              aoConcluir={(campos) => { aoAtualizarTenant?.(campos); fechar(); }}
              aoPular={fechar}
            />
          </>
        ) : (
        <>
        <span className={`bv-selo${ehTeste ? " bv-selo--teste" : " bv-selo--festa"}`} aria-hidden="true">
          {ehTeste ? <IconeEstrela size={24} /> : <IconeCheck size={26} />}
        </span>
        <span className={`bv-eyebrow${ehTeste ? " bv-eyebrow--teste" : ""}`}>
          {ehTeste ? "● TESTE GRÁTIS" : "● ASSINATURA ATIVA"}
        </span>
        <h2 id="bv-titulo" className="bv-titulo">
          {ehTeste
            ? `Bem-vindo ao seu teste, ${dados.nomeTenant}`
            : `Bem-vindo à Domus, ${dados.nomeTenant}`}
        </h2>

        {ehTeste ? (
          <>
            <p className="bv-texto">
              Seu ambiente está no <strong>plano {info?.nome || dados.plano}</strong>, limpo e só
              seu — sem anúncio de mentira para apagar depois. Mexa à vontade: cadastre, apague,
              monte a vitrine do seu jeito.
            </p>

            {prazo ? (
              <div className="bv-prazo">
                <span className="bv-prazo__num">{prazo}</span>
                <span className="bv-prazo__txt">
                  é o que resta do seu teste
                  {dados.expiraEm ? (
                    <> · até {new Date(dados.expiraEm).toLocaleDateString("pt-BR")}</>
                  ) : null}
                </span>
              </div>
            ) : null}

            <p className="bv-texto bv-texto--fraco">Enquanto testa, você tem:</p>
            <ul className="bv-lista">
              {liberados.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>

            <p className="bv-texto bv-texto--fraco">
              Tudo que você criar aqui fica salvo. Se decidir assinar, o mesmo ambiente continua —
              nada se perde, só deixa de ser teste.
            </p>
          </>
        ) : (
          <>
            <p className="bv-texto">
              Obrigado por assinar! Sua conta está ativa no plano{" "}
              <strong>{info?.nome || dados.plano}</strong>
              {valor ? <> · {valor}</> : null}. Daqui em diante é só usar — sem prazo correndo contra
              você.
            </p>

            {dados.proximaCobranca || dados.expiraEm ? (
              <p className="bv-texto bv-texto--fraco">
                Próxima cobrança em{" "}
                <strong>
                  {new Date(dados.proximaCobranca || dados.expiraEm).toLocaleDateString("pt-BR")}
                </strong>
                , mensal e automática.
              </p>
            ) : null}

            <p className="bv-texto bv-texto--fraco">O que seu plano libera:</p>
            <ul className="bv-lista">
              {liberados.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>

            <p className="bv-texto bv-texto--fraco">
              Um bom começo: cadastre seu primeiro imóvel e monte a vitrine arrastando os blocos.
            </p>
          </>
        )}

        <button type="button" className="bv-botao" onClick={() => setPasso("perfil")}>
          Continuar
        </button>
        </>
        )}
      </div>

      {/* Depois da caixa no DOM, então voa por cima dela. Sem eventos: é
          enfeite, e não pode roubar o clique do botão que está embaixo.
          Some sozinho quando as animações terminam — nada em laço. */}
      {ehTeste ? null : (
        <div className="bv-confete" aria-hidden="true">
          {CONFETES.map((c, i) => (
            <span
              key={i}
              style={{
                left: `${c.x}%`,
                "--dx": `${c.dx}px`,
                "--alto": `${c.alto}vh`,
                "--giro": `${c.giro}deg`,
                "--atraso": `${c.ms}ms`,
              }}
            >
              <Confete forma={c.forma} cor={c.cor} tam={c.tam} />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const CSS = `
.bv-veu {
  position: fixed; inset: 0; z-index: 9997; display: grid; place-items: center; padding: 24px;
  background: rgba(5,5,7,0.74);
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  animation: bvVeu 0.24s ease both;
  font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;
}
@keyframes bvVeu { from { opacity: 0; } to { opacity: 1; } }
.bv-veu.is-saindo { animation: bvVeuSai 260ms ease both; pointer-events: none; }
@keyframes bvVeuSai { to { opacity: 0; } }

.bv-caixa {
  width: min(500px, 100%); max-height: calc(100vh - 48px); overflow-y: auto;
  transition: width 0.32s cubic-bezier(0.22, 1, 0.36, 1);
  background: #141821; border: 1px solid rgba(255,255,255,0.10); border-radius: 18px;
  padding: 30px 30px 26px; text-align: center;
  display: grid; justify-items: center;
  box-shadow: 0 30px 70px -24px rgba(0,0,0,0.9);
  animation: bvCaixa 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes bvCaixa {
  from { opacity: 0; transform: translateY(14px) scale(0.98); }
  to { opacity: 1; transform: none; }
}
/* Sai encolhendo e descendo de leve — o inverso da entrada, para o fechamento
   parecer o mesmo movimento ao contrário e não um corte seco. */
.bv-caixa.is-saindo { animation: bvCaixaSai 260ms cubic-bezier(0.4, 0, 1, 1) both; }
@keyframes bvCaixaSai {
  from { opacity: 1; transform: none; }
  to { opacity: 0; transform: translateY(10px) scale(0.96); }
}

.bv-selo {
  width: 58px; height: 58px; border-radius: 999px; display: grid; place-items: center;
  margin-bottom: 14px; font-size: 26px; color: #34d399;
  background: rgba(16,185,129,0.14); border: 1px solid rgba(16,185,129,0.45);
  animation: bvSelo 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes bvSelo {
  from { opacity: 0; transform: scale(0.5); }
  60% { transform: scale(1.08); }
  to { opacity: 1; transform: scale(1); }
}

.bv-selo--teste { color: #d4af37; background: rgba(212,175,55,0.14); border-color: rgba(212,175,55,0.45); }

/* Assinante: o selo entra e ainda dá dois pulinhos, no compasso da primeira
   levada de confete. A animação é encadeada (pop, depois pulo) em vez de uma
   só com muitos passos — assim cada trecho tem a sua curva. */
.bv-selo--festa {
  position: relative; /* âncora do anel abaixo */
  animation:
    bvSelo 0.5s cubic-bezier(0.22, 1, 0.36, 1) both,
    bvPulo 0.62s cubic-bezier(0.3, 0.9, 0.4, 1) 0.5s 2 both;
}
@keyframes bvPulo {
  0%, 100% { transform: translateY(0) scale(1); }
  28% { transform: translateY(-13px) scale(1.06); }
  55% { transform: translateY(0) scale(0.94); }
  74% { transform: translateY(-4px) scale(1.02); }
}

/* Anel de festa saindo do selo, uma vez só: dá o "estouro" no instante em que
   o confete parte, sem custar mais um elemento no JSX. */
.bv-selo--festa::after {
  content: ""; position: absolute; inset: 0; border-radius: 999px;
  border: 2px solid rgba(52,211,153,0.75); pointer-events: none;
  animation: bvAnel 0.9s ease-out 0.22s both;
}
@keyframes bvAnel {
  from { opacity: 0.9; scale: 1; }
  to { opacity: 0; scale: 2.4; }
}

/* Confete: cada emoji é arremessado do rodapé numa parábola — sobe girando,
   deriva para o lado e cai apagando. O fill "both" segura o quadro final, que
   é invisível: a camada fica no DOM sem nada aparecendo depois que passa. */
.bv-confete {
  position: fixed; inset: 0; overflow: hidden; pointer-events: none; z-index: 2;
}
.bv-confete span {
  position: absolute; bottom: -60px; display: block; line-height: 1;
  will-change: transform, opacity;
  animation: bvConfete 2.7s cubic-bezier(0.15, 0.72, 0.4, 1) var(--atraso) both;
}
@keyframes bvConfete {
  0% { opacity: 0; transform: translate3d(0, 0, 0) rotate(0deg) scale(0.4); }
  9% { opacity: 1; }
  46% {
    transform: translate3d(calc(var(--dx) * 0.65), calc(var(--alto) * -1), 0)
               rotate(var(--giro)) scale(1);
  }
  72% { opacity: 1; }
  100% {
    opacity: 0;
    transform: translate3d(var(--dx), 14vh, 0) rotate(calc(var(--giro) * 1.9)) scale(0.82);
  }
}

/* O prazo em destaque: é a informação que a pessoa vai querer lembrar. */
.bv-prazo {
  width: 100%; margin: 2px 0 16px; padding: 14px 16px; border-radius: 12px;
  background: rgba(212,175,55,0.09); border: 1px solid rgba(212,175,55,0.26);
  display: grid; gap: 3px;
}
.bv-prazo__num { font-size: 19px; font-weight: 700; color: #e8d79b; letter-spacing: -0.02em; }
.bv-prazo__txt { font-size: 12px; color: #94a3b8; line-height: 1.5; }

.bv-eyebrow {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 9.5px; letter-spacing: 0.14em; text-transform: uppercase; color: #34d399;
  margin-bottom: 10px;
}
/* Depois da regra base de propósito: mesma especificidade, então quem vem por
   último vence — invertido, o dourado do teste perdia para o verde. */
.bv-eyebrow--teste { color: #d4af37; }
.bv-titulo {
  margin: 0 0 10px; font-size: 21px; font-weight: 700; letter-spacing: -0.02em;
  color: #f1f5f9; line-height: 1.28;
}

/* Passo do perfil: a caixa cresce para caber a grade de dois campos por linha,
   e o conteúdo desencosta do centro — formulário centralizado é ilegível. */
.bv-caixa:has(.pi-corpo), .bv-caixa:has(.pi-carregando) {
  width: min(680px, 100%); justify-items: stretch; text-align: left;
}
.bv-titulo--perfil, .bv-texto--perfil { text-align: left; width: 100%; }
.bv-texto--perfil { margin-bottom: 18px; }
.bv-texto { margin: 0 0 14px; font-size: 13.5px; line-height: 1.68; color: #94a3b8; }
.bv-texto strong { color: #f1f5f9; font-weight: 600; }
.bv-texto--fraco { font-size: 12.5px; color: #64748b; }

.bv-lista {
  list-style: none; width: 100%; margin: 0 0 16px; padding: 0;
  display: grid; gap: 7px; text-align: left;
}
.bv-lista li {
  position: relative; padding-left: 20px; font-size: 12.5px; line-height: 1.55; color: #cbd5e1;
}
.bv-lista li::before {
  content: "✓"; position: absolute; left: 0; color: #34d399; font-size: 11px; font-weight: 700;
}

.ds-shell .bv-botao, .bv-botao {
  width: auto; padding: 11px 22px; border-radius: 999px; cursor: pointer;
  font-family: inherit; font-size: 13px; font-weight: 600;
  background: #f1f5f9; border: 1px solid #f1f5f9; color: #0c0f1a;
  box-shadow: none; transform: none;
  transition: background 0.18s ease;
}
.bv-botao:hover { background: #fff; color: #0c0f1a; box-shadow: none; transform: none; }
.bv-botao:active { scale: 1; }

@media (prefers-reduced-motion: reduce) {
  .bv-veu, .bv-caixa, .bv-selo, .bv-selo--festa { animation: none; }
  /* Festa é justamente o tipo de movimento que quem pediu menos não quer:
     sai inteira, não fica uma versão parada dela na tela. */
  .bv-confete, .bv-selo--festa::after { display: none; }
  /* Sem percurso, mas ainda com esmaecimento: sumir de estalo desorienta. */
  .bv-veu.is-saindo, .bv-caixa.is-saindo { animation: bvVeuSai 160ms ease both; }
}
`;

export default BoasVindasModal;
