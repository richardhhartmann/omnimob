// Efeito de flare radial ao clicar em cards/botões com a classe .pg-follow.
// Cria um elemento temporário (.ripple-drop) que surge no ponto do clique e
// se expande esmaecendo, na cor informada. É removido ao fim da animação.
// O CSS está em styles.css.
//
// O alvo precisa ter position:relative + overflow:hidden (garantidos pela
// classe .pg-follow). `color` deve ser uma cor CSS sólida (ex.: accent hex).
export function spawnRipple(event, color = "rgba(255,255,255,0.85)") {
  const el = event.currentTarget;
  if (!el) return;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const x = event.clientX - r.left;
  const y = event.clientY - r.top;

  const ripple = document.createElement("span");
  ripple.className = "ripple-drop";
  const size = Math.max(r.width, r.height) * 1.3;
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.setProperty("--ripple-color", color);
  ripple.addEventListener("animationend", () => ripple.remove());

  el.appendChild(ripple);
}
