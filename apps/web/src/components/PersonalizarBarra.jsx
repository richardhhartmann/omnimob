import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, MagnifyingGlass, Plus, SlidersHorizontal, Star, Trash } from "@phosphor-icons/react";
import { Modal } from "./Modal.jsx";
import { useConfirm } from "./ConfirmModal.jsx";
import {
  MAXIMO_NOME, MAXIMO_SECOES, adicionarSecao, contarNaSecao, folhasDe, marcar, moverSecao, removerSecao, renomearSecao,
} from "../utils/barraLateral";

/* ────────────────────────────────────────────────────────────────────────────
   PERSONALIZAR BARRA LATERAL — o editor das seções (ver utils/barraLateral.js).
   Porte do VYA (`components/shell/PersonalizarBarra.tsx`).

   À esquerda, as seções da pessoa (criar, renomear, ordenar, apagar). À
   direita, a barra INTEIRA desta pessoa — os mesmos grupos que o cargo e o
   plano dela alcançam, dos dois módulos quando ela tem os dois —, com uma
   caixa em cada tela. Não há "Salvar": cada caixa grava sozinha (otimista,
   ver `useBarraLateral` no AdminLayout).

   Sai por PORTAL (é o `Modal`), fora do `.ds-shell`: por isso a cor do módulo
   chega pela prop `acento`, e não pela variável que a moldura define.
   ──────────────────────────────────────────────────────────────────────────── */

const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** A caixa de marcar, com o meio-termo (alguns filhos marcados). */
function Caixa({ marcado, parcial, aoMudar, children }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = Boolean(parcial) && !marcado; }, [parcial, marcado]);
  return (
    <label className={`pbl-caixa${marcado ? " is-marcado" : ""}`}>
      <input ref={ref} type="checkbox" checked={marcado} onChange={(e) => aoMudar(e.target.checked)} />
      <span className="pbl-rotulo">{children}</span>
    </label>
  );
}

/**
 * @param {Array<{key, nome, grupos}>} modulos  a barra inteira de cada módulo que a pessoa alcança
 */
