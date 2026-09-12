import { useState } from "react";
import { api } from "../api";
import { BUILDER_TEMPLATES } from "./builder/data/templates";
import { PreviaDoModelo } from "./builder/data/PreviaDoModelo.jsx";
import { normalizeShowcaseConfig } from "../utils/showcaseConfig";

/* ────────────────────────────────────────────────────────────────────────────
   O passo do MODELO da vitrine, no assistente de boas-vindas.

   Toda conta nascia com a mesma vitrine — a montagem padrão — e a maioria
   nunca abria o editor para trocar. Aqui a escolha é OBRIGATÓRIA: não há
   "pular", e o "Continuar" só acende com um cartão marcado. Não é rigidez por
   gosto: escolher um modelo é o primeiro gesto de posse sobre a página, e é
   ele que faz a pessoa entender que a vitrine é dela e se edita.

   Os modelos são os MESMOS do editor (`builder/data/templates.jsx`), e é o
   mesmo `config` que a gaveta "Modelos de página" aplica lá. Uma lista própria
   aqui divergiria no primeiro modelo novo. "Em branco" é a montagem mínima:
   cabeçalho, grade de imóveis e rodapé, sem peça nenhuma — para quem prefere
   montar do zero.

   A gravação é a MESMA da vitrine: `PUT /me` com o `showcaseConfig`. O
   documento do editor novo (`puck`), se houver, sai junto — senão a vitrine
   continuaria desenhando pelo documento antigo e a escolha não apareceria.
   ──────────────────────────────────────────────────────────────────────────── */

export const MODELO_EM_BRANCO = {
  id: "em-branco",
  name: "Em branco",
  desc: "Só cabeçalho, imóveis e rodapé — você monta o resto",
  primaryColor: "#6366f1",
  secondaryColor: "#d4af37",
  config: { appearanceMode: "dark", widgets: [], hiddenBlocks: ["title", "highlights"] },
};

/** O `showcaseConfig` gravado para um modelo escolhido, a partir do atual. */
export function configDoModelo(atual, modelo) {
  const base = normalizeShowcaseConfig(atual);
  const { puck, ...semPuck } = base;
  /* `modeloEscolhido` é a marca de que este passo foi cumprido: é por ela que
     a recepção seguinte (teste → assinante) não pede a escolha de novo. */
  return { ...semPuck, ...modelo.config, modeloEscolhido: modelo.id };
}

export function ModeloDaVitrinePasso({ tenantSlug, configAtual, aoConcluir, aoAtualizarTenant }) {
  const [escolhido, setEscolhido] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const modelos = [...BUILDER_TEMPLATES, MODELO_EM_BRANCO];

  async function aplicar() {
    const modelo = modelos.find((m) => m.id === escolhido);
    if (!modelo) return;
    setSalvando(true);
    setErro("");
    try {
      const campos = {
        showcaseConfig: configDoModelo(configAtual, modelo),
        primaryColor: modelo.primaryColor,
        secondaryColor: modelo.secondaryColor,
      };
      await api.updateTenantProfile(tenantSlug, campos);
      aoAtualizarTenant?.(campos);
      aoConcluir?.(modelo);
    } catch (e) {
      setErro(e.message || "Não foi possível aplicar o modelo. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mod-corpo">
      <div className="mod-grade" role="radiogroup" aria-label="Modelo da vitrine">
        {modelos.map((m) => {
          const ativo = escolhido === m.id;
          return (
            <button
              key={m.id}
              type="button"
              className={`mod-cartao${ativo ? " is-ativo" : ""}`}
              role="radio"
              aria-checked={ativo}
              onClick={() => setEscolhido(m.id)}
              disabled={salvando}
            >
              {m.id === "em-branco" ? (
                <div className="mod-vazio" aria-hidden="true"><span>+</span></div>
              ) : (
                <PreviaDoModelo tpl={m} altura={170} />
              )}
              <strong>{m.name}</strong>
              <em>{m.desc}</em>
            </button>
          );
        })}
      </div>

      {/* O caminho de volta, dito antes de a pessoa decidir: a escolha não é
          para sempre, e saber disso é o que tira o medo de escolher. */}
      <p className="mod-caminho">
        Dá para trocar de modelo e mudar cada peça quando quiser: no painel, abra
        <strong> Vitrine › Editar página</strong>. Lá também está a lista completa de modelos.
      </p>

      {erro ? <p className="mod-erro">{erro}</p> : null}

      <button type="button" className="bv-botao" onClick={aplicar} disabled={!escolhido || salvando}>
        {salvando ? "Aplicando…" : escolhido ? "Usar este modelo" : "Escolha um modelo para continuar"}
      </button>
    </div>
  );
}

export const MODELO_CSS = `
.mod-corpo { display: flex; flex-direction: column; gap: 14px; text-align: left; }
.mod-grade { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; max-height: 50vh; overflow-y: auto; padding: 2px; }
.mod-cartao {
  display: flex; flex-direction: column; gap: 6px; text-align: left; width: 100%;
  padding: 8px; border-radius: 12px; cursor: pointer;
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); color: inherit;
  box-shadow: none; transform: none; transition: border-color 0.15s, background 0.15s;
}
.mod-cartao:hover { background: rgba(255,255,255,0.06); box-shadow: none; transform: none; }
.mod-cartao.is-ativo { border-color: #a78bfa; background: rgba(167,139,250,0.12); box-shadow: 0 0 0 2px rgba(167,139,250,0.35); }
.mod-cartao strong { font-size: 13px; }
.mod-cartao em { font-size: 11px; font-style: normal; color: var(--text-muted, #94a3b8); line-height: 1.4; }
.mod-vazio { height: 170px; border-radius: 8px; border: 1px dashed rgba(255,255,255,0.25); display: flex; align-items: center; justify-content: center; font-size: 26px; color: var(--text-muted, #94a3b8); }
.mod-caminho { margin: 0; font-size: 12.5px; line-height: 1.6; color: var(--text-muted, #94a3b8); }
.mod-erro { margin: 0; font-size: 12.5px; color: #fca5a5; }
@media (max-width: 560px) { .mod-grade { grid-template-columns: 1fr; } }
`;
