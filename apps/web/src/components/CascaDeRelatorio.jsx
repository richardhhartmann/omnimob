import { StatCard, StatGrid } from "./adminUi.jsx";
import { SkeletonStats } from "./Skeleton";

/* ────────────────────────────────────────────────────────────────────────────
   A casca que todo relatório usa.

   ── POR QUE ELA EXISTE ──

   Os quatro relatórios moram na mesma página e são alcançados pelos mesmos
   cartões, mas cada um tinha a própria moldura: Gestão de Leads abria com
   título, subtítulo, quatro indicadores e uma barra de filtros; os outros três
   começavam direto num painel de vidro, sem título nem contexto. Trocar de
   cartão parecia trocar de produto.

   Aqui a moldura é uma só. O que cada relatório traz é o CONTEÚDO — e os
   números e filtros que fizerem sentido para ele.

   ── O QUE ELA NÃO FAZ ──

   Não busca dado, não sabe de plano e não sabe de permissão. Cada relatório
   continua dono da própria carga: eles têm origens diferentes (leads vêm de uma
   listagem, o mensal de uma agregação, o funil de eventos), e centralizar isso
   aqui obrigaria a casca a conhecer os quatro.

   ── OS INDICADORES SÃO OPCIONAIS, E ISSO É DE PROPÓSITO ──

   Relatório sem número de topo passa `metricas` vazio e a faixa não aparece —
   em vez de mostrar quatro caixas com zero, que é a forma mais rápida de a
   tela mentir. A regra é a mesma de `dadosDaVitrine`: número que não existe é
   ausência, não zero.
   ──────────────────────────────────────────────────────────────────────────── */

export function CascaDeRelatorio({
  titulo,
  subtitulo,
  /* `[{ label, value, accent, icon }]`. Vazio ou ausente = sem faixa. */
  metricas = [],
  /* A barra de filtros, no mesmo painel de vidro que a de Leads. */
  filtros,
  erro,
  carregando = false,
  tourCabecalho,
  tourConteudo,
  children,
}) {
  return (
    <div className="main-content" style={{ maxWidth: "1100px" }}>
      <header data-tour={tourCabecalho} style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "28px", marginBottom: "6px" }}>{titulo}</h1>
        {subtitulo ? (
          <p style={{ color: "var(--text-muted)", margin: 0 }}>{subtitulo}</p>
        ) : null}
      </header>

      {erro ? <div className="error" style={{ marginBottom: "16px" }}>{erro}</div> : null}

      {/* O esqueleto ocupa a mesma faixa que os números vão ocupar, então nada
          pula de lugar quando eles chegam. Só aparece se este relatório TIVER
          números — senão o carregamento inventaria uma faixa que não existe. */}
      {metricas.length ? (
        carregando ? <SkeletonStats count={metricas.length} /> : (
          <StatGrid>
            {metricas.map((m) => (
              <StatCard key={m.label} label={m.label} value={m.value} accent={m.accent} icon={m.icon} />
            ))}
          </StatGrid>
        )
      ) : null}

      {filtros ? (
        <div
          className="glass-panel"
          style={{
            padding: "16px", marginBottom: "20px",
            display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center",
          }}
        >
          {filtros}
        </div>
      ) : null}

      <div data-tour={tourConteudo}>{children}</div>
    </div>
  );
}
