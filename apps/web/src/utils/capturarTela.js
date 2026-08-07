/* ────────────────────────────────────────────────────────────────────────────
   Print da tela, tirado de dentro da própria página.

   Serve ao botão de Ajuda: em vez de pedir para a pessoa apertar PrtScn, achar
   o arquivo e anexar — três passos em que a maioria desiste —, o chamado já
   nasce com a imagem do que ela está vendo.

   COMO, E POR QUE ASSIM

   `html2canvas` redesenha o DOM num <canvas>. Não é a captura de tela do
   sistema operacional: é uma reconstrução. A alternativa nativa
   (`getDisplayMedia`) devolve pixels de verdade, mas abre o diálogo do
   navegador — "escolha o que compartilhar" — a cada chamado, e aí não é mais
   automático, que é justamente o que se pediu.

   O QUE A RECONSTRUÇÃO NÃO PEGA: conteúdo dentro de <iframe> de outro domínio
   (o campo de cartão do Stripe), <canvas> com WebGL (o fundo animado da
   landing) e imagens de terceiros sem CORS. No painel da imobiliária isso é
   DOM e imagens do Cloudinary — que responde com CORS —, então o resultado
   sai fiel. Ainda assim é aproximação, e o texto da tela diz "print da tela"
   sem prometer perfeição.

   A biblioteca entra por IMPORT DINÂMICO: são ~200 KB que só interessam a quem
   abre um chamado. Carregá-los no bundle principal faria todo mundo pagar por
   um recurso que quase ninguém usa.
   ──────────────────────────────────────────────────────────────────────────── */

/* Elementos que não podem aparecer no print: o próprio modal e o tour.

   NÃO INCLUA <style> NESTA LISTA. Parece higiene — uma tag que não desenha
   nada, por que clonar? —, mas o `html2canvas` monta o clone num iframe e é de
   lá que ele lê o estilo computado de cada nó. Sem as folhas, o clone renderiza
   sem CSS nenhum: o painel inteiro vira uma pilha de caixas brancas no canto.
   E neste projeto a maior parte do CSS mora justamente em <style> dentro dos
   componentes (`AdminLayout`, `TourGuiado`, este modal), além do styles.css que
   o Vite injeta no <head>. Foi exatamente esse o erro da primeira versão. */
function ehSobreposicao(el) {
  // `className` de <svg> é um SVGAnimatedString, não uma string.
  const classe = typeof el?.className === "string" ? el.className : "";
  return (
    el?.dataset?.semPrint === "1" ||
    /\baj-(fundo|palco)\b/.test(classe) ||
    /\btg-(painel|anel|lamina|cartao)\b/.test(classe)
  );
}

/**
 * Captura o que está visível na janela.
 *
 * @returns {Promise<{blob: Blob, dataUrl: string, largura: number, altura: number}|null>}
 *          `null` quando a captura não é possível — nunca lança, porque um
 *          print que falhou não pode impedir alguém de pedir ajuda.
 */
export async function capturarTela() {
  if (typeof window === "undefined" || typeof document === "undefined") return null;

  try {
    const { default: html2canvas } = await import("html2canvas");

    /* Só a dobra visível, não a página inteira: o print existe para mostrar o
       que a pessoa está vendo, e uma listagem de 200 imóveis viraria uma
       imagem de dez mil pixels de altura que ninguém consegue ler. */
    const largura = document.documentElement.clientWidth;
    const altura = document.documentElement.clientHeight;

    const canvas = await html2canvas(document.body, {
      ignoreElements: ehSobreposicao,
      useCORS: true,          // Cloudinary responde com CORS; sem isto, foto vira buraco
      logging: false,
      backgroundColor: "#0a0a0b",
      // Meio-termo de nitidez: em tela retina, `devicePixelRatio` 3 geraria um
      // PNG de vários megabytes para mostrar um botão fora do lugar.
      scale: Math.min(window.devicePixelRatio || 1, 1.5),
      x: window.scrollX,
      y: window.scrollY,
      width: largura,
      height: altura,
      windowWidth: largura,
      windowHeight: altura,
    });

    /* WebP com qualidade alta, não PNG. O PNG sem perdas de uma tela cheia
       passava de 700 KB, e cada chamado carregaria isso para sempre na conta do
       Cloudinary. Em WebP a mesma imagem cai para uma fração disso com o texto
       ainda nítido — e navegador que não conheça o formato devolve PNG sozinho,
       então não há caminho quebrado. */
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.92));
    if (!blob) return null;

    return {
      blob,
      tipo: blob.type,
      dataUrl: canvas.toDataURL("image/webp", 0.92),
      largura: canvas.width,
      altura: canvas.height,
    };
  } catch (erro) {
    console.warn("[ajuda] não consegui capturar a tela:", erro?.message || erro);
    return null;
  }
}

/** O blob virando arquivo, com nome, para o upload no Cloudinary. */
export function printComoArquivo(blob, prefixo = "chamado") {
  const carimbo = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "");
  // A extensão sai do tipo real do blob: o navegador pode ter caído para PNG
  // se não souber gerar WebP, e um arquivo .webp que é PNG confunde o CDN.
  const extensao = (blob.type || "image/png").split("/")[1] || "png";
  return new File([blob], `${prefixo}-${carimbo}.${extensao}`, { type: blob.type });
}
