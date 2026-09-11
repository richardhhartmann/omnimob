/* ────────────────────────────────────────────────────────────────────────────
   OS DOIS AJUSTES DO BANNER, COM DESLIZANTE.

   Escurecer e brilho são grandezas contínuas que a pessoa ajusta OLHANDO o
   resultado — ninguém sabe de antemão que quer 42% de escurecimento. Uma caixa
   de número obrigaria a digitar, apertar e conferir; um deslizante deixa
   procurar o ponto certo com o olho, que é como o editor clássico já fazia.

   É o `Deslizante` do `BuilderInspector` vestido de campo do Puck, com as
   mesmas classes — o desenho e as duas paletas vêm de graça.

   ── O VALOR NA TELA NÃO É O VALOR GRAVADO ──

   O documento guarda frações (0 a 1 no escurecimento, 1 = normal no brilho),
   porque é assim que o CSS as consome. A tela mostra porcentagem e múltiplo,
   que é como se fala delas. A conversão fica aqui, num lugar só: espalhada,
   ela vira o tipo de divergência em que o editor mostra 40% e a página aplica
   0,4% — ou 40 vezes.
   ──────────────────────────────────────────────────────────────────────────── */

function Deslizante({ rotulo, valor, onChange, readOnly, min, max, paraTela, paraDoc, formatar }) {
  const naTela = Math.round(paraTela(valor));
  return (
    <label className="editor-field puck-deslizante">
      <span className="editor-field-label editor-field-label--split">
        {rotulo} <b>{formatar(naTela)}</b>
      </span>
      <input
        type="range"
        className="editor-range"
        min={min}
        max={max}
        value={naTela}
        disabled={readOnly}
        onChange={(e) => onChange(paraDoc(Number(e.target.value)))}
      />
    </label>
  );
}

function campo(rotulo, opcoes) {
  return {
    type: "custom",
    label: rotulo,
    render: ({ value, onChange, readOnly }) => (
      <Deslizante rotulo={rotulo} valor={value} onChange={onChange} readOnly={readOnly} {...opcoes} />
    ),
  };
}

/** Quanto o banner é escurecido, de 0 a 100% — gravado de 0 a 1. */
export const campoEscurecer = campo("Escurecer o banner", {
  min: 0,
  max: 100,
  paraTela: (v) => (typeof v === "number" ? v : 0) * 100,
  paraDoc: (v) => v / 100,
  formatar: (v) => `${v}%`,
});

/** O brilho do banner, de 30% a 200% — gravado como múltiplo (1 = normal). */
export const campoBrilho = campo("Brilho do banner", {
  min: 30,
  max: 200,
  paraTela: (v) => (typeof v === "number" ? v : 1) * 100,
  paraDoc: (v) => v / 100,
  formatar: (v) => `${(v / 100).toFixed(1)}×`,
});
