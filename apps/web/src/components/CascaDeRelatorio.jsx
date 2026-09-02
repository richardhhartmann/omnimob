import { StatCard, StatGrid } from "./adminUi.jsx";
import { SkeletonStats } from "./Skeleton";
import { useTituloDaTela } from "../utils/contextoDeCabecalho.jsx";

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
  /* O nome do relatório sobe para a faixa do painel, como o de toda tela. */
  useTituloDaTela({ titulo, subtitulo });

  return (
    /* ── SEM `main-content` AQUI ──────────────────────────────────────────
       Esta div morava DENTRO do `<main class="main-content">` do layout, com a
       mesma classe: o padding de 32px valia duas vezes (64 de cada lado), e o
       recuo que o conteúdo ganha quando a barra abre valia duas vezes também —
       era o vão gigante à esquerda nos quatro relatórios.

       Aninhar a classe funcionava por acidente enquanto o `<main>` tinha
       `margin: 0 auto` e um teto de 1200px: as duas caixas centralizadas
       coincidiam e ninguém via a soma. */
    <div className="casca-relatorio">
      {/* A âncora do tour fica: dois passos do primeiro acesso a procuram, e o
          cabeçalho que ela marcava mudou de lugar, não de existência. */}
      <div data-tour={tourCabecalho} aria-hidden="true" />

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
