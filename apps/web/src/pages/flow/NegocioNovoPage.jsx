import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { ArrowLeft } from "@phosphor-icons/react";
import { api } from "../../api";
import { PageHeader } from "../../components/adminUi";
import { CANAIS_FLOW } from "../../utils/flow";
import { SelectCustom } from "../../components/SelectCustom.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   ABRIR UM NEGÓCIO À MÃO.

   O caminho normal é o webhook — o lead chega do portal e o negócio nasce
   sozinho. Este formulário é para o resto: a indicação que chegou por telefone,
   o cliente antigo que voltou, a venda que começou numa conversa de corredor.

   ── QUASE TUDO É OPCIONAL, E É DE PROPÓSITO ──

   Só o título é exigido. Um negócio nasce com informação incompleta por
   natureza: existe interessado antes de existir imóvel escolhido, e existe
   imóvel antes de existir proposta. Um formulário que exige comprador, vendedor
   e valor na abertura empurraria o corretor a inventar dados — ou, mais
   provável, a não usar o sistema e anotar no caderno.

   ── O RESPONSÁVEL EM BRANCO NÃO É "SEM DONO" ──

   Deixar vazio manda o negócio para a MESMA roleta que distribui os leads
   (`services/distribuicaoLeads.js`), que escolhe por carga. É o padrão certo:
   quem abre um negócio raramente é quem vai atendê-lo.
   ──────────────────────────────────────────────────────────────────────────── */

const VAZIO = {
  titulo: "", propertyId: "", compradorId: "", vendedorId: "",
  responsavelId: "", valorProposta: "", canal: "INDICACAO", origem: "",
};

