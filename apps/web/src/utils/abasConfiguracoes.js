import {
  Keyboard,
  IdentificationCard,
  Palette,
  ShareNetwork,
  Database,
  Crown,
  Kanban,
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

export const ABAS_CONFIG = [
  {
    key: "perfil",
    label: "Perfil",
    cor: "#94a3b8",
    Icon: IdentificationCard,
    desc: "Nome, contato, endereço e os dados que aparecem para quem procura a imobiliária.",
  },
  {
    key: "aparencia",
    label: "Aparência",
    cor: "#94a3b8",
    Icon: Palette,
    desc: "Logotipo, cores da marca e a logo aplicada nas fotos dos imóveis.",
  },
  {
    key: "atalhos",
    label: "Atalhos de teclado",
    cor: "#94a3b8",
    Icon: Keyboard,
    desc: "As teclas que valem para a imobiliária inteira. Cada pessoa ainda pode ter as suas.",
  },
  {
    key: "redes",
    label: "Redes Sociais",
    cor: "#94a3b8",
    Icon: ShareNetwork,
    desc: "Conecte o Facebook e o Instagram para publicar imóveis direto do painel.",
  },
  {
    /* Importação mora aqui, e não numa entrada própria do menu lateral: é coisa
       que se faz uma vez, na mudança de sistema, e um item permanente na
       navegação diária custaria atenção todo dia por uma tarefa de uma semana. */
    key: "dados",
    label: "Dados",
    cor: "#94a3b8",
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
    label: "Omnimob Flow",
    cor: "#94a3b8",
    Icon: Kanban,
    desc: "Assinatura digital dos contratos e a política de comissão da casa.",
  },
  {
    key: "plano",
    label: "Plano e recursos",
    cor: "#94a3b8",
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
    return true;
  });
}
