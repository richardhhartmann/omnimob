import {
  InstagramLogo,
  FacebookLogo,
  LinkedinLogo,
  YoutubeLogo,
  TiktokLogo,
  XLogo,
  Globe,
} from "@phosphor-icons/react";
// O glifo OFICIAL do WhatsApp — ver `utils/marcasDeRede`.
import { WhatsappMarca } from "../../../utils/marcasDeRede.jsx";
import { ShowcaseLinkExterno, ShowcaseTexto, usaFonteReal, useDadosDaVitrine,
  useVitrine,
} from "../contexto.jsx";
import { TituloDoWidget } from "../TituloDoWidget.jsx";

/* Redes sociais.

   O conteúdo é uma lista de endereços separados por barra. A vitrine sempre
   desenhou botões a partir deles; o editor mostrava a lista de URLs como texto
   corrido. Agora os dois desenham os botões, e os endereços são editados no
   inspetor — eles são configuração, e pintá-los na prancheta seria desenhar
   algo que a página publicada não tem.

   ── SOBRE OS ÍCONES ──

   Eram a INICIAL da rede dentro do botão: "W" para WhatsApp, "I" para
   Instagram. Marca se reconhece pelo símbolo, não pela primeira letra — e um
   "F" quadrado num botão azul lê como erro de carregamento, não como Facebook.
   Agora são os logotipos de verdade, do mesmo conjunto que o painel já usa.

   Cinco redes a mais entraram junto (LinkedIn, YouTube, TikTok, X): a lista de
   reconhecimento já existia e acrescentar uma linha em cada mapa é mais barato
   do que a imobiliária descobrir que o link do YouTube dela vira um globo. */

/* Uma linha por rede: como reconhecê-la no endereço, o nome, o ícone e a cor.
   Um lugar só — antes o rótulo, a inicial e o fundo estavam em três ternários
   encadeados, e acrescentar uma rede exigia mexer nos três sem esquecer nenhum. */
const REDES = [
  { casa: /wa\.me|whatsapp/i, rotulo: "WhatsApp", Icone: WhatsappMarca, fundo: "#25D366" },
  {
    casa: /instagram/i,
    rotulo: "Instagram",
    Icone: InstagramLogo,
    fundo: "linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)",
  },
  { casa: /facebook|fb\.com/i, rotulo: "Facebook", Icone: FacebookLogo, fundo: "#1877F2" },
  { casa: /linkedin/i, rotulo: "LinkedIn", Icone: LinkedinLogo, fundo: "#0A66C2" },
  { casa: /youtube|youtu\.be/i, rotulo: "YouTube", Icone: YoutubeLogo, fundo: "#FF0000" },
  { casa: /tiktok/i, rotulo: "TikTok", Icone: TiktokLogo, fundo: "#010101" },
  { casa: /twitter\.com|x\.com/i, rotulo: "X", Icone: XLogo, fundo: "#0f1419" },
];

const DESCONHECIDA = { rotulo: "Acessar", Icone: Globe, fundo: "var(--accent)" };

export function redesDoConteudo(conteudo) {
  return String(conteudo || "")
    .split("|")
    .map((url) => url.trim())
    .filter(Boolean)
    .map((url) => {
      const encontrada = REDES.find((r) => r.casa.test(url)) || DESCONHECIDA;
      return { url, rotulo: encontrada.rotulo, Icone: encontrada.Icone, fundo: encontrada.fundo };
    });
}

/* ── Os endereços de verdade ─────────────────────────────────────────────────
   O padrão do widget era `https://wa.me/|https://instagram.com/|https://facebook.com/`
   — três endereços SEM PERFIL. Clicar levava à página inicial de cada rede, e a
   imobiliária que não trocasse os três publicava uma seção "Acompanhe nas redes
   sociais" que não acompanha ninguém.

   Agora saem do cadastro: o WhatsApp do perfil e a página do Facebook que a
   imobiliária conectou em Configurações › Redes Sociais.

   O Instagram fica de fora mesmo quando está conectado, e a razão é honesta: a
   Graph API nos dá o id da conta business, e `instagram.com/<id>` não abre. O @
   da conta não é guardado em lugar nenhum. Botão que leva a lugar nenhum é pior
   que botão ausente — quem quiser o Instagram cola o endereço no inspetor, e
   aí ele entra pelo caminho manual. */
