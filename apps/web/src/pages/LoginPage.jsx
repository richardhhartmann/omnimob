import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";

export function LoginPage({ onLogin }) {
  const [searchParams] = useSearchParams();
  const tenantFromShowcase = searchParams.get("tenant") || "";
  const [form, setForm] = useState({ login: "", senha: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const session = await api.login(form);
      if (tenantFromShowcase && session?.tenant?.slug !== tenantFromShowcase) {
        setError("Este usuario nao pertence ao tenant da vitrine selecionada.");
        return;
      }
      onLogin(session);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
            required
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