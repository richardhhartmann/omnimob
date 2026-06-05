// Comodidades da região — fonte única de verdade.
// `osm` lista as tags do OpenStreetMap (Overpass) que mapeiam para cada comodidade.
// `icon` é usado nos cards e na página de detalhes da vitrine.
export const COMODIDADES = [
  { key: "possuiMercado", label: "Mercado", icon: "🛒", osm: ["supermarket", "convenience"] },
  { key: "possuiFarmacia", label: "Farmácia", icon: "💊", osm: ["pharmacy"] },
  { key: "possuiHospital", label: "Hospital / Clínica", icon: "🏥", osm: ["hospital", "clinic"] },
  { key: "possuiRestaurante", label: "Restaurante", icon: "🍽️", osm: ["restaurant", "fast_food", "cafe"] },
  { key: "possuiBanco", label: "Banco", icon: "🏦", osm: ["bank", "atm"] },
  { key: "possuiPostoCombustivel", label: "Posto de combustível", icon: "⛽", osm: ["fuel"] },
  { key: "possuiAcademia", label: "Academia", icon: "🏋️", osm: ["fitness_centre", "gym"] },
  { key: "possuiEscola", label: "Escola", icon: "🎓", osm: ["school", "college", "university"] },
  { key: "possuiShopping", label: "Shopping", icon: "🛍️", osm: ["mall"] },
  { key: "possuiHotel", label: "Hotel", icon: "🏨", osm: ["hotel", "guest_house"] },
  { key: "possuiParque", label: "Parque", icon: "🌳", osm: ["park"] },
  { key: "possuiTransportePublico", label: "Transporte público", icon: "🚌", osm: ["bus_station", "subway_entrance", "train_station"] },
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
