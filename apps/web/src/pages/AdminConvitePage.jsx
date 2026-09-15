import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { adminApi, setAdminToken } from "../api";
import { CascaDeAcesso } from "../components/CascaDeAcesso.jsx";
import { Button, Field } from "../styles/omnimobKit";

/* ────────────────────────────────────────────────────────────────────────────
   O convite para operar a plataforma, do lado de quem o recebe.

   É a `DefinirNova` da recuperação de senha com o tom do super-admin: confere
   o link ANTES de mostrar os campos, e depois de salvar já entra — a rota
   devolve a sessão pronta, e mandar para o login seria pedir a senha que a
   pessoa acabou de escolher. Destino do link `/admin/definir-senha?token=…`.
   ──────────────────────────────────────────────────────────────────────────── */

export function AdminConvitePage({ onLogin }) {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();

  const [checando, setChecando] = useState(true);
  const [valido, setValido] = useState(false);
  const [convite, setConvite] = useState(null);
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    if (!token) {
      setError("Convite inválido.");
      setChecando(false);
      return undefined;
    }
    adminApi.lerConvite(token)
      .then((r) => { if (vivo) { setValido(true); setConvite(r); } })
      .catch((err) => { if (vivo) setError(err.message || "Convite inválido."); })
      .finally(() => { if (vivo) setChecando(false); });
    return () => { vivo = false; };
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (senha !== confirmar) {
      setError("As senhas não conferem.");
      return;
    }
    if (senha.length < 8) {
      setError("A senha deve ter ao menos 8 caracteres.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const sessao = await adminApi.aceitarConvite(token, senha);
      setAdminToken(sessao.token);
      onLogin?.(sessao);
      navigate("/admin", { replace: true });
    } catch (err) {
      setError(err.message || "Não foi possível definir a senha.");
      if (["TOKEN_USADO", "TOKEN_EXPIRADO", "TOKEN_INVALIDO"].includes(err?.body?.code)) {
        setValido(false);
      }
    } finally {
      setLoading(false);
    }
  }

  if (checando) {
    return (
      <CascaDeAcesso tom="admin" eyebrow="CONVITE" strong="Conferindo" soft="o seu convite…" onSubmit={(e) => e.preventDefault()}>
        <p style={{ margin: 0, fontSize: "13px", color: "var(--tinta-55, rgba(255,255,255,0.55))" }}>Um instante.</p>
      </CascaDeAcesso>
    );
  }

  if (!valido) {
    return (
      <CascaDeAcesso
        tom="admin"
        eyebrow="CONVITE"
        strong="Este convite"
        soft="não vale mais."
        descricao={error || "Peça a quem te convidou para reenviar o convite."}
        nota="// convites valem 24 horas e só funcionam uma vez"
        rodape={<Link to="/admin/login" className="ax-alt">Ir para o login</Link>}
        onSubmit={(e) => { e.preventDefault(); navigate("/admin/login", { replace: true }); }}
      >
        <Button as="button" type="submit" variant="primary" className="dl-btn--block" arrow={false}>
          Ir para o login
        </Button>
      </CascaDeAcesso>
    );
  }

  const primeiroNome = convite?.nome ? convite.nome.split(" ")[0] : "";

  return (
    <CascaDeAcesso
      tom="admin"
      eyebrow="CONVITE PARA A PLATAFORMA"
      strong={primeiroNome ? `Olá, ${primeiroNome}.` : "Quase lá."}
      soft="Escolha a sua senha."
      descricao={
        `Seu acesso é ${convite?.email}${convite?.cargo ? `, com o cargo ${convite.cargo}` : ""}. ` +
        "Depois de salvar, você já entra no painel."
      }
      error={error}
      nota="// mínimo de 8 caracteres · acesso monitorado"
      rodape={<Link to="/admin/login" className="ax-alt">Já tem senha? Entrar</Link>}
      onSubmit={handleSubmit}
    >
      <Field label="Senha">
        <input
          className="dl-input"
          type="password"
          placeholder="••••••••"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
          autoComplete="new-password"
          disabled={loading}
          autoFocus
        />
      </Field>

      <Field label="Confirme a senha">
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

      <Button as="button" type="submit" variant="primary" className="dl-btn--block" disabled={loading}>
        {loading ? "Salvando…" : "Salvar e entrar"}
      </Button>
    </CascaDeAcesso>
  );
}
