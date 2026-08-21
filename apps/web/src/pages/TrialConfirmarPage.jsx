import { useEffect, useRef, useState } from "react";
import { enderecoVisivel, baseDaVitrine } from "../utils/enderecoVitrine";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { OmnimobStyles, LOGO_LOCKUP_HEADER_SRC } from "../styles/omnimobKit";
import { MODAL_CSS } from "../components/modalCSS";
import { IconeCheck } from "../components/Icones.jsx";

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
    /* Um fluxo só. Havia aqui uma tentativa anterior contra o endpoint de
       assinatura direta, porque o mesmo link servia aos dois caminhos; com a
       assinatura sem teste enterrada, aquilo virou uma requisição que falhava
       sempre antes da que interessa. */
    api
      .confirmarTrialOmnimob({ token })
      .then((resposta) => {
        setDados(resposta);
        setEstado("pronto");
      })
      .catch((e) => {
        setErro(e.message || "Não foi possível concluir.");
        setEstado("erro");
      });
  }, [token]);

  async function copiarAcesso() {
    const texto = `Omnimob — acesso de teste
Usuário: ${dados.login}
Senha: ${dados.senha}
Vitrine: ${baseDaVitrine({ slug: dados.slug })}`;
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
      <OmnimobStyles extra={CSS} />

      <Link to="/" className="tc-marca">
        <img src={LOGO_LOCKUP_HEADER_SRC} alt="Omnimob" />
      </Link>

      <div className="pm-caixa dl-glass tc-caixa">
        {estado === "criando" ? (
          <div className="tc-centro">
            <span className="tc-girando" aria-hidden="true" />
            <h1 className="pm-titulo">Preparando seu ambiente…</h1>
            <p className="pm-sub">
              Criando a imobiliária, o seu acesso e a vitrine pública. Leva alguns segundos.
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
            <span className="pm-feito__marca" aria-hidden="true"><IconeCheck size={24} /></span>
            <h1 className="pm-titulo">Seu ambiente está no ar</h1>
            <p className="pm-sub">
              Criamos a <strong>{dados.imobiliaria}</strong> com o seu plano liberado e a vitrine
              já no ar, esperando o seu primeiro imóvel.
            </p>

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
                {/* Endereço vindo da mesma função que monta os links do painel
                    e dos e-mails. Era `/vitrine/{slug}` escrito à mão, e ficou
                    para trás quando o subdomínio entrou — esta é a primeira
                    tela que a pessoa vê depois de confirmar o e-mail, então o
                    endereço errado aqui é o primeiro que ela decora. */}
                <code className="tm-valor">{enderecoVisivel(dados.slug)}</code>
              </div>
            </div>

            <p className="tm-aviso">
              Anote a senha antes de fechar — ela não aparece de novo. Também enviamos por
              e-mail. O teste vale até <strong>{validade}</strong>.
            </p>

            <div className="pm-acoes tm-acoes">
              <button type="button" className="pm-botao" onClick={copiarAcesso}>
                {copiado ? "Copiado!" : "Copiar acesso"}
              </button>
              {/* Leva o acesso no state do roteador: o login já preenche os
                  campos e limpa o state em seguida, então a senha temporária
                  não fica presa no history do navegador. */}
              <Link
                className="pm-botao pm-botao--primario tc-link"
                to="/login"
                state={{
                  credenciais: { login: dados.login, senha: dados.senha },
                  origem: "teste",
                }}
              >
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
  border: 2px solid var(--linha-14, rgba(255,255,255,0.14)); border-top-color: var(--accent-soft);
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

@media (prefers-reduced-motion: reduce) { .tc-girando { animation-duration: 2.4s; } }
`;

export default TrialConfirmarPage;
