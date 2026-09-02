import { spawnRipple } from "../utils/rippleDrop";
import { TeclaDeAtalho } from "./ContextoDeAtalhos.jsx";
import { MenuDeCanto } from "./MenuDeCanto.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   O cartão dos índices do painel.

   Quatro telas fazem a mesma pergunta — "para onde vou daqui?" — e a resposta
   precisa ter sempre a mesma cara: Dashboard, Gerenciar Imóveis, Relatórios e
   Configurações.

   ── POR QUE O DESENHO É O DO DASHBOARD ──

   Havia dois: o do Dashboard (ícone num quadrado com a cor do cartão, título e
   descrição alinhados à esquerda) e o das outras três (disco grande e tudo
   centralizado). Duas respostas para a mesma pergunta, e a pessoa atravessava
   as duas na mesma sessão.

   Ficou o do Dashboard porque ele é o que a pessoa vê primeiro, todo dia, e
   porque alinhar à esquerda deixa a descrição legível em duas linhas — no
   centralizado ela vira um bloco simétrico que se lê pior. Os estilos moram em
   `.inicio-atalho`, no styles.css, com tema claro e escuro já resolvidos.

   O `pg-follow` e o `spawnRipple` são o par de sempre: o gradiente segue o
   ponteiro (variáveis --px/--py alimentadas por um listener global) e o clique
   solta a onda na cor do cartão.
   ──────────────────────────────────────────────────────────────────────────── */

export function CartaoDeMenu({
  icon, title, desc, description, accent, onClick, tourId, acao, tecla,
  /* Os três pontinhos no canto, quando este destino guarda mais do que o
     próprio destino. Vem pronto de fora — é o MESMO objeto que a barra lateral
     usa no item de igual nome, e montá-lo duas vezes daria duas listas de
     opções para a mesma coisa. Ver `MenuDeCanto`. */
  menu,
}) {
  /* `desc` e `description` porque as telas chamavam de dois jeitos — as três de
     índice usavam `desc`, o Dashboard usava `description`. Aceitar os dois foi
     mais barato (e menos arriscado) do que renomear em quatro arquivos. */
  const texto = desc ?? description;
  const cor = accent || "#94a3b8";

  const cartao = (
    <button
      type="button"
      onClick={onClick}
      data-tour={tourId}
      className="pg-follow inicio-atalho"
      /* O realce do hover é COR, e cor pertence ao CSS — este cartão já teve o
         dele escrito nos handlers de mouse, e o preço apareceu no tema claro: a
         folha precisava de `!important` para clarear o fundo, e o `!important`
         matava junto o brilho do hover.

         Aqui o JS só entrega a cor em variáveis (o accent com as três
         opacidades que o gradiente usa) e cuida do movimento. */
      style={{
        "--pg-accent": cor,
        "--pg-accent-borda": `${cor}55`,
        "--pg-accent-brilho": `${cor}33`,
        "--pg-accent-veu": `${cor}18`,
        padding: "28px",
        borderRadius: "16px",
        textAlign: "left",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
      onMouseDown={(e) => {
        spawnRipple(e, cor);
        e.currentTarget.style.transform = "translateY(-1px) scale(0.975)";
      }}
      onMouseUp={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; }}
    >
      {/* A tecla, no canto. Duas origens possíveis:

          · `tecla` — o número POSICIONAL, quando a grade está paginada. Ele
            pertence ao lugar, não à ação, e por isso vem pronto de fora.
          · `acao` — a tecla configurada para aquela ação. `TeclaDeAtalho`
            devolve `null` quando a imobiliária desligou os atalhos ou a pessoa
            desligou aquele, e o cartão fica igual, sem buraco. */}
      {tecla ? (
        <kbd className="tecla-atalho tecla-atalho--canto" aria-hidden="true">{tecla}</kbd>
      ) : acao ? (
        <TeclaDeAtalho acao={acao} className="tecla-atalho--canto" />
      ) : null}

      <div
        style={{
          padding: "12px",
          borderRadius: "12px",
          background: `${cor}22`,
          color: cor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </div>

      <div>
        <div style={{ fontWeight: 600, fontSize: "16px", marginBottom: "6px" }}>{title}</div>
        <div style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.5 }}>{texto}</div>
      </div>
    </button>
  );

  /* O "⋮" é IRMÃO do cartão, nunca filho: os dois são `<button>`, e botão
     dentro de botão é HTML inválido — o navegador desmonta a árvore e o clique
     de dentro nunca chega. A caixa abraça os dois, e o CSS empurra o selo da
     tecla para o lado, porque os dois disputavam o mesmo canto. */
  if (!menu?.itens?.length) return cartao;

  return (
    <div className="mkb-hospedeiro">
      {cartao}
      <MenuDeCanto
        itens={menu.itens}
        rotulo={menu.rotulo || `Mais opções de ${title}`}
        badge={menu.badge || 0}
        className="mkb-caixa--cartao"
      />
    </div>
  );
}
