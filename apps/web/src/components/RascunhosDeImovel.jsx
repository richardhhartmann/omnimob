import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Buildings, Camera, Trash, ArrowRight } from "@phosphor-icons/react";
import { Modal } from "./Modal.jsx";
import { api } from "../api";
import { PARAMETRO_RASCUNHO, quandoFoi, rotuloDoRascunho } from "../utils/rascunhoImovel";

/* ────────────────────────────────────────────────────────────────────────────
   OS CADASTROS QUE FICARAM PELA METADE.

   O formulário de imóvel tem quatro etapas e quarenta campos, e sair no meio é
   o comportamento normal, não o acidente: falta a metragem exata, falta o CEP,
   o cliente ligou. Até aqui, sair apagava tudo — e a pessoa ou recomeçava do
   zero, ou não voltava.

   ── POR QUE UM MODAL, E NÃO UMA TELA ──

   Porque a pergunta é "onde parei?", e ela se faz DE PASSAGEM, a caminho de
   outra coisa. Uma rota nova obrigaria a sair de onde se está para descobrir
   que não havia nada — e na maior parte dos dias não há mesmo nada. O modal
   mora no `AdminLayout`, então a pergunta se responde de qualquer tela do
   painel, que é de onde ela costuma surgir.

   ── AS ETAPAS TÊM NOME AQUI TAMBÉM ──

   `ETAPAS` é o espelho de `STEPS`, no `PropertyForm`. Quatro nomes que mudam
   uma vez por ano não justificam um módulo compartilhado, mas justificam o
   comentário: mexeu lá, mexa aqui. Sem eles a linha diria "etapa 2", que não
   ajuda ninguém a lembrar de qual cadastro era.

   ── DESCARTAR PERGUNTA ──

   É a única ação destrutiva da tela, e ela apaga trabalho que a pessoa não vê
   (o rascunho é só um resumo aqui dentro). `window.confirm` e não um segundo
   modal: um modal sobre o outro para uma pergunta de uma linha é cerimônia
   demais — e é o padrão que as outras listas do painel já usam para excluir.
   ────────────────────────────────────────────────────────────────────────── */

const ETAPAS = ["Identificação", "Localização", "Detalhes", "Divulgar"];

export function ModalRascunhosDeImovel({ aberto, aoFechar, tenantSlug, rascunhos, aoMudar, showToast }) {
  const navigate = useNavigate();
  const [removendo, setRemovendo] = useState(null);

  function retomar(r) {
    aoFechar?.();
    navigate(`/imoveis/novo?${PARAMETRO_RASCUNHO}=${encodeURIComponent(r.chave)}`);
  }

  async function descartar(r) {
    const nome = rotuloDoRascunho(r.dados) || "este cadastro";
    if (!window.confirm(`Descartar ${nome}? O que já foi preenchido some, e não há como voltar atrás.`)) return;
    setRemovendo(r.chave);
    try {
      await api.removerRascunhoImovel(tenantSlug, r.chave);
      showToast?.("Cadastro descartado.");
      await aoMudar?.();
    } catch (erro) {
      showToast?.(erro.message || "Não consegui descartar.", "error");
    } finally {
      setRemovendo(null);
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Cadastros em andamento"
      subtitulo="O que você começou e ainda não publicou. Retomar devolve o formulário na etapa em que parou."
      adorno={<Buildings size={20} weight="duotone" />}
      largura={560}
      aoFecharPeloFundo
    >
      {!rascunhos?.length ? (
        <p className="rsc-vazio">
          Nenhum cadastro pela metade. Quando você sair do formulário de imóvel sem publicar, ele
          aparece aqui — e as fotos são a única coisa que precisa ser reenviada.
        </p>
      ) : (
        <ul className="rsc-lista">
          {rascunhos.map((r) => {
            const nome = rotuloDoRascunho(r.dados);
            const etapa = ETAPAS[r.etapa] || ETAPAS[0];
            return (
              <li key={r.chave} className="rsc-item">
                <div className="rsc-item__texto">
                  <strong className={nome ? "" : "is-sem-nome"}>{nome || "Cadastro sem título"}</strong>
                  <span className="rsc-item__meta">
                    {etapa} · {quandoFoi(r.atualizadoEm)}
                    {r.fotos > 0 ? (
                      <>
                        {" · "}
                        {/* A contagem de fotos aparece com o ícone riscado de
                            propósito: ela não é uma conquista do rascunho, é o
                            que ele NÃO guardou. Ver `utils/rascunhoImovel.js`. */}
                        <span className="rsc-item__fotos" title="As fotos não são guardadas — reenvie antes de publicar.">
                          <Camera size={12} weight="fill" />
                          {r.fotos} {r.fotos === 1 ? "foto a reenviar" : "fotos a reenviar"}
                        </span>
                      </>
                    ) : null}
                  </span>
                </div>
                <div className="rsc-item__acoes">
                  <button type="button" className="rsc-retomar" onClick={() => retomar(r)}>
                    Retomar <ArrowRight size={13} weight="bold" />
                  </button>
                  <button
                    type="button"
                    className="rsc-descartar"
                    title="Descartar"
                    disabled={removendo === r.chave}
                    onClick={() => descartar(r)}
                  >
                    <Trash size={14} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
