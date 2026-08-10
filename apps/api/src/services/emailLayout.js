/**
 * ─── Layout dos e-mails ──────────────────────────────────────────────────────
 * Corpo padrão para toda mensagem que a Omnimob manda, no mesmo visual da landing:
 * fundo quase preto, cartão em superfície escura com borda de hairline, dourado
 * como acento e o lockup no topo.
 *
 * POR QUE TABELA E ESTILO INLINE: cliente de e-mail não é navegador. Gmail
 * remove `<style>` em boa parte dos casos, Outlook desktop renderiza com o motor
 * do Word (sem flex, sem grid, sem border-radius de verdade). Então tudo aqui é
 * `<table>` aninhada com atributos e `style=""` em cada célula — feio de ler,
 * mas é o que chega inteiro do outro lado.
 *
 * Cada peça devolve string de HTML e é combinável: monte o miolo com as funções
 * e passe para `layoutEmail`.
 */

// Paleta espelhada de apps/web/src/styles/omnimobKit.jsx
const COR = {
  fundo: "#0a0a0b",
  superficie: "#141416",
  superficie2: "#1a1a1d",
  linha: "#232326",
  forte: "#ffffff",
  padrao: "#e8e8ee",
  suave: "#b6b6c2",
  apagado: "#7d7d8a",
  dourado: "#d4af37",
  acento: "#6366f1",
  acentoSuave: "#818cf8",
  menta: "#14b8a6",
};

const LOCKUP = "https://res.cloudinary.com/dpwuxmbli/image/upload/f_auto,q_auto,w_420/domus/marca/lockup-email.png";

const FONTE =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace";

