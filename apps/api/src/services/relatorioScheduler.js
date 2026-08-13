import { prisma } from "../db.js";
import { montarRelatorioMensal, mesFechadoAnterior, rotuloDoMes } from "./relatorioService.js";
import { emailRelatorioMensal } from "./emailTemplates.js";
import { sendEmail } from "./notificationService.js";

/**
 * ─── Agendador do relatório mensal ───────────────────────────────────────────
 * Manda, uma vez por mês, o fechamento do mês anterior para cada imobiliária do
 * Profissional ou do Premium.
 *
 * DESLIGADO POR PADRÃO, pelo mesmo motivo da faxina: com mais de uma instância
 * da API no ar, todas mandariam o mesmo e-mail para o mesmo cliente. Ligue com
 * RELATORIO_MENSAL_AUTOMATICO=true quando houver uma instância só; em qualquer
 * outro cenário, chame `enviarRelatoriosDoMes` de um cron externo.
 *
 * ONDE ESTÁ A TRAVA DE REENVIO: em `Tenant.relatorioEnviadoEm`... que NÃO
 * existe. Sem coluna nova (o que exigiria migração), a trava é a janela: o laço
 * só age nos primeiros dias do mês e guarda em memória o que já mandou nesta
 * execução do processo. Se a API reiniciar dia 2, o mês pode sair duas vezes.
 *
 * É uma limitação conhecida e aceitável para um resumo mensal — receber duas
 * vezes o mesmo relatório é chato, não é dano. O dia que virar problema, a
 * solução é a coluna.
 */

const INTERVALO_MS = 6 * 60 * 60 * 1000; // confere 4x por dia
const DIA_LIMITE = 5; // só age do dia 1 ao 5, quando o mês recém-fechado é notícia

/**
 * Manda o relatório do mês para todos os tenants elegíveis.
 * @param {{aplicar?:boolean, periodo?:{ano:number,mes:number}}} opcoes
 *        `aplicar: false` (padrão) é ENSAIO: monta tudo e não envia nada.
 */
export async function enviarRelatoriosDoMes({ aplicar = false, periodo } = {}) {
  const alvo = periodo || mesFechadoAnterior();

  /* Só quem paga e está em dia. Um trial não recebe relatório: ele mal tem mês
     fechado, e o e-mail chegaria com tudo zerado — o pior primeiro contato
     possível com um recurso que existe para mostrar valor. */
  const tenants = await prisma.tenant.findMany({
    where: {
      plano: { in: ["PROFISSIONAL", "PREMIUM"] },
      statusPagamento: { in: ["EM_DIA", "ATRASADO"] },
      email: { not: "" },
    },
    select: { id: true, name: true, email: true },
  });

  const base = (process.env.APP_URL || "").replace(/\/+$/, "");
  const enviados = [];
  const pulados = [];
  const falhas = [];

  for (const t of tenants) {
    try {
      const relatorio = await montarRelatorioMensal(t.id, alvo);

      // Mês sem nada não vira e-mail. "Você teve 0 visitas e 0 leads" não é
      // informação: é um lembrete de que a assinatura não está rendendo, e
      // mandado por nós mesmos.
      if (relatorio.vazio) {
        pulados.push({ tenant: t.name, motivo: "sem movimento no mês" });
        continue;
      }

      if (!aplicar) {
        enviados.push({ tenant: t.name, email: t.email, ensaio: true });
        continue;
      }

      const { subject, body, html } = emailRelatorioMensal({
        imobiliaria: t.name,
        relatorio,
        base,
      });
      await sendEmail({ to: t.email, subject, body, html });
      enviados.push({ tenant: t.name, email: t.email });
    } catch (erro) {
      falhas.push({ tenant: t.name, erro: erro.message });
    }
  }

  return { periodo: { ...alvo, rotulo: rotuloDoMes(alvo.ano, alvo.mes) }, enviados, pulados, falhas };
}

export function iniciarRelatorioMensal() {
  if (process.env.RELATORIO_MENSAL_AUTOMATICO !== "true") return null;

  // Chave do mês já processado NESTA execução do processo. Ver o comentário do
  // cabeçalho sobre por que a trava não é persistente.
  let ultimoMesEnviado = null;

  async function rodar() {
    const hoje = new Date();
    if (hoje.getDate() > DIA_LIMITE) return;

    const alvo = mesFechadoAnterior(hoje);
    const chave = `${alvo.ano}-${alvo.mes}`;
    if (ultimoMesEnviado === chave) return;

    try {
      const r = await enviarRelatoriosDoMes({ aplicar: true, periodo: alvo });
      ultimoMesEnviado = chave;
      console.log(
        `[relatorio] ${r.periodo.rotulo}: ${r.enviados.length} enviado(s), ` +
          `${r.pulados.length} pulado(s), ${r.falhas.length} falha(s).`,
      );
    } catch (erro) {
      console.error("[relatorio] falhou:", erro.message);
    }
  }

  // Mesma cautela da faxina: não sai mandando e-mail no segundo em que a API
  // sobe, antes de atender a primeira requisição.
  const inicial = setTimeout(rodar, 90_000);
  const repetido = setInterval(rodar, INTERVALO_MS);
  inicial.unref?.();
  repetido.unref?.();

  console.log("[relatorio] mensal automático ligado.");
  return () => {
    clearTimeout(inicial);
    clearInterval(repetido);
  };
}
