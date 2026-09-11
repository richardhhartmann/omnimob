import { useEffect, useMemo, useState } from "react";
import { ShowcaseTexto, useVitrine } from "../contexto.jsx";
import { DADOS_FINANCIAMENTO_PADRAO, lerDadosWidget } from "./widgetData.js";
import { TituloDoWidget } from "../TituloDoWidget.jsx";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/* Aceita "11,5", " 11.5 " e "<b>11,5</b>".
   A taxa passou a ser texto editável na peça, e o que volta de um
   `contentEditable` é HTML com vírgula decimal — `Number("11,5")` é `NaN`, e
   sem esta limpeza a taxa voltaria para o padrão a cada edição. */
function numero(valor, fallback) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : fallback;
  const limpo = String(valor ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s/g, "")
    .replace(",", ".");
  const n = Number(limpo);
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
  const { modo, aoEditar } = useVitrine();
  const ehEditor = modo === "editor" && Boolean(aoEditar);
  const dados = lerDadosWidget(widget.content, DADOS_FINANCIAMENTO_PADRAO);

  /* ── NO EDITOR, MEXER NOS CAMPOS DEFINE O PADRÃO ──────────────────────────
     Estes três campos são a simulação que o VISITANTE faz. No editor eles são
     os mesmos campos — e o que se está escolhendo ali é com que números a peça
     nasce para quem chega na página.

     Era isso que a seção "Simulação padrão" do inspetor fazia: quatro caixas
     de número duplicando, noutra tela, exatamente os controles que já estavam
     na peça. Agora se ajusta olhando o resultado, que é o ponto de um
     simulador. */
  const gravarPadrao = (campo, valorNovo) => {
    if (!ehEditor) return;
    aoEditar(`widget|${widget.id}|dados|${campo}`, valorNovo);
  };
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
      <TituloDoWidget widget={widget} />
      <div className="widget-finance__fields">
        <label>
          <span>Valor do imóvel</span>
          <input
            type="number" min="0" step="10000" value={valor}
            onChange={(e) => setValor(Math.max(0, Number(e.target.value) || 0))}
            /* Grava no BLUR, não a cada tecla: digitar "650000" passaria por
               "6", "65", "650"… e cada um viraria uma entrada no histórico do
               editor. */
            onBlur={() => gravarPadrao("valorImovel", valor)}
          />
        </label>
        <label>
          <span>Entrada</span>
          <input
            type="number" min="0" step="5000" value={entrada}
            onChange={(e) => setEntrada(Math.max(0, Number(e.target.value) || 0))}
            onBlur={() => gravarPadrao("entrada", entrada)}
          />
        </label>
        <label>
          <span>Prazo</span>
          <select
            value={prazo}
            onChange={(e) => {
              const novo = Number(e.target.value);
              setPrazo(novo);
              // Escolha de lista é decisão fechada: grava na hora.
              gravarPadrao("prazoMeses", novo);
            }}
          >
            {[120, 180, 240, 300, 360, 420].map((meses) => <option key={meses} value={meses}>{meses} meses</option>)}
          </select>
        </label>
      </div>
      <div className="widget-finance__result">
        <span>Financiamento aproximado</span>
        <strong>{moeda.format(financiado)}</strong>
        <span>Parcela estimada</span>
        <strong className="is-accent">{moeda.format(parcela)}<small>/mês</small></strong>
        <em>
          Taxa usada na estimativa:{" "}
          {/* A taxa é do CLIENTE, não do visitante — por isso ela não é um
              campo do simulador, e sim texto editável na peça, como o resto do
              conteúdo. */}
          <ShowcaseTexto
            as="span"
            umaLinha
            campo={`widget|${widget.id}|dados|taxaAnual`}
            html={String(taxa.toLocaleString("pt-BR", { maximumFractionDigits: 2 }))}
          />% a.a.
        </em>
      </div>
      <ShowcaseTexto
        as="p"
        className="widget-finance__notice"
        campo={`widget|${widget.id}|dados|aviso`}
        html={dados.aviso || DADOS_FINANCIAMENTO_PADRAO.aviso}
      />
    </div>
  );
}
