import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, Eye, CurrencyCircleDollar, Handshake, TrendUp, TrendDown,
  Warning, Buildings, ImageSquare, Trophy, ArrowRight, FileDashed,
  Sparkle, ChartLineUp, Funnel, Broadcast, Target, Lightning,
} from "@phosphor-icons/react";
import { api } from "../api";
import { SkeletonStats, Skeleton } from "../components/Skeleton";
import { planoLiberaPortais } from "../utils/planos";
import {
  GraficoDeMovimento, GraficoDeFaturamento, GraficoDeFunil, GraficoDeOrigens,
} from "../components/Graficos.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   Início — o painel de quem DIRIGE a imobiliária.

   ── POR QUE ELE NÃO É O PAINEL DE IMÓVEIS ──

   A tela inicial era o acervo: atalhos, contagem de imóveis, lista. Isso serve
   a quem CADASTRA. Quem dirige chega de manhã com outras perguntas, e nenhuma
   delas tinha tela — embora todas já tivessem resposta no banco:

     · apareceu gente hoje? mais ou menos que ontem?
     · o que está puxando atenção?
     · quanto entrou este mês?
     · quem está fechando, e quem está sentado em lead parado?
     · o que está me custando dinheiro agora sem eu ver?

   O painel de imóveis não sumiu — mudou de endereço para `/dashboard` e ganhou
   item próprio na barra. As duas telas existem porque são dois trabalhos.

   ── A ORDEM DA PÁGINA É A ORDEM DAS PERGUNTAS ──

   1. HOJE, com comparação. Um número sozinho não informa.
   2. O QUE PEDE AÇÃO, logo em seguida e antes de qualquer métrica bonita. Lead
      sem resposta custa dinheiro agora; ele não pode estar no rodapé.
   3. O MÊS: faturamento, comissão, conversão.
   4. DESTAQUE e EQUIPE.

   ── AUSÊNCIA NÃO É ZERO ──

   O servidor manda `null` para o que não existe (ticket médio sem venda,
   conversão sem visita), e a tela mostra "—". "R$ 0,00 de ticket médio" é uma
   afirmação errada sobre o negócio de alguém. Ver `services/painelGestor.js`.
   ──────────────────────────────────────────────────────────────────────────── */

const brl = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** O traço da ausência. Um lugar só, para os três blocos concordarem. */
const AUSENTE = "—";

function Indicador({ icone, cor, rotulo, valor, apoio, comparacao }) {
  return (
    <div className="ig-card">
      <span className="ig-card__icone" style={{ background: `${cor}1f`, color: cor }}>{icone}</span>
      <div className="ig-card__corpo">
        <strong className="ig-card__valor">{valor}</strong>
        <span className="ig-card__rotulo">{rotulo}</span>
        {comparacao ? <span className={`ig-delta is-${comparacao.tom}`}>{comparacao.texto}</span> : null}
        {apoio ? <span className="ig-card__apoio">{apoio}</span> : null}
      </div>
    </div>
  );
}

/* Compara hoje com ontem. Sem ontem, não inventa: devolve `null` e o cartão sai
   só com o número, que é o que a informação permite dizer. */
function contraOntem(hoje, ontem) {
  if (!ontem) return hoje ? { tom: "alta", texto: "primeiro registro do período" } : null;
  const d = hoje - ontem;
  if (d === 0) return { tom: "igual", texto: `igual a ontem (${ontem})` };
  return {
    tom: d > 0 ? "alta" : "baixa",
    texto: `${d > 0 ? "+" : ""}${d} em relação a ontem (${ontem})`,
  };
}

/* ── A LEITURA DA IA ─────────────────────────────────────────────────────────

   Ela chega DEPOIS do painel, numa requisição própria — o painel abre em
   milissegundos e o modelo leva segundos, e prender catorze números prontos
   atrás de uma frase opcional seria trocar o essencial pelo acessório.

   Enquanto não chega, o bloco não existe. Nada de esqueleto pulsando: a análise
   é um extra, e reservar espaço para ela empurraria as pendências — que são a
   parte cara desta tela — para baixo da dobra por três segundos.

   O humor tinge a borda e o ícone, e só. Um cartão inteiro vermelho no topo do
   painel toda manhã em que o mês está fraco vira ruído que se aprende a
   ignorar. */
