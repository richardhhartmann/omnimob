/* ────────────────────────────────────────────────────────────────────────────
   Ícones da Domus — SVG desenhado, no lugar de emoji.

   POR QUE NÃO EMOJI: o glifo é do SISTEMA, não nosso. O 🏥 do Windows é um
   prédio vermelho chapado, o do macOS é outro desenho, o do Android é um
   terceiro — e nenhum deles combina com uma interface de traço fino em roxo e
   dourado. Pior: emoji ignora `color`, então ele fica colorido no meio de uma
   linha monocromática e some contra fundos claros. Um SVG de traço herda
   `currentColor` e acompanha o estado do componente que o contém.

   PADRÃO DE DESENHO, igual ao que o resto do projeto já usa em SVG solto:
   viewBox 24×24, sem preenchimento, traço em `currentColor` com 1.8 de peso e
   pontas arredondadas. Todo ícone aceita `size` (lado em px) e repassa o resto
   das props para o <svg>, então `style`, `className` e `aria-*` continuam
   funcionando de fora.
   ──────────────────────────────────────────────────────────────────────────── */

function Svg({ size = 16, traco = 1.8, children, ...resto }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={traco}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...resto}
    >
      {children}
    </svg>
  );
}

/* ── Interface ───────────────────────────────────────────────────────────── */

export const IconeCheck = (p) => (
  <Svg traco={2.4} {...p}><polyline points="4 12.5 9.5 18 20 6.5" /></Svg>
);

export const IconeX = (p) => (
  <Svg traco={2.4} {...p}><line x1="5.5" y1="5.5" x2="18.5" y2="18.5" /><line x1="18.5" y1="5.5" x2="5.5" y2="18.5" /></Svg>
);

// Preenchida: estrela vazada some em tamanho pequeno, e ela quase sempre é um
// selo (avaliação, destaque) em que o peso visual é o recado.
export const IconeEstrela = ({ size = 16, ...resto }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...resto}>
    <path d="M12 2.6l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.44l-5.81 3.06 1.11-6.47L2.6 9.45l6.5-.95z" />
  </svg>
);

// Losango de quatro pontas — o ✦ dos selos de lançamento.
export const IconeFaisca = ({ size = 16, ...resto }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...resto}>
    <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" />
  </svg>
);

export const IconeEnvelope = (p) => (
  <Svg {...p}><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M3 7l9 6 9-6" /></Svg>
);

export const IconeTelefone = (p) => (
  <Svg {...p}><path d="M21 16.9v2.6a2 2 0 0 1-2.2 2 19.6 19.6 0 0 1-8.5-3 19.3 19.3 0 0 1-6-6 19.6 19.6 0 0 1-3-8.6A2 2 0 0 1 3.3 2H6a2 2 0 0 1 2 1.7c.1 1 .35 1.9.7 2.8a2 2 0 0 1-.5 2.1L7.1 9.8a16 16 0 0 0 6 6l1.2-1.1a2 2 0 0 1 2.1-.5c.9.35 1.8.6 2.8.7a2 2 0 0 1 1.8 2z" /></Svg>
);

export const IconeCelular = (p) => (
  <Svg {...p}><rect x="6" y="2" width="12" height="20" rx="2.6" /><line x1="10.5" y1="18.2" x2="13.5" y2="18.2" /></Svg>
);

export const IconeLink = (p) => (
  <Svg {...p}><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></Svg>
);

export const IconeBussola = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="9.3" /><polygon points="16.4 7.6 14.2 14.2 7.6 16.4 9.8 9.8" /></Svg>
);

export const IconeChapeuFormatura = (p) => (
  <Svg {...p}><path d="M12 3L1.8 8.2 12 13.4l10.2-5.2z" /><path d="M5.6 10.4v5.1c0 1.9 2.9 3.4 6.4 3.4s6.4-1.5 6.4-3.4v-5.1" /><line x1="22.2" y1="8.2" x2="22.2" y2="14" /></Svg>
);

