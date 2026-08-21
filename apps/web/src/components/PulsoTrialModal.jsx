import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../api";
import { getTrialStatusCompartilhado, avisarMudancaDeTrial } from "../utils/trialStatus";
import {
  devePerguntar,
  marcarPerguntado,
  definirTenantDoPulso,
  pedirTelaDeAssinatura,
  consumirPendencia,
  lerMemoria,
} from "../utils/pulsoTrial";
import { IconeCheck } from "./Icones.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   "Como está sendo?" — a pergunta que aparece sozinha durante o teste.

   Ela nasce de trabalho FEITO (cadastrou um imóvel, salvou um cliente, mexeu na
   vitrine) e não de um cronômetro — mas só aparece quando a pessoa SAI da
   página onde aquilo aconteceu. Quem decide se hoje é dia é o
   `utils/pulsoTrial.js`; aqui é só a conversa.

   DUAS SAÍDAS, E AS DUAS SERVEM À PESSOA. "Quero assinar" abre o fluxo de
   planos que já existe na barra lateral — este modal não aprende a cobrar.
   "Ficar mais tempo" dá sete dias de verdade, na hora, sem falar com ninguém.
   É a diferença entre uma pesquisa e um anúncio: se as duas respostas levassem
   à mesma tela de venda, a pergunta seria decorativa e a segunda vez que ela
   aparecesse já seria fechada sem leitura.

   E ela ACEITA "não". "Depois eu vejo" fecha, é gravado como resposta e
   compra três dias de silêncio — em qualquer aparelho, porque a marca fica no
   servidor. O teto de três aparições na vida da imobiliária está no pulso.

   A pergunta chega ATRASADA de propósito, e o atraso não é o principal: ela
   espera a TROCA DE PÁGINA. Abrir no mesmo quadro do "salvo com sucesso" rouba
   o clique de quem já ia seguir para a próxima coisa, e o modal leva um Enter
   que era para o formulário — mas o erro maior era outro. Salvar não é
   terminar: quem cadastra um imóvel salva e continua subindo foto e ajustando
   preço, e a pergunta caía no meio disso. Sair da tela é o único sinal
   confiável de que a tarefa acabou.
   ──────────────────────────────────────────────────────────────────────────── */

/* Respiro padrão entre o gatilho e a pergunta. Hoje nada usa o valor curto —
   ele fica como piso do `avaliarEAbrir` para quem chamar sem dizer a espera. */
const ESPERA_MS = 1600;

/* O respiro de verdade. A pessoa acabou de trocar de tela e a de destino ainda
   está carregando os dados dela; subir um modal por cima disso trocaria uma
   interrupção por outra. */
const ESPERA_SAIDA_MS = 2400;

/* Duração da saída — precisa bater com a animação `ptSaida` no CSS. */
const SAIDA_MS = 200;

const O_QUE_FEZ = {
  imovel: "Você acabou de mexer nos seus imóveis.",
  cliente: "Você acabou de mexer na sua carteira de clientes.",
  usuario: "Você acabou de organizar a sua equipe.",
  cargo: "Você acabou de ajustar as permissões da equipe.",
  vitrine: "Você acabou de editar a sua vitrine.",
};

/* O editor de vitrine é território proibido para esta pergunta.

   Lá dentro o trabalho é contínuo — arrastar, soltar, redimensionar — e o
   auto-save salva a cada segundo. Qualquer modal que suba no meio disso cai em
   cima de um bloco sendo posicionado. A pergunta sobre a vitrine existe, mas
   ela espera a pessoa SAIR: aí a edição terminou e há o que comentar. */
const ROTA_DO_EDITOR = /\/vitrine\/[^/]+\/editar/;

const SENTIMENTOS = [
  {
    chave: "AMANDO",
    rotulo: "Estou amando",
    detalhe: "Já virou parte da rotina",
    cor: "#34d399",
  },
  {
    chave: "NEUTRO",
    rotulo: "Vai indo",
    detalhe: "Ainda estou pegando o jeito",
    cor: "#818cf8",
  },
  {
    chave: "DIFICIL",
    rotulo: "Estou travando",
    detalhe: "Tem coisa que não consegui fazer",
    cor: "#f59e0b",
  },
];