const HUMOR = {
  BOM:      { cor: "#10b981", Icone: TrendUp },
  ATENCAO:  { cor: "#f59e0b", Icone: Target },
  RUIM:     { cor: "#ef4444", Icone: TrendDown },
  NEUTRO:   { cor: "#6366f1", Icone: Sparkle },
};

function LeituraDaIA({ analise }) {
  if (!analise?.disponivel) return null;
  const { cor, Icone } = HUMOR[analise.humor] || HUMOR.NEUTRO;

  return (
    <section className="glass-panel ig-ia" style={{ "--ia-cor": cor }} data-tour="gestor-ia">
      <span className="ig-ia__selo"><Icone size={18} weight="fill" /></span>
      <div className="ig-ia__corpo">
        <header>
          <strong>{analise.titulo}</strong>
          {/* Dizer que foi a IA não é enfeite: o texto faz afirmações sobre o
              negócio da pessoa, e ela tem o direito de saber quem as fez para
              calibrar o quanto confia. */}
          <span className="ig-ia__marca"><Sparkle size={11} weight="fill" /> leitura por IA</span>
        </header>
        {analise.leitura ? <p className="ig-ia__leitura">{analise.leitura}</p> : null}
        {analise.destaque ? (
          <p className="ig-ia__destaque"><Trophy size={13} weight="fill" /> {analise.destaque}</p>
        ) : null}
        {analise.acao ? (
          <p className="ig-ia__acao"><Lightning size={13} weight="fill" /> {analise.acao}</p>
        ) : null}
      </div>
    </section>
  );
}

