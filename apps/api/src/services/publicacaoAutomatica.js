import { planoInfo } from "../middlewares/planoMiddleware.js";
import { PORTAIS, IDS_PORTAIS } from "./portais.js";

/* ────────────────────────────────────────────────────────────────────────────
   Publicação automática — quais canais saem sozinhos.

   ── O QUE ELA MUDA NO PRODUTO ──

   Ligado um canal, todo imóvel novo sai por ele sem ninguém apertar nada. E a
   tela de divulgação deixa de OFERECER o botão daquele canal — não porque
   esconder seja elegante, mas porque não há mais o que decidir ali. Um botão
   "publicar" ao lado de "já publicado automaticamente" convida a uma segunda
   publicação que ninguém queria.

   ── POR QUE O SERVIDOR DECIDE, E NÃO A TELA ──

   A tela poderia chamar as rotas de publicação em sequência depois de salvar.
   Mas aí a automação valeria só para quem cadastra PELO PAINEL — e o produto
   tem uma API pública onde imóvel entra por integração, e um importador que
   traz acervo inteiro de outro sistema. Automático que só funciona por um dos
   caminhos não é automático, é um atalho de interface.
   ────────────────────────────────────────────────────────────────────────── */

/* Os canais que a automação alcança, e o que cada um significa.

   `portais` é o único que não "publica": ele marca o imóvel para entrar no
   arquivo XML que ZAP, VivaReal e OLX Imóveis vêm buscar. Quem publica é a
   carga deles, uma vez por dia. A distinção precisa aparecer na tela — sem
   ela, a pessoa marca e vai procurar o anúncio no portal cinco minutos depois.
*/
/* Os portais entram um a um: `portais:ZAP`, `portais:VIVAREAL`, `portais:OLX`.
   A imobiliária pode ter contrato com um e não com outro, e "portais" como
   canal único decidia por ela. Ver `services/portais.js`. */
export const CANAIS_AUTOMATICOS = [
  ...IDS_PORTAIS.map((id) => `portais:${id}`),
  "mercadoLivre", "facebook", "instagram",
];

/** O id do portal dentro de um canal `portais:ZAP`, ou `null`. */
export function portalDoCanal(canal) {
  const [prefixo, id] = String(canal || "").split(":");
  return prefixo === "portais" && IDS_PORTAIS.includes(id) ? id : null;
}

/* Config gravado antes da separação tinha `portais: true` querendo dizer os
   três. Lê-lo como "nenhum" desligaria a automação de quem já a tinha. */
function portalLigado(config, id) {
  if (config[`portais:${id}`] !== undefined) return Boolean(config[`portais:${id}`]);
  return Boolean(config.portais);
}

/* Recurso de plano. Profissional para cima. */
const NIVEL_MINIMO = 1;

export function automacaoLiberada(tenant) {
  const info = planoInfo(tenant?.plano);
  return (info?.nivel ?? 0) >= NIVEL_MINIMO;
}

/**
 * O que está ligado, já filtrado pelo plano e pelo que a conta consegue fazer.
 *
 * `disponivel` diz se o canal PODE ser automatizado — Mercado Livre exige
 * conexão OAuth, redes sociais exigem a página do Facebook conectada. Oferecer
 * automação de um canal desconectado seria prometer o que não sai.
 */
export function canaisAutomaticos(tenant) {
  if (!automacaoLiberada(tenant)) return {};
  const guardado = tenant?.publicacaoAutomatica;
  const config = guardado && typeof guardado === "object" ? guardado : {};

  return {
    /* O feed não precisa de conexão nenhuma: ele é um endereço público que os
       portais leem. Por isso cada um está sempre disponível. */
    ...Object.fromEntries(IDS_PORTAIS.map((id) => [`portais:${id}`, portalLigado(config, id)])),
    mercadoLivre: Boolean(config.mercadoLivre) && Boolean(tenant?.mercadoLivreToken),
    facebook: Boolean(config.facebook) && Boolean(tenant?.facebookPageToken),
    /* O Instagram exige a conta Business ligada à página, e nem toda página
       tem. Sem ela a Graph API recusa — melhor não oferecer do que registrar
       uma falha por imóvel. */
    instagram: Boolean(config.instagram) && Boolean(tenant?.instagramBusinessId),
  };
}

/** O que a TELA deve oferecer: canal por canal, se dá para ligar e por quê. */
export function ofertaDeAutomacao(tenant) {
  const liberado = automacaoLiberada(tenant);
  const config = (tenant?.publicacaoAutomatica && typeof tenant.publicacaoAutomatica === "object")
    ? tenant.publicacaoAutomatica
    : {};

  const temMeta = Boolean(tenant?.facebookPageToken);
  return {
    liberado,
    planoMinimo: "Profissional",
    canais: [
      /* Um por portal. O texto precisa dizer que NÃO é imediato: é a
         expectativa errada mais provável desta tela inteira. */
      ...PORTAIS.map((portal) => ({
        id: `portais:${portal.id}`,
        nome: portal.nome,
        grupo: "Portais",
        disponivel: true,
        ligado: portalLigado(config, portal.id),
        nota: `Marca o imóvel para entrar no arquivo que o ${portal.nome} busca. A carga dele roda uma vez por dia.`,
      })),
      {
        id: "mercadoLivre",
        nome: "Mercado Livre",
        disponivel: Boolean(tenant?.mercadoLivreToken),
        ligado: Boolean(config.mercadoLivre),
        nota: tenant?.mercadoLivreToken
          ? "Cria o anúncio assim que o imóvel é cadastrado."
          : "Conecte a conta do Mercado Livre para liberar.",
      },
      {
        id: "facebook",
        nome: "Facebook",
        disponivel: temMeta,
        ligado: Boolean(config.facebook),
        nota: temMeta
          ? "Publica na página assim que o imóvel é cadastrado, com as fotos e a descrição."
          : "Conecte a página do Facebook para liberar.",
      },
      {
        id: "instagram",
        /* O Instagram depende da MESMA conexão (a página do Facebook), mas tem
           uma exigência própria: post sem foto ele recusa. Quem liga isto e
           cadastra um imóvel sem imagem recebe a falha registrada, não um
           anúncio silenciosamente ausente. */
        nome: "Instagram",
        disponivel: temMeta,
        ligado: Boolean(config.instagram),
        nota: temMeta
          ? "Publica no perfil assim que o imóvel é cadastrado. Exige ao menos uma foto."
          : "Conecte a página do Facebook para liberar.",
      },
    ],
  };
}

/** Peneira o que veio da tela: só chaves conhecidas, só booleanos. */
export function normalizarAutomacao(corpo) {
  const saida = {};
  for (const canal of CANAIS_AUTOMATICOS) {
    if (corpo && typeof corpo === "object" && canal in corpo) saida[canal] = Boolean(corpo[canal]);
  }
  return saida;
}
