import { useEffect, useState } from "react";
import { api } from "../api";
import { PLANOS } from "../utils/planos";

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

export function BoasVindasModal({ tenantSlug }) {
  const [dados, setDados] = useState(null);
  const [modo, setModo] = useState(null); // "assinante" | "teste"
  const [aberto, setAberto] = useState(false);
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    if (!tenantSlug) return;

    api
      .getTrialStatus(tenantSlug)
      .then((r) => {
        const qual = r?.assinaturaAtiva ? "assinante" : r?.emTrial ? "teste" : null;
        if (!qual) return;
        try {
          if (localStorage.getItem(chaveVisto(tenantSlug, qual))) return;
        } catch {
          /* navegador sem storage: mostra, e no pior caso mostra de novo */
        }
        setDados(r);
        setModo(qual);
        setAberto(true);
      })
      .catch(() => {});
  }, [tenantSlug]);

  useEffect(() => {
    if (!aberto) return undefined;
    function aoTeclar(e) {
      if (e.key === "Escape") fechar();
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto]);

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
    setTimeout(() => setAberto(false), SAIDA_MS);
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
  const demo = dados.inventario?.imoveis ? null : "com imóveis de exemplo já cadastrados";

  return (
    <div
      className={`bv-veu${saindo ? " is-saindo" : ""}`}
      onMouseDown={(e) => e.target === e.currentTarget && fechar()}
    >
      <style>{CSS}</style>
      <div className={`bv-caixa${saindo ? " is-saindo" : ""}`} role="dialog" aria-modal="true" aria-labelledby="bv-titulo">
        <span className={`bv-selo${ehTeste ? " bv-selo--teste" : ""}`} aria-hidden="true">
          {ehTeste ? "★" : "✓"}
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
              Este é um ambiente de <strong>demonstração completo</strong>, com a plataforma inteira
              liberada {demo || "e imóveis de exemplo para você explorar"}. Mexa à vontade: cadastre,
              apague, monte a vitrine do seu jeito.
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

        <button type="button" className="bv-botao" onClick={fechar}>
          {ehTeste ? "Começar a explorar" : "Começar a usar"}
        </button>
      </div>
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
  .bv-veu, .bv-caixa, .bv-selo { animation: none; }
  /* Sem percurso, mas ainda com esmaecimento: sumir de estalo desorienta. */
  .bv-veu.is-saindo, .bv-caixa.is-saindo { animation: bvVeuSai 160ms ease both; }
}
`;

export default BoasVindasModal;
