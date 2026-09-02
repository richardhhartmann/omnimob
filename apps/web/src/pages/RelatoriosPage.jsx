import { useSearchParams, useNavigate } from "react-router-dom";
import { LeadsPage } from "./LeadsPage";
import { RelatorioMensal } from "../components/RelatorioMensal";
import { FunilDeVendas, Comissoes } from "../components/FunilVendas";
import { ICONES_RELATORIOS, IconeRelatorios } from "../utils/iconesRelatorios";
import { GradeDeMenu } from "../components/GradeDeMenu.jsx";
import { Trilha } from "../components/Trilha.jsx";
import { degrausAte } from "../utils/trilhaDoPainel";
import { relatoriosVisiveis, relatorioLiberado, TITULO_RELATORIO, PARAMETRO_DE, POR_PARAMETRO } from "../utils/relatorios";

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




export function RelatoriosPage({ session }) {
  const navigate = useNavigate();
  /* ── A view mora na URL ────────────────────────────────────────────────────
     Era `useState`, e o preço disso era não conseguir mandar "olha o funil" por
     mensagem, nem deixar o menu lateral abrir um relatório específico — ele só
     sabia levar ao índice. O botão Voltar do navegador passa a funcionar entre
     os cartões, que é o que qualquer pessoa espera de algo que trocou a tela. */
  const [parametros, setParametros] = useSearchParams();
  const plano = session?.tenant?.plano;
  const visiveis = relatoriosVisiveis(plano);

  /* Relatório que o plano não abre não entra nem pelo endereço. Sem isto,
     `/relatorios?ver=mensal` continuava chegando na parede de upgrade — e um
     link antigo, um favorito ou o botão Voltar bastavam para cair lá. */
  const pedida = POR_PARAMETRO[parametros.get("ver")];
  const view = pedida && relatorioLiberado(pedida, plano) ? pedida : "MENU";
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
        <GradeDeMenu
          tourId="relatorios-indice"
          titulo="Relatórios"
          subtitulo="Tudo que conta o que aconteceu na sua imobiliária, num lugar só."
          cards={visiveis.map((c) => {
            const Icone = ICONES_RELATORIOS[c.chave];
            return {
              title: c.title,
              desc: c.desc,
              accent: c.accent,
              acao: c.acao,
              icon: <Icone size={32} weight="duotone" />,
              onClick: () => setView(c.chave),
            };
          })}
        />
      ) : (
        <>
          {/* ── A TRILHA SAIU DAQUI ──────────────────────────────────────
              Ela subiu para a faixa do painel, que a monta a partir da ROTA:
              "Dashboard › Relatórios". O último degrau que esta tela
              acrescentava — o nome do relatório aberto — não se perdeu: ele é o
              TÍTULO, logo abaixo, publicado pela `CascaDeRelatorio`.

              Nada quebra ao clicar em "Relatórios" na faixa: `view` é derivada
              do `?ver=` da URL (logo acima), então navegar para `/relatorios`
              sem parâmetro já devolve o índice. Fosse `view` um `useState`, o
              clique não faria nada e a trilha teria de continuar aqui. */}
          {conteudo}
        </>
      )}
    </div>
  );
}
