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
  if (ev.tipo === "ESTAGIO") return `${rotuloDoEstagio(ev.de)} → ${rotuloDoEstagio(ev.para)}`;
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

  const eventos = lead.eventos || [];
  const totalEventos = lead._count?.eventos ?? eventos.length;

  async function mudar(campos) {
    setSalvando(true);
    try {
      const atualizado = await api.atualizarLead(tenantSlug, lead.id, campos);
      aoAtualizar(atualizado);
    } catch (erro) {
      showToast?.(erro.message, "error");
    } finally {
      setSalvando(false);
    }
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
              onClick={() => !ativo && mudar({ estagio: e.valor })}
            >
              {e.rotulo}
            </button>
          );
        })}
      </div>

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
