import { useEffect, useState } from "react";
import { Receipt, ArrowSquareOut } from "@phosphor-icons/react";
import { api } from "../api";
import { Skeleton } from "./Skeleton";
import { CodigoPix, useEsperaDoPix, CODIGO_PIX_CSS } from "./CodigoPix.jsx";
import { ReciboDoPagamento } from "./ReciboDoPagamento.jsx";
import { planoInfo } from "../utils/planos";

/* ── Cobrança e pagamentos ───────────────────────────────────────────────────

   A tela que responde "eu paguei?". Ela existe porque, com o Pix, essa pergunta
   passou a existir: enquanto tudo era cartão, o extrato do cartão respondia —
   agora há código gerado, código pago, código expirado e ativação manual pela
   equipe, e nenhuma tela dizia nada disso. Quem queria saber ligava para o
   suporte.

   Componente próprio e não inline em `ConfiguracaoPage`, pelo mesmo motivo do
   `SecaoFlow`: tem estado próprio (busca o extrato) e acrescentaria umas
   duzentas linhas a uma página que já tem mil e quinhentas. `Secao` vem por
   prop para o desenho continuar sendo o mesmo das outras abas — é a moldura
   desta tela, e ela não se duplica.

   ── O QUE ESTA TELA NÃO DIZ ──
   Não chama nada de "fatura" e não promete nota fiscal: a Omnimob não emite. O
   documento é o recibo de quem processou o pagamento, e o link vai para lá.
   ────────────────────────────────────────────────────────────────────────── */

const NOME_MEIO = {
  cartao: "Cartão de crédito",
  boleto: "Boleto",
  pix: "Pix",
  manual: "Liberado pela equipe",
};

const NOME_PROVEDOR = { STRIPE: "Cartão/boleto", MERCADO_PAGO: "Pix", MANUAL: "Omnimob" };

/* Os quatro estados da conta, ditos como o cliente entende. `TRIAL` não é
   "pendente": ninguém deve nada durante o teste, e chamar isso de pendência
   assusta quem ainda está decidindo. */
const SITUACAO = {
  EM_DIA: { texto: "Em dia", cor: "#34d399" },
  TRIAL: { texto: "Em teste", cor: "#d4af37" },
  ATRASADO: { texto: "Pagamento atrasado", cor: "#f59e0b" },
  CANCELADO: { texto: "Assinatura cancelada", cor: "#f87171" },
};

const dinheiro = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const dia = (v) =>
  v ? new Date(v).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

/* Dias inteiros até a data, contados por DATA e não por horas — a mesma conta
   do aviso de vencimento por e-mail, pelo mesmo motivo: quem lê pensa em
   calendário, e 6,9 dias não é um número que alguém diga em voz alta. */
function diasAte(data) {
  if (!data) return null;
  const zero = (d) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((zero(new Date(data)) - zero(new Date())) / 86400000);
}

