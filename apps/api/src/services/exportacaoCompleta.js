import { prisma } from "../db.js";

/* ────────────────────────────────────────────────────────────────────────────
   Tudo que é da imobiliária, num arquivo.

   A API já permite tirar cada coisa em separado — mas exige uma chave, um
   cliente HTTP e alguém que saiba paginar. Isso responde ao integrador e não
   responde à pergunta que uma imobiliária faz na hora de sair, ou que um
   titular faz ao exercer o direito de portabilidade: "me dá o que é meu".

   Um botão, um JSON. Sem paginação, sem chave, sem terminal.

   ── O QUE ENTRA ──

   O acervo inteiro (inclusive rascunhos e inativos), a carteira de clientes, a
   equipe, os leads com histórico, as vendas, os perfis de busca, os catálogos
   (tipos e cargos) e a configuração da vitrine.

   ── O QUE NÃO ENTRA, E POR QUÊ ──

   Senhas — nem hash. Um arquivo baixado circula por e-mail e pen drive; hash de
   senha ali é um risco permanente em troca de nada, porque ninguém importa
   hash em lugar nenhum.

   Tokens de rede social e segredos de webhook, pela mesma razão: são
   credenciais de acesso a sistemas de terceiros, e o destino do arquivo é
   desconhecido.

   As FOTOS vão como URL, não embutidas. Um acervo de trezentos imóveis com
   imagens em base64 daria centenas de megabytes num JSON — e as URLs do
   Cloudinary são públicas e permanentes enquanto a conta existir.

   ── LIMITE ──

   Monta tudo em memória e devolve de uma vez. Para o porte de uma imobiliária
   (milhares de registros, não milhões) isso é medido em dezenas de megabytes e
   cabe; streaming acrescentaria complexidade real para um problema que ninguém
   tem. Se um dia tiver, o lugar de resolver é aqui.
   ──────────────────────────────────────────────────────────────────────────── */

export async function exportarTudo(tenantId) {
  const [
    tenant, imoveis, clientes, usuarios, leads, vendas, perfis, tipos, cargos,
  ] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        name: true, slug: true, cnpj: true, creci: true, whatsapp: true, telefone: true,
        email: true, description: true, slogan: true, logoUrl: true,
        primaryColor: true, secondaryColor: true, showcaseHeadline: true, showcaseSubheadline: true,
        cep: true, endereco: true, cidade: true, estado: true,
        horarioAtendimento: true, fundadaEm: true, showcaseConfig: true,
        plano: true, createdAt: true,
        // Sem `facebookPageToken`: é credencial de terceiro.
      },
    }),
    prisma.property.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
      include: {
        tipoImovel: { select: { descricao: true } },
        images: { orderBy: { position: "asc" }, select: { url: true, is360: true, position: true } },
        /* `ImovelAtributo` é tabela de LIGAÇÃO pura: a linha existir já significa
           que o atributo se aplica ao imóvel. Aqui se pedia um campo `valor` e
           uma relação `modelo`, e nenhum dos dois existe no schema — a consulta
           estourava, e como é a primeira do lote, a exportação inteira caía com
           500. A rota nunca chegou a devolver um arquivo. */
        atributos: { select: { atributo: { select: { descricao: true } } } },
      },
    }),
    prisma.cliente.findMany({ where: { tenantId }, orderBy: { nome: "asc" } }),
    prisma.usuario.findMany({
      where: { tenantId },
      orderBy: { nome: "asc" },
      // `select` explícito porque o padrão traria `senha`.
      select: {
        id: true, origemExterna: true, nome: true, login: true, email: true, ativo: true,
        creci: true, whatsapp: true, cargoVitrine: true, exibirNaVitrine: true, foto: true,
        createdAt: true, cargo: { select: { descricao: true } },
      },
    }),
    prisma.propertyLead.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
      include: {
        property: { select: { id: true, title: true } },
        eventos: { orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.venda.findMany({
      where: { tenantId },
      orderBy: { data: "asc" },
      include: {
        property: { select: { id: true, title: true } },
        cliente: { select: { id: true, nome: true } },
        usuario: { select: { id: true, nome: true } },
      },
    }),
    prisma.perfilBusca.findMany({ where: { tenantId }, orderBy: { createdAt: "asc" } }),
    prisma.tipoImovel.findMany({ where: { tenantId }, orderBy: { descricao: "asc" } }),
    prisma.cargo.findMany({ where: { tenantId }, orderBy: { descricao: "asc" } }),
  ]);

  return {
    /* O cabeçalho não é enfeite: um arquivo desses é aberto meses depois, por
       alguém que não estava aqui quando ele foi gerado. */
    exportadoEm: new Date().toISOString(),
    formato: "omnimob-exportacao-v1",
    observacao:
      "Senhas, tokens de redes sociais e segredos de webhook foram omitidos de propósito. As fotos estão como endereço; baixe-as se precisar dos arquivos.",
    imobiliaria: tenant,
    imoveis: imoveis.map((p) => ({
      ...p,
      price: p.price === null ? null : Number(p.price),
      tipoImovel: p.tipoImovel?.descricao || p.propertyType || "",
      fotos: p.images.map((i) => i.url),
      // Lista de nomes, e não pares nome/valor: não há valor para exportar —
      // o atributo se aplica ou não se aplica.
      atributos: p.atributos.map((a) => a.atributo?.descricao).filter(Boolean),
      images: undefined,
    })),
    clientes,
    usuarios: usuarios.map((u) => ({ ...u, cargo: u.cargo?.descricao || "" })),
    leads,
    vendas: vendas.map((v) => ({
      ...v,
      valor: v.valor === null ? null : Number(v.valor),
      comissao: v.comissao === null ? null : Number(v.comissao),
    })),
    perfisDeBusca: perfis,
    catalogos: {
      tiposDeImovel: tipos.map((t) => t.descricao),
      cargos: cargos.map((c) => c.descricao),
    },
    contagem: {
      imoveis: imoveis.length,
      clientes: clientes.length,
      usuarios: usuarios.length,
      leads: leads.length,
      vendas: vendas.length,
    },
  };
}
