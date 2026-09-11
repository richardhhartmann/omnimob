import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { BotaoGoogle } from "../components/BotaoGoogle.jsx";
import { CascaDeAcesso, DivisorDeAcesso, UltimoUtilizado } from "../components/CascaDeAcesso.jsx";
import { GOOGLE, SENHA, lerUltimoAcesso, registrarUltimoAcesso } from "../utils/ultimoAcesso";
import { Button, Field, useSaidaDeAuth } from "../styles/omnimobKit";

/* Login do painel do tenant.

   A página é só o FORMULÁRIO: as duas colunas, o fundo de ondas, o vidro e a
   saída animada moram no `CascaDeAcesso`, compartilhado com o login do
   super-admin e com a recuperação de senha. */

/* Avisos de quem chegou ao login por uma ação do produto. A chave viaja no
   state do roteador (ver `handleLogout` no App) e some depois de lida — sem
   isso, o recado voltaria a cada F5 e a cada passo para trás. */
const AVISOS_DE_ENTRADA = {
  "sessao-encerrada": "Sessão encerrada. Entre novamente para voltar ao painel.",
  /* Estes dois só existem desde que o acesso passou a ser conferido no banco a
     cada requisição. Antes, quem fosse desativado seguia usando o painel até o
     token vencer — não havia momento em que este recado pudesse aparecer. */
  "acesso-revogado": "Seu acesso foi encerrado. Fale com o administrador da sua imobiliária.",
  "conta-inativa": "A conta da sua imobiliária está desativada. Assine um plano para voltar a usar o painel.",
};

