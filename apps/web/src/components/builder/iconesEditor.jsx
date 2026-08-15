/* Ícones do editor de vitrine.

   Mesmo desenho do resto da Omnimob (`components/Icones.jsx`): viewBox 24×24,
   traço em `currentColor`, pontas arredondadas. Ficam aqui, e não lá, porque só
   fazem sentido dentro do construtor — misturá-los ao catálogo geral faria a
   lista de ícones do produto crescer com vocabulário de ferramenta. */

function Svg({ size = 16, traco = 2, children, ...resto }) {
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

export const IconeGrip = (p) => (
  <Svg {...p}>
    <circle cx="9" cy="5" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="19" r="1" />
    <circle cx="15" cy="5" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="19" r="1" />
  </Svg>
);

export const IconeCadeado = (p) => (
  <Svg {...p}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></Svg>
);

export const IconeCadeadoAberto = (p) => (
  <Svg {...p}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></Svg>
);

export const IconeOlho = (p) => (
  <Svg {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></Svg>
);

export const IconeOlhoCortado = (p) => (
  <Svg {...p}>
    <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19" />
    <path d="M6.61 6.61A18.4 18.4 0 0 0 2 12s3.5 8 10 8a9 9 0 0 0 5.39-1.61" />
    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" /><path d="m2 2 20 20" />
  </Svg>
);

export const IconeDuplicar = (p) => (
  <Svg {...p}>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </Svg>
);

export const IconeDesfazer = (p) => (
  <Svg {...p} traco={2.2}><path d="M3 7v6h6" /><path d="M3 13A9 9 0 1 0 5.6 5.6" /></Svg>
);

export const IconeRefazer = (p) => (
  <Svg {...p} traco={2.2}><path d="M21 7v6h-6" /><path d="M21 13A9 9 0 1 1 18.4 5.6" /></Svg>
);

export const IconeDesktop = (p) => (
  <Svg {...p}><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8m-4-4v4" /></Svg>
);

export const IconeMobile = (p) => (
  <Svg {...p}><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M12 18h.01" /></Svg>
);

export const IconeMais = (p) => (
  <Svg {...p} traco={2.2}><path d="M12 5v14" /><path d="M5 12h14" /></Svg>
);

export const IconeMenos = (p) => (
  <Svg {...p} traco={2.2}><path d="M5 12h14" /></Svg>
);

export const IconeAjustar = (p) => (
  <Svg {...p}><path d="M3 8V5a2 2 0 0 1 2-2h3" /><path d="M16 3h3a2 2 0 0 1 2 2v3" /><path d="M21 16v3a2 2 0 0 1-2 2h-3" /><path d="M8 21H5a2 2 0 0 1-2-2v-3" /></Svg>
);

export const IconeCamadas = (p) => (
  <Svg {...p}><path d="m12 2 9 5-9 5-9-5 9-5z" /><path d="m3 17 9 5 9-5" /><path d="m3 12 9 5 9-5" /></Svg>
);

export const IconeGrade = (p) => (
  <Svg {...p}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></Svg>
);

export const IconeMaisMenu = (p) => (
  <Svg {...p} traco={2.4}><circle cx="5" cy="12" r="0.6" /><circle cx="12" cy="12" r="0.6" /><circle cx="19" cy="12" r="0.6" /></Svg>
);

export const IconeRelogio = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>
);

export const IconeReset = (p) => (
  <Svg {...p}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></Svg>
);

export const IconeCores = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Svg>
);

export const IconeFonte = (p) => (
  <Svg {...p}><path d="M4 7V4h16v3" /><path d="M9 20h6" /><path d="M12 4v16" /></Svg>
);

export const IconeSeta = (p) => (
  <Svg {...p}><path d="m9 18 6-6-6-6" /></Svg>
);

export const IconeExterno = (p) => (
  <Svg {...p}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6" /><path d="M10 14 21 3" /></Svg>
);

export const IconeFechar = (p) => (
  <Svg {...p}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></Svg>
);

export const IconePagina = (p) => (
  <Svg {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /></Svg>
);