export function InicioPage({ session }) {
  const navigate = useNavigate();
  const [dados, setDados] = useState(null);
  const [analise, setAnalise] = useState(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  const tenantSlug = session?.tenant?.slug;
  const primeiroNome = (session?.usuario?.google?.nome || session?.usuario?.nome || "").split(" ")[0];
  const temPortais = planoLiberaPortais(session?.tenant?.plano);

  useEffect(() => {
    if (!tenantSlug) return undefined;
    let vivo = true;
    setCarregando(true);
    api.painelGestor(tenantSlug)
      .then((r) => vivo && setDados(r))
      .catch((e) => vivo && setErro(e.message))
      .finally(() => vivo && setCarregando(false));

    /* Em paralelo, e sem `catch` que apareça na tela. A análise é um extra:
       plano insuficiente responde 403, IA fora do ar responde `disponivel:
       false`, e os dois desfechos são o mesmo para quem olha — o bloco não
       aparece. Uma faixa de erro por causa dela seria alarme falso num painel
       saudável. */
    api.painelGestorAnalise(tenantSlug)
      .then((r) => vivo && setAnalise(r))
      .catch(() => vivo && setAnalise(null));

    return () => { vivo = false; };
  }, [tenantSlug]);

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  /* As pendências viram uma lista só, e cada uma leva para onde se resolve —
     um número que não tem para onde clicar é uma cobrança sem saída. */
  const pendencias = !dados ? [] : [
    dados.atencao.leadsSemResposta && {
      chave: "sem-resposta",
      texto: `${dados.atencao.leadsSemResposta} ${dados.atencao.leadsSemResposta === 1 ? "interessado espera" : "interessados esperam"} o primeiro contato`,
      acao: "Atender",
      cor: "#ef4444",
      Icone: Users,
      ir: () => navigate("/relatorios?ver=leads"),
    },
    dados.atencao.leadsSemDono && {
      chave: "sem-dono",
      texto: `${dados.atencao.leadsSemDono} sem corretor responsável`,
      acao: "Distribuir",
      cor: "#f59e0b",
      Icone: Users,
      ir: () => navigate("/relatorios?ver=leads"),
    },
    dados.atencao.imoveisSemFoto && {
      chave: "sem-foto",
      /* Sem foto é o mais caro do bloco e quase ninguém sabe: o portal RECUSA
         o anúncio na carga, então o imóvel simplesmente não existe lá fora. */
      texto: `${dados.atencao.imoveisSemFoto} ${dados.atencao.imoveisSemFoto === 1 ? "imóvel ativo sem foto" : "imóveis ativos sem foto"}${temPortais ? " — os portais recusam" : ""}`,
      acao: "Ver imóveis",
      cor: "#0ea5e9",
      Icone: ImageSquare,
      ir: () => navigate("/imoveis/portfolio"),
    },
    dados.atencao.rascunhos && {
      chave: "rascunhos",
      texto: `${dados.atencao.rascunhos} ${dados.atencao.rascunhos === 1 ? "rascunho não publicado" : "rascunhos não publicados"}`,
      acao: "Revisar",
      cor: "#8b5cf6",
      Icone: FileDashed,
      ir: () => navigate("/imoveis/portfolio"),
    },
  ].filter(Boolean);

  return (
    /* 1100 -> 1240: a página passou de cinco blocos para oito, e dois deles são
       gráficos lado a lado. A 1100px o de faturamento ficava com seis barras em
       340px de largura útil, que é estreito demais para o rótulo do mês caber
       sem girar. */
    <div className="main-content ig-pagina" style={{ maxWidth: "1240px" }}>
      <header data-tour="gestor-saudacao" style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "28px", marginBottom: "6px" }}>
          {saudacao}{primeiroNome ? `, ${primeiroNome}` : ""}
        </h1>
        <p style={{ color: "var(--text-muted)", margin: 0 }}>
          O que aconteceu na {session?.tenant?.name || "sua imobiliária"} — e o que precisa de você agora.
        </p>
      </header>

      {erro ? <div className="error" style={{ marginBottom: "16px" }}>{erro}</div> : null}

      {/* ── 1. Hoje ─────────────────────────────────────────────────────── */}
      {carregando ? <SkeletonStats count={4} /> : dados ? (
        <div className="ig-grade" data-tour="gestor-indicadores">
          <Indicador
            icone={<Users size={20} weight="fill" />} cor="#6366f1"
            rotulo="Interessados hoje" valor={dados.hoje.interessados}
            comparacao={contraOntem(dados.hoje.interessados, dados.hoje.interessadosOntem)}
          />
          <Indicador
            icone={<Eye size={20} weight="fill" />} cor="#0ea5e9"
            rotulo="Visitas à vitrine hoje" valor={dados.hoje.visitas}
            comparacao={contraOntem(dados.hoje.visitas, dados.hoje.visitasOntem)}
          />
          <Indicador
            icone={<CurrencyCircleDollar size={20} weight="fill" />} cor="#10b981"
            rotulo="Faturado no mês" valor={brl(dados.mes.faturamento)}
            comparacao={
              dados.mes.variacaoFaturamento === null ? null : {
                tom: dados.mes.variacaoFaturamento >= 0 ? "alta" : "baixa",
                texto: `${dados.mes.variacaoFaturamento >= 0 ? "+" : ""}${dados.mes.variacaoFaturamento}% sobre o mês passado`,
              }
            }
          />
          <Indicador
            icone={<Buildings size={20} weight="fill" />} cor="#f59e0b"
            rotulo="Em carteira" valor={brl(dados.acervo.valorEmCarteira)}
            apoio={`${dados.acervo.ativos} ${dados.acervo.ativos === 1 ? "imóvel ativo" : "imóveis ativos"}`}
          />
        </div>
      ) : null}

      {/* ── 1.5 A leitura da IA ─────────────────────────────────────────
          Entre os números e as pendências, e o lugar é o argumento: ela LÊ os
          números de cima e costuma APONTAR para uma das pendências de baixo.
          No rodapé seria um comentário sobre algo que já saiu da tela. */}
      {!carregando ? <LeituraDaIA analise={analise} /> : null}

      {/* ── 2. O que pede ação ──────────────────────────────────────────── */}
      {!carregando && pendencias.length ? (
        <section className="glass-panel ig-bloco" data-tour="gestor-pendencias">
          <h2 className="ig-titulo"><Warning size={17} weight="fill" style={{ color: "#f59e0b" }} /> Precisa de você</h2>
          <ul className="ig-pendencias">
            {pendencias.map((p) => (
              <li key={p.chave}>
                <span className="ig-pendencia__ponto" style={{ background: p.cor }} aria-hidden="true" />
                <p.Icone size={16} style={{ color: p.cor, flex: "none" }} />
                <span className="ig-pendencia__texto">{p.texto}</span>
                <button type="button" className="ig-acao" onClick={p.ir}>
                  {p.acao} <ArrowRight size={12} weight="bold" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!carregando && dados && !pendencias.length ? (
        <section className="glass-panel ig-bloco ig-limpo">
          <Trophy size={20} weight="fill" style={{ color: "#34d399" }} />
          <p>Nenhuma pendência. Todo interessado foi atendido e o acervo está publicado.</p>
        </section>
      ) : null}

      {/* ── 3. O movimento dos últimos 30 dias ───────────────────────────
          Largura inteira, e sozinho na linha: é uma série temporal, e espremer
          trinta pontos em meia tela transforma a tendência — a única coisa que
          este gráfico existe para mostrar — numa serrilha ilegível. */}
      <section className="glass-panel ig-bloco">
        <h2 className="ig-titulo">
          <ChartLineUp size={17} weight="bold" /> Movimento dos últimos 30 dias
        </h2>
        {carregando ? <Skeleton height={170} radius={12} /> : (
          <GraficoDeMovimento serie={dados?.serie} />
        )}
      </section>

      {/* ── 4. Faturamento e funil, lado a lado ──────────────────────────
          As duas metades da mesma pergunta: o dinheiro que ENTROU (seis meses,
          fato consumado) e o que está a caminho (onde os interessados estão
          parados agora). Juntas elas dizem se o mês fraco foi acaso ou se o
          funil já avisava. */}
      <div className="ig-duas">
        <section className="glass-panel ig-bloco">
          <h2 className="ig-titulo"><CurrencyCircleDollar size={17} weight="fill" /> Faturamento por mês</h2>
          {carregando ? <Skeleton height={170} radius={12} /> : (
            <GraficoDeFaturamento meses={dados?.meses} />
          )}
        </section>

        <section className="glass-panel ig-bloco">
          <h2 className="ig-titulo"><Funnel size={17} weight="fill" /> Onde os interessados estão</h2>
          {carregando ? <Skeleton height={170} radius={12} /> : (
            <GraficoDeFunil
              funil={dados?.funil}
              /* Cada faixa leva à lista já filtrada. Um número sem para onde
                 clicar é uma constatação; com destino, vira trabalho. */
              aoClicar={(estagio) => navigate(`/relatorios?ver=leads&estagio=${estagio}`)}
            />
          )}
        </section>
      </div>

      {/* ── 5. De onde vêm ───────────────────────────────────────────────
          Noventa dias, e não trinta: origem de lead é dado de volume baixo, e
          num mês uma imobiliária pequena teria três contatos por canal — o
          gráfico diria mais sobre o acaso do que sobre os canais. */}
      <section className="glass-panel ig-bloco">
        <h2 className="ig-titulo"><Broadcast size={17} weight="fill" /> De onde vêm os interessados</h2>
        {carregando ? <Skeleton height={120} radius={12} /> : (
          <GraficoDeOrigens origens={dados?.origens} />
        )}
      </section>

      <div className="ig-duas">
        {/* ── 6. O mês ──────────────────────────────────────────────────── */}
        <section className="glass-panel ig-bloco">
          <h2 className="ig-titulo"><TrendUp size={17} weight="bold" /> O mês até agora</h2>
          {carregando ? (
            <>
              <Skeleton height={16} style={{ marginBottom: 10 }} />
              <Skeleton height={16} width="70%" />
            </>
          ) : dados ? (
            <dl className="ig-linhas">
              <div><dt>Vendas fechadas</dt><dd>{dados.mes.vendas}</dd></div>
              <div>
                <dt>Ticket médio</dt>
                {/* `null` do servidor vira traço, nunca R$ 0,00. */}
                <dd>{dados.mes.ticketMedio === null ? AUSENTE : brl(dados.mes.ticketMedio)}</dd>
              </div>
              <div><dt>Comissões do período</dt><dd>{brl(dados.mes.comissoes)}</dd></div>
              <div>
                <dt>Visitas que viraram lead</dt>
                <dd>{dados.mes.visitaParaLead === null ? AUSENTE : `${dados.mes.visitaParaLead}%`}</dd>
              </div>
              <div>
                <dt>Leads que viraram venda</dt>
                <dd>{dados.mes.leadParaVenda === null ? AUSENTE : `${dados.mes.leadParaVenda}%`}</dd>
              </div>
            </dl>
          ) : null}
        </section>

        {/* ── 7. O imóvel em destaque ───────────────────────────────────── */}
        <section className="glass-panel ig-bloco">
          <h2 className="ig-titulo"><Eye size={17} weight="fill" /> Imóvel em destaque</h2>
          {carregando ? (
            <Skeleton height={92} radius={12} />
          ) : dados?.imovelDestaque ? (
            <button
              type="button"
              className="ig-destaque"
              onClick={() => navigate(`/imoveis/${dados.imovelDestaque.id}`)}
            >
              {dados.imovelDestaque.foto ? (
                <img src={dados.imovelDestaque.foto} alt="" loading="lazy" />
              ) : (
                <span className="ig-destaque__semfoto"><ImageSquare size={20} /></span>
              )}
              <span className="ig-destaque__texto">
                <strong>{dados.imovelDestaque.title}</strong>
                {dados.imovelDestaque.local ? <small>{dados.imovelDestaque.local}</small> : null}
                <em>{dados.imovelDestaque.visitas} visitas nos últimos 7 dias</em>
              </span>
            </button>
          ) : (
            <p className="ig-vazio">Sem visitas registradas nos últimos 7 dias.</p>
          )}
        </section>
      </div>

      {/* ── 8. A equipe ─────────────────────────────────────────────────── */}
      <section className="glass-panel ig-bloco" data-tour="gestor-equipe">
        <h2 className="ig-titulo"><Trophy size={17} weight="fill" /> Equipe no mês</h2>
        {carregando ? (
          <Skeleton height={64} radius={12} />
        ) : dados?.equipe?.length ? (
          <ol className="ig-equipe">
            {dados.equipe.map((p, i) => (
              <li key={p.id}>
                <span className="ig-equipe__pos">{i + 1}</span>
                {p.foto
                  ? <img className="ig-equipe__foto" src={p.foto} alt="" referrerPolicy="no-referrer" />
                  : <span className="ig-equipe__foto is-inicial">{p.nome.charAt(0).toUpperCase()}</span>}
                <span className="ig-equipe__nome">
                  {p.nome}
                  <small>
                    {p.vendas} {p.vendas === 1 ? "venda" : "vendas"}
                    {p.leads ? ` · ${p.leads} ${p.leads === 1 ? "lead" : "leads"}` : ""}
                  </small>
                </span>
                <span className="ig-equipe__valor">
                  {brl(p.valor)}
                  {p.comissao ? <small>{brl(p.comissao)} de comissão</small> : null}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="ig-vazio">
            Nenhuma venda registrada neste mês. Vendas entram pelo Funil de vendas, em Relatórios.
          </p>
        )}
      </section>
    </div>
  );
}
