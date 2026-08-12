import bcrypt from "bcryptjs";
import { prisma } from "../db.js";
import { senhaTemporaria } from "./provisioningService.js";

/* ────────────────────────────────────────────────────────────────────────────
   Importação de dados vindos de outra plataforma.

   ─── ONDE CADA COISA ACONTECE ───────────────────────────────────────────────
   A planilha NÃO passa por aqui. O navegador lê o arquivo, mostra as colunas,
   deixa a pessoa parear com os nossos campos e manda para cá linhas já
   convertidas em JSON. Três motivos:

     · o arquivo já está na máquina dela — mandá-lo para o servidor só para ser
       lido de volta gasta banda e memória à toa;
     · o mapeamento é conversa de ida e volta ("esta coluna é o título?"), e
       fazer isso com o arquivo no servidor exigiria guardá-lo entre requisições;
     · planilha de imobiliária chega com 5 mil linhas e 40 colunas. Processar
       isso no Render, com o tempo de requisição que ele tem, seria pedir para
       estourar.

   As FOTOS também não passam: o Cloudinary aceita URL remota e busca a imagem
   sozinho, então o navegador manda a URL para lá e nos entrega o link final.

   ─── POR QUE IMPORTAR É "ATUALIZAR OU CRIAR" ────────────────────────────────
   Reimportar é a norma. A primeira tentativa quase sempre tem uma coluna
   pareada errado, e a pessoa corrige e roda de novo. Sem chave estável isso
   duplicaria tudo; com `origemExterna` (o ID do sistema antigo), a segunda
   rodada corrige a primeira em vez de somar lixo.

   Quando a linha não traz identificador, caímos numa chave natural — CPF do
   cliente, login do usuário. Sem nenhuma das duas, aí sim cria sempre, e a
   prévia avisa que reimportar vai duplicar.
   ──────────────────────────────────────────────────────────────────────────── */

/** Teto por requisição. Acima disso o navegador divide em várias chamadas. */
export const LOTE_MAXIMO = 200;

const texto = (v) => (v == null ? "" : String(v).trim());

/* Números em planilha brasileira chegam de todo jeito: "R$ 350.000,00",
   "350000", "350.000", "350,00". Normalizamos para o que o Decimal aceita.

   A regra do separador: se há vírgula, ela é o decimal e o ponto é milhar
   (formato brasileiro). Se não há vírgula, o ponto pode ser qualquer um dos
   dois — e aí só tratamos como decimal quando sobram exatamente duas casas,
   que é a convenção de moeda. "350.000" vira 350000, não 350. */
