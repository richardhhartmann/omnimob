import { useEffect, useState } from "react";
import { ArrowRight, Clock, Receipt, WarningCircle, X } from "@phosphor-icons/react";
import { getTrialStatusCompartilhado, ouvirMudancaDeTrial } from "../utils/trialStatus";
import { pedirTelaDeAssinatura } from "../utils/pulsoTrial";
import { loadSession } from "../session";

/* ────────────────────────────────────────────────────────────────────────────
   A faixa da situação da conta, logo abaixo do cabeçalho.

   ── POR QUE ELA SUBSTITUIU O SELO DA BARRA ──

   O mesmo recado morava num selo no rodapé da barra lateral — que fica no canto
   inferior esquerdo, some quando a barra está recolhida em 64px e disputa
   atenção com o menu do perfil. Uma conta que expira em três dias não é
   informação de rodapé.

   Duas superfícies para a mesma contagem seria pior que qualquer uma das duas:
   o número apareceria duas vezes na mesma tela e, no dia em que uma delas
   mudasse de regra, elas discordariam na frente do cliente.

   ── ELA NÃO É SÓ DE TESTE ──

   O selo antigo cobria TRÊS estados, e a faixa herdou os três — trocá-la por
   uma faixa só de trial apagaria os outros dois da interface:

     teste     o prazo está correndo;
     vencido   a conta caiu e há uma janela de graça antes da remoção;
     cobrança  existe um pagamento gerado esperando compensar.

   O terceiro é o único lugar do painel onde se reencontra o boleto gerado.

   ── ELA NÃO CONSTRÓI UM SEGUNDO CHECKOUT ──

   Clicar aqui emite `pedirTelaDeAssinatura`, e quem abre os três passos, o Pix
   e o Stripe continua sendo o `TrialAviso` — que segue montado, agora sem o
   selo. Um segundo fluxo de pagamento é a última coisa que este produto precisa
   ter em duas versões.

   ── QUEM NÃO PODE ASSINAR TAMBÉM VÊ ──

   Saber que o teste está correndo é informação de trabalho, e quem descobre
   agora tem a quem avisar. O `TrialAviso` já trata o caso no clique: em vez do
   checkout, ele mostra o recado de falar com o administrador.
   ──────────────────────────────────────────────────────────────────────────── */

/* ── FECHAR O AVISO, ATÉ O PRÓXIMO LOGIN ─────────────────────────────────────

   Quem está em teste vê a faixa em toda tela, o dia inteiro. Depois do terceiro
   dia ela já disse o que tinha para dizer, e continuar cobrando 41px de altura
   de quem já entendeu é insistência, não informação.

   ── POR QUE NÃO É PARA SEMPRE ──

   Uma dispensa definitiva apagaria da interface a única contagem de um prazo
   que termina em perder a conta. O aviso volta no login seguinte: a pessoa se
   livra dele hoje e reencontra a informação amanhã, quando o número já é outro.

   ── COMO A "SESSÃO" É IDENTIFICADA ──

   `sessionStorage` sozinho responderia por metade: ele morre com a aba, mas
   sobreviveria a um logout e login na MESMA aba — e é justamente aí que a
   pessoa esperaria o aviso de volta. Por isso a chave carrega a cauda do token:
   entrar de novo emite outro token, a chave deixa de casar, e a faixa reaparece
   sem que nada precise ser limpo.

   A cauda, e não o token inteiro: 16 caracteres bastam para distinguir dois
   logins e não é credencial que se copie para outro lugar.

   ── E POR QUE SÓ NO ESTADO DE TESTE ──

   Os outros dois são consequência, não aviso: "vencido" é a conta caída dentro
   da janela de graça, e "cobrança" é o único lugar do painel onde se reencontra
   o boleto gerado. Fechar esses dois esconderia o caminho para resolvê-los.
   ────────────────────────────────────────────────────────────────────────────── */
const CHAVE_FECHADA = "domus_faixa_conta_fechada";

function chaveDaSessao() {
  const token = loadSession()?.token;
  if (!token) return null;
  return token.slice(-16);
}

function lerFechada() {
  try {
    const chave = chaveDaSessao();
    return Boolean(chave) && sessionStorage.getItem(CHAVE_FECHADA) === chave;
  } catch {
    /* Sem armazenamento (aba privada, navegador travado): a faixa aparece. É o
       lado certo para errar — o prazo continua correndo de qualquer jeito. */
    return false;
  }
}

