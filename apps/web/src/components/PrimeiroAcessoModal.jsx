/* ────────────────────────────────────────────────────────────────────────────
   Boas-vindas do PRIMEIRO ACESSO — de qualquer pessoa da equipe.

   Não confundir com [BoasVindasModal]: aquele é sobre a CONTA (assinou, está
   em teste, quanto falta do prazo) e só faz sentido para quem contratou; este é
   sobre a PESSOA que acabou de entrar pela primeira vez, e aparece para o
   corretor recém-cadastrado igual aparece para o dono. Por isso são dois
   componentes e não um com bandeirinha: o público, a mensagem e o momento são
   diferentes, e o desfecho deste aqui é abrir um tour, não fechar um aviso.

   Ordem quando os dois cabem no mesmo acesso (o admin que acabou de pagar):
   primeiro o da assinatura, depois este. Quem orquestra é o AdminLayout — ver
   o `esperando` lá.
   ──────────────────────────────────────────────────────────────────────────── */

import { IconeBussola } from "./Icones.jsx";

/* ── A promessa da primeira linha ────────────────────────────────────────────

   `totalPassos` já vem contado a partir do fluxo FILTRADO pelo cargo (ver
   `montarFluxoTour`): um cargo que só abre duas telas tem um tour de oito
   paradas, e é oito que a pessoa lê aqui. O mesmo número aparece no contador do
   tour (`tg-contador`), porque os dois somam o mesmo fluxo.

   O que faltava era o resto da frase acompanhar. "Menos de dois minutos" era
   fixo, e a mesma promessa cobria um tour de cinco paradas e um de vinte e
   quatro — uma delas está errada, e é sempre a de quem tem menos telas: ela
   ouve que vai levar o dobro do que leva. Prometer POR BAIXO é o único erro
   aceitável dos dois. */
function duracao(passos) {
  if (!passos || passos <= 8) return "menos de um minuto";
  if (passos <= 16) return "menos de dois minutos";
  return "menos de três minutos";
}

export function PrimeiroAcessoModal({ nome, tenantName, totalPassos, aoComecar, aoPular }) {
  const primeiroNome = (nome || "").split(" ")[0];

  /* O singular existe por higiene, não por um caso que se veja hoje: o menor
     tour possível tem cinco paradas (o Dashboard, que todo cargo abre, mais o
     fecho). Uma etapa nova mais enxuta muda isso sem avisar, e "1 paradas
     curtas" é o tipo de erro que só aparece em produção.

     Uma string só, e não texto solto no JSX com a vírgula numa linha à parte:
     ali o JSX junta as linhas com um espaço e o resultado sai "8 paradas
     curtas , menos de um minuto". */
  const paradas =
    totalPassos === 1
      ? "1 parada curta"
      : totalPassos
        ? `${totalPassos} paradas curtas`
        : "Algumas paradas curtas";

  return (
    <div className="pa-veu">
      <style>{PRIMEIRO_ACESSO_CSS}</style>
      <div className="pa-caixa" role="dialog" aria-modal="true" aria-labelledby="pa-titulo">
        <span className="pa-icone" aria-hidden="true"><IconeBussola size={27} /></span>

        <span className="pa-eyebrow">● PRIMEIRO ACESSO</span>
        <h2 id="pa-titulo" className="pa-titulo">
          {primeiroNome ? `Bem-vindo, ${primeiroNome}` : "Bem-vindo à Omnimob"}
        </h2>

        <p className="pa-texto">
          Este é o painel {tenantName ? <>da <strong>{tenantName}</strong></> : "da sua imobiliária"}.
          Preparamos um tour rápido pelas telas — onde ficam os imóveis, os leads, a equipe e a
          vitrine — para você não precisar descobrir sozinho.
        </p>

        <ul className="pa-lista">
          <li>{`${paradas}, ${duracao(totalPassos)}`}</li>
          <li>Dá para voltar, pular ou sair a qualquer momento</li>
          <li>Você pode rever tudo depois, em Configurações</li>
        </ul>

        <button type="button" className="pa-botao pa-botao--primario" onClick={aoComecar}>
          Começar o tour
        </button>
        <button type="button" className="pa-botao pa-botao--fraco" onClick={aoPular}>
          Explorar por conta própria
        </button>
      </div>
    </div>
  );
}

