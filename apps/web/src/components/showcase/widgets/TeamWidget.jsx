import { useState } from "react";
import { ShowcaseLinkExterno, ShowcaseTexto, usaFonteReal, useDadosDaVitrine, useVitrine } from "../contexto.jsx";
import { SeletorDeEquipe } from "./SeletorDeEquipe.jsx";
import { DADOS_EQUIPE_PADRAO, lerDadosWidget, montarWhatsappUrl, numeroWhatsAppDaVitrine } from "./widgetData.js";
import { TituloDoWidget } from "../TituloDoWidget.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   Equipe — os corretores de verdade.

   Este widget nasceu com "Ana Souza", "João Lima" e "Marina Alves" escritos no
   código, com CRECI inventado. Toda imobiliária que arrastasse a peça publicava
   os mesmos três nomes na própria vitrine, e várias publicaram.

   Agora a fonte é o cadastro de Usuários: quem está ativo E marcou "aparecer na
   vitrine". A marcação é opt-in de propósito — o painel tem gente que não
   atende cliente (financeiro, administrativo, o dono), e ter login não é
   consentimento para aparecer com foto numa página pública.

   O CRECI mostrado é o DA PESSOA, não o da empresa. São documentos diferentes,
   e o cliente que confere antes de assinar procura o do corretor com quem
   falou.
   ──────────────────────────────────────────────────────────────────────────── */

/* Quantos corretores cabem, por faixa de largura. Cortar aqui e nao no CSS
   porque `display: none` ainda monta o cartao, ainda baixa a foto e ainda
   entra no leitor de tela — em 240px isso seria seis retratos carregados para
   mostrar dois. Ver `useFaixaDoWidget`. */
const QUANTOS_POR_FAIXA = { xs: 2, s: 3, m: 4, g: 6 };

function iniciais(nome) {
  return String(nome || "Corretor")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join("");
}

export function TeamWidget({ widget, faixa = "m" }) {
  const dadosReais = useDadosDaVitrine();
  const equipeReal = dadosReais?.equipe || [];
  const real = usaFonteReal(widget, equipeReal);

  const { modo, aoEditar, tenantSlug } = useVitrine();
  const ehEditor = modo === "editor" && Boolean(aoEditar);
  const [seletorAberto, setSeletorAberto] = useState(false);

  const manual = lerDadosWidget(widget.content, DADOS_EQUIPE_PADRAO);
  /* Os ids escolhidos no seletor. Guardamos ID, e não uma cópia dos dados da
     pessoa: nome, foto e CRECI mudam no cadastro, e uma cópia congelada faria a
     vitrine anunciar o CRECI antigo de alguém para sempre. */
  const ids = Array.isArray(manual.ids) ? manual.ids : [];
  const pessoas = real
    ? equipeReal
    : (Array.isArray(manual.pessoas) ? manual.pessoas : []);

  /* O subtítulo continua sendo texto do cliente nos dois casos: ele é a frase
     de apresentação da equipe, não um dado que o banco tenha. */
  const subtitulo = manual.subtitulo || DADOS_EQUIPE_PADRAO.subtitulo;

  return (
    <div className="widget-team">
      <div className="widget-team__head">
        <TituloDoWidget widget={widget} />
        <ShowcaseTexto as="p" campo={`widget|${widget.id}|dados|subtitulo`} html={subtitulo} />
      </div>
      {/* ── VAZIO É VAZIO ────────────────────────────────────────────────
          Sem ninguém escolhido, a peça não inventa corretor. No editor ela
          convida a escolher; na vitrine publicada ela não desenha a grade —
          uma seção de equipe sem equipe é melhor que três nomes que não
          existem, que foi o que este widget fez por tempo demais. */}
      {pessoas.length === 0 ? (
        ehEditor ? (
          <div className="widget-editor-apenas widget-team__convite">
            <strong>Ninguém escolhido ainda</strong>
            <span>Use o botão abaixo para trazer a sua equipe do cadastro de usuários.</span>
          </div>
        ) : null
      ) : null}

      <div className="widget-team__grid">
        {pessoas.slice(0, QUANTOS_POR_FAIXA[faixa] ?? 6).map((pessoa, i) => {
          /* O WhatsApp da PESSOA quando ela tem um; o do widget como rede de
             segurança. Sem o fallback, o corretor sem número cadastrado
             ganharia um botão que não abre nada — pior que mandar para o
             telefone geral da imobiliária, que ao menos atende. */
          const href = montarWhatsappUrl(
            pessoa.whatsapp
              ? `https://wa.me/${String(pessoa.whatsapp).replace(/\D/g, "")}`
              : widget.ctaUrl,
            `Olá, ${pessoa.nome || "tudo bem"}? Vim pelo site e gostaria de falar sobre um imóvel.`,
            numeroWhatsAppDaVitrine(dadosReais),
          );
          return (
            <article className="widget-team__person" key={pessoa.id || `${pessoa.nome}-${i}`}>
              <div className="widget-team__avatar">
                {pessoa.foto ? <img src={pessoa.foto} alt="" /> : <span>{iniciais(pessoa.nome)}</span>}
              </div>
              <div className="widget-team__info">
                <strong>{pessoa.nome || "Corretor"}</strong>
                <span>{pessoa.cargo || "Corretor"}</span>
                {pessoa.creci ? <small>{pessoa.creci}</small> : null}
              </div>
              <ShowcaseLinkExterno href={href} className="widget-team__contact">WhatsApp</ShowcaseLinkExterno>
              {ehEditor && pessoa.id ? (
                <button
                  type="button"
                  className="widget-editor-apenas widget-team__tirar"
                  title={`Tirar ${pessoa.nome || "esta pessoa"} da vitrine`}
                  onClick={() => aoEditar(`widget|${widget.id}|dados|ids`, (ids.length ? ids : pessoas.map((x) => x.id)).filter((x) => x !== pessoa.id))}
                >
                  ×
                </button>
              ) : null}
            </article>
          );
        })}
        {/* ── Aparato de edição: só existe no editor ─────────────────────
            Acrescentar e remover pessoas acontece NA PEÇA, olhando para o
            resultado — era isso ou ir à tela de Usuários marcar uma caixa por
            pessoa, sem nunca ver o que a página ia mostrar.

            O invólucro `widget-editor-apenas` é o que o teste de paridade
            descarta antes de comparar os dois modos: ele é afordância, como o
            `contentEditable` e a alça de arrasto. */}
        {ehEditor ? (
          <div className="widget-editor-apenas widget-team__gerir">
            <button type="button" className="widget-team__mais" onClick={() => setSeletorAberto(true)}>
              + Escolher quem aparece
            </button>
          </div>
        ) : null}
      </div>

      {seletorAberto ? (
        <SeletorDeEquipe
          tenantSlug={tenantSlug}
          escolhidos={ids}
          aoFechar={() => setSeletorAberto(false)}
          aoConfirmar={(novos) => {
            /* Grava pelo mesmo caminho de qualquer texto da prancheta — o
               editor não precisa de um caso especial para equipe. */
            aoEditar(`widget|${widget.id}|dados|ids`, novos);
            setSeletorAberto(false);
          }}
        />
      ) : null}
    </div>
  );
}
