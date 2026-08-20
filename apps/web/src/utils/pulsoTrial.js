/* ────────────────────────────────────────────────────────────────────────────
   Pulso do teste — quando perguntar "como está sendo?"

   A pergunta nasce de uma AÇÃO, não de um relógio: a pessoa acabou de cadastrar
   um imóvel, salvar um cliente, mexer na vitrine. É o único instante em que ela
   tem opinião formada sobre o produto e nenhuma tela pela metade na frente.
   Modal que abre sozinho no meio de um formulário é interrupção; modal que abre
   logo depois de um "salvo com sucesso" é conversa.

   E é PROBABILÍSTICO de propósito. Perguntar em toda ação vira ruído e ensina a
   fechar sem ler; perguntar num intervalo fixo faz a pessoa perceber o padrão.
   A chance sobe com o uso (mais ações desde a última pergunta) e com a urgência
   (menos dias de teste restando), então quem está trabalhando de verdade e
   perto do vencimento é quem mais ouve — que é exatamente quem tem decisão a
   tomar.

   As travas valem mais que a probabilidade. Elas é que impedem o sorteio de
   produzir aquilo que todo mundo odeia:

     · silêncio nas primeiras horas de conta nova (a pessoa está aprendendo);
     · um mínimo de ações antes da primeira pergunta (sem uso, sem opinião);
     · descanso de dias entre uma pergunta e outra, contado no SERVIDOR, para
       não recomeçar do zero em cada navegador;
     · teto de vezes na vida da imobiliária.

   A memória é dividida em dois: o servidor guarda a resposta (`/me/trial` traz
   `pesquisa.ultimaEm` e `respostas`), o navegador guarda o contador de ações e
   o "fechei agora há pouco". O contador é local porque é barato e descartável —
   mandar cada CRUD para a API só para alimentar uma estatística de interface
   seria uma requisição a mais em cada salvamento.
   ──────────────────────────────────────────────────────────────────────────── */

import { lerDoTenant, gravarNoTenant, CHAVES } from "./chaveDoTenant";

// ─── 1. Barramento de ações CRUD ─────────────────────────────────────────────

/* Quem publica é o `request` do api.js — um lugar só, em vez de um `emitir()`
   colado em cada tela. Rota nova de cadastro passa a contar sozinha; tela que
   for reescrita não esquece de avisar. */

/* ── TODA ação é adiada. A pergunta espera a pessoa SAIR da página ──────────

   O desenho original abria o modal logo depois de um "salvo com sucesso",
   argumentando que ali a pessoa tem opinião formada e nenhuma tela pela metade
   na frente. A premissa está errada na prática: salvar quase nunca é o fim do
   trabalho. Quem cadastra um imóvel salva e continua — sobe foto, marca 360°,
   volta para corrigir o preço. O modal caía no meio disso.

   O editor de vitrine já era exceção, por um motivo que vale para todo mundo:
   "salvei" não é "terminei". Generalizar a exceção é reconhecer que ela era a
   regra. Agora nenhuma ação abre nada na hora — ela deixa uma PENDÊNCIA, e
   quem a cobra é a troca de página. Sair é o único sinal confiável de que a
   tarefa acabou.
   ────────────────────────────────────────────────────────────────────────── */
const ROTAS = [
  { padrao: /^\/api\/properties(\/|$)/, origem: "imovel" },
  { padrao: /^\/api\/clientes(\/|$)/, origem: "cliente" },
  { padrao: /^\/api\/usuarios(\/|$)/, origem: "usuario" },
  { padrao: /^\/api\/cargos(\/|$)/, origem: "cargo" },
  /* A vitrine salva por `PUT /api/tenants/me` — o auto-save do editor, que
     dispara a cada segundo enquanto alguém arrasta um bloco.

     `adiada` é o que separa este caso de todos os outros: ele NÃO acorda a
     pergunta na hora. Salvar ali não é "terminei uma tarefa", é um quadro no
     meio de um arrasto; um modal subindo no meio disso interrompe o trabalho
     em vez de comentá-lo. Fica marcada uma pendência, e quem a cobra é a SAÍDA
     do editor — aí sim a pessoa terminou, e a pergunta tem do que falar. */
  { padrao: /^\/api\/tenants\/me$/, origem: "vitrine" },
];

const METODOS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/* Rotas que passam pelos padrões acima mas não são "o cliente cadastrou algo":
   assinar, responder a própria pesquisa, marcar tutorial. Contá-las abriria o
   modal por causa de um clique dentro do próprio modal. */
const IGNORADAS = [
  /^\/api\/tenants\/me\/trial/,
  /^\/api\/tenants\/me\/assinar/,
  /^\/api\/tenants\/me\/plano/,
  /^\/api\/tenants\/me\/migracao/,
  /^\/api\/properties\/[^/]+\/metrics/,
];

/**
 * Chamado pelo cliente HTTP a cada resposta OK. Traduz caminho + método em
 * "origem" e avisa quem estiver ouvindo. Nada aqui pode lançar: uma falha
 * nesta função abortaria o `.then` de um salvamento que deu certo.
 */
