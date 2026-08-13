import { useEffect, useMemo, useState } from "react";
import { api } from "../api";

/* ────────────────────────────────────────────────────────────────────────────
   Registrar uma venda ou locação.

   Mora dentro do cartão "Funil de vendas", e não em item próprio no menu: é o
   que alimenta o funil, e o lugar de escrever um número é ao lado de onde ele
   é lido.

   Três seletores dependentes (imóvel, cliente, corretor) e dinheiro. Duas
   decisões vieram daí:

   1. As TRÊS listas são carregadas ao abrir o formulário, não antes. São três
      requisições que não servem para nada enquanto ninguém for registrar
      venda — e quem abre a tela do funil quase sempre veio só olhar.

   2. A comissão aceita valor OU percentual. Imobiliária fala nos dois: "seis
      por cento" e "dezoito mil" são a mesma frase para pessoas diferentes.
      O que vai para a API é sempre o valor em reais; o percentual é conta
      feita aqui, à vista, para a pessoa conferir antes de gravar.
   ──────────────────────────────────────────────────────────────────────────── */

function brl(n) {
  return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const campo = {
  width: "100%", padding: "9px 11px", borderRadius: "9px", fontSize: "13.5px",
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "inherit",
};
const rotulo = { fontSize: "11.5px", color: "var(--text-muted)", display: "block", marginBottom: "5px" };

export function RegistrarVenda({ session, aoRegistrar }) {
  const tenantSlug = session?.tenant?.slug || "";
  const [aberto, setAberto] = useState(false);
  const [listas, setListas] = useState(null);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const [form, setForm] = useState({
    propertyId: "", clienteId: "", usuarioId: "",
    tipo: "VENDA", valor: "", data: new Date().toISOString().slice(0, 10),
    comissao: "", observacoes: "",
  });
  // "reais" | "percentual" — só muda como a comissão é DIGITADA.
  const [modoComissao, setModoComissao] = useState("reais");

  useEffect(() => {
    if (!aberto || listas || !tenantSlug) return;
    let vivo = true;
    Promise.all([
      api.listProperties(tenantSlug, { limit: 500 }).catch(() => null),
      api.listClientes(tenantSlug, { ativo: true }).catch(() => null),
      api.listUsuarios(tenantSlug).catch(() => null),
    ]).then(([p, c, u]) => {
      if (!vivo) return;
      setListas({
        imoveis: p?.properties ?? (Array.isArray(p) ? p : []),
        clientes: c?.clientes ?? (Array.isArray(c) ? c : []),
        usuarios: u?.usuarios ?? (Array.isArray(u) ? u : []),
      });
    });
    return () => { vivo = false; };
  }, [aberto, listas, tenantSlug]);

  const valorNum = Number(String(form.valor).replace(",", ".")) || 0;
  const comissaoNum = Number(String(form.comissao).replace(",", ".")) || 0;
  const comissaoEmReais = useMemo(
    () => (modoComissao === "percentual" ? (valorNum * comissaoNum) / 100 : comissaoNum),
    [modoComissao, valorNum, comissaoNum],
  );

  const podeSalvar =
    form.propertyId && form.clienteId && form.usuarioId && valorNum > 0 && form.data && !salvando;

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      await api.criarVenda(tenantSlug, {
        propertyId: form.propertyId,
        clienteId: form.clienteId,
        usuarioId: form.usuarioId,
        tipo: form.tipo,
        valor: valorNum,
        data: form.data,
        // Só manda comissão quando alguém digitou algo: zero e "não informado"
        // são coisas diferentes na coluna de comissões.
        comissao: form.comissao === "" ? null : Math.round(comissaoEmReais * 100) / 100,
        observacoes: form.observacoes || null,
      });
      setAberto(false);
      setForm((f) => ({ ...f, propertyId: "", clienteId: "", valor: "", comissao: "", observacoes: "" }));
      aoRegistrar?.();
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        style={{
          width: "auto", padding: "8px 15px", borderRadius: "999px", cursor: "pointer",
          fontSize: "12.5px", fontWeight: 600,
          background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.34)", color: "#6ee7b7",
        }}
      >
        + Registrar venda
      </button>
    );
  }

  return (
    <form onSubmit={salvar} style={{ padding: "18px", borderRadius: "12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)", marginBottom: "18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
        <strong style={{ fontSize: "14.5px" }}>Registrar venda ou locação</strong>
        <button type="button" onClick={() => setAberto(false)} style={{ width: "auto", padding: "4px 10px", borderRadius: "999px", fontSize: "12px", background: "none", border: "1px solid rgba(255,255,255,0.12)", color: "var(--text-muted)", cursor: "pointer" }}>
          Fechar
        </button>
      </div>

      {!listas ? (
        <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>Carregando imóveis, clientes e equipe…</p>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "12px" }}>
            <label>
              <span style={rotulo}>Imóvel</span>
              <select style={campo} value={form.propertyId} onChange={(e) => setForm({ ...form, propertyId: e.target.value })}>
                <option value="">Selecione…</option>
                {listas.imoveis.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
              </select>
            </label>

            <label>
              <span style={rotulo}>Cliente</span>
              <select style={campo} value={form.clienteId} onChange={(e) => setForm({ ...form, clienteId: e.target.value })}>
                <option value="">Selecione…</option>
                {listas.clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>

            <label>
              <span style={rotulo}>Corretor</span>
              <select style={campo} value={form.usuarioId} onChange={(e) => setForm({ ...form, usuarioId: e.target.value })}>
                <option value="">Selecione…</option>
                {listas.usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </label>

            <label>
              <span style={rotulo}>Tipo</span>
              <select style={campo} value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                <option value="VENDA">Venda</option>
                <option value="ALUGUEL">Locação</option>
              </select>
            </label>

            <label>
              <span style={rotulo}>Valor (R$)</span>
              <input style={campo} inputMode="decimal" placeholder="450000" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
            </label>

            <label>
              <span style={rotulo}>Data do fechamento</span>
              <input style={campo} type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
            </label>

            <label>
              <span style={rotulo}>
                Comissão
                {/* O botão troca a UNIDADE do que já está digitado, sem apagar:
                    quem escreveu "6" pensando em porcento vê o valor virar reais
                    na hora, e é assim que percebe que escolheu o modo errado. */}
                <button
                  type="button"
                  onClick={() => setModoComissao((m) => (m === "reais" ? "percentual" : "reais"))}
                  style={{ width: "auto", marginLeft: "7px", padding: "1px 8px", borderRadius: "999px", fontSize: "10.5px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "inherit", cursor: "pointer" }}
                >
                  {modoComissao === "reais" ? "R$" : "%"}
                </button>
              </span>
              <input
                style={campo}
                inputMode="decimal"
                placeholder={modoComissao === "reais" ? "13500" : "6"}
                value={form.comissao}
                onChange={(e) => setForm({ ...form, comissao: e.target.value })}
              />
              {form.comissao !== "" && valorNum > 0 ? (
                <span style={{ fontSize: "11px", color: "#6ee7b7", display: "block", marginTop: "4px" }}>
                  = {brl(comissaoEmReais)}
                  {modoComissao === "reais" && valorNum > 0
                    ? ` · ${(Math.round((comissaoEmReais / valorNum) * 1000) / 10)}% do valor`
                    : ""}
                </span>
              ) : null}
            </label>
          </div>

          <label style={{ display: "block", marginTop: "12px" }}>
            <span style={rotulo}>Observações (opcional)</span>
            <textarea style={{ ...campo, minHeight: "58px", resize: "vertical" }} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </label>

          {erro ? <p style={{ margin: "12px 0 0", fontSize: "12.5px", color: "#fca5a5" }}>{erro}</p> : null}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
            <button type="submit" style={{ width: "auto", padding: "9px 20px" }} disabled={!podeSalvar}>
              {salvando ? "Registrando…" : "Registrar"}
            </button>
          </div>

          {listas.clientes.length === 0 || listas.usuarios.length === 0 ? (
            <p style={{ margin: "12px 0 0", fontSize: "11.5px", color: "var(--text-muted)" }}>
              {listas.clientes.length === 0 ? "Nenhum cliente cadastrado — a venda precisa de um. " : ""}
              {listas.usuarios.length === 0 ? "Nenhum usuário na equipe para atribuir a venda." : ""}
            </p>
          ) : null}
        </>
      )}
    </form>
  );
}
