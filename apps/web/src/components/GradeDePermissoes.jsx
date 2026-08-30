import { gruposDePermissao, PERMISSOES_DE_RISCO } from "../utils/permissoesCargo.jsx";

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

   Ele desenha e avisa o que a pessoa clicou. Não sabe o que é gravar, não
   conhece o modal de ciência da permissão de risco e não sabe de quem é o
   cargo. Tudo isso é decisão de cada tela, e é por isso que `aoAlternar`
   devolve a intenção em vez de aplicar o valor:

     · `CargosPage`   → guarda no form, e a permissão de risco abre modal;
                        quem grava é o "Salvar Alterações"
     · `CargoEmLinha` → guarda no form, sem mais nada

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

   ── AS PERMISSÕES DE RISCO SE ANUNCIAM ──

   Seis das caixas abrem um modal de ciência ao serem marcadas (ver
   `PERMISSOES_DE_RISCO`) e nada as distinguia das outras vinte: eram
   idênticas, e a diferença só aparecia DEPOIS do clique. Quem monta um cargo
   às pressas descobria que "Painel do Gestor" era grave no instante em que já
   tinha decidido marcar — e a essa altura o modal lê como obstáculo, não como
   aviso.

   Agora elas nascem com o traço âmbar e o triângulo. É a mesma informação que
   o modal dá, entregue enquanto ainda é escolha: dá para montar o cargo
   inteiro sem esbarrar num único aviso, porque as caixas que abririam um
   estão visíveis desde o começo.

   Quem decide o que é de risco continua sendo o catálogo, não este arquivo —
   permissão nova entra no destaque sozinha, no dia em que ganhar o texto do
   modal. Um segundo `Set` aqui divergiria dele no primeiro esquecimento.
   ──────────────────────────────────────────────────────────────────────────── */

/* O triângulo. `aria-hidden` porque o estado por extenso vem no `sr-only` ao
   lado — cor e desenho não chegam a quem ouve a página. */
function MarcaDeRisco() {
  return (
    <span
      className="perm-alerta"
      title="Permissão sensível: pede uma confirmação por escrito antes de ser concedida."
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <span className="sr-only">. Permissão sensível</span>
    </span>
  );
}

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
      {grupos.map((grupo) => {
        /* A porta do grupo, quando ele tem uma. Hoje só o Flow — ver
           `gruposDePermissao`. Desligada, as permissões de dentro ficam
           desabilitadas: o cargo não alcança o módulo, então não há o que
           escolher lá dentro. */
        const porta = grupo.porta || null;
        const portaAberta = porta ? Boolean(valores[porta.key]) : true;

        return (
          <div key={grupo.titulo || "hub"} className="perm-secao">
            {/* Título só no segundo grupo. O primeiro é "as permissões", e dar
                nome a ele numa conta sem Flow criaria uma divisão onde não há
                nada do outro lado. */}
            {grupo.titulo ? <span className="perm-secao__titulo">{grupo.titulo}</span> : null}

            {porta ? (
              <PortaDoGrupo
                porta={porta}
                ligada={portaAberta}
                aoAlternar={aoAlternar}
                desabilitado={desabilitado}
                somenteLeitura={somenteLeitura}
              />
            ) : null}

            <GradeDeUmGrupo
              itens={grupo.itens}
              valores={valores}
              aoAlternar={aoAlternar}
              /* Porta fechada trava o que está atrás dela. Não apaga: os
                 valores continuam no formulário, então religar devolve o
                 arranjo anterior em vez de obrigar a remarcar tudo. */
              desabilitado={desabilitado || !portaAberta}
              travadas={travadas}
              motivoTravada={
                portaAberta ? motivoTravada : "Ligue o acesso ao Flow para escolher isto"
              }
              somenteLeitura={somenteLeitura}
              dataTour={grupo.titulo ? undefined : dataTour}
            />
          </div>
        );
      })}
    </>
  );
}

/* ── O INTERRUPTOR DO GRUPO ──────────────────────────────────────────────────

   Reaproveita `.sw`, o switch que o painel inteiro já usa — e não um controle
   novo. O acento é o rosa do Flow, pela variável que a caixa define.

   Na PRÉVIA (cadastro de usuário) ele vira texto com ✓/✕, pela mesma razão que
   o resto da grade: rótulo sem controle é rótulo apontando para nada. */
function PortaDoGrupo({ porta, ligada, aoAlternar, desabilitado, somenteLeitura }) {
  const { key, label, descricao, Icon } = porta;

  if (somenteLeitura) {
    return (
      <div className={`perm-porta is-previa${ligada ? " is-on" : ""}`}>
        <span className="perm-marca" aria-hidden="true">{ligada ? "✓" : "✕"}</span>
        {Icon ? <Icon size={16} weight={ligada ? "fill" : "regular"} /> : null}
        <span className="perm-porta__texto"><strong>{label}</strong></span>
        <span className="sr-only">{ligada ? ": tem acesso" : ": sem acesso"}</span>
      </div>
    );
  }

  return (
    <label className={`perm-porta${ligada ? " is-on" : ""}`}>
      <span className="perm-porta__icone">{Icon ? <Icon size={17} weight="fill" /> : null}</span>
      <span className="perm-porta__texto">
        <strong>{label}</strong>
        {descricao ? <small>{descricao}</small> : null}
      </span>
      <input
        type="checkbox"
        className="sw"
        checked={ligada}
        disabled={desabilitado}
        onChange={(e) => aoAlternar(key, e.target.checked)}
      />
    </label>
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
        /* Do catálogo, e não de uma lista local: ver o cabeçalho. */
        const deRisco = Boolean(PERMISSOES_DE_RISCO[key]);

        const classe = `perm-item${marcada ? " is-on" : somenteLeitura ? " is-off" : ""}`
          + (travada ? " is-travada" : "")
          + (deRisco ? " is-risco" : "");

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
              {deRisco ? <MarcaDeRisco /> : null}
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
            {deRisco ? <MarcaDeRisco /> : null}
          </label>
        );
      })}
    </div>
  );
}
