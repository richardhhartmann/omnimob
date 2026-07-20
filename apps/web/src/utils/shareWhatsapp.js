// Compartilhamento no WhatsApp.
//
// Sempre que o navegador suporta, usa a Web Share API (navigator.share): o texto
// é entregue direto ao app, sem o round-trip de URL do wa.me — que corrompe
// emojis (viram "�") no WhatsApp Desktop — e ainda permite ANEXAR as fotos do
// imóvel (que o link wa.me/?text= não carrega, pois só aceita texto).
//
// Fallback: quando não há Web Share API (ex.: alguns navegadores desktop),
// abre o link wa.me só com o texto, já percent-encodado corretamente.
//
// Obs.: com VÁRIAS imagens, o WhatsApp costuma enviar o texto como uma mensagem
// separada (antes/depois do álbum) — isso é comportamento do próprio WhatsApp e
// não é controlável pela Web Share API.
const MAX_IMAGENS = 10; // limite defensivo para não estourar a partilha

export async function shareWhatsapp({ text, imageUrls = [], title }) {
  const podeCompartilhar = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const urls = (Array.isArray(imageUrls) ? imageUrls : [imageUrls]).filter(Boolean).slice(0, MAX_IMAGENS);

  // 1) Web Share API com todas as fotos anexadas (nível 2).
  if (podeCompartilhar && urls.length > 0) {
    try {
      const baixadas = await Promise.all(urls.map((u, i) => urlParaArquivo(u, i).catch(() => null)));
      const files = baixadas.filter(Boolean);
      if (files.length > 0 && navigator.canShare?.({ files })) {
        await navigator.share({ title, text, files });
        return;
      }
    } catch (err) {
      if (err?.name === "AbortError") return; // usuário cancelou a partilha
      // Falha ao buscar/partilhar as imagens → segue para o texto puro.
    }
  }

  // 2) Web Share API só com texto (emoji preservado, sem imagem).
  if (podeCompartilhar) {
    try {
      await navigator.share({ title, text });
      return;
    } catch (err) {
      if (err?.name === "AbortError") return;
    }
  }

  // 3) Fallback: link wa.me (apenas texto).
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
}

// Baixa a imagem e a transforma num File para a Web Share API. Requer que a
// origem da imagem permita CORS (o Cloudinary permite por padrão). O índice gera
// nomes únicos para que o WhatsApp não descarte fotos como duplicadas.
async function urlParaArquivo(url, i = 0) {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error("Falha ao baixar a imagem.");
  const blob = await res.blob();
  if (!blob.type.startsWith("image/")) throw new Error("Recurso não é uma imagem.");
  const ext = (blob.type.split("/")[1] || "jpg").split("+")[0];
  return new File([blob], `imovel-${i + 1}.${ext}`, { type: blob.type });
}