export function notificarRequisicao(path, metodo) {
  try {
    if (!METODOS.has(String(metodo || "GET").toUpperCase())) return;
    const caminho = String(path || "").split("?")[0];
    if (IGNORADAS.some((r) => r.test(caminho))) return;
    const achada = ROTAS.find((r) => r.padrao.test(caminho));
    if (!achada) return;
    registrarAcao(achada.origem);
    // Conta como uso; a pergunta espera a pessoa sair da página.
    marcarPendencia(achada.origem);
  } catch { /* o pulso é acessório: nunca atrapalha a requisição */ }
}

// ─── 2. Memória local ────────────────────────────────────────────────────────

/* Chaveada pelo ID da imobiliária, como todo o resto que este produto guarda no
   navegador — slug é reutilizável e faria a conta nova herdar o contador da
   antiga. Ver `utils/chaveDoTenant.js`, que existe por causa desse estrago.

   Quem publica as ações é o `request` do api.js, que não sabe de tenant nenhum;
   por isso o id fica aqui, guardado por quem monta a tela. Sem id, a memória
   simplesmente não grava — e sem memória o pulso nunca chega a perguntar, que é
   o lado seguro de errar. */
let tenantAtual = null;

export function definirTenantDoPulso(tenantId) {
  tenantAtual = tenantId || null;
}

function ler() {
  const cru = lerDoTenant(CHAVES.pulsoTrial, tenantAtual);
  try {
    const dados = cru ? JSON.parse(cru) : null;
    return dados && typeof dados === "object" ? dados : {};
  } catch {
    return {};
  }
}

function gravar(dados) {
  if (!tenantAtual) return;
  gravarNoTenant(CHAVES.pulsoTrial, tenantAtual, JSON.stringify(dados));
}

/* O auto-save da vitrine dispara um PUT por segundo enquanto a pessoa arrasta
   um bloco. Sem esta janela, cinco minutos no editor "valeriam" trezentas ações
   e o sorteio abriria o modal em cima de um arrasto. Uma sessão de edição conta
   como uma ação a cada 5 minutos. */
const JANELA_REPETIDA_MS = 5 * 60 * 1000;

/** Soma uma ação ao contador desta imobiliária/navegador. */
export function registrarAcao(origem) {
  const dados = ler();
  const agora = Date.now();
  const ultima = dados.ultimaDaOrigem?.[origem] || 0;
  if (origem === "vitrine" && agora - ultima < JANELA_REPETIDA_MS) return;

  gravar({
    ...dados,
    acoes: (dados.acoes || 0) + 1,
    ultimaAcaoEm: agora,
    ultimaOrigem: origem,
    ultimaDaOrigem: { ...(dados.ultimaDaOrigem || {}), [origem]: agora },
  });
}

/** Zera o contador e marca a hora — chamado quando o modal aparece. */
export function marcarPerguntado() {
  gravar({ ...ler(), acoes: 0, perguntadoEm: Date.now(), pendencia: null });
}

/* ── Pendência ──────────────────────────────────────────────────────────────
   "Houve trabalho aqui, mas a pergunta fica para quando a pessoa sair."

   Fica no `localStorage` junto do resto para sobreviver a um F5 no meio do
   trabalho — que é justamente quando alguém mexeu bastante na página.

   Guarda a ROTA junto. É ela que define o que conta como "sair": a pendência
   só é cobrada quando a pessoa está em OUTRO caminho, não ao voltar para o
   mesmo depois de um recarregamento. */

const VALIDADE_PENDENCIA_MS = 6 * 60 * 60 * 1000;

function marcarPendencia(origem) {
  const rota = typeof window !== "undefined" ? window.location.pathname : "";
  gravar({ ...ler(), pendencia: { origem, em: Date.now(), rota } });
}

/**
 * Havia trabalho pendente, feito em OUTRA página? Devolve a origem e apaga a
 * marca — o mesmo trabalho não pode render duas perguntas.
 *
 * `rotaAtual` é onde a pessoa está agora. Sem a comparação, um F5 na própria
 * tela de cadastro cobraria a pendência de quem não saiu de lugar nenhum.
 *
 * A validade existe para quem fechou a aba logo depois de salvar: sem ela, a
 * pendência esperaria dias no armazenamento e a pergunta apareceria na primeira
 * navegação de uma sessão que não tem nada a ver com aquele trabalho.
 */
export function consumirPendencia(rotaAtual = "") {
  const dados = ler();
  const pendencia = dados.pendencia;
  if (!pendencia) return null;
  if (Date.now() - (pendencia.em || 0) > VALIDADE_PENDENCIA_MS) {
    gravar({ ...dados, pendencia: null });
    return null;
  }
  // Ainda na mesma página: o trabalho pode não ter terminado.
  if (pendencia.rota && rotaAtual && pendencia.rota === rotaAtual) return null;
  gravar({ ...dados, pendencia: null });
  return pendencia.origem;
}

export function lerMemoria() {
  return ler();
}

