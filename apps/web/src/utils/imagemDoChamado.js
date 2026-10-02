/* A imagem anexada a um chamado, reduzida antes de subir — print de tela e
   foto de celular têm vários MB, e o que o suporte precisa é LER a tela, não
   imprimi-la. Usada pelos dois lados: o modal de Ajuda (cliente) e a caixa de
   entrada do suporte (super-admin). Devolve `{ blob, dataUrl }`: o blob sobe
   para o Cloudinary no envio, o dataUrl desenha a miniatura até lá. */
export function comprimirImagem(arquivo, { ladoMaximo = 1600, qualidade = 0.82 } = {}) {
  return new Promise((resolve, reject) => {
    if (!arquivo || !String(arquivo.type).startsWith("image/")) {
      reject(new Error("Só dá para anexar imagens."));
      return;
    }
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error("Não consegui ler a imagem."));
    leitor.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("O arquivo não é uma imagem válida."));
      img.onload = () => {
        const escala = Math.min(1, ladoMaximo / Math.max(img.width, img.height));
        const tela = document.createElement("canvas");
        tela.width = Math.round(img.width * escala);
        tela.height = Math.round(img.height * escala);
        tela.getContext("2d").drawImage(img, 0, 0, tela.width, tela.height);
        tela.toBlob(
          (blob) => (blob
            ? resolve({ blob, dataUrl: tela.toDataURL("image/jpeg", 0.8) })
            : reject(new Error("Não consegui reduzir a imagem."))),
          "image/jpeg",
          qualidade,
        );
      };
      img.src = String(leitor.result);
    };
    leitor.readAsDataURL(arquivo);
  });
}

/** As imagens de um evento de colar (Ctrl+V), já como arquivos. */
export function imagensDaAreaDeTransferencia(evento) {
  return [...(evento?.clipboardData?.items || [])]
    .filter((i) => i.kind === "file" && i.type.startsWith("image/"))
    .map((i) => i.getAsFile())
    .filter(Boolean);
}
