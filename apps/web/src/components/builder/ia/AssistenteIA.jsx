import { useEffect, useRef, useState } from "react";
import { Sparkle, StopCircle, ArrowUp, Lock } from "@phosphor-icons/react";

/* ────────────────────────────────────────────────────────────────────────────
   O painel do assistente.

   Uma caixa de texto e uma lista de passos. A lista é o ponto: enquanto o robô
   trabalha, cada passo aparece com o MOTIVO em português — "aproximei os
   destaques do título" —, e é isso que transforma peças pulando pela tela em
   algo que a pessoa entende e consegue julgar.

   ── SUGESTÕES EM VEZ DE UMA CAIXA VAZIA ──

   Caixa de texto vazia com "o que você quer?" é o modo mais eficiente de fazer
   alguém não usar um recurso. Os atalhos abaixo são pedidos reais, escritos como
   um dono de imobiliária escreveria, e servem de exemplo do que dá para pedir.
   ──────────────────────────────────────────────────────────────────────────── */

const SUGESTOES = [
  "Deixe minha página com cara de imobiliária de alto padrão",
  "Organize tudo, está bagunçado",
  "Quero um visual mais clean e claro",
  "Adicione uma seção de depoimentos e uma de perguntas frequentes",
  "Aproxime as coisas, tem espaço demais sobrando",
];

function Bloqueado({ aoAssinar }) {
  return (
    <div className="ia-bloqueio">
      <span className="ia-bloqueio__selo"><Lock size={13} weight="fill" /> Premium</span>
      <h4>Um assistente que arruma a vitrine para você</h4>
      <p>
        Peça em português — “deixe com cara de alto padrão”, “organize isso aqui” — e
        veja as peças se reposicionarem na tela, uma a uma. Você acompanha cada mudança e
        pode desfazer tudo com um Ctrl+Z.
      </p>
      <button type="button" onClick={aoAssinar}>Conhecer o Premium</button>
    </div>
  );
}

export function AssistenteIA({ liberado, assistente, aoAssinar }) {
  const { estado, erro, plano, passo, feitos, pedir, parar } = assistente;
  const [texto, setTexto] = useState("");
  const listaRef = useRef(null);

  const ocupado = estado !== "parado";

  // A lista cresce durante a execução; sem isto o passo atual sai da vista.
  useEffect(() => {
    listaRef.current?.scrollTo({ top: listaRef.current.scrollHeight, behavior: "smooth" });
  }, [feitos.length, passo]);

  if (!liberado) return <Bloqueado aoAssinar={aoAssinar} />;

  function enviar(e) {
    e?.preventDefault();
    const pedido = texto.trim();
    if (!pedido || ocupado) return;
    pedir(pedido);
    setTexto("");
  }

  const operacoes = plano?.operacoes || [];

  return (
    <div className="ia-painel">
      <form className="ia-caixa" onSubmit={enviar}>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) enviar(e); }}
          placeholder="O que você quer que eu faça na sua vitrine?"
          rows={2}
          disabled={ocupado}
          aria-label="Pedido para o assistente"
        />
        {ocupado ? (
          <button type="button" className="ia-enviar ia-enviar--parar" onClick={parar} title="Parar">
            <StopCircle size={17} weight="fill" />
          </button>
        ) : (
          <button type="submit" className="ia-enviar" disabled={!texto.trim()} title="Enviar (Enter)">
            <ArrowUp size={16} weight="bold" />
          </button>
        )}
      </form>

      {!ocupado && !plano ? (
        <div className="ia-sugestoes">
          {SUGESTOES.map((s) => (
            <button key={s} type="button" onClick={() => { setTexto(s); }}>{s}</button>
          ))}
        </div>
      ) : null}

      {estado === "pensando" ? (
        <p className="ia-pensando">
          <Sparkle size={14} weight="fill" /> Olhando a sua vitrine…
        </p>
      ) : null}

      {erro ? <p className="ia-erro">{erro}</p> : null}

      {plano?.resumo ? <p className="ia-resumo">{plano.resumo}</p> : null}

      {operacoes.length ? (
        <ol className="ia-passos" ref={listaRef}>
          {operacoes.map((op, i) => {
            const feito = i < feitos.length;
            const agora = i === passo;
            return (
              <li key={i} className={`ia-passo${feito ? " is-feito" : ""}${agora ? " is-agora" : ""}`}>
                <span className="ia-passo__marca" aria-hidden="true" />
                <span className="ia-passo__texto">{op.motivo || op.acao}</span>
              </li>
            );
          })}
        </ol>
      ) : null}

      {plano && !operacoes.length && !erro ? (
        <p className="ia-vazio">
          Não achei o que mudar com esse pedido. Tente dizer o que te incomoda hoje —
          “o rodapé está muito longe”, “quero mais destaque nos imóveis”.
        </p>
      ) : null}

      {estado === "executando" ? (
        <p className="ia-nota">Pode parar quando quiser. Ctrl+Z desfaz tudo de uma vez.</p>
      ) : null}
    </div>
  );
}
