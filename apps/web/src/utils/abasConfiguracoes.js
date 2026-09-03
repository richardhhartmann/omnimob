import {
  Keyboard,
  IdentificationCard,
  Palette,
  ShareNetwork,
  Database,
  Crown,
  Kanban,
  Receipt,
} from "@phosphor-icons/react";
import { planoLiberaRedes } from "./planos";
import { FLOW, modulosDoTenant } from "./modulos";

/* ────────────────────────────────────────────────────────────────────────────
   As seções de Configurações, num lugar só.

   A lista é lida por dois lugares que precisam concordar: os cartões da própria
   página e o submenu da barra lateral. Ela já foi uma coisa só — abas dentro da
   tela —, e o submenu não tinha como apontar para uma delas; agora cada seção é
   um endereço (`/configuracoes?ver=perfil`), e rótulo, cor e ícone saem daqui
   para os dois. É o mesmo arranjo de `iconesRelatorios.js`, pela mesma razão:
   duas listas do mesmo menu desencontram na primeira seção nova.

   `Buildings` não serve para o Perfil, apesar de ser sobre a empresa — ele já é
   o rosto de "Gerenciar Imóveis" na mesma barra, e dois itens com o mesmo ícone
   a três centímetros um do outro se leem como o mesmo item.
   ──────────────────────────────────────────────────────────────────────────── */

/* ── As cores dos cartões ────────────────────────────────────────────────────
   Todas eram #94a3b8, um cinza só, e isso vinha do desenho antigo: disco grande
   e tudo centralizado, onde a cor teria competido com o título. Com o cartão do
   Dashboard — ícone num quadrado tingido, à esquerda — o cinza vira ausência: a
   grade inteira fica sem ponto de referência e os cartões deixam de se
   distinguir de relance.

   As cores não são decorativas: elas ECOAM as do Dashboard, onde a mesma ideia
   já tem uma. Quem aprendeu que Relatórios é verde na tela inicial reencontra o
   verde aqui dentro. */
export const ABAS_CONFIG = [
  {
    key: "perfil",
    label: "Perfil",
    /* Índigo, a cor da casa. */
    cor: "#6366f1",
    Icon: IdentificationCard,
    desc: "Nome, contato, endereço e os dados que aparecem para quem procura a imobiliária.",
  },
  {
    key: "aparencia",
    label: "Aparência",
    /* Roxo: é a seção sobre aparência. */
    cor: "#8b5cf6",
    Icon: Palette,
    desc: "Logotipo, cores da marca e a logo aplicada nas fotos dos imóveis.",
  },
  {
    key: "atalhos",
    label: "Atalhos de teclado",
    /* Ciano. */
    cor: "#06b6d4",
    Icon: Keyboard,
    desc: "As teclas que valem para a imobiliária inteira. Cada pessoa ainda pode ter as suas.",
  },
  {
    key: "redes",
    label: "Redes Sociais",
    /* Azul, do lado de fora — é o que sai da imobiliária. */
    cor: "#0ea5e9",
    Icon: ShareNetwork,
    desc: "Conecte o Facebook e o Instagram para publicar imóveis direto do painel.",
  },
  {
    /* Importação mora aqui, e não numa entrada própria do menu lateral: é coisa
       que se faz uma vez, na mudança de sistema, e um item permanente na
       navegação diária custaria atenção todo dia por uma tarefa de uma semana. */
    key: "dados",
    label: "Dados",
    /* Verde: importação é ganho de acervo. */
    cor: "#10b981",
    Icon: Database,
    desc: "Traga imóveis, clientes e usuários do sistema que você usava antes — pelo feed XML dele ou pela nossa API.",
  },
  {
    /* ── O Flow tem uma ABA, e não uma tela de configuração própria ─────────
       O módulo tem duas coisas para configurar — o provedor de assinatura e a
       política de comissão — e nenhuma delas justifica uma segunda tela com
       plano, cobrança e domínio duplicados ao lado. Uma segunda Configurações é
       a divergência que este projeto já pagou duas vezes.

       Por isso o item "Configurações" da barra do Flow aponta para
       `/configuracoes?ver=flow`: mesmo destino, âncora diferente. */
    key: "flow",
    label: "Omniflow",
    /* O ACENTO DO MÓDULO. A única cor desta lista que não é escolha estética. */
    cor: "#ec0b5b",
    Icon: Kanban,
    desc: "Assinatura digital dos contratos e a política de comissão da casa.",
  },
  {
    /* Cobrança é irmã de Plano, e não uma tela própria: "quanto custa" e "o que
       já paguei" são a mesma conversa, e uma segunda Configurações é a
       divergência que este projeto já pagou duas vezes (ver o comentário do
       Flow, logo acima).

       Separada de Plano porque respondem a perguntas diferentes: lá se DECIDE
       (trocar de faixa, contratar o Flow), aqui se CONFERE (venci quando, paguei
       o quê, por qual meio). Juntas, a decisão ficava enterrada num extrato. */
    key: "cobranca",
    label: "Cobrança e pagamentos",
    /* Âmbar: dinheiro, como Comissões. */
    cor: "#f59e0b",
    Icon: Receipt,
    desc: "Quando vence, o que já foi pago e por qual forma — com o recibo de cada cobrança.",
  },
  {
    key: "plano",
    label: "Plano e recursos",
    /* O dourado da coroa, que já marca o plano no painel. */
    cor: "#d4af37",
    Icon: Crown,
    desc: "O que seu plano inclui, o que ele consome e como mudar de faixa.",
  },
];

