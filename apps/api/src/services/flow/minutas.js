/* ────────────────────────────────────────────────────────────────────────────
   O MOTOR DE MINUTAS — o texto do contrato preenchido com os dados do negócio.

   ── A REGRA QUE GOVERNA TUDO AQUI ──

   > MARCADOR SEM DADO NÃO VIRA VAZIO. Ele vira PENDÊNCIA, e o contrato não sai.

   Foi a primeira decisão e é a mais importante. A alternativa óbvia — trocar o
   que falta por string vazia — produz um contrato que parece pronto e diz
   "pelo presente instrumento, de um lado  , portador do CPF  ". Ninguém relê
   um documento de nove páginas antes de mandar para assinatura; a falha
   apareceria na frente do cliente, no e-mail da Clicksign, com o nome da
   imobiliária em cima.

   A outra alternativa — deixar `{{comprador.cpf}}` impresso — é pior ainda: é
   um documento com aparência de erro de sistema num contrato de compra e venda.

   Então o motor devolve `{ texto, pendencias[] }` e quem chama decide. A tela
   lista o que falta com o nome do campo em português e um link para a tela onde
   ele se preenche. Gerar assim mesmo é possível, mas exige dizer isso —
   `permitirIncompleto`, e o resultado marca as lacunas visualmente.

   ── O VOCABULÁRIO É FECHADO ──

   `CAMPOS`, abaixo, é a lista completa do que um modelo pode usar. Marcador
   fora dela é apontado como DESCONHECIDO na hora de salvar o modelo, e não na
   hora de gerar o contrato: quem escreve a minuta é quem tem como corrigir o
   erro de digitação, e descobrir isso seis meses depois, com um negócio parado
   esperando assinatura, é tarde demais.

   ── SEM BIBLIOTECA DE TEMPLATE ──

   Nada de Handlebars, Mustache ou EJS. O que este motor precisa é substituir
   `{{a.b}}` por um valor de uma tabela plana, e as três coisas que uma
   biblioteca traria de graça — laços, condicionais e includes — são exatamente
   as que NÃO podem existir num contrato editável pelo cliente. `{{#each}}` num
   campo de texto livre do painel é execução de código do usuário no servidor.
   ──────────────────────────────────────────────────────────────────────────── */

import { emReais } from "./comissoes.js";

/* ── O catálogo ───────────────────────────────────────────────────────────────

   `chave` é o que se escreve na minuta; `rotulo` é o que a tela mostra ao lado
   do editor e o que aparece na lista de pendências; `onde` é a tela onde o dado
   se preenche — sem isso, "falta o CPF do comprador" manda a pessoa procurar. */