/* Rostos desenhados à mão, não emoji: emoji depende da fonte do sistema e sai
   laranja-berrante no Windows, fora da paleta do produto — o mesmo motivo que
   fez o confete do [BoasVindasModal] virar SVG. Aqui ainda há um ganho: a cor
   acompanha a resposta, e o rosto escolhido acende. */
function Rosto({ tipo, cor, tam = 30 }) {
  const comum = {
    width: tam, height: tam, viewBox: "0 0 24 24", fill: "none",
    stroke: cor, strokeWidth: 1.7, strokeLinecap: "round", "aria-hidden": "true",
  };
  const olhos = (
    <>
      <circle cx="8.6" cy="9.8" r="1.1" fill={cor} stroke="none" />
      <circle cx="15.4" cy="9.8" r="1.1" fill={cor} stroke="none" />
    </>
  );
  if (tipo === "AMANDO") {
    return (
      <svg {...comum}>
        <circle cx="12" cy="12" r="9.2" />
        {olhos}
        <path d="M7.6 14.4c1.1 1.7 2.6 2.5 4.4 2.5s3.3-.8 4.4-2.5" />
      </svg>
    );
  }
  if (tipo === "NEUTRO") {
    return (
      <svg {...comum}>
        <circle cx="12" cy="12" r="9.2" />
        {olhos}
        <path d="M8.2 15.2h7.6" />
      </svg>
    );
  }
  return (
    <svg {...comum}>
      <circle cx="12" cy="12" r="9.2" />
      {olhos}
      <path d="M8 16.4c1-1.3 2.3-2 4-2s3 .7 4 2" />
    </svg>
  );
}

function plural(n, singular, pluralForma) {
  return `${n} ${n === 1 ? singular : pluralForma}`;
}

function dataCurta(valor) {
  if (!valor) return "";
  return new Date(valor).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
}

