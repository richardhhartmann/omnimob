// Utilitários e componentes compartilhados das páginas administrativas
// (Clientes, Usuários, Cargos) — mantêm um visual consistente.

import { useLocation, useNavigate } from "react-router-dom";
import { Trilha } from "./Trilha.jsx";
import { degrausAte } from "../utils/trilhaDoPainel";
import { useTituloDaTela } from "../utils/contextoDeCabecalho.jsx";

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
    <div className="ui-segmentado" style={{ display: "flex", borderRadius: "10px", padding: "3px" }}>
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
          width: "100%", boxSizing: "border-box", background: "var(--sup-04, rgba(255,255,255,0.04))",
          border: "1px solid var(--linha-10, rgba(255,255,255,0.1))", borderRadius: "10px", color: "inherit",
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
      background: active ? "rgba(16,185,129,0.15)" : "var(--sup-06, rgba(255,255,255,0.06))",
      color: active ? "#10b981" : "var(--text-muted)",
    }}>
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}

// Cabeçalho padronizado de página com título, subtítulo opcional e ação à direita.
/* ── A TRILHA VEM DE GRAÇA AQUI ──────────────────────────────────────────────

   Todas as telas do Flow desenham o cabeçalho por este componente, e nenhuma
   delas tinha trilha. Pô-la aqui dentro resolve as oito de uma vez — e, mais
   importante, faz a nona nascer com ela: uma tela nova que use `PageHeader` já
   aparece no caminho certo sem ninguém lembrar de nada.

   Sai da ROTA, e não de um parâmetro: quem desenha o cabeçalho não precisa
   saber onde a própria página mora. Rota fora do catálogo — ou a raiz de um
   módulo, que não desceu de lugar nenhum — simplesmente não desenha trilha: um
   degrau sozinho é um título repetido, não um caminho.

   `trilha={false}` desliga, e `trilha={[...]}` substitui, para a tela que
   precisa de um degrau próprio (o código de um negócio, por exemplo). */
/* ── O cabeçalho da tela MUDOU DE LUGAR, não de dono ────────────────────────
   Ele desenhava título, subtítulo, trilha e botão dentro do conteúdo. Hoje
   quem desenha é a faixa do `AdminLayout` (`CabecalhoDoPainel`), e este
   componente virou a DECLARAÇÃO: a tela continua dizendo como se chama, no
   mesmo lugar do JSX, e não renderiza nada onde estava.

   Manter o componente em vez de apagá-lo das nove telas que o usam não é
   preguiça — é o que faz o título continuar sendo uma decisão da PÁGINA. Sem
   ele, o nome de cada tela viraria uma tabela distante do código que a desenha,
   e "Negócio #412" (que só a tela sabe montar) não teria como existir.

   `trilha` continua aceito e ignorado: a trilha agora sai da rota, na faixa, e
   nenhuma das telas passava um valor diferente do padrão. */
export function PageHeader({ title, subtitle, action }) {
  useTituloDaTela({ titulo: title, subtitulo: subtitle, acao: action });
  return null;
}

/* Lista vazia, com a saída à mão.

   Uma tela que só diz "nenhum cliente cadastrado" faz a pessoa procurar o botão
   no topo — e no primeiro acesso, quando TODAS as listas estão assim, ela faz
   isso quatro vezes. O convite fica onde o olho já está.

   `acaoLabel`/`onAcao` são opcionais de propósito: quando a lista está vazia
   porque um FILTRO escondeu tudo, "cadastrar o primeiro" é falso — já existem
   itens, só não estes. Nesse caso quem chama passa só a mensagem. */
/* `desenho` e opcional e so entra no vazio DE VERDADE — nunca no vazio de
   filtro. A razao e a mesma que ja separa o texto e o botao: filtro que escondeu
   tudo e um estado passageiro de meio segundo, e ilustracao ali vira peso numa
   tela que a pessoa vai atravessar dezenas de vezes por dia. No primeiro acesso,
   quando a lista esta vazia porque a conta e nova, ela e o contrario disso: a
   unica coisa na tela. */
export function EmptyState({ mensagem, acaoLabel, onAcao, desenho, desenhoAlt = "", padding = "48px 24px" }) {
  return (
    <div className="glass-panel" style={{ textAlign: "center", padding }}>
      {desenho ? (
        <img
          src={desenho}
          alt={desenhoAlt}
          width={360}
          height={360}
          loading="lazy"
          style={{ display: "block", width: "100%", maxWidth: "210px", height: "auto", margin: "0 auto 18px" }}
        />
      ) : null}
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
