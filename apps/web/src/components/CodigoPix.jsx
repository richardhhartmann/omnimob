import { useEffect, useState } from "react";
import { api } from "../api";

/* ── O Pix, em um lugar só ───────────────────────────────────────────────────

   Duas telas vendem plano: o modal do teste (`TrialAviso`) e a parede de conta
   suspensa (`ContaSuspensaPage`). O código Pix nasceu na primeira e foi pedido
   na segunda — e copiar teria sido repetir, em pequeno, o defeito que o editor
   de vitrine já teve duas vezes: duas versões da mesma coisa, que divergem no
   primeiro ajuste.

   Aqui moram as três partes que as duas telas precisam ter idênticas: o
   DESENHO do código, o CSS dele e a ESPERA. O que cada tela faz quando o
   pagamento cai continua sendo dela — uma comemora no passo 4, a outra
   recupera o ambiente —, e é por isso que a espera recebe os desfechos por
   parâmetro em vez de decidir sozinha.
   ────────────────────────────────────────────────────────────────────────── */

/* O COPIA-E-COLA vem primeiro, e não o QR: quem está no celular já tem o app do
   banco a um toque e não consegue fotografar a própria tela. O QR é para quem
   abriu o painel no computador e vai pagar pelo telefone.

   A imagem chega em base64 dentro da resposta — nada é buscado de fora, o que
   mantém o código funcionando mesmo com o provedor fora do ar no instante
   seguinte, e não abre requisição a domínio de terceiro dentro do painel. */
export function CodigoPix({ pix }) {
  const [copiado, setCopiado] = useState(false);
  if (!pix) return null;

  function copiar() {
    navigator.clipboard?.writeText(pix.qrCode || "").then(
      () => { setCopiado(true); setTimeout(() => setCopiado(false), 2000); },
      () => {},
    );
  }

  return (
    <div className="pix-bloco">
      {pix.qrCodeBase64 ? (
        <img
          className="pix-qr"
          src={`data:image/png;base64,${pix.qrCodeBase64}`}
          alt="QR Code do Pix"
          width={168}
          height={168}
        />
      ) : null}
      <span className="pix-rotulo">Pix copia e cola</span>
      <code className="pix-codigo">{pix.qrCode}</code>
      <button type="button" className="pix-copiar" onClick={copiar}>
        {copiado ? "Copiado" : "Copiar código Pix"}
      </button>
      {pix.ticketUrl ? (
        <div className="pix-links">
          <a href={pix.ticketUrl} target="_blank" rel="noreferrer">Abrir no Mercado Pago</a>
        </div>
      ) : null}
      {pix.venceEm ? (
        <span className="pix-prazo">
          O código vale por 30 minutos, depois disso é só gerar outro.
        </span>
      ) : null}
    </div>
  );
}

/* ── "Já caiu?" ─────────────────────────────────────────────────────────────
   Pergunta de quatro em quatro segundos enquanto o código está na tela. O
   webhook é o caminho normal e chega sozinho — mas pode demorar, e em
   desenvolvimento não chega nunca (localhost não recebe aviso de fora). Sem
   esta consulta, um Pix pago deixaria a pessoa olhando para o QR.

   Quem ativa a conta é o SERVIDOR, nos dois caminhos, com a mesma função. Esta
   espera só pergunta — e avisa a tela.

   Hook, e não um efeito copiado em cada página, porque ele tem duas armadilhas
   que ninguém acerta duas vezes seguidas: limpar o intervalo ao desmontar, e
   ignorar a resposta que chega depois disso. */
export function useEsperaDoPix({ tenantSlug, pix, aoAprovar, aoRecusar }) {
  useEffect(() => {
    if (!pix?.cobrancaId) return undefined;
    let vivo = true;

    const relogio = setInterval(async () => {
      try {
        const r = await api.consultarCobrancaPix(tenantSlug, pix.cobrancaId);
        if (!vivo || r.status === "pendente") return;
        clearInterval(relogio);
        if (r.status === "aprovado") aoAprovar?.(r);
        else aoRecusar?.(r);
      } catch {
        /* Falha de rede não derruba a espera: o código continua válido e a
           próxima batida tenta de novo. */
      }
    }, 4000);

    return () => { vivo = false; clearInterval(relogio); };
    /* `aoAprovar`/`aoRecusar` de fora das dependências de propósito: elas são
       recriadas a cada render das telas, e incluí-las reiniciaria o intervalo
       sem parar — a consulta nunca completaria os quatro segundos. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pix, tenantSlug]);
}

/* CSS próprio, injetado por quem usa. As duas telas têm folhas separadas e
   paletas diferentes (o modal segue o painel, a parede é sempre escura), então
   o bloco usa cores que funcionam nas duas e herda a tipografia de cada uma.

   Sem CRASE nenhuma nos comentários daqui: isto é um template literal. */
export const CODIGO_PIX_CSS = `
.pix-bloco { display: flex; flex-direction: column; gap: 8px; align-items: stretch; }
/* Fundo branco FIXO no QR: o codigo e lido por camera, e um fundo que
   acompanha o tema perderia contraste no modo escuro — a leitura falharia sem
   nada na tela explicando por que. */
.pix-qr {
  align-self: center; width: 168px; height: 168px; padding: 8px;
  background: #fff; border-radius: 12px; image-rendering: pixelated;
}
.pix-rotulo {
  font-size: 11px; font-weight: 700; letter-spacing: 0.08em;
  text-transform: uppercase; color: #64748b;
}
.pix-codigo {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12.5px; line-height: 1.6; word-break: break-all;
  padding: 10px 12px; border-radius: 8px; max-height: 84px; overflow-y: auto;
  background: rgba(148,163,184,0.12); border: 1px solid rgba(148,163,184,0.22);
}
.pix-copiar {
  border: 0; cursor: pointer; padding: 11px 16px; border-radius: 10px;
  font: inherit; font-size: 13.5px; font-weight: 600;
  background: #6366f1; color: #fff;
}
.pix-copiar:hover { background: #4f46e5; }
.pix-links { display: flex; gap: 14px; flex-wrap: wrap; font-size: 13px; }
.pix-links a { color: #a5b4fc; }
.pix-prazo { font-size: 12px; color: #94a3b8; }

/* A oferta ("ou pague o ano no Pix"). Em ambar, nao no indigo do botao
   principal: e um caminho alternativo, e um segundo botao com o mesmo peso
   faria a tela ter duas acoes primarias. */
.pix-oferta {
  margin-top: 16px; padding: 13px 15px; border-radius: 12px;
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  justify-content: space-between;
  background: rgba(212,175,55,0.06); border: 1px solid rgba(212,175,55,0.22);
}
.pix-oferta__texto { display: flex; flex-direction: column; gap: 3px; min-width: 200px; flex: 1 1 220px; }
.pix-oferta__texto strong { font-size: 13px; }
.pix-oferta__texto small { font-size: 11.5px; line-height: 1.5; color: #94a3b8; }
.pix-oferta__btn {
  cursor: pointer; padding: 10px 15px; border-radius: 10px; font: inherit;
  font-size: 13px; font-weight: 600; color: #f8fafc;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.16);
}
.pix-oferta__btn:hover:not(:disabled) { background: rgba(255,255,255,0.12); }
.pix-oferta__btn:disabled { opacity: 0.55; cursor: default; }
.pix-espera { font-size: 12.5px; color: #94a3b8; align-self: center; }
`;
