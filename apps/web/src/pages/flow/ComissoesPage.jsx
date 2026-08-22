import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { CaretLeft, CaretRight, Coins } from "@phosphor-icons/react";
import { api } from "../../api";
import { PageHeader, StatCard, StatGrid, EmptyState, Avatar } from "../../components/adminUi";
import { reais, dataCurta } from "../../utils/flow";

/* ────────────────────────────────────────────────────────────────────────────
   COMISSÕES — quanto ficou com a casa e quanto com cada um.

   ── O NÚMERO DESTA TELA É O QUE FOI CONGELADO ──

   Nada aqui é recalculado: os valores saem das colunas `comissao*` do negócio,
   gravadas no instante em que ele foi para Ganho. A imobiliária muda a política
   de 6% para 5% e o mês passado continua exatamente como estava.

   É a diferença entre um relatório e uma projeção — e num relatório de comissão
   ela é a diferença entre a conta do corretor bater com o contracheque dele ou
   não. Ver `services/flow/comissoes.js`.

   ── A SOMA DO RODAPÉ SAI DAS LINHAS ──

   Os totais vêm do mesmo conjunto de negócios que a tabela lista, e não de um
   `groupBy` separado. Duas consultas com o filtro escrito duas vezes é como o
   rodapé deixa de bater com o corpo da tabela.
   ──────────────────────────────────────────────────────────────────────────── */

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function ComissoesPage({ session }) {
  const tenantSlug = session?.tenant?.slug;
  const navigate = useNavigate();
  const showToast = useOutletContext()?.showToast;

  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!tenantSlug) return undefined;
    let vivo = true;
    setCarregando(true);
    api.comissoesFlow(tenantSlug, { ano, mes })
      .then((r) => { if (vivo) setDados(r); })
      .catch((e) => { if (vivo) showToast?.(e.message || "Não consegui carregar.", "error"); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [tenantSlug, ano, mes]);

  function andar(passo) {
    let m = mes + passo;
    let a = ano;
    if (m < 1) { m = 12; a -= 1; }
    if (m > 12) { m = 1; a += 1; }
    setMes(m); setAno(a);
  }

  /* Não dá para navegar para o futuro: um mês que ainda não aconteceu só pode
     mostrar zero, e um zero legítimo é indistinguível de um mês ruim. */
  const noFuturo = ano > hoje.getFullYear() || (ano === hoje.getFullYear() && mes >= hoje.getMonth() + 1);

  return (
    <div data-tour="flow-comissoes">
      <PageHeader
        title="Comissões"
        subtitle="Os valores foram congelados quando cada negócio fechou — mudar a política agora não reescreve o passado."
      />

      <div className="flow-mes">
        <button type="button" onClick={() => andar(-1)} aria-label="Mês anterior"><CaretLeft size={15} weight="bold" /></button>
        <strong>{MESES[mes - 1]} de {ano}</strong>
        <button type="button" onClick={() => andar(1)} disabled={noFuturo} aria-label="Próximo mês">
          <CaretRight size={15} weight="bold" />
        </button>
      </div>

      {carregando ? (
        <div className="skeleton-block" style={{ height: 300, borderRadius: 14 }} />
      ) : !dados || dados.negocios.length === 0 ? (
        <EmptyState mensagem={`Nenhum negócio fechado em ${MESES[mes - 1]} de ${ano}.`} />
      ) : (
        <>
          <StatGrid>
            <StatCard label="Vendido no mês" value={reais(dados.totais.vendido, { curto: true })} accent="#14b8a6" icon={<Coins size={19} weight="fill" />} />
            <StatCard label="Comissão total" value={reais(dados.totais.comissao, { curto: true })} accent="#d4af37" icon={<Coins size={19} weight="fill" />} />
            <StatCard label="Ficou com a casa" value={reais(dados.totais.imobiliaria, { curto: true })} accent="#6366f1" icon={<Coins size={19} weight="fill" />} />
            <StatCard label="Foi para a equipe" value={reais(dados.totais.corretores, { curto: true })} accent="#10b981" icon={<Coins size={19} weight="fill" />} />
          </StatGrid>

          {/* Por corretor primeiro: é a pergunta que se faz nesta tela. A lista
              de negócios embaixo é a comprovação, e ninguém a lê antes de ver o
              total de cada um. */}
          <div className="glass-panel flow-bloco" style={{ marginBottom: 18 }}>
            <h3>Por corretor</h3>
            <ul className="flow-corretores">
              {dados.porCorretor.map((c) => (
                <li key={c.id || "sem"}>
                  <Avatar name={c.nome} size={32} />
                  <span className="flow-corretores__nome">
                    <strong>{c.nome}</strong>
                    <span>{c.negocios === 1 ? "1 negócio" : `${c.negocios} negócios`} · {reais(c.valor, { curto: true })} vendidos</span>
                  </span>
                  <strong className="flow-corretores__valor">{reais(c.comissao)}</strong>
                </li>
              ))}
            </ul>
          </div>

          <div className="glass-panel" style={{ overflow: "hidden" }}>
            <table className="flow-tabela">
              <thead>
                <tr>
                  <th>Negócio</th><th>Fechado</th><th>Valor</th>
                  <th>Comissão</th><th>Casa</th><th>Corretor</th>
                </tr>
              </thead>
              <tbody>
                {dados.negocios.map((n) => (
                  <tr key={n.id} onClick={() => navigate(`/flow/negocios/${n.id}`)}>
                    <td>
                      <strong>#{n.codigo}</strong>
                      <span className="flow-tabela__sub">{n.property?.title || n.titulo}</span>
                    </td>
                    <td>{dataCurta(n.fechadoEm)}</td>
                    <td>{reais(n.valorFechado)}</td>
                    <td>
                      {reais(n.comissaoTotal)}
                      <span className="flow-tabela__sub">{n.comissaoPercentual}%</span>
                    </td>
                    <td>{reais(n.comissaoImobiliaria)}</td>
                    <td>
                      {reais(n.comissaoCorretor)}
                      <span className="flow-tabela__sub">{n.responsavel?.nome || "—"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