export const ICONES_CONFIG = Object.fromEntries(ABAS_CONFIG.map((a) => [a.key, a.Icon]));

export const ehAbaDeConfig = (chave) => ABAS_CONFIG.some((a) => a.key === chave);

export const rotuloDaAba = (chave) => ABAS_CONFIG.find((a) => a.key === chave)?.label || "";

/* ── Quais seções esta pessoa, neste plano, deve VER ─────────────────────────

   Uma função, porque duas telas perguntam: os cartões de `/configuracoes` e o
   submenu da barra lateral. Elas tinham cada uma o seu `filter`, e divergiram
   na primeira regra nova — a barra continuou oferecendo "Redes sociais" para o
   plano Básico depois que a página parou de mostrar o cartão. O menu prometia
   uma seção que a tela não abria.

   Escondido, e não bloqueado: quem vende plano é a tela de planos. Uma seção
   cheia de cadeados vende pior e frustra mais.
   ────────────────────────────────────────────────────────────────────────── */
export function abasVisiveis(cargo, plano, { podeImportar, temFlow = false }) {
  return ABAS_CONFIG.filter((a) => {
    if (a.key === "dados") return podeImportar(cargo);
    /* Tudo o que mora em Redes — Facebook, Instagram, Mercado Livre, ponte de
       WhatsApp, portais — começa no Profissional. */
    if (a.key === "redes") return planoLiberaRedes(plano);
    /* A seção do Flow só existe para quem contratou o módulo — e, dentro dele,
       para quem administra a conta. Escondida e não bloqueada, como o resto:
       quem vende módulo é a tela de planos, não um cadeado no meio das
       configurações. */
    if (a.key === "flow") return temFlow && Boolean(cargo?.verConfiguracoes);
    /* Cobrança tem permissão PRÓPRIA, e é a única seção daqui que um cargo
       pode receber sem ser o Administrador — o financeiro precisa conferir o
       que foi pago sem poder trocar de plano ou cancelar a assinatura.
       Escondida e não bloqueada, como o resto desta lista; a rota recusa do
       mesmo jeito para quem digitar o endereço. */
    if (a.key === "cobranca") return Boolean(cargo?.verCobranca);
    return true;
  });
}
