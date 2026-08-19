import { useEffect, useMemo, useState } from "react";
import { ShowcaseTexto } from "../contexto.jsx";
import { DADOS_FINANCIAMENTO_PADRAO, lerDadosWidget } from "./widgetData.js";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function numero(valor, fallback) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : fallback;
}

function calcularParcela(valorImovel, entrada, prazoMeses, taxaAnual) {
  const principal = Math.max(0, valorImovel - entrada);
  const meses = Math.max(1, prazoMeses);
  const taxaMensal = Math.pow(1 + Math.max(0, taxaAnual) / 100, 1 / 12) - 1;
  if (principal <= 0) return 0;
  if (taxaMensal <= 0) return principal / meses;
  const fator = Math.pow(1 + taxaMensal, meses);
  return principal * (taxaMensal * fator) / (fator - 1);
}

export function FinanceWidget({ widget }) {
  const dados = lerDadosWidget(widget.content, DADOS_FINANCIAMENTO_PADRAO);
  const [valor, setValor] = useState(() => numero(dados.valorImovel, DADOS_FINANCIAMENTO_PADRAO.valorImovel));
  const [entrada, setEntrada] = useState(() => numero(dados.entrada, DADOS_FINANCIAMENTO_PADRAO.entrada));
  const [prazo, setPrazo] = useState(() => numero(dados.prazoMeses, DADOS_FINANCIAMENTO_PADRAO.prazoMeses));

  useEffect(() => {
    setValor(numero(dados.valorImovel, DADOS_FINANCIAMENTO_PADRAO.valorImovel));
    setEntrada(numero(dados.entrada, DADOS_FINANCIAMENTO_PADRAO.entrada));
    setPrazo(numero(dados.prazoMeses, DADOS_FINANCIAMENTO_PADRAO.prazoMeses));
  }, [widget.content]);

  const taxa = numero(dados.taxaAnual, DADOS_FINANCIAMENTO_PADRAO.taxaAnual);
  const parcela = useMemo(() => calcularParcela(valor, entrada, prazo, taxa), [valor, entrada, prazo, taxa]);
  const financiado = Math.max(0, valor - entrada);

  return (
    <div className="widget-finance">
      <ShowcaseTexto as="h3" campo={`widget|${widget.id}|title`} html={widget.title} />
      <div className="widget-finance__fields">
        <label>
          <span>Valor do imóvel</span>
          <input type="number" min="0" step="10000" value={valor} onChange={(e) => setValor(Math.max(0, Number(e.target.value) || 0))} />
        </label>
        <label>
          <span>Entrada</span>
          <input type="number" min="0" step="5000" value={entrada} onChange={(e) => setEntrada(Math.max(0, Number(e.target.value) || 0))} />
        </label>
        <label>
          <span>Prazo</span>
          <select value={prazo} onChange={(e) => setPrazo(Number(e.target.value))}>
            {[120, 180, 240, 300, 360, 420].map((meses) => <option key={meses} value={meses}>{meses} meses</option>)}
          </select>
        </label>
      </div>
      <div className="widget-finance__result">
        <span>Financiamento aproximado</span>
        <strong>{moeda.format(financiado)}</strong>
        <span>Parcela estimada</span>
        <strong className="is-accent">{moeda.format(parcela)}<small>/mês</small></strong>
        <em>Taxa usada na estimativa: {taxa.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% a.a.</em>
      </div>
      <p className="widget-finance__notice">{dados.aviso || DADOS_FINANCIAMENTO_PADRAO.aviso}</p>
    </div>
  );
}
