// Transforma uma foto equiretangular (360°) do Cloudinary numa "capa" para as redes:
// enquadra em quadrado (seguro no Instagram, não corta), borra e escurece a imagem
// toda e escreve o texto centralizado por cima — convidando a acessar o site para o
// tour interativo. URLs que não são do Cloudinary (/upload/) voltam sem alteração.

const TEXTO_360 = "IMAGEM 360° - acesse nosso site para o tour completo";

export function overlay360(url) {
  if (typeof url !== "string" || !url.includes("res.cloudinary.com/") || !url.includes("/upload/")) {
    return url;
  }
  const texto = encodeURIComponent(TEXTO_360);
  const transform = [
    "c_fill,w_1080,h_1080",  // quadrado 1080 (mesma proporção em todas as redes)
    "e_blur:900",             // borra a imagem toda
    "e_brightness:-32",       // escurece para o texto branco contrastar
    // texto branco, em negrito, centralizado e quebrando linha dentro de 840px
    `l_text:Arial_52_bold:${texto},co_white,c_fit,w_840,g_center`,
  ].join("/");
  return url.replace("/upload/", `/upload/${transform}/`);
}
