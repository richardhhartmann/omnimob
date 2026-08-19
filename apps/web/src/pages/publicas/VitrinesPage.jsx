import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PaginaPublica, Secao } from "../../components/PaginaPublica.jsx";
import { api } from "../../api";

/* ────────────────────────────────────────────────────────────────────────────
   Vitrines publicadas.

   A única página deste conjunto que não poderia ser escrita: ela é lida do
   banco. Cada cartão é uma imobiliária que está no ar agora, com o número real
   de imóveis ativos e a foto do último anúncio publicado.

   É a resposta para a pergunta que toda landing de SaaS deixa sem resposta —
   "mas fica bom mesmo?" — e é o tipo de prova que nenhuma página gerada
   consegue inventar, porque exige clientes de verdade.

   ── POR QUE OS CARTÕES LEVAM PARA FORA ──

   Cada um abre a vitrine da imobiliária no domínio dela. Perder a visita para
   o cliente é o ponto: quem chegou aqui está avaliando o resultado, e ver o
   resultado inteiro convence mais do que qualquer captura de tela nossa.
   ──────────────────────────────────────────────────────────────────────────── */

function Esqueleto() {
  /* Seis marcadores na mesma grade dos cartões: a página não muda de altura
     quando os dados chegam, e nada salta sob o cursor de quem já está lendo. */
  return (
    <div className="vt-grade" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="vt-cartao vt-cartao--fantasma">
          <div className="vt-capa" />
          <div className="vt-corpo">
            <span className="vt-barra" style={{ width: "62%" }} />
            <span className="vt-barra" style={{ width: "40%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function VitrinesPage() {
  const [estado, setEstado] = useState("carregando"); // carregando | pronto | erro
  const [vitrines, setVitrines] = useState([]);

  useEffect(() => {
    let vivo = true;
    api.listarVitrinesPublicas()
      .then((r) => {
        if (!vivo) return;
        setVitrines(r.vitrines || []);
        setEstado("pronto");
      })
      .catch(() => { if (vivo) setEstado("erro"); });
    return () => { vivo = false; };
  }, []);

  const total = vitrines.length;
  const imoveis = vitrines.reduce((soma, v) => soma + (v.imoveis || 0), 0);

  return (
    <PaginaPublica
      olho="No ar agora"
      titulo="Vitrines feitas na Omnimob"
      subtitulo="Páginas publicadas por imobiliárias que usam a plataforma. Nenhuma delas precisou de programador — todas foram montadas no editor, arrastando as peças."
      descricao="Vitrines digitais publicadas por imobiliárias que usam a Omnimob. Veja resultados reais antes de decidir."
      largura="largo"
    >
      {estado === "pronto" && total > 0 ? (
        <p className="vt-resumo">
          <strong>{total}</strong> {total === 1 ? "vitrine no ar" : "vitrines no ar"} ·{" "}
          <strong>{imoveis}</strong> {imoveis === 1 ? "imóvel anunciado" : "imóveis anunciados"}
        </p>
      ) : null}

      {estado === "carregando" ? <Esqueleto /> : null}

      {estado === "erro" ? (
        <p className="vt-vazio">
          Não consegui carregar as vitrines agora. Recarregue a página em instantes — ou vá direto
          para o <Link to="/">teste grátis</Link> e monte a sua.
        </p>
      ) : null}

      {estado === "pronto" && total === 0 ? (
        <p className="vt-vazio">
          Ainda não há vitrine publicada por aqui. <Link to="/">Comece o teste grátis</Link> e a sua
          pode ser a primeira.
        </p>
      ) : null}

      {estado === "pronto" && total > 0 ? (
        <div className="vt-grade">
          {vitrines.map((v) => (
            <a
              key={v.slug}
              className="vt-cartao"
              href={v.endereco}
              target="_blank"
              rel="noreferrer"
              style={{ "--marca": v.cor }}
            >
              <div className="vt-capa">
                <img src={v.capa} alt="" loading="lazy" />
                {v.logoUrl ? (
                  <span className="vt-selo">
                    <img src={v.logoUrl} alt="" loading="lazy" />
                  </span>
                ) : null}
              </div>
              <div className="vt-corpo">
                <h3>{v.nome}</h3>
                {v.frase ? <p className="vt-frase">{v.frase}</p> : null}
                <p className="vt-ficha">
                  {[v.cidade && v.estado ? `${v.cidade}/${v.estado}` : v.cidade, `${v.imoveis} ${v.imoveis === 1 ? "imóvel" : "imóveis"}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <span className="vt-abrir">Ver vitrine →</span>
            </a>
          ))}
        </div>
      ) : null}

      <Secao titulo="Como elas foram feitas">
        <p>
          Todas as páginas acima saíram do mesmo editor: as peças — cabeçalho, destaque, grade de
          imóveis, depoimento, mapa, chamada para ação — são arrastadas para o lugar, e o que
          aparece na tela enquanto se edita é exatamente o que vai ao ar. Cores, fontes e textos são
          da imobiliária.
        </p>
        <p>
          Os imóveis não são cadastrados duas vezes: a vitrine lê o mesmo acervo do painel. Publicar
          um imóvel novo o coloca na página, nos anúncios das redes sociais e no arquivo que os
          portais buscam — de uma vez.
        </p>
        <p>
          Cada vitrine pode ficar num endereço da Omnimob ou{" "}
          <strong>no domínio próprio da imobiliária</strong>, sem marca nossa na frente do cliente
          final.
        </p>
      </Secao>

      <style>{CSS}</style>
    </PaginaPublica>
  );
}

const CSS = `
.vt-resumo { margin: -22px 0 26px; font-size: 14px; color: var(--subtle); }
.vt-resumo strong { color: var(--default); }

.vt-grade {
  display: grid; gap: 18px;
  grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr));
}

.vt-cartao {
  display: flex; flex-direction: column; overflow: hidden;
  border: 1px solid var(--line); border-radius: 16px; background: var(--surface);
  text-decoration: none; color: inherit;
  transition: transform 0.22s var(--ease-out), border-color 0.22s ease, box-shadow 0.22s ease;
}
.vt-cartao:hover {
  transform: translateY(-4px);
  border-color: color-mix(in srgb, var(--marca) 46%, var(--line));
  box-shadow: 0 18px 40px -22px rgba(0,0,0,0.8);
}

.vt-capa { position: relative; aspect-ratio: 16 / 10; background: var(--surface-2); overflow: hidden; }
.vt-capa img { width: 100%; height: 100%; object-fit: cover; display: block; }
/* Barra na cor da marca da imobiliária: é o que faz doze cartões parecerem doze
   empresas em vez de doze instâncias do mesmo modelo. */
.vt-capa::after {
  content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 3px;
  background: var(--marca);
}
.vt-selo {
  position: absolute; left: 12px; bottom: 14px;
  width: 42px; height: 42px; border-radius: 10px; overflow: hidden;
  background: rgba(10,10,11,0.72); backdrop-filter: blur(6px);
  border: 1px solid rgba(255,255,255,0.14);
  display: grid; place-items: center; padding: 5px;
}
.vt-selo img { width: 100%; height: 100%; object-fit: contain; }

.vt-corpo { padding: 16px 16px 10px; display: flex; flex-direction: column; gap: 6px; flex: 1; }
.vt-corpo h3 { margin: 0; font-size: 16px; font-weight: 650; letter-spacing: -0.01em; }
.vt-frase {
  margin: 0; font-size: 13px; line-height: 1.55; color: var(--subtle);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.vt-ficha { margin: auto 0 0; padding-top: 8px; font-size: 12px; color: var(--placeholder); }

.vt-abrir {
  padding: 12px 16px; border-top: 1px solid var(--line);
  font-size: 12.5px; font-weight: 600; color: var(--marca);
}

/* Marcadores de carregamento — mesma caixa, sem conteúdo. */
.vt-cartao--fantasma { pointer-events: none; }
.vt-cartao--fantasma .vt-capa { background: var(--surface-2); }
.vt-cartao--fantasma .vt-capa::after { background: var(--line); }
.vt-barra { display: block; height: 11px; border-radius: 999px; background: var(--surface-2); }

.vt-vazio { font-size: 15px; line-height: 1.7; color: var(--subtle); }
.vt-vazio a { color: var(--accent-soft); }

@media (prefers-reduced-motion: reduce) {
  .vt-cartao, .vt-cartao:hover { transition: none; transform: none; }
}
`;
