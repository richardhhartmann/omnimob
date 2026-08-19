import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Target, Plus, Trash, ArrowsClockwise } from "@phosphor-icons/react";
import { api } from "../api";

/* ────────────────────────────────────────────────────────────────────────────
   Perfis de busca do cliente, e o cruzamento com o acervo.

   A imobiliária já tem a carteira e já tem os imóveis; o que faltava era a
   ligação. Aqui ela é feita de forma explícita — o corretor escreve o que a
   pessoa procura — e o sistema responde na hora o que existe para ela.

   ── POR QUE TODO CAMPO É OPCIONAL ──

   Porque perfil pela metade ainda cruza. Um formulário que exige oito campos
   para salvar é um formulário que ninguém preenche entre uma ligação e outra —
   e um perfil vazio é o único que não serve para nada. "Até 600 mil, Centro"
   já entrega valor.

   ── SOBRE OS "APROXIMADOS" ──

   O cruzamento aceita 10% acima do teto de preço e um quarto a menos, e marca
   esses casos. Não é imprecisão: quem diz "até 600 mil" compra por 640 se o
   imóvel for o certo. O que seria errado é apresentá-los como se batessem
   exatamente — e é por isso que eles vêm com etiqueta. Ver
   `services/cruzamento.js` na API.
   ──────────────────────────────────────────────────────────────────────────── */

const VAZIO = {
  titulo: "", finalidade: "", tipoContrato: "", precoMin: "", precoMax: "",
  quartosMin: "", vagasMin: "", areaMin: "", cidade: "", bairros: "", ativo: true,
};

const moeda = (v) =>
  v === null || v === undefined || v === "" ? "—" :
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/* Resumo do perfil em uma linha. É o que o corretor lê antes de decidir abrir —
   repetir o formulário inteiro em modo leitura ocuparia a tela sem responder
   mais rápido. */
function resumo(p) {
  const partes = [];
  if (p.precoMin || p.precoMax) {
    if (p.precoMin && p.precoMax) partes.push(`${moeda(p.precoMin)} a ${moeda(p.precoMax)}`);
    else if (p.precoMax) partes.push(`até ${moeda(p.precoMax)}`);
    else partes.push(`a partir de ${moeda(p.precoMin)}`);
  }
  if (p.quartosMin) partes.push(`${p.quartosMin}+ quartos`);
  if (p.vagasMin) partes.push(`${p.vagasMin}+ vagas`);
  if (p.areaMin) partes.push(`${p.areaMin}+ m²`);
  if (p.bairros?.length) partes.push(p.bairros.slice(0, 3).join(", ") + (p.bairros.length > 3 ? "…" : ""));
  else if (p.cidade) partes.push(p.cidade);
  return partes.length ? partes.join(" · ") : "Sem critérios — cruza com tudo que estiver ativo";
}

