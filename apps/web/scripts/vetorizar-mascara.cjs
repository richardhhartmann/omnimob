/* ────────────────────────────────────────────────────────────────────────────
   Vetoriza a máscara da tela de login.

     npm run mascara                      (em apps/web — a do cliente)
     npm run mascara -- design/mascara_login_admin.png public/mascara_login_admin.svg
     npm run mascara -- entrada.png saida.svg

   Lê `design/mascara_login.png` — a cor do fundo (#0b0d14) em quatro níveis
   de transparência (25 / 50 / 75 / 100 %) recortada em formas orgânicas — e
   escreve `public/mascara_login.svg`, que a `CascaDeAcesso` põe por cima do
   fluido. O PNG tem 1000 px de largura e é esticado para dois mil; como vetor,
   a borda das formas continua lisa em qualquer tela.

   ── NÍVEIS ANINHADOS, NÃO DISJUNTOS ──
   Cada caminho é "tudo com alfa >= piso", então o de 100 % está dentro do de
   75 %, que está dentro do de 50 %, e assim por diante. Traçar cada nível como
   região separada deixava um fio de fresta onde as curvas vizinhas não casam —
   uma linha clara do fluido aparecendo entre duas camadas. Aninhados, uma
   imprecisão só desloca a borda; nunca abre buraco. As opacidades são as que,
   EMPILHADAS, reproduzem os quatro totais: 1 - (1-a1)(1-a2)... = total.
   ──────────────────────────────────────────────────────────────────────────── */
const path = require("node:path");
const fs = require("node:fs");
const potrace = require("potrace");
const Jimp = require("jimp");

const [entradaArg, saidaArg] = process.argv.slice(2);
const raiz = path.resolve(__dirname, "..");
const entrada = path.resolve(raiz, entradaArg || "design/mascara_login.png");
const saida = path.resolve(raiz, saidaArg || "public/mascara_login.svg");

/* A cor dos caminhos é a do PNG: o pixel OPACO mais frequente. Ela precisa
   bater com o `--bg` da tela — que é #0b0d14 no tom do cliente e #0a0a0b no do
   super-admin (herdado do kit) — e quem sabe qual é a certa é quem desenhou a
   máscara. Uma cor fixa aqui deixava uma linha vertical de um tom de
   diferença na emenda do admin. */
function corOpaca(imagem) {
  const { width, height, data } = imagem.bitmap;
  const contagem = new Map();
  for (let i = 0; i < width * height; i += 1) {
    if (data[i * 4 + 3] < 250) continue;
    const chave = (data[i * 4] << 16) | (data[i * 4 + 1] << 8) | data[i * 4 + 2];
    contagem.set(chave, (contagem.get(chave) || 0) + 1);
  }
  const [vencedor] = [...contagem.entries()].sort((x, y) => y[1] - x[1])[0] || [0x0b0d14];
  return `#${vencedor.toString(16).padStart(6, "0")}`;
}
// [piso de alfa, opacidade do caminho], do mais claro (maior) ao opaco (menor).
const NIVEIS = [
  [40, 0.25],
  [96, 1 / 3],
  [160, 0.5],
  [224, 1.0],
];

function bilevel(imagem, piso) {
  const { width, height, data } = imagem.bitmap;
  const mascara = new Jimp(width, height, 0xffffffff);
  for (let i = 0; i < width * height; i += 1) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3];
    // Só o escuro conta: pixel claro é sobra de exportação, não camada.
    if (a >= piso && r < 100 && g < 100 && b < 100) mascara.bitmap.data.fill(0, i * 4, i * 4 + 3);
  }
  return mascara;
}

const tracar = (imagem) =>
  new Promise((resolve, reject) =>
    potrace.trace(
      imagem,
      { threshold: 128, turdSize: 12, alphaMax: 1.0, optTolerance: 0.25, optCurve: true },
      (erro, svg) => (erro ? reject(erro) : resolve([...svg.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]).join(" "))),
    ),
  );

(async () => {
  const imagem = await Jimp.read(entrada);
  const { width, height } = imagem.bitmap;
  const cor = corOpaca(imagem);
  const caminhos = [];
  for (const [piso, opacidade] of NIVEIS) {
    const d = await tracar(bilevel(imagem, piso));
    if (d.trim()) caminhos.push(`  <path fill="${cor}" fill-opacity="${opacidade}" fill-rule="evenodd" d="${d}"/>`);
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">\n` +
    `${caminhos.join("\n")}\n</svg>\n`;
  fs.mkdirSync(path.dirname(saida), { recursive: true });
  fs.writeFileSync(saida, svg);
  console.log(`${path.relative(raiz, saida)}: ${caminhos.length} níveis, cor ${cor}, ${(svg.length / 1024).toFixed(1)} KB`);
})().catch((erro) => {
  console.error(erro.message);
  process.exit(1);
});
