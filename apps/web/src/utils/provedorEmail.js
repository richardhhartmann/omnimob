/* ────────────────────────────────────────────────────────────────────────────
   Reconhece o provedor de e-mail pelo domínio e monta o link do webmail dele.

   Serve para a tela de "confira seu e-mail" oferecer um atalho em vez de um
   "Entendi" que não faz nada: a pessoa acabou de pedir um link de confirmação e
   o próximo passo dela é, literalmente, abrir a caixa de entrada.

   ─── SOBRE A BUSCA ──────────────────────────────────────────────────────────
   Nem todo webmail aceita busca por URL. Onde aceita, já abrimos filtrando por
   "omnimob" — o e-mail aparece direto, mesmo que tenha caído na promoções ou no
   spam. Onde não aceita, abrimos a caixa de entrada e pronto: um link que abre
   no lugar certo é melhor que um link com parâmetro inventado que o provedor
   ignora ou, pior, trata como erro.

   Quem usa domínio próprio (`contato@imobiliaria.com.br`) não entra em lista
   nenhuma: não há como adivinhar o webmail de uma empresa. Nesses casos a
   função devolve null e a tela mantém o botão neutro.
   ──────────────────────────────────────────────────────────────────────────── */

const BUSCA = "omnimob";

const PROVEDORES = [
  {
    nome: "Gmail",
    dominios: ["gmail.com", "googlemail.com"],
    url: (q) => `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(q)}`,
  },
  {
    nome: "Outlook",
    dominios: ["outlook.com", "outlook.com.br", "hotmail.com", "hotmail.com.br", "live.com", "msn.com"],
    // O Outlook Web não tem parâmetro de busca estável na URL; abrir a caixa de
    // entrada é o comportamento previsível.
    url: () => "https://outlook.live.com/mail/0/",
  },
  {
    nome: "Yahoo",
    dominios: ["yahoo.com", "yahoo.com.br", "ymail.com"],
    url: (q) => `https://mail.yahoo.com/d/search/keyword=${encodeURIComponent(q)}`,
  },
  {
    nome: "iCloud",
    dominios: ["icloud.com", "me.com", "mac.com"],
    url: () => "https://www.icloud.com/mail",
  },
  {
    nome: "Proton Mail",
    dominios: ["proton.me", "protonmail.com", "pm.me"],
    url: () => "https://mail.proton.me/u/0/inbox",
  },
  {
    nome: "Zoho Mail",
    dominios: ["zoho.com", "zohomail.com"],
    url: () => "https://mail.zoho.com/zm/",
  },
  {
    nome: "UOL Mail",
    dominios: ["uol.com.br", "bol.com.br"],
    url: () => "https://email.uol.com.br/",
  },
  {
    nome: "Terra Mail",
    dominios: ["terra.com.br"],
    url: () => "https://mail.terra.com.br/",
  },
];

/**
 * @param {string} email
 * @returns {{ nome: string, url: string } | null}
 */
export function provedorDoEmail(email) {
  const dominio = String(email || "").trim().toLowerCase().split("@")[1];
  if (!dominio) return null;

  const achado = PROVEDORES.find((p) => p.dominios.includes(dominio));
  if (!achado) return null;

  return { nome: achado.nome, url: achado.url(BUSCA) };
}
