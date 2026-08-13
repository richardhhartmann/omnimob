import { ChartLineUp, Users, ChartBar, Funnel, CurrencyCircleDollar } from "@phosphor-icons/react";

/* Ícones de Relatórios, num lugar só.

   Eles aparecem em quatro telas: o item da barra lateral, o atalho do painel
   inicial, os cartões da própria página e a lista de permissões em Cargos. Com
   a escolha espalhada, "Relatórios" acabaria sendo um gráfico num canto e um
   grupo de pessoas no outro — que foi exatamente o estado anterior, herdado de
   quando o item se chamava "Leads" e usava o ícone de gente.

   `ChartLineUp` é o rosto de Relatórios em toda a interface. */
export const IconeRelatorios = ChartLineUp;

export const ICONES_RELATORIOS = {
  LEADS: Users,
  MENSAL: ChartBar,
  FUNIL: Funnel,
  COMISSOES: CurrencyCircleDollar,
};

/* Ícone por permissão de cargo. Só as que TÊM um destino visível na interface
   entram aqui; as que governam ações dentro de uma tela (publicar em redes,
   por exemplo) continuam sem, e a lista de Cargos lida com a ausência. */
export { IconeRelatorios as IconePermissaoRelatorios };