function Formulario({ inicial, tiposImovel, salvando, aoSalvar, aoCancelar }) {
  const [f, setF] = useState(inicial || VAZIO);
  const campo = (k, v) => setF((p) => ({ ...p, [k]: v }));

  return (
    <form
      className="pfb-form"
      onSubmit={(e) => { e.preventDefault(); aoSalvar(f); }}
    >
      <label className="pfb-campo pfb-campo--largo">
        <span>Como chamar este perfil</span>
        <input
          value={f.titulo}
          onChange={(e) => campo("titulo", e.target.value)}
          placeholder="Ex.: Apartamento para a família, até 600 mil"
          required
          minLength={2}
          maxLength={120}
        />
      </label>

      <label className="pfb-campo">
        <span>Negócio</span>
        <select value={f.tipoContrato} onChange={(e) => campo("tipoContrato", e.target.value)}>
          <option value="">Tanto faz</option>
          <option value="VENDA">Compra</option>
          <option value="LOCACAO">Aluguel</option>
        </select>
      </label>

      <label className="pfb-campo">
        <span>Finalidade</span>
        <select value={f.finalidade} onChange={(e) => campo("finalidade", e.target.value)}>
          <option value="">Tanto faz</option>
          <option value="RESIDENCIAL">Residencial</option>
          <option value="COMERCIAL">Comercial</option>
        </select>
      </label>

      <label className="pfb-campo">
        <span>Tipo</span>
        <select value={f.tipoImovelId || ""} onChange={(e) => campo("tipoImovelId", e.target.value)}>
          <option value="">Qualquer tipo</option>
          {(tiposImovel || []).map((t) => (
            <option key={t.id} value={t.id}>{t.descricao}</option>
          ))}
        </select>
      </label>

      <label className="pfb-campo">
        <span>Preço mínimo</span>
        <input inputMode="numeric" value={f.precoMin} onChange={(e) => campo("precoMin", e.target.value.replace(/\D/g, ""))} placeholder="—" />
      </label>
      <label className="pfb-campo">
        <span>Preço máximo</span>
        <input inputMode="numeric" value={f.precoMax} onChange={(e) => campo("precoMax", e.target.value.replace(/\D/g, ""))} placeholder="—" />
      </label>

      <label className="pfb-campo">
        <span>Quartos (mín.)</span>
        <input inputMode="numeric" value={f.quartosMin} onChange={(e) => campo("quartosMin", e.target.value.replace(/\D/g, ""))} placeholder="—" />
      </label>
      <label className="pfb-campo">
        <span>Vagas (mín.)</span>
        <input inputMode="numeric" value={f.vagasMin} onChange={(e) => campo("vagasMin", e.target.value.replace(/\D/g, ""))} placeholder="—" />
      </label>
      <label className="pfb-campo">
        <span>Área (mín., m²)</span>
        <input inputMode="numeric" value={f.areaMin} onChange={(e) => campo("areaMin", e.target.value.replace(/\D/g, ""))} placeholder="—" />
      </label>

      <label className="pfb-campo">
        <span>Cidade</span>
        <input value={f.cidade} onChange={(e) => campo("cidade", e.target.value)} placeholder="Ex.: São Paulo" />
      </label>

      <label className="pfb-campo pfb-campo--largo">
        <span>Bairros aceitos</span>
        <input
          value={f.bairros}
          onChange={(e) => campo("bairros", e.target.value)}
          placeholder="Centro, Bela Vista, Pinheiros — separe por vírgula"
        />
        <small>Deixe vazio para aceitar qualquer bairro da cidade.</small>
      </label>

      <div className="pfb-form__acoes">
        <button type="button" className="button-secondary" onClick={aoCancelar} style={{ width: "auto", padding: "9px 16px" }}>
          Cancelar
        </button>
        <button type="submit" disabled={salvando} style={{ width: "auto", padding: "9px 18px" }}>
          {salvando ? "Salvando…" : "Salvar perfil"}
        </button>
      </div>
    </form>
  );
}

