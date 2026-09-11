import { useState } from "react";
import { mergeBlockWrapperStyle } from "../../utils/showcaseConfig";
import { ShowcaseTexto, useVitrine } from "./contexto.jsx";

/* Os três (ou mais) cartões de diferencial.

   ── ACRESCENTAR E REMOVER ACONTECE AQUI ──

   Isso morava no inspetor, numa lista de cartõezinhos com "Fundo" e "Texto"
   por destaque. Dois problemas de uma vez: era a terceira cópia dos mesmos
   itens na mesma tela, e a cor de cada cartão, aplicada por estilo inline,
   vencia em silêncio a cor do bloco logo acima — escolher uma cor no bloco não
   fazia nada e nada dizia por quê.

   Agora é a mesma gramática das etapas de "Como funciona" e dos chips de
   Região: o × remove o cartão, e depois do último vem um cartão com `+`.

   ── POR QUE ISTO PASSA POR `aoEditar` ──

   Acrescentar um destaque não é texto, mas entra pelo mesmo canal
   (`highlights|adicionar`, `highlights|remover|<i>`) porque é a única ponte que
   a vitrine tem com o construtor. Ela não conhece o editor — só sabe avisar que
   algo mudou, e quem decide o que fazer é `ShowcaseEditorPage`. Uma segunda
   ponte só para isto seria o editor vazando para dentro da vitrine, que é o
   defeito que esta pasta existe para não ter. */

/* Os dois ícones da área de transferência, em SVG inline.

   Inline e não de uma biblioteca porque este arquivo é da VITRINE: ele também
   é montado na página pública, e um ícone de 20px não justifica arrastar uma
   dependência de ícones para lá. São doze linhas de path. */
function IconeCopiar() {
  return (
    <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.6" />
      <path d="M10.5 3.2A1.7 1.7 0 0 0 8.9 2H4a2 2 0 0 0-2 2v4.9c0 .75.48 1.38 1.2 1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconeColar() {
  return (
    <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3.5" width="10" height="10.5" rx="1.8" />
      <path d="M6 3.5V2.8c0-.5.4-.9.9-.9h2.2c.5 0 .9.4.9.9v.7" strokeLinecap="round" />
      <path d="M6.2 8.9l1.4 1.4 2.6-2.8" strokeLinecap="round" />
    </svg>
  );
}

export function ShowcaseHighlights({ config, blockStyles }) {
  const { modo, aoEditar } = useVitrine();
  const ehEditor = modo === "editor" && Boolean(aoEditar);
  const total = config.highlights.length;

  /* O estilo copiado de um cartão, esperando ser colado noutro.

     Mora em estado local, e NÃO no `showcaseConfig`: é uma área de
     transferência, não conteúdo da página. Gravá-la no documento faria a
     escolha atravessar o autosave, aparecer no histórico de versões e viajar
     para a vitrine publicada — tudo isso para lembrar de algo que dura poucos
     segundos. Some ao sair da tela, e é o certo. */
  const [copiado, setCopiado] = useState(null);

  return (
    <section className="showcase-highlights" style={mergeBlockWrapperStyle(blockStyles?.highlights)}>
      {config.highlights.map((item, index) => {
        const hs = config.highlightStyles[index] || { backgroundColor: "", color: "" };
        const cor = hs.color ? { color: hs.color } : undefined;
        return (
          <div className="highlight-box" key={`highlight-${index}`} style={mergeBlockWrapperStyle(hs)}>
            <ShowcaseTexto as="h3" campo={`highlight|${index}|title`} umaLinha html={item.title} style={cor} />
            <ShowcaseTexto as="p" campo={`highlight|${index}|description`} html={item.description} style={cor} />
            {/* Com um só, o × some: a faixa sem nenhum cartão vira uma fatia de
                fundo colorido que ninguém sabe o que é nem como tirar. */}
            {/* ── A APARÊNCIA DO CARTÃO, NO CARTÃO ──────────────────────────
                Fundo e opacidade de CADA destaque, editados nele mesmo. Ficam
                escondidos até o ponteiro entrar — um seletor de cor sempre
                visível dentro do cartão competiria com o conteúdo dele.

                A opacidade é um controle à parte da cor porque o
                `<input type="color">` do navegador não fala alfa: cor e
                transparência são duas perguntas para ele, mesmo sendo uma só
                para quem olha. */}
            {ehEditor ? (
              <div className="widget-editor-apenas highlight-box__acoes">
                <label className={`editor-color highlight-box__cor${hs.backgroundColor ? "" : " is-auto"}`}
                  style={hs.backgroundColor ? { background: hs.backgroundColor } : undefined}
                  title={hs.backgroundColor ? `Fundo ${hs.backgroundColor}` : "Fundo automático"}
                >
                  {hs.backgroundColor ? null : <em>auto</em>}
                  <input
                    type="color"
                    value={hs.backgroundColor || "#1e293b"}
                    onChange={(e) => aoEditar(`estiloDestaque|${index}|backgroundColor`, e.target.value)}
                  />
                </label>

                <input
                  type="range"
                  className="highlight-box__opacidade"
                  min="0"
                  max="100"
                  /* Sem cor não há o que ficar transparente, então o controle
                     nasce desligado — e volta a 100 assim que uma cor entra. */
                  disabled={!hs.backgroundColor}
                  value={Math.round((hs.backgroundOpacity ?? 1) * 100)}
                  title={`Opacidade do fundo: ${Math.round((hs.backgroundOpacity ?? 1) * 100)}%`}
                  onChange={(e) => aoEditar(`estiloDestaque|${index}|backgroundOpacity`, Number(e.target.value) / 100)}
                />

                {/* Copiar e colar o estilo entre cartões. O botão TROCA de
                    papel conforme o estado: sem nada copiado ele copia; com
                    algo copiado, os OUTROS cartões passam a oferecer colar.
                    Dois botões permanentes ocupariam o dobro do espaço para
                    que um deles não fizesse nada na maior parte do tempo. */}
                {copiado && copiado.origem !== index ? (
                  <button
                    type="button"
                    className="highlight-box__estilo is-colar"
                    title="Colar aqui o estilo copiado"
                    aria-label="Colar aqui o estilo copiado"
                    onClick={() => aoEditar(`estiloDestaque|${index}|__tudo`, copiado.estilo)}
                  >
                    <IconeColar />
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`highlight-box__estilo${copiado?.origem === index ? " is-copiado" : ""}`}
                    title={copiado?.origem === index ? "Estilo copiado — clique para cancelar" : "Copiar o estilo deste destaque"}
                    aria-label={copiado?.origem === index ? "Estilo copiado. Clique para cancelar" : "Copiar o estilo deste destaque"}
                    aria-pressed={copiado?.origem === index}
                    onClick={() => setCopiado(
                      copiado?.origem === index
                        ? null
                        : { origem: index, estilo: { backgroundColor: hs.backgroundColor, backgroundOpacity: hs.backgroundOpacity, color: hs.color } },
                    )}
                  >
                    <IconeCopiar />
                  </button>
                )}

                {total > 1 ? (
                  <button
                    type="button"
                    className="highlight-box__tirar"
                    title="Remover este destaque"
                    onClick={() => aoEditar(`highlights|remover|${index}`, "")}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}

      {ehEditor ? (
        <button
          type="button"
          className="widget-editor-apenas highlight-box highlight-box--mais"
          onClick={() => aoEditar("highlights|adicionar", "")}
        >
          + Destaque
        </button>
      ) : null}
    </section>
  );
}
