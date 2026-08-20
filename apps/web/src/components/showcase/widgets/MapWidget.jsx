import { ShowcaseLinkExterno, ShowcaseTexto, usaFonteReal, useDadosDaVitrine } from "../contexto.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   Localização — agora um mapa de verdade.

   Era um cartão com um pino DESENHADO e o endereço digitado à mão, que nascia
   "Rua das Flores, 123 — Centro — São Paulo, SP" para toda imobiliária que
   arrastasse a peça. Duas coisas erradas ao mesmo tempo: o endereço estava no
   cadastro da imobiliária e ninguém lia, e o "mapa" não era um mapa.

   ── POR QUE O EMBED SEM CHAVE ──

   `maps.google.com/maps?q=<endereço>&output=embed` devolve o mapa interativo
   real — arrasta, aproxima, tem o pino no lugar certo — sem chave de API, sem
   projeto no Google Cloud e sem billing. A alternativa oficial (Maps Embed API)
   desenha exatamente a mesma coisa e cobra uma conta ativa por isso.

   O que se perde: não dá para estilizar o mapa nem trocar o ícone do pino. Numa
   vitrine imobiliária isso não é perda nenhuma — quem olha quer saber onde
   fica, e um mapa com a cara do Google é justamente o que a pessoa reconhece.

   E não precisamos de latitude e longitude: o embed geocodifica o texto na
   hora. Uma coluna de coordenadas no banco ficaria desatualizada em silêncio no
   dia em que a imobiliária mudasse de sala.

   ── NO EDITOR, O MAPA NÃO CAPTURA O PONTEIRO ──

   Um iframe engole `pointermove`, e a peça ficaria impossível de arrastar. A
   trava é uma regra CSS escopada em `.editor-shell` (ver styles.css), e não uma
   prop diferente por modo: a marcação precisa ser idêntica nos dois lados, e é
   o teste de paridade que cobra isso.
   ──────────────────────────────────────────────────────────────────────────── */

/** O endereço que o mapa procura, e o mesmo que o botão "como chegar" abre. */
function buscaDoMapa(endereco) {
  return encodeURIComponent(endereco);
}

export function MapWidget({ widget }) {
  const dados = useDadosDaVitrine();
  const endereco = dados?.endereco || null;
  const real = usaFonteReal(widget, endereco?.completo);

  const cor = widget.color ? { color: widget.color } : undefined;

  /* Sem endereço no cadastro — ou com a fonte real desligada no inspetor — cai
     no cartão de antes, com o texto que a pessoa escreveu. Não é um caminho
     morto: imobiliária que atende só por WhatsApp e não tem loja física existe,
     e para ela o cartão com uma frase é o certo. */
  if (!real) {
    return (
      <div className="widget-map">
        <ShowcaseTexto as="h3" campo={`widget|${widget.id}|title`} umaLinha html={widget.title} style={cor} />
        <div className="widget-map__cartao">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
          </svg>
          <ShowcaseTexto as="p" campo={`widget|${widget.id}|content`} html={widget.content} />
        </div>
      </div>
    );
  }

  const busca = buscaDoMapa(endereco.completo);

  return (
    <div className="widget-map">
      <ShowcaseTexto as="h3" campo={`widget|${widget.id}|title`} umaLinha html={widget.title} style={cor} />

      <div className="widget-map__moldura">
        <iframe
          className="widget-map__mapa"
          /* `z=16` mostra o quarteirão: mais perto e some a referência da
             avenida, mais longe e o pino vira um ponto no meio do bairro. */
          src={`https://maps.google.com/maps?q=${busca}&z=16&output=embed`}
          title={`Mapa — ${endereco.completo}`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>

      <div className="widget-map__rodape">
        <address className="widget-map__endereco">
          <strong>{endereco.logradouro}</strong>
          <span>
            {[endereco.cidade, endereco.estado].filter(Boolean).join(" · ")}
            {endereco.cep ? ` · CEP ${endereco.cep}` : ""}
          </span>
        </address>
        {/* Abre a rota no app de mapas do aparelho — no celular é o que leva
            direto ao "iniciar navegação", que é o gesto seguinte de quem
            decidiu visitar. */}
        <ShowcaseLinkExterno
          href={`https://www.google.com/maps/dir/?api=1&destination=${busca}`}
          className="widget-map__rota"
        >
          Como chegar
          <span aria-hidden>↗</span>
        </ShowcaseLinkExterno>
      </div>
    </div>
  );
}