export function PerfisDeBusca({ cliente, tenantSlug, tiposImovel, showToast }) {
  const [perfis, setPerfis] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);
  // { [perfilId]: { carregando, imoveis } }
  const [cruzamentos, setCruzamentos] = useState({});

  useEffect(() => {
    if (!tenantSlug || !cliente?.id) return;
    let vivo = true;
    setCarregando(true);
    api.listarPerfisBusca(tenantSlug, cliente.id)
      .then((r) => { if (vivo) setPerfis(r.perfis || []); })
      .catch((e) => showToast?.(e.message, "error"))
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [tenantSlug, cliente?.id]);

  async function salvar(f) {
    setSalvando(true);
    try {
      const payload = {
        clienteId: cliente.id,
        titulo: f.titulo,
        finalidade: f.finalidade || null,
        tipoContrato: f.tipoContrato || null,
        tipoImovelId: f.tipoImovelId || undefined,
        precoMin: f.precoMin || undefined,
        precoMax: f.precoMax || undefined,
        quartosMin: f.quartosMin || undefined,
        vagasMin: f.vagasMin || undefined,
        areaMin: f.areaMin || undefined,
        cidade: f.cidade || null,
        bairros: f.bairros || "",
      };
      if (editando) {
        const atualizado = await api.salvarPerfilBusca(tenantSlug, editando.id, payload);
        setPerfis((p) => p.map((x) => (x.id === atualizado.id ? atualizado : x)));
        showToast?.("Perfil atualizado.");
      } else {
        const novo = await api.criarPerfilBusca(tenantSlug, payload);
        setPerfis((p) => [novo, ...p]);
        showToast?.("Perfil criado. Use “Ver imóveis” para cruzar com o acervo.");
      }
      setCriando(false);
      setEditando(null);
    } catch (erro) {
      showToast?.(erro.message, "error");
    } finally {
      setSalvando(false);
    }
  }

  async function remover(perfil) {
    try {
      await api.removerPerfilBusca(tenantSlug, perfil.id);
      setPerfis((p) => p.filter((x) => x.id !== perfil.id));
      showToast?.("Perfil removido.");
    } catch (erro) {
      showToast?.(erro.message, "error");
    }
  }

  async function cruzar(perfil) {
    setCruzamentos((c) => ({ ...c, [perfil.id]: { carregando: true, imoveis: c[perfil.id]?.imoveis } }));
    try {
      const r = await api.imoveisDoPerfil(tenantSlug, perfil.id);
      setCruzamentos((c) => ({ ...c, [perfil.id]: { carregando: false, imoveis: r.imoveis || [] } }));
    } catch (erro) {
      setCruzamentos((c) => ({ ...c, [perfil.id]: { carregando: false, imoveis: [] } }));
      showToast?.(erro.message, "error");
    }
  }

  /* Formulário aberto ocupa o lugar da lista em vez de empilhar sob ela: o
     bloco vive dentro de um cartão de cliente, e duas coisas longas ali dentro
     empurrariam o resto da tela para fora da vista. */
  if (criando || editando) {
    return (
      <div className="pfb">
        <div className="pfb__cabeca">
          <Target size={16} weight="duotone" />
          <strong>{editando ? "Editar perfil de busca" : "Novo perfil de busca"}</strong>
        </div>
        <Formulario
          inicial={
            editando
              ? {
                  ...VAZIO,
                  ...editando,
                  precoMin: editando.precoMin ? String(Math.round(Number(editando.precoMin))) : "",
                  precoMax: editando.precoMax ? String(Math.round(Number(editando.precoMax))) : "",
                  quartosMin: editando.quartosMin ?? "",
                  vagasMin: editando.vagasMin ?? "",
                  areaMin: editando.areaMin ?? "",
                  finalidade: editando.finalidade || "",
                  tipoContrato: editando.tipoContrato || "",
                  cidade: editando.cidade || "",
                  bairros: (editando.bairros || []).join(", "),
                }
              : VAZIO
          }
          tiposImovel={tiposImovel}
          salvando={salvando}
          aoSalvar={salvar}
          aoCancelar={() => { setCriando(false); setEditando(null); }}
        />
      </div>
    );
  }

  return (
    <div className="pfb">
      <div className="pfb__cabeca">
        <Target size={16} weight="duotone" />
        <strong>O que {cliente.nome?.split(" ")[0] || "este cliente"} procura</strong>
        <button type="button" className="pfb__novo" onClick={() => setCriando(true)}>
          <Plus size={12} weight="bold" /> Novo perfil
        </button>
      </div>

      {carregando ? (
        <p className="pfb__vazio">Carregando…</p>
      ) : perfis.length === 0 ? (
        <p className="pfb__vazio">
          Nenhum perfil cadastrado. Escreva o que a pessoa procura e o sistema avisa o que do
          acervo serve para ela — inclusive nos imóveis que entrarem depois.
        </p>
      ) : (
        <ul className="pfb__lista">
          {perfis.map((p) => {
            const cruz = cruzamentos[p.id];
            return (
              <li key={p.id} className="pfb__item">
                <div className="pfb__item-topo">
                  <div style={{ minWidth: 0 }}>
                    <span className="pfb__titulo">{p.titulo}</span>
                    <span className="pfb__resumo">{resumo(p)}</span>
                  </div>
                  <div className="pfb__acoes">
                    <button type="button" onClick={() => cruzar(p)} disabled={cruz?.carregando}>
                      <ArrowsClockwise size={12} weight="bold" />
                      {cruz?.carregando ? "Cruzando…" : "Ver imóveis"}
                    </button>
                    <button type="button" onClick={() => setEditando(p)}>Editar</button>
                    <button type="button" className="pfb__remover" onClick={() => remover(p)} title="Remover perfil">
                      <Trash size={13} />
                    </button>
                  </div>
                </div>

                {cruz && !cruz.carregando ? (
                  cruz.imoveis.length === 0 ? (
                    <p className="pfb__sem-match">
                      Nada no acervo bate com este perfil hoje. Ele continua valendo — refaça o
                      cruzamento quando entrarem imóveis novos.
                    </p>
                  ) : (
                    <ul className="pfb__matches">
                      {cruz.imoveis.map((i) => (
                        <li key={i.id}>
                          <Link to={`/imoveis/${i.id}`} className="pfb__match">
                            {i.images?.[0]?.url ? (
                              <img src={i.images[0].url} alt="" loading="lazy" />
                            ) : (
                              <span className="pfb__match-sem-foto" aria-hidden="true" />
                            )}
                            <span className="pfb__match-corpo">
                              <span className="pfb__match-titulo">{i.title}</span>
                              <span className="pfb__match-meta">
                                {moeda(i.price)}
                                {i.neighborhood ? ` · ${i.neighborhood}` : ""}
                                {i.bedrooms ? ` · ${i.bedrooms} qtos` : ""}
                              </span>
                              {i.aproximado ? (
                                <span className="pfb__aprox">{i.motivos.join(", ")}</span>
                              ) : null}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
