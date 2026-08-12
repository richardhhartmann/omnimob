import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { Button, Field } from "../styles/omnimobKit";
import { AuthShell } from "./LoginPage";

/* ────────────────────────────────────────────────────────────────────────────
   Recuperação de senha — uma página, dois momentos.

   Sem token na URL, ela pede o login ou o e-mail. Com token (o link que chegou
   por e-mail), ela pede a senha nova. São a mesma página porque são o mesmo
   assunto, e porque a segunda precisa poder voltar para a primeira quando o
   link expira — o que num par de páginas separadas viraria uma ida e volta em
   que a pessoa se perde.

   A casca visual vem do `AuthShell` do login, de propósito: nesta tela em
   particular, qualquer diferença de aparência em relação ao login parece golpe.
   ──────────────────────────────────────────────────────────────────────────── */

export function RecuperarSenhaPage({ onLogin }) {
  const [params] = useSearchParams();
  const token = params.get("token");
  return token
    ? <DefinirNova token={token} onLogin={onLogin} />
    : <PedirLink />;
}

// ─── Momento 1: pedir o link ────────────────────────────────────────────────

function PedirLink() {
  const [identificador, setIdentificador] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.pedirRecuperacaoSenha(identificador.trim());
      setEnviado(true);
    } catch (err) {
      /* A rota responde 200 mesmo quando não encontra ninguém, então cair aqui
         é falha de rede ou do servidor — nunca "conta não existe". */
      setError(err.message || "Não consegui enviar agora. Tente de novo em instantes.");
    } finally {
      setLoading(false);
    }
  }

  /* Confirmação sem promessa. "Enviamos para o seu e-mail" afirmaria que a conta
     existe e que ela tem e-mail — as duas coisas que a resposta esconde de
     propósito. O texto diz o que fazer e o que checar, sem confirmar nada. */
  if (enviado) {
    return (
      <AuthShell
        eyebrow="RECUPERAR ACESSO"
        strong="Se a conta existir,"
        soft="o link já está a caminho."
        descricao="Verifique a caixa de entrada e o spam. O link vale por 1 hora e só funciona uma vez."
        nota="// não recebeu? confira se o acesso está correto e tente de novo"
        rodape={<Link to="/login" className="lg-alt">Voltar para o login</Link>}
        onSubmit={(e) => e.preventDefault()}
      >
        <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.6, color: "rgba(255,255,255,0.62)" }}>
          Se o seu usuário não tiver e-mail cadastrado, o link não chega — nesse caso, quem redefine
          a sua senha é o administrador da sua imobiliária, na tela de Usuários.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="RECUPERAR ACESSO"
      strong="Esqueceu"
      soft="a sua senha?"
      descricao="Informe o seu login ou o e-mail cadastrado. Enviamos um link para você escolher uma nova senha."
      error={error}
      nota="// o link vale por 1 hora"
      rodape={<Link to="/login" className="lg-alt">Voltar para o login</Link>}
      onSubmit={handleSubmit}
    >
      <Field label="Login ou e-mail">
        <input
          className="dl-input"
          placeholder="seu.login ou voce@imobiliaria.com.br"
          value={identificador}
          onChange={(e) => setIdentificador(e.target.value)}
          required
          autoComplete="username"
          disabled={loading}
        />
      </Field>

      <Button as="button" type="submit" variant="accent" className="dl-btn--block" disabled={loading}>
        {loading ? "Enviando…" : "Enviar link de recuperação"}
      </Button>
    </AuthShell>
  );
}

// ─── Momento 2: escolher a senha nova ───────────────────────────────────────

function DefinirNova({ token, onLogin }) {
  const navigate = useNavigate();
  const [checando, setChecando] = useState(true);
  const [valido, setValido] = useState(false);
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* Confere o link ANTES de mostrar os campos. Sem isso a pessoa digitaria a
     senha duas vezes para só então descobrir que o link expirou — e teria de
     digitar tudo de novo depois de pedir outro. */
  useEffect(() => {
    let vivo = true;
    api.validarTokenSenha(token)
      .then((r) => { if (vivo) { setValido(true); setNome(r?.nome || ""); } })
      .catch((err) => { if (vivo) setError(err.message || "Link inválido. Peça um novo."); })
      .finally(() => { if (vivo) setChecando(false); });
    return () => { vivo = false; };
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (senha !== confirmar) {
      setError("As senhas não conferem.");
      return;
    }
    if (senha.length < 6) {
      setError("A nova senha deve ter ao menos 6 caracteres.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const sessao = await api.redefinirSenha(token, senha);
      /* A rota devolve a sessão pronta. Mandar para o login depois de redefinir
         seria pedir a senha que a pessoa acabou de escolher, na tela seguinte. */
      onLogin?.(sessao);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message || "Não foi possível redefinir a senha.");
      /* Token queimado ou vencido: os campos somem e sobra o caminho de pedir
         outro link, que é a única coisa que resolve. */
      if (["TOKEN_USADO", "TOKEN_EXPIRADO", "TOKEN_INVALIDO"].includes(err?.body?.code)) {
        setValido(false);
      }
    } finally {
      setLoading(false);
    }
  }

  if (checando) {
    return (
      <AuthShell
        eyebrow="RECUPERAR ACESSO"
        strong="Conferindo"
        soft="o seu link…"
        onSubmit={(e) => e.preventDefault()}
      >
        <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.55)" }}>Um instante.</p>
      </AuthShell>
    );
  }

  if (!valido) {
    return (
      <AuthShell
        eyebrow="RECUPERAR ACESSO"
        strong="Este link"
        soft="não vale mais."
        descricao={error || "Peça um novo link para escolher a sua senha."}
        nota="// links de recuperação valem 1 hora e só funcionam uma vez"
        rodape={<Link to="/login" className="lg-alt">Voltar para o login</Link>}
        onSubmit={(e) => { e.preventDefault(); navigate("/recuperar-senha", { replace: true }); }}
      >
        <Button as="button" type="submit" variant="accent" className="dl-btn--block">
          Pedir um novo link
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="RECUPERAR ACESSO"
      strong={nome ? `Olá, ${nome.split(" ")[0]}.` : "Quase lá."}
      soft="Escolha a sua nova senha."
      descricao="Depois de salvar, você já entra no painel — não precisa fazer login de novo."
      error={error}
      nota="// mínimo de 6 caracteres"
      rodape={<Link to="/login" className="lg-alt">Voltar para o login</Link>}
      onSubmit={handleSubmit}
    >
      <Field label="Nova senha">
        <input
          className="dl-input"
          type="password"
          placeholder="••••••••"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
          autoComplete="new-password"
          disabled={loading}
        />
      </Field>

      <Field label="Confirme a nova senha">
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

      <Button as="button" type="submit" variant="accent" className="dl-btn--block" disabled={loading}>
        {loading ? "Salvando…" : "Salvar e entrar"}
      </Button>
    </AuthShell>
  );
}

export default RecuperarSenhaPage;
