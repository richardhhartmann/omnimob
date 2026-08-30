import {
  Buildings, SquaresFour, UserCircle, UserSquare, Shield, GearSix,
  ClockCounterClockwise, Tag, PlusCircle, HouseLine, Question,
} from "@phosphor-icons/react";
import { ABAS_CONFIG } from "./abasConfiguracoes";
import { RELATORIOS } from "./relatorios";
import { ICONES_RELATORIOS, IconeRelatorios } from "./iconesRelatorios.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   O ROSTO de cada ação de atalho: o ícone e a cor com que ela aparece na tela
   de verdade.

   ── POR QUE NÃO MORA EM `atalhos.js` ──

   Aquele arquivo é a tabela de TECLAS — dados puros, sem JSX, lido também por
   quem só quer saber "que tecla é esta?". Ícone é desenho, e desenho não entra
   num catálogo de configuração: seria a única razão para `utils/atalhos.js`
   passar a ser `.jsx`.

   ── DE ONDE SAI CADA UM ──

   Metade não sai daqui. Relatórios e Configurações já têm catálogos próprios,
   e os dois carregam a ação a que pertencem (`RELATORIOS[].acao`,
   `ABAS_CONFIG[].key`) — então o rosto vem de lá, e um relatório novo entra no
   simulador sozinho.

   O resto — Dashboard, Início, Gerenciar imóveis — está escrito abaixo, e é
   uma CÓPIA: os cartões dessas telas montam o ícone dentro do próprio JSX da
   página, sem catálogo para ler. Está anotado como cópia de propósito; o dia
   em que aquelas telas ganharem um catálogo, este mapa some.

   ── O QUE ACONTECE COM AÇÃO SEM ROSTO ──

   Um ponto de interrogação cinza, e não um buraco. O simulador desenha o
   cartão do mesmo tamanho: uma grade com um vão no meio pareceria defeito, e a
   ação continua configurável mesmo sem ninguém ter escolhido um ícone para
   ela.
   ──────────────────────────────────────────────────────────────────────────── */

/* Cópia dos cartões de `DashboardPage`, `InicioPage` e do índice de imóveis. */
const PROPRIOS = {
  "dashboard.imoveis":    { Icone: Buildings,             cor: "#6366f1" },
  "dashboard.portfolio":  { Icone: SquaresFour,           cor: "#6366f1" },
  "dashboard.relatorios": { Icone: IconeRelatorios,       cor: "#10b981" },
  "dashboard.clientes":   { Icone: UserCircle,            cor: "#06b6d4" },
  "dashboard.usuarios":   { Icone: UserSquare,            cor: "#f59e0b" },
  "dashboard.cargos":     { Icone: Shield,                cor: "#e04212" },
  "dashboard.auditoria":  { Icone: ClockCounterClockwise, cor: "#a78bfa" },
  "dashboard.config":     { Icone: GearSix,               cor: "#64748b" },

  "inicio.leads":         { Icone: UserCircle,            cor: "#06b6d4" },
  "inicio.portfolio":     { Icone: SquaresFour,           cor: "#6366f1" },

  "imoveis.novo":         { Icone: HouseLine,             cor: "#6366f1" },
  "imoveis.categorias":   { Icone: Tag,                   cor: "#8b5cf6" },

  /* A única que não é uma tela: ela vale em todas, e o "+" é o que os botões
     de "Novo …" desenham em cada uma delas. */
  "global.novo":          { Icone: PlusCircle,            cor: "#6366f1" },
};

/* `RELATORIOS` guarda a ação e a cor; o ícone mora em `iconesRelatorios.jsx`,
   que é quem já abastece a barra, os cartões e a trilha. Cruzar os dois aqui é
   mais barato que uma terceira lista. */
const DOS_RELATORIOS = Object.fromEntries(
  RELATORIOS.map((r) => [r.acao, { Icone: ICONES_RELATORIOS[r.chave], cor: r.accent }]),
);

const DAS_CONFIGURACOES = Object.fromEntries(
  ABAS_CONFIG.map((a) => [`configuracoes.${a.key}`, { Icone: a.Icon, cor: a.cor }]),
);

const SEM_ROSTO = { Icone: Question, cor: "#64748b" };

/** O ícone e a cor com que esta ação aparece na tela real. Nunca devolve nulo. */
export function faceDaAcao(acaoId) {
  return PROPRIOS[acaoId] || DOS_RELATORIOS[acaoId] || DAS_CONFIGURACOES[acaoId] || SEM_ROSTO;
}
