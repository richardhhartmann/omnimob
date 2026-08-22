import { useEffect, useState } from "react";
import { FileText, PaperPlaneTilt, ArrowsClockwise, XCircle, Plus, Trash } from "@phosphor-icons/react";
import { api } from "../../api";
import { STATUS_CONTRATO, PAPEIS_SIGNATARIO, dataCurta } from "../../utils/flow";

/* ────────────────────────────────────────────────────────────────────────────
   O CONTRATO, DENTRO DO NEGÓCIO.

   Fica aqui e não numa tela própria porque contrato não existe sozinho: ele é
   sempre "o contrato DAQUELE negócio", e mandar a pessoa para outra tela no
   meio do fechamento a faria perder de vista o que ainda falta. A tela
   `/flow/contratos` existe para a visão contrária — todos os contratos, quando
   a pergunta é "o que está esperando assinatura".

   ── OS TRÊS ESTADOS DESTE PAINEL ──

     sem contrato    → escolher a minuta e gerar
     rascunho        → revisar o texto, listar quem assina, enviar
     enviado/assinado→ acompanhar, ressincronizar, cancelar

   ── A PRÉVIA ANTES DE GERAR ──

   Gerar é barato e reversível; ENVIAR não é (consome documento no plano do
   cliente e dispara e-mail). Por isso a prévia mostra o texto preenchido e a
   lista de pendências ANTES de qualquer coisa acontecer — é o momento em que
   corrigir um CPF ainda não custa nada.
   ──────────────────────────────────────────────────────────────────────────── */