function redesReais(redes) {
  if (!redes) return [];
  return [redes.whatsapp, redes.facebook, redes.instagram].filter(Boolean);
}

export function SocialWidget({ widget }) {
  const cor = widget.color ? { color: widget.color } : undefined;
  const dados = useDadosDaVitrine();
  const { modo, aoEditar } = useVitrine();
  const reais = redesReais(dados?.redes);
  const real = usaFonteReal(widget, reais);
  /* Editar os endereços só faz sentido no caminho MANUAL: com a fonte real
     ligada eles vêm de Configurações › Redes Sociais, e um campo aqui
     prometeria uma mudança que a página ignoraria. */
  const ehEditor = modo === "editor" && Boolean(aoEditar) && !real;
  const enderecos = String(widget.content || "").split("|").map((u) => u.trim()).filter(Boolean);
  const redes = redesDoConteudo(real ? reais.join("|") : widget.content);

  /* Uma gravação por mudança, no formato que o widget já lê. O separador `|`
     continua existindo no armazenamento — o que muda é que ninguém mais precisa
     digitá-lo. */
  const gravar = (lista) => aoEditar(`widget|${widget.id}|content`, lista.filter((u) => u.trim()).join("|"));

  return (
    <div style={{ textAlign: "center", padding: "8px" }}>
      <TituloDoWidget widget={widget} umaLinha style={cor} />
      <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "16px", marginTop: "24px" }}>
        {redes.map((rede, i) => (
          <ShowcaseLinkExterno
            key={i}
            href={rede.url}
            style={{
              display: "flex", alignItems: "center", gap: "10px", padding: "14px 28px",
              background: rede.fundo, borderRadius: "16px", color: "#fff", fontSize: "15px",
              fontWeight: "600", textDecoration: "none", boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            }}
          >
            {/* `weight="fill"` porque o botão é sólido e colorido: o contorno
                fino do peso padrão some contra o fundo saturado. */}
            <rede.Icone size={20} weight="fill" aria-hidden />
            {rede.rotulo}
          </ShowcaseLinkExterno>
        ))}
      </div>

      {/* ── O ENDEREÇO DE CADA REDE, NO PRÓPRIO BOTÃO ─────────────────────────
          Isto morava no inspetor como UMA caixa de texto com os três endereços
          separados por `|`. Quem nunca viu aquele formato não tinha como
          adivinhá-lo, e um `|` esquecido colava dois endereços num só.

          Aqui cada endereço é um campo, na ordem dos botões acima — o primeiro
          campo é o primeiro botão. O ícone à esquerda do campo é o mesmo que o
          botão vai ganhar, então dá para ver a rede sendo reconhecida enquanto
          se digita.

          Só no editor, e a fileira inteira é descartada pelo teste de paridade
          (`widget-editor-apenas`). */}
      {ehEditor ? (
        <div className="widget-editor-apenas social-editor">
          {enderecos.map((url, i) => {
            const reconhecida = redesDoConteudo(url)[0];
            return (
              // Índice na chave: o texto muda a cada tecla, e usá-lo como
              // identidade tiraria o cursor do campo.
              <span className="social-editor__linha" key={i}>
                <span className="social-editor__marca" style={{ background: reconhecida?.fundo }}>
                  {reconhecida ? <reconhecida.Icone size={13} weight="fill" aria-hidden /> : null}
                </span>
                <input
                  value={url}
                  placeholder="https://instagram.com/suaimobiliaria"
                  aria-label={`Endereço ${i + 1}`}
                  onChange={(e) => gravar(enderecos.map((u, j) => (j === i ? e.target.value : u)))}
                />
                <button
                  type="button"
                  title="Remover esta rede"
                  onClick={() => gravar(enderecos.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              </span>
            );
          })}
          <button
            type="button"
            className="social-editor__mais"
            /* Um espaço, e não string vazia: o `filter` de `gravar` descartaria
               o vazio na hora e o campo novo sumiria antes de ser digitado. */
            onClick={() => aoEditar(`widget|${widget.id}|content`, [...enderecos, " "].join("|"))}
          >
            + Rede social
          </button>
        </div>
      ) : null}
    </div>
  );
}
