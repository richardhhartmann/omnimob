import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { Plus, User, WarningCircle, ArrowSquareOut } from "@phosphor-icons/react";
import { api } from "../../api";
import { PageHeader, SearchInput, FilterTabs } from "../../components/adminUi";
import { ESTAGIOS_FLOW, ESTAGIO_PERDIDO, reais, desdeQuando, canalRotulo } from "../../utils/flow";
import { ModalTravaDeFechamento } from "../../components/flow/ModalTravaDeFechamento.jsx";
import { SelectCustom } from "../../components/SelectCustom.jsx";

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

   ── O NEGÓCIO NASCE DENTRO DA COLUNA ──

   Não há mais botão "Novo negócio" no topo desta tela, e a ausência é a
   feature. Aquele botão levava ao formulário inteiro — dez campos — para uma
   coisa que quase sempre tem dois: um nome e um dono. Pior, ele abria o negócio
   sempre em LEAD, e quem estava olhando a coluna de Visita tinha que criar,
   voltar ao quadro e arrastar o cartão até lá.

   O "+" de cada coluna resolve os três: o negócio nasce na etapa que a pessoa
   está olhando, com o responsável escolhido ali mesmo, sem sair do quadro. O
   formulário completo continua existindo e continua alcançável — pela lista em
   `/flow/negocios`, que é onde se abre um negócio com imóvel, comprador,
   vendedor e valor de proposta. Uma porta rápida e uma porta completa; o erro
   seria ter só a completa, que era o estado anterior.

   GANHO não ganha o "+", e é a única exceção: nascer ganho seria a porta que o
   servidor já recusa (ver `POST /flow/negocios`). Fechar é um movimento, e a
   trava responde no movimento.

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
  /* Qual coluna está com o formulário rápido aberto — uma de cada vez. Dois
     formulários abertos no quadro fariam a pessoa preencher o errado, e o
     errado aqui é um negócio na etapa errada. */
  const [compondoEm, setCompondoEm] = useState(null);
  /* Para quem o negócio pode ser aberto. Vem de `GET /api/usuarios`, que exige
     `gerenciarUsuarios` — quem não tem a permissão recebe lista vazia e o
     seletor fica só com "Distribuir pela fila", que é o padrão certo de
     qualquer forma. Mesmo `catch` que o formulário completo já faz. */
  const [usuarios, setUsuarios] = useState([]);

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

  useEffect(() => {
    if (!tenantSlug) return;
    api.listUsuarios(tenantSlug)
      .then((u) => setUsuarios((Array.isArray(u) ? u : u?.usuarios || []).filter((x) => x.ativo)))
      .catch(() => setUsuarios([]));
  }, [tenantSlug]);

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
      /* `pendencias` traz a chave do ícone; `motivos` é a forma antiga, e fica
         de reserva para o intervalo de um deploy em que a aba já tem o JS novo
         e a API ainda não. Ver `ListaDePendencias`. */
      const pendencias = erro?.body?.pendencias;
      const motivos = erro?.body?.motivos;
      const lista = (Array.isArray(pendencias) && pendencias.length ? pendencias : motivos) || [];
      if (lista.length) {
        setTrava({ negocio, pendencias: lista, destino });
      } else {
        showToast?.(erro.message || "Não consegui mover o negócio.", "error");
      }
    }
  }, [tenantSlug, carregar]);

  /* ── Abrir o negócio na própria coluna ────────────────────────────────────
     Não é otimista, ao contrário do arrasto: o cartão precisa do `codigo` que o
     servidor gera (é um id que PESSOAS dizem em voz alta), e um cartão que
     aparece como "#—" e depois se corrige lê como defeito.

     O que NÃO se faz aqui é recarregar o quadro inteiro: `carregar()` acende os
     esqueletos em todas as sete colunas, e o quadro pisca por causa de um
     cartão. O criado entra na lista com o responsável resolvido daqui — inclusive
     quando quem escolheu foi a fila do servidor, que devolve o id de volta. */
  const abrir = useCallback(async (estagio, { titulo, responsavelId }) => {
    const criado = await api.criarNegocio(tenantSlug, {
      titulo,
      responsavelId: responsavelId || null,
      estagio,
      /* "Outro", e não "Site": o quadro não sabe de onde a pessoa veio, e
         carimbar Site/Vitrine num negócio aberto à mão sujaria o relatório de
         origem — que é justamente o que a captação existe para responder. */
      canal: "OUTRO",
      origem: "aberto no funil",
    });
    const dono = usuarios.find((u) => u.id === criado.responsavelId) || null;
    setNegocios((atuais) => [
      { ...criado, responsavel: dono ? { id: dono.id, nome: dono.nome } : null },
      ...atuais,
    ]);
    showToast?.(`Negócio ${criado.codigo} aberto em ${rotuloDe(estagio)}.`);
  }, [tenantSlug, usuarios, showToast]);

  /* ── O ÍMÃ ────────────────────────────────────────────────────────────────
     Qual cartão está na mão. Ele vira um VÃO FANTASMA no alto da coluna sob o
     ponteiro: o gesto passa a mostrar onde o cartão vai cair, em vez de só
     pintar a coluna de outra cor e deixar a pessoa deduzir.

     ── POR QUE UM FANTASMA, E NÃO O CARTÃO DE VERDADE ──

     Mover o cartão original para a coluna alvo daria a mesma imagem e quebraria
     o gesto: o React remonta o nó ao trocá-lo de pai, e o elemento que o
     navegador está arrastando deixa de existir no meio do arrasto — o `dragend`
     pode nunca disparar, e o quadro ficaria com um cartão meio transparente
     preso para sempre. O fantasma é um nó A MAIS, sem `draggable`, então o
     original nunca sai do lugar até o servidor confirmar.

     Some quando a coluna alvo é a de casa: ali não há para onde ir, e um vão
     aberto acima do próprio cartão prometeria um movimento que não acontece. */
  const emVoo = arrastando ? negocios.find((n) => n.id === arrastando) : null;
  const imaEm = emVoo && colunaAlvo && colunaAlvo !== emVoo.estagio ? colunaAlvo : null;

  return (
    <div data-tour="flow-funil">
      <PageHeader
        title="Funil de vendas"
        subtitle="Abra um negócio no “+” da própria etapa. Arraste o cartão para mudar de fase — ou use o seletor dentro dele."
        /* Sem botão. Ver o cabeçalho do arquivo: o negócio nasce dentro da
           coluna, e um "Novo negócio" no topo voltaria a abri-lo sempre em Lead
           e sempre pelo formulário de dez campos. O formulário completo continua
           a um clique, na lista — o rodapé do quadro leva até lá. */
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
        pendencias={trava?.pendencias || []}
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
              onDragOver={(e) => {
                e.preventDefault();
                /* O cursor precisa dizer "move", e não "copy" — sem isto o
                   navegador desenha um "+" ao lado do ponteiro, prometendo uma
                   duplicata do negócio. */
                e.dataTransfer.dropEffect = "move";
                setColunaAlvo(estagio.key);
              }}
              /* ── `dragleave` BORBULHA, e é isso que fazia o vão piscar ──────
                 Entrar num cartão de dentro da coluna dispara `dragleave` no
                 cartão, que sobe até aqui — a coluna "perdia" o ponteiro que
                 nunca a deixou. Com `dragover` re-marcando logo em seguida, o
                 realce sozinho só tremia de leve; o fantasma, que ocupa altura,
                 piscaria o quadro inteiro.

                 `relatedTarget` é para onde o ponteiro FOI: se ainda está aqui
                 dentro, não houve saída nenhuma. */
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget)) return;
                setColunaAlvo((a) => (a === estagio.key ? null : a));
              }}
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
                {/* O vão. Fica no ALTO e não sob o ponteiro: a coluna é uma
                    fila sem ordem interna — quem chega vai para cima —, e um
                    vão que persegue o cursor prometeria uma posição que o
                    quadro não guarda. */}
                {imaEm === estagio.key ? (
                  <div className="funil-ima" aria-hidden="true">
                    <span className="funil-ima__codigo">#{emVoo.codigo}</span>
                    <span className="funil-ima__titulo">{emVoo.titulo}</span>
                    <span className="funil-ima__destino">solte para mover para {estagio.rotulo}</span>
                  </div>
                ) : null}
                {carregando ? (
                  <>
                    <div className="skeleton-block" style={{ height: 86, borderRadius: 11, marginBottom: 8 }} />
                    <div className="skeleton-block" style={{ height: 86, borderRadius: 11 }} />
                  </>
                ) : itens.length === 0 ? (
                  imaEm === estagio.key ? null : <p className="funil-col__vazia">{estagio.descricao}</p>
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

              {/* ── Abrir aqui ────────────────────────────────────────────
                  GANHO fica de fora: nascer ganho é a porta que o servidor
                  recusa, e um "+" que sempre dá erro ensina a não confiar na
                  tela. Ver o cabeçalho do arquivo. */}
              {estagio.key !== "GANHO" && !carregando ? (
                compondoEm === estagio.key ? (
                  <ComporNegocio
                    estagio={estagio}
                    usuarios={usuarios}
                    aoCancelar={() => setCompondoEm(null)}
                    aoCriar={(dados) => abrir(estagio.key, dados)}
                    aoFalhar={(msg) => showToast?.(msg, "error")}
                  />
                ) : (
                  <button
                    type="button"
                    className="funil-col__novo"
                    onClick={() => setCompondoEm(estagio.key)}
                  >
                    <Plus size={13} weight="bold" /> Adicionar negócio
                  </button>
                )
              ) : null}
            </section>
          );
        })}
      </div>

      {/* A porta completa. Ela não sumiu com o botão do topo — mudou de lugar e
          de peso: quem precisa amarrar imóvel, comprador, vendedor e valor de
          proposta na abertura vem por aqui, e é uma minoria dos negócios. */}
      <p className="funil-rodape">
        Precisa abrir um negócio já com imóvel, comprador e valor?{" "}
        <button type="button" onClick={() => navigate("/flow/negocios/novo")}>
          Use o cadastro completo <ArrowSquareOut size={12} weight="bold" />
        </button>
      </p>

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

