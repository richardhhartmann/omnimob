import { useEffect, useRef } from "react";

/* ────────────────────────────────────────────────────────────────────────────
   IRIDESCÊNCIA — o fundo animado da seção de contato.

   Porte do `Iridescence` do React Bits (WebGL por `ogl`, um shader de tela
   cheia). Substituiu a névoa do Vanta que havia ali.

   ── OS DESVIOS DO ORIGINAL, E POR QUE CADA UM ──

   1. `useEffect` NÃO depende mais de `color`.

      O original tem `[color, speed, amplitude, mouseReact]` nas dependências, e
      `color` é um ARRAY. Quem chama escreve `color={[1, 1, 1]}` no JSX, o que
      cria um array novo a cada render — a comparação por identidade falha
      sempre, e o efeito derruba e reconstrói o contexto WebGL a cada render do
      pai. Contexto de WebGL é um recurso escasso (o navegador guarda poucos), e
      recriá-lo em laço é a forma mais rápida de derrubar a aba.

      Aqui as três componentes viajam como números separados nas dependências, e
      a cor é atualizada por uniforme quando muda — sem reconstruir nada.

   2. A limpeza não assume que o canvas ainda é filho.

      `ctn.removeChild(gl.canvas)` lança se o React já tiver desmontado a
      subárvore. `canvas.remove()` não se importa.

   3. O `resize` usa `ResizeObserver`, e não só o `resize` da janela.

      A seção muda de altura sem a janela mudar de tamanho — o conteúdo dela
      cresce quando as fontes carregam, e no celular a barra do navegador
      recolhe. Só com o evento da janela o shader ficava esticado.

   4. Ele não desenha se `ativo` for falso.

      Quem manda são as duas guardas da landing: `podeWebGL` (o orçamento de
      efeitos, ver `capacidadeDaMaquina.js`) e a proximidade da seção. Um shader
      de tela cheia rodando enquanto a pessoa lê o topo da página é custo puro,
      e foi a razão de a névoa antiga ganhar as mesmas travas.

   5. O `import` do `ogl` é DINÂMICO.

      Ele não pode entrar no pacote comum: quem abre a landing num celular
      fraco, ou com o nível de efeitos em `mínimo`, nunca vai desenhar isto — e
      não deve pagar o download.
   ──────────────────────────────────────────────────────────────────────────── */

/* Uma promessa só para o módulo inteiro. Duas seções que usassem o shader
   baixariam a biblioteca duas vezes sem isto. */
let promessaDoOgl = null;
const carregarOgl = () => {
  if (!promessaDoOgl) {
    promessaDoOgl = import("ogl").catch((erro) => {
      /* Falha de download não pode derrubar a página: o fundo é decoração, e a
         seção tem cor sólida por baixo. Zera a promessa para uma volta futura
         poder tentar de novo. */
      console.warn("[iridescencia] não consegui carregar o ogl:", erro?.message);
      promessaDoOgl = null;
      return null;
    });
  }
  return promessaDoOgl;
};

const VERTEX = `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0, 1);
}
`;

const FRAGMENT = `
precision highp float;

uniform float uTime;
uniform vec3 uColor;
uniform vec3 uResolution;
uniform vec2 uMouse;
uniform float uAmplitude;
uniform float uSpeed;

varying vec2 vUv;

void main() {
  float mr = min(uResolution.x, uResolution.y);
  vec2 uv = (vUv.xy * 2.0 - 1.0) * uResolution.xy / mr;

  uv += (uMouse - vec2(0.5)) * uAmplitude;

  float d = -uTime * 0.5 * uSpeed;
  float a = 0.0;
  for (float i = 0.0; i < 8.0; ++i) {
    a += cos(i - d - a * uv.x);
    d += sin(uv.y * i + a);
  }
  d += uTime * 0.5 * uSpeed;
  vec3 col = vec3(cos(uv * vec2(d, a)) * 0.6 + 0.4, cos(a + d) * 0.5 + 0.5);
  col = cos(col * cos(vec3(d, a, 2.5)) * 0.5 + 0.5) * uColor;
  gl_FragColor = vec4(col, 1.0);
}
`;

/**
 * @param {object} p
 * @param {[number, number, number]} p.cor  RGB de 0 a 1
 * @param {number} p.velocidade
 * @param {number} p.amplitude   quanto o ponteiro desloca o padrão
 * @param {boolean} p.seguirMouse
 * @param {boolean} p.ativo      falso = não cria contexto nenhum
 */