export const CAMPOS = [
  // ── Comprador ──
  { chave: "comprador.nome", rotulo: "Nome do comprador", onde: "Clientes" },
  { chave: "comprador.cpf", rotulo: "CPF do comprador", onde: "Clientes" },
  { chave: "comprador.rg", rotulo: "RG do comprador", onde: "Clientes" },
  { chave: "comprador.nacionalidade", rotulo: "Nacionalidade do comprador", onde: "Clientes" },
  { chave: "comprador.estadoCivil", rotulo: "Estado civil do comprador", onde: "Clientes" },
  { chave: "comprador.profissao", rotulo: "Profissão do comprador", onde: "Clientes" },
  { chave: "comprador.email", rotulo: "E-mail do comprador", onde: "Clientes" },
  { chave: "comprador.telefone", rotulo: "Telefone do comprador", onde: "Clientes" },
  { chave: "comprador.endereco", rotulo: "Endereço do comprador", onde: "Clientes" },

  // ── Vendedor (o proprietário) ──
  { chave: "vendedor.nome", rotulo: "Nome do vendedor", onde: "Clientes" },
  { chave: "vendedor.cpf", rotulo: "CPF do vendedor", onde: "Clientes" },
  { chave: "vendedor.rg", rotulo: "RG do vendedor", onde: "Clientes" },
  { chave: "vendedor.nacionalidade", rotulo: "Nacionalidade do vendedor", onde: "Clientes" },
  { chave: "vendedor.estadoCivil", rotulo: "Estado civil do vendedor", onde: "Clientes" },
  { chave: "vendedor.profissao", rotulo: "Profissão do vendedor", onde: "Clientes" },
  { chave: "vendedor.email", rotulo: "E-mail do vendedor", onde: "Clientes" },
  { chave: "vendedor.telefone", rotulo: "Telefone do vendedor", onde: "Clientes" },
  { chave: "vendedor.endereco", rotulo: "Endereço do vendedor", onde: "Clientes" },

  // ── Imóvel ──
  { chave: "imovel.titulo", rotulo: "Título do imóvel", onde: "Imóveis" },
  { chave: "imovel.tipo", rotulo: "Tipo do imóvel", onde: "Imóveis" },
  { chave: "imovel.endereco", rotulo: "Endereço do imóvel", onde: "Imóveis" },
  { chave: "imovel.bairro", rotulo: "Bairro do imóvel", onde: "Imóveis" },
  { chave: "imovel.cidade", rotulo: "Cidade do imóvel", onde: "Imóveis" },
  { chave: "imovel.estado", rotulo: "Estado do imóvel", onde: "Imóveis" },
  { chave: "imovel.cep", rotulo: "CEP do imóvel", onde: "Imóveis" },
  { chave: "imovel.area", rotulo: "Área do imóvel", onde: "Imóveis" },
  { chave: "imovel.quartos", rotulo: "Quartos", onde: "Imóveis" },
  { chave: "imovel.banheiros", rotulo: "Banheiros", onde: "Imóveis" },
  { chave: "imovel.vagas", rotulo: "Vagas de garagem", onde: "Imóveis" },
  { chave: "imovel.matricula", rotulo: "Matrícula do imóvel", onde: "Imóveis" },
  { chave: "imovel.valor", rotulo: "Valor de anúncio do imóvel", onde: "Imóveis" },

  // ── Negócio ──
  { chave: "negocio.codigo", rotulo: "Número do negócio", onde: "Flow" },
  { chave: "negocio.valor", rotulo: "Valor fechado do negócio", onde: "Flow" },
  { chave: "negocio.valorPorExtenso", rotulo: "Valor por extenso", onde: "Flow" },
  { chave: "negocio.comissao", rotulo: "Comissão total", onde: "Flow" },
  { chave: "negocio.corretor", rotulo: "Corretor responsável", onde: "Flow" },
  { chave: "negocio.creciCorretor", rotulo: "CRECI do corretor", onde: "Usuários" },

  // ── Imobiliária ──
  { chave: "imobiliaria.nome", rotulo: "Nome da imobiliária", onde: "Configurações" },
  { chave: "imobiliaria.cnpj", rotulo: "CNPJ da imobiliária", onde: "Configurações" },
  { chave: "imobiliaria.creci", rotulo: "CRECI da imobiliária", onde: "Configurações" },
  { chave: "imobiliaria.endereco", rotulo: "Endereço da imobiliária", onde: "Configurações" },
  { chave: "imobiliaria.telefone", rotulo: "Telefone da imobiliária", onde: "Configurações" },
  { chave: "imobiliaria.email", rotulo: "E-mail da imobiliária", onde: "Configurações" },

  // ── Data ──
  /* Sempre preenchidos, nunca pendência: eles saem do relógio e não do
     cadastro. Estão no catálogo porque a tela precisa oferecê-los na lista de
     marcadores — um contrato sem data de assinatura é um contrato incompleto, e
     obrigar a digitá-la à mão é convidar o erro. */
  { chave: "data.hoje", rotulo: "Data de hoje (por extenso)", onde: null },
  { chave: "data.dia", rotulo: "Dia", onde: null },
  { chave: "data.mes", rotulo: "Mês por extenso", onde: null },
  { chave: "data.ano", rotulo: "Ano", onde: null },
  { chave: "data.cidadeImobiliaria", rotulo: "Cidade da imobiliária", onde: "Configurações" },
];

