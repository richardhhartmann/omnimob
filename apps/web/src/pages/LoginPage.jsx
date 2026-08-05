import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { Alert, Button, DomusStyles, Eyebrow, Field, LogoLockup, Reveal, Scallop, useSaidaDeAuth } from "../styles/domusKit";

/* Login do painel do tenant.

   Usa a mesma linguagem visual da landing (vidro sobre blobs, micro-labels em
   mono, título de duas cores, botão pill), mas com a paleta que a página já
   tinha: o gradiente do body, acento #818cf8 → #6366f1 e bordas a 8% de branco.
   Os tokens são sobrescritos em `.lg-root`, então as primitivas do kit se
   adaptam sozinhas. */

export function LoginPage({ onLogin }) {
  const [searchParams] = useSearchParams();
  const tenantFromShowcase = searchParams.get("tenant") || "";
  const [form, setForm] = useState({ login: "", senha: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { saindo, sair } = useSaidaDeAuth();

  // Quando o backend exige definir senha (1º acesso ou troca obrigatória),
  // guardamos o login/senha atual e trocamos para a tela de nova senha.
  const [novaSenhaFor, setNovaSenhaFor] = useState(null); // { login, senhaAtual } | null

  function validarTenant(session) {
    if (tenantFromShowcase && session?.tenant?.slug !== tenantFromShowcase) {
      setError("Este usuário não pertence ao tenant da vitrine selecionada.");
      return false;
    }
    return true;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const session = await api.login(form);
      if (!validarTenant(session)) return;
      // A troca de sessão só acontece quando a tela terminar de sair.
      sair(() => onLogin(session));
    } catch (err) {
      if (err?.body?.forcaAlterarSenha) {
        // Cai na tela de definir nova senha.
        setNovaSenhaFor({ login: err.body.login || form.login, senhaAtual: form.senha });
        setError("");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  if (novaSenhaFor) {
    return (
      <DefinirSenhaCard
        alvo={novaSenhaFor}
        onCancelar={() => { setNovaSenhaFor(null); setError(""); }}
        onConcluir={(session) => { if (validarTenant(session)) onLogin(session); }}
      />
    );
  }

  return (
    <AuthShell
      eyebrow={tenantFromShowcase ? `VITRINE · ${tenantFromShowcase.toUpperCase()}` : "ACESSO DO CLIENTE"}
      strong="Entrar no"
      soft="painel da sua imobiliária."
      descricao={
        tenantFromShowcase
          ? `Você está entrando no ambiente do tenant ${tenantFromShowcase}. Use as credenciais dessa imobiliária.`
          : ""
      }
      onSubmit={handleSubmit}
      error={error}
      saindo={saindo}
      nota="// imóveis · vitrine · leads · equipe"
      rodape={<Link to="/admin/login" className="lg-alt">Administração da plataforma</Link>}
    >
      <Field label="Login">
        <input
          className="dl-input"
          placeholder="seu.login"
          value={form.login}
          onChange={(e) => setForm((prev) => ({ ...prev, login: e.target.value }))}
          required
          autoComplete="username"
          disabled={loading}
        />
      </Field>

      <Field label="Senha de acesso">
        <input
          className="dl-input"
          type="password"
          placeholder="••••••••"
          value={form.senha}
          onChange={(e) => setForm((prev) => ({ ...prev, senha: e.target.value }))}
          autoComplete="current-password"
          disabled={loading}
        />
      </Field>

      <Button as="button" type="submit" variant="accent" className="dl-btn--block" disabled={loading}>
        {loading ? "Entrando…" : "Acessar painel"}
      </Button>
    </AuthShell>
  );
}

// ─── Tela de definição de nova senha (primeiro acesso / troca obrigatória) ────

function DefinirSenhaCard({ alvo, onConcluir, onCancelar }) {
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { saindo, sair } = useSaidaDeAuth();

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (novaSenha.length < 6) {
      setError("A nova senha deve ter ao menos 6 caracteres.");
      return;
    }
    if (novaSenha !== confirmar) {
      setError("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    try {
      const session = await api.definirSenha({
        login: alvo.login,
        senhaAtual: alvo.senhaAtual,
        novaSenha,
      });
      sair(() => onConcluir(session));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="PRIMEIRO ACESSO"
      strong="Defina sua"
      soft="senha para continuar."
      descricao={<>Primeiro acesso de <strong>{alvo.login}</strong>. Crie uma senha com ao menos 6 caracteres.</>}
      onSubmit={handleSubmit}
      error={error}
      saindo={saindo}
      nota="// a senha fica salva com hash; ninguém da equipe consegue lê-la"
    >
      <Field label="Nova senha" hint="Mínimo de 6 caracteres.">
        <input
          className="dl-input"
          type="password"
          placeholder="••••••••"
          value={novaSenha}
          onChange={(e) => setNovaSenha(e.target.value)}
          required
          autoComplete="new-password"
          disabled={loading}
        />
      </Field>

      <Field label="Confirmar nova senha">
        <input
          className="dl-input"
          type="password"
          placeholder="••••••••"
          value={confirmar}
          onChange={(e) => setConfirmar(e.target.value)}
          required
          autoComplete="new-password"
          disabled={loading}
        />
      </Field>

      <div className="lg-actions">
        <Button as="button" type="submit" variant="accent" className="dl-btn--block" disabled={loading}>
          {loading ? "Salvando…" : "Definir senha e entrar"}
        </Button>
        <Button as="button" type="button" variant="ghost" arrow={false} className="dl-btn--block" onClick={onCancelar} disabled={loading}>
          Voltar
        </Button>
      </div>
    </AuthShell>
  );
}

// ─── Casca compartilhada pelas duas telas ─────────────────────────────────────

function AuthShell({ eyebrow, strong, soft, descricao, error, nota, rodape, onSubmit, saindo, children }) {
  return (
    <div className={`dl-root dl-page lg-root${saindo ? " authx-out" : ""}`}>
      <DomusStyles extra={CSS} />

      <div className="lg-shapes authx-shapes" aria-hidden="true">
        <Scallop size={160} color="#818cf8" style={{ position: "absolute", top: "14%", right: "9%", opacity: 0.28 }} />
        <span className="lg-shape lg-shape--halfs" />
        <span className="lg-shape lg-shape--circle" />
        <span className="lg-shape lg-shape--glow" />
      </div>

      <Reveal as="form" className="lg-card dl-glass authx-card" onSubmit={onSubmit}>
        <Link to="/" className="dl-logo lg-logo" aria-label="Domus — início">
          <LogoLockup height={44} />
        </Link>

        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="lg-title">
          <span>{strong}</span>
          <span className="dl-h1__accent">{soft}</span>
        </h1>
        {/* Sem descrição o parágrafo saía vazio e mesmo assim cobrava as
            margens, abrindo um vão morto entre o título e os campos. */}
        {descricao ? <p className="lg-sub">{descricao}</p> : null}

        {error ? <Alert tone="danger">{error}</Alert> : null}

        <div className="lg-fields">{children}</div>

        {nota ? <p className="dl-mono lg-note">{nota}</p> : null}
        {rodape ? <div className="lg-foot">{rodape}</div> : null}
      </Reveal>
    </div>
  );
}

/* ── Estilos ─────────────────────────────────────────────────────────────────
   Só a sobrescrita de tokens + os blocos desta tela. Os botões, inputs, vidro,
   eyebrow e reveal vêm do kit e se adaptam à paleta abaixo.
   ────────────────────────────────────────────────────────────────────────── */

const CSS = `
.lg-root {
  /* Paleta original da página de login (styles.css). */
  --bg: linear-gradient(135deg, #111117 0%, #161d2e 50%, #1e2d45 100%);
  --bg-alt: rgba(255,255,255,0.02);
  --surface: rgba(255,255,255,0.03);
  --surface-2: rgba(255,255,255,0.06);
  --line: rgba(255,255,255,0.08);
  --line-soft: rgba(255,255,255,0.06);
  --strong: #f8fafc;
  --default: #e2e8f0;
  --subtle: #94a3b8;
  --placeholder: #64748b;
  --accent: #818cf8;
  --accent-soft: #a5b4fc;

  background: var(--bg);
  background-attachment: fixed;
  position: relative; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  padding: 40px 24px;
}

/* O botão herda o par accent → accent-hover que a página já usava. */
.lg-root .dl-btn--accent { background: #818cf8; color: #fff; }
.lg-root .dl-btn--accent .dl-btn__arrow { background: rgba(255,255,255,0.20); }
.lg-root .dl-btn--accent:hover { background: #6366f1; box-shadow: 0 14px 34px -14px rgba(99,102,241,0.7); }
.lg-root .dl-input:focus { border-color: #818cf8; box-shadow: 0 0 0 3px rgba(129,140,248,0.18); }

.lg-shapes { position: absolute; inset: 0; pointer-events: none; z-index: 0; }
.lg-shape { position: absolute; display: block; border-radius: 999px; }
.lg-shape--halfs {
  left: -16px; top: 28%; width: 66px; height: 86px;
  background: #6366f1; border-radius: 0 999px 999px 0;
  box-shadow: 42px 0 0 -6px #818cf8; opacity: 0.5;
}
.lg-shape--circle { right: 16%; bottom: 18%; width: 42px; height: 42px; background: #38bdf8; opacity: 0.35; }
.lg-shape--glow {
  left: 30%; bottom: -70px; width: 280px; height: 280px;
  background: radial-gradient(closest-side, rgba(129,140,248,0.38), transparent);
  filter: blur(10px);
}

.lg-card {
  position: relative; z-index: 1;
  width: 100%; max-width: 430px; padding: 34px 34px 30px;
  border-radius: 22px; display: flex; flex-direction: column;
}
.lg-logo { margin-bottom: 24px; }
.lg-title {
  display: flex; flex-direction: column; margin: 14px 0 0;
  font-size: clamp(28px, 5vw, 38px); line-height: 1.05;
  letter-spacing: -0.045em; font-weight: 800; color: var(--strong);
}
.lg-sub { font-size: 13.5px; line-height: 1.75; color: var(--subtle); margin-top: 14px; }
.lg-sub strong { color: var(--strong); font-weight: 700; }
.lg-root .dl-alert { margin-top: 20px; }
.lg-fields { display: grid; gap: 16px; margin: 22px 0 0; }
.lg-actions { display: grid; gap: 10px; }
.lg-note {
  color: var(--placeholder); margin-top: 20px; text-align: center;
  text-transform: none; letter-spacing: 0.04em; font-size: 9.5px; line-height: 1.7;
}
.lg-foot {
  margin-top: 20px; padding-top: 18px; border-top: 1px solid var(--line-soft);
  text-align: center;
}
.lg-alt { font-size: 12.5px; color: var(--subtle); transition: color 0.18s ease; }
.lg-alt:hover { color: var(--strong); }

@media (max-width: 640px) {
  .lg-shapes { display: none; }
  .lg-card { padding: 26px 22px 24px; }
}
`;
