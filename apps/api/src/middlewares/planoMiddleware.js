// Bloqueia recursos conforme o plano do tenant (defesa em profundidade — o
// frontend já esconde, mas a API também garante).
//   BASICO (0) < PROFISSIONAL (1) < PREMIUM (2)
//   - Redes sociais → Profissional+
//   - Recursos de IA → Premium

const NIVEL = { BASICO: 0, PROFISSIONAL: 1, PREMIUM: 2 };

function nivelDoPlano(plano) {
  return NIVEL[String(plano || "").toUpperCase()] ?? 0;
}

export function requirePlano(minNivel, nomePlano) {
  return (req, res, next) => {
    if (nivelDoPlano(req.tenant?.plano) >= minNivel) return next();
    return res.status(403).json({ error: `Recurso disponível a partir do plano ${nomePlano}.` });
  };
}

export const requirePlanoRedes = requirePlano(1, "Profissional");
export const requirePlanoIA = requirePlano(2, "Premium");

// Tour virtual 360° → Profissional+ (usado para validar o flag is360 nas imagens).
export function planoPermiteTour360(plano) {
  return nivelDoPlano(plano) >= 1;
}
