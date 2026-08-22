import { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { Kanban, Handshake, SealCheck, Coins, Broadcast, WarningCircle, TrendUp } from "@phosphor-icons/react";
import { api } from "../../api";
import { PageHeader, StatCard, StatGrid } from "../../components/adminUi";
import { ESTAGIOS_FLOW, estagioInfo, reais } from "../../utils/flow";
import { AvisoDePlanoFlow } from "../../components/flow/AvisoDePlanoFlow.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   A TELA INICIAL DO FLOW — a "Visão do Flow".

   Ela é o par do Painel do Gestor no Hub, e responde a pergunta equivalente:
   não "como está o acervo", mas "o que está para fechar".

   ── O QUE ELA MOSTRA PRIMEIRO, E POR QUÊ ──

   Negócios PARADOS. Antes do faturamento, antes do funil, antes de tudo. É a
   única informação desta tela sobre a qual dá para AGIR agora — o resto é
   retrato. Um painel que abre com "R$ 2,4 mi no mês" é agradável de olhar e não
   muda o que a pessoa vai fazer nos próximos cinco minutos.

   ── ESCOPO ──

   Corretor vê o funil dele; quem tem visão de comissão ou de gestão vê o da
   casa. Quem decide é o SERVIDOR (`GET /flow/painel` devolve `escopo`), e a
   tela só rotula. Duas cópias dessa regra dariam uma tela que promete os
   números da equipe e recebe os de uma pessoa só.
   ──────────────────────────────────────────────────────────────────────────── */

export function FlowInicioPage({ session }) {
  const tenantSlug = session?.tenant?.slug;
  const cargo = session?.usuario?.cargo;
  const navigate = useNavigate();
  const showToast = useOutletContext()?.showToast;

  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!tenantSlug) return undefined;
    let vivo = true;
    api.painelFlow(tenantSlug)
      .then((r) => { if (vivo) setDados(r); })
      .catch((e) => { if (vivo) showToast?.(e.message || "Não consegui carregar o painel.", "error"); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [tenantSlug]);

  const primeiroNome = (session?.usuario?.nome || "").split(" ")[0];

  /* O total do funil ABERTO — sem ganho e sem perdido. Somar os oito estágios
     daria um número que cresce para sempre e não responde nada: negócio fechado
     em março continuaria inflando o "em andamento" de dezembro. */
  const emAberto = useMemo(() => {
    if (!dados) return { quantidade: 0, valor: 0 };
    return ESTAGIOS_FLOW.filter((e) => e.key !== "GANHO").reduce(
      (acc, e) => ({
        quantidade: acc.quantidade + (dados.contagem?.[e.key] || 0),
        valor: acc.valor + (dados.soma?.[e.key] || 0),
      }),
      { quantidade: 0, valor: 0 },
    );
  }, [dados]);

  if (carregando) {
    return (
      <div style={{ padding: "8px 0" }}>
        <div className="skeleton-block" style={{ height: 90, borderRadius: 14, marginBottom: 16 }} />
        <div className="skeleton-block" style={{ height: 220, borderRadius: 14 }} />
      </div>
    );
  }

  if (!dados) {
    return <p style={{ color: "var(--text-muted)" }}>Não consegui carregar o painel do Flow.</p>;
  }

  const maior = Math.max(1, ...ESTAGIOS_FLOW.map((e) => dados.contagem?.[e.key] || 0));

  return (
    <div data-tour="flow-inicio">
      <PageHeader
        title={primeiroNome ? `Seu Flow, ${primeiroNome}` : "Visão do Flow"}
        subtitle={
          dados.escopo === "meus"
            ? "Os negócios sob sua responsabilidade, do primeiro contato ao fechamento."
            : "Todos os negócios da imobiliária, do primeiro contato ao fechamento."
        }
      />

      {/* O convite ao upgrade, quando o plano segura alguma coisa. Fica no topo
          e não escondido: é informação sobre o que a conta PODE fazer. */}
      <AvisoDePlanoFlow recursos={dados.recursos} plano={session?.tenant?.plano} />

      {/* ── O que pede ação, primeiro ─────────────────────────────────────── */}
      {dados.parados > 0 ? (
        <button
          type="button"
          className="glass-panel flow-alerta"
          onClick={() => navigate("/flow/negocios?parados=1")}
          data-tour="flow-parados"
        >
          <span className="flow-alerta__icone"><WarningCircle size={20} weight="fill" /></span>
          <span className="flow-alerta__texto">
            <strong>
              {dados.parados === 1
                ? "1 negócio parado"
                : `${dados.parados} negócios parados`}
            </strong>
            <span>
              Sem nenhum registro de contato há mais de {dados.diasParaParado} dias. Negócio esquecido
              não avisa que morreu — ele só some do fim do mês.
            </span>
          </span>
          <span className="flow-alerta__seta" aria-hidden="true">→</span>
        </button>
      ) : null}

      <StatGrid>
        <StatCard
          label="Em andamento"
          value={emAberto.quantidade}
          accent="#14b8a6"
          icon={<Handshake size={19} weight="fill" />}
        />
        <StatCard
          label="Valor em negociação"
          value={reais(emAberto.valor, { curto: true })}
          accent="#8b5cf6"
          icon={<Kanban size={19} weight="fill" />}
        />
        <StatCard
          label="Fechados no mês"
          value={dados.mes.ganhos}
          accent="#10b981"
          icon={<TrendUp size={19} weight="fill" />}
        />
        {/* A comissão só aparece para quem pode vê-la. Sem a permissão, o
            cartão sai da grade em vez de mostrar um traço — um espaço vazio
            rotulado "Comissão" comunica que existe um número escondido, que é
            pior do que não perguntar. */}
        {cargo?.verComissoes ? (
          <StatCard
            label="Comissão do mês"
            value={reais(dados.mes.comissao, { curto: true })}
            accent="#d4af37"
            icon={<Coins size={19} weight="fill" />}
          />
        ) : null}
        {dados.conversao != null ? (
          <StatCard
            label="Conversão"
            value={`${dados.conversao}%`}
            accent="#0ea5e9"
            icon={<TrendUp size={19} weight="fill" />}
          />
        ) : null}
      </StatGrid>

      {/* ── O funil em barras ─────────────────────────────────────────────────
          Barras horizontais e não um funil desenhado: o funil trapezoidal fica
          bonito e mente, porque a largura de cada faixa é proporcional à
          ANTERIOR e não ao total. Barra é comparável de relance e não precisa
          de legenda. */}
      <div className="glass-panel" style={{ padding: "20px 22px", marginBottom: 20 }} data-tour="flow-funil-resumo">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>O funil agora</h3>
          <button type="button" className="flow-link" onClick={() => navigate("/flow/funil")}>
            Abrir o funil →
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {ESTAGIOS_FLOW.map((e) => {
            const n = dados.contagem?.[e.key] || 0;
            const valor = dados.soma?.[e.key] || 0;
            return (
              <button
                key={e.key}
                type="button"
                className="flow-barra"
                onClick={() => navigate(`/flow/negocios?estagio=${e.key}`)}
                title={e.descricao}
              >
                <span className="flow-barra__rotulo">{e.rotulo}</span>
                <span className="flow-barra__trilho">
                  <span
                    className="flow-barra__preenchida"
                    /* Largura mínima de 2% para a barra existir visualmente com
                       um negócio só — zero de largura leria como "sem coluna",
                       e não como "um". */
                    style={{ width: `${Math.max(n ? 2 : 0, (n / maior) * 100)}%`, background: e.cor }}
                  />
                </span>
                <span className="flow-barra__num">{n}</span>
                <span className="flow-barra__valor">{e.key === "GANHO" ? "" : reais(valor, { curto: true })}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Atalhos do processo ───────────────────────────────────────────── */}
      <div className="flow-atalhos">
        {cargo?.gerenciarCaptacao ? (
          <AtalhoFlow
            Icon={Broadcast} cor="#0ea5e9"
            titulo="Fontes de captação"
            texto="Os endereços que os portais e as redes chamam quando alguém demonstra interesse."
            onClick={() => navigate("/flow/captacao")}
          />
        ) : null}
        {(cargo?.validarJuridico || cargo?.validarFinanceiro) ? (
          <AtalhoFlow
            Icon={SealCheck} cor="#f59e0b"
            titulo="Fila de validação"
            texto={
              dados.aguardandoValidacao
                ? `${dados.aguardandoValidacao} negócio(s) esperando conferência jurídica ou financeira.`
                : "Nada esperando conferência no momento."
            }
            destaque={dados.aguardandoValidacao > 0}
            onClick={() => navigate("/flow/validacao")}
          />
        ) : null}
        {cargo?.gerenciarContratos ? (
          <AtalhoFlow
            Icon={Handshake} cor="#8b5cf6"
            titulo="Contratos"
            texto={
              dados.aguardandoAssinatura
                ? `${dados.aguardandoAssinatura} contrato(s) aguardando assinatura.`
                : "Nenhum contrato aguardando assinatura."
            }
            destaque={dados.aguardandoAssinatura > 0}
            onClick={() => navigate("/flow/contratos")}
          />
        ) : null}
        {cargo?.verComissoes ? (
          <AtalhoFlow
            Icon={Coins} cor="#d4af37"
            titulo="Comissões"
            texto="Quanto ficou com a casa e quanto com cada corretor, mês a mês."
            onClick={() => navigate("/flow/comissoes")}
          />
        ) : null}
      </div>
    </div>
  );
}

function AtalhoFlow({ Icon, cor, titulo, texto, onClick, destaque }) {
  return (
    <button
      type="button"
      className={`glass-panel flow-atalho${destaque ? " is-destaque" : ""}`}
      onClick={onClick}
      style={{ "--cor": cor }}
    >
      <span className="flow-atalho__icone"><Icon size={20} weight="fill" /></span>
      <span className="flow-atalho__texto">
        <strong>{titulo}</strong>
        <span>{texto}</span>
      </span>
    </button>
  );
}
