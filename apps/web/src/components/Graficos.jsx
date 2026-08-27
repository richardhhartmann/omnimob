/* ────────────────────────────────────────────────────────────────────────────
   OS GRÁFICOS DO PAINEL.

   SVG escrito à mão, sem biblioteca. Não é purismo: `recharts` são ~120 kB
   comprimidos e `chart.js` ~70 kB, para desenhar três formas que cabem em
   duzentas linhas. O painel é a PRIMEIRA tela depois do login, e o peso dela é
   o que a pessoa espera todo dia de manhã.

   ── AS REGRAS DESTES DESENHOS ──

   1. `viewBox` + `preserveAspectRatio="none"` no lugar de medir o contêiner.
      Um gráfico que depende de `ResizeObserver` desenha errado no primeiro
      quadro e salta quando a medida chega. Com `viewBox` o SVG nasce no
      tamanho certo, e o CSS estica.

   2. ZERO E AUSÊNCIA SÃO COISAS DIFERENTES, e é a mesma regra do
      `painelGestor.js` do servidor. Série toda zerada não vira uma linha
      rasteira no fundo do gráfico — vira uma frase dizendo que não houve
      movimento. Uma linha achatada parece dado; e é o dado que não existe.

   3. Nada de rótulo em todo ponto. Trinta datas no eixo viram uma tarja
      cinzenta ilegível: saem a primeira, o meio e a última.
   ──────────────────────────────────────────────────────────────────────────── */

const AUSENTE = "—";

/** Caminho suave por entre os pontos. Curva de Catmull-Rom convertida em
 *  Bézier cúbica — a fórmula fechada, sem biblioteca.
 *
 *  Reta ligando ponto a ponto também funcionaria, e a diferença é de leitura:
 *  numa série diária os bicos de um dia isolado dominam o desenho e o olho
 *  perde a tendência, que é a única coisa que este gráfico existe para mostrar. */