export function PainelDeContrato({ session, negocio, aoMudar, showToast }) {
  const tenantSlug = session?.tenant?.slug;
  const [modelos, setModelos] = useState([]);
  const [modeloId, setModeloId] = useState("");
  const [previa, setPrevia] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!tenantSlug) return;
    api.listarModelos(tenantSlug)
      .then((r) => {
        const ativos = (r.modelos || []).filter((m) => m.ativo);
        setModelos(ativos);
        if (ativos.length) setModeloId(ativos[0].id);
      })
      .catch(() => {});
  }, [tenantSlug]);

  const contratos = negocio.contratos || [];
  const vivo = contratos.find((c) => c.status !== "CANCELADO" && c.status !== "RECUSADO");

  async function verPrevia() {
    if (!modeloId) return;
    setOcupado(true);
    try {
      setPrevia(await api.previaContrato(tenantSlug, negocio.id, { modeloId }));
    } catch (e) {
      showToast?.(e.message || "Não consegui montar a prévia.", "error");
    } finally { setOcupado(false); }
  }

  async function gerar(forcar = false) {
    setOcupado(true);
    try {
      await api.gerarContrato(tenantSlug, negocio.id, { modeloId, gerarIncompleto: forcar });
      showToast?.("Contrato gerado.");
      setPrevia(null);
      aoMudar();
    } catch (erro) {
      const pend = erro?.body?.pendencias;
      if (Array.isArray(pend) && pend.length) {
        /* A recusa do motor de minutas. Ela vem com a lista de campos e ONDE
           preenchê-los — mostrar isso é o valor inteiro da recusa. Ver
           `services/flow/minutas.js`. */
        setPrevia({ pendencias: pend, texto: null });
        showToast?.("A minuta tem campos sem preencher.", "error");
      } else {
        showToast?.(erro.message || "Não consegui gerar o contrato.", "error");
      }
    } finally { setOcupado(false); }
  }

  return (
    <section className="glass-panel flow-bloco" data-tour="flow-contrato">
      <h3><FileText size={15} weight="fill" /> Contrato</h3>

      {/* ── Nenhum contrato ainda ─────────────────────────────────────────── */}
      {!vivo ? (
        modelos.length === 0 ? (
          <p className="flow-vazio">
            Nenhuma minuta cadastrada ainda. Crie uma em <strong>Modelos de Minuta</strong> — há um
            modelo de compra e venda pronto para começar.
          </p>
        ) : (
          <>
            <div className="flow-gerar">
              <select value={modeloId} onChange={(e) => { setModeloId(e.target.value); setPrevia(null); }}>
                {modelos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
              <button type="button" className="flow-btn-fantasma" onClick={verPrevia} disabled={ocupado}>
                Ver prévia
              </button>
              <button type="button" className="btn-primary" onClick={() => gerar(false)} disabled={ocupado}>
                Gerar contrato
              </button>
            </div>

            {previa?.pendencias?.length ? (
              <div className="flow-pend-minuta">
                <strong>Falta preencher {previa.pendencias.length} campo(s):</strong>
                <ul>
                  {previa.pendencias.map((p) => (
                    <li key={p.chave}>
                      {p.rotulo}
                      {p.onde ? <span> — em {p.onde}</span> : null}
                    </li>
                  ))}
                </ul>
                <p>
                  Marcador sem dado não vira espaço em branco: o contrato não sai. Se a minuta vai
                  para revisão manual antes de assinar, dá para gerar assim mesmo — as lacunas
                  aparecem como <code>[ ... ]</code>.
                </p>
                <button type="button" className="flow-btn-fantasma" onClick={() => gerar(true)} disabled={ocupado}>
                  Gerar com as lacunas marcadas
                </button>
              </div>
            ) : null}

            {previa?.texto ? (
              <pre className="flow-previa">{previa.texto}</pre>
            ) : null}
          </>
        )
      ) : (
        <ContratoVivo
          contrato={vivo}
          negocio={negocio}
          tenantSlug={tenantSlug}
          aoMudar={aoMudar}
          showToast={showToast}
        />
      )}

      {/* Cancelados e recusados ficam listados, encolhidos. Sumir com eles
          apagaria a evidência de que houve uma tentativa anterior — que é
          exatamente o que alguém procura quando pergunta "por que este negócio
          demorou tanto". */}
      {contratos.filter((c) => c !== vivo).length ? (
        <ul className="flow-contratos-velhos">
          {contratos.filter((c) => c !== vivo).map((c) => (
            <li key={c.id}>
              <span>{c.titulo}</span>
              <span style={{ color: STATUS_CONTRATO[c.status]?.cor }}>
                {STATUS_CONTRATO[c.status]?.rotulo || c.status}
              </span>
              <span>{dataCurta(c.updatedAt)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function ContratoVivo({ contrato, negocio, tenantSlug, aoMudar, showToast }) {
  const status = STATUS_CONTRATO[contrato.status] || { rotulo: contrato.status, cor: "#64748b" };
  const [ocupado, setOcupado] = useState(false);
  const [signatarios, setSignatarios] = useState(() => sugerirSignatarios(negocio));
  const [vendoTexto, setVendoTexto] = useState(false);

  const assinados = (contrato.signatarios || []).filter((s) => s.status === "ASSINADO").length;
  const total = (contrato.signatarios || []).length;

  async function enviar() {
    const validos = signatarios.filter((s) => s.nome.trim() && s.email.trim());
    if (!validos.length) {
      showToast?.("Informe ao menos um signatário com nome e e-mail.", "error");
      return;
    }
    if (!window.confirm(
      `Enviar para assinatura de ${validos.length} pessoa(s)? Cada uma vai receber um e-mail agora.`
    )) return;

    setOcupado(true);
    try {
      await api.enviarParaAssinatura(tenantSlug, contrato.id, validos);
      showToast?.("Contrato enviado para assinatura.");
      aoMudar();
    } catch (e) {
      showToast?.(e.message || "Não consegui enviar.", "error");
    } finally { setOcupado(false); }
  }

  async function sincronizar() {
    setOcupado(true);
    try {
      await api.sincronizarContrato(tenantSlug, contrato.id);
      showToast?.("Situação atualizada.");
      aoMudar();
    } catch (e) {
      showToast?.(e.message || "Não consegui falar com o provedor.", "error");
    } finally { setOcupado(false); }
  }

  return (
    <div className="flow-contrato">
      <div className="flow-contrato__topo">
        <div>
          <strong>{contrato.titulo}</strong>
          <span className="flow-contrato__status" style={{ "--cor": status.cor }}>
            {status.rotulo}
            {contrato.status === "PARCIAL" || contrato.status === "ENVIADO"
              ? ` · ${assinados} de ${total}`
              : ""}
          </span>
        </div>
        <div className="flow-contrato__acoes">
          <button type="button" className="flow-btn-fantasma" onClick={() => setVendoTexto((v) => !v)}>
            {vendoTexto ? "Ocultar texto" : "Ver texto"}
          </button>
          {contrato.documentoExterno ? (
            <button type="button" className="flow-btn-fantasma" onClick={sincronizar} disabled={ocupado}>
              <ArrowsClockwise size={13} /> Atualizar
            </button>
          ) : null}
          {contrato.status !== "ASSINADO" ? (
            <button
              type="button"
              className="flow-btn-fantasma is-perigo"
              disabled={ocupado}
              onClick={async () => {
                if (!window.confirm("Cancelar este contrato? Quem já recebeu não poderá mais assinar.")) return;
                try { await api.cancelarContrato(tenantSlug, contrato.id); aoMudar(); }
                catch (e) { showToast?.(e.message, "error"); }
              }}
            ><XCircle size={13} /> Cancelar</button>
          ) : null}
        </div>
      </div>

      {contrato.ultimoErro ? (
        /* A mensagem do provedor, crua. "Erro ao enviar" não diz nada; "saldo de
           documentos esgotado" resolve o problema em um minuto. */
        <p className="flow-contrato__erro">O provedor recusou: {contrato.ultimoErro}</p>
      ) : null}

      {vendoTexto ? <pre className="flow-previa">{contrato.corpo}</pre> : null}

      {contrato.status === "RASCUNHO" ? (
        <>
          <p className="flow-bloco__nota">
            Quem precisa assinar. Os nomes já vêm das partes do negócio — confira os e-mails, porque
            é para eles que o convite vai.
          </p>
          <ul className="flow-signatarios">
            {signatarios.map((s, i) => (
              <li key={i}>
                <input
                  value={s.nome} placeholder="Nome completo"
                  onChange={(e) => setSignatarios((a) => a.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))}
                />
                <input
                  value={s.email} placeholder="e-mail" type="email"
                  onChange={(e) => setSignatarios((a) => a.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))}
                />
                <select
                  value={s.papel}
                  onChange={(e) => setSignatarios((a) => a.map((x, j) => (j === i ? { ...x, papel: e.target.value } : x)))}
                >
                  {PAPEIS_SIGNATARIO.map((p) => <option key={p.key} value={p.key}>{p.rotulo}</option>)}
                </select>
                <button type="button" onClick={() => setSignatarios((a) => a.filter((_, j) => j !== i))}>
                  <Trash size={13} />
                </button>
              </li>
            ))}
          </ul>
          <div className="flow-contrato__rodape">
            <button
              type="button" className="flow-btn-fantasma"
              onClick={() => setSignatarios((a) => [...a, { nome: "", email: "", papel: "TESTEMUNHA" }])}
            ><Plus size={13} /> Outro signatário</button>
            <button type="button" className="btn-primary" onClick={enviar} disabled={ocupado}>
              <PaperPlaneTilt size={14} weight="fill" style={{ marginRight: 6 }} />
              {ocupado ? "Enviando…" : "Enviar para assinatura"}
            </button>
          </div>
        </>
      ) : (
        <ul className="flow-signatarios is-leitura">
          {(contrato.signatarios || []).map((s) => (
            <li key={s.id}>
              <span>{s.nome}</span>
              <span>{s.email}</span>
              <span className={s.status === "ASSINADO" ? "is-ok" : ""}>
                {s.status === "ASSINADO" ? `assinou em ${dataCurta(s.assinadoEm)}` : "aguardando"}
              </span>
            </li>
          ))}
        </ul>
      )}

      {contrato.urlAssinado ? (
        <a className="flow-baixar" href={contrato.urlAssinado} target="_blank" rel="noreferrer">
          Baixar o contrato assinado
        </a>
      ) : null}
    </div>
  );
}

/* As partes do negócio viram a lista inicial de quem assina — o caso comum é
   exatamente esse. Deixar a lista em branco obrigaria a redigitar dados que o
   sistema já tem, no passo mais tenso do processo.

   Só entra quem tem e-mail: signatário sem e-mail é uma linha que o envio vai
   recusar, e oferecê-la pré-preenchida é preparar uma frustração. */
function sugerirSignatarios(negocio) {
  const lista = [];
  if (negocio.comprador?.email) {
    lista.push({ nome: negocio.comprador.nome, email: negocio.comprador.email, papel: "COMPRADOR" });
  }
  if (negocio.vendedor?.email) {
    lista.push({ nome: negocio.vendedor.nome, email: negocio.vendedor.email, papel: "VENDEDOR" });
  }
  return lista.length ? lista : [{ nome: "", email: "", papel: "COMPRADOR" }];
}
