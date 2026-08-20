import {
  WhatsappLogo,
  InstagramLogo,
  FacebookLogo,
  LinkedinLogo,
  YoutubeLogo,
  TiktokLogo,
  XLogo,
  Globe,
} from "@phosphor-icons/react";
import { ShowcaseLinkExterno, ShowcaseTexto, usaFonteReal, useDadosDaVitrine } from "../contexto.jsx";

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
  { casa: /wa\.me|whatsapp/i, rotulo: "WhatsApp", Icone: WhatsappLogo, fundo: "#25D366" },
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
  const reais = redesReais(dados?.redes);
  const real = usaFonteReal(widget, reais);
  const redes = redesDoConteudo(real ? reais.join("|") : widget.content);

  return (
    <div style={{ textAlign: "center", padding: "8px" }}>
      <ShowcaseTexto as="h3" campo={`widget|${widget.id}|title`} umaLinha html={widget.title} style={cor} />
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
    </div>
  );
}
