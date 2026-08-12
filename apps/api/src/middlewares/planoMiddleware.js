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

/* Domínio próprio da vitrine → Profissional+.
   Não protege a leitura nem a remoção, de propósito: a tela precisa poder
   MOSTRAR o recurso a quem está no Básico (é assim que ele vira convite para
   assinar), e quem baixa de plano tem que continuar podendo desfazer o que
   configurou — travar a saída prenderia o domínio da pessoa aqui dentro. */
export const requirePlanoDominio = requirePlano(1, "Profissional");

// Tour virtual 360° → Profissional+ (usado para validar o flag is360 nas imagens).
export function planoPermiteTour360(plano) {
  return nivelDoPlano(plano) >= 1;
}

/* Nome e o que cada plano libera — para textos voltados ao cliente (e-mail de
   confirmação, por exemplo). Espelha PLANOS em apps/web/src/utils/planos.js;
   as regras de liberação continuam sendo as do nível, acima. */
const NOME = { BASICO: "Básico", PROFISSIONAL: "Profissional", PREMIUM: "Premium" };

export function planoInfo(plano) {
  const chave = String(plano || "").toUpperCase();
  const nivel = nivelDoPlano(chave);
  return {
    chave: NOME[chave] ? chave : "BASICO",
    nome: NOME[chave] || NOME.BASICO,
    nivel,
    redes: nivel >= 1,
    tour360: nivel >= 1,
    dominio: nivel >= 1,
    ia: nivel >= 2,
  };
}
