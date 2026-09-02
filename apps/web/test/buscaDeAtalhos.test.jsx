import test from "node:test";
import assert from "node:assert/strict";
import { gruposDoModulo } from "../src/components/navegacaoDoPainel.jsx";
import { destinosDe } from "../src/components/BuscaDeAtalhos.jsx";
import { HUB, FLOW } from "../src/utils/modulos.js";

/* ────────────────────────────────────────────────────────────────────────────
   A BUSCA NÃO PODE OFERECER O QUE A BARRA NÃO OFERECE.

   A paleta (Ctrl+K) devolve destinos, e cada destino é um clique que leva a uma
   tela. Se ela listar telas que o cargo não abre, o plano não libera ou o
   módulo não foi contratado, ela deixa de ser um atalho e vira um gerador de
   frustração — e, pior, um vazamento de INFORMAÇÃO: "existe uma tela de Cargos"
   é coisa que a recepcionista não precisava saber, e "existe um funil de
   negócios" é coisa que uma conta sem Flow não deveria descobrir por acidente.

   ── A DEFESA É ARQUITETURAL, E ESTE TESTE A TRANCA ──

   A paleta NÃO tem lista própria: ela achata `gruposDoModulo`, a mesma função
   que desenha a barra lateral, que já aplica os três filtros. Enquanto for
   assim, não há como as duas divergirem.

   O defeito que este arquivo existe para pegar é o dia em que alguém, querendo
   "melhorar a busca", acrescentar uma lista de destinos escrita à mão — um
   atalho para uma tela nova, um sinônimo, uma tela do outro módulo. Nesse dia
   os três testes abaixo falham.

   É a mesma família de defeito que `permissoesDoFlow.test.jsx` guarda: uma
   segunda cópia de uma lista que já existia. Lá aconteceu três vezes.

   Não toca no banco nem renderiza nada — só a função de achatar.
   ──────────────────────────────────────────────────────────────────────────── */

const NADA = () => {};

/** O contexto que `gruposDoModulo` espera, com o cargo e o plano do caso. */
function contexto(cargo, plano = "PREMIUM", extra = {}) {
  return {
    cargo,
    plano,
    temFlow: true,
    navigate: NADA,
    rota: "/",
    ver: null,
    leadsBadge: 0,
    negociosBadge: 0,
    showcaseLink: "https://exemplo.omnimob.app",
    showcaseEditorLink: "/vitrine/x/editar",
    flags: {},
    ...extra,
  };
}

function rotulos(modulo, ctx) {
  return destinosDe(gruposDoModulo(modulo, ctx)).map((d) => d.rotulo);
}

/* Um cargo com tudo ligado. `Proxy` em vez de um objeto escrito à mão: a lista
   de permissões cresce, e um objeto literal aqui teria de ser atualizado a cada
   permissão nova — exatamente o esquecimento que estes testes cobram dos
   outros. */
const TUDO = new Proxy({}, { get: () => true });

test("a busca só oferece o que o CARGO alcança", () => {
  const soImoveis = { gerenciarImoveis: true };
  const lista = rotulos(HUB, contexto(soImoveis));

  assert.ok(lista.includes("Gerenciar Imóveis"), "o que o cargo abre tem de estar lá");
  for (const proibido of ["Cargos", "Usuários", "Clientes", "Registro de Atividade", "Configurações"]) {
    assert.ok(
      !lista.includes(proibido),
      `"${proibido}" apareceu na busca de um cargo que não tem a permissão dela`,
    );
  }
});

test("a busca alcança os SUBITENS, que é o motivo de ela existir", () => {
  /* As abas de Configurações e os relatórios são telas que moram dentro de
     outra — são elas que ninguém encontra pela barra. Se o achatamento parar de
     descer um nível, a paleta continua "funcionando" e perde a razão de ser. */
  const lista = rotulos(HUB, contexto(TUDO));
  const pais = destinosDe(gruposDoModulo(HUB, contexto(TUDO))).filter((d) => d.onde === "Configurações");

  assert.ok(lista.includes("Configurações"), "o item pai continua na lista");
  assert.ok(pais.length > 0, "nenhuma aba de Configurações foi achatada para a busca");
});

test("o PLANO não some do resultado — ele vem marcado", () => {
  /* Item bloqueado por plano FICA na barra de propósito: sumir esconde a
     existência do recurso justamente de quem mais ganharia em conhecê-lo, e a
     tela do outro lado é o convite ao upgrade. A busca segue a mesma regra, e
     por isso precisa carregar o selo — sem ele, a pessoa clica esperando a tela
     e recebe uma oferta, sem aviso nenhum. */
  const basico = destinosDe(gruposDoModulo(FLOW, contexto(TUDO, "BASICO")));
  const premium = destinosDe(gruposDoModulo(FLOW, contexto(TUDO, "PREMIUM")));

  const travadosNoBasico = basico.filter((d) => d.bloqueado);
  assert.ok(
    travadosNoBasico.length > 0,
    "no Básico, algum destino do Flow tem de vir com o selo de plano",
  );
  for (const d of travadosNoBasico) {
    const mesmo = premium.find((x) => x.chave === d.chave);
    assert.ok(mesmo && !mesmo.bloqueado, `"${d.rotulo}" deveria destravar no Premium`);
  }
});

test("o MÓDULO separa as duas listas — nada do Flow vaza para o Hub", () => {
  /* A paleta recebe os grupos do módulo ATIVO. Uma conta sem Flow nunca chega a
     ter o Flow ativo (o seletor não o oferece), então a garantia que importa é
     esta: as duas listas não se misturam.

     ── A COMPARAÇÃO É POR CHAVE, E NÃO POR RÓTULO ──

     A primeira versão deste teste comparava nomes e acusou "Funil de vendas" de
     vazar do Flow para o Hub. Não vazava: o Hub tem um RELATÓRIO com esse nome
     (`rel-funil`, dentro de Relatórios) e o Flow tem a TELA (`flow-funil`).
     São duas coisas diferentes que se chamam igual — e continuam podendo, cada
     uma no seu módulo, porque na busca o `onde` as separa.

     Rótulo é texto de interface e muda; a chave é a identidade. */
  const chaves = (m) => destinosDe(gruposDoModulo(m, contexto(TUDO))).map((d) => d.chave);
  const hub = chaves(HUB);
  const flow = chaves(FLOW);

  for (const doFlow of hub.filter((k) => k.startsWith("flow-"))) {
    assert.fail(`"${doFlow}" é do Flow e apareceu na busca do Hub`);
  }
  for (const doHub of ["imoveis-lista", "editar-pagina", "clientes"]) {
    assert.ok(!flow.includes(doHub), `"${doHub}" é do Hub e apareceu na busca do Flow`);
  }
  assert.ok(flow.some((k) => k.startsWith("flow-")), "a lista do Flow não pode vir vazia");
});

test("todo destino leva a algum lugar", () => {
  /* Um item sem `onClick` nem `href` é uma linha na lista que não faz nada ao
     receber Enter — e o sintoma, para quem usa, é a paleta ter "engasgado". */
  for (const modulo of [HUB, FLOW]) {
    for (const d of destinosDe(gruposDoModulo(modulo, contexto(TUDO)))) {
      assert.ok(
        typeof d.ir === "function" || typeof d.href === "string",
        `"${d.rotulo}" (${modulo}) não tem destino`,
      );
    }
  }
});
