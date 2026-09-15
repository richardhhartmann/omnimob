import {
  House, ChartPieSlice, Buildings, SquaresFour, UserCircle, UserSquare, Shield,
  GearSix, PlusCircle, PencilSimple, Tag, ClockCounterClockwise,
  Kanban, Handshake, FileText, Scroll, Broadcast, Coins, SealCheck, Lifebuoy,
} from "@phosphor-icons/react";
import { IconeRelatorios } from "./iconesRelatorios";

/* ────────────────────────────────────────────────────────────────────────────
   O NOME E O ÍCONE DE CADA TELA DO PAINEL.

   Existe para a trilha (`components/Trilha.jsx`) poder dizer de onde a
   sub-página desceu sem que cada tela invente o próprio rótulo. Um cadastro de
   cliente que se anuncia como "Novo Cliente" abaixo de uma barra onde se lê
   "Clientes" está certo; um que dissesse "Cadastro de Contatos" seria uma
   terceira palavra para a mesma coisa.

   ── POR QUE UM MAPA, E NÃO UMA LEITURA DA NAVEGAÇÃO ──

   Os rótulos são os MESMOS da barra lateral, e a tentação é lê-los de
   `navegacaoDoPainel.jsx`. Não dá sem efeito colateral: lá o destino de cada
   item mora dentro de um `onClick` que chama `navigate`, então descobrir a rota
   de um item exige EXECUTAR o clique dele. Fazer isso a cada render, só para
   desenhar uma linha de texto, é caro e arriscado.

   A cópia é a saída — e uma cópia sem guarda diverge. A guarda é
   `test/trilhaDoPainel.test.jsx`: ele monta a navegação com um `navigate` que
   apenas ANOTA para onde iria, e compara rótulo a rótulo. Rota nova na barra
   sem entrada aqui, ou rótulo que mudou de um lado só, falha ali.
   ────────────────────────────────────────────────────────────────────────── */

export const TELAS_DO_PAINEL = {
  /* A raiz de cada módulo — o único degrau sem pai. Toda tela desce de um
     Dashboard, e é por isso que a trilha mais curta do painel tem dois degraus
     ("Dashboard › Usuários") e não um: um degrau sozinho não é caminho, é
     título, e a página já tem o dela. */
  "/": { rotulo: "Dashboard", Icone: House },
  "/inicio": { rotulo: "Painel do Gestor", Icone: ChartPieSlice, pai: "/" },

  /* `pai` copia o ANINHAMENTO DA BARRA, que nem sempre é o da URL: "Categoria
     de Imóvel" mora em `/tipos-imovel`, um primeiro nível do endereço, mas na
     navegação ela é subitem de Gerenciar Imóveis — e é de lá que a pessoa
     desceu. A trilha descreve onde a tela mora, não como o endereço foi
     escrito. */
  "/imoveis": { rotulo: "Gerenciar Imóveis", Icone: Buildings, pai: "/" },
  "/imoveis/novo": { rotulo: "Novo Imóvel", Icone: PlusCircle, pai: "/imoveis" },
  "/imoveis/editar": { rotulo: "Editar Imóvel", Icone: PencilSimple, pai: "/imoveis" },
  "/imoveis/portfolio": { rotulo: "Portfólio Ativo", Icone: SquaresFour, pai: "/imoveis" },
  "/tipos-imovel": { rotulo: "Categoria de Imóvel", Icone: Tag, pai: "/imoveis" },

  "/relatorios": { rotulo: "Relatórios", Icone: IconeRelatorios, pai: "/" },
  "/clientes": { rotulo: "Clientes", Icone: UserCircle, pai: "/" },
  "/usuarios": { rotulo: "Usuários", Icone: UserSquare, pai: "/" },
  "/cargos": { rotulo: "Cargos", Icone: Shield, pai: "/" },
  "/auditoria": { rotulo: "Registro de Atividade", Icone: ClockCounterClockwise, pai: "/" },
  "/suporte": { rotulo: "Suporte", Icone: Lifebuoy, pai: "/" },
  "/configuracoes": { rotulo: "Configurações", Icone: GearSix, pai: "/" },

  "/flow": { rotulo: "Dashboard", Icone: House },
  "/flow/captacao": { rotulo: "Fontes de Captação", Icone: Broadcast, pai: "/flow" },
  "/flow/funil": { rotulo: "Funil de Vendas", Icone: Kanban, pai: "/flow" },
  "/flow/negocios": { rotulo: "Todos os Negócios", Icone: Handshake, pai: "/flow" },
  "/flow/negocios/novo": { rotulo: "Novo Negócio", Icone: PlusCircle, pai: "/flow/negocios" },
  "/flow/contratos": { rotulo: "Contratos", Icone: FileText, pai: "/flow" },
  "/flow/modelos": { rotulo: "Modelos de Minuta", Icone: Scroll, pai: "/flow" },
  "/flow/validacao": { rotulo: "Fila de Validação", Icone: SealCheck, pai: "/flow" },
  "/flow/comissoes": { rotulo: "Comissões", Icone: Coins, pai: "/flow" },
};

/**
 * O degrau de uma tela do painel, pronto para a `Trilha`.
 *
 * `aoIr` é de quem chama porque o movimento nem sempre é uma navegação: numa
 * página que troca de vista por estado — o cadastro de cliente, por exemplo —
 * voltar é `setView("list")`, e um `navigate` ali recarregaria a lista inteira
 * para chegar onde já se estava.
 */
export function degrauDaTela(rota, aoIr) {
  const tela = TELAS_DO_PAINEL[rota];
  if (!tela) return null;
  return { chave: rota, rotulo: tela.rotulo, Icone: tela.Icone, aoIr };
}

/**
 * Os degraus até uma tela, do topo até ela — prontos para a `Trilha`.
 *
 * `ir` recebe a rota do degrau clicado (normalmente o `navigate` do roteador).
 * `aoChegarNaPropria` substitui o clique do ÚLTIMO degrau: numa tela que troca
 * de vista por estado, navegar para o próprio endereço não faz nada (o roteador
 * já está nele), e o que se quer é voltar à lista.
 */
export function degrausAte(rota, ir, aoChegarNaPropria) {
  const cadeia = [];
  let atual = rota;
  /* Guarda contra `pai` circular: uma entrada apontando para si mesma travaria
     a renderização inteira, e o erro seria de uma linha num objeto. */
  while (atual && TELAS_DO_PAINEL[atual] && !cadeia.includes(atual)) {
    cadeia.unshift(atual);
    atual = TELAS_DO_PAINEL[atual].pai;
  }
  return cadeia.map((r, i) => {
    const ultimo = i === cadeia.length - 1;
    return degrauDaTela(r, ultimo && aoChegarNaPropria ? aoChegarNaPropria : () => ir(r));
  });
}
