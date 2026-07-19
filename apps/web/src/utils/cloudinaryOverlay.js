// Transforma uma foto equiretangular (360°) do Cloudinary numa "capa" para as redes:
// enquadra em quadrado (seguro no Instagram, não corta), borra e escurece a imagem
// toda e escreve o texto centralizado por cima. Espelha
// apps/api/src/utils/cloudinaryOverlay.js para o preview bater com o post real.

const TEXTO_360 = "IMAGEM 360° - acesse nosso site para o tour completo";

export function overlay360(url) {
  if (typeof url !== "string" || !url.includes("res.cloudinary.com/") || !url.includes("/upload/")) {
    return url;
  }
  const texto = encodeURIComponent(TEXTO_360);
  const transform = [
    "c_fill,w_1080,h_1080",
    "e_blur:900",
    "e_brightness:-32",
    `l_text:Arial_52_bold:${texto},co_white,c_fit,w_840,g_center`,
  ].join("/");
  return url.replace("/upload/", `/upload/${transform}/`);
}
