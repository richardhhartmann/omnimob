/* ────────────────────────────────────────────────────────────────────────────
   DE ONDE CADA WIDGET TIRA O CONTEÚDO.

   Sete widgets sabem se preencher com o dado REAL da imobiliária em vez do
   texto de exemplo. Este mapa é o que a interface mostra sobre isso: o nome da
   fonte, onde ela se cadastra, e o que exatamente aparece na página.

   Estava dentro do `BuilderInspector`, e saiu de lá quando o editor virou
   dois: o inspetor clássico e o do Puck precisam da MESMA lista, e uma cópia
   divergiria no primeiro widget que aprendesse a ler o cadastro — com o
   sintoma aparecendo só num dos editores.
   ──────────────────────────────────────────────────────────────────────────── */

/* ────────────────────────────────────────────────────────────────────────────
   De onde a peça tira o conteúdo.

   Sete widgets sabem ler o cadastro da imobiliária: a Equipe lista os
   corretores marcados como visíveis, Localização desenha o mapa do endereço,
   Números conta imóveis e vendas, Regiões sai do acervo, Horários vem do
   atendimento, Busca oferece os tipos que existem e Redes usa os perfis
   conectados.

   O alternador começa LIGADO, e é isso que muda o padrão do produto: arrastar a
   peça já traz o que é verdade. Antes vinha "Ana Souza, João Lima e Marina
   Alves" — três pessoas inventadas no código — e só saía dali se alguém
   apagasse campo por campo.

   Desligar é uma escolha legítima, e por isso existe: a imobiliária que ainda
   não cadastrou a equipe, ou que quer um texto próprio, recupera os campos
   manuais intactos. Nada se perde na troca — o conteúdo digitado continua
   guardado no widget enquanto a fonte real está no ar.
   ────────────────────────────────────────────────────────────────────────── */
export const FONTES_REAIS = {
  team: {
    rotulo: "Equipe cadastrada",
    onde: "Usuários",
    explica: "Lista quem está ativo e marcado como “aparecer na vitrine”.",
  },
  map: {
    rotulo: "Endereço da imobiliária",
    onde: "Configurações › Perfil",
    explica: "Desenha o mapa e o botão de rota a partir do endereço cadastrado.",
  },
  hours: {
    rotulo: "Horário de atendimento",
    onde: "Configurações › Perfil",
    explica: "Mostra as faixas cadastradas e um selo de aberto ou fechado agora.",
  },
  stats: {
    rotulo: "Números do sistema",
    onde: "seu acervo",
    explica: "Conta imóveis ativos, negócios fechados, anos de mercado e cidades atendidas.",
  },
  regions: {
    rotulo: "Regiões do acervo",
    onde: "seus imóveis",
    explica: "Lista os bairros onde você tem imóvel, e o clique filtra a vitrine.",
  },
  "property-search": {
    rotulo: "Filtros do acervo",
    onde: "seus imóveis",
    explica: "Oferece os tipos e regiões que existem, e a busca filtra a página.",
  },
  social: {
    rotulo: "Perfis conectados",
    onde: "Configurações › Redes Sociais",
    explica: "Usa o WhatsApp do cadastro e as páginas da Meta conectadas.",
  },
};

