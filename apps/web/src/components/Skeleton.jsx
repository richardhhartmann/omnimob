// Placeholders de carregamento (skeleton) com shimmer, usados enquanto os GETs
// das páginas de listagem não retornam. O shimmer vem da classe .skeleton-block
// (definida em styles.css).

export function Skeleton({ width = "100%", height = 14, radius = 8, style }) {
  return <div className="skeleton-block" style={{ width, height, borderRadius: radius, flexShrink: 0, ...style }} />;
}

// Linha de KPIs/estatísticas (topo de Clientes, Leads…).
export function SkeletonStats({ count = 4, minWidth = 190 }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}px, 1fr))`, gap: "16px", marginBottom: "24px" }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-panel" style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: "14px" }}>
          <Skeleton width={40} height={40} radius={11} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "9px", minWidth: 0 }}>
            <Skeleton width="65%" height={9} />
            <Skeleton width="40%" height={18} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Lista de linhas em glass-panel (Clientes, Usuários, Leads, Cargos).
export function SkeletonListRows({ count = 5 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-panel" style={{ display: "flex", alignItems: "center", gap: "14px", padding: "16px 18px" }}>
          <Skeleton width={42} height={42} radius="50%" />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "9px", minWidth: 0 }}>
            <Skeleton width={`${38 + (i % 3) * 8}%`} height={13} />
            <Skeleton width={`${55 + (i % 2) * 10}%`} height={10} />
          </div>
          <Skeleton width={72} height={24} radius={999} style={{ opacity: 0.7 }} />
          <Skeleton width={34} height={34} radius={9} />
        </div>
      ))}
    </div>
  );
}

// Grade de cards (Portfólio de imóveis).
export function SkeletonCards({ count = 6, minWidth = 320 }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}px, 1fr))`, gap: "24px" }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-panel" style={{ padding: 0, overflow: "hidden" }}>
          <Skeleton width="100%" height={180} radius={0} />
          <div style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <Skeleton width="80%" height={15} />
            <Skeleton width="50%" height={11} />
            <div style={{ display: "flex", gap: "8px", marginTop: "2px" }}>
              <Skeleton width={54} height={20} radius={6} />
              <Skeleton width={54} height={20} radius={6} />
              <Skeleton width={54} height={20} radius={6} />
            </div>
            <Skeleton width="45%" height={20} style={{ marginTop: "4px" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Relatórios ─────────────────────────────────────────────────────────────
   Três formatos, um por tela de Relatórios. Cada um imita o ESQUELETO do que
   vai chegar — a fileira de números, as barras do funil, as linhas da tabela —
   e não um retângulo genérico: skeleton que não tem a forma do conteúdo é só
   uma tela cinza piscando, e o olho não ganha nada em ficar olhando para ela.

   Vieram no lugar de "Somando o período…" e "Somando o mês…". Texto de espera
   diz que algo acontece; o skeleton diz o que vem, e o layout não pula quando
   os dados chegam. */

/** Fileira de números (relatório mensal, totais do funil e das comissões). */
export function SkeletonNumeros({ count = 4 }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "26px" }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: "104px" }}>
          <Skeleton width={`${52 + (i % 3) * 14}px`} height={24} />
          <Skeleton width={`${76 + (i % 2) * 22}px`} height={10} />
        </div>
      ))}
    </div>
  );
}

/** Relatório mensal: números + a lista de imóveis mais vistos. */
export function SkeletonRelatorioMensal() {
  return (
    <div style={{ display: "grid", gap: "20px" }}>
      <SkeletonNumeros count={5} />
      <Skeleton width="46%" height={11} />
      <div style={{ display: "grid", gap: "9px" }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Skeleton width={12} height={10} />
            <Skeleton width={`${44 + (i % 3) * 12}%`} height={12} />
            <Skeleton width={58} height={10} style={{ marginLeft: "auto" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Funil: as três barras que estreitam, e os totais embaixo. */
export function SkeletonFunil() {
  // As larguras caem de propósito — o esqueleto já tem a forma de um funil.
  const larguras = ["100%", "62%", "28%"];
  return (
    <div style={{ display: "grid", gap: "22px" }}>
      <div style={{ display: "grid", gap: "12px" }}>
        {larguras.map((w, i) => (
          <div key={i}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <Skeleton width={`${108 + i * 6}px`} height={11} />
              <Skeleton width={64} height={11} />
            </div>
            <Skeleton width={w} height={10} radius={999} />
          </div>
        ))}
      </div>
      <div style={{ paddingTop: "16px", borderTop: "1px solid var(--linha-07, rgba(255,255,255,0.07))" }}>
        <SkeletonNumeros count={3} />
      </div>
    </div>
  );
}

/** Comissões: totais + tabela por corretor. */
export function SkeletonComissoes({ linhas = 4 }) {
  return (
    <div style={{ display: "grid", gap: "20px" }}>
      <SkeletonNumeros count={3} />
      <div style={{ display: "grid", gap: "6px" }}>
        {Array.from({ length: linhas }).map((_, i) => (
          <div
            key={i}
            style={{
              display: "grid", gridTemplateColumns: "1fr 80px 130px 130px", gap: "10px",
              alignItems: "center", padding: "12px", borderRadius: "9px",
              background: "var(--sup-03, rgba(255,255,255,0.03))", border: "1px solid var(--linha-06, rgba(255,255,255,0.06))",
            }}
          >
            <Skeleton width={`${46 + (i % 3) * 14}%`} height={12} />
            <Skeleton width={26} height={11} style={{ marginLeft: "auto" }} />
            <Skeleton width={84} height={11} style={{ marginLeft: "auto" }} />
            <Skeleton width={78} height={11} style={{ marginLeft: "auto" }} />
          </div>
        ))}
      </div>
    </div>
  );
}
