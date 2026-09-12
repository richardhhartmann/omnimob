import { useState } from "react";
import { api } from "../api";
import { SelectCustom } from "./SelectCustom.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   Atendimento do lead: estágio, responsável e histórico.

   Até aqui a tela de leads era uma caixa de entrada — nome, telefone, mensagem
   — e nada dizia se alguém já tinha ligado. Em equipe, isso significa contato
   que esfria enquanto cada um supõe que o outro atendeu.

   Os três controles ficam DENTRO do cartão do lead, e não numa tela de detalhe,
   porque atender é uma sequência rápida: olhar, mover, anotar, ir para o
   próximo. Abrir uma página por lead cobraria dois cliques a cada passo dessa
   sequência.

   O histórico começa recolhido: ele importa quando alguém pergunta "o que já
   foi feito?", e essa pergunta é rara comparada a "quem é o próximo".
   ──────────────────────────────────────────────────────────────────────────── */

/* A ordem é a do funil, e a cor é o quanto o negócio avançou — do cinza de
   "chegou agora" ao verde de "fechou". PERDIDO sai da escala de propósito: não
   é um estágio pior, é a saída por baixo, e pintá-lo de vermelho-escuro dentro
   da mesma régua faria parecer que ele vem depois de GANHO. */
export const ESTAGIOS = [
  { valor: "NOVO",           rotulo: "Novo",           cor: "#94a3b8" },
  { valor: "EM_ATENDIMENTO", rotulo: "Em atendimento", cor: "#38bdf8" },
  { valor: "VISITA",         rotulo: "Visita",         cor: "#a78bfa" },
  { valor: "PROPOSTA",       rotulo: "Proposta",       cor: "#fbbf24" },
  { valor: "GANHO",          rotulo: "Ganho",          cor: "#10b981" },
  { valor: "PERDIDO",        rotulo: "Perdido",        cor: "#f87171" },
];

/* Os motivos de perda mais comuns numa imobiliária. Lista fechada na tela e
   texto livre no banco: o relatório agrupa pelo texto, e uma lista fechada é o
   que impede "preço" e "Preço alto" virarem duas barras. "Outro" abre um campo
   — e é o texto digitado que vai, não a palavra "Outro". */
export const MOTIVOS_PERDA = [
  "Preço acima do orçamento",
  "Fechou com outra imobiliária",
  "Desistiu da busca",
  "Não respondeu mais",
  "Imóvel já foi negociado",
  "Não aprovou financiamento",
  "Outro",
];

export const corDoEstagio = (v) => ESTAGIOS.find((e) => e.valor === v)?.cor || "#94a3b8";
export const rotuloDoEstagio = (v) => ESTAGIOS.find((e) => e.valor === v)?.rotulo || v;

const TIPO_EVENTO = {
  CRIADO: "Chegou",
  ESTAGIO: "Mudou de estágio",
  RESPONSAVEL: "Responsável",
  NOTA: "Nota",
  CONTATO: "Contato",
};

