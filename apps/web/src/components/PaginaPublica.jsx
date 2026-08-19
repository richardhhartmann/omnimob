import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { OmnimobStyles, LogoLockup } from "../styles/omnimobKit";
import { useSeo } from "../utils/seo";

/* ────────────────────────────────────────────────────────────────────────────
   Casca das páginas públicas que não são a landing.

   Termos, Privacidade, Sobre, Contato e Vitrines. São páginas de LEITURA —
   texto longo, uma coluna, sem shader nenhum — e por isso não reaproveitam o
   cabeçalho da landing: aquele carrega o menu em tela cheia, o rastro de
   fumaça e 494 kB de pacote. Importá-lo aqui faria quem abre a Política de
   Privacidade baixar a página inteira de vendas para ler um texto.

   O que elas compartilham com a landing é o que importa: a mesma paleta, a
   mesma tipografia e o mesmo logotipo, tudo vindo de `styles/omnimobKit` —
   que já é a fonte comum da landing, do painel super-admin e das telas de
   autenticação. A semelhança vem dos tokens, não de código copiado.

   ── POR QUE ESTAS PÁGINAS EXISTEM ──

   Uma landing de página única com âncoras é o formato que toda ferramenta
   gera. O que ela não tem é endereço: não dá para mandar "leia os termos" por
   e-mail, o buscador indexa um documento só, e não há onde publicar a política
   de privacidade — que a LGPD exige de quem trata dado de terceiro, e a
   Omnimob trata (os leads e clientes das imobiliárias).
   ──────────────────────────────────────────────────────────────────────────── */

/* Navegação entre as próprias páginas. Mora aqui, e não em cada uma: uma
   página nova entra no menu de todas as outras sozinha. */
export const PAGINAS_PUBLICAS = [
  { caminho: "/vitrines", rotulo: "Vitrines" },
  { caminho: "/sobre", rotulo: "Sobre" },
  { caminho: "/contato", rotulo: "Contato" },
  { caminho: "/termos", rotulo: "Termos" },
  { caminho: "/privacidade", rotulo: "Privacidade" },
];