export function PulsoTrialModal({ tenantSlug, tenantId, pronto = true }) {
  const [aberto, setAberto] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [passo, setPasso] = useState(1);
  const [sentimento, setSentimento] = useState(null);
  const [comentario, setComentario] = useState("");
  const [origem, setOrigem] = useState("");
  const [situacao, setSituacao] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState("");
  const [resultado, setResultado] = useState(null); // { estendido, expiraEm, diasGanhos }

  const caixaRef = useRef(null);
  const timerRef = useRef(null);
  /* O que já foi enviado nesta abertura. Sem isto, fechar depois de responder
     mandaria um segundo registro "FECHOU" por cima da resposta de verdade. */
  const respondidoRef = useRef(false);
  /* Espelho do que o efeito de escuta precisa ler. Ele é montado uma vez só (a
     inscrição no pulso não pode ser refeita a cada tecla digitada) e leria
     valores congelados do primeiro render sem isto. */
  const estadoRef = useRef({ aberto: false, pronto: true, tenantSlug: null, noEditor: false });

  const { pathname } = useLocation();
  const noEditor = ROTA_DO_EDITOR.test(pathname);
  estadoRef.current = { aberto, pronto, tenantSlug, noEditor };

  useEffect(() => {
    definirTenantDoPulso(tenantId || null);
  }, [tenantId]);

  /* Caminho único de decisão: consulta a situação, passa pelas regras do pulso
     e, se valer, abre depois do respiro. Os dois gatilhos (a ação concluída e a
     saída do editor) entram por aqui — as regras de cadência têm que ser as
     mesmas nos dois, senão um deles vira porta dos fundos.

     `useCallback` sem dependências e lendo `estadoRef`: a inscrição no pulso é
     feita uma vez só e não pode ser refeita a cada tecla digitada. */
  const avaliarEAbrir = useCallback((qualOrigem, espera = ESPERA_MS) => {
    const atual = estadoRef.current;
    if (!atual.tenantSlug || atual.aberto || !atual.pronto || atual.noEditor) return;
    // Já tem uma pergunta a caminho: a segunda ação não marca outro encontro.
    if (timerRef.current) return;

    getTrialStatusCompartilhado(atual.tenantSlug)
      .then((dados) => {
        if (!dados) return;
        const veredito = devePerguntar({
          emTrial: dados.emTrial,
          diasRestantes: dados.diasRestantes,
          criadoEm: dados.criadoEm,
          pesquisa: dados.pesquisa || {},
        });
        if (!veredito.vale) return;

        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          /* A tela pode ter mudado no meio da espera — o tour subiu, outro
             modal abriu, a pessoa voltou para o editor. Vale conferir de novo
             antes de aparecer. */
          const agora = estadoRef.current;
          if (agora.aberto || !agora.pronto || agora.noEditor) return;
          /* Marcado ao APARECER, não ao responder: quem fecha a aba com o
             modal na tela já teve o seu encontro, e o próximo salvamento não
             deve trazê-lo de volta. Fica dentro do temporizador porque uma
             pergunta que desistiu de aparecer não gastou a vez de ninguém. */
          marcarPerguntado();
          setSituacao(dados);
          setOrigem(qualOrigem);
          setSentimento(null);
          setComentario("");
          setResultado(null);
          setFalha("");
          setPasso(1);
          respondidoRef.current = false;
          setAberto(true);
        }, espera);
      })
      .catch(() => { /* sem situação de teste, sem pergunta */ });
  }, []);

  /* ── Gatilho único: a SAÍDA da página onde houve trabalho ─────────────────

     Havia dois, e o primeiro era o problema. Ele ouvia cada ação concluída e
     abria a pergunta 1,6s depois de um "salvo com sucesso" — no papel, o
     instante perfeito; na prática, o meio do trabalho. Salvar quase nunca é
     terminar: quem cadastra um imóvel salva e continua subindo foto, marcando
     360°, corrigindo o preço. A pergunta caía em cima disso.

     Sobrou o segundo, generalizado. Nenhuma ação abre nada na hora — ela deixa
     uma pendência (ver `pulsoTrial.js`), e é a troca de rota que a cobra. Sair
     é o único sinal confiável de que a tarefa acabou.

     A comparação de caminho é feita lá dentro, não aqui: recarregar a própria
     tela de cadastro não é sair dela, e sem essa conferência um F5 no meio do
     trabalho cobraria a pendência de quem não foi a lugar nenhum.

     O respiro é o maior dos dois que existiam: a pessoa acabou de navegar, e a
     tela de destino ainda está montando os dados dela. */
  useEffect(() => {
    const pendente = consumirPendencia(pathname);
    if (pendente) avaliarEAbrir(pendente, ESPERA_SAIDA_MS);
  }, [pathname, avaliarEAbrir]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  /* ── Bancada de conferência (só em dev) ──────────────────────────────────
     A pergunta é, por desenho, difícil de ver na hora: ela exige teste em
     andamento, um punhado de ações, dias de descanso e ainda passa por um
     sorteio. Ótimo para quem usa, péssimo para quem precisa OLHAR a tela.

     No console do navegador:
       pulsoTrial.abrir()     abre agora, pulando tudo
       pulsoTrial.porque()    diz o que está barrando (é o campo `motivo`)

     Fora do `npm run dev` nada disso existe. */
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;

    const situacaoDeVitrine = () => ({
      emTrial: true,
      diasRestantes: 6,
      criadoEm: new Date(Date.now() - 8 * 86400000).toISOString(),
      expiraEm: new Date(Date.now() + 6 * 86400000).toISOString(),
      pesquisa: { podeEstender: true, diasExtensao: 7, respostas: 0 },
    });

    window.pulsoTrial = {
      async abrir(qualOrigem = "imovel") {
        // A situação real quando dá; a de vitrine quando não há teste algum —
        // conferir o desenho do modal não deveria exigir um tenant em trial.
        const dados = tenantSlug
          ? await getTrialStatusCompartilhado(tenantSlug).catch(() => null)
          : null;
        setSituacao(dados?.emTrial ? dados : situacaoDeVitrine());
        setOrigem(qualOrigem);
        setSentimento(null);
        setComentario("");
        setResultado(null);
        setFalha("");
        setPasso(1);
        respondidoRef.current = false;
        setAberto(true);
        return "aberto";
      },
      async porque() {
        const dados = tenantSlug
          ? await getTrialStatusCompartilhado(tenantSlug).catch(() => null)
          : null;
        return {
          tenantSlug: tenantSlug || "(sem slug na sessão)",
          pronto,
          emTrial: dados?.emTrial ?? "(não consegui ler /me/trial)",
          diasRestantes: dados?.diasRestantes ?? null,
          memoria: lerMemoria(),
          veredito: devePerguntar({
            emTrial: dados?.emTrial,
            diasRestantes: dados?.diasRestantes,
            criadoEm: dados?.criadoEm,
            pesquisa: dados?.pesquisa || {},
          }),
        };
      },
    };
    return () => { delete window.pulsoTrial; };
  }, [tenantSlug, pronto]);

  // Foco na caixa ao abrir: quem navega por teclado precisa cair dentro dela.
  useEffect(() => {
    if (aberto) caixaRef.current?.focus();
  }, [aberto]);

  const fechar = useCallback((escolha) => {
    /* Fechar sem responder também é resposta, e é ela que segura a cadência
       entre aparelhos. Vai sem `await` e sem tratar erro: a tela já está indo
       embora, e o pior caso é a pergunta voltar um pouco antes do previsto. */
    if (!respondidoRef.current && tenantSlug) {
      respondidoRef.current = true;
      api.responderPesquisaTrial(tenantSlug, {
        sentimento,
        escolha: escolha || "FECHOU",
        comentario,
        origem,
      }).catch(() => {});
    }
    setSaindo(true);
    setTimeout(() => {
      setSaindo(false);
      setAberto(false);
    }, SAIDA_MS);
  }, [tenantSlug, sentimento, comentario, origem]);

  useEffect(() => {
    if (!aberto) return undefined;
    function aoTeclar(e) {
      if (e.key === "Escape" && !enviando) fechar();
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto, enviando, fechar]);

  async function responder(escolha) {
    setEnviando(true);
    setFalha("");
    try {
      const r = await api.responderPesquisaTrial(tenantSlug, {
        sentimento,
        escolha,
        comentario,
        origem,
      });
      respondidoRef.current = true;

      if (escolha === "ASSINAR") {
        fechar("ASSINAR");
        /* Depois da saída, para as duas caixas não se cruzarem no meio da
           animação. O passo 2 é o de escolher plano: o "por que assinar" a
           pessoa acabou de responder aqui. */
        setTimeout(() => pedirTelaDeAssinatura(2), SAIDA_MS + 60);
        return;
      }

      if (escolha === "ESTENDER") {
        // O selo da barra lateral está anunciando o prazo antigo neste exato
        // momento; sem o aviso ele só se corrigiria num recarregamento.
        avisarMudancaDeTrial(tenantSlug);
      }

      setResultado(r);
      setPasso(3);
    } catch (erro) {
      setFalha(erro.message || "Não consegui registrar sua resposta. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  if (!aberto) return null;

  const dias = situacao?.diasRestantes;
  const podeEstender = Boolean(situacao?.pesquisa?.podeEstender);
  const diasExtras = situacao?.pesquisa?.diasExtensao || 7;
  const dificuldade = sentimento === "DIFICIL";

  /* Quanto do teste já passou. Sai das duas pontas que o servidor manda, então
     continua correto para quem já ganhou o prazo extra — o denominador cresce
     junto. */
  const inicio = situacao?.criadoEm ? new Date(situacao.criadoEm).getTime() : null;
  const fim = situacao?.expiraEm ? new Date(situacao.expiraEm).getTime() : null;
  const progresso = inicio && fim && fim > inicio
    ? Math.min(100, Math.max(3, ((Date.now() - inicio) / (fim - inicio)) * 100))
    : null;

  const escolhido = SENTIMENTOS.find((s) => s.chave === sentimento);

  const TITULO_PASSO2 = {
    AMANDO: "Que bom ouvir isso",
    NEUTRO: "Então vamos com calma",
    DIFICIL: "Conta o que travou",
  };

  const TEXTO_PASSO2 = {
    AMANDO: "Enquanto for teste, este ambiente tem prazo. Assinando, nada muda de lugar — "
      + "os mesmos imóveis, a mesma vitrine, a mesma equipe, só sem data para acabar.",
    NEUTRO: "Teste sem tempo de usar não decide nada. Dá para assinar agora ou levar mais "
      + "alguns dias para experimentar com calma — as duas portas estão abertas.",
    DIFICIL: "Escreva aqui o que não saiu como você esperava. Isso chega direto em quem "
      + "constrói o sistema, e é assim que a próxima versão fica melhor.",
  };

  return (
    <>
      <style>{CSS}</style>

      <div
        className={`pt-veu${saindo ? " is-saindo" : ""}`}
        onMouseDown={(e) => e.target === e.currentTarget && !enviando && fechar()}
      >
        <div
          className={`pt-caixa${saindo ? " is-saindo" : ""}`}
          ref={caixaRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pt-titulo"
        >
          <button type="button" className="pt-fechar" onClick={() => fechar()} aria-label="Fechar" disabled={enviando}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
              <line x1="5.5" y1="5.5" x2="18.5" y2="18.5" />
              <line x1="18.5" y1="5.5" x2="5.5" y2="18.5" />
            </svg>
          </button>

          {/* Régua do teste. Fica em todos os passos: é o contexto da conversa
              inteira, e some só na confirmação, onde o número já mudou. */}
          {passo !== 3 && progresso != null ? (
            <div className="pt-regua" aria-hidden="true">
              <div className="pt-regua__trilho">
                <span className="pt-regua__cheio" style={{ width: `${progresso}%` }} />
              </div>
              <span className="pt-regua__texto">
                {dias == null
                  ? "Período de teste"
                  : dias > 0
                    ? `${plural(dias, "dia", "dias")} de teste pela frente`
                    : "Último dia de teste"}
              </span>
            </div>
          ) : null}

          {passo === 1 ? (
            <>
              <span className="pt-eyebrow">● UMA PERGUNTA RÁPIDA</span>
              {/* Quem vem do editor recebe a pergunta no assunto em que estava:
                  falar "Omnimob" logo depois de uma hora montando a vitrine soa
                  como se ninguém tivesse visto o que a pessoa acabou de fazer. */}
              <h2 id="pt-titulo" className="pt-titulo">
                {origem === "vitrine"
                  ? "Como está sendo montar a sua vitrine?"
                  : "Como está sendo usar a Omnimob?"}
              </h2>
              <p className="pt-texto">
                {O_QUE_FEZ[origem] || "Você está usando o sistema agora."}{" "}
                Antes de seguir, queremos ouvir de você — leva dez segundos e não pergunta de novo tão cedo.
              </p>

              <div className="pt-opcoes">
                {SENTIMENTOS.map((s) => (
                  <button
                    key={s.chave}
                    type="button"
                    className="pt-opcao"
                    style={{ "--pt-cor": s.cor }}
                    onClick={() => { setSentimento(s.chave); setPasso(2); }}
                  >
                    <span className="pt-opcao__rosto"><Rosto tipo={s.chave} cor={s.cor} /></span>
                    <span className="pt-opcao__rotulo">{s.rotulo}</span>
                    <span className="pt-opcao__detalhe">{s.detalhe}</span>
                  </button>
                ))}
              </div>

              <div className="pt-rodape">
                <button type="button" className="pt-link" onClick={() => fechar("DEPOIS")}>
                  Agora não
                </button>
              </div>
            </>
          ) : null}

          {passo === 2 ? (
            <>
              <span className="pt-eyebrow" style={{ color: escolhido?.cor }}>
                ● {escolhido?.rotulo?.toUpperCase()}
              </span>
              <h2 id="pt-titulo" className="pt-titulo">{TITULO_PASSO2[sentimento]}</h2>
              <p className="pt-texto">{TEXTO_PASSO2[sentimento]}</p>

              <label className="pt-campo">
                <span className="pt-campo__rotulo">
                  {dificuldade ? "O que travou?" : "Quer contar mais? (opcional)"}
                </span>
                <textarea
                  className="pt-campo__area"
                  rows={dificuldade ? 4 : 2}
                  maxLength={2000}
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  placeholder={
                    dificuldade
                      ? "Ex.: não achei onde colocar as fotos do imóvel…"
                      : "O que mais te ajudou até aqui?"
                  }
                />
              </label>

              {falha ? <p className="pt-falha">{falha}</p> : null}

              <div className="pt-acoes">
                {/* A ordem muda com a resposta, e não é detalhe: para quem está
                    travado, empurrar "assine" na frente é cobrar por um produto
                    que ainda não entregou o que prometeu. Ali o destaque é o
                    prazo — tempo para resolver o problema com a gente. */}
                {dificuldade ? (
                  <>
                    {podeEstender ? (
                      <button
                        type="button"
                        className="pt-btn pt-btn--primario"
                        disabled={enviando}
                        onClick={() => responder("ESTENDER")}
                      >
                        {enviando ? "Um instante…" : `Enviar e ganhar +${diasExtras} dias`}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="pt-btn pt-btn--primario"
                        disabled={enviando}
                        onClick={() => responder("DEPOIS")}
                      >
                        {enviando ? "Um instante…" : "Enviar para o time"}
                      </button>
                    )}
                    <button type="button" className="pt-btn" disabled={enviando} onClick={() => responder("DEPOIS")}>
                      Só registrar
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="pt-btn pt-btn--primario"
                      disabled={enviando}
                      onClick={() => responder("ASSINAR")}
                    >
                      {enviando ? "Um instante…" : "Quero assinar"}
                    </button>
                    {podeEstender ? (
                      <button
                        type="button"
                        className="pt-btn"
                        disabled={enviando}
                        onClick={() => responder("ESTENDER")}
                      >
                        {`Ficar no teste +${diasExtras} dias`}
                      </button>
                    ) : (
                      <button type="button" className="pt-btn" disabled={enviando} onClick={() => responder("DEPOIS")}>
                        Continuar no teste
                      </button>
                    )}
                  </>
                )}
              </div>

              <div className="pt-rodape">
                <button type="button" className="pt-link" disabled={enviando} onClick={() => setPasso(1)}>
                  Voltar
                </button>
                <button type="button" className="pt-link" disabled={enviando} onClick={() => fechar("DEPOIS")}>
                  Depois eu vejo
                </button>
              </div>
            </>
          ) : null}

          {passo === 3 ? (
            <div className="pt-fim">
              <span className="pt-fim__selo" aria-hidden="true"><IconeCheck size={24} /></span>
              <h2 id="pt-titulo" className="pt-titulo">
                {resultado?.estendido
                  ? `Pronto — mais ${plural(resultado.diasGanhos || diasExtras, "dia", "dias")} de teste`
                  : "Anotado. Obrigado de verdade"}
              </h2>
              <p className="pt-texto">
                {resultado?.estendido ? (
                  <>
                    Seu teste agora vai até <strong>{dataCurta(resultado.expiraEm)}</strong>. Nada mudou de
                    lugar: os mesmos imóveis, a mesma vitrine, a mesma equipe.
                    {comentario.trim() ? " E o que você escreveu já está com o nosso time." : ""}
                  </>
                ) : comentario.trim() ? (
                  <>
                    O que você escreveu chegou ao time.
                    {dificuldade ? " Se fizer sentido, alguém entra em contato pelo e-mail da conta." : ""}
                  </>
                ) : (
                  "Sua resposta foi registrada. Seguimos por aqui quando você precisar."
                )}
              </p>

              {/* Segunda chance de assinar, sem insistência: quem pediu prazo
                  acabou de dizer que não é agora, então isto é um link, não um
                  botão competindo com o "voltar ao trabalho". */}
              <div className="pt-acoes pt-acoes--centro">
                <button type="button" className="pt-btn pt-btn--primario" onClick={() => fechar()}>
                  Voltar ao trabalho
                </button>
              </div>
              <div className="pt-rodape pt-rodape--centro">
                <button
                  type="button"
                  className="pt-link"
                  onClick={() => { fechar(); setTimeout(() => pedirTelaDeAssinatura(2), SAIDA_MS + 60); }}
                >
                  Ver os planos mesmo assim
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

const CSS = `
.pt-veu {
  position: fixed; inset: 0; z-index: 9997; display: grid; place-items: center; padding: 24px;
  background: rgba(5,5,7,0.72);
  backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px);
  animation: ptVeu 0.26s ease both;
}
.pt-veu.is-saindo { animation: ptVeuSai 0.2s ease both; }
@keyframes ptVeu { from { opacity: 0; } to { opacity: 1; } }
@keyframes ptVeuSai { from { opacity: 1; } to { opacity: 0; } }

.pt-caixa {
  position: relative; width: min(500px, 100%); max-height: calc(100vh - 48px); overflow-y: auto;
  background: linear-gradient(180deg, #171b25 0%, #12151d 100%);
  border: 1px solid var(--linha-10, rgba(255,255,255,0.10)); border-radius: 20px;
  padding: 26px 26px 20px;
  box-shadow: 0 32px 80px -28px rgba(0,0,0,0.92), 0 0 0 1px rgba(129,140,248,0.07);
  font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;
  animation: ptEntrada 0.42s cubic-bezier(0.22, 1, 0.36, 1) both;
  outline: none;
}
.pt-caixa.is-saindo { animation: ptSaida 0.2s ease both; }
@keyframes ptEntrada {
  from { opacity: 0; transform: translateY(18px) scale(0.96); }
  to { opacity: 1; transform: none; }
}
@keyframes ptSaida {
  from { opacity: 1; transform: none; }
  to { opacity: 0; transform: translateY(8px) scale(0.98); }
}

/* Brilho no topo da caixa, como o das telas da landing. Puramente decorativo e
   sem captar clique. */
.pt-caixa::before {
  content: ""; position: absolute; inset: 0 0 auto 0; height: 130px; pointer-events: none;
  border-radius: 20px 20px 0 0;
  background: radial-gradient(420px 120px at 50% -30%, rgba(129,140,248,0.20), transparent 72%);
}

.ds-shell .pt-fechar, .pt-fechar {
  position: absolute; top: 14px; right: 14px; z-index: 2;
  width: 28px; height: 28px; padding: 0; border-radius: 999px; cursor: pointer;
  display: grid; place-items: center;
  background: var(--sup-05, rgba(255,255,255,0.05)); border: 1px solid var(--linha-09, rgba(255,255,255,0.09));
  color: #94a3b8; box-shadow: none; transform: none;
  transition: background 0.16s ease, color 0.16s ease;
}
.pt-fechar:hover { background: var(--sup-10, rgba(255,255,255,0.10)); color: #f1f5f9; box-shadow: none; transform: none; }
.pt-fechar:active { scale: 1; }

/* Régua do teste */
.pt-regua { position: relative; display: grid; gap: 6px; margin-bottom: 18px; }
.pt-regua__trilho {
  height: 3px; border-radius: 999px; background: var(--sup-09, rgba(255,255,255,0.09)); overflow: hidden;
}
.pt-regua__cheio {
  display: block; height: 100%; border-radius: 999px;
  background: linear-gradient(90deg, #6366f1, #d4af37);
  transition: width 0.4s ease;
}
.pt-regua__texto {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 9px; letter-spacing: 0.13em; text-transform: uppercase; color: #64748b;
}

.pt-eyebrow {
  position: relative; display: block; margin-bottom: 9px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 9.5px; letter-spacing: 0.14em; text-transform: uppercase; color: #d4af37;
}
.pt-titulo {
  position: relative; margin: 0 0 10px; font-size: 21px; font-weight: 700; letter-spacing: -0.02em;
  color: #f1f5f9; line-height: 1.26;
}
.pt-texto { position: relative; margin: 0 0 16px; font-size: 13.5px; line-height: 1.68; color: #94a3b8; }
.pt-texto strong { color: #f1f5f9; font-weight: 600; }

/* Cartões de resposta */
.pt-opcoes { display: grid; gap: 8px; margin-bottom: 6px; }
@media (min-width: 520px) {
  .pt-opcoes { grid-template-columns: repeat(3, 1fr); }
}

.ds-shell .pt-opcao, .pt-opcao {
  position: relative; display: grid; gap: 3px; justify-items: center; text-align: center;
  width: 100%; padding: 16px 10px 14px; border-radius: 14px; cursor: pointer;
  background: var(--sup-03, rgba(255,255,255,0.03)); border: 1px solid var(--linha-09, rgba(255,255,255,0.09));
  font-family: inherit; box-shadow: none; transform: none;
  transition: border-color 0.18s ease, background 0.18s ease, transform 0.18s ease;
}
.pt-opcao:hover {
  background: var(--sup-06, rgba(255,255,255,0.06));
  border-color: color-mix(in srgb, var(--pt-cor) 55%, transparent);
  transform: translateY(-2px); box-shadow: none;
}
.pt-opcao:active { scale: 1; transform: translateY(0); }
.pt-opcao__rosto {
  display: grid; place-items: center; width: 44px; height: 44px; margin-bottom: 4px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--pt-cor) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--pt-cor) 26%, transparent);
  transition: transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}
.pt-opcao:hover .pt-opcao__rosto { transform: scale(1.08); }
.pt-opcao__rotulo { font-size: 13.5px; font-weight: 700; color: #f1f5f9; }
.pt-opcao__detalhe { font-size: 11px; line-height: 1.45; color: #64748b; }

/* Campo aberto */
.pt-campo { display: grid; gap: 6px; margin-bottom: 16px; }
.pt-campo__rotulo {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 9px; letter-spacing: 0.13em; text-transform: uppercase; color: #64748b;
}
.ds-shell .pt-campo__area, .pt-campo__area {
  width: 100%; padding: 11px 13px; border-radius: 12px; resize: vertical;
  background: var(--sup-03, rgba(255,255,255,0.03)); border: 1px solid var(--linha-10, rgba(255,255,255,0.10));
  color: #e2e8f0; font-family: inherit; font-size: 13px; line-height: 1.6;
  transition: border-color 0.18s ease, background 0.18s ease;
}
.pt-campo__area::placeholder { color: #4b5563; }
.pt-campo__area:focus {
  outline: none; border-color: rgba(129,140,248,0.55); background: rgba(129,140,248,0.06);
}

.pt-falha {
  margin: 0 0 12px; padding: 10px 13px; border-radius: 10px;
  font-size: 12.5px; line-height: 1.6; color: #fca5a5;
  background: rgba(239,68,68,0.10); border: 1px solid rgba(239,68,68,0.28);
}

/* Ações */
.pt-acoes { position: relative; display: flex; flex-wrap: wrap; gap: 9px; justify-content: flex-end; }
.pt-acoes--centro { justify-content: center; }

.ds-shell .pt-btn, .pt-btn {
  width: auto; padding: 10px 18px; border-radius: 999px; cursor: pointer;
  font-family: inherit; font-size: 13px; font-weight: 600; text-decoration: none;
  display: inline-flex; align-items: center; justify-content: center;
  background: transparent; border: 1px solid var(--linha-14, rgba(255,255,255,0.14)); color: #cbd5e1;
  box-shadow: none; transform: none;
  transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
}
.pt-btn:hover { background: var(--sup-07, rgba(255,255,255,0.07)); color: #f1f5f9; box-shadow: none; transform: none; }
.pt-btn:active { scale: 1; }
.pt-btn--primario { background: #f1f5f9; border-color: #f1f5f9; color: #0c0f1a; }
.pt-btn--primario:hover { background: #ffffff; color: #0c0f1a; }
.pt-btn:disabled { opacity: 0.5; cursor: default; }

.pt-rodape {
  position: relative; display: flex; justify-content: space-between; align-items: center;
  gap: 12px; margin-top: 14px; padding-top: 12px;
  border-top: 1px solid var(--linha-06, rgba(255,255,255,0.06));
}
.pt-rodape--centro { justify-content: center; border-top: 0; padding-top: 6px; margin-top: 6px; }

.ds-shell .pt-link, .pt-link {
  padding: 4px 2px; border: 0; background: transparent; cursor: pointer;
  font-family: inherit; font-size: 12px; color: #64748b;
  box-shadow: none; transform: none;
  transition: color 0.16s ease;
}
.pt-link:hover { color: #cbd5e1; background: transparent; box-shadow: none; transform: none; }
.pt-link:active { scale: 1; }
.pt-link:disabled { opacity: 0.5; cursor: default; }

/* Confirmação */
.pt-fim { position: relative; display: grid; justify-items: center; text-align: center; }
.pt-fim .pt-titulo, .pt-fim .pt-texto { text-align: center; }
.pt-fim__selo {
  width: 54px; height: 54px; border-radius: 999px; display: grid; place-items: center;
  margin: 6px 0 14px; color: #34d399;
  background: rgba(16,185,129,0.14); border: 1px solid rgba(16,185,129,0.42);
  animation: ptSelo 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes ptSelo {
  from { opacity: 0; transform: scale(0.5); }
  60% { transform: scale(1.09); }
  to { opacity: 1; transform: scale(1); }
}

@media (max-width: 520px) {
  .pt-veu { padding: 14px; }
  .pt-caixa { padding: 22px 18px 16px; }
  .pt-acoes { flex-direction: column-reverse; }
  .pt-acoes .pt-btn { width: 100%; }
}

@media (prefers-reduced-motion: reduce) {
  .pt-veu, .pt-caixa, .pt-fim__selo { animation: none; }
  .pt-opcao:hover { transform: none; }
  .pt-opcao:hover .pt-opcao__rosto { transform: none; }
}
`;

export default PulsoTrialModal;
