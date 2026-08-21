import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, Eye, CurrencyCircleDollar, Handshake, TrendUp, TrendDown,
  Warning, Buildings, ImageSquare, Trophy, ArrowRight, FileDashed,
} from "@phosphor-icons/react";
import { api } from "../api";
import { SkeletonStats, Skeleton } from "../components/Skeleton";
import { planoLiberaPortais } from "../utils/planos";

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

export function InicioPage({ session }) {
  const navigate = useNavigate();
  const [dados, setDados] = useState(null);
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
    <div className="main-content ig-pagina" style={{ maxWidth: "1100px" }}>
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

      <div className="ig-duas">
        {/* ── 3. O mês ──────────────────────────────────────────────────── */}
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

        {/* ── 4. O imóvel em destaque ───────────────────────────────────── */}
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

      {/* ── 5. A equipe ─────────────────────────────────────────────────── */}
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