const CHAVES_VALIDAS = new Set(CAMPOS.map((c) => c.chave));
const ROTULO = Object.fromEntries(CAMPOS.map((c) => [c.chave, c.rotulo]));
const ONDE = Object.fromEntries(CAMPOS.map((c) => [c.chave, c.onde]));

/* `{{ chave }}` com espaço opcional, porque quem escreve a minuta vai digitar
   dos dois jeitos e recusar por um espaço seria uma armadilha invisível.
   Sem `g` na constante: `RegExp` com flag global carrega `lastIndex` entre
   chamadas, e a segunda geração da mesma minuta pularia metade dos marcadores.
   O `g` entra na cópia feita em cada uso. */
const MARCADOR = /\{\{\s*([a-zA-Z]+\.[a-zA-Z]+)\s*\}\}/;

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/* ── Valor por extenso ────────────────────────────────────────────────────────

   Escrito à mão, e não por biblioteca. São ~60 linhas contra uma dependência
   nova num projeto que evita dependência por princípio, e a faixa que importa é
   estreita: valor de imóvel no Brasil vive entre dez mil e algumas dezenas de
   milhões. Acima de um bilhão a função devolve `null`, e o marcador vira
   pendência — melhor recusar do que imprimir errado num contrato. */
const UNIDADES = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const DEZ_A_DEZENOVE = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

function ateNovecentosNoventaENove(n) {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const partes = [];
  const c = Math.floor(n / 100);
  const resto = n % 100;
  if (c) partes.push(CENTENAS[c]);
  if (resto >= 10 && resto <= 19) {
    partes.push(DEZ_A_DEZENOVE[resto - 10]);
  } else {
    const d = Math.floor(resto / 10);
    const u = resto % 10;
    if (d) partes.push(DEZENAS[d]);
    if (u) partes.push(UNIDADES[u]);
  }
  return partes.join(" e ");
}

export function porExtenso(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 0 || n >= 1_000_000_000) return null;

  const reais = Math.floor(n);
  const centavos = Math.round((n - reais) * 100);

  function inteiroPorExtenso(v) {
    if (v === 0) return "zero";
    const milhoes = Math.floor(v / 1_000_000);
    const milhares = Math.floor((v % 1_000_000) / 1000);
    const unidades = v % 1000;
    const partes = [];
    if (milhoes) partes.push(`${ateNovecentosNoventaENove(milhoes)} ${milhoes === 1 ? "milhão" : "milhões"}`);
    if (milhares) partes.push(milhares === 1 ? "mil" : `${ateNovecentosNoventaENove(milhares)} mil`);
    if (unidades) partes.push(ateNovecentosNoventaENove(unidades));
    /* O "e" antes da última parcela só quando ela é menor que cem ou redonda —
       é a regra do português: "mil e quinhentos", mas "mil quinhentos e vinte". */
    if (partes.length <= 1) return partes.join("");
    const ultima = partes.pop();
    const ultimaCurta = unidades > 0 && (unidades < 100 || unidades % 100 === 0);
    return `${partes.join(", ")}${ultimaCurta ? " e " : " "}${ultima}`;
  }

  /* ── O "de" antes de "reais" ──────────────────────────────────────────────
     Regra do português que quase todo conversor erra: quando o número termina
     numa palavra de magnitude sem nada depois dela, entra a preposição.

       2.000.000  → "dois milhões DE reais"     (e não "dois milhões reais")
       2.000.500  → "dois milhões e quinhentos reais"
       1.000      → "mil reais"                 ("mil" não é magnitude sozinha)

     Num contrato isso importa mais do que parece: o valor por extenso é o que
     prevalece sobre o numeral em caso de divergência, e um erro de concordância
     ali é a primeira coisa que um advogado aponta na leitura. */
  const terminaEmMagnitude = reais >= 1_000_000 && reais % 1_000_000 === 0;
  const unidade = reais === 1 ? "real" : "reais";
  const texto = `${inteiroPorExtenso(reais)} ${terminaEmMagnitude ? "de " : ""}${unidade}`;
  if (!centavos) return texto;
  return `${texto} e ${inteiroPorExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`;
}