/** Escapa texto vindo do usuário antes de entrar no HTML. */
export function esc(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Peças ───────────────────────────────────────────────────────────────────

/** Etiqueta pequena em maiúsculas, como os "eyebrow" da landing. */
export function eyebrow(texto, cor = COR.dourado) {
  return `<p style="margin:0 0 14px;font-family:${MONO};font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${cor};">${esc(
    texto,
  )}</p>`;
}

export function titulo(texto) {
  return `<h1 style="margin:0 0 12px;font-family:${FONTE};font-size:25px;line-height:1.25;font-weight:700;letter-spacing:-0.02em;color:${COR.forte};">${esc(
    texto,
  )}</h1>`;
}

export function paragrafo(html) {
  return `<p style="margin:0 0 16px;font-family:${FONTE};font-size:15px;line-height:1.68;color:${COR.suave};">${html}</p>`;
}

/** Destaque em branco dentro de um parágrafo. */
export function forte(texto) {
  return `<strong style="color:${COR.forte};font-weight:600;">${esc(texto)}</strong>`;
}

/* Botão em tabela, não em <a> com padding: o Outlook ignora padding em link e o
   botão viraria só um texto sublinhado. */
export function botao(rotulo, href, { tom = "claro" } = {}) {
  const fundo = tom === "claro" ? COR.forte : COR.acento;
  const texto = tom === "claro" ? "#0a0a0b" : "#ffffff";
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 22px;">
    <tr>
      <td align="center" bgcolor="${fundo}" style="border-radius:999px;">
        <a href="${esc(href)}" target="_blank"
           style="display:inline-block;padding:14px 30px;font-family:${FONTE};font-size:15px;font-weight:600;
                  color:${texto};text-decoration:none;border-radius:999px;">${esc(rotulo)}</a>
      </td>
    </tr>
  </table>`;
}

/** Caixa de aviso com barra colorida à esquerda. */
export function aviso(html, cor = COR.dourado) {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px;">
    <tr>
      <td style="border-left:3px solid ${cor};background:${COR.superficie2};border-radius:0 10px 10px 0;padding:14px 16px;">
        <p style="margin:0;font-family:${FONTE};font-size:13.5px;line-height:1.6;color:${COR.suave};">${html}</p>
      </td>
    </tr>
  </table>`;
}

/** Lista de pares rótulo/valor — usada para credenciais e resumos. */
export function dados(linhas) {
  const celulas = linhas
    .map(
      ({ rotulo, valor, mono = false }) => `
      <tr>
        <td style="padding:11px 14px;border-bottom:1px solid ${COR.linha};font-family:${MONO};
                   font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:${COR.apagado};
                   white-space:nowrap;vertical-align:top;">${esc(rotulo)}</td>
        <td style="padding:11px 14px;border-bottom:1px solid ${COR.linha};font-family:${
        mono ? MONO : FONTE
      };font-size:14px;color:${COR.forte};word-break:break-word;">${esc(valor)}</td>
      </tr>`,
    )
    .join("");
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
         style="margin:0 0 20px;background:${COR.superficie2};border:1px solid ${COR.linha};border-radius:12px;">
    ${celulas}
  </table>`;
}

/** Lista de itens com marcador em menta. */
export function itens(lista) {
  const linhas = lista
    .map(
      (t) => `
      <tr>
        <td width="18" valign="top" style="padding:0 0 8px;font-family:${FONTE};font-size:13px;color:${COR.menta};">&#10003;</td>
        <td style="padding:0 0 8px;font-family:${FONTE};font-size:14px;line-height:1.55;color:${COR.suave};">${esc(t)}</td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px;">${linhas}</table>`;
}

/** Link cru, para quem não consegue clicar no botão. */
export function linkDeReserva(href) {
  return `
  <p style="margin:0 0 4px;font-family:${FONTE};font-size:12px;line-height:1.5;color:${COR.apagado};">
    Se o botão não funcionar, copie e cole este endereço no navegador:
  </p>
  <p style="margin:0 0 20px;font-family:${MONO};font-size:11.5px;line-height:1.5;word-break:break-all;">
    <a href="${esc(href)}" style="color:${COR.acentoSuave};text-decoration:underline;">${esc(href)}</a>
  </p>`;
}

export function divisor() {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:4px 0 20px;">
    <tr><td style="height:1px;background:${COR.linha};line-height:1px;font-size:0;">&nbsp;</td></tr>
  </table>`;
}

// ─── Envelope ────────────────────────────────────────────────────────────────

/**
 * Monta o e-mail completo.
 * @param {string} conteudo  HTML do miolo (use as peças acima)
 * @param {string} preheader Trecho que o cliente mostra ao lado do assunto.
 *                           Sem ele, aparece o começo do HTML — sempre feio.
 */
export function layoutEmail({ conteudo, preheader = "", rodape = "" }) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>Omnimob</title>
</head>
<body style="margin:0;padding:0;background:${COR.fundo};">
  <!-- Preheader: visível na lista de mensagens, invisível no corpo aberto. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0;">
    ${esc(preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
         style="background:${COR.fundo};padding:32px 16px;">
    <tr>
      <td align="center">

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560"
               style="width:560px;max-width:100%;">

          <tr>
            <td align="center" style="padding:0 0 26px;">
              <img src="${LOCKUP}" width="150" alt="Omnimob"
                   style="display:block;width:150px;max-width:60%;height:auto;border:0;">
            </td>
          </tr>

          <tr>
            <td style="background:${COR.superficie};border:1px solid ${COR.linha};border-radius:18px;padding:34px 32px 28px;">
              ${conteudo}
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:22px 12px 0;">
              <p style="margin:0 0 6px;font-family:${FONTE};font-size:12px;line-height:1.6;color:${COR.apagado};">
                ${rodape || "Omnimob — gestão imobiliária e vitrine digital."}
              </p>
              <p style="margin:0;font-family:${MONO};font-size:9.5px;letter-spacing:0.12em;text-transform:uppercase;color:#55555f;">
                IMÓVEIS · VITRINE · LEADS · IA
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export const CORES_EMAIL = COR;
