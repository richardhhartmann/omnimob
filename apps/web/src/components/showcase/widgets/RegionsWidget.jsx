import {
  ShowcaseLinkExterno,
  ShowcaseTexto,
  usaFonteReal,
  useDadosDaVitrine,
  useFiltroDaVitrine,
  useVitrine,
} from "../contexto.jsx";
import { DADOS_REGIOES_PADRAO, lerDadosWidget, montarWhatsappUrl } from "./widgetData.js";
import { TituloDoWidget } from "../TituloDoWidget.jsx";

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

   ── O CLIQUE MUDOU DE DESTINO ──

   Ia para o WhatsApp — ou seja, pedia a um corretor que fizesse à mão uma busca
   que a página tinha como fazer sozinha. Com regiões reais ele filtra a própria
   grade de imóveis, ali mesmo, sem recarregar nada: o acervo inteiro já está
   na memória do navegador.

   No caminho manual o WhatsApp continua sendo o destino, e isso não é
   inconsistência: o bairro digitado à mão pode não existir no acervo, e um
   filtro que devolve vazio é uma porta na cara de quem clicou.
   ──────────────────────────────────────────────────────────────────────────── */

export function RegionsWidget({ widget }) {
  const dados = useDadosDaVitrine();
  const { filtro, aplicarFiltro } = useFiltroDaVitrine();
  const reais = dados?.regioes || [];
  const real = usaFonteReal(widget, reais);

  const { modo, aoEditar } = useVitrine();
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
              const ativo = filtro?.regiao === regiao.nome;
              return (
                /* `<button>` e não `<a>`: isto não navega para lugar nenhum,
                   muda o que a página já está mostrando. Um link que não leva a
                   um endereço mente para o teclado e para o leitor de tela. */
                <button
                  key={`${regiao.nome}-${regiao.cidade}`}
                  type="button"
                  className={`widget-regions__chip${ativo ? " is-ativo" : ""}`}
                  aria-pressed={ativo}
                  /* Clicar de novo no bairro aceso limpa o filtro. É o gesto
                     que as pessoas tentam antes de procurar um "×". */
                  onClick={() => aplicarFiltro(ativo ? null : { regiao: regiao.nome })}
                >
                  <span>{regiao.nome}</span>
                  <span className="widget-regions__conta">{regiao.total}</span>
                </button>
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
                href={montarWhatsappUrl(widget.ctaUrl, `Olá! Gostaria de conhecer os imóveis disponíveis em ${regiao}.`)}
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
