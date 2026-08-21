import { permissoesDoPlano } from "../utils/permissoesCargo.jsx";

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
}) {
  const permissoes = permissoesDoPlano(plano);

  return (
    <div className="perm-grade" data-tour={dataTour}>
      {permissoes.map(({ key, label, Icon }) => {
        const travada = travadas.includes(key);
        /* Travada aparece SEMPRE marcada: o que ela comunica é "você tem isto e
           não pode abrir mão", e não "isto está desligado". */
        const marcada = travada ? true : Boolean(valores[key]);

        return (
          <label
            key={key}
            className={`perm-item${marcada ? " is-on" : ""}${travada ? " is-travada" : ""}`}
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
