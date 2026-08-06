import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { DomusStyles, LOGO_LOCKUP_HEADER_SRC } from "../styles/domusKit";
import { MODAL_CSS } from "../components/modalCSS";

/* ────────────────────────────────────────────────────────────────────────────
   Destino do link mágico do teste grátis.

   Abrir esta página É a confirmação: o token da URL prova a posse do e-mail, e
   é aqui que o ambiente nasce de verdade. Por isso a chamada dispara uma vez só
   — o React 18 em StrictMode monta, desmonta e monta de novo em
   desenvolvimento, e sem a trava isso viraria duas tentativas de criar tenant.
   ──────────────────────────────────────────────────────────────────────────── */

export function TrialConfirmarPage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [estado, setEstado] = useState(token ? "criando" : "erro");
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(token ? "" : "Link inválido ou incompleto.");
  const [copiado, setCopiado] = useState(false);
  const jaPediu = useRef(false);

  useEffect(() => {
    if (!token || jaPediu.current) return;
    jaPediu.current = true;
    /* O mesmo link serve aos dois fluxos. Tentamos primeiro o de assinatura
       (não cria nada, só lê) e, se o token não for desse propósito, caímos no
       de teste, que é o que cria o ambiente. A ordem importa: começar pelo que
       cria faria um token de assinatura disparar a criação de um segundo
       ambiente. */
    api
      .confirmarAssinaturaDireta({ token })
      .then((resposta) => {
        setDados(resposta);
        setEstado("pronto");
      })
      .catch(() =>
        api
          .confirmarTrialDomus({ token })
          .then((resposta) => {
            setDados(resposta);
            setEstado("pronto");
          })
          .catch((e) => {
            setErro(e.message || "Não foi possível concluir.");
            setEstado("erro");
          }),
      );
  }, [token]);

  async function copiarAcesso() {
    const texto = `Domus — acesso de teste
Usuário: ${dados.login}
Senha: ${dados.senha}
Vitrine: ${window.location.origin}/vitrine/${dados.slug}`;
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2200);
    } catch {
      /* sem permissão: o texto segue visível na tela */
    }
  }

  const validade = dados?.expiraEm ? new Date(dados.expiraEm).toLocaleDateString("pt-BR") : "";

  return (
    <div className="dl-root tc-pagina">
      <DomusStyles extra={CSS} />

      <Link to="/" className="tc-marca">
        <img src={LOGO_LOCKUP_HEADER_SRC} alt="Domus" />
      </Link>

      <div className="pm-caixa dl-glass tc-caixa">
        {estado === "criando" ? (
          <div className="tc-centro">
            <span className="tc-girando" aria-hidden="true" />
            <h1 className="pm-titulo">Preparando seu ambiente…</h1>
            <p className="pm-sub">
              Criando a imobiliária, subindo a vitrine e povoando com imóveis de exemplo. Leva alguns
              segundos.
            </p>
          </div>
        ) : null}

        {estado === "erro" ? (
          <div className="tc-centro">
            <span className="tc-marca-erro" aria-hidden="true">!</span>
            <h1 className="pm-titulo">Não foi possível concluir</h1>
            <p className="pm-sub">{erro}</p>
            <Link className="pm-botao pm-botao--primario tc-link" to="/">
              Voltar para o site
            </Link>
          </div>
        ) : null}

        {estado === "pronto" && dados ? (
          <div className="tm-pronto">
            <span className="pm-feito__marca" aria-hidden="true">✓</span>
            <h1 className="pm-titulo">
              {dados.assinou ? "Bem-vindo à Domus" : "Seu ambiente está no ar"}
            </h1>
            <p className="pm-sub">
              {dados.assinou ? (
                <>
                  Obrigado por assinar! A conta da <strong>{dados.imobiliaria}</strong> está ativa no
                  plano <strong>{dados.plano}</strong> — produto completo, sem prazo de teste
                  correndo.
                </>
              ) : (
                <>
                  Criamos a <strong>{dados.imobiliaria}</strong> com {dados.imoveis} imóveis de
                  exemplo, para você ver a plataforma funcionando sem cadastrar nada.
                </>
              )}
            </p>

            {dados.assinou ? (
              <div className="tm-acesso tc-plano">
                <div className="tm-linha">
                  <span className="tm-chave dl-mono">PLANO</span>
                  <code className="tm-valor">{dados.plano}</code>
                </div>
                {dados.valorMensal ? (
                  <div className="tm-linha">
                    <span className="tm-chave dl-mono">VALOR</span>
                    <code className="tm-valor">
                      R$ {Number(dados.valorMensal).toFixed(2).replace(".", ",")}/mês
                    </code>
                  </div>
                ) : null}
                {dados.proximaCobranca ? (
                  <div className="tm-linha">
                    <span className="tm-chave dl-mono">PRÓXIMA</span>
                    <code className="tm-valor">
                      {new Date(dados.proximaCobranca).toLocaleDateString("pt-BR")}
                    </code>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="tm-acesso">
              <div className="tm-linha">
                <span className="tm-chave dl-mono">USUÁRIO</span>
                <code className="tm-valor">{dados.login}</code>
              </div>
              <div className="tm-linha">
                <span className="tm-chave dl-mono">SENHA</span>
                <code className="tm-valor">{dados.senha}</code>
              </div>
              <div className="tm-linha">
                <span className="tm-chave dl-mono">VITRINE</span>
                <code className="tm-valor">/vitrine/{dados.slug}</code>
              </div>
            </div>

            <p className="tm-aviso">
              {dados.assinou ? (
                <>
                  No primeiro acesso vamos pedir que você troque esta senha. A cobrança é mensal e
                  automática.
                </>
              ) : (
                <>
                  Anote a senha antes de fechar — ela não aparece de novo. Também enviamos por
                  e-mail. O teste vale até <strong>{validade}</strong>.
                </>
              )}
            </p>

            <div className="pm-acoes tm-acoes">
              <button type="button" className="pm-botao" onClick={copiarAcesso}>
                {copiado ? "Copiado!" : "Copiar acesso"}
              </button>
              <Link className="pm-botao pm-botao--primario tc-link" to="/login">
                Entrar no painel
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const CSS = `${MODAL_CSS}
.tc-pagina {
  min-height: 100vh; display: grid; place-items: center; gap: 26px;
  align-content: center; padding: 30px 22px;
}
.tc-marca img { height: 34px; display: block; opacity: 0.9; }
.tc-caixa { animation: none; }
.tc-centro { display: grid; justify-items: center; text-align: center; gap: 12px; }
.tc-centro .pm-sub { margin-top: 0; }
.dl-root .tc-link { display: inline-flex; align-items: center; text-decoration: none; margin-top: 6px; }

.tc-girando {
  width: 34px; height: 34px; border-radius: 999px; margin-bottom: 4px;
  border: 2px solid rgba(255,255,255,0.14); border-top-color: var(--accent-soft);
  animation: tcGira 0.8s linear infinite;
}
@keyframes tcGira { to { transform: rotate(360deg); } }

.tc-marca-erro {
  width: 52px; height: 52px; border-radius: 999px; display: grid; place-items: center;
  background: rgba(248,113,113,0.14); border: 1px solid rgba(248,113,113,0.4);
  color: #fca5a5; font-size: 24px; font-weight: 700; margin-bottom: 4px;
}

/* Peças herdadas do TrialModal, que não está montado nesta página. */
.tm-pronto { display: grid; justify-items: center; text-align: center; gap: 12px; }
.tm-pronto .pm-sub { margin-top: 0; }
.tm-acesso {
  width: 100%; margin-top: 6px; display: grid; gap: 1px;
  border-radius: 13px; overflow: hidden; border: 1px solid var(--line); background: var(--line);
}
.tm-linha {
  display: grid; grid-template-columns: 88px 1fr; align-items: center; gap: 12px;
  padding: 11px 14px; background: var(--surface); text-align: left;
}
.tm-chave { color: var(--placeholder); font-size: 8.5px; }
.tm-valor {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 13px; color: var(--strong); word-break: break-all;
}
.tm-aviso {
  font-size: 12px; line-height: 1.65; color: var(--subtle);
  padding: 10px 13px; border-radius: 10px;
  background: rgba(212,175,55,0.09); border: 1px solid rgba(212,175,55,0.24);
}
.tm-acoes { width: 100%; justify-content: center; }
.tc-plano { margin-bottom: 4px; }

@media (prefers-reduced-motion: reduce) { .tc-girando { animation-duration: 2.4s; } }
`;

export default TrialConfirmarPage;
