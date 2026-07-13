import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";

export function LoginPage({ onLogin }) {
  const [searchParams] = useSearchParams();
  const tenantFromShowcase = searchParams.get("tenant") || "";
  const [form, setForm] = useState({ login: "", senha: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Quando o backend exige definir senha (1º acesso ou troca obrigatória),
  // guardamos o login/senha atual e trocamos para a tela de nova senha.
  const [novaSenhaFor, setNovaSenhaFor] = useState(null); // { login, senhaAtual } | null

  function validarTenant(session) {
    if (tenantFromShowcase && session?.tenant?.slug !== tenantFromShowcase) {
      setError("Este usuario nao pertence ao tenant da vitrine selecionada.");
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
      onLogin(session);
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
    <div className="auth-container">
      <main className="glass-panel auth-card">
        <h1>Domus</h1>
        <p>
          {tenantFromShowcase
            ? `Login do tenant: ${tenantFromShowcase}`
            : "Autenticacao restrita ao ambiente do tenant."}
        </p>

        {error ? <div className="error">{error}</div> : null}

        <form className="grid" onSubmit={handleSubmit}>
          <input
            placeholder="Login"
            value={form.login}
            onChange={(e) => setForm((prev) => ({ ...prev, login: e.target.value }))}
            required
            disabled={loading}
          />
          <input
            type="password"
            placeholder="Senha de acesso"
            value={form.senha}
            onChange={(e) => setForm((prev) => ({ ...prev, senha: e.target.value }))}
            disabled={loading}
          />
          <button type="submit" disabled={loading}>
            Acessar Painel
          </button>
        </form>
      </main>
    </div>
  );
}

// ─── Tela de definição de nova senha (primeiro acesso / troca obrigatória) ────

function DefinirSenhaCard({ alvo, onConcluir, onCancelar }) {
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      onConcluir(session);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <main className="glass-panel auth-card">
        <h1>Definir senha</h1>
        <p>Primeiro acesso de <strong>{alvo.login}</strong>. Crie uma senha para continuar.</p>

        {error ? <div className="error">{error}</div> : null}

        <form className="grid" onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="Nova senha (mín. 6 caracteres)"
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            required
            disabled={loading}
          />
          <input
            type="password"
            placeholder="Confirmar nova senha"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            required
            disabled={loading}
          />
          <button type="submit" disabled={loading}>
            {loading ? "Salvando…" : "Definir senha e entrar"}
          </button>
          <button type="button" className="button-secondary" onClick={onCancelar} disabled={loading}>
            Voltar
          </button>
        </form>
      </main>
    </div>
  );
}
