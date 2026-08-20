/* ────────────────────────────────────────────────────────────────────────────
   A arte vertical do imóvel, pronta para o status do WhatsApp.

   ── POR QUE ISTO EXISTE, E NÃO UMA PUBLICAÇÃO AUTOMÁTICA ──

   Não há API oficial para status. O WhatsApp Business Cloud API entrega
   MENSAGENS; status é recurso de consumidor, e a Meta nunca expôs endpoint para
   ele. O que existe são pontes não oficiais que dirigem uma sessão do WhatsApp
   Web por fora — funcionam, violam os termos, e põem em risco de banimento o
   número que costuma ser o principal canal de vendas da imobiliária.

   Então o caminho padrão é este: montamos a peça pronta e o compartilhamento do
   celular entrega ao WhatsApp, onde a pessoa escolhe "Status". Um toque humano
   por post, e nenhum risco.

   ── POR QUE NO NAVEGADOR ──

   Mesma escolha da marca d'água (`utils/marcaDagua.js`): o canvas já está na
   máquina de quem clicou, as fotos já estão carregadas na tela, e gerar no
   servidor exigiria uma biblioteca de imagem, CPU do Render e uma viagem de ida
   e volta com alguns megabytes.

   ── AS MEDIDAS ──

   1080×1920 é o que o WhatsApp usa para status. Enviar quadrado faz o app
   preencher o resto com um borrão da própria imagem, e o resultado é um post
   com tarjas — o que denuncia que a peça não foi feita para ali.
   ──────────────────────────────────────────────────────────────────────────── */

const LARGURA = 1080;
const ALTURA = 1920;

/* A faixa escura embaixo. Não é decoração: o texto branco tem de ser legível
   sobre QUALQUER foto, e foto de imóvel tem muita parede clara e muito céu.
   Um gradiente resolve isso sem escurecer a imagem inteira. */
const ALTURA_DO_VEU = 0.52;

function carregarImagem(src, { cors = false } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    /* Sem isto o canvas fica "contaminado" pela foto de outro domínio e o
       `toBlob` lança SecurityError. Com o atributo, o pedido sai como CORS e o
       canvas continua limpo — o Cloudinary responde com o cabeçalho. */
    if (cors) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível carregar a imagem."));
    img.src = src;
  });
}

/* Desenha a foto cobrindo o quadro inteiro, sem deformar. `cover`, não
   `contain`: uma foto de imóvel esticada para caber num formato vertical fica
   com pessoas e móveis alongados, e todo mundo percebe sem saber o que é. */
function desenharCobrindo(ctx, img, largura, altura) {
  const escala = Math.max(largura / img.naturalWidth, altura / img.naturalHeight);
  const w = img.naturalWidth * escala;
  const h = img.naturalHeight * escala;
  /* Ancorado no TERÇO SUPERIOR e não no centro: em foto de imóvel o que
     interessa (fachada, sala, vista) fica na metade de cima, e o corte central
     costuma comer o teto para sobrar chão. */
  ctx.drawImage(img, (largura - w) / 2, (altura - h) * 0.33, w, h);
}

/** Quebra o texto em linhas que cabem na largura, no máximo `maxLinhas`. */
function quebrar(ctx, texto, largura, maxLinhas) {
  const palavras = String(texto || "").split(/\s+/).filter(Boolean);
  const linhas = [];
  let atual = "";
  for (const palavra of palavras) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (ctx.measureText(tentativa).width <= largura || !atual) {
      atual = tentativa;
    } else {
      linhas.push(atual);
      atual = palavra;
      if (linhas.length === maxLinhas) break;
    }
  }
  if (linhas.length < maxLinhas && atual) linhas.push(atual);
  /* Reticências na última linha quando sobrou texto. Cortar no meio de uma
     palavra sem marca faz o título parecer que simplesmente acabou. */
  if (linhas.length === maxLinhas) {
    const resto = palavras.join(" ");
    const mostrado = linhas.join(" ");
    if (resto.length > mostrado.length) {
      let ultima = linhas[maxLinhas - 1];
      while (ultima && ctx.measureText(`${ultima}…`).width > largura) ultima = ultima.slice(0, -1);
      linhas[maxLinhas - 1] = `${ultima}…`;
    }
  }
  return linhas;
}

function formatarPreco(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return "";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

/** Pílula com cantos arredondados. `roundRect` não existe em Safari antigo. */
function pilula(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
  }
  ctx.closePath();
}

/**
 * Monta a arte e devolve um `File` PNG de 1080×1920.
 *
 * @param {object} imovel  { title, price, bedrooms, parkingSpots, areaPrivativa|squareFootage, neighborhood, city, state }
 * @param {object} opcoes  { fotoUrl, logoUrl, corPrimaria, nomeDaImobiliaria, enderecoDaVitrine }
 */