export function Iridescencia({
  cor = [1, 1, 1],
  velocidade = 1,
  amplitude = 0.1,
  seguirMouse = false,
  ativo = true,
  className = "",
}) {
  const caixaRef = useRef(null);
  const programaRef = useRef(null);
  const [r, g, b] = cor;

  useEffect(() => {
    const caixa = caixaRef.current;
    if (!ativo || !caixa) return undefined;

    let cancelado = false;
    let quadro = null;
    let observador = null;
    let aoRedimensionar = null;
    let aoMover = null;
    let contexto = null;

    carregarOgl().then((ogl) => {
      if (cancelado || !ogl || !caixaRef.current) return;
      const { Renderer, Program, Mesh, Color, Triangle } = ogl;

      const renderer = new Renderer();
      const gl = renderer.gl;
      contexto = gl;
      gl.clearColor(1, 1, 1, 1);

      const medir = () => {
        /* Piso de 1px: a seção pode estar com altura zero no primeiro quadro
           (fontes ainda carregando), e `setSize(0, 0)` deixa o canvas inválido
           — ele nunca mais volta sozinho quando a altura chega. */
        const l = Math.max(1, caixa.offsetWidth);
        const a = Math.max(1, caixa.offsetHeight);
        renderer.setSize(l, a);
        if (programaRef.current) {
          programaRef.current.uniforms.uResolution.value = new Color(
            gl.canvas.width,
            gl.canvas.height,
            gl.canvas.width / gl.canvas.height,
          );
        }
      };
      medir();

      const programa = new Program(gl, {
        vertex: VERTEX,
        fragment: FRAGMENT,
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new Color(r, g, b) },
          uResolution: {
            value: new Color(gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height),
          },
          uMouse: { value: new Float32Array([0.5, 0.5]) },
          uAmplitude: { value: amplitude },
          uSpeed: { value: velocidade },
        },
      });
      programaRef.current = programa;
      medir(); // agora com o programa de pé, para a resolução entrar no uniforme

      const malha = new Mesh(gl, { geometry: new Triangle(gl), program: programa });

      aoRedimensionar = () => medir();
      window.addEventListener("resize", aoRedimensionar, false);
      /* A seção muda de altura sem a janela mudar — ver o desvio 3 no cabeçalho. */
      if (typeof ResizeObserver !== "undefined") {
        observador = new ResizeObserver(medir);
        observador.observe(caixa);
      }

      if (seguirMouse) {
        aoMover = (e) => {
          const cx = caixa.getBoundingClientRect();
          programa.uniforms.uMouse.value[0] = (e.clientX - cx.left) / cx.width;
          programa.uniforms.uMouse.value[1] = 1 - (e.clientY - cx.top) / cx.height;
        };
        caixa.addEventListener("mousemove", aoMover);
      }

      const desenhar = (t) => {
        quadro = requestAnimationFrame(desenhar);
        programa.uniforms.uTime.value = t * 0.001;
        renderer.render({ scene: malha });
      };
      quadro = requestAnimationFrame(desenhar);
      caixa.appendChild(gl.canvas);
    });

    return () => {
      cancelado = true;
      if (quadro) cancelAnimationFrame(quadro);
      if (aoRedimensionar) window.removeEventListener("resize", aoRedimensionar);
      if (aoMover) caixa.removeEventListener("mousemove", aoMover);
      observador?.disconnect();
      programaRef.current = null;
      /* `remove()` e não `removeChild`: o React pode já ter levado a subárvore,
         e aí o `removeChild` lança. Ver o desvio 2. */
      contexto?.canvas?.remove();
      /* Devolve o contexto ao navegador na hora. Sem isto ele espera o coletor
         de lixo, e quem rola a página para cima e para baixo acumula contextos
         até o navegador começar a descartar os mais antigos — o sintoma é a
         névoa de OUTRA seção sumir sozinha. */
      contexto?.getExtension("WEBGL_lose_context")?.loseContext();
    };
    /* `cor` entra desmontada em três números — ver o desvio 1. */
  }, [ativo, r, g, b, velocidade, amplitude, seguirMouse]);

  return <div ref={caixaRef} className={`iridescencia ${className}`.trim()} aria-hidden="true" />;
}
