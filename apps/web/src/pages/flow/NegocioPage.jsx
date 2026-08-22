import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import {
  ArrowLeft, SealCheck, XCircle, FileText, Paperclip, Trash, CheckCircle,
  Clock, Coins, LockKey,
} from "@phosphor-icons/react";
import { api } from "../../api";
import { uploadToCloudinary } from "../../utils/uploadToCloudinary";
import {
  ESTAGIOS_FLOW, ESTAGIO_PERDIDO, estagioInfo, reais, dataCurta, desdeQuando,
  canalRotulo, TIPOS_DOCUMENTO, STATUS_CONTRATO,
} from "../../utils/flow";
import { ModalTravaDeFechamento } from "../../components/flow/ModalTravaDeFechamento.jsx";
import { PainelDeContrato } from "../../components/flow/PainelDeContrato.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   A FICHA DE UM NEGÓCIO — onde ele de fato é trabalhado.

   Cinco blocos, e a ORDEM é a do processo, não a da importância:

     1. a régua de estágios, no topo, porque é a pergunta "onde estamos"
     2. o que falta para fechar — antes de tudo que se possa fazer
     3. as partes e o imóvel
     4. documentos e as duas validações
     5. contratos, e por último o histórico

   ── O QUE FALTA VEM DO SERVIDOR ──

   `pendencias` chega junto do negócio, calculado pela MESMA função que recusa o
   fechamento (`services/flow/funil.js`). A tela não deduz nada: se ela
   calculasse por conta própria, prometeria "pode fechar" e o servidor recusaria
   por outro motivo — que é o pior desencontro possível numa tela de fechamento.
   ──────────────────────────────────────────────────────────────────────────── */

