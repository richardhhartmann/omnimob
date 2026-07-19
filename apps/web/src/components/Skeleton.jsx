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
