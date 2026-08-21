import { useState } from "react";
import { Plus, X } from "@phosphor-icons/react";
import { api } from "../api";
import { SelectCustom } from "./SelectCustom";
import { PERMISSOES_DE_RISCO, cargoVazio } from "../utils/permissoesCargo.jsx";
import { ModalCiencia } from "./ModalCiencia";
import { GradeDePermissoes } from "./GradeDePermissoes.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   Escolher o cargo — ou criar um na hora.

   ── O PROBLEMA QUE ELE RESOLVE ──

   Cadastrar alguém exige escolher um cargo, e o cargo certo muitas vezes ainda
   não existe: "Corretor sênior", "Estagiário", "Financeiro". Antes, descobrir
   isso no meio do cadastro significava sair da tela, ir em Cargos, criar,
   voltar — e refazer o formulário, porque o que estava digitado se perdia.

   O botão + abre os campos aqui embaixo. O cargo é criado de verdade (vai para
   a tabela, aparece em Cargos) e já fica selecionado para esta pessoa.

   ── AS CAIXAS SÃO O MESMO COMPONENTE DA TELA DE CARGOS ──

   `components/GradeDePermissoes`. Não é só a lista que é compartilhada: é o
   desenho inteiro. Antes cada tela tinha o seu, e elas já tinham divergido —
   esta aqui nem mostrava o ícone de cada permissão.

   ── `verConfiguracoes` NÃO APARECE ──

   Ela não é escolha: o servidor a recalcula a cada gravação a partir do nome do
   cargo. Um cargo chamado "Administrador" a ganha; qualquer outro, não. Mostrar
   a caixa aqui prometeria um controle que não existe.
   ──────────────────────────────────────────────────────────────────────────── */

export function CargoEmLinha({ valor, cargos, plano, tenantSlug, disabled, aoTrocar, aoCriar, aoAvisar }) {
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState(cargoVazio);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  /* Permissão de alto risco esperando a ciência de quem está criando o cargo.
     Sem isto, este `+` era o caminho curto para conceder `gerenciarCargos` sem
     ver o aviso que a tela de Cargos mostra — bastava criar o cargo por aqui.
     Ver `PERMISSOES_DE_RISCO`. */
  const [concessaoPendente, setConcessaoPendente] = useState(null);

  const marcar = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  function aoAlternarPermissao(chave, marcado) {
    // Conceder para no aviso; TIRAR nunca para — desfazer tem de ser fácil.
    if (marcado && PERMISSOES_DE_RISCO[chave]) {
      setConcessaoPendente(chave);
      return;
    }
    marcar(chave, marcado);
  }

  function fechar() {
    setAberto(false);
    setForm(cargoVazio());
    setErro("");
  }

  async function criarEAplicar() {
    const descricao = form.descricao.trim();
    if (!descricao) { setErro("Dê um nome ao cargo."); return; }

    setSalvando(true);
    setErro("");
    try {
      /* Manda o form INTEIRO, e não só o que está à vista: permissão escondida
         pelo plano viajaria como ausente e o servidor a gravaria como false.
         Mesmo cuidado que a tela de Cargos já tem. */
      const criado = await api.createCargo(tenantSlug, form);
      /* A ordem importa: primeiro a lista ganha o cargo novo, depois ele é
         selecionado. Ao contrário, o combo receberia um id que ainda não está
         entre as opções e mostraria o campo vazio. */
      aoCriar?.(criado);
      aoTrocar(String(criado.id));
      aoAvisar?.(`Cargo "${criado.descricao}" criado e aplicado.`);
      fechar();
    } catch (e) {
      setErro(e.message || "Não consegui criar o cargo.");
    } finally {
      setSalvando(false);
    }
  }

  const risco = concessaoPendente ? PERMISSOES_DE_RISCO[concessaoPendente] : null;
  const nomeDoCargo = form.descricao.trim();
  const alvoDoAviso = nomeDoCargo ? `ao cargo "${nomeDoCargo}"` : "a este cargo";

  return (
    <div className="cel-caixa">
      <ModalCiencia
        aberto={Boolean(risco)}
        titulo={risco?.titulo}
        descricao={`Você está prestes a dar ${alvoDoAviso} ${risco?.verbo}.`}
        riscos={risco?.riscos || []}
        textoCiencia={risco?.textoCiencia}
        confirmarLabel="Conceder mesmo assim"
        aoConfirmar={() => {
          if (concessaoPendente) marcar(concessaoPendente, true);
          setConcessaoPendente(null);
        }}
        aoCancelar={() => setConcessaoPendente(null)}
      />
      <div className="cel-linha">
        <div className="cel-select">
          <SelectCustom
            value={valor}
            placeholder="Selecione o cargo"
            disabled={disabled || aberto}
            options={cargos.map((c) => ({ value: String(c.id), label: c.descricao }))}
            onChange={aoTrocar}
          />
        </div>
        {/* O botão fecha o formulário quando ele está aberto: um "+" que só
            abre deixa a pessoa sem saída além de recarregar a tela. */}
        <button
          type="button"
          className={`cel-mais${aberto ? " is-aberto" : ""}`}
          onClick={() => (aberto ? fechar() : setAberto(true))}
          disabled={disabled}
          title={aberto ? "Cancelar" : "Criar um cargo novo"}
          aria-expanded={aberto}
        >
          {aberto ? <X size={16} weight="bold" /> : <Plus size={16} weight="bold" />}
        </button>
      </div>

      {aberto ? (
        <div className="cel-form">
          <label className="cel-campo">
            <span>Nome do cargo</span>
            <input
              value={form.descricao}
              onChange={(e) => marcar("descricao", e.target.value)}
              placeholder="Corretor sênior, Estagiário, Financeiro…"
              disabled={salvando}
              autoFocus
            />
          </label>

          <div>
            <span className="cel-titulo">O que este cargo pode fazer</span>
            {/* O mesmo componente da tela de Cargos. Aqui não há permissão
                travada: o cargo está sendo criado agora, então não existe
                "próprio cargo" de quem editar. */}
            <GradeDePermissoes
              plano={plano}
              valores={form}
              desabilitado={salvando}
              aoAlternar={aoAlternarPermissao}
            />
          </div>

          {erro ? <p className="cel-erro">{erro}</p> : null}

          <div className="cel-acoes">
            <button type="button" className="cel-btn cel-btn--primario" onClick={criarEAplicar} disabled={salvando}>
              {salvando ? "Criando…" : "Criar e aplicar cargo"}
            </button>
            <button type="button" className="cel-btn" onClick={fechar} disabled={salvando}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
