/* ────────────────────────────────────────────────────────────────────────────
   Foto do tamanho em que ela aparece.

   A vitrine pedia toda foto na resolução em que foi guardada — 1600px de
   largura, de 100 a 500 KB cada — para desenhá-la num cartão de 350px no
   celular. Era o maior peso da página com folga: medido no PageSpeed, de 0,8 a
   1,5 MB jogados fora por página, e é o que segurava o LCP em 6–12 s no 4G.

   As duas origens de foto que existem sabem redimensionar pela URL, sem passar
   pelo nosso servidor:

     · Cloudinary (o acervo de verdade): uma transformação logo depois de
       `/image/upload/`. `f_auto` entrega AVIF/WebP a quem aceita, `q_auto`
       escolhe a qualidade, `c_limit` nunca amplia além do original. A conta já
       usa transformação por URL (o logotipo dos e-mails), então não há trava
       de "strict transformations" no caminho.
     · Unsplash (a imobiliária de demonstração e as fotos de banco): o
       parâmetro `w`.

   Qualquer outra origem passa intocada — redimensionar exige que o servidor da
   foto saiba fazê-lo, e trocar a URL de um terceiro só a quebraria.

   ── O QUE NÃO PASSA POR AQUI ──

   A foto 360°: o visualizador projeta a equirretangular inteira numa esfera, e
   a resolução é o que dá nitidez ao girar. E o lightbox, que existe para ver a
   foto grande.
   ──────────────────────────────────────────────────────────────────────────── */

/* Degraus de largura. Poucos de propósito: cada degrau é uma variante que o
   Cloudinary gera e guarda, e o navegador escolhe o menor que cobre o espaço
   vezes a densidade da tela. */
export const LARGURAS = [320, 480, 640, 960, 1280, 1600];

function ehCloudinary(url) {
  return url.includes("res.cloudinary.com/") && url.includes("/image/upload/");
}

function ehUnsplash(url) {
  return url.startsWith("https://images.unsplash.com/");
}

/** A mesma foto, pedida na largura `largura`. Origem desconhecida volta igual. */
export function urlNaLargura(url, largura) {
  if (typeof url !== "string" || !url) return url;
  if (ehCloudinary(url)) {
    /* Encadeada ANTES do que já houver: transformação que a URL já traz (um
       recorte, um selo) continua valendo, e a nossa só decide o tamanho final. */
    return url.replace("/image/upload/", `/image/upload/f_auto,q_auto,c_limit,w_${largura}/`);
  }
  if (ehUnsplash(url)) {
    try {
      const u = new URL(url);
      // Com altura fixa o recorte é de quem montou a URL; mexer só na largura
      // mudaria a proporção.
      if (u.searchParams.has("h")) return url;
      u.searchParams.set("w", String(largura));
      u.searchParams.set("auto", "format");
      return u.toString();
    } catch {
      return url;
    }
  }
  return url;
}

/** Se a origem sabe redimensionar — e portanto se vale escrever `srcset`. */
export function redimensionavel(url) {
  return typeof url === "string" && (ehCloudinary(url) || (ehUnsplash(url) && !/[?&]h=/.test(url)));
}

/* Os atributos de um `<img>` responsivo. `tamanhos` é o `sizes` — quanto da
   tela a foto ocupa —, e é ele que deixa o navegador escolher o degrau certo
   ANTES de o CSS existir. `src` fica no degrau do meio: é o que sobra para quem
   não entende `srcset`. */
export function atributosDaFoto(url, tamanhos, { maxima = 1600 } = {}) {
  if (!redimensionavel(url)) return { src: url };
  const degraus = LARGURAS.filter((l) => l <= maxima);
  return {
    src: urlNaLargura(url, Math.min(960, maxima)),
    srcSet: degraus.map((l) => `${urlNaLargura(url, l)} ${l}w`).join(", "),
    sizes: tamanhos,
  };
}
