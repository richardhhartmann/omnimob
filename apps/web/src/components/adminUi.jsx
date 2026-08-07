// Utilitários e componentes compartilhados das páginas administrativas
// (Clientes, Usuários, Cargos) — mantêm um visual consistente.

export function initial(name) {
  const c = (name || "").trim().charAt(0);
  return c ? c.toUpperCase() : "?";
}

/* Preto ou branco por cima de uma cor de fundo — a que der mais contraste.

   Existe porque a cor do avatar passou a ser a do tenant, e o tenant escolhe
   qual é. Um branco fixo funcionava com o índigo padrão e sumia no dia em que
   alguém pusesse um dourado ou um lima ali. A conta é a luminância relativa da
   WCAG; o corte em 0,55 é o ponto onde o contraste com o branco cai abaixo do
   contraste com o preto. */
export function corDeTextoPara(fundo) {
  const hex = String(fundo || "").replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return "#fff";
  const canal = (i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const luminancia = 0.2126 * canal(0) + 0.7152 * canal(2) + 0.0722 * canal(4);
  return luminancia > 0.55 ? "#141416" : "#fff";
}

/* A cor sai de `--tenant-primary`, declarada uma vez no `.ds-shell` do
   AdminLayout a partir do perfil da imobiliária. Era um matiz sorteado pelo
   hash do nome, o que enchia as listas de cores que não são de ninguém — a
   marca do cliente vale mais que uma paleta aleatória. Os fallbacks cobrem o
   uso fora do painel, onde a variável não existe. */
export function Avatar({ name, size = 40 }) {
  return (
    <div style={{
      width: `${size}px`, height: `${size}px`, borderRadius: "50%", flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--tenant-primary, #6366f1)",
      color: "var(--tenant-primary-ink, #fff)",
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

// Cabeçalho padronizado de página com título, subtítulo opcional e ação à direita.
export function PageHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "28px", gap: "16px" }}>
      <div>
        <h2 style={{ margin: 0, fontSize: "22px", fontWeight: "700", letterSpacing: "-0.3px" }}>{title}</h2>
        {subtitle && <p style={{ margin: "5px 0 0", color: "var(--text-muted)", fontSize: "14px" }}>{subtitle}</p>}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}

/* Lista vazia, com a saída à mão.

   Uma tela que só diz "nenhum cliente cadastrado" faz a pessoa procurar o botão
   no topo — e no primeiro acesso, quando TODAS as listas estão assim, ela faz
   isso quatro vezes. O convite fica onde o olho já está.

   `acaoLabel`/`onAcao` são opcionais de propósito: quando a lista está vazia
   porque um FILTRO escondeu tudo, "cadastrar o primeiro" é falso — já existem
   itens, só não estes. Nesse caso quem chama passa só a mensagem. */
export function EmptyState({ mensagem, acaoLabel, onAcao, padding = "48px 24px" }) {
  return (
    <div className="glass-panel" style={{ textAlign: "center", padding }}>
      <p style={{ color: "var(--text-muted)", margin: 0 }}>{mensagem}</p>
      {acaoLabel && onAcao ? (
        <button
          type="button"
          onClick={onAcao}
          style={{
            display: "inline-flex", alignItems: "center", gap: "7px",
            width: "auto", marginTop: "18px", padding: "9px 16px",
            borderRadius: "9px", border: "none",
            background: "var(--accent)", color: "#fff",
            fontSize: "13px", fontWeight: "600", cursor: "pointer",
            transition: "opacity 0.15s ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {acaoLabel}
        </button>
      ) : null}
    </div>
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
