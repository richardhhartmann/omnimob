/* ────────────────────────────────────────────────────────────────────────────
   O BANCO DE FOTOS PADRÃO DO BANNER.

   Para quem ainda não tem foto própria: imagens de imóvel de verdade, para o
   banner não nascer vazio nem com paisagem genérica.

   ── DE ONDE VÊM ──

   Do Unsplash — licença livre para uso comercial sem atribuição
   (unsplash.com/license) — e são os MESMOS ids que `apps/api/scripts/
   demonstracao.js` usa, conferidos um a um numa prancha antes de entrar lá. A
   imagem é servida direto da CDN deles, como na demonstração: não há cópia na
   conta da Omnimob no Cloudinary, então incluir uma foto aqui é acrescentar
   um id, sem upload nenhum.

   Endereço com largura fixa (`w=1920`) e `auto=format`: o Unsplash entrega o
   formato mais leve que o navegador aceita, no tamanho de um banner — e a
   miniatura da lista usa o mesmo id com `w=480`.
   ──────────────────────────────────────────────────────────────────────────── */

const GRUPOS = [
  {
    nome: "Fachadas",
    ids: [
      "1570129477492-45c003edd2be",
      "1600596542815-ffad4c1539a9",
      "1512917774080-9991f1c4c750",
      "1580587771525-78b9dba3b914",
      "1613490493576-7fde63acd811",
      "1594484208280-efa00f96fc21",
    ],
  },
  {
    nome: "Interiores",
    ids: [
      "1522708323590-d24dbb6b0267",
      "1600566753086-00f18fb6b3ea",
      "1600585152220-90363fe7e115",
      "1586023492125-27b2c045efd7",
      "1493809842364-78817add7ffb",
      "1600210492486-724fe5c67fb0",
    ],
  },
  {
    nome: "Comercial",
    ids: [
      "1497366216548-37526070297c",
      "1497366811353-6870744d04b2",
      "1560448204-e02f11c3d0e2",
      "1554995207-c18c203602cb",
    ],
  },
];

const url = (id, largura) => `https://images.unsplash.com/photo-${id}?w=${largura}&q=80&auto=format&fit=crop`;

/** Os grupos do banco, cada foto com o endereço do banner e o da miniatura. */
export const BANCO_DE_FOTOS = GRUPOS.map((g) => ({
  nome: g.nome,
  fotos: g.ids.map((id) => ({ id, url: url(id, 1920), miniatura: url(id, 480) })),
}));