function caminhoSuave(pontos) {
  if (pontos.length < 2) return "";
  let d = `M ${pontos[0].x} ${pontos[0].y}`;
  for (let i = 0; i < pontos.length - 1; i += 1) {
    const p0 = pontos[i - 1] || pontos[i];
    const p1 = pontos[i];
    const p2 = pontos[i + 1];
    const p3 = pontos[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

const diaCurto = (iso) => {
  const [, m, d] = String(iso).split("-");
  return `${d}/${m}`;
};

const MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mesCurto = (iso) => {
  const [ano, mes] = String(iso).split("-");
  return `${MES_CURTO[Number(mes) - 1] || "?"}/${String(ano).slice(2)}`;
};

/* ════════════════════════════════════════════════════════════════════════════
   LINHA DUPLA — visitas e interessados, dia a dia
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * @param {Array<{dia:string, visitas:number, leads:number}>} serie
 */
export function GraficoDeMovimento({ serie = [], titulo }) {
  const dados = Array.isArray(serie) ? serie : [];
  const totalVisitas = dados.reduce((s, d) => s + (d.visitas || 0), 0);
  const totalLeads = dados.reduce((s, d) => s + (d.leads || 0), 0);

  if (!dados.length || (!totalVisitas && !totalLeads)) {
    return (
      <div className="gr-vazio">
        <p>Nenhuma visita ou interessado nos últimos {dados.length || 30} dias.</p>
        <small>Assim que a vitrine receber movimento, ele aparece aqui.</small>
      </div>
    );
  }

  const L = 520;
  const A = 150;
  const margem = { topo: 12, base: 22, esq: 4, dir: 4 };
  const larguraUtil = L - margem.esq - margem.dir;

  /* ── DUAS SÉRIES, DUAS CODIFICAÇÕES ─────────────────────────────────────

     A primeira versão desenhava as duas como linha, na MESMA escala, com o
     argumento de que escalas separadas mentiriam sobre a proporção. O
     argumento estava certo e o resultado, errado: uma imobiliária tem ~2500
     visitas e ~100 interessados no mês, e nessa proporção a linha dos
     interessados vira um traço reto colado no chão. Ela não mentia — ela não
     dizia nada, e ocupava um lugar como se dissesse.

     A saída não é dar um segundo eixo à mesma forma (aí sim duas linhas
     paralelas convidariam a comparar alturas que não se comparam). É trocar a
     FORMA: visitas continuam sendo a área contínua em cima, interessados viram
     barras na faixa de baixo, com escala própria. Área e barra não se
     comparam de relance, então ninguém lê "os interessados alcançaram as
     visitas" — e cada série volta a mostrar o seu próprio movimento.

     A faixa de baixo é um quarto da altura: o suficiente para a variação
     aparecer, pouco o bastante para não competir com a série principal. */
  const faixaLeads = 0.26;
  const alturaTotal = A - margem.topo - margem.base;
  const alturaUtil = alturaTotal * (1 - faixaLeads) - 6;
  const baseLeads = margem.topo + alturaTotal;
  const alturaBarras = alturaTotal * faixaLeads;

  const tetoVisitas = Math.max(1, ...dados.map((d) => d.visitas || 0));
  const tetoLeads = Math.max(1, ...dados.map((d) => d.leads || 0));

  const emX = (i) => margem.esq + (dados.length === 1 ? larguraUtil / 2 : (i / (dados.length - 1)) * larguraUtil);
  const emY = (v) => margem.topo + alturaUtil - ((v || 0) / tetoVisitas) * alturaUtil;

  const pVisitas = dados.map((d, i) => ({ x: emX(i), y: emY(d.visitas) }));
  const linhaVisitas = caminhoSuave(pVisitas);
  const areaVisitas = `${linhaVisitas} L ${emX(dados.length - 1)} ${margem.topo + alturaUtil} L ${emX(0)} ${margem.topo + alturaUtil} Z`;

  // Largura da barra: o vão entre pontos menos um respiro, com piso de 1px.
  const larguraBarra = Math.max(1, (larguraUtil / Math.max(dados.length, 1)) * 0.62);

  const marcos = [0, Math.floor((dados.length - 1) / 2), dados.length - 1];

  return (
    <div className="gr">
      <div className="gr-legenda">
        {titulo ? <span className="gr-legenda__titulo">{titulo}</span> : null}
        {/* O marcador da legenda copia a forma do gráfico — bolinha para a
            área, barrinha para as barras. Duas bolinhas iguais fariam a pessoa
            procurar duas linhas. */}
        <span className="gr-chip"><i style={{ background: "#0ea5e9" }} /> {totalVisitas} visitas</span>
        <span className="gr-chip">
          <i className="is-barra" style={{ background: "#6366f1" }} /> {totalLeads} interessados
        </span>
      </div>

      <svg className="gr-svg" viewBox={`0 0 ${L} ${A}`} preserveAspectRatio="none" role="img"
        aria-label={`Movimento dos últimos ${dados.length} dias: ${totalVisitas} visitas e ${totalLeads} interessados.`}>
        <defs>
          <linearGradient id="gr-area-visitas" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Três linhas de apoio. Mais que isso vira grade quadriculada e o
            desenho compete com o dado. */}
        {[0, 0.5, 1].map((f) => (
          <line key={f} x1={margem.esq} x2={L - margem.dir}
            y1={margem.topo + alturaUtil * f} y2={margem.topo + alturaUtil * f}
            className="gr-guia" />
        ))}

        <path d={areaVisitas} fill="url(#gr-area-visitas)" />
        <path d={linhaVisitas} className="gr-linha" style={{ stroke: "#0ea5e9" }} />

        {/* O último ponto ganha marcador: é "hoje", e é o número que a pessoa
            procura primeiro. */}
        {totalVisitas ? <circle cx={pVisitas.at(-1).x} cy={pVisitas.at(-1).y} r="3.5" fill="#0ea5e9" /> : null}

        {/* Os interessados, na faixa de baixo e com escala própria. */}
        {dados.map((d, i) => {
          if (!d.leads) return null;
          const h = Math.max(1.5, (d.leads / tetoLeads) * alturaBarras);
          return (
            <rect
              key={d.dia}
              x={emX(i) - larguraBarra / 2}
              y={baseLeads - h}
              width={larguraBarra}
              height={h}
              rx={larguraBarra / 3}
              fill="#6366f1"
              opacity={i === dados.length - 1 ? 1 : 0.8}
            />
          );
        })}
      </svg>

      <div className="gr-eixo">
        {marcos.map((i) => <span key={i}>{diaCurto(dados[i]?.dia)}</span>)}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   BARRAS — faturamento mês a mês
   ════════════════════════════════════════════════════════════════════════════ */

export function GraficoDeFaturamento({ meses = [], titulo }) {
  const dados = Array.isArray(meses) ? meses : [];
  const total = dados.reduce((s, m) => s + (m.faturamento || 0), 0);

  if (!dados.length || !total) {
    return (
      <div className="gr-vazio">
        <p>Nenhuma venda registrada nos últimos {dados.length || 6} meses.</p>
        <small>Vendas entram pelo funil, em Relatórios.</small>
      </div>
    );
  }

  const teto = Math.max(...dados.map((m) => m.faturamento || 0));
  const brlCurto = (v) => {
    if (!v) return AUSENTE;
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
    if (v >= 1000) return `${Math.round(v / 1000)}k`;
    return String(Math.round(v));
  };

  return (
    <div className="gr">
      {titulo ? <div className="gr-legenda"><span className="gr-legenda__titulo">{titulo}</span></div> : null}
      <div className="gr-barras">
        {dados.map((m) => {
          const alturaPct = teto ? Math.max(2, ((m.faturamento || 0) / teto) * 100) : 2;
          const ultimo = m === dados[dados.length - 1];
          return (
            <div className="gr-barra" key={m.mes}>
              {/* O valor fica em cima da barra, e não numa legenda lateral:
                  seis números soltos ao lado obrigam a contar posições para
                  saber de qual mês é cada um. */}
              <span className="gr-barra__valor">{m.faturamento ? brlCurto(m.faturamento) : ""}</span>
              <span className="gr-barra__trilho">
                <span
                  className={`gr-barra__preenchida${ultimo ? " is-atual" : ""}`}
                  style={{ height: `${alturaPct}%` }}
                />
              </span>
              <span className="gr-barra__rotulo">{mesCurto(m.mes)}</span>
              <span className="gr-barra__apoio">
                {m.vendas ? `${m.vendas} ${m.vendas === 1 ? "venda" : "vendas"}` : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   FUNIL — onde os interessados estão parados

   Barras horizontais, e não o trapézio clássico. O funil desenhado fica bonito
   e MENTE: a largura de cada faixa é proporcional à faixa anterior, então uma
   etapa que perde 90% e outra que perde 10% podem sair com a mesma inclinação.
   Barra é comparável de relance e não precisa de legenda. É a mesma escolha já
   feita em `FlowInicioPage`.
   ════════════════════════════════════════════════════════════════════════════ */

const ROTULO_ESTAGIO = {
  NOVO: "Novo",
  EM_ATENDIMENTO: "Em atendimento",
  VISITA: "Visita",
  PROPOSTA: "Proposta",
  GANHO: "Ganho",
  PERDIDO: "Perdido",
};

const COR_ESTAGIO = {
  NOVO: "#6366f1",
  EM_ATENDIMENTO: "#0ea5e9",
  VISITA: "#14b8a6",
  PROPOSTA: "#f59e0b",
  GANHO: "#10b981",
  PERDIDO: "#94a3b8",
};

export function GraficoDeFunil({ funil = [], titulo, aoClicar }) {
  const dados = Array.isArray(funil) ? funil : [];
  const total = dados.reduce((s, e) => s + (e.total || 0), 0);

  if (!total) {
    return (
      <div className="gr-vazio">
        <p>Nenhum interessado registrado ainda.</p>
        <small>Cada contato pela vitrine entra aqui como "Novo".</small>
      </div>
    );
  }

  const teto = Math.max(...dados.map((e) => e.total || 0));

  return (
    <div className="gr">
      {titulo ? <div className="gr-legenda"><span className="gr-legenda__titulo">{titulo}</span></div> : null}
      <ul className="gr-funil">
        {dados.map((e) => {
          const pct = teto ? ((e.total || 0) / teto) * 100 : 0;
          const cor = COR_ESTAGIO[e.estagio] || "#6366f1";
          const Elemento = aoClicar ? "button" : "div";
          return (
            <li key={e.estagio}>
              <Elemento
                className="gr-funil__linha"
                {...(aoClicar ? { type: "button", onClick: () => aoClicar(e.estagio) } : {})}
              >
                <span className="gr-funil__rotulo">{ROTULO_ESTAGIO[e.estagio] || e.estagio}</span>
                <span className="gr-funil__trilho">
                  <span className="gr-funil__preenchida" style={{ width: `${Math.max(pct, e.total ? 3 : 0)}%`, background: cor }} />
                </span>
                <span className="gr-funil__num">{e.total}</span>
                {/* A fatia do total, que é a pergunta real: "quantos dos meus
                    interessados estão parados aqui?" */}
                <span className="gr-funil__pct">{total ? `${Math.round((e.total / total) * 100)}%` : ""}</span>
              </Elemento>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   ORIGENS — de onde vêm os interessados
   ════════════════════════════════════════════════════════════════════════════ */

const NOME_DA_ORIGEM = {
  showcase: "Vitrine",
  vitrine: "Vitrine",
  ZAP: "ZAP Imóveis",
  VIVAREAL: "VivaReal",
  OLX: "OLX Imóveis",
  MERCADOLIVRE: "Mercado Livre",
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  api: "Integração",
  desconhecida: "Origem não informada",
};

const CORES_ORIGEM = ["#6366f1", "#0ea5e9", "#14b8a6", "#f59e0b", "#a78bfa", "#94a3b8"];

export function GraficoDeOrigens({ origens = [], titulo }) {
  const dados = (Array.isArray(origens) ? origens : []).filter((o) => o.total > 0);
  const total = dados.reduce((s, o) => s + o.total, 0);

  if (!total) {
    return (
      <div className="gr-vazio">
        <p>Ainda não há interessados para atribuir a uma origem.</p>
        <small>Vitrine, portais e redes aparecem aqui separados.</small>
      </div>
    );
  }

  return (
    <div className="gr">
      {titulo ? <div className="gr-legenda"><span className="gr-legenda__titulo">{titulo}</span></div> : null}

      {/* Uma barra empilhada, e não uma rosca: a pergunta é "qual canal traz
          mais?", que é comparação de comprimento. Ângulo é a forma mais
          difícil de comparar que existe, e a rosca ainda gasta o dobro do
          espaço para dizer o mesmo. */}
      <div className="gr-pilha" role="img" aria-label={`Origens dos ${total} interessados dos últimos 90 dias.`}>
        {dados.map((o, i) => (
          <span
            key={o.origem}
            className="gr-pilha__fatia"
            style={{ width: `${(o.total / total) * 100}%`, background: CORES_ORIGEM[i % CORES_ORIGEM.length] }}
          />
        ))}
      </div>

      <ul className="gr-origens">
        {dados.map((o, i) => (
          <li key={o.origem}>
            <i style={{ background: CORES_ORIGEM[i % CORES_ORIGEM.length] }} />
            <span className="gr-origens__nome">{NOME_DA_ORIGEM[o.origem] || o.origem}</span>
            <span className="gr-origens__num">{o.total}</span>
            <span className="gr-origens__pct">{Math.round((o.total / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
