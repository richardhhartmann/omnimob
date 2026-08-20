/* ────────────────────────────────────────────────────────────────────────────
   O selo "Beta" do editor de vitrine.

   Um componente e uma classe para os DOIS lugares onde ele aparece — o item
   "Editar Página" na barra lateral e o topo do próprio editor. São telas
   diferentes, com folhas de estilo diferentes (a barra é escopada em `.ds-*`
   num template literal; o editor vive em `.editor-*` no styles.css), e é
   exatamente aí que uma segunda cópia nasceria com outro tom de amarelo.

   A classe mora no styles.css global, e não no template literal da barra, por
   duas razões: ela precisa valer nos dois lugares, e comentário com crase
   dentro de template literal derruba o build.

   O elemento é `<span>` e não um botão ou título: é rótulo de estado, não
   navegação. `title` explica o que "Beta" significa para quem passa o mouse —
   a palavra sozinha não diz se o recurso está incompleto ou se pode sumir.
   ──────────────────────────────────────────────────────────────────────────── */
export function SeloBeta({ titulo = "Recurso em evolução: funciona, mas ainda recebe mudanças." }) {
  return (
    <span className="selo-beta" title={titulo}>
      Beta
    </span>
  );
}

export default SeloBeta;
