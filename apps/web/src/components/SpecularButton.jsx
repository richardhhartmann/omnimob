import { useRef, useEffect } from "react";
import { Renderer, Program, Mesh, Triangle, Color } from "ogl";
import "./SpecularButton.css";

/* ────────────────────────────────────────────────────────────────────────────
   SpecularButton — botão com um brilho especular correndo pela borda.

   Do React Bits. Três desvios do original, todos pelo mesmo motivo: o original
   é feito para UM botão numa página vazia, e aqui são dezesseis numa landing
   que já tem outras cenas 3D.

   1. O CONTEXTO WebGL É SOB DEMANDA. No original cada instância cria um
      Renderer na montagem e roda um requestAnimationFrame para sempre. Dezesseis
      botões seriam dezesseis contextos vivos o tempo todo — e o navegador
      segura uns dezesseis por página no total, contando os três do Vanta e o do
      GhostCursor que esta página já tem. Passando do teto, o mais antigo é
      DERRUBADO, e o sintoma aparece longe daqui: a névoa de uma outra seção
      apaga sozinha (ver o comentário do forceContextLoss em GhostCursor.jsx).

      Como o brilho só existe quando o ponteiro está a menos de `proximity`, o
      contexto também só precisa existir aí. Na prática ficam um ou dois vivos.

   2. UM listener de pointermove PARA TODOS. O original registra um por
      instância, e cada um chama getBoundingClientRect a cada movimento do
      mouse: dezesseis medições forçando layout por evento. Aqui há um só, num
      quadro de animação, que percorre os inscritos.

   3. O TRAÇO ESCURO DA BORDA saiu do shader e virou borda de CSS. No original
      ele é desenhado junto com o brilho, e some junto com o contexto — o botão
      mudaria de aparência ao cursor se aproximar. Em CSS ele está sempre lá, e
      o canvas passa a desenhar só o que é de fato transitório.

   Também aceita `as` (para <a>): metade dos CTAs desta página são links de
   verdade, e trocar por <button> quebraria abrir em nova aba.
   ──────────────────────────────────────────────────────────────────────────── */

const PAD = 20;

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;

uniform vec2 uCenter;
uniform vec2 uHalfSize;
uniform float uRadius;
uniform float uAngle;
uniform float uPx;
uniform vec3 uLineColor;
uniform float uIntensity;
uniform float uShineSize;
uniform float uShineFade;
uniform float uThickness;

out vec4 fragColor;

float sdRoundedRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float gaussianLine(float d, float sigma) {
  float x = d / (sigma + 1e-6);
  float k = mix(1.0, 1.6, smoothstep(0.0, 1.5, x));
  return exp(-k * x * x);
}