export const IconeLua = (p) => (
  <Svg {...p}><path d="M20.5 14.5A8.6 8.6 0 0 1 9.5 3.5a8.6 8.6 0 1 0 11 11z" /></Svg>
);

export const IconeSol = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4.2" />
    <line x1="12" y1="1.6" x2="12" y2="3.6" /><line x1="12" y1="20.4" x2="12" y2="22.4" />
    <line x1="4.2" y1="4.2" x2="5.6" y2="5.6" /><line x1="18.4" y1="18.4" x2="19.8" y2="19.8" />
    <line x1="1.6" y1="12" x2="3.6" y2="12" /><line x1="20.4" y1="12" x2="22.4" y2="12" />
    <line x1="4.2" y1="19.8" x2="5.6" y2="18.4" /><line x1="18.4" y1="5.6" x2="19.8" y2="4.2" />
  </Svg>
);

export const IconeMouse = (p) => (
  <Svg {...p}><rect x="6.5" y="2.2" width="11" height="19.6" rx="5.5" /><line x1="12" y1="6.4" x2="12" y2="10" /></Svg>
);

export const IconeLapis = (p) => (
  <Svg {...p}><path d="M16.6 2.9a2.6 2.6 0 0 1 3.7 3.7L7.5 19.4 2.6 21l1.6-4.9z" /><line x1="15.2" y1="4.3" x2="18.9" y2="8" /></Svg>
);

export const IconeRedimensionar = (p) => (
  <Svg {...p}><polyline points="14 20 20 20 20 14" /><line x1="20" y1="20" x2="10.5" y2="10.5" /><polyline points="10 4 4 4 4 10" /></Svg>
);

export const IconeSetaBaixo = (p) => (
  <Svg traco={2.2} {...p}><line x1="12" y1="4" x2="12" y2="19" /><polyline points="5.5 12.5 12 19 18.5 12.5" /></Svg>
);

export const IconeTrofeu = (p) => (
  <Svg {...p}><path d="M7.5 3.2h9v5.4a4.5 4.5 0 0 1-9 0z" /><path d="M7.5 4.8H4.6v1.6a3.4 3.4 0 0 0 3 3.3" /><path d="M16.5 4.8h2.9v1.6a3.4 3.4 0 0 1-3 3.3" /><line x1="12" y1="13.1" x2="12" y2="17" /><path d="M8.4 20.8h7.2l-.8-3.8H9.2z" /></Svg>
);

/* ── Comodidades da região ───────────────────────────────────────────────── */

export const IconeMercado = (p) => (
  <Svg {...p}><circle cx="9.5" cy="20" r="1.3" /><circle cx="18" cy="20" r="1.3" /><path d="M1.8 2.6h3.1l2.4 11.6a1.9 1.9 0 0 0 1.9 1.5h8.6a1.9 1.9 0 0 0 1.9-1.5l1.5-7.6H6" /></Svg>
);

export const IconeFarmacia = (p) => (
  <Svg {...p}><rect x="2.6" y="8.4" width="18.8" height="12.4" rx="2.2" /><line x1="12" y1="11.6" x2="12" y2="17.6" /><line x1="9" y1="14.6" x2="15" y2="14.6" /><path d="M7.6 8.4V5.6a2 2 0 0 1 2-2h4.8a2 2 0 0 1 2 2v2.8" /></Svg>
);

export const IconeHospital = (p) => (
  <Svg {...p}><path d="M4 21.2V6.4a1.6 1.6 0 0 1 1.6-1.6h12.8A1.6 1.6 0 0 1 20 6.4v14.8" /><line x1="2.4" y1="21.2" x2="21.6" y2="21.2" /><line x1="12" y1="8.4" x2="12" y2="14.4" /><line x1="9" y1="11.4" x2="15" y2="11.4" /><line x1="10" y1="21.2" x2="10" y2="17.4" /><line x1="14" y1="21.2" x2="14" y2="17.4" /></Svg>
);