/* ── Montagem do dicionário ───────────────────────────────────────────────────

   Uma tabela plana `chave -> valor`. Valor ausente é `null` e NÃO string
   vazia: a distinção é o que separa "não preenchido" de "preenchido em branco",
   e é ela que decide o que vira pendência. */
function texto(v) {
  const t = v === null || v === undefined ? "" : String(v).trim();
  return t.length ? t : null;
}

function enderecoDe(c) {
  if (!c) return null;
  const linha = [c.endereco, c.numero].filter(Boolean).join(", ");
  const resto = [c.bairro, c.cidade && c.estado ? `${c.cidade}/${c.estado}` : c.cidade, c.cep]
    .filter(Boolean)
    .join(" - ");
  return texto([linha, resto].filter(Boolean).join(" - "));
}

/**
 * @param {object} ctx
 * @param {object} ctx.negocio   com comprador, vendedor, property e responsavel incluídos
 * @param {object} ctx.tenant
 * @param {Date}   [ctx.agora]   injetável para o teste não depender do relógio
 */
export function montarDicionario({ negocio, tenant, agora = new Date() }) {
  const comprador = negocio?.comprador || null;
  const vendedor = negocio?.vendedor || null;
  const imovel = negocio?.property || null;
  const corretor = negocio?.responsavel || null;

  const valor = negocio?.valorFechado ?? negocio?.valorProposta ?? null;
  const extenso = valor == null ? null : porExtenso(Number(valor));

  return {
    "comprador.nome": texto(comprador?.nome),
    "comprador.cpf": texto(comprador?.cpf),
    "comprador.rg": texto(comprador?.rg),
    "comprador.nacionalidade": texto(comprador?.nacionalidade) || "brasileiro(a)",
    "comprador.estadoCivil": texto(comprador?.estadoCivil),
    "comprador.profissao": texto(comprador?.profissao),
    "comprador.email": texto(comprador?.email),
    "comprador.telefone": texto(comprador?.telefone || comprador?.whatsapp),
    "comprador.endereco": enderecoDe(comprador),

    "vendedor.nome": texto(vendedor?.nome),
    "vendedor.cpf": texto(vendedor?.cpf),
    "vendedor.rg": texto(vendedor?.rg),
    "vendedor.nacionalidade": texto(vendedor?.nacionalidade) || "brasileiro(a)",
    "vendedor.estadoCivil": texto(vendedor?.estadoCivil),
    "vendedor.profissao": texto(vendedor?.profissao),
    "vendedor.email": texto(vendedor?.email),
    "vendedor.telefone": texto(vendedor?.telefone || vendedor?.whatsapp),
    "vendedor.endereco": enderecoDe(vendedor),

    "imovel.titulo": texto(imovel?.title),
    "imovel.tipo": texto(imovel?.propertyType),
    "imovel.endereco": texto(imovel?.address),
    "imovel.bairro": texto(imovel?.neighborhood),
    "imovel.cidade": texto(imovel?.city),
    "imovel.estado": texto(imovel?.state),
    "imovel.cep": texto(imovel?.cep),
    /* ── A ÁREA DE UM CONTRATO É A PRIVATIVA ──────────────────────────────
       O schema tem cinco medidas (`squareFootage`, terreno, construída,
       privativa, total) e a minuta cita UMA. A privativa é a que a matrícula
       registra e a que a escritura repete; `squareFootage` é o número de
       anúncio, que a imobiliária arredonda para o portal.
       A precedência desce da mais específica para a mais genérica em vez de
       cravar um campo: cadastro antigo só tem `squareFootage`, e recusar a área
       inteira por causa disso deixaria a cláusula do objeto em pendência num
       imóvel perfeitamente cadastrado. */
    "imovel.area": (() => {
      const m = imovel?.areaPrivativa ?? imovel?.areaConstruida ?? imovel?.areaTotal ?? imovel?.squareFootage;
      return m ? `${m} m²` : null;
    })(),
    "imovel.quartos": imovel?.bedrooms != null ? String(imovel.bedrooms) : null,
    "imovel.banheiros": imovel?.banheiros != null ? String(imovel.banheiros) : null,
    "imovel.vagas": imovel?.parkingSpots != null ? String(imovel.parkingSpots) : null,
    "imovel.matricula": texto(imovel?.matricula),
    "imovel.valor": imovel?.price != null ? emReais(imovel.price) : null,

    "negocio.codigo": negocio?.codigo != null ? String(negocio.codigo) : null,
    "negocio.valor": valor != null ? emReais(valor) : null,
    "negocio.valorPorExtenso": extenso,
    "negocio.comissao": negocio?.comissaoTotal != null ? emReais(negocio.comissaoTotal) : null,
    "negocio.corretor": texto(corretor?.nome),
    "negocio.creciCorretor": texto(corretor?.creci),

    "imobiliaria.nome": texto(tenant?.name),
    "imobiliaria.cnpj": texto(tenant?.cnpj),
    "imobiliaria.creci": texto(tenant?.creci),
    "imobiliaria.endereco": texto(
      [tenant?.endereco, tenant?.cidade && tenant?.estado ? `${tenant.cidade}/${tenant.estado}` : tenant?.cidade, tenant?.cep]
        .filter(Boolean)
        .join(" - "),
    ),
    "imobiliaria.telefone": texto(tenant?.telefone || tenant?.whatsapp),
    "imobiliaria.email": texto(tenant?.email),

    "data.hoje": `${agora.getDate()} de ${MESES[agora.getMonth()]} de ${agora.getFullYear()}`,
    "data.dia": String(agora.getDate()),
    "data.mes": MESES[agora.getMonth()],
    "data.ano": String(agora.getFullYear()),
    "data.cidadeImobiliaria": texto(tenant?.cidade),
  };
}