/* Chave SEM o id do tenant, ao contrário do resto daqui: quem liga isso está no
   console conferindo a tela, e teria que descobrir o cuid da própria
   imobiliária antes de conseguir escrever a chave. */
function forcado() {
  try {
    return localStorage.getItem("omnimob_pulso_forcar") === "1";
  } catch {
    return false;
  }
}

// ─── 3. A decisão ────────────────────────────────────────────────────────────

const DIA = 86400000;

/** Nada de pergunta na primeira meia hora: a conta acabou de nascer. */
const IDADE_MINIMA_MS = 30 * 60 * 1000;
/** Sem um punhado de ações a pessoa ainda não formou opinião. */
const ACOES_MINIMAS = 4;
/** Descanso entre uma pergunta e a seguinte. */
const DESCANSO_DIAS = 3;
/** Teto na vida da imobiliária — três conversas, não um pedágio. */
const MAXIMO_DE_VEZES = 3;

/**
 * Vale perguntar agora?
 *
 * @param {object} ctx
 * @param {boolean} ctx.emTrial
 * @param {number|null} ctx.diasRestantes
 * @param {string|null} ctx.criadoEm      quando a conta nasceu (ISO)
 * @param {object} ctx.pesquisa           bloco `pesquisa` de /me/trial
 * @param {number} [ctx.sorteio]          injetável para teste; padrão Math.random()
 * @returns {{ vale: boolean, chance: number, motivo: string }}
 */
export function devePerguntar({ emTrial, diasRestantes, criadoEm, pesquisa = {}, sorteio } = {}) {
  const nao = (motivo) => ({ vale: false, chance: 0, motivo });

  /* Escotilha para conferir o modal sem cadastrar quatro imóveis e torcer pelo
     sorteio. No console do navegador:

       localStorage.setItem("omnimob_pulso_forcar", "1")

     e a próxima ação abre a pergunta. Some com `removeItem`. Só isto é pulado:
     contadores e descanso. Continua exigindo teste em andamento — forçar a
     pergunta para quem já assinou mostraria uma tela que mente. */
  if (forcado()) return { vale: emTrial, chance: 1, motivo: emTrial ? "forcado" : "nao-esta-em-teste" };

  if (!emTrial) return nao("nao-esta-em-teste");
  if ((pesquisa.respostas || 0) >= MAXIMO_DE_VEZES) return nao("ja-perguntamos-demais");

  const memoria = ler();
  const agora = Date.now();

  if (criadoEm && agora - new Date(criadoEm).getTime() < IDADE_MINIMA_MS) {
    return nao("conta-recem-nascida");
  }

  const acoes = memoria.acoes || 0;
  if (acoes < ACOES_MINIMAS) return nao("pouco-uso");

  /* O descanso olha para os dois relógios e obedece ao mais recente: o servidor
     sabe das respostas dadas em qualquer aparelho, o navegador sabe da vez em
     que o modal apareceu e foi fechado sem chegar à API. */
  const marcos = [
    pesquisa.ultimaEm ? new Date(pesquisa.ultimaEm).getTime() : 0,
    memoria.perguntadoEm || 0,
  ];
  const ultimoContato = Math.max(...marcos);
  if (ultimoContato && agora - ultimoContato < DESCANSO_DIAS * DIA) return nao("descansando");

  /* A chance cresce com o uso acumulado e com a urgência do prazo. Os números
     são calibragem, não teoria: com 4 ações fica em ~25%, e cada ação extra
     soma 6 pontos até o teto de 70%. Na reta final (3 dias ou menos) o piso
     sobe para 60% — é a última janela útil para a conversa acontecer. */
  let chance = Math.min(0.7, 0.25 + (acoes - ACOES_MINIMAS) * 0.06);
  if (diasRestantes != null && diasRestantes <= 3) chance = Math.max(chance, 0.6);
  if (diasRestantes != null && diasRestantes > 10) chance = Math.min(chance, 0.35);

  const dado = typeof sorteio === "number" ? sorteio : Math.random();
  if (dado >= chance) return { vale: false, chance, motivo: "sorteio-disse-que-nao" };

  return { vale: true, chance, motivo: "vale" };
}

// ─── 4. Ponte com a tela de assinatura ───────────────────────────────────────

/* O modal da pesquisa não sabe cobrar, e não deve aprender: o fluxo de planos,
   cartão e Stripe já existe inteiro no [TrialAviso] da barra lateral. Quando a
   pessoa clica "quero assinar", pedimos àquele componente que abra — direto no
   passo de escolher plano, porque a etapa do "por que assinar" acabou de
   acontecer aqui.

   Um evento em vez de estado içado até o AdminLayout porque os dois componentes
   moram em pontos distantes da árvore e nada mais entre eles precisa saber
   disso. */
const pedidos = new Set();

export function pedirTelaDeAssinatura(passo = 2) {
  pedidos.forEach((fn) => {
    try { fn(passo); } catch { /* idem */ }
  });
}

export function ouvirPedidoDeAssinatura(fn) {
  pedidos.add(fn);
  return () => pedidos.delete(fn);
}
