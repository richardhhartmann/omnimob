import { useState } from "react";
import { ShowcaseTexto, useVitrine } from "../contexto.jsx";
import { DADOS_BUSCA_PADRAO, lerDadosWidget, montarWhatsappUrl, somenteTexto } from "./widgetData.js";

function opcoesValidas(valor, fallback) {
  return Array.isArray(valor) && valor.filter(Boolean).length ? valor.filter(Boolean) : fallback;
}

export function PropertySearchWidget({ widget }) {
  const { modo } = useVitrine();
  const dados = lerDadosWidget(widget.content, DADOS_BUSCA_PADRAO);
  const negocios = opcoesValidas(dados.negocios, DADOS_BUSCA_PADRAO.negocios);
  const tipos = opcoesValidas(dados.tipos, DADOS_BUSCA_PADRAO.tipos);
  const localizacoes = opcoesValidas(dados.localizacoes, DADOS_BUSCA_PADRAO.localizacoes);

  const [negocio, setNegocio] = useState("");
  const [tipo, setTipo] = useState("");
  const [localizacao, setLocalizacao] = useState("");

  const negocioAtual = negocios.includes(negocio) ? negocio : negocios[0] || "";
  const tipoAtual = tipos.includes(tipo) ? tipo : tipos[0] || "";
  const localizacaoAtual = localizacoes.includes(localizacao) ? localizacao : localizacoes[0] || "";

  function enviar(event) {
    event.preventDefault();
    if (modo === "editor") return;
    const titulo = somenteTexto(widget.title) || "Busca de imóvel";
    const mensagem = `Olá! Vim pela vitrine e quero ajuda com esta busca: ${negocioAtual} · ${tipoAtual} · ${localizacaoAtual}. (${titulo})`;
    window.open(montarWhatsappUrl(widget.ctaUrl, mensagem), "_blank", "noopener,noreferrer");
  }

  return (
    <form className="widget-property-search" onSubmit={enviar}>
      <div className="widget-property-search__head">
        <ShowcaseTexto as="h3" campo={`widget|${widget.id}|title`} html={widget.title} />
        <p>{dados.subtitulo || DADOS_BUSCA_PADRAO.subtitulo}</p>
      </div>

      <div className="widget-property-search__fields">
        <label>
          <span>Objetivo</span>
          <select value={negocioAtual} onChange={(e) => setNegocio(e.target.value)}>
            {negocios.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span>Tipo</span>
          <select value={tipoAtual} onChange={(e) => setTipo(e.target.value)}>
            {tipos.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span>Região</span>
          <select value={localizacaoAtual} onChange={(e) => setLocalizacao(e.target.value)}>
            {localizacoes.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      </div>

      <button type="submit" className="widget-property-search__button">
        <ShowcaseTexto as="span" campo={`widget|${widget.id}|ctaLabel`} umaLinha html={widget.ctaLabel || "Encontrar imóveis"} />
      </button>
    </form>
  );
}