export function LoginPage({ onLogin }) {
  const [searchParams] = useSearchParams();
  const tenantFromShowcase = searchParams.get("tenant") || "";
  const local = useLocation();
  const navegar = useNavigate();
  /* Quem acabou de assinar chega aqui vindo do modal da landing, com o acesso
     no state do roteador. Preencher os campos evita copiar e colar de uma tela
     que ele acabou de fechar — e a senha é temporária mesmo, trocada logo em
     seguida. Só vale na montagem: depois disso os campos são de quem digita. */
  const recebidas = local.state?.credenciais || null;
  const [form, setForm] = useState({
    login: recebidas?.login || "",
    senha: recebidas?.senha || "",
  });
  // Guardado à parte porque a limpeza logo abaixo apaga `recebidas` no
  // re-render, e o aviso da tela precisa continuar de pé. `origem` diz de qual
  // fluxo o acesso veio — assinatura (padrão) ou liberação do teste grátis.
  const [origem] = useState(recebidas ? local.state?.origem || "assinatura" : null);
  const veioDeAcessoPronto = Boolean(origem);
  /* Recado de quem chegou aqui por uma AÇÃO, e não digitando o endereço. Hoje
     só "encerrei a sessão"; a forma é de mapa para o dia em que houver outro
     ("sua sessão expirou", por exemplo).

     Guardado em estado na montagem pelo mesmo motivo das credenciais: a limpeza
     logo abaixo apaga `local.state` no re-render, e o aviso precisa continuar
     de pé enquanto a pessoa lê. */
  const [aviso] = useState(() => AVISOS_DE_ENTRADA[local.state?.motivo] || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { saindo, sair } = useSaidaDeAuth();

  /* Qual caminho funcionou nesta máquina da última vez. Lido UMA vez, na
     montagem: ele muda no meio do login bem-sucedido, e reler faria o marcador
     saltar para o outro botão no instante em que a tela está saindo. */
  const [ultimoAcesso] = useState(lerUltimoAcesso);

  /* Limpa o state assim que ele é lido: sem isso a senha ficaria no
     history.state do navegador e voltaria a cada F5 ou passo para trás. */
  useEffect(() => {
    if (!recebidas && !local.state?.motivo) return;
    navegar(local.pathname + local.search, { replace: true, state: null });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  /* O botão do Google só existe se o servidor souber falar com ele. */
  const [google, setGoogle] = useState({ disponivel: false, clientId: null });
  const [comGoogle, setComGoogle] = useState(false);
  useEffect(() => {
    api.googleDisponivel().then(setGoogle).catch(() => {});
  }, []);

  async function entrarComGoogle(credencial) {
    setComGoogle(true);
    setError("");
    try {
      const session = await api.entrarComGoogle(credencial);
      if (!validarTenant(session)) return;
      registrarUltimoAcesso(GOOGLE);
      sair(() => onLogin(session));
    } catch (err) {
      /* A mensagem do servidor já explica o caso mais comum — conta sem vínculo
         — e diz o que fazer. Substituí-la por um genérico apagaria a única
         instrução que a pessoa tem. */
      setError(err.message || "Não consegui entrar com o Google.");
    } finally {
      setComGoogle(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const session = await api.login(form);
      if (!validarTenant(session)) return;
      /* Só depois de a sessão vir. Gravar no envio marcaria como "último
         utilizado" um caminho que acabou de recusar a senha. */
      registrarUltimoAcesso(SENHA);
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
    <CascaDeAcesso
      eyebrow={
        veioDeAcessoPronto
          ? origem === "teste"
            ? "TESTE LIBERADO"
            : "ASSINATURA CONFIRMADA"
          : tenantFromShowcase
            ? `VITRINE · ${tenantFromShowcase.toUpperCase()}`
            : "ACESSO DO CLIENTE"
      }
      strong="Entrar no"
      soft="painel da sua imobiliária."
      descricao={
        veioDeAcessoPronto
          ? "Já preenchemos seu acesso. É só entrar — na sequência vamos pedir que você troque a senha temporária."
          : tenantFromShowcase
            ? `Você está entrando no ambiente do tenant ${tenantFromShowcase}. Use as credenciais dessa imobiliária.`
            : ""
      }
      onSubmit={handleSubmit}
      error={error}
      aviso={aviso}
      saindo={saindo}
      nota="// imóveis · vitrine · leads · equipe"
      rodape={
        <>
          <Link to="/recuperar-senha" className="ax-alt">Esqueci minha senha</Link>
          {/* ── Sem link para /admin/login ────────────────────────────────────
              A porta da administração da plataforma existe, mas não se anuncia
              na tela por onde entram todos os clientes. Ela não vale como
              segredo — a rota continua respondendo a quem digitar o endereço, e
              tratar isso como proteção seria segurança por obscuridade. O que
              ela evita é outra coisa: um alvo apontado, com nome e link, na
              página mais visitada do produto. Quem precisa dela sabe o caminho
              e o guarda nos favoritos.

              Segunda linha, em tom mais baixo: a tela de entrada é onde muita
              gente chega direto, e sair dela sem caminho para os documentos
              legais deixaria a Omnimob sem nenhum a partir daqui. */}
          <span className="ax-legal">
            <Link to="/termos" className="ax-alt">Termos</Link>
            {" · "}
            <Link to="/privacidade" className="ax-alt">Privacidade</Link>
            {" · "}
            <Link to="/contato" className="ax-alt">Contato</Link>
          </span>
        </>
      }
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

      <UltimoUtilizado marcado={ultimoAcesso === SENHA}>
        <Button as="button" type="submit" variant="accent" className="dl-btn--block" disabled={loading}>
          {loading ? "Entrando…" : "Acessar painel"}
        </Button>
      </UltimoUtilizado>

      {/* ── Entrar com Google ────────────────────────────────────────────────
          Só aparece se o servidor tiver client id configurado. Um botão de
          login que falha no clique é pior que um a menos: ele quebra a
          confiança no passo em que ela mais importa.

          E ele NÃO cria conta. Quem nunca vinculou recebe uma recusa que diz o
          caminho — entrar uma vez com login e senha e vincular pelo menu do
          perfil. Se criasse, qualquer pessoa com uma conta Google entraria no
          painel de qualquer imobiliária. */}
      {google.disponivel ? (
        <>
          <DivisorDeAcesso />
          {/* O botão é desenhado pelo Google. A primeira versão era nosso, com
              `prompt()` por trás — e o One Tap foi suprimido pelo navegador em
              toda tentativa (FedCM desativado, 403 no status). Ver
              `utils/google.js`. */}
          {comGoogle
            ? <p className="dl-mono ax-nota" style={{ marginTop: 0 }}>Entrando…</p>
            : (
              <UltimoUtilizado marcado={ultimoAcesso === GOOGLE}>
                <BotaoGoogle clientId={google.clientId} aoReceber={entrarComGoogle} largura={320} />
              </UltimoUtilizado>
            )}
        </>
      ) : null}
    </CascaDeAcesso>
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
    <CascaDeAcesso
      eyebrow="PRIMEIRO ACESSO"
      strong="Defina sua"
      soft="senha para continuar."
      onSubmit={handleSubmit}
      error={error}
      /* Sem `aviso` aqui. Ele existe no `LoginPage` e descreve por que a pessoa
         CAIU na tela de login — "sua sessão foi encerrada", por exemplo. Este
         cartão só aparece DEPOIS de um login bem-sucedido, então repetir aquele
         texto seria falar de um problema que acabou de ser resolvido.

         Antes a linha era `aviso={aviso}`, referenciando uma variável de outro
         componente: derrubava a tela inteira com "aviso is not defined" no
         primeiro acesso de todo usuário novo — exatamente quando a troca de
         senha é obrigatória. */
      saindo={saindo}
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

      <div className="ax-acoes">
        <Button as="button" type="submit" variant="accent" className="dl-btn--block" disabled={loading}>
          {loading ? "Salvando…" : "Definir senha e entrar"}
        </Button>
        <Button as="button" type="button" variant="ghost" arrow={false} className="dl-btn--block" onClick={onCancelar} disabled={loading}>
          Voltar
        </Button>
      </div>
    </CascaDeAcesso>
  );
}
