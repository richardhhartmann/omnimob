// Faz o gradiente/realce dos botões e cards seguirem o ponteiro (estilo Windows).
// Um único listener global atualiza variáveis CSS no elemento sob o cursor:
//   --px / --py  → posição do cursor (%) — usado no realce radial dos botões
//   --pg-angle   → ângulo do centro até o cursor — usado em gradientes direcionais
//
// O CSS que consome essas variáveis está em styles.css (botões) e nos cards de
// menu (classe .pg-follow).

export function initPointerGradient() {
  let el = null;
  let clientX = 0;
  let clientY = 0;
  let frame = 0;

  function apply() {
    frame = 0;
    if (!el || !el.isConnected) return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const x = clientX - r.left;
    const y = clientY - r.top;
    el.style.setProperty("--px", `${((x / r.width) * 100).toFixed(1)}%`);
    el.style.setProperty("--py", `${((y / r.height) * 100).toFixed(1)}%`);
    const dx = x - r.width / 2;
    const dy = y - r.height / 2;
    // Inverte (atan2(-dx, dy)) para que a parte COLORIDA do gradiente (stop 0%)
    // aponte para o cursor, e não a parte transparente.
    el.style.setProperty("--pg-angle", `${((Math.atan2(-dx, dy) * 180) / Math.PI).toFixed(1)}deg`);
  }

  function onMove(e) {
    const target = e.target?.closest?.(".pg-follow");
    if (!target) return;
    el = target;
    clientX = e.clientX;
    clientY = e.clientY;
    if (!frame) frame = requestAnimationFrame(apply);
  }

  document.addEventListener("pointermove", onMove, { passive: true });
  return () => {
    document.removeEventListener("pointermove", onMove);
    if (frame) cancelAnimationFrame(frame);
  };
}