/* ── Conferência do MODELO ────────────────────────────────────────────────────
   Roda ao salvar a minuta em branco, e não ao gerar o contrato. Quem escreveu
   `{{comprador.cpj}}` é quem tem como consertar, e é agora que ele está olhando
   para o texto. */
export function conferirModelo(corpo) {
  const encontrados = [...String(corpo || "").matchAll(new RegExp(MARCADOR, "g"))].map((m) => m[1]);
  const desconhecidos = [...new Set(encontrados.filter((c) => !CHAVES_VALIDAS.has(c)))];
  return { usados: [...new Set(encontrados)], desconhecidos };
}

/* ── A geração ────────────────────────────────────────────────────────────────

   Devolve `{ texto, pendencias, usados }`. `pendencias` traz `{ chave, rotulo,
   onde }` — o bastante para a tela dizer "falta o CPF do comprador, preenche em
   Clientes" com um link, em vez de "dados incompletos".

   Com `permitirIncompleto`, a lacuna vira `[ ... ]` em vez de sumir. É o
   marcador clássico de minuta em papel: quem lê o rascunho entende na hora que
   ali falta alguma coisa, e ninguém confunde com texto pronto. */
export function gerarContrato({ corpo, negocio, tenant, agora, permitirIncompleto = false }) {
  const dicionario = montarDicionario({ negocio, tenant, agora });
  const pendencias = [];
  const usados = [];

  const texto = String(corpo || "").replace(new RegExp(MARCADOR, "g"), (bruto, chave) => {
    usados.push(chave);

    if (!CHAVES_VALIDAS.has(chave)) {
      /* Marcador desconhecido chegou aqui: o modelo foi salvo antes desta
         conferência existir, ou por fora da tela. Vira pendência em vez de
         ficar impresso — o contrato é o pior lugar para descobrir isso. */
      pendencias.push({ chave, rotulo: `Marcador desconhecido: ${chave}`, onde: "Modelos de Minuta" });
      return permitirIncompleto ? "[ ... ]" : bruto;
    }

    const valor = dicionario[chave];
    if (valor == null) {
      pendencias.push({ chave, rotulo: ROTULO[chave] || chave, onde: ONDE[chave] || null });
      return permitirIncompleto ? "[ ... ]" : bruto;
    }
    return valor;
  });

  /* Uma pendência por CAMPO, e não por ocorrência. O CPF do comprador aparece
     quatro vezes numa minuta de compra e venda, e listá-lo quatro vezes faria a
     tela parecer ter quatro problemas quando há um. */
  const unicas = [];
  const vistas = new Set();
  for (const p of pendencias) {
    if (vistas.has(p.chave)) continue;
    vistas.add(p.chave);
    unicas.push(p);
  }

  return { texto, pendencias: unicas, usados: [...new Set(usados)] };
}

