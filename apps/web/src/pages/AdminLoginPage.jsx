import { useState } from "react";
import { adminApi, setAdminToken } from "../api";

export function AdminLoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await adminApi.login({ email, senha });
      setAdminToken(res.token);
      onLogin({ token: res.token, email: res.email, nome: res.nome });
    } catch (err) {
      setError(err.message || "Falha no login.");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    width: "100%", boxSizing: "border-box", padding: "12px 14px",
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "10px", color: "#fff", fontSize: "14px", outline: "none",
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", background: "linear-gradient(135deg, #0f172a, #1e1b4b, #312e81)" }}>
      <form onSubmit={handleSubmit} className="glass-panel" style={{ width: "100%", maxWidth: "400px", padding: "36px", display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ textAlign: "center", marginBottom: "8px" }}>
          <div style={{ fontSize: "12px", fontWeight: "700", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--accent)" }}>Domus</div>
          <h1 style={{ fontSize: "22px", fontWeight: "700", margin: "6px 0 4px" }}>Painel Super-Admin</h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>Acesso restrito à administração da plataforma.</p>
        </div>

        {error ? (
          <div style={{ padding: "10px 14px", borderRadius: "10px", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", fontSize: "13px" }}>
            {error}
          </div>
        ) : null}

        <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>E-mail</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} placeholder="super@domus.com" />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>Senha</span>
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required style={inputStyle} placeholder="••••••••" />
        </label>

        <button type="submit" disabled={loading} style={{ marginTop: "8px", padding: "13px", borderRadius: "10px", border: "none", background: "var(--accent)", color: "#fff", fontWeight: "700", fontSize: "14px", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