/* ── EXPORTADO, e não privado ─────────────────────────────────────────────────
   O convite do Omnimob Flow ([PrimeiroAcessoFlow]) usa a mesma caixa, o mesmo
   véu e os mesmos botões — é o mesmo tipo de momento, e o desenho já está
   certo. Ele importa esta folha e acrescenta só os desvios de cor do módulo.

   Exportar em vez de copiar porque uma segunda cópia desta folha divergiria no
   primeiro ajuste — que é exatamente o defeito que o editor de vitrine teve
   duas vezes. Os dois modais nunca são montados ao mesmo tempo (um é do
   primeiro acesso ao painel, o outro do primeiro acesso ao módulo), então não
   há risco de a mesma regra entrar duas vezes no documento. */
export const PRIMEIRO_ACESSO_CSS = `
.pa-veu {
  position: fixed; inset: 0; z-index: 99980;
  display: grid; place-items: center; padding: 24px;
  background: rgba(5,7,12,0.76);
  backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px);
  animation: paVeu 0.26s ease both;
  font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;
}
@keyframes paVeu { from { opacity: 0; } to { opacity: 1; } }

.pa-caixa {
  width: min(470px, 100%); max-height: calc(100vh - 48px); overflow-y: auto;
  padding: 30px 30px 24px; border-radius: 20px; text-align: center;
  display: grid; justify-items: center;
  background: #141821; border: 1px solid var(--linha-10, rgba(255,255,255,0.10));
  box-shadow: 0 34px 80px -26px rgba(0,0,0,0.92);
  animation: paCaixa 0.42s cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes paCaixa {
  from { opacity: 0; transform: translateY(16px) scale(0.97); }
  to   { opacity: 1; transform: none; }
}

/* A bússola balança de leve — é o único movimento do modal, e serve para o
   olho cair primeiro nela e só depois no título. */
.pa-icone {
  width: 58px; height: 58px; border-radius: 999px; display: grid; place-items: center;
  margin-bottom: 14px; color: var(--accent-soft, #a5b4fc);
  background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.42);
  animation: paBussola 3.4s ease-in-out 0.5s infinite;
}
@keyframes paBussola {
  0%, 62%, 100% { transform: rotate(0deg); }
  70% { transform: rotate(-13deg); }
  78% { transform: rotate(10deg); }
  86% { transform: rotate(-5deg); }
}

.pa-eyebrow {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 9.5px; letter-spacing: 0.15em; text-transform: uppercase;
  color: #818cf8; margin-bottom: 10px;
}
.pa-titulo {
  margin: 0 0 10px; font-size: 22px; font-weight: 700; letter-spacing: -0.025em;
  color: #f1f5f9; line-height: 1.25;
}
.pa-texto { margin: 0 0 16px; font-size: 13.5px; line-height: 1.7; color: #94a3b8; }
.pa-texto strong { color: #f1f5f9; font-weight: 600; }

.pa-lista {
  list-style: none; width: 100%; margin: 0 0 20px; padding: 0;
  display: grid; gap: 7px; text-align: left;
}
.pa-lista li {
  position: relative; padding-left: 21px; font-size: 12.5px; line-height: 1.55; color: #cbd5e1;
}
.pa-lista li::before {
  color: #818cf8; content: ""; position: absolute; left: 0; top: 0.34em; width: 12px; height: 12px; background-color: currentColor; -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23fff' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cline x1='4' y1='12' x2='19' y2='12'/%3E%3Cpolyline points='12.5 5.5 19 12 12.5 18.5'/%3E%3C/svg%3E") center / contain no-repeat; mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23fff' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cline x1='4' y1='12' x2='19' y2='12'/%3E%3Cpolyline points='12.5 5.5 19 12 12.5 18.5'/%3E%3C/svg%3E") center / contain no-repeat;
}

.pa-caixa .pa-botao {
  width: 100%; padding: 11px 20px; border-radius: 999px; cursor: pointer;
  font-family: inherit; font-size: 13px; font-weight: 600;
  box-shadow: none; transform: none;
  transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
}
.pa-caixa .pa-botao--primario {
  background: #6366f1; border: 1px solid #6366f1; color: #fff;
}
.pa-caixa .pa-botao--primario:hover { background: #818cf8; border-color: #818cf8; color: #fff; box-shadow: none; transform: none; }
.pa-caixa .pa-botao--fraco {
  margin-top: 9px; background: transparent; border: 1px solid transparent; color: #64748b;
}
.pa-caixa .pa-botao--fraco:hover { color: #cbd5e1; background: var(--sup-05, rgba(255,255,255,0.05)); box-shadow: none; transform: none; }
.pa-caixa .pa-botao:active { scale: 0.99; }

@media (prefers-reduced-motion: reduce) {
  .pa-veu, .pa-caixa { animation: none; }
  .pa-icone { animation: none; }
}
`;

export default PrimeiroAcessoModal;
