import { COR as COR_CSS, LOGO } from "./Apresentacao";
import { printsDe, temPagina } from "./tipos";

/* ────────────────────────────────────────────────────────────────────────────
   O PPTX DAS NOVIDADES — porte do `pptx.ts` do VYA: o mesmo desenho da
   `Apresentacao`, em PowerPoint (capa, o que mudou, divisor por área, uma
   página por funcionalidade com o print, as listas de correções e mudanças).

   Só monta os slides. Quem chama dá os recursos (`baixarPptx.js`: o navegador
   desenha os ícones e busca os prints), e por isso o arquivo não importa
   nada do pptxgenjs — ele chega por `import()` só no clique.
   ──────────────────────────────────────────────────────────────────────────── */

// O pptxgenjs quer a cor sem o "#".
const COR = Object.fromEntries(Object.entries(COR_CSS).map(([k, v]) => [k, v.slice(1)]));
const FONTE = "Calibri";
const W = 13.333, M = 0.6;

/**
 * `r`: `{ icone(nome, cor) → "image/png;base64,…", print(url) → { data, w, h } | null, logo, periodo }`.
 */
export async function montarPptx(pres, conteudo, r) {
  pres.layout = "LAYOUT_WIDE"; // 13,333" × 7,5"
  pres.author = "Omnimob";
  pres.company = "Omnimob";
  pres.title = `${conteudo.titulo} · Omnimob`;
  pres.theme = { headFontFace: FONTE, bodyFontFace: FONTE };
  const S = pres.ShapeType;

  pres.defineSlideMaster({
    title: "FUNCIONALIDADE",
    background: { color: COR.branco },
    objects: [{ text: { text: `Omnimob · Novidades ${r.periodo.de}`, options: { x: M, y: 6.98, w: 6, h: 0.3, fontFace: FONTE, fontSize: 10, color: COR.apagado, margin: 0 } } }],
    slideNumber: { x: W - M - 0.6, y: 6.98, w: 0.6, h: 0.3, fontFace: FONTE, fontSize: 10, color: COR.apagado, align: "right" },
  });
  pres.defineSlideMaster({
    title: "ESCURO",
    background: { color: COR.navy },
    slideNumber: { x: W - M - 0.6, y: 6.98, w: 0.6, h: 0.3, fontFace: FONTE, fontSize: 10, color: COR.apagado, align: "right" },
  });

  const circulos = (slide) => {
    slide.addShape(S.ellipse, { x: 8.6, y: -2.2, w: 7.2, h: 7.2, fill: { color: COR.indigo, transparency: 80 }, line: { type: "none" }, objectName: "Círculo decorativo" });
    slide.addShape(S.ellipse, { x: 10.6, y: 3.6, w: 5.2, h: 5.2, fill: { color: COR.dourado, transparency: 84 }, line: { type: "none" }, objectName: "Círculo decorativo" });
  };
  const iconeNoCirculo = async (slide, nome, x, y, d, fundo = COR.indigo, cor = COR.branco) => {
    slide.addShape(S.ellipse, { x, y, w: d, h: d, fill: { color: fundo }, line: { type: "none" }, objectName: `Ícone ${nome}` });
    const i = d * 0.56;
    slide.addImage({ data: await r.icone(nome, cor), x: x + (d - i) / 2, y: y + (d - i) / 2, w: i, h: i, altText: nome });
  };
  const texto = (slide, t, o) => slide.addText(t, { fontFace: FONTE, margin: 0, isTextBox: true, ...o });
  const logo = (slide) => { if (r.logo) slide.addImage({ data: r.logo, x: M, y: 0.55, w: 2.6, h: 2.6 / LOGO.proporcao, altText: "Omnimob" }); };
  const etiqueta = async (slide, rotulo, icone) => {
    slide.addShape(S.roundRect, { x: M, y: 0.38, w: 0.6 + rotulo.length * 0.112, h: 0.34, rectRadius: 0.17, fill: { color: COR.lilas }, line: { type: "none" }, objectName: "Etiqueta da área" });
    slide.addImage({ data: await r.icone(icone, COR.indigo), x: M + 0.1, y: 0.44, w: 0.22, h: 0.22, altText: rotulo });
    texto(slide, rotulo.toUpperCase(), { x: M + 0.38, y: 0.38, w: rotulo.length * 0.112 + 0.1, h: 0.34, fontSize: 10, bold: true, color: COR.indigo, valign: "middle", charSpacing: 1 });
  };

  const secoes = conteudo.secoes.map((s) => ({ ...s, itens: s.itens.filter(temPagina) })).filter((s) => s.itens.length);
  const listas = [["correcao", "O que corrigimos", "Correções", "Wrench"], ["mudanca", "O que mudou de lugar", "Mudou de lugar", "ArrowsLeftRight"]]
    .map(([tipo, titulo, rotulo, icone]) => ({ titulo, rotulo, icone, itens: conteudo.secoes.flatMap((s) => s.itens.filter((i) => i.tipo === tipo).map((item) => ({ item, secao: s }))) }))
    .filter((l) => l.itens.length);
  const total = secoes.reduce((s, x) => s + x.itens.length, 0);
  const totalListas = listas.reduce((s, l) => s + l.itens.length, 0);

  /* ── CAPA ── */
  {
    const s = pres.addSlide({ masterName: "ESCURO" });
    circulos(s);
    logo(s);
    texto(s, r.periodo.capa, { x: M, y: 2.0, w: 6, h: 0.35, fontSize: 13, bold: true, color: COR.dourado, charSpacing: 4 });
    texto(s, conteudo.titulo, { x: M, y: 2.4, w: 9, h: 1.1, fontSize: 54, bold: true, color: COR.branco });
    texto(s, conteudo.subtitulo, { x: M, y: 3.45, w: 9, h: 0.5, fontSize: 20, color: COR.claro });
    texto(s, conteudo.chamada, { x: M, y: 4.15, w: 8.4, h: 1.0, fontSize: 17, color: COR.branco, valign: "top" });
    const numeros = [[String(total), total === 1 ? "novidade" : "novidades"], ...(totalListas ? [[String(totalListas), "correções e mudanças"]] : [])];
    numeros.forEach(([n, rot], i) => {
      texto(s, n, { x: M + i * 2.6, y: 5.45, w: 2.4, h: 0.85, fontSize: 48, bold: true, color: COR.indigoClaro });
      texto(s, rot, { x: M + i * 2.6, y: 6.28, w: 2.4, h: 0.35, fontSize: 13, color: COR.claro });
    });
  }

  /* ── O QUE MUDOU: um cartão por área ── */
  if (secoes.length) {
    const s = pres.addSlide({ masterName: "FUNCIONALIDADE" });
    texto(s, `O que mudou ${r.periodo.quando}`, { x: M, y: 0.5, w: 12, h: 0.8, fontSize: 34, bold: true, color: COR.texto });
    texto(s, "Uma página para cada novidade, por área do painel.", { x: M, y: 1.25, w: 12, h: 0.4, fontSize: 15, color: COR.apagado });
    const colunas = 4, gap = 0.3, cw = (W - 2 * M - gap * (colunas - 1)) / colunas, ch = 2.35;
    for (const [i, sec] of secoes.entries()) {
      const x = M + (i % colunas) * (cw + gap), y = 1.95 + Math.floor(i / colunas) * (ch + gap);
      s.addShape(S.roundRect, { x, y, w: cw, h: ch, rectRadius: 0.12, fill: { color: COR.fundoCartao }, line: { color: COR.borda, width: 1 }, objectName: `Cartão ${sec.titulo}` });
      await iconeNoCirculo(s, sec.icone, x + 0.25, y + 0.25, 0.62);
      texto(s, String(i + 1).padStart(2, "0"), { x: x + cw - 0.8, y: y + 0.3, w: 0.55, h: 0.4, fontSize: 14, bold: true, color: COR.lilasBorda, align: "right" });
      texto(s, sec.titulo, { x: x + 0.25, y: y + 1.0, w: cw - 0.5, h: 0.65, fontSize: 17, bold: true, color: COR.texto, valign: "top" });
      texto(s, `${sec.itens.length} ${sec.itens.length === 1 ? "novidade" : "novidades"}`, { x: x + 0.25, y: y + 1.75, w: cw - 0.5, h: 0.35, fontSize: 13, color: COR.indigo, bold: true });
    }
  }

  for (const [n, sec] of secoes.entries()) {
    /* ── DIVISOR DA ÁREA ── */
    pres.addSection({ title: sec.titulo });
    {
      const s = pres.addSlide({ masterName: "ESCURO", sectionTitle: sec.titulo });
      circulos(s);
      texto(s, String(n + 1).padStart(2, "0"), { x: M, y: 1.2, w: 3, h: 1.1, fontSize: 66, bold: true, color: COR.indigoClaro });
      texto(s, sec.titulo, { x: M, y: 2.35, w: 6.2, h: 1.5, fontSize: 40, bold: true, color: COR.branco, valign: "top" });
      texto(s, sec.resumo, { x: M, y: 3.95, w: 5.6, h: 1.2, fontSize: 18, color: COR.claro, valign: "top" });
      const passo = Math.min(0.62, 5.2 / sec.itens.length);
      for (const [i, it] of sec.itens.entries()) {
        const y = 1.25 + i * passo;
        await iconeNoCirculo(s, it.icone, 7.4, y, 0.44, COR.ardosia, COR.indigoClaro);
        texto(s, it.titulo, { x: 8.0, y, w: 4.7, h: 0.44, fontSize: 17, color: COR.branco, valign: "middle" });
      }
    }

    /* ── UMA PÁGINA POR FUNCIONALIDADE ── */
    for (const it of sec.itens) {
      const s = pres.addSlide({ masterName: "FUNCIONALIDADE", sectionTitle: sec.titulo });
      await etiqueta(s, sec.titulo, sec.icone);
      texto(s, it.titulo, { x: M, y: 0.82, w: W - 2 * M, h: 0.75, fontSize: 32, bold: true, color: COR.texto });
      if (it.tipo === "melhoria") {
        const bx = M + 0.75 + sec.titulo.length * 0.112;
        s.addShape(S.roundRect, { x: bx, y: 0.38, w: 1.25, h: 0.34, rectRadius: 0.17, fill: { color: "FBF3D5" }, line: { type: "none" }, objectName: "Selo Melhorou" });
        texto(s, "MELHOROU", { x: bx, y: 0.38, w: 1.25, h: 0.34, fontSize: 10, bold: true, color: "92710C", align: "center", valign: "middle", charSpacing: 1 });
      }

      const cx = M, cw = 4.75;
      texto(s, "PARA QUE SERVE", { x: cx, y: 1.75, w: cw, h: 0.3, fontSize: 11, bold: true, color: COR.indigo, charSpacing: 2 });
      texto(s, it.paraQue, { x: cx, y: 2.08, w: cw, h: 1.3, fontSize: 15, color: COR.texto, valign: "top" });
      texto(s, "COMO USAR", { x: cx, y: 3.48, w: cw, h: 0.3, fontSize: 11, bold: true, color: COR.indigo, charSpacing: 2 });
      for (const [i, p] of it.passos.slice(0, 3).entries()) {
        const y = 3.86 + i * 0.7;
        s.addShape(S.ellipse, { x: cx, y: y + 0.03, w: 0.36, h: 0.36, fill: { color: COR.indigo }, line: { type: "none" }, objectName: `Passo ${i + 1}` });
        texto(s, String(i + 1), { x: cx, y: y + 0.03, w: 0.36, h: 0.36, fontSize: 12, bold: true, color: COR.branco, align: "center", valign: "middle" });
        texto(s, p, { x: cx + 0.5, y, w: cw - 0.5, h: 0.64, fontSize: 13.5, color: COR.texto, valign: "top" });
      }
      s.addShape(S.roundRect, { x: cx, y: 6.05, w: cw, h: 0.5, rectRadius: 0.1, fill: { color: COR.lilas }, line: { type: "none" }, objectName: "Onde fica" });
      s.addImage({ data: await r.icone("MapPin", COR.indigo), x: cx + 0.14, y: 6.17, w: 0.26, h: 0.26, altText: "Onde fica" });
      texto(s, [{ text: "Onde fica: ", options: { bold: true } }, { text: it.onde }], { x: cx + 0.5, y: 6.05, w: cw - 0.6, h: 0.5, fontSize: 12.5, color: COR.indigo, valign: "middle" });

      // A tela: o print numa moldura escura; dois prints de celular lado a lado.
      const ax = 5.75, ay = 1.75, aw = W - M - ax, ah = 4.8;
      const prints = (await Promise.all(printsDe(it).map(r.print))).filter(Boolean);
      if (prints.length) {
        const pad = 0.09, gap = 0.4;
        const somaProp = prints.reduce((t, x) => t + x.w / x.h, 0);
        const h = Math.min(ah - 2 * pad, (aw - gap * (prints.length - 1) - 2 * pad * prints.length) / somaProp);
        const larguras = prints.map((x) => h * (x.w / x.h));
        const totalW = larguras.reduce((a, b) => a + b, 0) + gap * (prints.length - 1) + 2 * pad * prints.length;
        let x = ax + (aw - totalW) / 2;
        const y = ay + (ah - h - 2 * pad) / 2;
        for (const [i, p] of prints.entries()) {
          s.addShape(S.roundRect, { x, y, w: larguras[i] + 2 * pad, h: h + 2 * pad, rectRadius: 0.1, fill: { color: COR.ardosia }, line: { type: "none" }, shadow: { type: "outer", color: "000000", opacity: 0.25, blur: 12, offset: 4, angle: 90 }, objectName: "Moldura da tela" });
          s.addImage({ data: p.data, x: x + pad, y: y + pad, w: larguras[i], h, altText: `Tela: ${it.titulo}` });
          x += larguras[i] + 2 * pad + gap;
        }
      } else {
        s.addShape(S.roundRect, { x: ax, y: ay, w: aw, h: ah, rectRadius: 0.15, fill: { color: COR.lilas }, line: { type: "none" }, objectName: "Ilustração" });
        await iconeNoCirculo(s, it.icone, ax + aw / 2 - 1.05, ay + 1.0, 2.1);
        texto(s, it.titulo, { x: ax, y: ay + 3.3, w: aw, h: 0.55, fontSize: 22, bold: true, color: COR.texto, align: "center" });
        texto(s, it.onde, { x: ax, y: ay + 3.85, w: aw, h: 0.4, fontSize: 14, color: COR.apagado, align: "center" });
      }
    }
  }

  /* ── O QUE CORRIGIMOS / O QUE MUDOU DE LUGAR: até 4 por página ── */
  for (const l of listas) {
    pres.addSection({ title: l.rotulo });
    for (let p = 0; p < l.itens.length; p += 4) {
      const s = pres.addSlide({ masterName: "FUNCIONALIDADE", sectionTitle: l.rotulo });
      await etiqueta(s, l.rotulo, l.icone);
      texto(s, l.titulo, { x: M, y: 0.82, w: W - 2 * M, h: 0.75, fontSize: 32, bold: true, color: COR.texto });
      for (const [k, { item, secao }] of l.itens.slice(p, p + 4).entries()) {
        const y = 1.8 + k * 1.18;
        s.addShape(S.roundRect, { x: M, y, w: W - 2 * M, h: 1.02, rectRadius: 0.12, fill: { color: COR.fundoCartao }, line: { color: COR.borda, width: 1 }, objectName: item.titulo });
        await iconeNoCirculo(s, item.icone, M + 0.25, y + 0.2, 0.62);
        texto(s, item.titulo, { x: M + 1.1, y: y + 0.12, w: 8.5, h: 0.4, fontSize: 16, bold: true, color: COR.texto });
        texto(s, item.paraQue, { x: M + 1.1, y: y + 0.5, w: 8.5, h: 0.48, fontSize: 12.5, color: COR.texto, valign: "top" });
        texto(s, [{ text: secao.titulo, options: { bold: true, color: COR.indigo, breakLine: true } }, { text: item.onde }], { x: M + 9.8, y: y + 0.12, w: 2.1, h: 0.8, fontSize: 11, color: COR.apagado, align: "right", valign: "top" });
      }
    }
  }

  /* ── ENCERRAMENTO ── */
  {
    const s = pres.addSlide({ masterName: "ESCURO" });
    circulos(s);
    logo(s);
    texto(s, conteudo.encerramento.titulo, { x: M, y: 2.6, w: 9, h: 1.0, fontSize: 44, bold: true, color: COR.branco });
    texto(s, conteudo.encerramento.texto, { x: M, y: 3.65, w: 7.6, h: 1.1, fontSize: 19, color: COR.claro, valign: "top" });
  }

  return { total, areas: secoes.length };
}
