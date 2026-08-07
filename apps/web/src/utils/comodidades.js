import {
  IconeAcademia, IconeBanco, IconeEscola, IconeFarmacia, IconeHospital, IconeHotel,
  IconeMercado, IconeOnibus, IconeParque, IconePosto, IconeRestaurante, IconeShopping,
} from "../components/Icones.jsx";

/* Comodidades da região — fonte única de verdade.
   `osm` lista as tags do OpenStreetMap (Overpass) que mapeiam para cada comodidade.

   `Icone` é um COMPONENTE, não uma string: eram emojis, que cada sistema
   operacional desenha do seu jeito e que ignoram a cor do texto ao redor. Quem
   renderiza usa `<c.Icone size={…} />` e herda a cor de onde estiver. */
export const COMODIDADES = [
  { key: "possuiMercado", label: "Mercado", Icone: IconeMercado, osm: ["supermarket", "convenience"] },
  { key: "possuiFarmacia", label: "Farmácia", Icone: IconeFarmacia, osm: ["pharmacy"] },
  { key: "possuiHospital", label: "Hospital / Clínica", Icone: IconeHospital, osm: ["hospital", "clinic"] },
  { key: "possuiRestaurante", label: "Restaurante", Icone: IconeRestaurante, osm: ["restaurant", "fast_food", "cafe"] },
  { key: "possuiBanco", label: "Banco", Icone: IconeBanco, osm: ["bank", "atm"] },
  { key: "possuiPostoCombustivel", label: "Posto de combustível", Icone: IconePosto, osm: ["fuel"] },
  { key: "possuiAcademia", label: "Academia", Icone: IconeAcademia, osm: ["fitness_centre", "gym"] },
  { key: "possuiEscola", label: "Escola", Icone: IconeEscola, osm: ["school", "college", "university"] },
  { key: "possuiShopping", label: "Shopping", Icone: IconeShopping, osm: ["mall"] },
  { key: "possuiHotel", label: "Hotel", Icone: IconeHotel, osm: ["hotel", "guest_house"] },
  { key: "possuiParque", label: "Parque", Icone: IconeParque, osm: ["park"] },
  { key: "possuiTransportePublico", label: "Transporte público", Icone: IconeOnibus, osm: ["bus_station", "subway_entrance", "train_station"] },
];

// Estado inicial: todas as comodidades desmarcadas.
export const EMPTY_COMODIDADES = COMODIDADES.reduce((acc, c) => ({ ...acc, [c.key]: false }), {});

// Mapa reverso: valor da tag OSM → chave da comodidade.
export const OSM_TO_KEY = COMODIDADES.reduce((acc, c) => {
  c.osm.forEach((tag) => { acc[tag] = c.key; });
  return acc;
}, {});

// Retorna apenas as comodidades marcadas como true, na ordem canônica.
export function comodidadesAtivas(comodidades) {
  if (!comodidades || typeof comodidades !== "object") return [];
  return COMODIDADES.filter((c) => comodidades[c.key]);
}