export function NegocioPage({ session }) {
  const { negocioId } = useParams();
  const tenantSlug = session?.tenant?.slug;
  const cargo = session?.usuario?.cargo;
  const navigate = useNavigate();
  const showToast = useOutletContext()?.showToast;

  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [nota, setNota] = useState("");
  const [trava, setTrava] = useState(null);
  const [enviandoDoc, setEnviandoDoc] = useState(false);

  const carregar = useCallback(() => {
    if (!tenantSlug || !negocioId) return;
    api.obterNegocio(tenantSlug, negocioId)
      .then(setDados)
      .catch((e) => showToast?.(e.message || "Não consegui carregar o negócio.", "error"))
      .finally(() => setCarregando(false));
  }, [tenantSlug, negocioId]);

  useEffect(() => { carregar(); }, [carregar]);

  const n = dados?.negocio;
  const pendencias = dados?.pendencias || [];

  const indiceAtual = useMemo(
    () => ESTAGIOS_FLOW.findIndex((e) => e.key === n?.estagio),
    [n?.estagio],
  );

  async function mover(destino) {
    if (!n || salvando) return;
    let motivo = "";
    if (destino === "PERDIDO") {
      /* O motivo da perda é a informação mais barata de coletar e a mais cara
         de não ter: é ela que responde "estamos perdendo por preço ou por
         demora?" no fim do trimestre. `prompt` é rústico e é o certo aqui — um
         modal com formulário para uma linha de texto adiciona dois cliques a um
         gesto que já é ingrato. */
      motivo = window.prompt("Por que este negócio foi perdido? (opcional)") ?? "";
    }
    setSalvando(true);
    try {
      await api.moverNegocio(tenantSlug, n.id, destino, motivo);
      showToast?.(`Negócio movido para ${rotulo(destino)}.`);
      carregar();
    } catch (erro) {
      const motivos = erro?.body?.motivos;
      if (Array.isArray(motivos) && motivos.length) setTrava({ motivos });
      else showToast?.(erro.message || "Não consegui mover o negócio.", "error");
    } finally {
      setSalvando(false);
    }
  }

  async function validar(setor, aprovado) {
    const nota = aprovado
      ? (window.prompt(`Observação da validação ${setor} (opcional):`) ?? "")
      : (window.prompt(`O que impede a liberação pelo ${setor}?`) ?? "");
    if (!aprovado && !nota.trim()) {
      showToast?.("Diga o que falta — sem isso a ressalva não ajuda ninguém.", "error");
      return;
    }
    try {
      await api.validarNegocio(tenantSlug, n.id, setor, { aprovado, nota });
      showToast?.(aprovado ? `Validação do ${setor} registrada.` : `Ressalva do ${setor} registrada.`);
      carregar();
    } catch (e) {
      showToast?.(e.message || "Não consegui registrar a validação.", "error");
    }
  }

  async function anexar(arquivo, tipo, refereA) {
    if (!arquivo) return;
    setEnviandoDoc(true);
    try {
      /* Direto do navegador para o Cloudinary, como a foto do imóvel — o
         backend nunca vê o binário. O que sobe para a nossa API é o endereço. */
      const { url } = await uploadToCloudinary(arquivo);
      await api.anexarDocumento(tenantSlug, n.id, {
        tipo, refereA, nome: arquivo.name, url,
        mime: arquivo.type || "", tamanho: arquivo.size,
      });
      showToast?.("Documento anexado.");
      carregar();
    } catch (e) {
      showToast?.(e.message || "Não consegui anexar o documento.", "error");
    } finally {
      setEnviandoDoc(false);
    }
  }

  async function anotar() {
    const texto = nota.trim();
    if (!texto) return;
    try {
      await api.anotarNegocio(tenantSlug, n.id, texto);
      setNota("");
      carregar();
    } catch (e) {
      showToast?.(e.message || "Não consegui gravar a nota.", "error");
    }
  }

  if (carregando) {
    return <div className="skeleton-block" style={{ height: 420, borderRadius: 14 }} />;
  }
  if (!n) {
    return <p style={{ color: "var(--text-muted)" }}>Negócio não encontrado.</p>;
  }

  const info = estagioInfo(n.estagio);
  const podeValidarAlgum = cargo?.validarJuridico || cargo?.validarFinanceiro;

  return (
    <div data-tour="flow-negocio">
      <button type="button" className="flow-voltar" onClick={() => navigate("/flow/funil")}>
        <ArrowLeft size={14} weight="bold" /> Voltar ao funil
      </button>

      <div className="flow-neg-topo">
        <div>
          <span className="flow-neg-codigo">Negócio #{n.codigo}</span>
          <h2 className="flow-neg-titulo">{n.titulo}</h2>
          <p className="flow-neg-sub">
            {canalRotulo(n.canal)}{n.origem ? ` · ${n.origem}` : ""} ·
            criado {desdeQuando(n.createdAt)} ·
            {n.responsavel?.nome ? ` ${n.responsavel.nome}` : " sem responsável"}
          </p>
        </div>
        <div className="flow-neg-valor">
          <span>{n.estagio === "GANHO" ? "Fechado por" : "Proposta"}</span>
          <strong>{reais(n.valorFechado ?? n.valorProposta)}</strong>
        </div>
      </div>

      {/* ── A régua ────────────────────────────────────────────────────────
          Todos os estágios visíveis e clicáveis, inclusive os que já passaram:
          voltar é normal (o cliente sumiu, voltou, mudou de imóvel) e um funil
          que só anda para a frente obriga o corretor a mentir sobre onde o
          negócio está. */}
      <div className="flow-regua" role="group" aria-label="Etapa do negócio">
        {ESTAGIOS_FLOW.map((e, i) => (
          <button
            key={e.key}
            type="button"
            className={`flow-regua__passo${e.key === n.estagio ? " is-atual" : ""}${i < indiceAtual ? " is-passado" : ""}`}
            style={{ "--cor": e.cor }}
            disabled={salvando || !cargo?.gerenciarNegocios}
            onClick={() => mover(e.key)}
            title={e.descricao}
          >
            <span className="flow-regua__bola" />
            <span className="flow-regua__nome">{e.rotulo}</span>
          </button>
        ))}
        {n.estagio !== "PERDIDO" ? (
          <button
            type="button"
            className="flow-regua__perder"
            disabled={salvando || !cargo?.gerenciarNegocios}
            onClick={() => mover("PERDIDO")}
          >
            <XCircle size={13} weight="fill" /> Marcar como perdido
          </button>
        ) : (
          <span className="flow-regua__perdido">
            Perdido{n.perdidoMotivo ? ` — ${n.perdidoMotivo}` : ""}
          </span>
        )}
      </div>

      <ModalTravaDeFechamento
        aberto={Boolean(trava)}
        negocio={n}
        motivos={trava?.motivos || []}
        aoFechar={() => setTrava(null)}
        aoAbrirNegocio={() => setTrava(null)}
      />

      {/* ── O que falta ────────────────────────────────────────────────────
          Some quando não falta nada, e é o certo: um painel verde permanente
          dizendo "tudo em ordem" vira parte do fundo e some da atenção
          justamente quando volta a ter conteúdo. */}
      {pendencias.length && n.estagio !== "GANHO" ? (
        <div className="glass-panel flow-pendencias">
          <span className="flow-pendencias__selo"><LockKey size={16} weight="fill" /></span>
          <div>
            <strong>Para fechar este negócio, ainda falta:</strong>
            <ul>{pendencias.map((m) => <li key={m}>{m}</li>)}</ul>
          </div>
        </div>
      ) : null}

      <div className="flow-neg-grade">
        {/* ── Coluna principal ─────────────────────────────────────────── */}
        <div className="flow-neg-principal">
          {/* Partes e imóvel */}
          <section className="glass-panel flow-bloco">
            <h3>As partes e o imóvel</h3>
            <div className="flow-partes">
              <Parte rotulo="Comprador" cliente={n.comprador} />
              <Parte rotulo="Vendedor" cliente={n.vendedor} />
              <div className="flow-parte">
                <span className="flow-parte__rotulo">Imóvel</span>
                {n.property ? (
                  <>
                    <strong>{n.property.title}</strong>
                    <span>{[n.property.neighborhood, n.property.city].filter(Boolean).join(", ")}</span>
                    <span>{reais(n.property.price)}</span>
                    {!n.property.matricula ? (
                      /* A matrícula é o identificador legal do imóvel e a minuta
                         a cita. Avisar AQUI, e não só na hora de gerar o
                         contrato, é a diferença entre resolver agora e descobrir
                         com o cliente esperando. */
                      <span className="flow-parte__falta">Sem matrícula cadastrada</span>
                    ) : null}
                  </>
                ) : <span className="flow-parte__vazio">Nenhum imóvel vinculado</span>}
              </div>
            </div>
          </section>

          {/* Documentos */}
          <section className="glass-panel flow-bloco" data-tour="flow-documentos">
            <h3>
              Documentos de comprovação
              <span className="flow-bloco__contagem">{n.documentos.length}</span>
            </h3>
            <p className="flow-bloco__nota">
              Os arquivos vão direto para o armazenamento seguro — a nossa API não vê o conteúdo
              deles. Marcar como conferido é atribuição de quem valida o setor.
            </p>

            {n.documentos.length === 0 ? (
              <p className="flow-vazio">Nenhum documento anexado ainda.</p>
            ) : (
              <ul className="flow-docs">
                {n.documentos.map((d) => (
                  <li key={d.id} className={d.verificado ? "is-ok" : ""}>
                    <span className="flow-docs__icone">
                      {d.verificado ? <CheckCircle size={15} weight="fill" /> : <Paperclip size={15} />}
                    </span>
                    <a href={d.url} target="_blank" rel="noreferrer" className="flow-docs__nome">{d.nome}</a>
                    <span className="flow-docs__tipo">
                      {TIPOS_DOCUMENTO.find((t) => t.key === d.tipo)?.rotulo || d.tipo} · {d.refereA}
                    </span>
                    {d.observacao ? <span className="flow-docs__obs">{d.observacao}</span> : null}
                    <span className="flow-docs__acoes">
                      {podeValidarAlgum ? (
                        <button
                          type="button"
                          onClick={async () => {
                            const obs = d.verificado ? null : (window.prompt("Observação (opcional):") ?? "");
                            try {
                              await api.verificarDocumento(tenantSlug, d.id, { verificado: !d.verificado, observacao: obs });
                              carregar();
                            } catch (e) { showToast?.(e.message, "error"); }
                          }}
                        >
                          {d.verificado ? "Desmarcar" : "Conferir"}
                        </button>
                      ) : null}
                      {cargo?.gerenciarNegocios ? (
                        <button
                          type="button"
                          className="is-perigo"
                          onClick={async () => {
                            if (!window.confirm(`Remover "${d.nome}"?`)) return;
                            try { await api.removerDocumento(tenantSlug, d.id); carregar(); }
                            catch (e) { showToast?.(e.message, "error"); }
                          }}
                        ><Trash size={13} /></button>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {cargo?.gerenciarNegocios ? (
              <EnvioDeDocumento enviando={enviandoDoc} aoEnviar={anexar} />
            ) : null}
          </section>

          {/* Contratos */}
          {cargo?.gerenciarContratos ? (
            <PainelDeContrato
              session={session}
              negocio={n}
              aoMudar={carregar}
              showToast={showToast}
            />
          ) : null}

          {/* Histórico */}
          <section className="glass-panel flow-bloco">
            <h3>Histórico</h3>
            {cargo?.gerenciarNegocios ? (
              <div className="flow-nota">
                <textarea
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  placeholder="Registre o que aconteceu: uma ligação, uma visita, o que o cliente pediu…"
                  rows={2}
                />
                <button type="button" className="btn-primary" onClick={anotar} disabled={!nota.trim()}>
                  Anotar
                </button>
              </div>
            ) : null}
            <ol className="flow-historico">
              {n.eventos.map((ev) => (
                <li key={ev.id}>
                  <span className="flow-historico__quando">{dataCurta(ev.createdAt)}</span>
                  <span className="flow-historico__texto">
                    {ev.de && ev.para ? <strong>{ev.de} → {ev.para}</strong> : null}
                    {ev.texto ? <span>{ev.texto}</span> : null}
                    {ev.usuarioNome ? <em>{ev.usuarioNome}</em> : <em>automático</em>}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* ── Coluna lateral ───────────────────────────────────────────── */}
        <aside className="flow-neg-lado">
          {/* As duas travas */}
          <section className="glass-panel flow-bloco" data-tour="flow-validacoes">
            <h3>Conferência interna</h3>
            <CartaoValidacao
              rotulo="Jurídico"
              ok={n.juridicoOk}
              por={n.juridicoPor?.nome}
              em={n.juridicoEm}
              nota={n.juridicoNota}
              pode={cargo?.validarJuridico}
              aoValidar={(v) => validar("juridico", v)}
            />
            <CartaoValidacao
              rotulo="Financeiro"
              ok={n.financeiroOk}
              por={n.financeiroPor?.nome}
              em={n.financeiroEm}
              nota={n.financeiroNota}
              pode={cargo?.validarFinanceiro}
              aoValidar={(v) => validar("financeiro", v)}
            />
            {!podeValidarAlgum ? (
              <p className="flow-bloco__nota">
                Só quem tem a permissão do setor pode marcar estas caixas — é isso que faz a
                conferência valer alguma coisa.
              </p>
            ) : null}
          </section>

          {/* Comissão */}
          {cargo?.verComissoes ? (
            <section className="glass-panel flow-bloco flow-comissao">
              <h3><Coins size={15} weight="fill" /> Comissão</h3>
              {n.comissaoCalculadaEm ? (
                <>
                  <p className="flow-bloco__nota">
                    Congelada em {dataCurta(n.comissaoCalculadaEm)} — mudar a política agora não
                    altera este negócio.
                  </p>
                  <LinhaComissao rotulo="Total" valor={n.comissaoTotal} forte />
                  <LinhaComissao rotulo="Imobiliária" valor={n.comissaoImobiliaria} />
                  <LinhaComissao rotulo={n.responsavel?.nome || "Corretor"} valor={n.comissaoCorretor} />
                </>
              ) : (
                <>
                  <p className="flow-bloco__nota">
                    Prévia sobre {reais(n.valorFechado ?? n.valorProposta)}. O valor definitivo é
                    calculado e congelado quando o negócio for para Ganho.
                  </p>
                  <LinhaComissao rotulo="Total" valor={dados.previaComissao.total} forte previa />
                  <LinhaComissao rotulo="Imobiliária" valor={dados.previaComissao.imobiliaria} previa />
                  <LinhaComissao rotulo={n.responsavel?.nome || "Corretor"} valor={dados.previaComissao.corretor} previa />
                  <p className="flow-comissao__perc">
                    {dados.previaComissao.percentual}% do valor · {dados.previaComissao.percentualCorretor}% para o corretor
                  </p>
                </>
              )}
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function rotulo(key) {
  return [...ESTAGIOS_FLOW, ESTAGIO_PERDIDO].find((e) => e.key === key)?.rotulo || key;
}

function Parte({ rotulo, cliente }) {
  return (
    <div className="flow-parte">
      <span className="flow-parte__rotulo">{rotulo}</span>
      {cliente ? (
        <>
          <strong>{cliente.nome}</strong>
          <span>{cliente.cpf || "sem CPF"}</span>
          <span>{cliente.telefone || cliente.whatsapp || cliente.email || "sem contato"}</span>
          {/* A qualificação é o que a minuta exige. Avisar aqui evita descobrir
              a falta na hora de gerar o contrato. */}
          {!cliente.estadoCivil || !cliente.profissao ? (
            <span className="flow-parte__falta">Qualificação incompleta</span>
          ) : null}
        </>
      ) : <span className="flow-parte__vazio">Não informado</span>}
    </div>
  );
}

function CartaoValidacao({ rotulo, ok, por, em, nota, pode, aoValidar }) {
  return (
    <div className={`flow-valid${ok ? " is-ok" : ""}`}>
      <span className="flow-valid__icone">
        {ok ? <SealCheck size={17} weight="fill" /> : <Clock size={17} />}
      </span>
      <div className="flow-valid__corpo">
        <strong>{rotulo}</strong>
        <span>
          {ok
            ? `Liberado${por ? ` por ${por}` : ""}${em ? ` em ${dataCurta(em)}` : ""}`
            : "Aguardando conferência"}
        </span>
        {nota ? <em>{nota}</em> : null}
      </div>
      {pode ? (
        <button type="button" className="flow-valid__botao" onClick={() => aoValidar(!ok)}>
          {ok ? "Retirar" : "Liberar"}
        </button>
      ) : null}
    </div>
  );
}

function LinhaComissao({ rotulo, valor, forte, previa }) {
  return (
    <div className={`flow-comissao__linha${forte ? " is-forte" : ""}${previa ? " is-previa" : ""}`}>
      <span>{rotulo}</span>
      <strong>{reais(valor)}</strong>
    </div>
  );
}

function EnvioDeDocumento({ enviando, aoEnviar }) {
  const [tipo, setTipo] = useState("RG");
  const [refereA, setRefereA] = useState("comprador");

  return (
    <div className="flow-envio">
      <select value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo do documento">
        {TIPOS_DOCUMENTO.map((t) => <option key={t.key} value={t.key}>{t.rotulo}</option>)}
      </select>
      <select value={refereA} onChange={(e) => setRefereA(e.target.value)} aria-label="De quem é o documento">
        <option value="comprador">do comprador</option>
        <option value="vendedor">do vendedor</option>
        <option value="imovel">do imóvel</option>
      </select>
      <label className={`flow-envio__botao${enviando ? " is-enviando" : ""}`}>
        {enviando ? "Enviando…" : "Anexar arquivo"}
        <input
          type="file"
          accept="image/*,application/pdf"
          disabled={enviando}
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            /* Limpa o input depois de ler: sem isso, anexar o MESMO arquivo
               duas vezes seguidas não dispara `change` na segunda, e a pessoa
               conclui que o botão parou de funcionar. */
            e.target.value = "";
            aoEnviar(arquivo, tipo, refereA);
          }}
        />
      </label>
    </div>
  );
}
