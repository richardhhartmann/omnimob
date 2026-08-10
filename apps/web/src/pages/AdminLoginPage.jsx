import { useState } from "react";
import { Link } from "react-router-dom";
import { adminApi, setAdminToken } from "../api";
import { Alert, Button, OmnimobStyles, Eyebrow, Field, GOLD, LogoLockup, Reveal, Scallop, useSaidaDeAuth } from "../styles/omnimobKit";

/* Login do painel super-admin — mesma identidade da landing (fundo quase-preto,
   vidro sobre os blobs, micro-labels em mono, botão pill). */

export function AdminLoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { saindo, sair } = useSaidaDeAuth();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await adminApi.login({ email, senha });
      setAdminToken(res.token);
      // A troca de sessão só acontece quando a tela terminar de sair.
      sair(() => onLogin({ token: res.token, email: res.email, nome: res.nome }));
    } catch (err) {
      setError(err.message || "Falha no login.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`dl-root dl-page dl-login${saindo ? " authx-out" : ""}`}>
      <OmnimobStyles extra={CSS} />

      <div className="dl-login__shapes authx-shapes" aria-hidden="true">
        <Scallop size={168} color={GOLD} style={{ position: "absolute", top: "12%", right: "8%", opacity: 0.5 }} />
        <span className="dl-shape dl-shape--halfs" />
        <span className="dl-shape dl-shape--circle" />
        <span className="dl-shape dl-shape--violet" />
      </div>

      <Reveal className="dl-login__card dl-glass authx-card" as="form" onSubmit={handleSubmit}>
        <Link to="/" className="dl-logo dl-login__logo" aria-label="Omnimob — início">
          <LogoLockup height={44} />
        </Link>

        <Eyebrow>ACESSO RESTRITO</Eyebrow>
        <h1 className="dl-login__title">
          <span>Painel</span>
          <span className="dl-h1__accent">Super-Admin.</span>
        </h1>

        {error ? <Alert tone="danger">{error}</Alert> : null}

        <div className="dl-login__fields">
          <Field label="E-mail">
            <input
              className="dl-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              placeholder="super@omnimob.app"
            />
          </Field>

          <Field label="Senha">
            <input
              className="dl-input"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </Field>
        </div>

        <Button as="button" type="submit" variant="primary" className="dl-btn--block" disabled={loading}>
          {loading ? "Entrando…" : "Entrar"}
        </Button>

        <p className="dl-mono dl-login__note">
          // acesso monitorado · use as credenciais da plataforma
        </p>

        <Link to="/login" className="dl-login__alt">É de uma imobiliária? Entrar no painel do cliente</Link>
      </Reveal>
    </div>
  );
}

const CSS = `
.dl-login {
  position: relative; overflow: hidden;
  display: flex; align-items: center; justify-content: center; padding: 40px 24px;
}
.dl-login::before {
  content: ""; position: absolute; inset: 0; pointer-events: none; z-index: 0;
  background:
    radial-gradient(760px 460px at 70% 6%, rgba(99,102,241,0.22), transparent 70%),
    radial-gradient(560px 360px at 8% 88%, rgba(212,175,55,0.10), transparent 70%);
}
.dl-login__shapes { position: absolute; inset: 0; pointer-events: none; z-index: 0; }
.dl-shape { position: absolute; display: block; border-radius: 999px; }
.dl-shape--halfs {
  left: -18px; top: 30%; width: 72px; height: 92px;
  background: #a78bfa; border-radius: 0 999px 999px 0;
  box-shadow: 46px 0 0 -6px #c4b5fd;
}
.dl-shape--circle { right: 14%; bottom: 16%; width: 46px; height: 46px; background: #e879b9; }
.dl-shape--violet {
  left: 32%; bottom: -60px; width: 260px; height: 260px;
  background: radial-gradient(closest-side, rgba(139,92,246,0.45), transparent);
  filter: blur(8px);
}

.dl-login__card {
  position: relative; z-index: 1;
  width: 100%; max-width: 430px; padding: 34px 34px 30px;
  border-radius: 22px; display: flex; flex-direction: column;
}
.dl-login__logo { margin-bottom: 24px; }
.dl-login__title {
  display: flex; flex-direction: column; margin: 14px 0 0;
  font-size: clamp(30px, 5vw, 40px); line-height: 1.03;
  letter-spacing: -0.045em; font-weight: 800; color: var(--strong);
}
.dl-login__sub { font-size: 13.5px; line-height: 1.75; color: var(--subtle); margin-top: 14px; }
.dl-login__fields { display: grid; gap: 16px; margin: 22px 0 24px; }
.dl-login .dl-alert { margin-top: 20px; }
.dl-login__note {
  color: var(--placeholder); margin-top: 18px; text-align: center;
  text-transform: none; letter-spacing: 0.04em; font-size: 9.5px;
}
.dl-login__alt {
  margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--line-soft);
  font-size: 12.5px; color: var(--subtle); text-align: center;
  transition: color 0.18s ease;
}
.dl-login__alt:hover { color: var(--strong); }

@media (max-width: 640px) {
  .dl-login__shapes { display: none; }
  .dl-login__card { padding: 26px 22px 24px; }
}
`;
