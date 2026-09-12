import { Link } from "react-router-dom";
import {
  ShowcaseLinkExterno,
  ShowcaseTexto,
  usaFonteReal,
  useDadosDaVitrine,
  useVitrine,
} from "../contexto.jsx";
import { DADOS_REGIOES_PADRAO, lerDadosWidget, montarWhatsappUrl, numeroWhatsAppDaVitrine } from "./widgetData.js";
import { TituloDoWidget } from "../TituloDoWidget.jsx";
import { caminhoDaRegiao, regiaoDoImovel } from "../../../utils/regioes.js";

/* ────────────────────────────────────────────────────────────────────────────
   Regiões — os bairros onde a imobiliária realmente tem imóvel.

   A lista padrão era Centro, Jardins, Moema, Pinheiros, Vila Mariana e Tatuapé:
   bairros de São Paulo, servidos a qualquer imobiliária do país que arrastasse
   a peça. Pior que o engano geográfico era o funcional — clicar num deles abria
   o WhatsApp perguntando por imóveis num bairro onde não havia nenhum, e quem
   atendia precisava responder "não trabalhamos lá".

   Agora as regiões saem do acervo, com a CONTAGEM ao lado, ordenadas por
   volume: a lista existe para dizer onde há o que ver, e o bairro com um imóvel
   só não deve abrir a fila.

   ── O CLIQUE MUDOU DE DESTINO (DUAS VEZES) ──

   Ia para o WhatsApp — ou seja, pedia a um corretor que fizesse à mão uma busca
   que a página tinha como fazer sozinha. Passou a filtrar a própria grade, ali
   mesmo. Hoje leva à PÁGINA DA REGIÃO (`pages/RegiaoPage.jsx`): "imóveis em
   <bairro>", com endereço próprio, título próprio e os tipos disponíveis. O
   filtro em memória não tinha URL, não ia para o sitemap e o Google não via —
   e é este link, repetido em toda vitrine, que faz o robô encontrar essas
   páginas. Para quem clica a diferença é que agora dá para compartilhar.

   No caminho manual o WhatsApp continua sendo o destino, e isso não é
   inconsistência: o bairro digitado à mão pode não existir no acervo, e um
   filtro que devolve vazio é uma porta na cara de quem clicou.
   ──────────────────────────────────────────────────────────────────────────── */

export function RegionsWidget({ widget }) {
  const dados = useDadosDaVitrine();
  const reais = dados?.regioes || [];
  const real = usaFonteReal(widget, reais);

  const { modo, aoEditar, tenantSlug } = useVitrine();
  /* Só faz sentido editar a lista MANUAL: com a fonte real ligada, as regiões
     vêm do acervo e mexer nelas aqui não teria efeito nenhum na página. */
  const ehEditor = modo === "editor" && Boolean(aoEditar) && !real;

  const manual = lerDadosWidget(widget.content, DADOS_REGIOES_PADRAO);
  const subtitulo = manual.subtitulo || DADOS_REGIOES_PADRAO.subtitulo;
  const manuais = Array.isArray(manual.regioes) && manual.regioes.length
    ? manual.regioes
    : DADOS_REGIOES_PADRAO.regioes;

  return (
    <div className="widget-regions">
      <TituloDoWidget widget={widget} />
      <ShowcaseTexto as="p" campo={`widget|${widget.id}|dados|subtitulo`} html={subtitulo} />
      <div className="widget-regions__list">
        {real
          ? reais.slice(0, 16).map((regiao) => {
              /* O mesmo slug que a página resolve — `regiaoDoImovel` recebe a
                 região como se fosse um imóvel: bairro quando o nome não é a
                 própria cidade. No editor o ShowcaseLink vira um <span>. */
              const r = regiaoDoImovel({
                neighborhood: regiao.nome !== regiao.cidade ? regiao.nome : "",
                city: regiao.cidade,
              });
              const filhos = (
                <>
                  <span>{regiao.nome}</span>
                  <span className="widget-regions__conta">{regiao.total}</span>
                </>
              );
              /* `<a>` nos dois modos, como o ShowcaseLinkExterno: no editor
                 sem destino (nada navega no construtor), e a mesma tag para a
                 peça desenhar igual dos dois lados. */
              return modo === "editor" ? (
                <a key={`${regiao.nome}-${regiao.cidade}`} className="widget-regions__chip">{filhos}</a>
              ) : (
                <Link
                  key={`${regiao.nome}-${regiao.cidade}`}
                  to={caminhoDaRegiao({ tenantSlug, regiao: r?.slug || "" })}
                  className="widget-regions__chip"
                >
                  {filhos}
                </Link>
              );
            })
          : manuais.slice(0, 16).map((regiao, i) => (
              /* ── EDITAR É NO PRÓPRIO CHIP ──────────────────────────────────
                 Havia uma lista de campos embaixo da peça repetindo estes
                 mesmos itens: escrevia-se num lugar e conferia-se noutro, com
                 os dois na mesma tela ao mesmo tempo. O nome do chip agora é o
                 campo, e o × dele apaga.

                 A chave é o ÍNDICE e não o texto: com o texto, cada tecla
                 digitada trocaria a identidade do elemento, o React o
                 remontaria e o cursor sairia do campo. */
              <ShowcaseLinkExterno
                key={i}
                href={montarWhatsappUrl(widget.ctaUrl, `Olá! Gostaria de conhecer os imóveis disponíveis em ${regiao}.`, numeroWhatsAppDaVitrine(dados))}
                className="widget-regions__chip"
              >
                <ShowcaseTexto
                  as="span"
                  umaLinha
                  campo={`widget|${widget.id}|dados|regioes|${i}`}
                  html={regiao}
                />
                <span aria-hidden>↗</span>
                {ehEditor ? (
                  <button
                    type="button"
                    className="widget-editor-apenas widget-regions__tirar"
                    title={`Remover ${regiao}`}
                    onClick={(e) => {
                      /* O chip é um link. Sem parar o evento, o clique no × ia
                         junto para o `<a>` e o navegador tentava abrir o
                         WhatsApp no meio da edição. */
                      e.preventDefault();
                      e.stopPropagation();
                      aoEditar(`widget|${widget.id}|dados|regioes`, manuais.filter((_, j) => j !== i));
                    }}
                  >
                    ×
                  </button>
                ) : null}
              </ShowcaseLinkExterno>
            ))}

        {/* Acrescentar é MAIS UM chip, no fim da fila: o botão ocupa o lugar do
            item que vai nascer, e a linha não muda de forma quando ele nasce. */}
        {ehEditor && manuais.length < 16 ? (
          <button
            type="button"
            className="widget-editor-apenas widget-regions__mais"
            onClick={() => aoEditar(`widget|${widget.id}|dados|regioes`, [...manuais, "Nova região"])}
          >
            +
          </button>
        ) : null}
      </div>
    </div>
  );
}
