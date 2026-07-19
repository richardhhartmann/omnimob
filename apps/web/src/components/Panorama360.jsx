import { useEffect, useRef, useState } from "react";

// Viewer de panorama 360° equiretangular em WebGL puro (sem dependências).
// Renderiza um quad em tela cheia e, para cada pixel, projeta um raio a partir
// da orientação atual (yaw/pitch/fov), amostrando a imagem equiretangular.
// Arrastar gira a câmera; scroll dá zoom (altera o FOV).
//
// Uso: <Panorama360 src={urlEquiretangular} height={420} />
// A imagem precisa ser uma panorâmica equiretangular (proporção 2:1).

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uYaw;
uniform float uPitch;
uniform float uFov;
uniform sampler2D uTex;
#define PI 3.141592653589793

void main() {
  vec2 uv = (gl_FragCoord.xy / uRes) * 2.0 - 1.0;
  float aspect = uRes.x / uRes.y;
  uv.x *= aspect;
  float f = tan(uFov * 0.5);
  vec3 dir = normalize(vec3(uv * f, -1.0));

  // rotação em pitch (eixo X)
  float cp = cos(uPitch), sp = sin(uPitch);
  dir = vec3(dir.x, dir.y * cp - dir.z * sp, dir.y * sp + dir.z * cp);
  // rotação em yaw (eixo Y)
  float cy = cos(uYaw), sy = sin(uYaw);
  dir = vec3(dir.x * cy + dir.z * sy, dir.y, -dir.x * sy + dir.z * cy);

  float lon = atan(dir.x, -dir.z);
  float lat = asin(clamp(dir.y, -1.0, 1.0));
  vec2 t = vec2(lon / (2.0 * PI) + 0.5, 0.5 - lat / PI);
  gl_FragColor = texture2D(uTex, t);
}
`;

function compile(gl, type, source) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, source);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error("Shader: " + log);
  }
  return sh;
}

export function Panorama360({ src, height = 420 }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [hint, setHint] = useState(true);

  // Estado da câmera em refs (não força re-render a cada frame).
  const yaw = useRef(0);
  const pitch = useRef(0);
  const fov = useRef(1.15); // radianos (~66°)
  const drag = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: true, alpha: false });
    if (!gl) {
      setStatus("error");
      return;
    }

    let disposed = false;
    let raf = 0;
    let program, texture, uRes, uYaw, uPitch, uFov;

    try {
      program = gl.createProgram();
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program));
      }
      gl.useProgram(program);

      // Triângulo em tela cheia (cobre o viewport com folga).
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const aPos = gl.getAttribLocation(program, "aPos");
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      uRes = gl.getUniformLocation(program, "uRes");
      uYaw = gl.getUniformLocation(program, "uYaw");
      uPitch = gl.getUniformLocation(program, "uPitch");
      uFov = gl.getUniformLocation(program, "uFov");
    } catch {
      setStatus("error");
      return;
    }

    function resize() {
      if (!wrapRef.current) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = wrapRef.current.clientWidth;
      const h = wrapRef.current.clientHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    function render() {
      raf = 0;
      if (disposed || !texture) return;
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uYaw, yaw.current);
      gl.uniform1f(uPitch, pitch.current);
      gl.uniform1f(uFov, fov.current);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function requestRender() {
      if (!raf) raf = requestAnimationFrame(render);
    }

    const ro = new ResizeObserver(() => { resize(); requestRender(); });
    if (wrapRef.current) ro.observe(wrapRef.current);
    resize();

    // Carrega a textura equiretangular.
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (disposed) return;
      texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      // Sem flip vertical: o mapeamento V do shader (0.5 - lat/PI) já espera a
      // linha 0 da textura no topo da imagem (teto). Flipar deixaria de ponta-cabeça.
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      setStatus("ready");
      requestRender();
    };
    img.onerror = () => { if (!disposed) setStatus("error"); };
    img.src = src;

    // ── Interação ────────────────────────────────────────────────────────────
    function onDown(e) {
      drag.current = { x: e.clientX, y: e.clientY, yaw: yaw.current, pitch: pitch.current };
      canvas.setPointerCapture?.(e.pointerId);
      canvas.style.cursor = "grabbing";
      setHint(false);
    }
    function onMove(e) {
      if (!drag.current) return;
      const k = fov.current / canvas.clientHeight; // sensibilidade proporcional ao zoom
      // Sentido "grab" (igual Street View): arrastar p/ a direita gira a cena p/ a
      // esquerda e vice-versa.
      yaw.current = drag.current.yaw + (e.clientX - drag.current.x) * k;
      pitch.current = drag.current.pitch + (e.clientY - drag.current.y) * k;
      const lim = Math.PI / 2 - 0.02;
      pitch.current = Math.max(-lim, Math.min(lim, pitch.current));
      requestRender();
    }
    function onUp(e) {
      drag.current = null;
      canvas.releasePointerCapture?.(e.pointerId);
      canvas.style.cursor = "grab";
    }
    function onWheel(e) {
      e.preventDefault();
      fov.current = Math.max(0.5, Math.min(2.0, fov.current + (e.deltaY > 0 ? 0.08 : -0.08)));
      requestRender();
    }

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("wheel", onWheel);
      if (texture) gl.deleteTexture(texture);
      if (program) gl.deleteProgram(program);
    };
  }, [src]);

  return (
    <div
      ref={wrapRef}
      style={{
        position: "relative", width: "100%", height, borderRadius: "16px",
        overflow: "hidden", background: "#0b0e18", touchAction: "none",
      }}
    >
      <canvas ref={canvasRef} style={{ display: "block", cursor: "grab" }} />

      {status === "loading" && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.6)", fontSize: "13px" }}>
          Carregando tour 360°…
        </div>
      )}

      {status === "error" && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", gap: "6px", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.55)", fontSize: "13px", textAlign: "center", padding: "20px" }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="4.9" y1="4.9" x2="19.1" y2="19.1" />
          </svg>
          Não foi possível carregar o tour 360°.
        </div>
      )}

      {status === "ready" && hint && (
        <div style={{ position: "absolute", bottom: "12px", left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: "8px", padding: "7px 14px", borderRadius: "999px", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)", color: "#fff", fontSize: "12px", fontWeight: 600, pointerEvents: "none", whiteSpace: "nowrap" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8a6 6 0 0 0-9.33-5" /><path d="M6 16a6 6 0 0 0 9.33 5" /><polyline points="9 3 6 3 6 6" /><polyline points="15 21 18 21 18 18" />
          </svg>
          Arraste para olhar em volta · scroll para zoom
        </div>
      )}

      <span style={{ position: "absolute", top: "12px", left: "12px", display: "flex", alignItems: "center", gap: "6px", padding: "5px 11px", borderRadius: "999px", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)", color: "#fff", fontSize: "11px", fontWeight: 700, letterSpacing: "0.04em", pointerEvents: "none" }}>
        360°
      </span>
    </div>
  );
}