function quando(iso) {
  const d = new Date(iso);
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  if (min < 1440) return `há ${Math.floor(min / 60)}h`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function textoDoEvento(ev) {
  if (ev.tipo === "ESTAGIO") {
    const passo = `${rotuloDoEstagio(ev.de)} → ${rotuloDoEstagio(ev.para)}`;
    /* O motivo da perda viaja no texto do evento: é o que faz o histórico
       continuar contando por que se perdeu mesmo depois de o lead voltar. */
    return ev.para === "PERDIDO" && ev.texto ? `${passo} · ${ev.texto}` : passo;
  }
  if (ev.tipo === "RESPONSAVEL") {
    if (!ev.para) return "Devolvido à caixa comum";
    return ev.de ? `${ev.de} → ${ev.para}` : `Atribuído a ${ev.para}`;
  }
  return ev.texto || "";
}

export function LeadAtendimento({ lead, equipe, tenantSlug, aoAtualizar, showToast }) {
  const [salvando, setSalvando] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [nota, setNota] = useState("");
  const [enviandoNota, setEnviandoNota] = useState(false);
  /* Perder pede o motivo antes de gravar. O formulário abre no lugar, sob o
     funil, e só existe enquanto a decisão está sendo tomada. */
  const [perdendo, setPerdendo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [motivoOutro, setMotivoOutro] = useState("");

  const eventos = lead.eventos || [];
  const totalEventos = lead._count?.eventos ?? eventos.length;

  async function mudar(campos) {
    setSalvando(true);
    try {
      const atualizado = await api.atualizarLead(tenantSlug, lead.id, campos);
      aoAtualizar(atualizado);
      setPerdendo(false);
      setMotivo("");
      setMotivoOutro("");
    } catch (erro) {
      showToast?.(erro.message, "error");
    } finally {
      setSalvando(false);
    }
  }

  function escolherEstagio(valor) {
    if (valor === "PERDIDO") {
      setPerdendo(true);
      return;
    }
    setPerdendo(false);
    mudar({ estagio: valor });
  }

  function confirmarPerda(e) {
    e.preventDefault();
    const texto = motivo === "Outro" ? motivoOutro.trim() : motivo;
    if (!texto) return;
    mudar({ estagio: "PERDIDO", motivoPerda: texto });
  }

  async function abrirHistorico() {
    const proximo = !aberto;
    setAberto(proximo);
    /* A lista traz só a CONTAGEM de eventos; o conteúdo vem quando alguém pede.
       Carregar o histórico de cem leads para mostrar zero deles seria pagar
       adiantado por uma pergunta que quase nunca é feita. */
    if (proximo && !lead.eventos) {
      try {
        aoAtualizar(await api.obterLead(tenantSlug, lead.id));
      } catch (erro) {
        showToast?.(erro.message, "error");
      }
    }
  }

  async function salvarNota(e) {
    e.preventDefault();
    const texto = nota.trim();
    if (!texto) return;
    setEnviandoNota(true);
    try {
      const atualizado = await api.anotarLead(tenantSlug, lead.id, texto);
      aoAtualizar({ ...lead, ...atualizado });
      setNota("");
    } catch (erro) {
      showToast?.(erro.message, "error");
    } finally {
      setEnviandoNota(false);
    }
  }

  return (
    <div className="lead-atend">
      {/* ── Funil ── */}
      <div className="lead-funil" role="group" aria-label="Estágio do atendimento">
        {ESTAGIOS.map((e) => {
          const ativo = lead.estagio === e.valor;
          return (
            <button
              key={e.valor}
              type="button"
              className={`lead-funil__passo${ativo ? " is-ativo" : ""}`}
              style={ativo ? { "--cor": e.cor } : undefined}
              disabled={salvando}
              aria-pressed={ativo}
              onClick={() => !ativo && escolherEstagio(e.valor)}
            >
              {e.rotulo}
            </button>
          );
        })}
      </div>

      {perdendo ? (
        <form className="lead-perda" onSubmit={confirmarPerda}>
          <span className="lead-perda__titulo">Por que este lead foi perdido?</span>
          <div className="lead-perda__opcoes" role="radiogroup" aria-label="Motivo da perda">
            {MOTIVOS_PERDA.map((m) => (
              <button
                key={m}
                type="button"
                className={`lead-perda__opcao${motivo === m ? " is-ativo" : ""}`}
                aria-pressed={motivo === m}
                onClick={() => setMotivo(m)}
              >
                {m}
              </button>
            ))}
          </div>
          {motivo === "Outro" ? (
            <input
              autoFocus
              value={motivoOutro}
              onChange={(e) => setMotivoOutro(e.target.value)}
              placeholder="Descreva em poucas palavras"
              maxLength={120}
            />
          ) : null}
          <div className="lead-perda__acoes">
            <button type="button" className="lead-perda__cancelar" onClick={() => { setPerdendo(false); setMotivo(""); setMotivoOutro(""); }}>
              Cancelar
            </button>
            <button
              type="submit"
              className="lead-perda__confirmar"
              disabled={salvando || !motivo || (motivo === "Outro" && !motivoOutro.trim())}
            >
              {salvando ? "Salvando…" : "Marcar como perdido"}
            </button>
          </div>
        </form>
      ) : null}

      <div className="lead-atend__linha">
        {/* ── Responsável ── */}
        <SelectCustom
          value={lead.responsavelId || ""}
          placeholder="Sem responsável"
          style={{ minWidth: "190px" }}
          disabled={salvando}
          options={[
            { value: "", label: "Sem responsável" },
            ...(equipe || []).map((u) => ({ value: u.id, label: u.nome })),
          ]}
          onChange={(v) => mudar({ responsavelId: v || null })}
        />

        <button type="button" className="lead-hist__botao" onClick={abrirHistorico} aria-expanded={aberto}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          Histórico{totalEventos ? ` (${totalEventos})` : ""}
        </button>

        {lead.primeiroContatoEm ? (
          <span className="lead-atend__marca" title={new Date(lead.primeiroContatoEm).toLocaleString("pt-BR")}>
            1º contato {quando(lead.primeiroContatoEm)}
          </span>
        ) : (
          <span className="lead-atend__marca lead-atend__marca--alerta">Ainda sem contato</span>
        )}
      </div>

      {/* ── Histórico ── */}
      {aberto ? (
        <div className="lead-hist">
          <form className="lead-hist__form" onSubmit={salvarNota}>
            <input
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Liguei, pediu para retornar sábado…"
              maxLength={2000}
            />
            <button type="submit" disabled={enviandoNota || !nota.trim()}>
              {enviandoNota ? "Salvando…" : "Anotar"}
            </button>
          </form>

          {eventos.length === 0 ? (
            <p className="lead-hist__vazio">Sem registros ainda.</p>
          ) : (
            <ul className="lead-hist__lista">
              {eventos.map((ev) => (
                <li key={ev.id}>
                  <span
                    className="lead-hist__ponto"
                    style={{ background: ev.tipo === "ESTAGIO" ? corDoEstagio(ev.para) : "#64748b" }}
                    aria-hidden="true"
                  />
                  <span className="lead-hist__tipo">{TIPO_EVENTO[ev.tipo] || ev.tipo}</span>
                  <span className="lead-hist__texto">{textoDoEvento(ev)}</span>
                  <span className="lead-hist__meta">
                    {ev.usuarioNome ? `${ev.usuarioNome} · ` : ""}
                    {quando(ev.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
