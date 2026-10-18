import { createContext, useContext, useMemo, useRef, useState } from "react";
import { createUsePuck } from "@puckeditor/core";
import { LinkSimple, Images, House, ArrowCounterClockwise } from "@phosphor-icons/react";
import { BANCO_DE_FOTOS } from "./bancoDeFotos.js";
import { ENQUADRAMENTO_NEUTRO, normalizarEnquadramento } from "./ComBanner.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   A IMAGEM DO BANNER, COM CARA DE EDITOR DE IMAGEM.

   Era um campo de texto — "Banner (URL da imagem)" —, e isso pressupunha que a
   pessoa tivesse a foto hospedada em algum lugar e soubesse copiar o endereço
   dela. Dois campos substituem aquele:

     · ORIGEM: de onde vem a foto, em três abas — um endereço colado, o banco
       de fotos padrão (`bancoDeFotos.js`) ou as fotos dos imóveis que a
       própria imobiliária já cadastrou. As três gravam a MESMA coisa, a URL
       em `backgroundImage`: nada muda para quem desenha o banner.
     · ENQUADRAMENTO: com a foto escolhida, uma prévia com grade de terços onde
       se ARRASTA a imagem para reposicionar, mais zoom e giro. Grava
       `enquadramento: { zoom, giro, x, y }`, que o `ComBanner` aplica.

   ── AS FOTOS DO ACERVO ──

   Os imóveis já são carregados pela página do editor (é o que a grade da
   prancheta desenha). Chegam aqui por contexto — `FotosDoAcervo`, posto em
   volta do `<Puck>` — e não por uma segunda busca, que faria a aba abrir vazia
   e encher depois.
   ──────────────────────────────────────────────────────────────────────────── */

const ContextoDoAcervo = createContext([]);

/** Os imóveis do editor, para a aba "Seus imóveis". */
export function FotosDoAcervo({ imoveis, children }) {
  return <ContextoDoAcervo.Provider value={imoveis || []}>{children}</ContextoDoAcervo.Provider>;
}

/** As fotos dos imóveis, achatadas e sem repetição, com o título de cada um. */
export function fotosDosImoveis(imoveis) {
  const vistas = new Set();
  const saida = [];
  for (const imovel of imoveis || []) {
    for (const foto of imovel?.images || []) {
      const url = typeof foto?.url === "string" ? foto.url.trim() : "";
      if (!url || vistas.has(url) || url.endsWith(".svg")) continue;
      vistas.add(url);
      saida.push({ url, miniatura: url, titulo: imovel.title || "Imóvel" });
    }
  }
  return saida;
}

const ABAS = [
  { valor: "url", rotulo: "Link", Icone: LinkSimple },
  { valor: "banco", rotulo: "Banco", Icone: Images },
  { valor: "imoveis", rotulo: "Imóveis", Icone: House },
];

function GradeDeFotos({ fotos, atual, onEscolher, readOnly, vazio }) {
  if (!fotos.length) return <p className="puck-alternador__apoio">{vazio}</p>;
  return (
    <div className="banner-fotos">
      {fotos.map((f) => (
        <button
          key={f.url}
          type="button"
          className={`banner-fotos__item${f.url === atual ? " is-ativo" : ""}`}
          title={f.titulo || "Usar esta foto"}
          aria-pressed={f.url === atual}
          disabled={readOnly}
          onClick={() => onEscolher(f.url)}
        >
          <img src={f.miniatura} alt={f.titulo || ""} loading="lazy" />
        </button>
      ))}
    </div>
  );
}