/* ── A minuta que toda imobiliária recebe ao contratar o Flow ─────────────────

   Um modelo pronto e não uma tela em branco. Escrever um contrato de compra e
   venda do zero, dentro de um campo de texto, na primeira hora de uso do
   módulo, é o tipo de barreira que faz o recurso nunca ser experimentado. Este
   texto é editável e serve, principalmente, para mostrar COMO os marcadores
   funcionam — quem tem minuta própria cola por cima e aproveita a sintaxe.

   ⚠ Não é peça jurídica revisada, e a tela diz isso. É um esqueleto. */
export const MODELO_INICIAL = {
  nome: "Compra e venda (modelo inicial)",
  tipo: "VENDA",
  corpo: `INSTRUMENTO PARTICULAR DE COMPROMISSO DE COMPRA E VENDA

Negócio nº {{negocio.codigo}}

VENDEDOR: {{vendedor.nome}}, {{vendedor.nacionalidade}}, {{vendedor.estadoCivil}}, {{vendedor.profissao}}, portador(a) do RG nº {{vendedor.rg}} e inscrito(a) no CPF sob o nº {{vendedor.cpf}}, residente e domiciliado(a) em {{vendedor.endereco}}.

COMPRADOR: {{comprador.nome}}, {{comprador.nacionalidade}}, {{comprador.estadoCivil}}, {{comprador.profissao}}, portador(a) do RG nº {{comprador.rg}} e inscrito(a) no CPF sob o nº {{comprador.cpf}}, residente e domiciliado(a) em {{comprador.endereco}}.

INTERVENIENTE: {{imobiliaria.nome}}, inscrita no CNPJ sob o nº {{imobiliaria.cnpj}}, CRECI {{imobiliaria.creci}}, com sede em {{imobiliaria.endereco}}.

CLÁUSULA 1ª — DO OBJETO
O VENDEDOR promete vender ao COMPRADOR o imóvel situado em {{imovel.endereco}}, bairro {{imovel.bairro}}, {{imovel.cidade}}/{{imovel.estado}}, CEP {{imovel.cep}}, com área de {{imovel.area}}, registrado sob a matrícula nº {{imovel.matricula}}.

CLÁUSULA 2ª — DO PREÇO
O preço certo e ajustado é de {{negocio.valor}} ({{negocio.valorPorExtenso}}), a ser pago na forma acordada entre as partes.

CLÁUSULA 3ª — DA INTERMEDIAÇÃO
A intermediação foi realizada por {{imobiliaria.nome}}, por meio do corretor {{negocio.corretor}}, CRECI {{negocio.creciCorretor}}, sendo devida a comissão de {{negocio.comissao}}.

CLÁUSULA 4ª — DO FORO
Fica eleito o foro da comarca de {{imovel.cidade}}/{{imovel.estado}} para dirimir quaisquer controvérsias oriundas do presente instrumento.

E por estarem justas e contratadas, as partes assinam o presente instrumento.

{{data.cidadeImobiliaria}}, {{data.hoje}}.


_______________________________        _______________________________
{{vendedor.nome}}                      {{comprador.nome}}
VENDEDOR                               COMPRADOR


_______________________________
{{imobiliaria.nome}}
INTERVENIENTE`,
};