export function PaginaPublica({ titulo, subtitulo, olho, descricao, largura = "texto", children }) {
  const { pathname } = useLocation();

  // A assinatura é em português, como o resto do utilitário (`utils/seo.js`).
  useSeo({
    titulo: `${titulo} · Omnimob`,
    descricao: descricao || subtitulo,
    caminho: pathname,
  });

  /* Chegar por link direto tem de começar no topo. Sem isto, navegar de
     /termos para /privacidade mantém a rolagem onde estava — no meio de um
     texto que a pessoa nunca leu. */
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  const ano = new Date().getFullYear();

  return (
    <div className="dl-root dl-page pp-root">
      <OmnimobStyles extra={CSS} />

      <header className="pp-top">
        <div className="pp-wrap pp-top__inner">
          <Link to="/" className="pp-logo" aria-label="Omnimob — início">
            <LogoLockup height={30} />
          </Link>
          <nav className="pp-nav" aria-label="Páginas da Omnimob">
            {PAGINAS_PUBLICAS.map((p) => (
              <Link
                key={p.caminho}
                to={p.caminho}
                className={pathname === p.caminho ? "is-atual" : undefined}
                aria-current={pathname === p.caminho ? "page" : undefined}
              >
                {p.rotulo}
              </Link>
            ))}
          </nav>
          <Link to="/login" className="pp-entrar">Entrar</Link>
        </div>
      </header>

      <main className={`pp-corpo pp-corpo--${largura}`}>
        <div className="pp-wrap">
          <header className="pp-cabeca">
            {olho ? <span className="dl-mono pp-olho">{olho}</span> : null}
            <h1>{titulo}</h1>
            {subtitulo ? <p className="pp-sub">{subtitulo}</p> : null}
          </header>
          {children}
        </div>
      </main>

      <footer className="pp-rodape">
        <div className="pp-wrap pp-rodape__inner">
          <span className="dl-mono">© {ano} OMNIMOB</span>
          <nav aria-label="Rodapé">
            <Link to="/">Início</Link>
            {PAGINAS_PUBLICAS.map((p) => (
              <Link key={p.caminho} to={p.caminho}>{p.rotulo}</Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}

/* Um bloco de texto legal ou institucional: título de seção e corpo.
   Existe para as cinco páginas escreverem o mesmo tipo de conteúdo do mesmo
   jeito, em vez de cada uma inventar a própria hierarquia. */
export function Secao({ id, titulo, children }) {
  return (
    <section className="pp-secao" id={id}>
      {titulo ? <h2>{titulo}</h2> : null}
      {children}
    </section>
  );
}

const CSS = `
.pp-root { background: var(--bg); color: var(--default); min-height: 100vh; display: flex; flex-direction: column; }
.pp-wrap { width: min(100% - 40px, 1180px); margin-inline: auto; }

/* ── Topo ── */
.pp-top {
  position: sticky; top: 0; z-index: 20;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--line);
}
.pp-top__inner { display: flex; align-items: center; gap: 26px; height: 62px; }
.pp-logo { display: inline-flex; flex-shrink: 0; }
.pp-nav { display: flex; gap: 20px; flex: 1; flex-wrap: wrap; }
.pp-nav a {
  font-size: 13px; color: var(--subtle); text-decoration: none;
  transition: color 0.16s ease;
}
.pp-nav a:hover { color: var(--default); }
.pp-nav a.is-atual { color: var(--default); font-weight: 600; }
.pp-entrar {
  flex-shrink: 0; font-size: 13px; font-weight: 600; text-decoration: none;
  padding: 8px 16px; border-radius: 999px;
  color: var(--default); border: 1px solid var(--line);
  transition: background 0.16s ease;
}
.pp-entrar:hover { background: rgba(127,127,127,0.09); }

/* ── Corpo ──
   A medida de leitura é a regra, não a exceção: texto legal em coluna larga
   perde a linha na volta. As páginas que precisam de grade (Vitrines) pedem
   'largo' explicitamente. */
.pp-corpo { flex: 1; padding: 64px 0 88px; }
.pp-corpo--texto .pp-wrap { max-width: 760px; }

.pp-cabeca { margin-bottom: 46px; }
.pp-olho { display: block; color: var(--accent-soft, #818cf8); margin-bottom: 12px; font-size: 10px; letter-spacing: 0.18em; }
.pp-cabeca h1 {
  margin: 0; font-size: clamp(2rem, 5vw, 3rem); font-weight: 700;
  line-height: 1.08; letter-spacing: -0.03em; text-wrap: balance;
}
.pp-sub { margin: 16px 0 0; font-size: 17px; line-height: 1.6; color: var(--subtle); max-width: 62ch; }

.pp-secao { margin-top: 40px; }
.pp-secao h2 {
  margin: 0 0 14px; font-size: 20px; font-weight: 650; letter-spacing: -0.01em;
  padding-top: 22px; border-top: 1px solid var(--line);
}
.pp-secao h3 { margin: 24px 0 8px; font-size: 15px; font-weight: 650; }
.pp-secao p, .pp-secao li { font-size: 15px; line-height: 1.72; color: var(--subtle); }
.pp-secao p { margin: 0 0 14px; }
.pp-secao strong { color: var(--default); font-weight: 600; }
.pp-secao ul, .pp-secao ol { margin: 0 0 16px; padding-left: 22px; display: flex; flex-direction: column; gap: 8px; }
.pp-secao a { color: var(--accent-soft, #818cf8); }
.pp-secao code {
  font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 0.88em;
  background: rgba(127,127,127,0.12); padding: 1px 5px; border-radius: 4px;
}

/* Tabela de dados/terceiros. Rola sozinha em vez de esticar a página. */
.pp-tabela-caixa { overflow-x: auto; margin: 0 0 18px; border: 1px solid var(--line); border-radius: 12px; }
.pp-tabela { border-collapse: collapse; width: 100%; min-width: 560px; font-size: 13.5px; }
.pp-tabela th, .pp-tabela td { text-align: left; padding: 12px 14px; border-bottom: 1px solid var(--line); vertical-align: top; }
.pp-tabela thead th { font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--subtle); font-weight: 500; }
.pp-tabela tbody tr:last-child td { border-bottom: 0; }
.pp-tabela td { color: var(--subtle); }
.pp-tabela td:first-child { color: var(--default); font-weight: 600; white-space: nowrap; }

/* Aviso destacado — usado na revisão jurídica pendente e em alertas de prazo. */
.pp-aviso {
  margin: 0 0 22px; padding: 14px 16px; border-radius: 12px;
  background: rgba(212,175,55,0.08); border: 1px solid rgba(212,175,55,0.28);
  font-size: 13.5px; line-height: 1.6; color: var(--subtle);
}
.pp-aviso strong { color: #d4af37; }

.pp-atualizado { font-size: 12.5px; color: var(--subtle); opacity: 0.8; margin-top: 8px; }

/* ── Rodapé ── */
.pp-rodape { border-top: 1px solid var(--line); padding: 26px 0 34px; }
.pp-rodape__inner { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; align-items: center; }
.pp-rodape__inner .dl-mono { font-size: 9px; color: var(--placeholder); }
.pp-rodape nav { display: flex; gap: 18px; flex-wrap: wrap; }
.pp-rodape a { font-size: 12.5px; color: var(--subtle); text-decoration: none; }
.pp-rodape a:hover { color: var(--default); }

@media (max-width: 760px) {
  .pp-top__inner { height: auto; padding: 12px 0; flex-wrap: wrap; gap: 12px; }
  .pp-nav { order: 3; width: 100%; gap: 14px; }
  .pp-entrar { margin-left: auto; }
  .pp-corpo { padding: 40px 0 64px; }
}
`;
