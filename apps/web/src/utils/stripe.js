/* ────────────────────────────────────────────────────────────────────────────
   Carregador do Stripe.js.

   O script vem do domínio do Stripe de propósito — e não de um pacote npm.
   É exigência deles: o arquivo precisa ser buscado em js.stripe.com a cada
   carga para que correções de segurança cheguem na hora, e é isso que mantém
   a integração dentro do SAQ A do PCI (o formulário mais leve). Empacotar uma
   cópia quebraria as duas coisas.

   Injetamos a tag à mão em vez de usar @stripe/stripe-js: o pacote oficial é
   um invólucro fino em volta deste mesmo carregamento, e uma dependência a
   menos é uma dependência a menos.
   ──────────────────────────────────────────────────────────────────────────── */

const SRC = "https://js.stripe.com/v3/";
let promessa = null;

export function stripeConfigurado() {
  return Boolean(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
}

/** Devolve a instância do Stripe, ou null se a chave pública não estiver posta. */
export function carregarStripe() {
  const chave = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  if (!chave) return Promise.resolve(null);
  if (promessa) return promessa;

  promessa = new Promise((resolver, rejeitar) => {
    if (window.Stripe) {
      resolver(window.Stripe(chave));
      return;
    }
    const existente = document.querySelector(`script[src^="${SRC}"]`);
    const script = existente || document.createElement("script");
    script.addEventListener("load", () => {
      if (window.Stripe) resolver(window.Stripe(chave));
      else rejeitar(new Error("Stripe.js carregou sem expor window.Stripe."));
    });
    script.addEventListener("error", () => rejeitar(new Error("Falha ao carregar o Stripe.js.")));
    if (!existente) {
      script.src = SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  }).catch((erro) => {
    promessa = null; // deixa tentar de novo numa próxima abertura do modal
    throw erro;
  });

  return promessa;
}

/* Aparência do Elements alinhada ao painel (.ds-*), para o campo do cartão não
   parecer um enxerto claro no meio de uma interface escura. */
export const APARENCIA_STRIPE = {
  theme: "night",
  variables: {
    colorPrimary: "#818cf8",
    colorBackground: "#0f131c",
    colorText: "#e2e8f0",
    colorTextPlaceholder: "#64748b",
    colorDanger: "#f87171",
    fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
    borderRadius: "10px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": { border: "1px solid rgba(255,255,255,0.10)", boxShadow: "none" },
    ".Input:focus": { border: "1px solid rgba(129,140,248,0.6)", boxShadow: "none" },
    ".Label": { color: "#94a3b8", fontWeight: "600" },
  },
};
