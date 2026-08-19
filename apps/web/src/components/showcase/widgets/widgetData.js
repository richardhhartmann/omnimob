export const DADOS_BUSCA_PADRAO = {
  subtitulo: "Conte o que procura e abrimos uma conversa com a equipe já com o seu perfil de busca.",
  negocios: ["Comprar", "Alugar"],
  tipos: ["Apartamento", "Casa", "Terreno", "Comercial"],
  localizacoes: ["Centro", "Jardins", "Zona Sul"],
};

export const DADOS_REGIOES_PADRAO = {
  subtitulo: "Escolha uma região para falar com a equipe sobre as oportunidades disponíveis por lá.",
  regioes: ["Centro", "Jardins", "Moema", "Pinheiros", "Vila Mariana", "Tatuapé"],
};

export const DADOS_FAQ_PADRAO = {
  itens: [
    { pergunta: "Como agendo uma visita?", resposta: "Escolha o imóvel e fale com a equipe. Nós combinamos o melhor dia e horário com você." },
    { pergunta: "Vocês trabalham com financiamento?", resposta: "Sim. A equipe pode orientar a simulação e os próximos passos de acordo com o imóvel escolhido." },
    { pergunta: "Posso anunciar meu imóvel com vocês?", resposta: "Sim. Entre em contato para avaliarmos o imóvel, a documentação e a melhor estratégia de divulgação." },
  ],
};

export const DADOS_PASSOS_PADRAO = {
  subtitulo: "Uma jornada simples, com acompanhamento em cada etapa.",
  itens: [
    { titulo: "Escolha", descricao: "Compare imóveis e encontre os que combinam com o seu momento." },
    { titulo: "Visite", descricao: "Agende uma visita com a equipe e conheça o imóvel de perto." },
    { titulo: "Proponha", descricao: "Negocie valores e condições com apoio do corretor responsável." },
    { titulo: "Conclua", descricao: "Siga com documentação e contrato até a entrega das chaves." },
  ],
};

export const DADOS_EQUIPE_PADRAO = {
  subtitulo: "Especialistas prontos para ajudar você a encontrar o imóvel certo.",
  pessoas: [
    { nome: "Ana Souza", cargo: "Corretora", creci: "CRECI 12345", whatsapp: "", foto: "" },
    { nome: "João Lima", cargo: "Corretor", creci: "CRECI 54321", whatsapp: "", foto: "" },
    { nome: "Marina Alves", cargo: "Especialista em locação", creci: "CRECI 67890", whatsapp: "", foto: "" },
  ],
};

export const DADOS_FINANCIAMENTO_PADRAO = {
  valorImovel: 650000,
  entrada: 130000,
  prazoMeses: 360,
  taxaAnual: 11.5,
  aviso: "Estimativa ilustrativa. Taxas, seguros, CET e condições finais dependem da instituição financeira e da análise de crédito.",
};

export function lerDadosWidget(conteudo, fallback) {
  try {
    const parsed = JSON.parse(String(conteudo || ""));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fallback;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

export function conteudoEhJson(conteudo) {
  try {
    const parsed = JSON.parse(String(conteudo || ""));
    return Boolean(parsed && typeof parsed === "object" && !Array.isArray(parsed));
  } catch {
    return false;
  }
}

export function serializarDadosWidget(dados) {
  return JSON.stringify(dados);
}

export function listaParaTexto(lista) {
  return Array.isArray(lista) ? lista.filter(Boolean).join("\n") : "";
}

export function textoParaLista(texto) {
  return String(texto || "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function itensParaLinhas(itens, campos) {
  if (!Array.isArray(itens)) return "";
  return itens
    .map((item) => campos.map((campo) => String(item?.[campo] ?? "").trim()).join(" :: "))
    .join("\n");
}

export function linhasParaItens(texto, campos) {
  return String(texto || "")
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter(Boolean)
    .map((linha) => {
      const partes = linha.split("::").map((parte) => parte.trim());
      return Object.fromEntries(campos.map((campo, i) => [campo, partes[i] || ""]));
    });
}

export function montarWhatsappUrl(base, mensagem) {
  const bruto = String(base || "").trim() || "https://wa.me/";
  const separador = bruto.includes("?") ? "&" : "?";
  return `${bruto}${separador}text=${encodeURIComponent(mensagem)}`;
}

export function somenteTexto(valor) {
  return String(valor || "").replace(/<[^>]*>/g, "").trim();
}
