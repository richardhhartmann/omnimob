import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { desenharIcone } from "./icones";
import { LOGO } from "./Apresentacao";
import { montarPptx } from "./pptx";
import { rotulosDoPeriodo } from "./tipos";

/* O "Baixar PPTX" da aba Novidades: o PowerPoint sai no próprio navegador, da
   versão que está na tela (com as correções e os prints da revisão). O
   pptxgenjs chega por `import()` — só quem clica baixa a biblioteca. */

const semPrefixo = (dataUrl) => dataUrl.replace(/^data:/, "");

async function lerImagem(blob) {
  const data = await new Promise((ok, falha) => {
    const leitor = new FileReader();
    leitor.onload = () => ok(semPrefixo(String(leitor.result)));
    leitor.onerror = () => falha(leitor.error);
    leitor.readAsDataURL(blob);
  });
  const bmp = await createImageBitmap(blob);
  const tamanho = { w: bmp.width, h: bmp.height };
  bmp.close();
  return { data, ...tamanho };
}

async function buscarImagem(url) {
  try {
    const r = await fetch(url);
    return r.ok ? await lerImagem(await r.blob()) : null;
  } catch {
    return null; // print que não baixa vira o ícone da novidade, como sem print
  }
}

/** O ícone do Phosphor desenhado pelo React, passado para PNG num canvas. */
async function iconeEmPng(nome, cor) {
  const caixa = document.createElement("div");
  const raiz = createRoot(caixa);
  flushSync(() => raiz.render(desenharIcone(nome, { size: 256, weight: "duotone", color: `#${cor}` })));
  let svg = caixa.innerHTML;
  raiz.unmount();
  if (!svg.includes("xmlns=")) svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const tela = document.createElement("canvas");
  tela.width = tela.height = 256;
  tela.getContext("2d")?.drawImage(img, 0, 0, 256, 256);
  return semPrefixo(tela.toDataURL("image/png"));
}

/** Gera e baixa novidades-<chave>.pptx. */
export async function baixarPptx(conteudo) {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const icones = new Map();
  const pres = new PptxGenJS();
  await montarPptx(pres, conteudo, {
    icone: (nome, cor) => {
      const chave = `${nome}:${cor}`;
      if (!icones.has(chave)) icones.set(chave, iconeEmPng(nome, cor));
      return icones.get(chave);
    },
    print: buscarImagem,
    logo: (await buscarImagem(LOGO.src))?.data ?? null,
    periodo: rotulosDoPeriodo(conteudo.mes),
  });
  await pres.writeFile({ fileName: `novidades-${conteudo.mes}.pptx` });
}