/* ────────────────────────────────────────────────────────────────────────────
   O FORMULÁRIO RÁPIDO DA COLUNA.

   Dois campos, e os dois são os que a pessoa tem na cabeça no momento em que
   decide registrar: como chamar este negócio, e de quem ele é. O resto — imóvel,
   comprador, vendedor, valor — chega depois, na ficha, quando existir. Um
   formulário que exigisse tudo na abertura empurraria o corretor a inventar
   dados, ou a não registrar nada; é o mesmo raciocínio que já governa o
   `NegocioNovoPage`, aplicado a uma tela onde ele importa mais, porque aqui o
   gesto tem que caber entre duas ligações.

   ── ENTER ABRE, ESCAPE FECHA ──

   É um quadro, e num quadro se digita rápido. Sem as duas teclas o gesto vira
   digitar, tirar a mão do teclado, mirar um botão de 90px e voltar — três vezes
   mais caro que o registro em si.

   ── O RESPONSÁVEL EM BRANCO NÃO É "SEM DONO" ──

   Vazio manda para a MESMA roleta que distribui os leads, que escolhe por
   carga. O rótulo diz isso: "nenhum" faria parecer que o negócio ficaria órfão,
   e a pessoa escolheria alguém só para não deixar em branco — furando o
   rodízio.
   ────────────────────────────────────────────────────────────────────────── */