export function PersonalizarBarra({ aberto, aoFechar, modulos, barra, aoMudar, secaoInicial, acento }) {
  const { confirm, modal: confirmacao } = useConfirm();
  const [selecionada, setSelecionada] = useState(null);
  const [busca, setBusca] = useState("");
  const [nome, setNome] = useState("");
  const nomeRef = useRef(null);

  /* Ao abrir: a seção ativa, senão a primeira. */
  const [abertoAntes, setAbertoAntes] = useState(false);
  if (aberto !== abertoAntes) {
    setAbertoAntes(aberto);
    if (aberto) {
      const inicial = barra.secoes.find((s) => s.id === secaoInicial)?.id ?? barra.secoes[0]?.id ?? null;
      setSelecionada(inicial);
      setNome(barra.secoes.find((s) => s.id === inicial)?.nome ?? "");
      setBusca("");
    }
  }
  const secao = barra.secoes.find((s) => s.id === selecionada) ?? null;
  const escolhidas = useMemo(() => new Set(secao?.itens ?? []), [secao]);
  const todosOsGrupos = useMemo(() => modulos.flatMap((m) => m.grupos), [modulos]);

  const selecionar = (id) => {
    setSelecionada(id);
    setNome(barra.secoes.find((s) => s.id === id)?.nome ?? "");
  };

  const criar = () => {
    const r = adicionarSecao(barra);
    if (!r) return;
    aoMudar(r.barra);
    setSelecionada(r.id);
    setNome(r.barra.secoes.find((s) => s.id === r.id)?.nome ?? "");
    // O nome nasce selecionado: a primeira coisa que a pessoa faz é trocá-lo.
    setTimeout(() => { nomeRef.current?.focus(); nomeRef.current?.select(); }, 30);
  };

  const gravarNome = () => {
    if (!secao) return;
    const nova = renomearSecao(barra, secao.id, nome);
    const gravado = nova.secoes.find((s) => s.id === secao.id)?.nome ?? secao.nome;
    setNome(gravado);
    if (gravado !== secao.nome) aoMudar(nova);
  };

  const apagar = async (id) => {
    const alvo = barra.secoes.find((s) => s.id === id);
    if (!alvo) return;
    if (alvo.itens.length && !(await confirm(`Apagar a seção "${alvo.nome}"? As telas continuam na barra; só a seção some.`, "Apagar"))) return;
    const nova = removerSecao(barra, id);
    aoMudar(nova);
    if (selecionada === id) selecionar(nova.secoes[0]?.id ?? null);
  };

  /* A busca filtra telas pelo nome (do subitem ou do pai). */
  const termo = semAcento(busca.trim());
  const visiveis = useMemo(() => {
    const filtrar = (grupos) => grupos
      .map((g) => ({
        ...g,
        itens: g.itens.flatMap((item) => {
          if (semAcento(item.label).includes(termo)) return [item];
          const subitens = (item.subitens || []).filter((s) => semAcento(s.label).includes(termo));
          return subitens.length ? [{ ...item, subitens }] : [];
        }),
      }))
      .filter((g) => g.itens.length);
    return modulos.map((m) => ({ ...m, grupos: termo ? filtrar(m.grupos) : m.grupos })).filter((m) => m.grupos.length);
  }, [modulos, termo]);

  const linhaDoItem = (item) => {
    const folhas = folhasDe(item);
    const marcadas = folhas.filter((k) => escolhidas.has(k)).length;
    const todas = marcadas === folhas.length;
    const Icone = item.Icon;
    return (
      <div key={item.key} className="pbl-item">
        <Caixa marcado={todas} parcial={marcadas > 0} aoMudar={(v) => secao && aoMudar(marcar(barra, secao.id, folhas, v))}>
          {Icone ? <Icone size={17} weight="duotone" /> : null}
          <span>{item.label}</span>
          {item.subitens?.length ? <small className="pbl-conta">{marcadas}/{folhas.length}</small> : null}
        </Caixa>
        {item.subitens?.length ? (
          <div className="pbl-subitens">
            {/* O próprio pai também é uma tela (a lista, o índice): ele entra
                aqui como a primeira caixa de dentro, com o nome dele. */}
            <Caixa marcado={escolhidas.has(item.key)} aoMudar={(v) => secao && aoMudar(marcar(barra, secao.id, [item.key], v))}>
              {Icone ? <Icone size={15} weight="regular" /> : null}
              <span>{item.label} <em className="pbl-pagina">(a página)</em></span>
            </Caixa>
            {item.subitens.map((s) => {
              const Sub = s.Icon;
              return (
                <Caixa key={s.key} marcado={escolhidas.has(s.key)} aoMudar={(v) => secao && aoMudar(marcar(barra, secao.id, [s.key], v))}>
                  {Sub ? <Sub size={15} weight="regular" /> : null}
                  <span>{s.label}</span>
                </Caixa>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <>
      <Modal
        aberto={aberto}
        aoFechar={aoFechar}
        largura={880}
        adorno={<span className="pbl-adorno" style={{ "--modulo-acento": acento }}><SlidersHorizontal size={20} weight="duotone" /></span>}
        titulo="Personalizar barra lateral"
        subtitulo="Crie seções com as telas que você mais usa e alterne entre elas e a barra inteira. Vale só para você."
        acoes={<>
          <span className="pbl-salvo">As mudanças são salvas sozinhas.</span>
          <button type="button" className="pbl-pronto" style={{ "--modulo-acento": acento }} onClick={aoFechar}>Pronto</button>
        </>}
      >
        <div className="pbl-corpo" style={{ "--modulo-acento": acento }}>
          <aside className="pbl-secoes" aria-label="Suas seções">
            <span className="pbl-titulo">Suas seções</span>
            {barra.secoes.length === 0 ? <p className="pbl-dica">Nenhuma seção ainda.</p> : null}
            <ul>
              {barra.secoes.map((s, i) => (
                <li key={s.id} className={`pbl-secao${s.id === selecionada ? " is-selecionada" : ""}`}>
                  <button type="button" className="pbl-secao-nome" onClick={() => selecionar(s.id)} aria-current={s.id === selecionada ? "true" : undefined}>
                    <Star size={15} weight={s.id === barra.ativa ? "fill" : "duotone"} />
                    <span>{s.nome}</span>
                    <small>{contarNaSecao(todosOsGrupos, s)}</small>
                  </button>
                  <span className="pbl-secao-acoes">
                    <button type="button" title="Subir" aria-label={`Subir ${s.nome}`} disabled={i === 0} onClick={() => aoMudar(moverSecao(barra, s.id, -1))}><ArrowUp size={13} weight="bold" /></button>
                    <button type="button" title="Descer" aria-label={`Descer ${s.nome}`} disabled={i === barra.secoes.length - 1} onClick={() => aoMudar(moverSecao(barra, s.id, 1))}><ArrowDown size={13} weight="bold" /></button>
                    <button type="button" title="Apagar seção" aria-label={`Apagar ${s.nome}`} className="is-perigo" onClick={() => void apagar(s.id)}><Trash size={13} weight="bold" /></button>
                  </span>
                </li>
              ))}
            </ul>
            <button type="button" className="pbl-adicionar" onClick={criar} disabled={barra.secoes.length >= MAXIMO_SECOES}
              title={barra.secoes.length >= MAXIMO_SECOES ? `No máximo ${MAXIMO_SECOES} seções` : undefined}>
              <Plus size={15} weight="bold" /> Adicionar seção
            </button>
          </aside>

          <section className="pbl-destinos">
            {!secao ? (
              <div className="pbl-vazio">
                <Star size={28} weight="duotone" />
                <p><strong>Monte a sua barra.</strong> Crie uma seção — “Favoritos”, por exemplo — e marque as telas que entram nela. Depois é só alternar no topo da barra lateral.</p>
                <button type="button" className="pbl-pronto" onClick={criar}><Plus size={15} weight="bold" /> Criar a primeira seção</button>
              </div>
            ) : (
              <>
                <div className="pbl-cabeca">
                  <label className="pbl-campo">
                    <span className="pbl-titulo">Nome da seção</span>
                    <input ref={nomeRef} type="text" value={nome} maxLength={MAXIMO_NOME}
                      onChange={(e) => setNome(e.target.value)} onBlur={gravarNome}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); gravarNome(); } }} />
                  </label>
                  <label className="pbl-campo">
                    <span className="pbl-titulo">Buscar tela</span>
                    <span className="pbl-busca">
                      <MagnifyingGlass size={15} aria-hidden="true" />
                      <input type="search" value={busca} placeholder="Ex.: portfólio" onChange={(e) => setBusca(e.target.value)} />
                    </span>
                  </label>
                </div>
                <div className="pbl-lista">
                  {visiveis.length === 0 ? <p className="pbl-dica">Nenhuma tela com &quot;{busca}&quot;.</p> : null}
                  {visiveis.map((m) => (
                    <div key={m.key} className="pbl-modulo">
                      {modulos.length > 1 ? <span className="pbl-modulo-nome">{m.nome}</span> : null}
                      {m.grupos.map((g, gi) => (
                        <div key={g.label || `g-${gi}`} className="pbl-grupo">
                          <span className="pbl-grupo-nome">{g.label || "Geral"}</span>
                          {g.itens.map(linhaDoItem)}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </Modal>
      {confirmacao}
    </>
  );
}