function gravarFechada() {
  try {
    const chave = chaveDaSessao();
    if (chave) sessionStorage.setItem(CHAVE_FECHADA, chave);
  } catch {
    /* Não deu para guardar: o X fecha a faixa nesta tela e ela volta na
       próxima. Pior que o combinado, melhor que um botão que não responde. */
  }
}

function diasAte(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.ceil(ms / 86400000));
}

/* O texto de cada estado. Fica numa função e não espalhado no JSX porque os
   três compartilham a mesma caixa — o que muda é só o que se diz. */
function recado(situacao) {
  const graca = situacao?.graca || null;
  const cobranca = situacao?.cobranca || null;

  if (cobranca?.situacao === "aberta") {
    return {
      tom: "aguardando",
      Icone: Receipt,
      titulo: `Há uma cobrança de R$ ${cobranca.valor} aguardando pagamento`,
      texto: "O plano é liberado assim que ela compensar. Toque para ver o código.",
      acao: "Ver cobrança",
      passo: 3,
    };
  }

  if (graca?.venceu) {
    const ate = graca.removidoEm ? new Date(graca.removidoEm).toLocaleDateString("pt-BR") : null;
    return {
      tom: "vencido",
      Icone: WarningCircle,
      titulo: "O seu plano venceu",
      /* A data é a mesma constante que a faxina usa para apagar; cravar um
         número aqui seria prometer trinta dias e remover em vinte. */
      texto: ate
        ? `Seus dados ficam guardados até ${ate}. Assine para recuperar o ambiente.`
        : "Assine para recuperar o ambiente.",
      acao: "Assinar agora",
      passo: 2,
    };
  }

  if (situacao?.emTrial) {
    const dias = situacao.expiraEm ? diasAte(situacao.expiraEm) : null;
    return {
      tom: dias !== null && dias <= 3 ? "vencido" : "teste",
      Icone: Clock,
      titulo: dias === null
        ? "Você está no período de teste"
        : dias === 0
          ? "Seu teste expira hoje"
          : `Seu teste expira em ${dias} ${dias === 1 ? "dia" : "dias"}`,
      texto: "Escolha o melhor plano para você e contrate agora mesmo",
      acao: "Quero contratar",
      /* Passo 1, e nao 2. Quem esta em TESTE ainda nao escolheu nada: cair
         direto na grade de planos pula a tela que diz onde a conta esta e o
         que muda ao assinar. O aviso de plano VENCIDO continua no 2 — ali a
         escolha ja foi feita uma vez, e a pergunta e so qual plano retomar. */
      passo: 1,
    };
  }

  return null;
}

export function FaixaDeConta({ tenantSlug }) {
  const [situacao, setSituacao] = useState(null);
  const [fechada, setFechada] = useState(lerFechada);

  useEffect(() => {
    if (!tenantSlug) return undefined;
    let vivo = true;
    const ler = () => {
      getTrialStatusCompartilhado(tenantSlug)
        .then((s) => { if (vivo) setSituacao(s); })
        .catch(() => { /* faixa some; o painel não para por causa dela */ });
    };
    ler();
    /* Assinar, pagar ou ganhar dias muda a situação sem recarregar a página —
       o mesmo aviso que o selo antigo escutava. */
    const parar = ouvirMudancaDeTrial(ler);
    return () => { vivo = false; parar?.(); };
  }, [tenantSlug]);

  const r = recado(situacao);
  if (!r) return null;
  /* Só o aviso de teste se fecha, e a marca é do estado e não da faixa: se um
     dia outro tom virar dispensável, é esta lista que cresce. */
  const podeFechar = r.tom === "teste";
  if (podeFechar && fechada) return null;

  const abrir = () => pedirTelaDeAssinatura(r.passo);

  const fechar = (e) => {
    /* A faixa INTEIRA é clicável, então o X tem de parar o evento: sem isto,
       fechar o aviso abriria o checkout no mesmo gesto. */
    e.stopPropagation();
    gravarFechada();
    setFechada(true);
  };

  return (
    <>
      <style>{CSS}</style>
      {/* A faixa inteira é clicável, e o botão dentro dela também: o alvo
          grande serve ao toque, e o botão diz o que o clique faz para quem lê
          antes de clicar. O botão não precisa de handler próprio — o clique
          sobe para a faixa. */}
      <div
        className={`fc-faixa fc-faixa--${r.tom}`}
        role="button"
        tabIndex={0}
        onClick={abrir}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrir(); } }}
      >
        <span className="fc-icone" aria-hidden="true"><r.Icone size={17} /></span>
        {/* Uma linha só. O que era subtítulo virou a continuação da frase,
            depois de um ponto médio — empilhar duas linhas numa faixa que fica
            entre o cabeçalho e o conteúdo rouba altura de trabalho em toda
            tela, o dia inteiro, para dizer o que cabe numa. */}
        <span className="fc-titulo">{r.titulo}</span>
        <span className="fc-sub">{r.texto}</span>
        <span className="fc-acao">
          {r.acao}
          <ArrowRight size={13} weight="bold" />
        </span>
        {/* O X é ABSOLUTO, e não o último item da linha: a linha é centralizada
            (justify-content: center), e um irmão de largura real puxaria o
            recado inteiro alguns pixels para a esquerda — o aviso ficaria fora
            do centro em toda tela por causa de um botão de canto. */}
        {podeFechar ? (
          <button
            type="button"
            className="fc-fechar"
            onClick={fechar}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.stopPropagation(); }}
            aria-label="Fechar este aviso até o próximo acesso"
            title="Fechar até o próximo acesso"
          >
            <X size={13} weight="bold" />
          </button>
        ) : null}
      </div>
    </>
  );
}

