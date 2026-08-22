import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { Plus, User, WarningCircle } from "@phosphor-icons/react";
import { api } from "../../api";
import { PageHeader, SearchInput, FilterTabs } from "../../components/adminUi";
import { ESTAGIOS_FLOW, ESTAGIO_PERDIDO, reais, desdeQuando, canalRotulo } from "../../utils/flow";
import { ModalTravaDeFechamento } from "../../components/flow/ModalTravaDeFechamento.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   O FUNIL — sete colunas, e o cartão se arrasta entre elas.

   ── POR QUE NÃO É O `dnd-kit` DO EDITOR DE VITRINE ──

   Porque o problema é outro. Lá a geometria é livre: a peça pode parar em
   qualquer x/y, empurra vizinhos e a física é nossa. Aqui só existem sete
   destinos possíveis e o cartão nunca para no meio — é `dragover` de HTML5
   nativo, que resolve isso em trinta linhas e não traz 40 kB para a rota.

   O editor precisou do dnd-kit por causa do TOQUE e do TECLADO em geometria
   livre. Aqui o toque tem um caminho melhor: o seletor de estágio dentro do
   cartão, que funciona igual no celular e no leitor de tela. Arrastar é o
   atalho do mouse, não o único caminho — foi por isso que a lista de destinos
   também virou um menu.

   ── A TRAVA, DO LADO DA TELA ──

   O cartão mostra o que falta ANTES de a pessoa tentar. Mover para Ganho um
   negócio sem as validações abre o modal com a lista — não um toast vermelho
   genérico. Quem decide continua sendo o servidor (422 com `motivos`); a tela
   só antecipa a mesma resposta para o gesto não ser desperdiçado.
   ──────────────────────────────────────────────────────────────────────────── */

