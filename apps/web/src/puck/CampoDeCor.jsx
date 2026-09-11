/* ────────────────────────────────────────────────────────────────────────────
   COR SE ESCOLHE NUM SELETOR, NÃO SE DIGITA.

   Os campos de cor do editor novo nasceram como `type: "text"` — a pessoa via
   `#000000` escrito numa caixa e tinha de saber hexadecimal para mudar. O
   editor clássico nunca fez isso: ele mostra a COR, e clicar abre o seletor do
   sistema.

   Isto é o `CampoCor` do `BuilderInspector` vestido de campo do Puck. As classes
   são as mesmas (`.editor-field`, `.editor-color`), então os dois inspetores se
   parecem sem ninguém manter duas folhas de estilo.

   ── "SEM COR" NÃO É UMA COR ──

   A regra que o clássico já tinha, e que vale igual aqui: quando não há valor,
   quem pinta é o tema da vitrine — e cada elemento usa um tom diferente. Um
   quadrado branco no campo afirmaria que alguém escolheu branco. Por isso o
   estado vazio tem aparência própria (xadrez discreto com a palavra `auto`), e
   o `<input>` carrega o padrão só porque precisa de uma cor concreta para
   abrir o seletor do sistema.
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * @param {string} rotulo    o que aparece acima do campo
 * @param {string} padrao    a cor que o seletor abre quando nada foi escolhido
 */
export function campoDeCor(rotulo, padrao = "#6366f1") {
  return {
    type: "custom",
    label: rotulo,
    render: ({ value, onChange, readOnly }) => {
      const escolhida = Boolean(value);
      return (
        <label className="editor-field puck-campo-cor">
          <span className="editor-field-label">{rotulo}</span>
          <span
            className={`editor-color${escolhida ? "" : " is-auto"}`}
            style={escolhida ? { background: value } : undefined}
            title={escolhida ? value : "Sem cor definida — quem pinta é o tema da vitrine"}
          >
            {escolhida ? null : <em>auto</em>}
            <input
              type="color"
              value={value || padrao}
              disabled={readOnly}
              onChange={(e) => onChange(e.target.value)}
            />
          </span>
          {/* Limpar devolve o "auto". Sem ele, escolher uma cor por engano era
              irreversível: o seletor do sistema não tem estado vazio. */}
          {escolhida && !readOnly ? (
            <button type="button" className="puck-campo-cor__limpar" onClick={() => onChange("")}>
              usar a cor do tema
            </button>
          ) : null}
        </label>
      );
    },
  };
}
