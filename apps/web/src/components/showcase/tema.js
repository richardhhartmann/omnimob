/* ────────────────────────────────────────────────────────────────────────────
   Tema e viewport da vitrine — uma regra só, para as duas telas.

   As variáveis CSS que pintam a vitrine (`--accent`, fonte, secundária) eram
   montadas em três lugares: no editor, na página pública e na página de imóvel.
   Três cópias da mesma expressão é como se nasce uma divergência: alguém troca
   o fallback num arquivo e os outros dois continuam com o antigo.
   ──────────────────────────────────────────────────────────────────────────── */

/** Abaixo disto a vitrine usa o layout mobile. Editor e público usam o MESMO número. */
export const BREAKPOINT_MOBILE = 768;

/**
 * Largura de referência do preview mobile no editor.
 *
 * O visitante pode chegar em 360, 390, 412 ou 767px, e a página não pode
 * depender de um número exato — `x` e `w` são percentuais e escalam sozinhos,
 * `y` e `h` são corrigidos pela medição de conteúdo nos dois lados. Os 430px
 * são o ponto médio dos aparelhos atuais: o preview é fiel na proporção, e a
 * altura se ajusta sozinha na largura real.
 */
export const LARGURA_MOBILE_REFERENCIA = 430;

/**
 * Largura da prancheta desktop no editor.
 *
 * É uma folha de largura FIXA, como o quadro de uma ferramenta de design — e
 * não a largura da janela do editor. Deixá-la elástica fazia a pessoa montar a
 * página numa coluna de 900px, num notebook, e publicar numa de 1400: os
 * cartões de imóvel mudavam de quantidade por linha entre o que ela via e o que
 * saía no ar. Com largura fixa, o zoom cuida de caber na tela e o que se vê é o
 * que o visitante recebe.
 */
export const LARGURA_DESKTOP_REFERENCIA = 1280;

export function modoDoViewport(larguraDaJanela) {
  return larguraDaJanela < BREAKPOINT_MOBILE ? "mobile" : "desktop";
}

/**
 * As variáveis CSS do tema da imobiliária. Vale para a vitrine, para a página
 * de imóvel e para a prancheta do editor.
 */
export function estiloDoTema(tenant, config) {
  const fonte = config?.globalFont || "Inter";
  const familia = `'${fonte}', system-ui, sans-serif`;
  const { primaria, secundaria } = coresDaVitrine(tenant, config);
  return {
    "--accent": primaria,
    "--accent-hover": primaria,
    "--tenant-secondary": secundaria,
    "--showcase-font": familia,
    fontFamily: familia,
  };
}

/* ── De onde vêm as cores da vitrine ─────────────────────────────────────────
   Herdadas do painel, ou próprias. A escolha vive no `showcaseConfig` porque é
   uma decisão sobre a VITRINE — quem a toma é quem desenha a página, no editor
   dela, e não quem configura a ferramenta de trabalho da equipe.

   Herdar é o padrão por compatibilidade: até esta separação existir, a vitrine
   sempre usou `tenant.primaryColor`, e mudar isso repintaria a página publicada
   de todo mundo num deploy.

   Quando a herança está desligada mas a cor própria está vazia, caímos no
   painel de novo. É o desfecho seguro: uma vitrine sem cor de acento nenhuma
   ficaria com botões cinzentos, e ninguém pediu isso. */
export function coresDaVitrine(tenant, config) {
  const doPainel = {
    primaria: tenant?.primaryColor || "#818cf8",
    secundaria: tenant?.secondaryColor || "#d4af37",
  };
  if (config?.herdarCoresDoPainel === false) {
    return {
      primaria: config.corPrimaria || doPainel.primaria,
      secundaria: config.corSecundaria || doPainel.secundaria,
    };
  }
  return doPainel;
}

/**
 * O modo claro/escuro da vitrine, já resolvida a herança do painel.
 * @param {object} config  o `showcaseConfig`
 * @param {"claro"|"escuro"} temaDoPainel  o tema EFETIVO do painel
 */
export function aparenciaDaVitrine(config, temaDoPainel) {
  if (config?.herdarTemaDoPainel === true) {
    return temaDoPainel === "claro" ? "light" : "dark";
  }
  return config?.appearanceMode === "light" ? "light" : "dark";
}

/**
 * O endereço do WhatsApp da imobiliária, com a mensagem pronta.
 *
 * Estava escrito duas vezes, e a diferença era visível: uma delas montava a
 * mensagem sem acentos ("Ola, tenho interesse nos imoveis da…"). Como o texto
 * vai para a conversa do cliente, é a marca da imobiliária que aparecia
 * errada — em metade dos lugares.
 */
export function linkWhatsApp(tenant) {
  if (!tenant?.whatsapp) return null;
  const numero = String(tenant.whatsapp).replace(/\D/g, "");
  if (!numero) return null;
  const nome = tenant.name || "imobiliária";
  return `https://wa.me/${numero}?text=${encodeURIComponent(`Olá, tenho interesse nos imóveis da ${nome}.`)}`;
}

/* Classe do modo claro/escuro, para não repetir o ternário em cada página.

   `temaDoPainel` só é passado pelo EDITOR e pela vitrine dentro do painel: a
   página pública não sabe nem deve saber que existe um painel, e quem a abre
   não tem tema de painel nenhum. Ausente, vale o `appearanceMode` gravado — que
   é o que a herança já resolveu no momento de salvar. */
export function classeDeAparencia(config, temaDoPainel) {
  return aparenciaDaVitrine(config, temaDoPainel) === "light" ? "showcase-theme-light" : "";
}

/* Textos de fallback quando a imobiliária ainda não escreveu os dela.

   Estavam duplicados — e divergiam: o editor mostrava "imóvel" com acento e a
   página pública "imovel" sem. A pessoa escrevia por cima no editor e nunca
   percebia; quem não escrevia publicava um texto diferente do que viu. */
export const TEXTO_PADRAO = {
  headline: "Encontre o imóvel ideal para seu próximo passo",
  subheadline:
    "Compare opções, visualize fotos detalhadas, conheça a localização e entre em contato com a imobiliária com um clique.",
  descricao: "Encontre seu próximo imóvel com segurança e transparência.",
};
