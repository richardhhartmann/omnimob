/* ────────────────────────────────────────────────────────────────────────────
   O painel, num pedaço só.

   `App.jsx` importa daqui por `import()`, e é para isso que este arquivo
   existe: tudo o que ele reexporta vira UM pedaço carregado sob demanda.

   Antes o painel vivia no pacote comum — e o pacote comum é também o que abre a
   VITRINE. O visitante que chegava pelo link do WhatsApp, no celular, baixava o
   formulário de imóvel, as Configurações, o tour guiado e duzentos ícones antes
   de ver a primeira foto: 490 kB comprimidos, 270 kB nunca executados, medidos
   no PageSpeed. Era a maior parte do atraso de 4–5 s até a primeira pintura.

   Continua sendo UM pedaço, e não um por tela, pela regra de sempre (ver o
   cabeçalho da divisão em `App.jsx`): são telas que a mesma pessoa percorre na
   mesma sessão, e fatiá-las trocaria um download por doze esperas no meio do
   trabalho. O que mudou é só quem paga por ele — quem entra no painel, e não
   quem abre a vitrine.

   Tela nova do painel entra AQUI, e não com `import` direto no `App.jsx`: lá
   ela voltaria a pesar na vitrine sem ninguém perceber.
   ──────────────────────────────────────────────────────────────────────────── */
export { DashboardPage, ImovelListPage, ImovelFormPage } from "./DashboardPage";
export { InicioPage } from "./InicioPage";
export { LeadsPage } from "./LeadsPage";
export { RelatoriosPage } from "./RelatoriosPage";
export { LoginPage } from "./LoginPage";
export { PropertyInsightsPage } from "./PropertyInsightsPage";
export { TrialConfirmarPage } from "./TrialConfirmarPage";
export { RecuperarSenhaPage } from "./RecuperarSenhaPage";
export { AdminLayout } from "../components/AdminLayout";
export { CargosPage } from "./CargosPage";
export { AuditoriaPage } from "./AuditoriaPage.jsx";
export { SuportePage } from "./SuportePage.jsx";
export { ClientesPage } from "./ClientesPage";
export { ConfiguracaoPage } from "./ConfiguracaoPage";
export { TiposImovelPage } from "./TiposImovelPage";
export { UsuariosPage } from "./UsuariosPage";
export { ContaSuspensaPage } from "./ContaSuspensaPage";
export { AdminLoginPage } from "./AdminLoginPage";
export { AdminConvitePage } from "./AdminConvitePage";
