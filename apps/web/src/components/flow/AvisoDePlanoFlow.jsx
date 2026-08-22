import { Link } from "react-router-dom";
import { LockSimple } from "@phosphor-icons/react";
import { planoInfo } from "../../utils/planos";

/* ────────────────────────────────────────────────────────────────────────────
   O DEGRAU DE PLANO, DITO UMA VEZ.

   O Flow tem três recursos atrás de plano — captação por webhook e assinatura
   digital no Profissional, IA na minuta no Premium. Cada tela poderia dizer
   isso por conta própria, e foi assim que começou: três avisos com três
   redações, e o da tela de contratos dizia "Premium" quando o certo era
   "Profissional".

   Um componente só, alimentado pelo que o SERVIDOR respondeu em
   `GET /flow/painel` → `recursos`. A tela não recalcula a régua de plano; ela
   desenha o que veio. Duas cópias da régua é como o menu passou a oferecer um
   relatório que a página recusava.

   ── NÃO APARECE QUANDO NÃO HÁ NADA A DIZER ──

   No Premium ele some inteiro. E no Básico ele diz UMA frase com os dois
   recursos, e não dois avisos empilhados: a pessoa não vai fazer dois upgrades.
   ──────────────────────────────────────────────────────────────────────────── */

export function AvisoDePlanoFlow({ recursos, plano, compacto = false }) {
  if (!recursos) return null;

  const faltando = [];
  if (!recursos.captacaoWebhook) faltando.push("captação automática pelos portais");
  if (!recursos.assinaturaDigital) faltando.push("assinatura digital de contratos");

  /* Configurar a assinatura é outra conversa, e ela só faz sentido para quem JÁ
     tem o plano. Misturar "faça upgrade" com "termine de configurar" na mesma
     caixa produziria a leitura errada nos dois sentidos. */
  const soFaltaConfigurar = recursos.assinaturaDigital && !recursos.assinaturaPronta;

  if (!faltando.length && !soFaltaConfigurar) return null;

  const info = planoInfo(plano);

  if (!faltando.length) {
    return (
      <div className={`flow-aviso is-config${compacto ? " is-compacto" : ""}`}>
        <span className="flow-aviso__icone"><LockSimple size={16} weight="fill" /></span>
        <span>
          A assinatura digital ainda não está conectada. Escolha o provedor e cole a chave em{" "}
          <Link to="/configuracoes?ver=flow">Configurações → Flow</Link> — sem isso, o contrato é
          gerado mas não sai para assinatura.
        </span>
      </div>
    );
  }

  return (
    <div className={`flow-aviso${compacto ? " is-compacto" : ""}`}>
      <span className="flow-aviso__icone"><LockSimple size={16} weight="fill" /></span>
      <span>
        No plano <strong>{info?.nome}</strong>, o Flow entrega o funil, os negócios, os documentos e
        as minutas. Ficam de fora {listar(faltando)} — os dois entram a partir do{" "}
        <strong>Profissional</strong>.{" "}
        <Link to="/configuracoes?ver=plano">Ver planos</Link>
      </span>
    </div>
  );
}

/* "a e b", não "a, b". Duas coisas numa frase levam "e"; a vírgula só entra a
   partir de três, e hoje nunca são três. */
function listar(itens) {
  if (itens.length === 1) return itens[0];
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}
