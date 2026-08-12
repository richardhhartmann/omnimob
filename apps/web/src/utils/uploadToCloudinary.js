export async function uploadToCloudinary(file) {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error("Configure VITE_CLOUDINARY_CLOUD_NAME e VITE_CLOUDINARY_UPLOAD_PRESET para upload.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Falha no upload para Cloudinary.");
  }

  const body = await response.json();
  return { url: body.secure_url, publicId: body.public_id };
}

/* ─── Fotos vindas de importação ────────────────────────────────────────────
   Na importação as fotos não estão no computador de ninguém: são URLs que a
   planilha traz, apontando para o sistema antigo. O Cloudinary aceita receber a
   URL e buscar a imagem sozinho, então o arquivo nunca trafega por aqui — nem
   pelo navegador, nem pela nossa API.

   Copiar em vez de só guardar o link é o ponto: no dia em que a imobiliária
   desligar o sistema antigo, as fotos somem da vitrine junto. */
export async function uploadUrlToCloudinary(url) {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) throw new Error("Cloudinary não configurado.");

  const formData = new FormData();
  formData.append("file", url); // o Cloudinary busca a imagem nesta URL
  formData.append("upload_preset", uploadPreset);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    const corpo = await response.json().catch(() => ({}));
    throw new Error(corpo?.error?.message || "Cloudinary recusou a imagem.");
  }
  return (await response.json()).secure_url;
}

/**
 * Copia várias URLs de uma vez. Devolve `Map<urlOriginal, urlNova>`.
 *
 * De quatro em quatro: a lentidão aqui é de rede, não de processador, então
 * uma por vez desperdiça o tempo de espera — mas centenas ao mesmo tempo fazem
 * o Cloudinary responder 420 e o navegador segurar as conexões numa fila.
 *
 * Uma foto que falha NÃO derruba o imóvel: ela fica de fora e a tela conta
 * quantas ficaram. Um imóvel sem uma foto é corrigível na tela de imóveis; um
 * imóvel que não entrou dá trabalho de achar.
 */
export async function copiarUrlsParaCloudinary(urls, { aoProgredir, jaCopiadas = new Map() } = {}) {
  const pendentes = [...new Set(urls)].filter((u) => !jaCopiadas.has(u));
  const resultado = new Map(jaCopiadas);
  const falhas = [];
  let feitas = 0;

  const FRENTES = 4;
  const fila = [...pendentes];

  async function trabalhar() {
    while (fila.length) {
      const url = fila.shift();
      try {
        resultado.set(url, await uploadUrlToCloudinary(url));
      } catch (erro) {
        falhas.push({ url, motivo: erro.message });
      }
      feitas += 1;
      aoProgredir?.(feitas, pendentes.length);
    }
  }

  await Promise.all(Array.from({ length: Math.min(FRENTES, fila.length) }, trabalhar));
  return { copiadas: resultado, falhas };
}

// Remove o fundo de uma imagem localmente (no navegador, via canvas), sem depender
// de nenhum add-on/serviço externo. Detecta a cor de fundo amostrando os 4 cantos e
// torna transparentes os pixels próximos dela (com borda suavizada). Ideal para logos
// com fundo sólido/branco. Retorna um Blob PNG com transparência.
function removeBackgroundLocally(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      if (!canvas.width || !canvas.height) { reject(new Error("Imagem inválida.")); return; }
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);

      let imageData;
      try {
        imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      } catch (err) {
        reject(err);
        return;
      }
      const d = imageData.data;
      const w = canvas.width, h = canvas.height;

      // Cor de fundo = média dos 4 cantos.
      const corners = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]];
      let br = 0, bg = 0, bb = 0;
      for (const [x, y] of corners) {
        const i = (y * w + x) * 4;
        br += d[i]; bg += d[i + 1]; bb += d[i + 2];
      }
      br /= 4; bg /= 4; bb /= 4;

      const tol = 42;          // distância (por canal) para considerar "fundo"
      const inner = tol * tol * 3;
      const outer = inner * 2.6; // faixa de transição (borda suave)
      for (let i = 0; i < d.length; i += 4) {
        const dr = d[i] - br, dg = d[i + 1] - bg, db = d[i + 2] - bb;
        const dist2 = dr * dr + dg * dg + db * db;
        if (dist2 <= inner) {
          d[i + 3] = 0;
        } else if (dist2 <= outer) {
          const t = (Math.sqrt(dist2) - tol) / (tol * 1.0);
          d[i + 3] = Math.max(0, Math.min(d[i + 3], Math.round(255 * t)));
        }
      }
      ctx.putImageData(imageData, 0, 0);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Falha ao gerar imagem."))), "image/png");
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Não foi possível ler a imagem.")); };
    img.src = objectUrl;
  });
}

/**
 * Faz upload de uma logo removendo o fundo automaticamente (processamento local).
 * Se a remoção falhar por algum motivo, envia a imagem original.
 * Retorna { url, publicId, bgRemoved }.
 */
export async function uploadLogoWithBackgroundRemoval(file) {
  let toUpload = file;
  let bgRemoved = false;
  try {
    const blob = await removeBackgroundLocally(file);
    toUpload = new File([blob], "logo.png", { type: "image/png" });
    bgRemoved = true;
  } catch {
    toUpload = file;
  }
  const uploaded = await uploadToCloudinary(toUpload);
  return { url: uploaded.url, publicId: uploaded.publicId, bgRemoved };
}