function ComporNegocio({ estagio, usuarios, aoCancelar, aoCriar, aoFalhar }) {
  const [titulo, setTitulo] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [salvando, setSalvando] = useState(false);
  const campoRef = useRef(null);

  useEffect(() => { campoRef.current?.focus(); }, []);

  async function enviar() {
    const nome = titulo.trim();
    if (!nome) { campoRef.current?.focus(); return; }
    setSalvando(true);
    try {
      await aoCriar({ titulo: nome, responsavelId });
      /* Fecha e some. A alternativa — limpar e continuar aberto, como o Jira faz
         — foi descartada: lá se cadastram vinte tarefas de uma vez, e aqui um
         negócio novo é um evento do dia. O formulário aberto sobre uma coluna
         que acabou de ganhar um cartão esconderia justamente o cartão. */
      aoCancelar();
    } catch (erro) {
      aoFalhar?.(erro.message || "Não consegui abrir o negócio.");
      setSalvando(false);
    }
  }

  return (
    <div className="funil-compor" style={{ "--cor": estagio.cor }}>
      <input
        ref={campoRef}
        className="funil-compor__nome"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        placeholder="Ex.: Maria Silva — apto no Centro"
        aria-label={`Nome do negócio em ${estagio.rotulo}`}
        disabled={salvando}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); enviar(); }
          if (e.key === "Escape") { e.preventDefault(); aoCancelar(); }
        }}
      />
      <div onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); aoCancelar(); } }}>
        {/* O Escape mora no invólucro, e não no controle: `SelectCustom` trata
            a própria tecla para fechar a lista, e o evento não sobe quando ela
            está aberta — que é o certo. Fechada, ele chega aqui e cancela o
            formulário, como no campo de texto ao lado. */}
        <SelectCustom
          size="sm"
          value={responsavelId}
          onChange={setResponsavelId}
          disabled={salvando}
          ariaLabel="Responsável pelo negócio"
          options={[
            { value: "", label: "Distribuir pela fila", description: "Escolhe por carga." },
            ...usuarios.map((u) => ({ value: u.id, label: u.nome })),
          ]}
        />
      </div>
      <div className="funil-compor__acoes">
        <button type="button" className="funil-compor__ok" onClick={enviar} disabled={salvando}>
          {salvando ? "Abrindo…" : "Adicionar"}
        </button>
        <button type="button" className="funil-compor__cancelar" onClick={aoCancelar} disabled={salvando}>
          Cancelar
        </button>
      </div>
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
      {/* O `stopPropagation` continua indispensável: o corpo do cartão inteiro
          abre o negócio, e sem ele escolher uma etapa navegaria junto.
          A cor de cada estágio vira a bolinha do `SelectCustom` — a mesma rampa
          fria→quente que as colunas usam, agora dentro da lista. */}
      <div className="funil-cartao__mover" onClick={(e) => e.stopPropagation()}>
        <SelectCustom
          size="sm"
          value={n.estagio}
          onChange={aoMover}
          ariaLabel={`Mudar a etapa do negócio ${n.codigo}`}
          options={[...ESTAGIOS_FLOW, ESTAGIO_PERDIDO].map((e) => ({
            value: e.key, label: e.rotulo, color: e.cor,
          }))}
        />
      </div>
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