export function SecaoCobranca({ session, Secao }) {
  const tenantSlug = session?.tenant?.slug || "";
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  /* `recarga` é um contador, e não um booleano: ele precisa disparar a busca de
     novo TODA vez que um pagamento cai, e um booleano só dispara na primeira. */
  const [recarga, setRecarga] = useState(0);
  const [pix, setPix] = useState(null);
  const [gerando, setGerando] = useState(false);
  const [periodo, setPeriodo] = useState(null);
  /* Qual pagamento está com o recibo aberto. Guarda a LINHA inteira, e não o
     id: o comprovante é montado com o que já está na tela, sem nova consulta. */
  const [recibo, setRecibo] = useState(null);

  useEffect(() => {
    if (!tenantSlug) return;
    let vivo = true;
    api
      .listarPagamentos(tenantSlug)
      .then((r) => {
        if (!vivo) return;
        setDados(r);
        /* O período abre no sugerido — o do último pagamento — e só na
           primeira carga: recarregar depois de pagar não pode desfazer a
           escolha de quem estava na tela. */
        setPeriodo((atual) => atual || r?.antecipacao?.sugerido || "mensal");
      })
      .catch((e) => vivo && setErro(e.message || "Não consegui ler o histórico."));
    return () => { vivo = false; };
  }, [tenantSlug, recarga]);

  /* A espera é a MESMA das outras duas telas que vendem — mora em
     `CodigoPix.jsx`. O que muda aqui é o desfecho: não há comemoração nem
     ambiente para recuperar, há um extrato que ganhou uma linha. */
  useEsperaDoPix({
    tenantSlug,
    pix,
    aoAprovar: () => { setPix(null); setRecarga((n) => n + 1); },
    aoRecusar: () => {
      setPix(null);
      setErro("O pagamento não foi concluído. Você pode gerar um novo código.");
    },
  });

  async function gerarPix() {
    setGerando(true);
    setErro("");
    try {
      setPix(await api.criarCobrancaPix(tenantSlug, { plano: dados?.situacao?.plano, periodo }));
    } catch (e) {
      setErro(e.message || "Não foi possível gerar o Pix.");
    } finally {
      setGerando(false);
    }
  }

  const icone = <Receipt size={16} weight="bold" />;

  /* Erro só toma a tela inteira quando não há NADA para mostrar. Com o extrato
     já carregado, uma falha ao gerar o Pix vira uma linha ao lado do botão —
     esconder o histórico por causa dela seria punir quem só queria conferir. */
  if (erro && !dados) {
    return (
      <Secao cor="#94a3b8" titulo="Cobrança e pagamentos" icone={icone}>
        <p style={{ margin: 0, fontSize: "13px", color: "#fca5a5" }}>{erro}</p>
      </Secao>
    );
  }

  /* Esqueleto com a FORMA do que vem — a situação em cima, as linhas do extrato
     embaixo. Um retângulo genérico piscando não diz nada; ver o cabeçalho de
     `Skeleton.jsx`. */
  if (!dados) {
    return (
      <Secao cor="#94a3b8" titulo="Cobrança e pagamentos" icone={icone}>
        <div style={{ display: "grid", gap: "16px" }}>
          <div style={{ display: "flex", gap: "26px", flexWrap: "wrap" }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: "120px" }}>
                <Skeleton width={96} height={10} />
                <Skeleton width={128} height={20} />
              </div>
            ))}
          </div>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} width="100%" height={54} radius={12} />
          ))}
        </div>
      </Secao>
    );
  }

  const { situacao, pagamentos = [], ultimo, antecipacao } = dados;
  const doPeriodo = (antecipacao?.periodos || []).find((p) => p.periodo === periodo);

  /* ── Os dois totais ────────────────────────────────────────────────────────
     Só o que foi PAGO entra: estorno não é dinheiro que a imobiliária gastou, e
     somá-lo daria um número que não bate com o extrato dela.

     O do ano vem primeiro na leitura porque é o que se pede ao contador; o
     total desde o início é o que responde "há quanto tempo somos clientes". */
  const anoAtual = new Date().getFullYear();
  const pagos = pagamentos.filter((p) => p.status === "PAGO");
  const totalGeral = pagos.reduce((soma, p) => soma + Number(p.valor || 0), 0);
  const totalDoAno = pagos
    .filter((p) => new Date(p.pagoEm).getFullYear() === anoAtual)
    .reduce((soma, p) => soma + Number(p.valor || 0), 0);

  /* Agrupado por ano, do mais recente para o mais antigo. Uma lista corrida de
     doze pagamentos mensais vira uma parede; com o ano como cabeçalho, o olho
     encontra o período que procura sem ler linha por linha. */
  const porAno = [];
  for (const p of pagamentos) {
    const ano = new Date(p.pagoEm).getFullYear();
    const grupo = porAno.find((g) => g.ano === ano);
    if (grupo) grupo.itens.push(p);
    else porAno.push({ ano, itens: [p] });
  }
  const estado = SITUACAO[situacao?.statusPagamento] || SITUACAO.TRIAL;
  const faltam = diasAte(situacao?.proximoVencimento);
  const info = planoInfo(situacao?.plano);
  const comFlow = (situacao?.modulos || []).includes("FLOW");

  return (
    <Secao cor="#94a3b8" titulo="Cobrança e pagamentos" icone={icone}>
      {/* ── A situação de hoje ─────────────────────────────────────────────
          Três números, na ordem em que a pergunta é feita: como estou, até
          quando, e quanto. */}
      <div style={{ display: "flex", gap: "26px", flexWrap: "wrap" }}>
        <Numero rotulo="Situação">
          <span style={{ color: estado.cor, fontWeight: 700 }}>{estado.texto}</span>
        </Numero>
        <Numero rotulo={situacao?.renovaSozinho ? "Próxima cobrança" : "Vale até"}>
          {dia(situacao?.proximoVencimento)}
          {faltam != null && faltam >= 0 ? (
            <span style={{ fontSize: "12px", color: "var(--text-muted)", marginLeft: "8px", fontWeight: 400 }}>
              {faltam === 0 ? "hoje" : faltam === 1 ? "amanhã" : `em ${faltam} dias`}
            </span>
          ) : null}
        </Numero>
        <Numero rotulo="Plano">
          {info?.nome || situacao?.plano || "—"}
          {comFlow ? <span style={{ color: "#ec0b5b" }}> + Omniflow</span> : null}
          {situacao?.valorMensal ? (
            <span style={{ fontSize: "12px", color: "var(--text-muted)", marginLeft: "8px", fontWeight: 400 }}>
              {dinheiro(situacao.valorMensal)}/mês
            </span>
          ) : null}
        </Numero>
      </div>

      {/* ── Como esta conta é cobrada ──────────────────────────────────────
          A distinção que mais confunde quem abre esta tela, e a única coisa
          aqui que exige uma AÇÃO da pessoa. Por isso vem antes do extrato:
          quem paga por Pix precisa saber que a conta não se renova sozinha
          antes de ficar olhando a lista do que já pagou. */}
      <div
        style={{
          display: "flex", alignItems: "flex-start", gap: "12px", padding: "14px 16px",
          borderRadius: "12px",
          background: situacao?.renovaSozinho ? "var(--sup-02, rgba(255,255,255,0.02))" : "rgba(212,175,55,0.07)",
          border: `1px solid ${situacao?.renovaSozinho ? "var(--linha-08, rgba(255,255,255,0.08))" : "rgba(212,175,55,0.24)"}`,
        }}
      >
        <span style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <strong style={{ fontSize: "13px" }}>
            {situacao?.renovaSozinho ? "Cobrança automática" : "Sem cobrança automática"}
            {ultimo?.meio ? ` · ${NOME_MEIO[ultimo.meio] || ultimo.meio}` : ""}
          </strong>
          <span style={{ fontSize: "12.5px", color: "var(--text-muted)", lineHeight: 1.55 }}>
            {situacao?.renovaSozinho
              ? "A cobrança sai sozinha no cartão cadastrado. Se ele mudar de número ou expirar, a renovação falha — é o motivo mais comum de uma conta cair."
              : "O Pix não renova sozinho: quando estiver perto de vencer, é preciso gerar um novo código. Avisamos por e-mail antes."}
          </span>
        </span>
      </div>

      {/* ── Adiantar ───────────────────────────────────────────────────────
          Só para quem NÃO renova sozinho: quem tem cobrança automática vai ser
          cobrado no dia dele de qualquer jeito, e um botão de adiantar ali
          seria um convite a pagar duas vezes o mesmo mês.

          Funciona porque o servidor soma o período A PARTIR do vencimento
          atual quando ele está no futuro — adiantar não joga fora os dias que
          faltavam. É a mesma regra do Pix, da renovação e da ativação manual. */}
      {antecipacao?.disponivel ? (
        <div
          style={{
            display: "flex", flexDirection: "column", gap: "12px",
            padding: "16px", borderRadius: "12px",
            background: "var(--sup-02, rgba(255,255,255,0.02))",
            border: "1px solid var(--linha-08, rgba(255,255,255,0.08))",
          }}
        >
          <style>{CODIGO_PIX_CSS}</style>

          {pix ? (
            <>
              <strong style={{ fontSize: "13px" }}>Pague para adiantar</strong>
              <span style={{ fontSize: "12.5px", color: "var(--text-muted)", lineHeight: 1.55 }}>
                Abra o app do seu banco, escolha Pix e leia o código. Assim que o pagamento cair,
                o vencimento anda sozinho e a cobrança aparece na lista abaixo.
              </span>
              <CodigoPix pix={pix} />
              <span style={{ fontSize: "12.5px", color: "var(--text-muted)" }} aria-live="polite">
                Aguardando o pagamento…
              </span>
              <button
                type="button"
                onClick={() => { setPix(null); setErro(""); }}
                style={botaoDiscreto}
              >
                Cancelar
              </button>
            </>
          ) : (
            <>
              <span style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <strong style={{ fontSize: "13px" }}>Adiantar pagamento</strong>
                <span style={{ fontSize: "12.5px", color: "var(--text-muted)", lineHeight: 1.55 }}>
                  Pague agora e o prazo é somado ao seu vencimento atual — você não perde os dias
                  que faltavam.
                </span>
              </span>

              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                {/* Rádio de verdade: são opções do mesmo campo, e é o que faz as
                    setas do teclado andarem entre elas sem código nosso. */}
                <div role="radiogroup" aria-label="Período" style={{ display: "flex", gap: "6px" }}>
                  {antecipacao.periodos.map((op) => (
                    <label
                      key={op.periodo}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: "7px", cursor: "pointer",
                        padding: "8px 14px", borderRadius: "999px", fontSize: "12.5px",
                        background: periodo === op.periodo ? "rgba(99,102,241,0.18)" : "transparent",
                        border: `1px solid ${periodo === op.periodo ? "rgba(99,102,241,0.55)" : "var(--linha-10, rgba(255,255,255,0.1))"}`,
                        color: periodo === op.periodo ? "var(--text-main)" : "var(--text-muted)",
                      }}
                    >
                      <input
                        type="radio"
                        name="antecipar-periodo"
                        checked={periodo === op.periodo}
                        onChange={() => setPeriodo(op.periodo)}
                        style={{ position: "absolute", opacity: 0, width: 0, height: 0, padding: 0, margin: 0, border: 0 }}
                      />
                      {op.periodo === "anual" ? "12 meses" : "1 mês"}
                      <span style={{ fontWeight: 700 }}>{dinheiro(op.valor)}</span>
                    </label>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={gerarPix}
                  disabled={gerando || !doPeriodo}
                  style={{
                    marginLeft: "auto", cursor: gerando ? "default" : "pointer",
                    padding: "10px 18px", borderRadius: "10px", border: 0,
                    fontSize: "13px", fontWeight: 600, color: "#fff",
                    background: "var(--accent, #6366f1)", opacity: gerando ? 0.6 : 1,
                  }}
                >
                  {gerando ? "Gerando…" : "Gerar código Pix"}
                </button>
              </div>

              {/* A falha ao gerar mora AQUI, ao lado do botão que a causou — e
                  não no topo, onde ninguém relacionaria as duas coisas. */}
              {erro ? <span style={{ fontSize: "12.5px", color: "#fca5a5" }}>{erro}</span> : null}
            </>
          )}
        </div>
      ) : null}

      {/* ── O extrato ──────────────────────────────────────────────────────
          Sem cabeçalho de tabela: são quatro campos por linha e a tela é
          estreita no celular. Cada linha se lê sozinha. */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>
          Pagamentos
        </span>

        {pagamentos.length === 0 ? (
          /* Vazio com MOTIVO. "Nenhum pagamento" sozinho faz a pessoa procurar
             o que quebrou; dizer que ainda não houve cobrança responde. */
          <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.6 }}>
            {situacao?.statusPagamento === "TRIAL"
              ? "Nada cobrado até aqui — você está em teste. Quando assinar, cada pagamento aparece nesta lista com o comprovante."
              : "Nenhuma cobrança registrada ainda. Assim que a primeira for paga, ela aparece aqui com o comprovante."}
          </p>
        ) : (
          <>
            {/* Os totais, antes da lista: é a pergunta que se faz olhando um
                extrato antes de olhar as linhas dele. */}
            <div style={{ display: "flex", gap: "22px", flexWrap: "wrap", paddingBottom: "4px" }}>
              <Numero rotulo={`Pago em ${anoAtual}`}>{dinheiro(totalDoAno)}</Numero>
              <Numero rotulo="Desde o início">{dinheiro(totalGeral)}</Numero>
              <Numero rotulo="Cobranças">{pagos.length}</Numero>
            </div>

            {porAno.map((grupo) => (
              <div key={grupo.ano} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {/* O ano só aparece quando há mais de um: com um ano só, o
                    cabeçalho é ruído — a data já está em cada linha. */}
                {porAno.length > 1 ? (
                  <span style={{ fontSize: "11.5px", fontWeight: 700, color: "var(--text-muted)", marginTop: "6px" }}>
                    {grupo.ano}
                  </span>
                ) : null}
                {grupo.itens.map((p) => (
                  <LinhaDePagamento key={p.id} p={p} aoVerRecibo={() => setRecibo(p)} />
                ))}
              </div>
            ))}
          </>
        )}
      </div>

      <p style={{ margin: 0, fontSize: "11.5px", color: "var(--placeholder, #64748b)", lineHeight: 1.6 }}>
        O recibo comprova o pagamento e não é nota fiscal — a Omnimob não emite NF-e no
        momento. Se a sua contabilidade precisar de uma, responda o e-mail da cobrança.
      </p>

      {recibo ? (
        <ReciboDoPagamento
          pagamento={recibo}
          imobiliaria={situacao?.imobiliaria}
          planoNome={planoInfo(recibo.plano)?.nome || recibo.plano}
          aoFechar={() => setRecibo(null)}
        />
      ) : null}
    </Secao>
  );
}