const CSS = `
/* A faixa mora entre o cabecalho e o <main>, dentro da .ds-coluna. Nao e
   sticky: o cabecalho ja e, e duas faixas grudadas no topo comeriam um terco da
   tela em notebook. Ela rola junto com o conteudo, como um aviso de topo de
   pagina — que e o que ela e.

   UMA LINHA, e o texto CENTRALIZADO. A altura dela e cobrada de toda tela do
   painel, o dia inteiro: duas linhas custariam o dobro para dizer o mesmo, e um
   aviso encostado na esquerda numa faixa de 1400px fica sozinho no canto de uma
   barra vazia.
   (Sem crases nestes comentarios: template literal.) */
.fc-faixa {
  /* ── A ALTURA DA FAIXA SE AJUSTA AQUI ────────────────────────────────────
     Ela nao tem altura fixa: e o conteudo que a define, e sao DUAS coisas
     somadas.

       --fc-respiro   o ar acima e abaixo (este knob);
       .fc-acao       a pilha do botao, que e o elemento mais alto da linha e
                      portanto o PISO da faixa. Diminuir so o respiro para de
                      surtir efeito quando ele encosta nesse piso — por isso o
                      botao tem o respiro dele logo abaixo, derivado deste.

     Some 1px da borda de baixo no total.
     (Sem crases nestes comentarios: template literal.) */
  --fc-respiro: 6px;
  /* Referencia de posicionamento do X, que e absoluto — ver .fc-fechar. */
  position: relative;
  display: flex; align-items: center; justify-content: center;
  gap: 10px; padding: var(--fc-respiro) 20px;
  background: var(--fc-fundo);
  color: var(--fc-tinta);
  cursor: pointer;
  transition: filter 0.15s ease;
}
/* ── O X, no canto direito ─────────────────────────────────────────────────
   Absoluto de proposito. Ver o comentario no JSX: como item da linha, ele
   deslocaria o recado centralizado.

   Discreto em repouso e nitido no hover — ele nao disputa com o botao de
   contratar, que e o que a faixa quer que a pessoa clique. As cores saem de
   --fc-tinta, entao ele acompanha os tres tons e os dois temas sem uma linha
   propria.

   O respiro de 10px casa com o padding da faixa, e o alvo de 24px e o minimo
   que um X de canto pode ter sem virar armadilha de toque.
   (Sem crases nestes comentarios: template literal.) */
.ds-shell .fc-fechar, .fc-fechar {
  position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
  width: 24px; height: 24px; padding: 0; flex: none;
  display: flex; align-items: center; justify-content: center;
  border-radius: 7px; border: 1px solid transparent;
  background: transparent; box-shadow: none;
  color: var(--fc-tinta); opacity: 0.55; cursor: pointer;
  transition: opacity 0.15s ease, background 0.15s ease;
}
.ds-shell .fc-fechar:hover, .fc-fechar:hover {
  opacity: 1; background: color-mix(in srgb, var(--fc-tinta) 14%, transparent);
  box-shadow: none; transform: translateY(-50%);
}
.fc-fechar:focus-visible { outline: 2px solid var(--fc-tinta); outline-offset: -2px; opacity: 1; }

/* Clarear no escuro, escurecer no claro: brilho fixo faria o hover sumir num
   dos dois temas. */
.fc-faixa:hover { filter: brightness(1.12); }
[data-tema="claro"] .fc-faixa:hover { filter: brightness(0.97); }
.fc-faixa:focus-visible { outline: 2px solid var(--fc-tinta); outline-offset: -2px; }

/* ── UM PAPEL POR TEMA, E ELE NAO E O MESMO ─────────────────────────────────

   O #FFF2EC e um papel QUENTE e quase branco: no painel claro ele destaca a
   faixa do branco em volta sem virar alarme. No painel escuro a mesma cor seria
   uma tarja de luz atravessando a tela — o contrario do que ela quer dizer, e o
   bastante para ofuscar quem trabalha de noite.

   Entao o escuro tem o papel dele: o mesmo TOM (laranja queimado), a mesma
   temperatura, do outro lado da escala. O que nao muda entre os temas e a
   familia da cor — a faixa e reconhecivelmente a mesma peca nos dois.

   O escuro e a base porque o painel nasce escuro; o claro entra por
   [data-tema="claro"], que o AdminLayout carimba na coluna do conteudo.
   (Sem crases nestes comentarios: template literal.) */
.fc-faixa--teste      { --fc-fundo: #2a1a13; --fc-tinta: #ffd7bf; --fc-borda: rgba(255,215,191,0.20); }
.fc-faixa--aguardando { --fc-fundo: #2a2211; --fc-tinta: #fcd34d; --fc-borda: rgba(252,211,77,0.22); }
.fc-faixa--vencido    { --fc-fundo: #2d1319; --fc-tinta: #fda4af; --fc-borda: rgba(253,164,175,0.24); }

[data-tema="claro"] .fc-faixa--teste,
[data-tema="claro"] .fc-faixa--aguardando,
[data-tema="claro"] .fc-faixa--vencido { --fc-fundo: #FFF2EC; }
[data-tema="claro"] .fc-faixa--teste      { --fc-tinta: #7c3a1d; --fc-borda: rgba(124,58,29,0.18); }
[data-tema="claro"] .fc-faixa--aguardando { --fc-tinta: #854d0e; --fc-borda: rgba(133,77,14,0.20); }
[data-tema="claro"] .fc-faixa--vencido    { --fc-tinta: #9f1239; --fc-borda: rgba(159,18,57,0.22); }

.fc-icone { flex: none; display: flex; align-items: center; opacity: 0.85; }
/* Nada de flex:1 em ninguem: com o conteudo centralizado, um elemento que
   estica empurraria o resto para fora do centro. */
.fc-titulo { font-size: 13px; font-weight: 700; letter-spacing: -0.01em; }
.fc-sub { font-size: 13px; opacity: 0.78; }
/* O ponto medio separa titulo e continuacao sem gastar uma linha. Pseudo, e nao
   texto no JSX, para nao aparecer no leitor de tela como uma palavra solta. */
.fc-sub::before { content: "·"; margin-right: 9px; opacity: 0.55; }

.fc-acao {
  flex: none; display: inline-flex; align-items: center; gap: 6px;
  /* O respiro do botao acompanha o da faixa, sempre um pouco menor: se ele
     ficasse fixo, apertar a faixa so encostaria o texto nele. */
  margin-left: 4px; padding: calc(var(--fc-respiro) - 2px) 13px; border-radius: 999px;
  border: 1px solid var(--fc-borda);
  font-size: 12px; font-weight: 700; color: var(--fc-tinta);
  white-space: nowrap;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.fc-faixa:hover .fc-acao {
  background: color-mix(in srgb, var(--fc-tinta) 10%, transparent);
  border-color: var(--fc-tinta);
}

/* Estreito demais para a frase inteira: a continuacao sai e o titulo fica, que
   e a metade que informa. Continua sendo UMA linha — encolher para duas e
   exatamente o que esta faixa nao faz. */
@media (max-width: 900px) {
  .fc-sub { display: none; }
}
@media (max-width: 560px) {
  /* O respiro da direita abre para o X nao sentar em cima do botao: com 12px de
     cada lado os dois disputavam os mesmos 24px de canto. */
  .fc-faixa { padding: var(--fc-respiro) 40px var(--fc-respiro) 12px; gap: 8px; }
  .fc-titulo { font-size: 12px; }
  .ds-shell .fc-fechar, .fc-fechar { right: 6px; }
}
`;
