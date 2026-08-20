import { useState } from "react";
import { ShowcaseTexto, usaFonteReal, useDadosDaVitrine, useFiltroDaVitrine, useVitrine } from "../contexto.jsx";
import { DADOS_BUSCA_PADRAO, lerDadosWidget, montarWhatsappUrl, somenteTexto } from "./widgetData.js";

/* ────────────────────────────────────────────────────────────────────────────
   Busca de imóveis — que agora busca.

   Duas coisas estavam erradas, e a segunda é a grave.

   As OPÇÕES eram fixas no código: "Apartamento, Casa, Terreno, Comercial" e
   "Centro, Jardins, Zona Sul". Uma imobiliária que só trabalha com terreno
   oferecia três tipos que não tem; uma de Curitiba oferecia bairros de São
   Paulo. Agora as listas saem do acervo — os tipos que existem, as cidades e
   bairros onde há imóvel.

   E o BOTÃO não buscava nada. Ele montava uma mensagem de WhatsApp com o que a
   pessoa escolheu e mandava para um corretor fazer a busca à mão. Isso é um
   formulário de contato fantasiado de busca: o visitante escolhe três critérios
   esperando ver imóveis, e recebe um aplicativo de mensagem abrindo.

   Agora ele filtra a grade da própria página, no mesmo instante, sem ida ao
   servidor — a vitrine já carregou o acervo inteiro para desenhá-la. O WhatsApp
   segue disponível como segundo caminho ("não achei o que queria"), que é o
   momento em que falar com alguém é de fato o que ajuda.

   ── ROTULAGEM ──

   "Qualquer" abre cada lista. Sem essa opção, o primeiro item da lista virava
   um filtro que ninguém pediu: quem quisesse só escolher a região saía com um
   tipo de imóvel escolhido por acidente.
   ──────────────────────────────────────────────────────────────────────────── */

const QUALQUER = "";

/* O que o contrato do banco significa para quem lê a vitrine. `VENDA` e
   `LOCACAO` são nomes de enum; ninguém procura casa digitando "LOCACAO". */
const ROTULO_CONTRATO = {
  VENDA: "Comprar",
  LOCACAO: "Alugar",
  PERMUTA: "Permutar",
  BUILT_TO_SUIT: "Built to suit",
};

function opcoesValidas(valor, fallback) {
  return Array.isArray(valor) && valor.filter(Boolean).length ? valor.filter(Boolean) : fallback;
}

export function PropertySearchWidget({ widget }) {
  const { modo } = useVitrine();
  const dados = useDadosDaVitrine();
  const { aplicarFiltro } = useFiltroDaVitrine();

  const filtrosReais = dados?.filtros || null;
  /* A fonte real vale se o acervo oferece ao menos uma lista com conteúdo. Uma
     imobiliária com imóveis sem tipo nem cidade preenchidos não tem o que
     oferecer aqui, e cai no manual. */
  const temReal = Boolean(
    filtrosReais && (filtrosReais.tipos?.length || filtrosReais.cidades?.length || filtrosReais.bairros?.length),
  );
  const real = usaFonteReal(widget, temReal);

  const manual = lerDadosWidget(widget.content, DADOS_BUSCA_PADRAO);
  const subtitulo = manual.subtitulo || DADOS_BUSCA_PADRAO.subtitulo;

  /* As três listas, vindas da fonte que estiver valendo. As regiões juntam
     bairros e cidades numa lista só, pela mesma razão que no serviço: para quem
     procura, as duas são a mesma pergunta. */
  const negocios = real
    ? (filtrosReais.contratos || []).map((c) => ({ valor: c, rotulo: ROTULO_CONTRATO[c] || c }))
    : opcoesValidas(manual.negocios, DADOS_BUSCA_PADRAO.negocios).map((n) => ({ valor: n, rotulo: n }));

  const tipos = real
    ? (filtrosReais.tipos || []).map((t) => ({ valor: t, rotulo: t }))
    : opcoesValidas(manual.tipos, DADOS_BUSCA_PADRAO.tipos).map((t) => ({ valor: t, rotulo: t }));

  const regioes = real
    ? [
        ...(filtrosReais.bairros || []).map((b) => ({ valor: b.nome, rotulo: `${b.nome} · ${b.cidade}` })),
        ...(filtrosReais.cidades || []).map((c) => ({ valor: c, rotulo: c })),
      ]
    : opcoesValidas(manual.localizacoes, DADOS_BUSCA_PADRAO.localizacoes).map((l) => ({ valor: l, rotulo: l }));

  const [negocio, setNegocio] = useState(QUALQUER);
  const [tipo, setTipo] = useState(QUALQUER);
  const [regiao, setRegiao] = useState(QUALQUER);

  function enviar(event) {
    event.preventDefault();
    if (modo === "editor") return;

    if (real) {
      /* Campo vazio sai do objeto: `{ tipo: "" }` seria lido como "filtre por
         tipo nenhum" e não devolveria imóvel algum. Nada escolhido = filtro
         nulo = a grade volta a mostrar tudo. */
      const criterios = {};
      if (negocio) criterios.contrato = negocio;
      if (tipo) criterios.tipo = tipo;
      if (regiao) criterios.regiao = regiao;
      aplicarFiltro(Object.keys(criterios).length ? criterios : null);
      /* Leva o olho até o resultado. Sem isto, quem busca a partir de um widget
         no fim da página clica e não vê nada acontecer — a grade filtrou lá em
         cima, fora da tela. */
      document.getElementById("destaques")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const titulo = somenteTexto(widget.title) || "Busca de imóvel";
    const escolhido = [negocio, tipo, regiao].filter(Boolean).join(" · ") || "sem filtros";
    const mensagem = `Olá! Vim pela vitrine e quero ajuda com esta busca: ${escolhido}. (${titulo})`;
    window.open(montarWhatsappUrl(widget.ctaUrl, mensagem), "_blank", "noopener,noreferrer");
  }

  const campos = [
    { rotulo: "Objetivo", vazio: "Qualquer", opcoes: negocios, valor: negocio, aoTrocar: setNegocio },
    { rotulo: "Tipo", vazio: "Qualquer tipo", opcoes: tipos, valor: tipo, aoTrocar: setTipo },
    { rotulo: "Região", vazio: "Qualquer região", opcoes: regioes, valor: regiao, aoTrocar: setRegiao },
  ];

  return (
    <form className="widget-property-search" onSubmit={enviar}>
      <div className="widget-property-search__head">
        <ShowcaseTexto as="h3" campo={`widget|${widget.id}|title`} html={widget.title} />
        <p>{subtitulo}</p>
      </div>

      <div className="widget-property-search__fields">
        {campos
          /* Lista vazia não vira campo. O acervo pode não ter contrato
             preenchido em imóvel nenhum, e um seletor com só "Qualquer" dentro
             ocupa um terço da largura para não oferecer escolha nenhuma. */
          .filter((campo) => campo.opcoes.length > 0)
          .map((campo) => (
            <label key={campo.rotulo}>
              <span>{campo.rotulo}</span>
              <select value={campo.valor} onChange={(e) => campo.aoTrocar(e.target.value)}>
                <option value={QUALQUER}>{campo.vazio}</option>
                {campo.opcoes.map((opcao) => (
                  <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>
                ))}
              </select>
            </label>
          ))}
      </div>

      <button type="submit" className="widget-property-search__button">
        <ShowcaseTexto as="span" campo={`widget|${widget.id}|ctaLabel`} umaLinha html={widget.ctaLabel || "Encontrar imóveis"} />
      </button>
    </form>
  );
}
