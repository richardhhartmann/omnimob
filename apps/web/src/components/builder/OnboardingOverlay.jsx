import { createPortal } from "react-dom";
import { IconeLapis, IconeMouse, IconeRedimensionar } from "../Icones.jsx";

/* Ícone desenhado, não emoji: estes cinco cartões ficam lado a lado, e um 🖱️
   colorido do sistema ao lado de um ⠿ monocromático da fonte lia como duas
   linguagens diferentes na mesma lista. Os que não têm desenho — o grip de seis
   pontos e o atalho ⌘Z — continuam texto, porque é isso que eles são: o glifo
   que aparece no próprio editor e uma tecla. */

export function OnboardingOverlay({ onDismiss }) {
  const tips = [
    { Icone: IconeMouse, title: "Clique para selecionar", desc: "Clique em qualquer bloco do canvas para editá-lo. Os controles de estilo aparecem no painel direito." },
    { texto: "⠿", title: "Arraste para mover", desc: "Arraste pelo ícone de seis pontos no topo de cada bloco para reposicioná-lo livremente." },
    { Icone: IconeRedimensionar, title: "Redimensione", desc: "O triângulo no canto inferior direito de cada bloco permite ajustar largura e altura." },
    { Icone: IconeLapis, title: "Edição inline", desc: "Clique diretamente no texto do canvas para editar. Selecione palavras para mudar cor e fonte." },
    { texto: "⌘Z", title: "Desfazer / Refazer", desc: "Ctrl+Z desfaz e Ctrl+Y (ou Ctrl+Shift+Z) refaz qualquer ação no editor." },
  ];

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
      onClick={onDismiss}
    >
      <div
        style={{ background: "#1e293b", borderRadius: "24px", padding: "40px", maxWidth: "500px", width: "100%", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 30px 60px rgba(0,0,0,0.6)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontSize: "24px", fontWeight: "700", marginBottom: "6px", color: "#fff" }}>Bem-vindo ao Editor de Vitrine</h2>
        <p style={{ color: "rgba(255,255,255,0.6)", marginBottom: "28px", fontSize: "14px", lineHeight: "1.6" }}>
          Monte sua página arrastando e personalizando cada bloco. Aqui está tudo que você precisa saber:
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "32px" }}>
          {tips.map(({ Icone, texto, title, desc }) => (
            <div key={title} style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
              <span style={{ fontSize: "18px", flexShrink: 0, width: "32px", display: "flex", alignItems: "center", justifyContent: "center", color: "#a5b4fc" }}>
                {Icone ? <Icone size={21} /> : texto}
              </span>
              <div>
                <strong style={{ fontSize: "14px", display: "block", marginBottom: "3px", color: "#fff" }}>{title}</strong>
                <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.55)", lineHeight: "1.5" }}>{desc}</span>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onDismiss}
          style={{ width: "100%", padding: "14px", borderRadius: "12px", background: "var(--accent, #818cf8)", color: "#fff", fontWeight: "700", border: "none", cursor: "pointer", fontSize: "15px", transition: "opacity 0.2s" }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.9"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
        >
          Entendido — vamos começar!
        </button>
      </div>
    </div>,
    document.body
  );
}
