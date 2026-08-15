/* ────────────────────────────────────────────────────────────────────────────
   Marca d'água da imobiliária, gravada NA FOTO.

   A logo é composta sobre a imagem antes do upload, e o que sobe para o
   Cloudinary já é o arquivo final. Isso não é detalhe de implementação — é o
   que faz a marca valer em todo lugar de uma vez: a vitrine, a página do
   imóvel, a prévia de link do WhatsApp e a publicação no Facebook e no
   Instagram leem todos a MESMA `img.url` guardada no banco (ver
   `socialRoutes.js`). Uma imagem, uma marca.

   O caminho alternativo seria uma transformação de entrega do Cloudinary
   (`l_logo,o_55`), que não reprocessa nada. Foi descartado por dois motivos: a
   logo precisaria estar no mesmo cloud com um `public_id` conhecido — e ela
   pode ser uma URL externa qualquer —, e a marca deixaria de existir no
   arquivo, valendo só enquanto a URL carregasse a transformação. Quem baixasse
   a foto pelo botão do navegador levaria a original limpa.

   ── O QUE NÃO RECEBE MARCA ──

   Fotos equirretangulares (360°). Elas são projetadas numa esfera pelo
   visualizador: uma logo colada no meio do retângulo vira uma mancha esticada
   no horizonte, e nas bordas ela apareceria cortada em duas metades.
   ──────────────────────────────────────────────────────────────────────────── */

/* Opacidade da marca. O pedido era entre 50% e 60%; 55% fica no meio — visível
   o bastante para desencorajar o reuso da foto e leve o bastante para não
   disputar atenção com o imóvel, que é o que a pessoa veio ver. */
const OPACIDADE = 0.55;

/* Quanto da foto a marca ocupa, em cada eixo.

   Os dois eixos são medidos separadamente — largura da marca contra largura da
   foto, altura contra altura — e vence a restrição mais apertada. Encaixar numa
   caixa QUADRADA parece equivalente e não é: logo de imobiliária costuma ser
   larga (marca escrita ao lado do símbolo), e a caixa quadrada fazia a largura
   mandar sozinha, entregando uma marca de altura ridícula no meio da foto.
   Medido: uma logo 420×160 numa foto 900×600 saía com 180px de largura, 20% da
   foto; agora sai com 288px, e a marca finalmente se lê. */
const PROPORCAO = 0.32;

/* Teto de pixels do canvas.

   Safari no iPhone recusa canvas acima de ~16,7 milhões de pixels e devolve uma
   imagem em branco — sem erro, sem aviso. Uma foto de 6000×4000 (24 MP, comum
   em câmera de corretor) cairia exatamente aí. Acima do teto a composição é
   feita numa escala menor; a diferença é imperceptível numa foto de anúncio, e
   o Cloudinary redimensiona na entrega de qualquer forma. */
const MAX_PIXELS = 16_000_000;

function carregarImagem(src, { cors = false } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    /* Sem isto o canvas fica "contaminado" pela logo de outro domínio e o
       `toBlob` lança SecurityError — o navegador impede que uma página leia
       pixels de terceiros. Com o atributo, o pedido sai como CORS e o canvas
       continua limpo, desde que o servidor da logo responda com o cabeçalho
       (o Cloudinary responde). */
    if (cors) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível carregar a imagem."));
    img.src = src;
  });
}

/**
 * Devolve um `File` novo, igual ao original mas com a logo composta no centro.
 * Lança se algo der errado — quem chama decide o que fazer (ver `comMarcaDagua`).
 */
export async function aplicarMarcaDagua(arquivo, logoUrl) {
  const enderecoDaFoto = URL.createObjectURL(arquivo);
  try {
    const [foto, logo] = await Promise.all([
      carregarImagem(enderecoDaFoto),
      carregarImagem(logoUrl, { cors: true }),
    ]);

    const escalaDoCanvas = Math.min(1, Math.sqrt(MAX_PIXELS / (foto.naturalWidth * foto.naturalHeight)));
    const largura = Math.round(foto.naturalWidth * escalaDoCanvas);
    const altura = Math.round(foto.naturalHeight * escalaDoCanvas);

    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(foto, 0, 0, largura, altura);

    // Cabe na largura E na altura permitidas, mantendo a própria proporção.
    const fator = Math.min(
      (largura * PROPORCAO) / logo.naturalWidth,
      (altura * PROPORCAO) / logo.naturalHeight
    );
    const lw = logo.naturalWidth * fator;
    const lh = logo.naturalHeight * fator;
    const caixa = Math.max(lw, lh);

    ctx.globalAlpha = OPACIDADE;
    /* Sombra fraca por baixo. Uma logo clara sobre uma parede branca — sala
       vazia, fachada ao sol — simplesmente desaparece; o halo escuro dá o
       contorno mínimo para ela existir em qualquer foto, sem virar contorno
       visível nas escuras. */
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = Math.max(2, Math.round(caixa * 0.045));
    ctx.shadowOffsetY = Math.max(1, Math.round(caixa * 0.008));
    // 50% na horizontal e 50% na vertical: o centro exato da foto.
    ctx.drawImage(logo, (largura - lw) / 2, (altura - lh) / 2, lw, lh);

    const tipo = arquivo.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise((resolve, reject) => {
      try {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Canvas não devolveu a imagem."))),
          tipo,
          0.92
        );
      } catch (erro) {
        // Canvas contaminado: a logo veio de um domínio sem CORS.
        reject(erro);
      }
    });

    return new File([blob], arquivo.name, { type: tipo, lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(enderecoDaFoto);
  }
}

/**
 * A versão que o cadastro usa: nunca lança e nunca segura o envio.
 *
 * Uma logo que não carrega, um domínio sem CORS ou um navegador antigo não
 * podem impedir alguém de publicar um imóvel — a foto sobe sem marca e a vida
 * segue. Perder a marca d'água é um arranhão; perder o cadastro é o trabalho da
 * pessoa.
 */
export async function comMarcaDagua(arquivo, logoUrl, { ehPanoramica = false } = {}) {
  if (!logoUrl || !arquivo || ehPanoramica) return arquivo;
  if (typeof document === "undefined") return arquivo;
  try {
    return await aplicarMarcaDagua(arquivo, logoUrl);
  } catch {
    return arquivo;
  }
}
