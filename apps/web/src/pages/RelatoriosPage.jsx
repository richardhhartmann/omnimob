import { useSearchParams } from "react-router-dom";
import { LeadsPage } from "./LeadsPage";
import { RelatorioMensal } from "../components/RelatorioMensal";
import { FunilDeVendas, Comissoes } from "../components/FunilVendas";
import { ICONES_RELATORIOS, IconeRelatorios } from "../utils/iconesRelatorios";
import { CartaoDeMenu } from "../components/CartaoDeMenu.jsx";
import { Trilha } from "../components/Trilha.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   Relatórios — a página que reúne tudo que é LEITURA do que aconteceu.

   Substitui o item "Leads" da barra lateral. A troca é deliberada: cada
   recurso novo de acompanhamento (relatório mensal, funil, comissões) entra
   AQUI DENTRO, como mais um cartão, e não como mais uma linha no menu. Uma
   barra lateral que cresce a cada entrega vira um índice de tudo que o produto
   faz — e deixa de ser um caminho para o que a pessoa usa todo dia.

   Os cartões são os MESMOS do "Gerenciar Imóveis" (PropertyManagement): ícone
   em disco redondo, hover que levanta e acende o vidro, ripple no clique. Não
   é cópia por preguiça — é a mesma pergunta ("para onde vou daqui?") e ela deve
   ter sempre a mesma cara.

   Permissão: quem chega aqui tem `verRelatorios`, e ela abre TUDO que está
   dentro. Não há segundo filtro por item — leads e funil deixaram de ter
   permissões próprias justamente para não existir o estado sem sentido de ver
   o menu e não ver o conteúdo.
   ──────────────────────────────────────────────────────────────────────────── */

const CARDS = [
  {
    chave: "LEADS",
    title: "Leads",
    desc: "Quem entrou em contato pela vitrine, com o imóvel de origem e o histórico.",
    accent: "#94a3b8",
  },
  {
    chave: "MENSAL",
    title: "Relatório mensal",
    desc: "Visitas, leads, vendas e conversão do mês — na tela ou por e-mail.",
    accent: "#94a3b8",
  },
  {
    chave: "FUNIL",
    title: "Funil de vendas",
    desc: "De visita a lead, de lead a fechamento — e onde o caminho aperta.",
    accent: "#94a3b8",
  },
  {
    chave: "COMISSOES",
    title: "Comissões",
    desc: "Quanto cada corretor fechou no período e quanto tem a receber.",
    accent: "#94a3b8",
  },
];

const TITULO = {
  LEADS: "Leads",
  MENSAL: "Relatório mensal",
  FUNIL: "Funil de vendas",
  COMISSOES: "Comissões",
};

/* Chave da view no endereço. Curta e em minúsculas porque aparece na barra do
   navegador — `?ver=funil` é legível, `?view=FUNIL` é código vazando. */
const POR_PARAMETRO = { leads: "LEADS", mensal: "MENSAL", funil: "FUNIL", comissoes: "COMISSOES" };
export const PARAMETRO_DE = { LEADS: "leads", MENSAL: "mensal", FUNIL: "funil", COMISSOES: "comissoes" };

export function RelatoriosPage({ session }) {
  /* ── A view mora na URL ────────────────────────────────────────────────────
     Era `useState`, e o preço disso era não conseguir mandar "olha o funil" por
     mensagem, nem deixar o menu lateral abrir um relatório específico — ele só
     sabia levar ao índice. O botão Voltar do navegador passa a funcionar entre
     os cartões, que é o que qualquer pessoa espera de algo que trocou a tela. */
  const [parametros, setParametros] = useSearchParams();
  const view = POR_PARAMETRO[parametros.get("ver")] || "MENU";
  const setView = (proxima) =>
    setParametros(proxima === "MENU" ? {} : { ver: PARAMETRO_DE[proxima] });

  const conteudo =
    view === "LEADS" ? <LeadsPage session={session} />
    : view === "MENSAL" ? <RelatorioMensal session={session} />
    : view === "FUNIL" ? <FunilDeVendas session={session} />
    : view === "COMISSOES" ? <Comissoes session={session} />
    : null;

  return (
    /* A chave é a view, e é ela que reexecuta a animação: trocar de cartão
       remonta o bloco e a entrada roda de novo. É a mesma `chicEntrance` que o
       AdminLayout aplica ao navegar entre páginas — aqui a navegação é interna,
       mas para quem olha é a mesma coisa acontecendo. */
    <div
      key={view}
      className="management-container"
      style={{ animation: "chicEntrance 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards" }}
    >
      {view === "MENU" ? (
        <div data-tour="relatorios-indice" className="glass-panel" style={{ textAlign: "center", padding: "56px 40px" }}>
          <h2 style={{ marginBottom: "8px", fontSize: "28px", fontWeight: "700" }}>Relatórios</h2>
          <p style={{ marginBottom: "48px", color: "var(--text-muted)", fontSize: "16px" }}>
            Tudo que conta o que aconteceu na sua imobiliária, num lugar só.
          </p>
          <div className="grid grid-2" style={{ gap: "32px", maxWidth: "800px", margin: "0 auto" }}>
            {CARDS.map((c) => {
              const Icone = ICONES_RELATORIOS[c.chave];
              return (
                <CartaoDeMenu
                  key={c.chave}
                  icon={<Icone size={40} weight="duotone" />}
                  title={c.title}
                  desc={c.desc}
                  accent={c.accent}
                  onClick={() => setView(c.chave)}
                />
              );
            })}
          </div>
        </div>
      ) : (
        <>
          {/* Os ícones saem da MESMA fonte que desenha os cartões do índice e o
              submenu da barra lateral (`iconesRelatorios`). Uma escolha à mão
              aqui daria um funil de um jeito na barra e de outro na trilha. */}
          <Trilha
            itens={[
              { chave: "indice", rotulo: "Relatórios", Icone: IconeRelatorios, aoIr: () => setView("MENU") },
              { chave: view, rotulo: TITULO[view], Icone: ICONES_RELATORIOS[view], aoIr: () => setView(view) },
            ]}
          />
          {conteudo}
        </>
      )}
    </div>
  );
}