void main() {
  vec2 p = gl_FragCoord.xy - uCenter;
  float d = sdRoundedRect(p, uHalfSize, uRadius);
  vec2 L = vec2(cos(uAngle), sin(uAngle));

  /* Especular simétrico: as bordas viradas para a luz e as viradas para o lado
     oposto pegam o traço. A janela angular é medida com uma normal elíptica,
     para variar continuamente ao longo dos lados retos.

     O traço escuro de base que existia aqui virou borda de CSS — ver o cabeçalho
     do arquivo. Sem ele, o shader desenha SÓ o que é transitório. */
  vec2 nEll = normalize(p / (uHalfSize * uHalfSize) + 1e-6);
  float phi = acos(clamp(abs(dot(nEll, L)), 0.0, 1.0));
  float rim = 1.0 - smoothstep(uShineSize - uShineFade, uShineSize + uShineFade + 1e-4, phi);
  float line = gaussianLine(d, uThickness);
  float edgeClamp = 1.0 - smoothstep(0.5 * uPx, 3.0 * uPx, abs(d));
  float hi = line * rim * edgeClamp * uIntensity;

  fragColor = vec4(uLineColor * hi, clamp(hi, 0.0, 1.0));
}
`;

/* ── Registro compartilhado ──────────────────────────────────────────────────
   Um único pointermove para a página inteira. Cada botão montado se inscreve
   com uma função que recebe a distância até o ponteiro e o ângulo da luz; quem
   decide ligar ou desligar o próprio contexto é o botão. */
const inscritos = new Set();
let quadroPendente = 0;
let ultimoEvento = null;

function aoMoverPonteiro(e) {
  ultimoEvento = e;
  if (quadroPendente) return;
  quadroPendente = requestAnimationFrame(() => {
    quadroPendente = 0;
    const ev = ultimoEvento;
    if (!ev) return;
    inscritos.forEach((avisar) => avisar(ev));
  });
}

function inscrever(avisar) {
  if (inscritos.size === 0) {
    window.addEventListener("pointermove", aoMoverPonteiro, { passive: true });
  }
  inscritos.add(avisar);
  return () => {
    inscritos.delete(avisar);
    if (inscritos.size === 0) {
      window.removeEventListener("pointermove", aoMoverPonteiro);
      cancelAnimationFrame(quadroPendente);
      quadroPendente = 0;
      ultimoEvento = null;
    }
  };
}

const SpecularButton = ({
  children = "Get Started",
  as: Tag = "button",
  size = "lg",
  radius = 18,
  tint = "#ffffff",
  tintOpacity = 0,
  blur = 0,
  textColor = "#f5f5f5",
  lineColor = "#ffffff",
  baseColor = "#525252",
  intensity = 1,
  shineSize = 10,
  shineFade = 40,
  thickness = 1,
  speed = 0.35,
  followMouse = true,
  proximity = 250,
  autoAnimate = false,
  disabled = false,
  onClick,
  className = "",
  type = "button",
  style,
  /* Por padrão o conteúdo vai dentro de um <span> que o põe acima do canvas.
     Com `envolver={false}` os filhos entram soltos, e é quem usa que cuida do
     empilhamento — necessário quando o botão tem layout PRÓPRIO (uma grade, no
     caso dos cartões de escolha do modal): dentro do span, os quatro filhos
     viram um item de grade só e as linhas da grade deixam de existir.

     O canvas não atrapalha nem assim, porque é absoluto — elemento posicionado
     fora do fluxo não vira item de grade nem de flex. */
  envolver = true,
  ...resto
}) => {
  const btnRef = useRef(null);
  const fxRef = useRef(null);
  const propsRef = useRef({});
  const glRef = useRef(null);

  propsRef.current = {
    radius, lineColor, intensity, shineSize, shineFade,
    thickness, speed, followMouse, proximity, autoAnimate,
  };

  useEffect(() => {
    const btn = btnRef.current;
    const fx = fxRef.current;
    if (!btn || !fx) return undefined;

    /* Com "reduzir movimento" o brilho não entra: ele é uma luz varrendo a
       borda, e não há versão parada dele que queira dizer a mesma coisa. A
       borda de CSS continua, então o botão não muda de forma. */
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    let vivo = true;
    let anguloPonteiro = null;
    let proximidade = 0;

    // ── Criação e destruição do contexto ──────────────────────────────────
    function montarGL() {
      if (glRef.current) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const renderer = new Renderer({ alpha: true, premultipliedAlpha: true, antialias: true, dpr });
      const gl = renderer.gl;
      gl.clearColor(0, 0, 0, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      const geometry = new Triangle(gl);
      if (geometry.attributes.uv) delete geometry.attributes.uv;

      const program = new Program(gl, {
        vertex: VERT,
        fragment: FRAG,
        uniforms: {
          uCenter: { value: [0, 0] },
          uHalfSize: { value: [1, 1] },
          uRadius: { value: 0 },
          uAngle: { value: 2.4 },
          uPx: { value: dpr },
          uLineColor: { value: [1, 1, 1] },
          uIntensity: { value: 0 },
          uShineSize: { value: 0.17 },
          uShineFade: { value: 0.7 },
          uThickness: { value: 1 },
        },
      });

      const mesh = new Mesh(gl, { geometry, program });
      fx.appendChild(gl.canvas);

      const medida = { w: 1, h: 1 };
      const redimensionar = () => {
        /* Tamanho fracionário + centro explícito mantêm o SDF colado na borda
           exata do CSS, em vez de derivar até um pixel pelo arredondamento de
           offsetWidth. */
        const r = btn.getBoundingClientRect();
        medida.w = r.width;
        medida.h = r.height;
        renderer.setSize(r.width + PAD * 2, r.height + PAD * 2);
        program.uniforms.uCenter.value = [(PAD + r.width / 2) * dpr, (PAD + r.height / 2) * dpr];
        program.uniforms.uHalfSize.value = [(r.width / 2) * dpr, (r.height / 2) * dpr];
      };
      const ro = new ResizeObserver(redimensionar);
      ro.observe(btn);
      redimensionar();

      const corLinha = new Color();
      let angulo = anguloPonteiro ?? 2.4;
      let anguloOcioso = angulo;
      let brilho = 0;
      let anterior = performance.now();
      let raf = 0;

      const desenhar = (agora) => {
        if (!vivo) return;
        const dt = Math.min((agora - anterior) / 1000, 0.05);
        anterior = agora;
        const p = propsRef.current;

        anguloOcioso += p.speed * dt;
        const guiar = p.followMouse && anguloPonteiro != null && (!p.autoAnimate || proximidade > 0);
        const alvo = guiar ? anguloPonteiro : anguloOcioso;
        const dif = ((alvo - angulo + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        angulo += dif * (1 - Math.exp(-dt * 7));

        const alvoBrilho = p.autoAnimate ? 1 : proximidade;
        brilho += (alvoBrilho - brilho) * (1 - Math.exp(-dt * 8));

        corLinha.set(p.lineColor);
        program.uniforms.uAngle.value = angulo;
        program.uniforms.uRadius.value = Math.min(p.radius, Math.min(medida.w, medida.h) / 2) * dpr;
        program.uniforms.uLineColor.value = [corLinha.r, corLinha.g, corLinha.b];
        program.uniforms.uIntensity.value = p.intensity * brilho;
        program.uniforms.uShineSize.value = (p.shineSize * Math.PI) / 180;
        program.uniforms.uShineFade.value = (p.shineFade * Math.PI) / 180;
        program.uniforms.uThickness.value = p.thickness * dpr;
        renderer.render({ scene: mesh });

        /* Apagado e com o ponteiro longe: devolve o contexto. O teto de brilho
           é o que impede o desmonte no meio do esmaecimento — sem ele o brilho
           sumiria de estalo ao cruzar a fronteira de `proximity`. */
        if (!propsRef.current.autoAnimate && proximidade === 0 && brilho < 0.004) {
          desmontarGL();
          return;
        }
        raf = requestAnimationFrame(desenhar);
      };
      raf = requestAnimationFrame(desenhar);

      glRef.current = {
        parar() {
          cancelAnimationFrame(raf);
          ro.disconnect();
          geometry.remove?.();
          program.remove?.();
          if (gl.canvas.parentNode === fx) fx.removeChild(gl.canvas);
          // É isto que devolve o contexto de verdade; sem ele o navegador o
          // segura e continua contando para o teto da página.
          gl.getExtension("WEBGL_lose_context")?.loseContext();
        },
      };
    }

    function desmontarGL() {
      const atual = glRef.current;
      if (!atual) return;
      glRef.current = null;
      atual.parar();
    }

    // ── Proximidade ───────────────────────────────────────────────────────
    const avaliar = (e) => {
      if (!vivo) return;
      const r = btn.getBoundingClientRect();
      // Fora da tela não há o que acender, e nem vale medir mais nada.
      if (r.bottom < 0 || r.top > window.innerHeight || r.width === 0) {
        proximidade = 0;
        return;
      }
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = Math.max(r.left - e.clientX, 0, e.clientX - r.right);
      const dy = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom);
      const dist = Math.hypot(dx, dy);

      /* Em cima do próprio botão a luz assenta na diagonal (emoldurando os
         cantos) e balança de leve com a posição do cursor dentro dele. */
      if (dist === 0) {
        const nx = (e.clientX - cx) / (r.width / 2);
        const ny = (cy - e.clientY) / (r.height / 2);
        anguloPonteiro = Math.atan2(2 / r.height, -2 / r.width) + nx * 0.3 + ny * 0.15;
      } else {
        anguloPonteiro = Math.atan2(cy - e.clientY, e.clientX - cx);
      }

      const t = Math.max(0, 1 - dist / Math.max(propsRef.current.proximity, 1));
      proximidade = t * t * (3 - 2 * t);
      if (proximidade > 0) montarGL();
    };

    const desinscrever = inscrever(avaliar);
    if (autoAnimate) montarGL();

    return () => {
      vivo = false;
      desinscrever();
      desmontarGL();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAnimate]);

  const classes = [
    "specular-button",
    `specular-button--${size}`,
    className,
  ].filter(Boolean).join(" ");

  return (
    <Tag
      ref={btnRef}
      // `type` e `disabled` são de <button>; num <a> viram atributos inválidos.
      {...(Tag === "button" ? { type, disabled } : {})}
      onClick={onClick}
      className={classes}
      style={{
        "--sb-radius": `${radius}px`,
        "--sb-tint": tint,
        "--sb-tint-opacity": tintOpacity,
        "--sb-blur": `${blur}px`,
        "--sb-text-color": textColor,
        "--sb-base-color": baseColor,
        ...style,
      }}
      {...resto}
    >
      <span ref={fxRef} className="specular-button__fx" aria-hidden="true" />
      {envolver ? <span className="specular-button__label">{children}</span> : children}
    </Tag>
  );
};

export default SpecularButton;