export function NegocioNovoPage({ session }) {
  const tenantSlug = session?.tenant?.slug;
  const navigate = useNavigate();
  const showToast = useOutletContext()?.showToast;

  const [form, setForm] = useState(VAZIO);
  const [imoveis, setImoveis] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!tenantSlug) return;
    /* As três listas em paralelo. Em série seriam três idas ao banco em
       sequência, e em produção cada uma custa perto de um segundo — o
       formulário levaria três para ficar utilizável. */
    Promise.all([
      api.listProperties(tenantSlug).catch(() => []),
      api.listClientes(tenantSlug).catch(() => []),
      api.listUsuarios(tenantSlug).catch(() => []),
    ]).then(([i, c, u]) => {
      setImoveis(Array.isArray(i) ? i : i?.properties || []);
      setClientes(Array.isArray(c) ? c : c?.clientes || []);
      setUsuarios(Array.isArray(u) ? u : u?.usuarios || []);
    });
  }, [tenantSlug]);

  const marcar = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  /* O título se escreve sozinho a partir do que já foi escolhido, e para de se
     escrever assim que a pessoa digita. Um campo obrigatório que a pessoa
     precisa inventar no primeiro passo é o tipo de atrito que faz o formulário
     ser abandonado — e "Maria Silva — Apto Centro" é melhor do que qualquer
     coisa que ela digitaria com pressa. */
  const [tituloTocado, setTituloTocado] = useState(false);
  useEffect(() => {
    if (tituloTocado) return;
    const cliente = clientes.find((c) => c.id === form.compradorId);
    const imovel = imoveis.find((i) => i.id === form.propertyId);
    const partes = [cliente?.nome, imovel?.title].filter(Boolean);
    if (partes.length) setForm((p) => ({ ...p, titulo: partes.join(" — ") }));
  }, [form.compradorId, form.propertyId, clientes, imoveis, tituloTocado]);

  async function salvar(e) {
    e.preventDefault();
    if (!form.titulo.trim()) { showToast?.("Dê um nome ao negócio.", "error"); return; }
    setSalvando(true);
    try {
      const criado = await api.criarNegocio(tenantSlug, {
        ...form,
        valorProposta: form.valorProposta ? Number(form.valorProposta) : null,
        propertyId: form.propertyId || null,
        compradorId: form.compradorId || null,
        vendedorId: form.vendedorId || null,
        responsavelId: form.responsavelId || null,
      });
      showToast?.(`Negócio #${criado.codigo} aberto.`);
      navigate(`/flow/negocios/${criado.id}`);
    } catch (erro) {
      showToast?.(erro.message || "Não consegui abrir o negócio.", "error");
      setSalvando(false);
    }
  }

  return (
    <div>
      <button type="button" className="flow-voltar" onClick={() => navigate("/flow/funil")}>
        <ArrowLeft size={14} weight="bold" /> Voltar
      </button>
      <PageHeader
        title="Novo negócio"
        subtitle="Só o nome é obrigatório — o resto se preenche conforme a conversa avança."
      />

      <form className="glass-panel flow-form" onSubmit={salvar}>
        <label className="flow-campo">
          <span>Nome do negócio</span>
          <input
            value={form.titulo}
            onChange={(e) => { setTituloTocado(true); marcar("titulo", e.target.value); }}
            placeholder="Ex.: Maria Silva — Apartamento no Centro"
            autoFocus
          />
        </label>

        <div className="flow-form__dupla">
          <label className="flow-campo">
            <span>Comprador (interessado)</span>
            <SelectCustom
              value={form.compradorId}
              onChange={(v) => marcar("compradorId", v)}
              ariaLabel="Comprador"
              options={[{ value: "", label: "— a definir —" }, ...clientes.map((c) => ({ value: c.id, label: c.nome }))]}
            />
          </label>
          <label className="flow-campo">
            <span>Vendedor (proprietário)</span>
            <SelectCustom
              value={form.vendedorId}
              onChange={(v) => marcar("vendedorId", v)}
              ariaLabel="Vendedor"
              options={[{ value: "", label: "— a definir —" }, ...clientes.map((c) => ({ value: c.id, label: c.nome }))]}
            />
          </label>
        </div>

        <label className="flow-campo">
          <span>Imóvel</span>
          {/* A cidade vira `description` em vez de entrar no rótulo: numa lista
              longa é ela que distingue dois "Apartamento 2 quartos", e numa
              segunda linha ela se lê sem competir com o título. */}
          <SelectCustom
            value={form.propertyId}
            onChange={(v) => marcar("propertyId", v)}
            ariaLabel="Imóvel"
            options={[
              { value: "", label: "— a definir —" },
              ...imoveis.map((i) => ({ value: i.id, label: i.title, description: i.city || undefined })),
            ]}
          />
        </label>

        <div className="flow-form__dupla">
          <label className="flow-campo">
            <span>Valor da proposta</span>
            <input
              type="number" min="0" step="1000" inputMode="numeric"
              value={form.valorProposta}
              onChange={(e) => marcar("valorProposta", e.target.value)}
              placeholder="deixe em branco se ainda não há"
            />
          </label>
          <label className="flow-campo">
            <span>Responsável</span>
            {/* O rótulo diz o que acontece, e não "nenhum": a fila é o
                comportamento padrão e escondê-la faria parecer que o negócio
                ficaria órfão. A segunda linha do `SelectCustom` cabe a
                explicação que antes não cabia entre parênteses. */}
            <SelectCustom
              value={form.responsavelId}
              onChange={(v) => marcar("responsavelId", v)}
              ariaLabel="Responsável"
              options={[
                { value: "", label: "Distribuir pela fila", description: "Escolhe por carga, como nos leads." },
                ...usuarios.filter((u) => u.ativo).map((u) => ({ value: u.id, label: u.nome })),
              ]}
            />
          </label>
        </div>

        <div className="flow-form__dupla">
          <label className="flow-campo">
            <span>De onde veio</span>
            <SelectCustom
              value={form.canal}
              onChange={(v) => marcar("canal", v)}
              ariaLabel="De onde veio"
              options={CANAIS_FLOW.map((c) => ({ value: c.key, label: c.rotulo }))}
            />
          </label>
          <label className="flow-campo">
            <span>Detalhe da origem</span>
            <input
              value={form.origem}
              onChange={(e) => marcar("origem", e.target.value)}
              placeholder="Ex.: indicação do Dr. Paulo"
            />
          </label>
        </div>

        <div className="flow-form__acoes">
          <button type="submit" className="btn-primary" disabled={salvando}>
            {salvando ? "Abrindo…" : "Abrir negócio"}
          </button>
          <button type="button" className="flow-btn-fantasma" onClick={() => navigate("/flow/funil")}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