export async function gerarArteDeStatus(imovel, opcoes = {}) {
  const { fotoUrl, logoUrl, corPrimaria = "#6366f1", nomeDaImobiliaria = "", enderecoDaVitrine = "" } = opcoes;

  const canvas = document.createElement("canvas");
  canvas.width = LARGURA;
  canvas.height = ALTURA;
  const ctx = canvas.getContext("2d");

  // Fundo sólido primeiro: sem foto, a peça continua existindo.
  ctx.fillStyle = "#0d0d12";
  ctx.fillRect(0, 0, LARGURA, ALTURA);

  if (fotoUrl) {
    try {
      desenharCobrindo(ctx, await carregarImagem(fotoUrl, { cors: true }), LARGURA, ALTURA);
    } catch {
      /* Foto que não carrega não impede a peça. O resultado é um cartão escuro
         com o texto — pior, e infinitamente melhor que um erro na cara de quem
         só queria publicar. */
    }
  }

  // Véu de baixo para cima, para o texto ter contraste sobre qualquer foto.
  const veu = ctx.createLinearGradient(0, ALTURA * (1 - ALTURA_DO_VEU), 0, ALTURA);
  veu.addColorStop(0, "rgba(0,0,0,0)");
  veu.addColorStop(0.45, "rgba(0,0,0,0.72)");
  veu.addColorStop(1, "rgba(0,0,0,0.94)");
  ctx.fillStyle = veu;
  ctx.fillRect(0, ALTURA * (1 - ALTURA_DO_VEU), LARGURA, ALTURA * ALTURA_DO_VEU);

  // Véu curto no topo, para a logo não sumir sobre céu claro.
  const veuTopo = ctx.createLinearGradient(0, 0, 0, 320);
  veuTopo.addColorStop(0, "rgba(0,0,0,0.55)");
  veuTopo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = veuTopo;
  ctx.fillRect(0, 0, LARGURA, 320);

  const margem = 80;
  const larguraUtil = LARGURA - margem * 2;

  // ── Topo: logo ou nome da imobiliária ──
  if (logoUrl) {
    try {
      const logo = await carregarImagem(logoUrl, { cors: true });
      const alturaLogo = 96;
      const fator = alturaLogo / logo.naturalHeight;
      ctx.drawImage(logo, margem, 72, logo.naturalWidth * fator, alturaLogo);
    } catch { /* sem logo, cai no nome abaixo */ }
  }
  if (!logoUrl && nomeDaImobiliaria) {
    ctx.font = "700 42px 'Plus Jakarta Sans', system-ui, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "top";
    ctx.fillText(nomeDaImobiliaria, margem, 84);
  }

  // ── Base: preço, título, ficha, endereço ──
  let y = ALTURA - 150;
  ctx.textBaseline = "alphabetic";

  if (enderecoDaVitrine) {
    ctx.font = "500 30px 'Plus Jakarta Sans', system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.fillText(enderecoDaVitrine, margem, y);
    y -= 62;
  }

  const local = [imovel.neighborhood, imovel.city, imovel.state].filter(Boolean).join(" · ");
  if (local) {
    ctx.font = "500 34px 'Plus Jakarta Sans', system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.86)";
    ctx.fillText(local, margem, y);
    y -= 66;
  }

  /* Ficha em pílulas. Só o que tem valor — um "0 quartos" numa peça de venda é
     pior que a ausência do dado, e terreno não tem quarto nenhum. */
  const area = Number(imovel.areaPrivativa) || Number(imovel.squareFootage) || 0;
  const fichas = [
    imovel.bedrooms > 0 ? `${imovel.bedrooms} ${imovel.bedrooms === 1 ? "quarto" : "quartos"}` : null,
    imovel.parkingSpots > 0 ? `${imovel.parkingSpots} ${imovel.parkingSpots === 1 ? "vaga" : "vagas"}` : null,
    area > 0 ? `${Math.round(area)} m²` : null,
  ].filter(Boolean);

  if (fichas.length) {
    ctx.font = "600 32px 'Plus Jakarta Sans', system-ui, sans-serif";
    let x = margem;
    const alturaPilula = 62;
    for (const ficha of fichas) {
      const largura = ctx.measureText(ficha).width + 52;
      if (x + largura > LARGURA - margem) break;
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      pilula(ctx, x, y - alturaPilula + 16, largura, alturaPilula, 31);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillText(ficha, x + 26, y);
      x += largura + 16;
    }
    y -= 96;
  }

  // Título — o que a pessoa lê primeiro depois do preço.
  ctx.font = "700 54px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.fillStyle = "#ffffff";
  const linhas = quebrar(ctx, imovel.title, larguraUtil, 2);
  for (let i = linhas.length - 1; i >= 0; i -= 1) {
    ctx.fillText(linhas[i], margem, y);
    y -= 66;
  }
  y -= 14;

  // Preço, na cor da imobiliária. É o maior elemento da peça de propósito: é a
  // informação que decide se a pessoa para de rolar.
  const preco = formatarPreco(imovel.price);
  if (preco) {
    ctx.font = "800 78px 'Plus Jakarta Sans', system-ui, sans-serif";
    ctx.fillStyle = corPrimaria;
    ctx.fillText(preco, margem, y);
  }

  const blob = await new Promise((resolve, reject) => {
    try {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas não devolveu a imagem."))), "image/png");
    } catch (erro) {
      // Canvas contaminado: alguma imagem veio de domínio sem CORS.
      reject(erro);
    }
  });

  /* `\p{M}` são as marcas combinantes — o acento que o `NFD` separou da letra.
     Escrito assim e não como faixa de códigos: a faixa exige dois caracteres
     invisíveis no fonte, que qualquer ferramenta de normalização de arquivo
     pode comer sem ninguém notar até um nome de arquivo sair torto. */
  const nome = `${String(imovel.title || "imovel")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\w]+/g, "-")
    .slice(0, 40)}-status.png`;
  return new File([blob], nome, { type: "image/png", lastModified: Date.now() });
}
