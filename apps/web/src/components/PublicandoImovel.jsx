import { createPortal } from "react-dom";
import { Buildings, ImagesSquare, ShareNetwork, Check } from "@phosphor-icons/react";

/* ────────────────────────────────────────────────────────────────────────────
   A tela enquanto o imóvel é publicado.

   ── POR QUE ELA EXISTE ──

   Publicar não é uma requisição: é o cadastro, mais uma marca d'água desenhada
   por foto, mais um envio ao Cloudinary por foto, mais o registro de cada
   imagem, mais o disparo das publicações automáticas. Com dez fotos isso passa
   fácil de meio minuto.

   O único sinal disso era o botão ficando levemente diferente. A pessoa clicava
   de novo, ou saía da página no meio — e sair no meio deixa o imóvel criado com
   metade das fotos.

   ── O NÚMERO É REAL ──

   `feito`/`total` vêm do laço que envia as fotos, um a um (ver
   `DashboardPage.handleSubmit`). Nada aqui é temporizador fingindo progresso:
   uma barra inventada que trava em 90%% e espera é pior que barra nenhuma,
   porque ensina a pessoa a não confiar no que a tela diz.

   As etapas sem contagem (salvar, divulgar) não ganham porcentagem — mostram
   que estão em curso e pronto.

   ── COBRE A JANELA, PELO PORTAL ──

   Pelo `<body>`, e não onde o formulário está: o `AdminLayout` embrulha o
   conteúdo numa div com `transform`, e `position: fixed` dentro de `transform`
   passa a medir por ela. Ver o cabeçalho de `components/Modal.jsx`.
   ──────────────────────────────────────────────────────────────────────────── */

const ETAPAS = [
  { id: "salvando",   Icone: Buildings,    rotulo: "Salvando o imóvel" },
  { id: "fotos",      Icone: ImagesSquare, rotulo: "Enviando as fotos" },
  /* Só existe para quem tem canal para publicar. No plano Básico não há portal
     nem rede social ligada, e anunciar uma etapa que não vai acontecer é a
     mesma promessa vazia de uma barra de progresso inventada. */
  { id: "divulgando", Icone: ShareNetwork, rotulo: "Publicando nos canais", exigeCanais: true },
];

/* O portal é encanamento; o cartão é o conteúdo. Separados porque só o cartão
   dá para renderizar fora do navegador — `createPortal` precisa de `document`,
   e a suíte roda em Node puro. */
export function PublicandoImovel({ progresso, editando = false, temCanais = true }) {
  if (!progresso) return null;
  return createPortal(
    <div className="pub-raiz" role="status" aria-live="polite">
      <div className="pub-veu" aria-hidden="true" />
      <CartaoDePublicacao progresso={progresso} editando={editando} temCanais={temCanais} />
    </div>,
    document.body,
  );
}

export function CartaoDePublicacao({ progresso, editando = false, temCanais = true }) {
  const etapas = ETAPAS.filter((e) => temCanais || !e.exigeCanais);
  const atual = progresso.etapa || "salvando";
  const indiceAtual = Math.max(0, etapas.findIndex((e) => e.id === atual));

  const total = progresso.total || 0;
  const feito = progresso.feito || 0;
  const temContagem = atual === "fotos" && total > 0;
  const porcento = temContagem ? Math.round((feito / total) * 100) : 0;

  return (
    <div className="pub-caixa modal-cartao">
        {/* O anel gira o tempo todo; quando há contagem, ele também PREENCHE.
            Girar sem preencher diz "estou vivo"; preencher diz "falta tanto". */}
        <div className="pub-anel" style={temContagem ? { "--pub-pct": `${porcento}%` } : undefined}>
          <div className={`pub-anel__giro${temContagem ? " tem-contagem" : ""}`} aria-hidden="true" />
          <span className="pub-anel__miolo">
            {temContagem ? <strong>{porcento}%</strong> : <span className="pub-pontos"><i /><i /><i /></span>}
          </span>
        </div>

        <h3 className="pub-titulo">{editando ? "Salvando alterações" : "Publicando seu imóvel"}</h3>
        <p className="pub-sub">
          {temContagem
            ? `Foto ${Math.min(feito + 1, total)} de ${total} — as fotos recebem a marca d'água antes de subir.`
            : "Isto pode levar alguns segundos. Não feche esta página."}
        </p>

        <ol className="pub-etapas">
          {etapas.map((etapa, i) => {
            const concluida = i < indiceAtual;
            const ativa = i === indiceAtual;
            return (
              <li
                key={etapa.id}
                className={`pub-etapa${concluida ? " is-feita" : ""}${ativa ? " is-ativa" : ""}`}
              >
                <span className="pub-etapa__marca">
                  {concluida ? <Check size={13} weight="bold" /> : <etapa.Icone size={14} weight={ativa ? "fill" : "regular"} />}
                </span>
                <span>{etapa.rotulo}</span>
              </li>
            );
          })}
        </ol>
      </div>
  );
}
