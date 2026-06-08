// Utilitários e componentes compartilhados das páginas administrativas
// (Clientes, Usuários, Cargos) — mantêm um visual consistente.

export function initial(name) {
  const c = (name || "").trim().charAt(0);
  return c ? c.toUpperCase() : "?";
}

// Cor estável (por hash do texto) para avatares.
export function avatarColor(seed) {
  const s = seed || "?";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return `hsl(${h}, 55%, 52%)`;
}

export function Avatar({ name, size = 40, seed }) {
  return (
    <div style={{
      width: `${size}px`, height: `${size}px`, borderRadius: "50%", flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: avatarColor(seed || name), color: "#fff",
      fontWeight: "700", fontSize: `${Math.round(size * 0.4)}px`,
    }}>
      {initial(name)}
    </div>
  );
}

export function StatCard({ label, value, accent = "#6366f1", icon }) {
  return (
    <div className="glass-panel" style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: "12px" }}>
      <div style={{ width: "40px", height: "40px", borderRadius: "11px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `${accent}22`, color: accent }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: "22px", fontWeight: "700", lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>{label}</div>
      </div>
    </div>
  );
}

export function StatGrid({ children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "14px", marginBottom: "20px" }}>
      {children}
    </div>
  );
}

// Segmentado de filtros (ex.: Todos / Ativos / Inativos).
export function FilterTabs({ value, onChange, options }) {
  return (
    <div style={{ display: "flex", background: "rgba(0,0,0,0.2)", borderRadius: "10px", padding: "3px", border: "1px solid rgba(255,255,255,0.08)" }}>
      {options.map((opt) => (
        <button key={opt.key} type="button" onClick={() => onChange(opt.key)}
          style={{
            width: "auto", padding: "7px 14px", borderRadius: "7px", border: "none", fontSize: "13px", fontWeight: "600", cursor: "pointer",
            background: value === opt.key ? "rgba(99,102,241,0.25)" : "transparent",
            color: value === opt.key ? "#fff" : "var(--text-muted)", transition: "all 0.2s", whiteSpace: "nowrap",
          }}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// Campo de busca com ícone de lupa.
export function SearchInput({ value, onChange, placeholder, style }) {
  return (
    <div style={{ position: "relative", flex: 1, minWidth: "220px", ...style }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        style={{
          width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", color: "inherit",
          padding: "10px 12px 10px 36px", fontSize: "14px", outline: "none",
        }}
      />
    </div>
  );
}

// Pill de status (Ativo/Inativo).
export function StatusPill({ active }) {
  return (
    <span style={{
      fontSize: "11px", fontWeight: "600", padding: "3px 10px", borderRadius: "20px",
      background: active ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.06)",
      color: active ? "#10b981" : "var(--text-muted)",
    }}>
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}

// Chip pequeno (contato, localização, etc.).
export function Chip({ color = "#94a3b8", href, children, title }) {
  const style = {
    display: "inline-flex", alignItems: "center", gap: "6px",
    fontSize: "12px", fontWeight: "500", color,
    background: `${color}1a`, border: `1px solid ${color}33`,
    padding: "3px 10px", borderRadius: "999px", textDecoration: "none",
    maxWidth: "240px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  };
  if (href) {
    return (
      <a href={href} title={title} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" style={style}>
        {children}
      </a>
    );
  }
  return <span title={title} style={style}>{children}</span>;
}
