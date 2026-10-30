import { prisma } from "../db.js";

/* ────────────────────────────────────────────────────────────────────────────
   AS SESSÕES DO PAINEL — quem está conectado, de onde, desde quando.

   O token é JWT sem estado: até aqui não havia lista de sessões, só a de
   REVOGADAS (`SessaoRevogada`, o "sair"). A sessão passa a ser registrada no
   PRIMEIRO USO, pelo `requireAuth`, a partir do `jti` que todo token já
   carrega — então toda origem (senha, Google, demonstração, reativação,
   "Entrar" do suporte) entra sem ninguém lembrar de chamar nada.

   O uso é regravado no máximo de 5 em 5 minutos por sessão: o `requireAuth`
   roda em toda requisição, e uma escrita por requisição dobraria a carga do
   banco para saber "visto por último há 3 min" em vez de "há 5". A memória de
   quando foi a última escrita é do processo; reiniciar só antecipa uma.

   Disparado e esquecido: registrar a sessão nunca atrasa nem derruba a
   requisição de verdade.
   ──────────────────────────────────────────────────────────────────────────── */

const INTERVALO_MS = 5 * 60 * 1000;
const ultimaEscrita = new Map(); // jti → ms

/** Vale escrever agora? Pura no relógio (o teste passa o `agora`). */
export function deveRegistrarUso(jti, agora = Date.now()) {
  if (!jti) return false;
  const ultima = ultimaEscrita.get(jti);
  if (ultima !== undefined && agora - ultima < INTERVALO_MS) return false;
  ultimaEscrita.set(jti, agora);
  // Não deixa o mapa crescer com sessões que já pararam de chegar.
  if (ultimaEscrita.size > 5000) {
    for (const [k, t] of ultimaEscrita) if (agora - t > INTERVALO_MS) ultimaEscrita.delete(k);
  }
  return true;
}

/** Registra (ou toca) a sessão deste token. Nunca lança, nunca é aguardada. */
export function registrarUsoDaSessao({ payload, usuario, tipo, req }) {
  try {
    if (!deveRegistrarUso(payload?.jti)) return;
    const ip = String(req.ip || req.headers["x-forwarded-for"] || "").slice(0, 60) || null;
    prisma.sessaoUsuario
      .upsert({
        where: { jti: payload.jti },
        update: { ultimoUsoEm: new Date(), ip },
        create: {
          jti: payload.jti,
          usuarioId: usuario.id,
          tenantId: usuario.tenantId,
          tipo,
          ip,
          userAgent: String(req.headers["user-agent"] || "").slice(0, 300) || null,
          criadaEm: payload.iat ? new Date(payload.iat * 1000) : new Date(),
          expiraEm: payload.exp ? new Date(payload.exp * 1000) : new Date(Date.now() + 7 * 864e5),
        },
      })
      .catch(() => {});
  } catch { /* acessório */ }
}

/** "Chrome no Windows", "Safari no iPhone" — o bastante para a pessoa se reconhecer. */
export function dispositivoDe(userAgent = "") {
  const ua = String(userAgent);
  const navegador = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome"
    : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  const sistema = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android"
    : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "";
  return sistema ? `${navegador} no ${sistema}` : navegador;
}
