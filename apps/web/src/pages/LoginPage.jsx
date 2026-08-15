import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import GradientWaves from "../components/GradientWaves";
import { Alert, Button, OmnimobStyles, Eyebrow, Field, LogoLockup, Reveal, Scallop, useSaidaDeAuth } from "../styles/omnimobKit";

/* Login do painel do tenant.

   Usa a mesma linguagem visual da landing (vidro sobre blobs, micro-labels em
   mono, título de duas cores, botão pill), mas com a paleta que a página já
   tinha: o gradiente do body, acento #818cf8 → #6366f1 e bordas a 8% de branco.
   Os tokens são sobrescritos em `.lg-root`, então as primitivas do kit se
   adaptam sozinhas. */

/* Avisos de quem chegou ao login por uma ação do produto. A chave viaja no
   state do roteador (ver `handleLogout` no App) e some depois de lida — sem
   isso, o recado voltaria a cada F5 e a cada passo para trás. */
const AVISOS_DE_ENTRADA = {
  "sessao-encerrada": "Sessão encerrada. Entre novamente para voltar ao painel.",
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
          {/* Antes do link da plataforma: quem chega aqui travado quer resolver
              a própria senha, não achar o painel de administração da Omnimob. */}
          <Link to="/recuperar-senha" className="lg-alt">Esqueci minha senha</Link>
          {" · "}
          <Link to="/admin/login" className="lg-alt">Administração da plataforma</Link>
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
      onSubmit={handleSubmit}
      error={error}
      aviso={aviso}
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

/* Exportada para a recuperação de senha usar a MESMA casca.
   Reconstruir o vidro, os blobs e o logo noutro arquivo daria duas telas de
   autenticação parecidas mas nunca iguais — e é justamente na tela de recuperar
   senha, onde a pessoa já desconfia de estar no lugar errado, que qualquer
   diferença visual parece phishing. */
export function AuthShell({ eyebrow, strong, soft, descricao, error, aviso, nota, rodape, onSubmit, saindo, children }) {
  return (
    <div className={`dl-root dl-page lg-root${saindo ? " authx-out" : ""}`}>
      <OmnimobStyles extra={CSS} />

      {/* Fundo de ondas. Vive numa camada própria, atrás dos blobs e do cartão.

          As cores saem da paleta que a tela já tinha (--accent #818cf8 e o
          #6366f1 do botão), e não do roxo/rosa do exemplo: o login é a primeira
          tela do produto e não pode apresentar uma identidade que nenhuma outra
          repete.

          `mouseInteraction={false}`: o paralaxe do componente é preso ao canvas,
          e aqui o cartão de vidro cobre o meio da tela — o efeito responderia só
          nas bordas, o que lê como falha em vez de recurso. */}
      <div className="lg-ondas" aria-hidden="true">
        <GradientWaves
          horizonColor="#111117"
          waveColor="#6366f1"
          crestColor="#818cf8"
          speed={0.35}
          amplitude={2.2}
          waveScale={0.6}
          waveRatio={0.9}
          swell={30}
          turbulence={18}
          tilt={1.11}
          zoom={1.0}
          height={5.5}
          fogDepth={14}
          detail="medium"
          brightness={0.9}
          opacity={0.85}
          mouseInteraction={false}
          grain
          grainIntensity={0.04}
        />
      </div>

      <div className="lg-shapes authx-shapes" aria-hidden="true">
        <Scallop size={160} color="#818cf8" style={{ position: "absolute", top: "14%", right: "9%", opacity: 0.28 }} />
        <span className="lg-shape lg-shape--halfs" />
        <span className="lg-shape lg-shape--circle" />
        <span className="lg-shape lg-shape--glow" />
      </div>

      <Reveal as="form" className="lg-card dl-glass authx-card" onSubmit={onSubmit}>
        <Link to="/" className="dl-logo lg-logo" aria-label="Omnimob — início">
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

        {/* O aviso vem antes do erro e em tom neutro: "sessão encerrada" é o
            desfecho de algo que a pessoa pediu, não uma falha. Se ela errar a
            senha em seguida, o erro entra logo abaixo e os dois convivem sem se
            confundir. */}
        {aviso ? <Alert tone="info">{aviso}</Alert> : null}
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

/* Camada das ondas: abaixo dos blobs e do cartão, e sem ponteiro — o canvas
   cobriria a tela inteira e engoliria o clique nos campos. */
.lg-ondas { position: absolute; inset: 0; z-index: 0; pointer-events: none; }
.lg-shapes { position: absolute; inset: 0; pointer-events: none; z-index: 1; }
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
  position: relative; z-index: 2;
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
