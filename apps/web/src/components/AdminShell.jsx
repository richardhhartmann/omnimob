import { Link } from "react-router-dom";
import { Button, DomusStyles, LogoLockup } from "../styles/domusKit";

/* ────────────────────────────────────────────────────────────────────────────
   Casca do painel super-admin — topbar + sidebar de abas + conteúdo.

   É o irmão do `AdminLayout` do lado da imobiliária, e a semelhança para por
   aí: aquele vive dentro do `styles.css` global, com paleta própria (`--s-*`)
   e navegação por ROTA (`<Outlet/>`); este vive na linguagem da landing
   (`.dl-root`, tokens do kit) e troca de aba por ESTADO, porque o super-admin
   é uma rota só (`/admin`) e não vale acrescentar quatro entradas no roteador
   para telas que ninguém compartilha por link.

   A sidebar existe porque o painel deixou de ter uma tela só. Com tenants,
   chamados e tutoriais, uma topbar com três links já começaria a apertar — e o
   próximo assunto (faxina de trials, métricas) não teria onde entrar.
   ──────────────────────────────────────────────────────────────────────────── */

export function AdminShell({ session, onLogout, abas, aba, aoTrocarAba, css, children }) {
  const atual = abas.find((a) => a.chave === aba) || abas[0];

  return (
    <div className="dl-root dl-page sa-root">
      <DomusStyles extra={`${SHELL_CSS}\n${css || ""}`} />

      <header className="sa-top">
        <div className="as-top__inner">
          <Link to="/" className="dl-logo" aria-label="Domus — início">
            <LogoLockup height={32} />
          </Link>
          <span className="dl-mono sa-top__tag">● SUPER-ADMIN</span>

          <div className="sa-top__actions">
            <span className="dl-mono sa-top__user">{session?.nome || session?.email}</span>
            <Button as="button" type="button" variant="ghost" className="dl-btn--sm" arrow={false} onClick={onLogout}>
              Sair
            </Button>
          </div>
        </div>
      </header>

      <div className="as-shell">
        <aside className="as-side">
          <span className="dl-mono as-side__label">PLATAFORMA</span>
          <nav className="as-nav">
            {abas.map((a) => (
              <button
                key={a.chave}
                type="button"
                className={`as-item${a.chave === atual.chave ? " is-active" : ""}`}
                onClick={() => aoTrocarAba(a.chave)}
                aria-current={a.chave === atual.chave ? "page" : undefined}
              >
                <span className="as-item__icone" aria-hidden="true">{a.icone}</span>
                <span className="as-item__label">{a.rotulo}</span>
                {/* Só aparece com algo a fazer: um "0" permanente ao lado de
                    Chamados vira ruído e deixa de ser lido depois de um dia. */}
                {a.badge > 0 ? <span className="as-item__badge">{a.badge > 99 ? "99+" : a.badge}</span> : null}
              </button>
            ))}
          </nav>

          {atual?.nota ? <p className="dl-mono as-side__nota">// {atual.nota}</p> : null}
        </aside>

        <main className="as-main">{children}</main>
      </div>
    </div>
  );
}

const SHELL_CSS = `
.sa-root { position: relative; }
.sa-root::before {
  content: ""; position: absolute; inset: 0 0 auto 0; height: 620px; pointer-events: none; z-index: 0;
  background:
    radial-gradient(820px 420px at 78% -8%, rgba(99,102,241,0.16), transparent 70%),
    radial-gradient(560px 340px at 4% 6%, rgba(212,175,55,0.07), transparent 70%);
}

/* ── Topbar ── */
.sa-top {
  position: sticky; top: 0; z-index: 40;
  background: rgba(10,10,11,0.72);
  backdrop-filter: blur(16px) saturate(140%); -webkit-backdrop-filter: blur(16px) saturate(140%);
  border-bottom: 1px solid var(--line-soft);
}
.sa-top__tag {
  color: var(--accent-soft); font-size: 9px; letter-spacing: 0.16em;
  padding: 4px 10px; border-radius: 999px;
  background: rgba(99,102,241,0.10); border: 1px solid rgba(99,102,241,0.22);
}
.sa-top__actions { margin-left: auto; display: flex; align-items: center; gap: 14px; }
.sa-top__user { color: var(--placeholder); font-size: 9.5px; letter-spacing: 0.08em; text-transform: none; }

.as-top__inner {
  display: flex; align-items: center; gap: 16px; height: 66px;
  max-width: 1440px; margin: 0 auto; padding: 0 24px;
}

.as-shell {
  position: relative; z-index: 1;
  display: flex; align-items: flex-start; gap: 28px;
  max-width: 1440px; margin: 0 auto; padding: 28px 24px 72px;
}

/* Sticky abaixo da topbar (66px), como a sidebar do painel do tenant. */
.as-side {
  position: sticky; top: 90px; flex: 0 0 210px; width: 210px;
  display: flex; flex-direction: column; gap: 10px;
}
.as-side__label { color: #55555f; font-size: 8.5px; letter-spacing: 0.16em; padding-left: 12px; }
.as-nav { display: flex; flex-direction: column; gap: 3px; }

.dl-root .as-item {
  display: flex; align-items: center; gap: 10px; width: 100%; text-align: left;
  padding: 10px 12px; border-radius: 11px; cursor: pointer;
  font-family: inherit; font-size: 13px; font-weight: 500;
  color: var(--subtle); background: transparent; border: 1px solid transparent;
  box-shadow: none; transform: none;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
.dl-root .as-item:hover { background: var(--surface); color: var(--strong); box-shadow: none; transform: none; }
.dl-root .as-item.is-active {
  background: rgba(99,102,241,0.12); border-color: rgba(99,102,241,0.30); color: var(--strong);
}
.as-item__icone { display: flex; flex-shrink: 0; color: currentColor; }
.as-item.is-active .as-item__icone { color: var(--accent-soft); }
.as-item__label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.as-item__badge {
  flex-shrink: 0; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--gold); color: #17130a; font-size: 10px; font-weight: 800;
}

.as-side__nota {
  color: var(--placeholder); font-size: 9px; line-height: 1.7;
  text-transform: none; letter-spacing: 0.05em; padding: 10px 12px 0;
  border-top: 1px solid var(--line-soft); margin-top: 6px;
}

.as-main { flex: 1; min-width: 0; }

@media (max-width: 720px) {
  .as-top__inner { height: auto; padding-top: 12px; padding-bottom: 12px; flex-wrap: wrap; }
  .sa-top__actions { width: 100%; justify-content: space-between; }
}

@media (max-width: 900px) {
  .as-shell { flex-direction: column; gap: 18px; }
  /* Vira uma faixa rolável no topo: sidebar de 210px num celular não sobra
     largura para o conteúdo. */
  .as-side {
    position: static; width: 100%; flex: none;
    flex-direction: row; align-items: center; gap: 8px; overflow-x: auto;
  }
  .as-side__label, .as-side__nota { display: none; }
  .as-nav { flex-direction: row; gap: 6px; }
  .dl-root .as-item { width: auto; white-space: nowrap; }
}
`;

export default AdminShell;
