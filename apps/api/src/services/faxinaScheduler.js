import { limparTrials } from "./trialService.js";

/**
 * ─── Agendador da faxina de trials ───────────────────────────────────────────
 * O projeto ainda não tem um scheduler de verdade (fila, cron distribuído).
 * Este é o mínimo que resolve enquanto isso: um intervalo dentro do próprio
 * processo da API.
 *
 * DESLIGADO POR PADRÃO, por dois motivos:
 *  - a faxina REMOVE tenants vencidos há muito tempo, em cascata;
 *  - com mais de uma instância da API no ar, todas rodariam a mesma limpeza
 *    ao mesmo tempo.
 * Ligue com FAXINA_AUTOMATICA=true quando houver uma instância só. Em qualquer
 * outro cenário, prefira o script `npm run faxina -w apps/api` num cron.
 */

const INTERVALO_MS = 24 * 60 * 60 * 1000; // uma vez por dia

export function iniciarFaxinaAutomatica() {
  if (process.env.FAXINA_AUTOMATICA !== "true") return null;

  async function rodar() {
    try {
      const r = await limparTrials({ aplicar: true });
      if (r.desativados.length || r.removidos.length) {
        console.log(
          `[faxina] ${r.desativados.length} trial(is) desativado(s), ${r.removidos.length} removido(s).`,
        );
      }
    } catch (erro) {
      console.error("[faxina] falhou:", erro.message);
    }
  }

  // Espera um pouco antes da primeira passada: subir a API e já sair apagando
  // dado, antes mesmo de atender a primeira requisição, é pedir susto.
  const inicial = setTimeout(rodar, 60_000);
  const repetido = setInterval(rodar, INTERVALO_MS);
  // `unref` para o timer não segurar o processo vivo no shutdown.
  inicial.unref?.();
  repetido.unref?.();

  console.log("[faxina] automática ligada (uma passada por dia).");
  return () => {
    clearTimeout(inicial);
    clearInterval(repetido);
  };
}
