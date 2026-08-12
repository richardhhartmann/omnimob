import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { enderecoVisivel } from "../utils/enderecoVitrine";

/* ────────────────────────────────────────────────────────────────────────────
   Escolha do endereço da vitrine.

   Duas opções, nesta ordem na tela:

     · domínio da imobiliária — recomendado, porque aí o esforço de SEO soma
       para o domínio dela e não para o nosso
     · endereço da Omnimob — já incluso, funciona sozinho, nada a configurar,
       e é o que vale enquanto ninguém escolher nada

   Usado em dois lugares (o passo do primeiro acesso e a tela de Configurações),
   e é por isso que vive aqui: a parte trabalhosa não é a escolha, é o que vem
   depois dela — instruções de DNS, espera de propagação, reverificação. Duplicar
   isso em duas telas garantiria que uma das duas ficaria para trás.

   ─── O PASSO QUE NÃO DÁ PARA AUTOMATIZAR ────────────────────────────────────
   Cadastramos o domínio, perguntamos o que é preciso, verificamos e o
   certificado sai sozinho. O que ninguém faz pelo cliente é escrever no DNS
   dele — só quem tem a senha do registrador pode. Toda a tela é desenhada em
   volta disso: os valores vêm prontos, com botão de copiar, porque cada
   caractere digitado à mão é uma chance de errar e culpar o sistema.
   ──────────────────────────────────────────────────────────────────────────── */

/* `aoAtualizarTenant` mantém a SESSÃO em dia com o endereço.

   Sem ele, configurar o domínio não mudava nada fora desta tela: o
   `baseDaVitrine` lê da sessão, e a sessão só é montada no login — o
   `/api/auth/me` devolve o usuário, nunca o tenant. Então "Ver página",
   "Copiar link" e os links de divulgação continuavam apontando para o endereço
   da Omnimob até a pessoa sair e entrar de novo, sem nenhuma pista do porquê. */