export const IconeRestaurante = (p) => (
  <Svg {...p}><path d="M6.4 2.4v7.2a2.4 2.4 0 0 0 4.8 0V2.4" /><line x1="8.8" y1="2.4" x2="8.8" y2="9.6" /><line x1="8.8" y1="12" x2="8.8" y2="21.6" /><path d="M17.6 2.4c-1.7 0-2.8 2-2.8 5.2s1.1 4.4 2.8 4.4z" /><line x1="17.6" y1="12" x2="17.6" y2="21.6" /></Svg>
);

export const IconeBanco = (p) => (
  <Svg {...p}><path d="M2.6 9.2L12 3.4l9.4 5.8" /><line x1="2.6" y1="20.6" x2="21.4" y2="20.6" /><line x1="5.6" y1="12" x2="5.6" y2="17.8" /><line x1="10" y1="12" x2="10" y2="17.8" /><line x1="14" y1="12" x2="14" y2="17.8" /><line x1="18.4" y1="12" x2="18.4" y2="17.8" /></Svg>
);

export const IconePosto = (p) => (
  <Svg {...p}><path d="M3.6 21.4V4.6a1.8 1.8 0 0 1 1.8-1.8h5.6a1.8 1.8 0 0 1 1.8 1.8v16.8" /><line x1="2.2" y1="21.4" x2="14.4" y2="21.4" /><line x1="6" y1="8" x2="10.4" y2="8" /><path d="M13 9.6h3.4a1.8 1.8 0 0 1 1.8 1.8v5.2a1.9 1.9 0 0 0 3.8 0V8.4l-2.6-2.6" /></Svg>
);

export const IconeAcademia = (p) => (
  <Svg {...p}><line x1="2.2" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="21.8" y2="12" /><rect x="4" y="8.4" width="3.2" height="7.2" rx="1.1" /><rect x="16.8" y="8.4" width="3.2" height="7.2" rx="1.1" /><line x1="7.2" y1="12" x2="16.8" y2="12" /></Svg>
);

export const IconeEscola = IconeChapeuFormatura;

export const IconeShopping = (p) => (
  <Svg {...p}><path d="M4.4 7.6h15.2l-1.2 12.2a1.8 1.8 0 0 1-1.8 1.6H7.4a1.8 1.8 0 0 1-1.8-1.6z" /><path d="M8.6 10.4V6.2a3.4 3.4 0 0 1 6.8 0v4.2" /></Svg>
);

export const IconeHotel = (p) => (
  <Svg {...p}><path d="M2.4 18.6v-4.2a2.4 2.4 0 0 1 2.4-2.4h14.4a2.4 2.4 0 0 1 2.4 2.4v4.2" /><line x1="2.4" y1="18.6" x2="21.6" y2="18.6" /><line x1="2.4" y1="21" x2="2.4" y2="18.6" /><line x1="21.6" y1="21" x2="21.6" y2="18.6" /><path d="M5.2 12V7.4a1.8 1.8 0 0 1 1.8-1.8h10a1.8 1.8 0 0 1 1.8 1.8V12" /><circle cx="8.6" cy="9.4" r="1.5" /></Svg>
);

export const IconeParque = (p) => (
  <Svg {...p}><path d="M12 2.4l4.6 6.4h-2.6l3.4 5.2H6.6L10 8.8H7.4z" /><line x1="12" y1="14" x2="12" y2="21.6" /><line x1="8.4" y1="21.6" x2="15.6" y2="21.6" /></Svg>
);

export const IconeOnibus = (p) => (
  <Svg {...p}><path d="M3.6 15.6V6a3 3 0 0 1 3-3h10.8a3 3 0 0 1 3 3v9.6" /><rect x="3.6" y="15.6" width="16.8" height="3.6" rx="1.2" /><line x1="3.6" y1="10.8" x2="20.4" y2="10.8" /><line x1="12" y1="3" x2="12" y2="10.8" /><circle cx="7.4" cy="17.4" r="0.9" /><circle cx="16.6" cy="17.4" r="0.9" /><line x1="6.6" y1="19.2" x2="6.6" y2="21" /><line x1="17.4" y1="19.2" x2="17.4" y2="21" /></Svg>
);

export default {};