export function numero(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const cru = texto(v).replace(/[^\d,.-]/g, "");
  if (!cru) return null;

  let normal;
  if (cru.includes(",")) {
    normal = cru.replace(/\./g, "").replace(",", ".");
  } else {
    const partes = cru.split(".");
    normal = partes.length > 1 && partes[partes.length - 1].length === 2 ? cru : cru.replace(/\./g, "");
  }
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

/** Inteiro não negativo, para quartos, vagas e afins. */
export function inteiro(v) {
  const n = numero(v);
  return n == null ? null : Math.max(0, Math.round(n));
}

/* Só entra no gravado o que a planilha REALMENTE trouxe.
 *
 * A tela manda apenas os campos que a pessoa pareou, então a ausência de uma
 * chave aqui quer dizer "esta coluna não existe na planilha" — e não "esta
 * coluna está vazia". A diferença importa numa reimportação: sem ela, quem
 * importou 500 imóveis, escreveu as descrições no painel e reimportou para
 * consertar uma coluna pareada errado perderia todas as descrições, porque a
 * planilha não tinha essa coluna para devolver.
 *
 * O que a pessoa pareou continua mandando: se ela mapeou a coluna e a célula
 * está vazia, o campo é apagado mesmo — aí é a planilha dizendo que é vazio. */
function apenasMapeados(bruta, conversores) {
  const saida = {};
  for (const [chave, converter] of Object.entries(conversores)) {
    if (chave in bruta) saida[chave] = converter(bruta[chave]);
  }
  return saida;
}

/* ─── Clientes ─────────────────────────────────────────────────────────────── */

export async function importarClientes(tenantId, linhas = []) {
  const resultado = { criados: 0, atualizados: 0, erros: [] };

  for (const [i, bruta] of linhas.entries()) {
    const nome = texto(bruta.nome);
    if (!nome) {
      resultado.erros.push({ linha: bruta.__linha ?? i + 1, motivo: "Nome vazio." });
      continue;
    }

    const dados = {
      nome,
      ...apenasMapeados(bruta, {
        email: (v) => texto(v) || null,
        telefone: (v) => texto(v) || null,
        whatsapp: (v) => texto(v) || null,
        cpf: (v) => texto(v) || null,
        observacoes: (v) => texto(v) || null,
        origemExterna: (v) => texto(v) || null,
      }),
    };

    try {
      /* Procura por identificador de origem e, na falta dele, por CPF — que é
         a única coisa que identifica pessoa sem ambiguidade numa planilha.
         Nome não serve: "João Silva" repete. */
      const existente = dados.origemExterna
        ? await prisma.cliente.findFirst({ where: { tenantId, origemExterna: dados.origemExterna } })
        : dados.cpf
          ? await prisma.cliente.findFirst({ where: { tenantId, cpf: dados.cpf } })
          : null;

      if (existente) {
        await prisma.cliente.update({ where: { id: existente.id }, data: dados });
        resultado.atualizados += 1;
      } else {
        await prisma.cliente.create({ data: { ...dados, tenantId } });
        resultado.criados += 1;
      }
    } catch (erro) {
      resultado.erros.push({ linha: bruta.__linha ?? i + 1, motivo: erro.message });
    }
  }

  return resultado;
}

/* ─── Imóveis ──────────────────────────────────────────────────────────────── */

/* O tipo vem como texto livre da planilha ("Apartamento", "APTO", "apto").
   Casamos com os tipos já cadastrados pela imobiliária, sem criar novos: tipo
   de imóvel governa filtro e atributo na vitrine, e deixar a planilha inventar
   encheria o cadastro de "Apto", "APTO" e "Apartamento " como coisas
   diferentes. O que não casar entra sem tipo, e a prévia avisa. */
function casarTipo(valor, tipos) {
  const alvo = texto(valor).toLowerCase();
  if (!alvo) return null;
  const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return tipos.find((t) => norm(t.descricao) === norm(alvo))?.id || null;
}

export async function importarImoveis(tenantId, linhas = []) {
  const resultado = { criados: 0, atualizados: 0, fotos: 0, erros: [] };
  // Só o catálogo DESTA imobiliária: casar o nome vindo da planilha contra a
  // tabela inteira pendurava o imóvel importado num tipo de outra empresa.
  const tipos = await prisma.tipoImovel.findMany({
    where: { tenantId },
    select: { id: true, descricao: true },
  });

  for (const [i, bruta] of linhas.entries()) {
    const nLinha = bruta.__linha ?? i + 1;
    const title = texto(bruta.title);
    const price = numero(bruta.price);

    if (!title) {
      resultado.erros.push({ linha: nLinha, motivo: "Título vazio." });
      continue;
    }
    if (price == null) {
      resultado.erros.push({ linha: nLinha, motivo: "Preço ausente ou ilegível." });
      continue;
    }

    const dados = {
      title,
      price,
      ...apenasMapeados(bruta, {
        description: (v) => texto(v),
        address: (v) => texto(v),
        neighborhood: (v) => texto(v),
        city: (v) => texto(v),
        state: (v) => texto(v),
        bedrooms: (v) => inteiro(v) ?? 0,
        origemExterna: (v) => texto(v) || null,
      }),
    };
    if ("tipoImovel" in bruta) dados.tipoImovelId = casarTipo(bruta.tipoImovel, tipos);

    try {
      const existente = dados.origemExterna
        ? await prisma.property.findFirst({ where: { tenantId, origemExterna: dados.origemExterna } })
        : null;

      const imovel = existente
        /* O `status` fica de fora do update de propósito: quem já revisou e
           publicou um imóvel importado não pode vê-lo sumir da vitrine porque
           reimportou a planilha para consertar outra coluna. */
        ? await prisma.property.update({ where: { id: existente.id }, data: dados })
        : await prisma.property.create({
            data: {
              /* Descrição e endereço são obrigatórios no schema mas costumam
                 faltar na planilha. Em vez de recusar a linha, entram vazios —
                 imóvel sem descrição se corrige depois; imóvel que não entrou
                 dá trabalho de achar. Os demais campos do modelo já têm padrão.
                 Note que vêm ANTES do spread: se a planilha trouxe a coluna, é
                 o valor dela que vale. */
              description: "",
              address: "",
              ...dados,
              tenantId,
              /* Entra como rascunho, sempre. Publicar direto na vitrine centenas
                 de imóveis vindos de planilha — sem foto conferida, sem descrição
                 revisada — exporia o cliente antes de ele ter olhado o que
                 importou. Ele publica quando quiser, pela tela de imóveis. */
              status: "DRAFT",
            },
          });

      if (existente) resultado.atualizados += 1;
      else resultado.criados += 1;

      /* Fotos: o navegador já subiu para o Cloudinary e manda os links prontos.
         Numa reimportação as antigas saem antes, senão cada rodada empilharia
         as mesmas fotos de novo. */
      const fotos = (Array.isArray(bruta.fotos) ? bruta.fotos : []).filter(Boolean);
      if (fotos.length) {
        if (existente) await prisma.propertyImage.deleteMany({ where: { propertyId: imovel.id } });
        /* `tenantId` vai explícito: PropertyImage guarda o dono por cópia, e não
           só pela relação com o imóvel — é o que faz o índice por tenant valer.
           Sem ele o Prisma recusa a criação inteira. */
        await prisma.propertyImage.createMany({
          data: fotos.map((url, pos) => ({
            tenantId,
            propertyId: imovel.id,
            url: String(url),
            position: pos,
          })),
        });
        resultado.fotos += fotos.length;
      }
    } catch (erro) {
      resultado.erros.push({ linha: nLinha, motivo: erro.message });
    }
  }

  return resultado;
}

/* ─── Usuários ─────────────────────────────────────────────────────────────── */

/* Login é único GLOBAL no schema, não por tenant. Importar um "joao" de duas
   imobiliárias colidiria, e a segunda receberia um erro que não é culpa dela.
   Por isso o login importado ganha o sufixo do slug — mesmo formato que o
   provisionamento já usa em `admin-<slug>`. */
function loginDoTenant(bruto, slug) {
  const base = texto(bruto).toLowerCase().replace(/[^a-z0-9._-]/g, "");
  return `${base || "usuario"}-${slug}`.slice(0, 60);
}

export async function importarUsuarios(tenantId, linhas = [], { slug, cargoPadraoId }) {
  const resultado = { criados: 0, atualizados: 0, senhas: [], erros: [] };

  // Só os cargos DESTA imobiliária: casar o nome vindo da planilha contra a
  // tabela inteira pendurava o usuário importado num cargo de outra empresa.
  const cargos = await prisma.cargo.findMany({
    where: { tenantId },
    select: { id: true, descricao: true },
  });
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  for (const [i, bruta] of linhas.entries()) {
    const nLinha = bruta.__linha ?? i + 1;
    const nome = texto(bruta.nome);
    if (!nome) {
      resultado.erros.push({ linha: nLinha, motivo: "Nome vazio." });
      continue;
    }

    const login = loginDoTenant(bruta.login || bruta.email || nome, slug);
    const cargoId = cargos.find((c) => norm(c.descricao) === norm(bruta.cargo))?.id || cargoPadraoId;
    const origemExterna = texto(bruta.origemExterna) || null;

    try {
      const existente = origemExterna
        ? await prisma.usuario.findFirst({ where: { tenantId, origemExterna } })
        : await prisma.usuario.findFirst({ where: { tenantId, login } });

      if (existente) {
        /* Senha nunca é tocada em atualização: quem já entrou tem a dele.
           O cargo só muda se a planilha trouxer a coluna — senão, quem foi
           promovido aqui dentro voltaria ao cargo padrão numa reimportação. */
        await prisma.usuario.update({
          where: { id: existente.id },
          data: {
            nome,
            origemExterna,
            ...("cargo" in bruta && cargoId ? { cargoCodigo: cargoId } : {}),
          },
        });
        resultado.atualizados += 1;
        continue;
      }

      // Para criar, porém, o cargo é obrigatório — não existe usuário sem ele.
      if (!cargoId) {
        resultado.erros.push({ linha: nLinha, motivo: "Cargo não encontrado e nenhum padrão definido." });
        continue;
      }

      /* Senha não se importa — o sistema antigo guarda hash, e hash de outro
         sistema não serve aqui. Cada usuário nasce com uma senha provisória
         que a imobiliária repassa, e é obrigado a trocar no primeiro acesso.
         As senhas voltam na resposta porque é a ÚNICA vez em que existem em
         texto; depois disto o banco só tem o hash. */
      const senha = senhaTemporaria();
      await prisma.usuario.create({
        data: {
          tenantId,
          nome,
          login,
          senha: await bcrypt.hash(senha, 10),
          cargoCodigo: cargoId,
          forcaAlterarSenha: true,
          ativo: true,
          origemExterna,
        },
      });
      resultado.criados += 1;
      resultado.senhas.push({ nome, login, senha });
    } catch (erro) {
      resultado.erros.push({ linha: nLinha, motivo: erro.message });
    }
  }

  return resultado;
}