export function DominioVitrine({ tenantSlug, compacto = false, aoConcluir, aoAtualizarTenant }) {
  const [estado, setEstado] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [escolha, setEscolha] = useState(null); // "omnimob" | "proprio"
  const [dominio, setDominio] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState("");

  const carregar = useCallback(() => {
    if (!tenantSlug) return;
    api.getDominio(tenantSlug)
      .then((r) => {
        setEstado(r);
        setDominio(r.dominio || "");
        /* Quem já tem domínio cai na tela dele. Quem não tem começa com o
           endereço da Omnimob marcado — porque é o que está valendo de fato,
           não uma sugestão. Deixar os dois cartões apagados dava a impressão de
           que nada estava definido e a vitrine estava sem endereço.

           Marcar aqui não conta como escolha: o `aoConcluir` só dispara no
           clique, então no modal de primeiro acesso o botão "Concluir" segue
           esperando uma decisão de verdade. */
        setEscolha(r.dominio ? "proprio" : "omnimob");
        // Domínio já no ar é escolha resolvida — quem abre a tela de novo não
        // deve ficar sem saída porque a decisão foi tomada da vez passada.
        aoAtualizarTenant?.({ dominioProprio: r.dominio || null, dominioStatus: r.status });
        if (r.status === "ATIVO") aoConcluir?.("proprio");
      })
      .catch(() => setEstado(null))
      .finally(() => setCarregando(false));
    // `aoConcluir` fica fora das deps de propósito: o pai costuma passar uma
    // função nova a cada render, e incluí-la refaria a requisição sem parar.
  }, [tenantSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(carregar, [carregar]);

  async function salvar(e) {
    e?.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      const r = await api.definirDominio(tenantSlug, dominio);
      setEstado((s) => ({ ...s, ...r }));
      aoAtualizarTenant?.({ dominioProprio: r.dominio || null, dominioStatus: r.status });
    } catch (err) {
      setErro(err.message || "Não consegui cadastrar o domínio.");
    } finally {
      setEnviando(false);
    }
  }

  async function verificar() {
    setErro("");
    setEnviando(true);
    try {
      const r = await api.verificarDominio(tenantSlug);
      setEstado((s) => ({ ...s, ...r }));
      aoAtualizarTenant?.({ dominioProprio: r.dominio || null, dominioStatus: r.status });
      // Avisa quem hospeda esta tela (o modal de primeiro acesso) que a escolha
      // chegou ao fim — é o gatilho do botão de concluir.
      if (r.status === "ATIVO") aoConcluir?.("proprio");
      if (r.status !== "ATIVO") {
        setErro("O DNS ainda não respondeu. Isso leva de alguns minutos a algumas horas — pode fechar e voltar depois.");
      }
    } catch (err) {
      setErro(err.message || "Não consegui verificar agora.");
    } finally {
      setEnviando(false);
    }
  }

  async function remover() {
    setErro("");
    setEnviando(true);
    try {
      await api.removerDominio(tenantSlug);
      aoAtualizarTenant?.({ dominioProprio: null, dominioStatus: "OMNIMOB" });
      setDominio("");
      setEscolha("omnimob");
      carregar();
    } catch (err) {
      setErro(err.message || "Não consegui remover.");
    } finally {
      setEnviando(false);
    }
  }

  function copiar(valor, chave) {
    navigator.clipboard?.writeText(valor);
    setCopiado(chave);
    setTimeout(() => setCopiado(""), 1800);
  }

  if (carregando) return <div className="dv-carregando">Carregando…</div>;

  const enderecoOmnimob = enderecoVisivel(estado?.slug || tenantSlug);
  const bloqueadoNoPlano = estado && estado.liberadoNoPlano === false;
  const semIntegracao = estado && estado.disponivel === false;
  const ativo = estado?.status === "ATIVO";
  const pendente = estado?.status === "PENDENTE";

  return (
    <div className={`dv${compacto ? " dv--compacto" : ""}`}>
      <style>{CSS}</style>

      {/* ── Escolha ──────────────────────────────────────────────────────────
          O domínio próprio vem PRIMEIRO porque é o que recomendamos, e ordem é
          recomendação: a primeira opção lida é a que a maioria escolhe. Ter o
          padrão no topo empurrava justamente para o caminho que não queremos —
          e o endereço da Omnimob não precisa de destaque, já é o que vale sem
          clique nenhum. */}
      {!estado?.dominio ? (
        <div className="dv-opcoes">
          <button
            type="button"
            className={`dv-opcao${escolha === "proprio" ? " is-ativa" : ""}${bloqueadoNoPlano ? " is-bloqueada" : ""}`}
            onClick={() => !bloqueadoNoPlano && setEscolha("proprio")}
          >
            <span className="dv-opcao__titulo">
              Usar o domínio da minha imobiliária
              <em className="dv-tag">recomendado</em>
            </span>
            <span className="dv-opcao__end">imobiliaria.com.br</span>
            <span className="dv-opcao__nota">
              {bloqueadoNoPlano
                ? "Disponível a partir do plano Profissional."
                : "A vitrine passa a viver no seu domínio, e as buscas do Google somam para ele."}
            </span>
          </button>

          <button
            type="button"
            className={`dv-opcao${escolha === "omnimob" ? " is-ativa" : ""}`}
            onClick={() => { setEscolha("omnimob"); aoConcluir?.("omnimob"); }}
          >
            <span className="dv-opcao__titulo">Usar o endereço da Omnimob</span>
            <span className="dv-opcao__end">{enderecoOmnimob}</span>
            <span className="dv-opcao__nota">Já incluso no seu plano. Funciona agora, sem configurar nada.</span>
          </button>
        </div>
      ) : null}

      {/* ── Formulário ─────────────────────────────────────────────────────── */}
      {escolha === "proprio" && !estado?.dominio && !bloqueadoNoPlano ? (
        <form className="dv-form" onSubmit={salvar}>
          <label className="dv-rotulo" htmlFor="dv-campo">Qual é o domínio?</label>
          <div className="dv-linha">
            <input
              id="dv-campo"
              className="dv-campo"
              value={dominio}
              onChange={(e) => setDominio(e.target.value)}
              placeholder="imobiliaria.com.br"
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" className="dv-btn dv-btn--principal" disabled={enviando || !dominio.trim()}>
              {enviando ? "Cadastrando…" : "Continuar"}
            </button>
          </div>
          <p className="dv-ajuda">
            Pode colar com <code>https://</code> e barra no fim — a gente limpa. Você precisa ter
            acesso ao painel onde o domínio foi registrado.
          </p>
        </form>
      ) : null}

      {/* ── Em configuração ────────────────────────────────────────────────── */}
      {pendente && estado?.registros?.length ? (
        <div className="dv-painel">
          <div className="dv-status dv-status--pendente">
            <span className="dv-pulso" aria-hidden="true" />
            Aguardando o DNS de <strong>{estado.dominio}</strong>
          </div>

          {/* Cadastrar não prova posse — quem prova é o DNS. Se o domínio já
              aponta para algum lugar, a pessoa precisa saber ANTES de mexer no
              registrador, porque a troca derruba o que estiver no ar lá. */}
          {estado.aviso ? <p className="dv-aviso">{estado.aviso}</p> : null}

          <p className="dv-texto">
            Entre no painel onde você registrou o domínio (Registro.br, GoDaddy, Hostinger…) e
            crie {estado.registros.length === 1 ? "este registro" : "estes registros"}:
          </p>

          <div className="dv-tabela" role="table">
            <div className="dv-tr dv-tr--cab" role="row">
              <span role="columnheader">Tipo</span>
              <span role="columnheader">Nome</span>
              <span role="columnheader">Valor</span>
              <span />
            </div>
            {estado.registros.map((r, i) => (
              <div className="dv-tr" role="row" key={`${r.tipo}-${r.nome}-${i}`}>
                <span role="cell"><code>{r.tipo}</code></span>
                <span role="cell"><code>{r.nome}</code></span>
                <span role="cell" className="dv-valor"><code>{r.valor}</code></span>
                <button type="button" className="dv-copiar" onClick={() => copiar(r.valor, `r${i}`)}>
                  {copiado === `r${i}` ? "copiado" : "copiar"}
                </button>
              </div>
            ))}
          </div>

          <p className="dv-ajuda">
            Depois de salvar lá, a propagação leva de alguns minutos a algumas horas. Não precisa
            ficar nesta tela — o endereço passa a funcionar sozinho, e o certificado de segurança
            é emitido automaticamente.
          </p>

          <div className="dv-acoes">
            <button type="button" className="dv-btn dv-btn--principal" onClick={verificar} disabled={enviando}>
              {enviando ? "Verificando…" : "Já configurei, verificar"}
            </button>
            <button type="button" className="dv-btn" onClick={remover} disabled={enviando}>
              Cancelar e usar o endereço da Omnimob
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Pronto ─────────────────────────────────────────────────────────── */}
      {ativo ? (
        <div className="dv-painel">
          <div className="dv-status dv-status--ativo">
            ✓ A vitrine está no ar em <strong>{estado.dominio}</strong>
          </div>
          <p className="dv-ajuda">
            O endereço <code>{enderecoOmnimob}</code> continua funcionando e leva para o mesmo lugar.
          </p>
          <div className="dv-acoes">
            <a className="dv-btn" href={`https://${estado.dominio}`} target="_blank" rel="noreferrer">
              Abrir a vitrine
            </a>
            <button type="button" className="dv-btn" onClick={remover} disabled={enviando}>
              Voltar para o endereço da Omnimob
            </button>
          </div>
        </div>
      ) : null}

      {semIntegracao ? (
        <p className="dv-erro">
          O cadastro de domínio próprio ainda não está habilitado nesta instalação.
        </p>
      ) : null}

      {erro ? <p className="dv-erro">{erro}</p> : null}
    </div>
  );
}

const CSS = `
.dv { display: flex; flex-direction: column; gap: 14px; text-align: left; }
.dv-carregando { color: rgba(255,255,255,0.5); font-size: 13px; padding: 8px 0; }

.dv-opcoes { display: grid; gap: 10px; }
.dv--compacto .dv-opcoes { gap: 8px; }

/* Cartão de escolha: alvo grande, porque a decisão é do usuário e não deve
   depender de acertar um radio de 14px. */
.dv-opcao {
  display: flex; flex-direction: column; gap: 4px;
  padding: 14px 16px; text-align: left; cursor: pointer;
  background: rgba(255,255,255,0.04); color: inherit;
  border: 1px solid rgba(255,255,255,0.12); border-radius: 14px;
  transition: border-color .18s ease, background .18s ease;
}
.dv-opcao:hover { border-color: rgba(255,255,255,0.28); background: rgba(255,255,255,0.06); }
.dv-opcao.is-ativa { border-color: #d4af37; background: rgba(212,175,55,0.10); }
.dv-opcao.is-bloqueada { opacity: .55; cursor: not-allowed; }
.dv-opcao__titulo { font-weight: 700; font-size: 14px; display: flex; align-items: center; gap: 8px; }
.dv-opcao__end { font-family: ui-monospace, monospace; font-size: 12px; color: #d4af37; }
.dv-opcao__nota { font-size: 12px; color: rgba(255,255,255,0.6); line-height: 1.45; }
.dv-tag {
  font-style: normal; font-size: 10px; letter-spacing: .08em; text-transform: uppercase;
  padding: 2px 7px; border-radius: 999px; background: rgba(212,175,55,0.18); color: #e8c96a;
}

.dv-form { display: flex; flex-direction: column; gap: 8px; }
.dv-rotulo { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.72); }
.dv-linha { display: flex; gap: 8px; flex-wrap: wrap; }
.dv-campo {
  flex: 1 1 220px; min-width: 0;
  padding: 11px 14px; border-radius: 10px; font-size: 14px;
  border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.05);
  color: inherit; outline: none;
}
.dv-campo:focus { border-color: #d4af37; }

.dv-btn {
  padding: 11px 16px; border-radius: 10px; font-size: 13px; font-weight: 600;
  border: 1px solid rgba(255,255,255,0.16); background: rgba(255,255,255,0.05);
  color: inherit; cursor: pointer; text-decoration: none; display: inline-block;
}
.dv-btn:hover { background: rgba(255,255,255,0.09); }
.dv-btn:disabled { opacity: .5; cursor: default; }
.dv-btn--principal { background: #d4af37; border-color: #d4af37; color: #10100f; }
.dv-btn--principal:hover { background: #e0bd4d; }

.dv-painel {
  display: flex; flex-direction: column; gap: 12px;
  padding: 16px; border-radius: 14px;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.10);
}
.dv-status { display: flex; align-items: center; gap: 9px; font-size: 14px; font-weight: 600; }
.dv-status--ativo { color: #4ade80; }
.dv-status--pendente { color: #e8c96a; }
.dv-pulso {
  width: 8px; height: 8px; border-radius: 50%; background: currentColor;
  animation: dv-pulso 1.4s ease-in-out infinite;
}
@keyframes dv-pulso { 0%,100% { opacity: 1; } 50% { opacity: .25; } }

.dv-texto { margin: 0; font-size: 13px; line-height: 1.5; color: rgba(255,255,255,0.78); }
.dv-ajuda { margin: 0; font-size: 12px; line-height: 1.5; color: rgba(255,255,255,0.55); }
.dv-ajuda code, .dv-texto code { font-size: 11.5px; }
.dv-erro { margin: 0; font-size: 12.5px; line-height: 1.5; color: #fca5a5; }
/* Aviso, não erro: o cadastro deu certo — o que está em jogo é o site que já
   existe no endereço, e a pessoa precisa decidir de olhos abertos. */
.dv-aviso {
  margin: 0; padding: 10px 12px; border-radius: 10px;
  font-size: 12.5px; line-height: 1.5; color: #e8c96a;
  background: rgba(212,175,55,0.10); border: 1px solid rgba(212,175,55,0.28);
}

/* Tabela de registros. Rola no eixo X em vez de quebrar o valor do CNAME:
   valor de DNS partido em duas linhas é copiado errado. */
.dv-tabela { display: flex; flex-direction: column; gap: 1px; overflow-x: auto; }
.dv-tr {
  display: grid; grid-template-columns: 62px 96px minmax(180px, 1fr) 68px;
  gap: 10px; align-items: center; padding: 9px 10px;
  background: rgba(0,0,0,0.22); border-radius: 8px; font-size: 12px;
}
.dv-tr--cab {
  background: none; padding-bottom: 2px;
  font-size: 10px; letter-spacing: .08em; text-transform: uppercase;
  color: rgba(255,255,255,0.42);
}
.dv-valor { overflow-x: auto; white-space: nowrap; }
.dv-copiar {
  padding: 5px 8px; border-radius: 7px; font-size: 11px;
  border: 1px solid rgba(255,255,255,0.16); background: transparent;
  color: rgba(255,255,255,0.75); cursor: pointer;
}
.dv-copiar:hover { background: rgba(255,255,255,0.08); }

.dv-acoes { display: flex; gap: 8px; flex-wrap: wrap; }

@media (max-width: 560px) {
  .dv-tr { grid-template-columns: 52px 84px minmax(140px, 1fr) 60px; font-size: 11px; }
}
`;

export default DominioVitrine;
