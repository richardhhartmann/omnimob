import {
  IdentificationCard,
  Palette,
  ShareNetwork,
  Database,
  Crown,
} from "@phosphor-icons/react";

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
    cor: "#6366f1",
    Icon: IdentificationCard,
    desc: "Nome, contato, endereço e os dados que aparecem para quem procura a imobiliária.",
  },
  {
    key: "aparencia",
    label: "Aparência",
    cor: "#8b5cf6",
    Icon: Palette,
    desc: "Logotipo, cores da marca e a logo aplicada nas fotos dos imóveis.",
  },
  {
    key: "redes",
    label: "Redes Sociais",
    cor: "#1877f2",
    Icon: ShareNetwork,
    desc: "Conecte o Facebook e o Instagram para publicar imóveis direto do painel.",
  },
  {
    /* Importação mora aqui, e não numa entrada própria do menu lateral: é coisa
       que se faz uma vez, na mudança de sistema, e um item permanente na
       navegação diária custaria atenção todo dia por uma tarefa de uma semana. */
    key: "dados",
    label: "Dados",
    cor: "#0ea5e9",
    Icon: Database,
    desc: "Traga imóveis e clientes de outro sistema por planilha, de uma vez só.",
  },
  {
    key: "plano",
    label: "Plano e recursos",
    cor: "#d4af37",
    Icon: Crown,
    desc: "O que seu plano inclui, o que ele consome e como mudar de faixa.",
  },
];

export const ICONES_CONFIG = Object.fromEntries(ABAS_CONFIG.map((a) => [a.key, a.Icon]));

export const ehAbaDeConfig = (chave) => ABAS_CONFIG.some((a) => a.key === chave);

export const rotuloDaAba = (chave) => ABAS_CONFIG.find((a) => a.key === chave)?.label || "";
