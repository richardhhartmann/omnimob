import { gruposDePermissao } from "../utils/permissoesCargo.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   As caixas de permissão de um cargo. Uma só, para as duas telas.

   Quem usa: `CargosPage` (tela cheia, criar e editar) e `CargoEmLinha` (o `+`
   dentro do cadastro de usuário). As duas mostravam a MESMA lista com desenhos
   diferentes — grade de cartões de um lado, chips miúdos do outro —, e a de
   dentro do cadastro nem tinha o ícone. Mexer numa não chegava na outra.

   É o mesmo defeito que o editor de vitrine teve duas vezes: duas versões do
   mesmo conteúdo divergem, sempre. A regra aqui é a de lá — o componente é
   único, e o que varia entre os dois lugares é COMPORTAMENTO, passado por
   propriedade.

   ── O QUE ESTE COMPONENTE NÃO DECIDE ──

   Ele desenha e avisa o que a pessoa clicou. Não sabe o que é gravar, não sabe
   o que é auto-save, não conhece o modal de ciência da permissão de risco e não
   sabe de quem é o cargo. Tudo isso é decisão de cada tela, e é por isso que
   `aoAlternar` devolve a intenção em vez de aplicar o valor:

     · `CargosPage` editando  → grava na hora (auto-save)
     · `CargosPage` criando   → guarda no form, e a permissão de risco abre modal
     · `CargoEmLinha`         → guarda no form, sem mais nada

   Colocar qualquer uma dessas regras aqui obrigaria a outra tela a carregá-la.

   ── A LISTA VEM DO PLANO, AQUI DENTRO ──

   `permissoesDoPlano` é chamada pelo componente, e não recebida pronta. Se cada
   tela filtrasse por conta própria, uma delas esqueceria o filtro na próxima
   permissão que dependa de plano — e ofereceria uma caixa que o servidor
   recusa.

   ── `somenteLeitura`: A MESMA GRADE, SEM MEXER ──

   A prévia do cargo escolhido, no cadastro de usuário, mostra exatamente esta
   lista — e por isso é este componente, e não um segundo desenho ao lado. O que
   muda é COMPORTAMENTO, como em todo o resto: não há caixa para clicar, e cada
   item traz um ✓ ou um ✕ no lugar dela.

   O ✕ importa tanto quanto o ✓. Quem escolhe o cargo de alguém precisa ver o
   que aquela pessoa NÃO vai alcançar — uma lista só do que está ligado deixa a
   pergunta "e o resto?" sem resposta na tela.
   ──────────────────────────────────────────────────────────────────────────── */

export function GradeDePermissoes({
  plano,
  valores = {},
  aoAlternar,
  desabilitado = false,
  /* Permissões que a pessoa não pode mexer AGORA, com o motivo. `CargosPage`
     usa para impedir que alguém se tranque para fora do próprio painel; o
     cadastro de usuário não usa, porque ali o cargo ainda nem existe. */
  travadas = [],
  motivoTravada,
  dataTour,
  /* Prévia: desenha a mesma grade sem nada para clicar. Ver o cabeçalho. */
  somenteLeitura = false,
  /* A imobiliária contratou o Omnimob Flow? Só com ele o segundo grupo de
     permissões existe. Ver `gruposDePermissao`. */
  temFlow = false,
}) {
  const grupos = gruposDePermissao(plano, { temFlow });

  return (
    <>
      {grupos.map((grupo) => (
        <div key={grupo.titulo || "hub"} className="perm-secao">
          {/* Título só no segundo grupo. O primeiro é "as permissões", e dar
              nome a ele numa conta sem Flow criaria uma divisão onde não há
              nada do outro lado. */}
          {grupo.titulo ? <span className="perm-secao__titulo">{grupo.titulo}</span> : null}
          <GradeDeUmGrupo
            itens={grupo.itens}
            valores={valores}
            aoAlternar={aoAlternar}
            desabilitado={desabilitado}
            travadas={travadas}
            motivoTravada={motivoTravada}
            somenteLeitura={somenteLeitura}
            dataTour={grupo.titulo ? undefined : dataTour}
          />
        </div>
      ))}
    </>
  );
}

/* A grade de um grupo. Saiu do componente de cima quando o segundo módulo
   trouxe o segundo grupo — o desenho de um item é o mesmo nos dois, e é ele que
   não pode ter duas versões. */
function GradeDeUmGrupo({
  itens, valores = {}, aoAlternar, desabilitado, travadas = [], motivoTravada,
  somenteLeitura, dataTour,
}) {
  return (
    <div className={`perm-grade${somenteLeitura ? " is-previa" : ""}`} data-tour={dataTour}>
      {itens.map(({ key, label, Icon }) => {
        const travada = travadas.includes(key);
        /* Travada aparece SEMPRE marcada: o que ela comunica é "você tem isto e
           não pode abrir mão", e não "isto está desligado". */
        const marcada = travada ? true : Boolean(valores[key]);

        /* Só na prévia o item apagado ganha marca própria. Na grade de edição a
           ausência de marca já é a caixa desmarcada, e apagar o item ali faria
           parecer indisponível em vez de desligado. */
        const classe = `perm-item${marcada ? " is-on" : somenteLeitura ? " is-off" : ""}`
          + (travada ? " is-travada" : "");

        if (somenteLeitura) {
          /* `<div>` e não `<label>`: rótulo sem controle é rótulo apontando
             para nada, e o leitor de tela anuncia um campo que não existe. */
          return (
            <div key={key} className={classe}>
              <span className="perm-marca" aria-hidden="true">{marcada ? "✓" : "✕"}</span>
              {Icon ? <Icon size={16} weight={marcada ? "fill" : "regular"} /> : null}
              <span>{label}</span>
              {/* O estado por extenso, só para quem ouve a tela: o ✓/✕ é
                  decorativo e a cor não chega a ninguém. */}
              <span className="sr-only">{marcada ? ": tem acesso" : ": sem acesso"}</span>
            </div>
          );
        }

        return (
          <label
            key={key}
            className={classe}
            title={travada ? motivoTravada : undefined}
          >
            <input
              type="checkbox"
              checked={marcada}
              onChange={(e) => aoAlternar(key, e.target.checked)}
              disabled={desabilitado || travada}
            />
            {Icon ? <Icon size={16} weight={marcada ? "fill" : "regular"} /> : null}
            <span>{label}</span>
          </label>
        );
      })}
    </div>
  );
}
