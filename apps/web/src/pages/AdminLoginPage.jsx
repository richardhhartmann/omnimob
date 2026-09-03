import { useState } from "react";
import { Link } from "react-router-dom";
import { adminApi, setAdminToken } from "../api";
import { CascaDeAcesso } from "../components/CascaDeAcesso.jsx";
import { Button, Field, useSaidaDeAuth } from "../styles/omnimobKit";

/* Login do painel super-admin.

   Mesma casca do login do cliente (`CascaDeAcesso`), com `tom="admin"`: o que
   muda é a paleta, a cor do fluido e o recado. A tela tinha uma casca própria,
   escrita à mão, e as duas já haviam divergido em padding, tamanho de título e
   fundo — ver o cabeçalho do componente.

   ── DUAS ETAPAS QUANDO HÁ SEGUNDO FATOR ──

   A senha é a primeira. Se a conta tiver aplicativo autenticador ligado, o
   servidor não devolve sessão: devolve um DESAFIO de cinco minutos, e a tela
   troca os campos pelo de seis dígitos. A senha digitada NÃO fica guardada
   esperando o segundo passo — é o desafio que carrega "a senha já passou".

   Contas sem segundo fator entram num passo só, como sempre. */

export function AdminLoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  // Quando existe, a tela está no segundo passo.
  const [desafio, setDesafio] = useState(null);
  const [codigo, setCodigo] = useState("");
  const { saindo, sair } = useSaidaDeAuth();

  function entrar(res) {
    setAdminToken(res.token);
    // A troca de sessão só acontece quando a tela terminar de sair.
    sair(() => onLogin({ token: res.token, email: res.email, nome: res.nome }));
  }

  async function handleSenha(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await adminApi.login({ email, senha });
      if (res?.precisaTotp) {
        setDesafio(res.desafio);
        /* A senha sai da memória da tela junto: daqui em diante quem prova a
           primeira etapa é o desafio, e guardá-la só aumentaria a superfície. */
        setSenha("");
        return;
      }
      entrar(res);
    } catch (err) {
      setError(err.message || "Falha no login.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCodigo(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await adminApi.loginTotp(desafio, codigo);
      /* Quantos códigos de recuperação sobraram vive na aba Segurança do
         painel, que os lê do servidor. Guardar o número aqui daria duas fontes
         para o mesmo dado — e a desta tela envelheceria na primeira ativação
         nova. A resposta traz `recuperacaoRestantes` para quem precisar. */
      entrar(res);
    } catch (err) {
      /* Desafio vencido tem saída diferente de código errado: um pede a senha
         de novo, o outro pede o próximo código. Insistir no campo errado é o
         que essa distinção evita. */
      if (err?.body?.code === "DESAFIO_EXPIRADO") {
        setDesafio(null);
        setCodigo("");
        setAviso("A etapa da senha expirou. Entre novamente.");
        setError("");
      } else {
        setError(err.message || "Codigo invalido.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (desafio) {
    return (
      <CascaDeAcesso
        tom="admin"
        eyebrow="VERIFICAÇÃO EM DUAS ETAPAS"
        strong="Digite o código"
        soft="do seu aplicativo."
        descricao="São seis dígitos, e eles trocam a cada 30 segundos. Sem o celular, use um dos códigos de recuperação."
        error={error}
        saindo={saindo}
        onSubmit={handleCodigo}
        nota="// o código vale uma vez só"
        rodape={
          <button
            type="button"
            className="ax-alt ax-voltar"
            onClick={() => { setDesafio(null); setCodigo(""); setError(""); }}
          >
            Voltar e digitar a senha
          </button>
        }
      >
        <Field label="Código" hint="Ou um código de recuperação, no formato XXXXX-XXXXX.">
          <input
            className="dl-input ax-codigo"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            required
            /* `one-time-code` é o que faz o iOS e o Android oferecerem o código
               copiado; `off` no autocorretor porque ele "conserta" o hífen do
               código de recuperação. */
            autoComplete="one-time-code"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
            inputMode="text"
            maxLength={11}
            placeholder="000000"
            autoFocus
            disabled={loading}
          />
        </Field>

        <Button as="button" type="submit" variant="primary" className="dl-btn--block" disabled={loading}>
          {loading ? "Conferindo…" : "Confirmar"}
        </Button>
      </CascaDeAcesso>
    );
  }

  return (
    <CascaDeAcesso
      tom="admin"
      eyebrow="ACESSO RESTRITO"
      strong="Painel"
      soft="Super-Admin."
      error={error}
      aviso={aviso}
      saindo={saindo}
      onSubmit={handleSenha}
      nota="// acesso monitorado · use as credenciais da plataforma"
      rodape={<Link to="/login" className="ax-alt">É de uma imobiliária? Entrar no painel do cliente</Link>}
    >
      <Field label="E-mail">
        <input
          className="dl-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="username"
          placeholder="super@omnimob.app"
          disabled={loading}
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
          disabled={loading}
        />
      </Field>

      {/* Botão branco, e não o acento: é o mesmo par de cores que o painel
          super-admin usa por dentro, e ele não deve parecer o botão do cliente
          — as duas telas são parecidas de propósito, mas a ação principal é a
          de sistemas diferentes. */}
      <Button as="button" type="submit" variant="primary" className="dl-btn--block" disabled={loading}>
        {loading ? "Entrando…" : "Entrar"}
      </Button>
    </CascaDeAcesso>
  );
}