export function FunilPage({ session }) {
  const tenantSlug = session?.tenant?.slug;
  const navigate = useNavigate();
  const showToast = useOutletContext()?.showToast;

  const [negocios, setNegocios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [escopo, setEscopo] = useState("todos");
  const [arrastando, setArrastando] = useState(null);
  const [colunaAlvo, setColunaAlvo] = useState(null);
  const [trava, setTrava] = useState(null); // { negocio, motivos, destino }

  /* Espelho do estado para os handlers de arrasto, que são registrados uma vez
     e capturariam o valor do primeiro render. Mesmo padrão do `formRef` do
     editor de vitrine. */
  const negociosRef = useRef(negocios);
  negociosRef.current = negocios;

  const carregar = useCallback(() => {
    if (!tenantSlug) return;
    setCarregando(true);
    api.listarNegocios(tenantSlug, { responsavel: escopo === "meus" ? "meus" : "" })
      .then((r) => setNegocios(r.negocios || []))
      .catch((e) => showToast?.(e.message || "Não consegui carregar o funil.", "error"))
      .finally(() => setCarregando(false));
  }, [tenantSlug, escopo]);

  useEffect(() => { carregar(); }, [carregar]);

  const porColuna = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const filtrados = q
      ? negocios.filter((n) =>
          [n.titulo, n.comprador?.nome, n.property?.title, String(n.codigo)]
            .filter(Boolean).some((v) => String(v).toLowerCase().includes(q)))
      : negocios;

    const mapa = Object.fromEntries([...ESTAGIOS_FLOW, ESTAGIO_PERDIDO].map((e) => [e.key, []]));
    for (const n of filtrados) (mapa[n.estagio] ||= []).push(n);
    return mapa;
  }, [negocios, busca]);

  /* ── O movimento ──────────────────────────────────────────────────────────
     Otimista: o cartão muda de coluna no mesmo quadro e volta se o servidor
     recusar. Esperar a resposta faria o cartão ficar preso sob o cursor por
     ~900 ms (o custo de uma ida ao banco em produção) e o gesto pareceria
     travado — a pessoa arrastaria de novo. */
  const mover = useCallback(async (negocio, destino) => {
    if (!negocio || negocio.estagio === destino) return;
    const anterior = negocio.estagio;

    setNegocios((atuais) => atuais.map((n) => (n.id === negocio.id ? { ...n, estagio: destino } : n)));

    try {
      await api.moverNegocio(tenantSlug, negocio.id, destino);
      showToast?.(`Negócio ${negocio.codigo} movido para ${rotuloDe(destino)}.`);
      /* Fechar recalcula a comissão no servidor, e o cartão mostra valor. Uma
         releitura é mais barata que reproduzir a regra de comissão aqui. */
      if (destino === "GANHO") carregar();
    } catch (erro) {
      setNegocios((atuais) => atuais.map((n) => (n.id === negocio.id ? { ...n, estagio: anterior } : n)));
      /* A recusa da trava vem com a lista do que falta. Um toast a engoliria —
         são três linhas de texto e um caminho para resolver cada uma. */
      const motivos = erro?.body?.motivos;
      if (Array.isArray(motivos) && motivos.length) {
        setTrava({ negocio, motivos, destino });
      } else {
        showToast?.(erro.message || "Não consegui mover o negócio.", "error");
      }
    }
  }, [tenantSlug, carregar]);

  return (
    <div data-tour="flow-funil">
      <PageHeader
        title="Funil de vendas"
        subtitle="Arraste o cartão para mudar de etapa — ou use o seletor dentro dele."
        action={
          <button type="button" className="btn-primary" onClick={() => navigate("/flow/negocios/novo")}>
            <Plus size={15} weight="bold" style={{ marginRight: 6 }} />
            Novo negócio
          </button>
        }
      />

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18, alignItems: "center" }}>
        <SearchInput
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, imóvel ou número do negócio…"
        />
        <FilterTabs
          value={escopo}
          onChange={setEscopo}
          options={[{ key: "todos", label: "Todos" }, { key: "meus", label: "Meus" }]}
        />
      </div>

      <ModalTravaDeFechamento
        aberto={Boolean(trava)}
        negocio={trava?.negocio}
        motivos={trava?.motivos || []}
        aoFechar={() => setTrava(null)}
        aoAbrirNegocio={() => { const id = trava?.negocio?.id; setTrava(null); navigate(`/flow/negocios/${id}`); }}
      />

      {/* ── As colunas ─────────────────────────────────────────────────────
          Rolagem HORIZONTAL no contêiner, e não quebra de linha: sete colunas
          empilhadas em duas fileiras perdem a leitura de esquerda para a
          direita, que é a única coisa que um funil precisa comunicar. */}
      <div className="funil" role="list">
        {ESTAGIOS_FLOW.map((estagio) => {
          const itens = porColuna[estagio.key] || [];
          const total = itens.reduce((s, n) => s + Number(n.valorFechado ?? n.valorProposta ?? 0), 0);
          return (
            <section
              key={estagio.key}
              role="listitem"
              className={`funil-col${colunaAlvo === estagio.key ? " is-alvo" : ""}`}
              style={{ "--cor": estagio.cor }}
              onDragOver={(e) => { e.preventDefault(); setColunaAlvo(estagio.key); }}
              onDragLeave={() => setColunaAlvo((a) => (a === estagio.key ? null : a))}
              onDrop={(e) => {
                e.preventDefault();
                setColunaAlvo(null);
                const id = e.dataTransfer.getData("text/plain");
                const n = negociosRef.current.find((x) => x.id === id);
                if (n) mover(n, estagio.key);
                setArrastando(null);
              }}
            >
              <header className="funil-col__topo">
                <span className="funil-col__ponto" aria-hidden="true" />
                <span className="funil-col__nome">{estagio.rotulo}</span>
                <span className="funil-col__contagem">{itens.length}</span>
              </header>
              <div className="funil-col__valor">{total > 0 ? reais(total, { curto: true }) : "—"}</div>

              <div className="funil-col__lista">
                {carregando ? (
                  <>
                    <div className="skeleton-block" style={{ height: 86, borderRadius: 11, marginBottom: 8 }} />
                    <div className="skeleton-block" style={{ height: 86, borderRadius: 11 }} />
                  </>
                ) : itens.length === 0 ? (
                  <p className="funil-col__vazia">{estagio.descricao}</p>
                ) : (
                  itens.map((n) => (
                    <CartaoNegocio
                      key={n.id}
                      negocio={n}
                      arrastando={arrastando === n.id}
                      aoArrastar={setArrastando}
                      aoMover={(destino) => mover(n, destino)}
                      aoAbrir={() => navigate(`/flow/negocios/${n.id}`)}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* Perdidos ficam FORA das colunas, num recolhível embaixo. Como coluna
          eles competiriam por largura com as sete etapas que importam, e a
          coluna cresceria para sempre — depois de um ano, "Perdido" seria a
          maior do funil e a tela inteira leria como fracasso. */}
      <PerdidosRecolhivel
        itens={porColuna.PERDIDO || []}
        aoAbrir={(id) => navigate(`/flow/negocios/${id}`)}
      />
    </div>
  );
}

function rotuloDe(key) {
  return [...ESTAGIOS_FLOW, ESTAGIO_PERDIDO].find((e) => e.key === key)?.rotulo || key;
}

function CartaoNegocio({ negocio: n, arrastando, aoArrastar, aoMover, aoAbrir }) {
  const parado = desdeQuando(n.ultimoContatoEm || n.createdAt);
  const diasParado = Math.floor((Date.now() - new Date(n.ultimoContatoEm || n.createdAt).getTime()) / 86400000);
  const valor = n.valorFechado ?? n.valorProposta;

  return (
    <article
      className={`funil-cartao${arrastando ? " is-arrastando" : ""}${diasParado >= 5 ? " is-parado" : ""}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", n.id);
        e.dataTransfer.effectAllowed = "move";
        aoArrastar(n.id);
      }}
      onDragEnd={() => aoArrastar(null)}
    >
      {/* O corpo inteiro abre o negócio; o seletor embaixo não. `onClick` na
          <article> e `stopPropagation` no seletor — sem isso, escolher um
          estágio no menu também navegaria para o detalhe. */}
      <button type="button" className="funil-cartao__corpo" onClick={aoAbrir}>
        <span className="funil-cartao__codigo">#{n.codigo}</span>
        <span className="funil-cartao__titulo">{n.titulo}</span>
        {n.property?.title ? (
          <span className="funil-cartao__imovel">{n.property.title}</span>
        ) : null}
        <span className="funil-cartao__rodape">
          {valor ? <strong>{reais(valor, { curto: true })}</strong> : <span className="funil-cartao__semvalor">sem valor</span>}
          <span className="funil-cartao__canal">{canalRotulo(n.canal)}</span>
        </span>
        <span className="funil-cartao__meta">
          <span className="funil-cartao__dono">
            <User size={11} weight="fill" />
            {n.responsavel?.nome?.split(" ")[0] || "sem dono"}
          </span>
          {diasParado >= 5 ? (
            <span className="funil-cartao__alerta" title={`Sem contato registrado ${parado}`}>
              <WarningCircle size={11} weight="fill" /> {parado}
            </span>
          ) : (
            <span className="funil-cartao__quando">{parado}</span>
          )}
        </span>
      </button>

      {/* O caminho do toque e do teclado. Ver o cabeçalho: arrastar é o atalho
          do mouse, não o único caminho. */}
      <select
        className="funil-cartao__mover"
        value={n.estagio}
        aria-label={`Mudar a etapa do negócio ${n.codigo}`}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => aoMover(e.target.value)}
      >
        {[...ESTAGIOS_FLOW, ESTAGIO_PERDIDO].map((e) => (
          <option key={e.key} value={e.key}>{e.rotulo}</option>
        ))}
      </select>
    </article>
  );
}

function PerdidosRecolhivel({ itens, aoAbrir }) {
  const [aberto, setAberto] = useState(false);
  if (!itens.length) return null;
  return (
    <div className="funil-perdidos">
      <button type="button" className="funil-perdidos__topo" onClick={() => setAberto((a) => !a)}>
        <span>{aberto ? "▾" : "▸"}</span>
        {itens.length === 1 ? "1 negócio perdido" : `${itens.length} negócios perdidos`}
      </button>
      {aberto ? (
        <div className="funil-perdidos__lista">
          {itens.map((n) => (
            <button key={n.id} type="button" className="funil-perdidos__item" onClick={() => aoAbrir(n.id)}>
              <span>#{n.codigo} · {n.titulo}</span>
              <span>{n.perdidoMotivo || "sem motivo registrado"}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