function OrigemDaImagem({ value, onChange, readOnly }) {
  const imoveis = useContext(ContextoDoAcervo);
  const doAcervo = useMemo(() => fotosDosImoveis(imoveis), [imoveis]);
  const atual = typeof value === "string" ? value : "";
  /* Abre na aba de onde a foto atual veio — quem escolheu do banco e volta ao
     campo quer ver a escolha marcada, não um campo de endereço. */
  const [aba, setAba] = useState(() => {
    if (BANCO_DE_FOTOS.some((g) => g.fotos.some((f) => f.url === atual))) return "banco";
    if (doAcervo.some((f) => f.url === atual)) return "imoveis";
    return "url";
  });

  return (
    <div className="editor-field puck-alternador banner-origem">
      <span className="puck-alternador__rotulo">Imagem do banner</span>
      <div className="editor-segmented is-compact is-varios" role="tablist" aria-label="De onde vem a imagem">
        {ABAS.map((a) => (
          <button
            key={a.valor}
            type="button"
            role="tab"
            aria-selected={aba === a.valor}
            className={aba === a.valor ? "is-active" : ""}
            onClick={() => setAba(a.valor)}
          >
            <a.Icone size={15} weight={aba === a.valor ? "fill" : "regular"} />
            {a.rotulo}
          </button>
        ))}
      </div>

      {aba === "url" ? (
        <input
          type="url"
          className="editor-input banner-origem__url"
          placeholder="https://…"
          value={atual}
          disabled={readOnly}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : null}
      {aba === "banco" ? BANCO_DE_FOTOS.map((g) => (
        <div key={g.nome} className="banner-fotos__grupo">
          <span className="banner-fotos__titulo">{g.nome}</span>
          <GradeDeFotos fotos={g.fotos} atual={atual} onEscolher={onChange} readOnly={readOnly} vazio="" />
        </div>
      )) : null}
      {aba === "imoveis" ? (
        <GradeDeFotos
          fotos={doAcervo}
          atual={atual}
          onEscolher={onChange}
          readOnly={readOnly}
          vazio="Nenhum imóvel com foto ainda. Cadastre fotos em Gerenciar Imóveis e elas aparecem aqui."
        />
      ) : null}

      {atual ? (
        <button type="button" className="banner-origem__tirar" disabled={readOnly} onClick={() => onChange("")}>
          Tirar a imagem
        </button>
      ) : null}
    </div>
  );
}

/* ── O ENQUADRAMENTO ────────────────────────────────────────────────────────── */

const usarPuck = createUsePuck();

function Enquadramento({ value, onChange, readOnly }) {
  const imagem = usarPuck((s) => s.selectedItem?.props?.backgroundImage);
  const e = normalizarEnquadramento(value);
  const caixa = useRef(null);
  const gesto = useRef(null);

  const mudar = (parcial) => onChange({ ...e, ...parcial });

  /* Arrastar a foto: o deslocamento em pixels vira deslocamento do
     `background-position`, em %. Arrastar para a DIREITA mostra o que estava à
     esquerda — por isso o sinal é invertido. O zoom divide o passo: com a foto
     ampliada, o mesmo gesto anda menos na imagem. */
  const aoDescer = (evento) => {
    if (readOnly) return;
    gesto.current = { x: evento.clientX, y: evento.clientY, de: e };
    /* Capturar o ponteiro deixa o arrasto seguir mesmo saindo da prévia. É
       conforto, não requisito: se o navegador recusar (ponteiro que já não
       existe), o gesto continua valendo dentro dela. */
    try { evento.currentTarget.setPointerCapture?.(evento.pointerId); } catch { /* segue sem captura */ }
  };
  const aoMover = (evento) => {
    const g = gesto.current;
    if (!g || !caixa.current) return;
    const r = caixa.current.getBoundingClientRect();
    const escala = g.de.zoom / 100;
    const dx = ((evento.clientX - g.x) / r.width) * 100 / escala;
    const dy = ((evento.clientY - g.y) / r.height) * 100 / escala;
    onChange({ ...g.de, x: Math.round(Math.min(100, Math.max(0, g.de.x - dx))), y: Math.round(Math.min(100, Math.max(0, g.de.y - dy))) });
  };
  const aoSoltar = () => { gesto.current = null; };

  if (!imagem) return null;
  const alterado = e.zoom !== 100 || e.giro !== 0 || e.x !== 50 || e.y !== 50;

  return (
    <div className="editor-field banner-quadro">
      <span className="puck-alternador__rotulo">Enquadramento</span>
      <div
        ref={caixa}
        className="banner-quadro__previa"
        onPointerDown={aoDescer}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={aoSoltar}
        title="Arraste para reposicionar a foto"
      >
        <div
          className="banner-quadro__foto"
          style={{
            backgroundImage: `url("${String(imagem).replace(/"/g, "%22")}")`,
            backgroundPosition: `${e.x}% ${e.y}%`,
            transform: `rotate(${e.giro}deg) scale(${e.zoom / 100})`,
          }}
        />
        {/* A grade de terços: é por ela que se põe o assunto da foto num ponto
            forte, em vez de no centro morto. */}
        <span className="banner-quadro__grade" aria-hidden />
      </div>
      <label className="editor-field puck-deslizante">
        <span className="editor-field-label editor-field-label--split">Zoom <b>{e.zoom}%</b></span>
        <input type="range" className="editor-range" min={100} max={300} value={e.zoom} disabled={readOnly} onChange={(ev) => mudar({ zoom: Number(ev.target.value) })} />
      </label>
      <label className="editor-field puck-deslizante">
        <span className="editor-field-label editor-field-label--split">Girar <b>{e.giro}°</b></span>
        <input type="range" className="editor-range" min={-180} max={180} value={e.giro} disabled={readOnly} onChange={(ev) => mudar({ giro: Number(ev.target.value) })} />
      </label>
      <p className="puck-alternador__apoio">
        Arraste a foto na prévia para reposicionar.{e.giro !== 0 ? " Girada, aumente o zoom para cobrir os cantos." : ""}
      </p>
      {alterado ? (
        <button type="button" className="banner-origem__tirar" disabled={readOnly} onClick={() => onChange({ ...ENQUADRAMENTO_NEUTRO })}>
          <ArrowCounterClockwise size={13} /> Voltar ao enquadramento original
        </button>
      ) : null}
    </div>
  );
}

export const campoImagemDoBanner = {
  type: "custom",
  label: "Imagem do banner",
  render: ({ value, onChange, readOnly }) => <OrigemDaImagem value={value} onChange={onChange} readOnly={readOnly} />,
};

export const campoEnquadramento = {
  type: "custom",
  label: "Enquadramento",
  render: ({ value, onChange, readOnly }) => <Enquadramento value={value} onChange={onChange} readOnly={readOnly} />,
};