const botaoDiscreto = {
  alignSelf: "flex-start", cursor: "pointer", padding: "8px 14px", borderRadius: "10px",
  fontSize: "12.5px", color: "var(--text-main)",
  background: "var(--sup-05, rgba(255,255,255,0.05))",
  border: "1px solid var(--linha-10, rgba(255,255,255,0.1))",
};

function Numero({ rotulo, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px", minWidth: "120px" }}>
      <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)" }}>
        {rotulo}
      </span>
      <span style={{ fontSize: "15px", fontWeight: 600 }}>{children}</span>
    </div>
  );
}

const CORES_STATUS = {
  PAGO: "#34d399",
  PENDENTE: "#d4af37",
  FALHOU: "#f87171",
  ESTORNADO: "#94a3b8",
};

function LinhaDePagamento({ p, aoVerRecibo }) {
  const cor = CORES_STATUS[p.status] || "#94a3b8";
  /* O período coberto é o que responde "este pagamento valeu por quanto
     tempo?" — e é ele que explica um valor de R$ 891 num plano de R$ 99. */
  const periodo = p.cobreAte
    ? `${p.cobreDe ? `${dia(p.cobreDe)} → ` : "até "}${dia(p.cobreAte)}`
    : null;

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap",
        padding: "13px 15px", borderRadius: "12px",
        background: "var(--sup-02, rgba(255,255,255,0.02))",
        border: "1px solid var(--linha-08, rgba(255,255,255,0.08))",
      }}
    >
      <span style={{ display: "flex", flexDirection: "column", gap: "3px", flex: "1 1 200px", minWidth: 0 }}>
        <strong style={{ fontSize: "13.5px" }}>
          {dinheiro(p.valor)}
          {p.status !== "PAGO" ? (
            <span style={{ color: cor, fontSize: "11.5px", fontWeight: 700, marginLeft: "8px" }}>
              {p.status === "ESTORNADO" ? "ESTORNADO" : p.status}
            </span>
          ) : null}
        </strong>
        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
          {NOME_MEIO[p.meio] || NOME_PROVEDOR[p.provedor] || "Cobrança"}
          {p.plano ? ` · ${planoInfo(p.plano)?.nome || p.plano}` : ""}
          {p.periodo ? ` · ${p.periodo === "anual" ? "12 meses" : "1 mês"}` : ""}
        </span>
        {/* A descrição só existe na ativação manual, e é ela que explica um
            pagamento sem cobrança nenhuma no provedor. */}
        {p.descricao ? (
          <span style={{ fontSize: "11.5px", color: "var(--placeholder, #64748b)", lineHeight: 1.5 }}>
            {p.descricao}
          </span>
        ) : null}
      </span>

      <span style={{ display: "flex", flexDirection: "column", gap: "3px", textAlign: "right" }}>
        <span style={{ fontSize: "12.5px" }}>{dia(p.pagoEm)}</span>
        {periodo ? (
          <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>{periodo}</span>
        ) : null}
      </span>

      <span style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {/* O comprovante da Omnimob existe para TODA linha — inclusive para a
            ativação manual, que não tem provedor nenhum por trás. */}
        <button
          type="button"
          onClick={aoVerRecibo}
          style={{
            cursor: "pointer", padding: "7px 12px", borderRadius: "9px", font: "inherit",
            fontSize: "12.5px", fontWeight: 600, color: "var(--text-main)",
            background: "var(--sup-05, rgba(255,255,255,0.05))",
            border: "1px solid var(--linha-10, rgba(255,255,255,0.1))",
          }}
        >
          Recibo
        </button>

        {/* O documento do PROVEDOR, quando ele existe de verdade. Só o Stripe
            tem: o Mercado Pago não emite comprovante de Pix, e o link que ele
            devolve é a tela do QR já pago. */}
        {p.reciboUrl && p.provedor === "STRIPE" ? (
          <a
            href={p.reciboUrl}
            target="_blank"
            rel="noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12.5px", color: "#a5b4fc" }}
          >
            Fatura <ArrowSquareOut size={13} />
          </a>
        ) : null}
      </span>
    </div>
  );
}
