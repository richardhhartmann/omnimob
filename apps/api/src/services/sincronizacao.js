import { prisma } from "../db.js";
import { buscarFonte, ErroDeFonte } from "./fonteRemota.js";
import { lerFonte, ErroDeFormato } from "./formatosImportacao.js";
import { copiarFotosDasLinhas, copiaDeFotosConfigurada } from "./copiaDeFotos.js";
import {
  importarClientes,
  importarImoveis,
  importarUsuarios,
  LOTE_MAXIMO,
} from "./importacaoService.js";
import { preencherContexto } from "./auditoria.js";

/* ────────────────────────────────────────────────────────────────────────────
   Reler uma fonte guardada.

   A primeira versão da importação por feed era um EVENTO: colar a URL,
   conferir, importar, acabou. Mas o valor de um feed é justamente continuar
   valendo amanhã — o sistema antigo publica o acervo atualizado no mesmo
   endereço, e quem migrou na segunda quer o imóvel novo de quinta sem repetir o
   ritual inteiro.

   Guardar o endereço transforma "importei" em "está integrado".

   ── A POLÍTICA DE AUSÊNCIA ──

   O problema difícil não é trazer o que apareceu; é o que SUMIU. Um imóvel
   vendido some do feed do outro lado, e aqui ele ficaria anunciado para sempre.

   Só que "sumiu do feed" e "o feed quebrou e voltou vazio" são indistinguíveis
   de fora. Por isso três travas, e nenhuma é excesso de zelo:

     1. É OPT-IN por fonte. Quem conhece a origem decide.
     2. NUNCA apaga — desativa. O histórico de leads e vendas fica.
     3. Uma leitura que volta VAZIA não desativa nada. Um feed sem nenhum
        registro é quase sempre um erro do outro lado, e obedecer a ele
        derrubaria o acervo inteiro de uma vez.

   ── AUDITORIA ──

   O agendador roda sem requisição HTTP, então não há contexto de trilha. Este
   serviço abre um, com o nome da fonte — senão a sincronização automática
   mexeria no acervo sem deixar rastro, que é exatamente o caso em que ninguém
   consegue explicar o que aconteceu de madrugada.
   ──────────────────────────────────────────────────────────────────────────── */

/** Um relatório vazio, para somar os lotes em cima. */
function relatorioVazio() {
  return { criados: 0, atualizados: 0, fotos: 0, senhas: [], erros: [] };
}

function somar(junto, parcial) {
  junto.criados += parcial.criados || 0;
  junto.atualizados += parcial.atualizados || 0;
  junto.fotos += parcial.fotos || 0;
  if (parcial.senhas) junto.senhas.push(...parcial.senhas);
  if (parcial.erros) junto.erros.push(...parcial.erros);
  return junto;
}

async function gravarLotes(tenantId, entidade, linhas, slug) {
  const junto = relatorioVazio();
  for (let i = 0; i < linhas.length; i += LOTE_MAXIMO) {
    const lote = linhas.slice(i, i + LOTE_MAXIMO);
    if (entidade === "imoveis") {
      somar(junto, await importarImoveis(tenantId, lote));
    } else if (entidade === "clientes") {
      somar(junto, await importarClientes(tenantId, lote));
    } else {
      const cargoPadrao = await prisma.cargo.findFirst({
        where: { tenantId, descricao: "Corretor" },
        select: { id: true },
      });
      somar(junto, await importarUsuarios(tenantId, lote, { slug, cargoPadraoId: cargoPadrao?.id || null }));
    }
  }
  return junto;
}

/* Desativa o que a fonte deixou de listar.

   Age SÓ sobre imóveis que carregam `origemExterna` — os que nasceram daquela
   fonte. Um imóvel cadastrado à mão no painel não tem código de origem e nunca
   é tocado: ele não veio do feed, e o feed não manda nele. Sem esse recorte, a
   primeira sincronização de um acervo importado derrubaria tudo que a
   imobiliária tinha cadastrado por conta própria. */
async function desativarAusentes(tenantId, linhas) {
  const presentes = linhas.map((l) => String(l.origemExterna || "").trim()).filter(Boolean);
  // Leitura vazia não desativa nada — ver a trava 3 no cabeçalho.
  if (!presentes.length) return { desativados: 0, ignoradoPorFeedVazio: true };

  const { count } = await prisma.property.updateMany({
    where: {
      tenantId,
      status: { not: "INACTIVE" },
      origemExterna: { not: null, notIn: presentes },
    },
    data: { status: "INACTIVE" },
  });
  return { desativados: count, ignoradoPorFeedVazio: false };
}

/**
 * Lê a fonte e grava. Devolve o relatório — e também o guarda na própria fonte.
 *
 * @param {object} fonte  registro de `FonteImportacao`
 * @param {object} tenant { id, slug }
 */
export async function sincronizar(fonte, tenant) {
  const inicio = Date.now();
  let relatorio;

  try {
    const { corpo, tipoConteudo } = await buscarFonte(fonte.url);
    const { formato, linhas } = lerFonte(corpo, fonte.entidade, tipoConteudo);

    /* As fotos vêm para a nossa conta ANTES de qualquer gravação: sem isso o
       banco guardaria os endereços do sistema antigo, e a vitrine ficaria sem
       imagem no dia em que a imobiliária cancelasse aquele contrato. */
    let copia = { copiadas: 0, falhas: [], pulou: true };
    if (fonte.entidade === "imoveis") copia = await copiarFotosDasLinhas(linhas);

    const junto = await gravarLotes(tenant.id, fonte.entidade, linhas, tenant.slug);

    let ausentes = { desativados: 0, ignoradoPorFeedVazio: false };
    if (fonte.desativarAusentes && fonte.entidade === "imoveis") {
      ausentes = await desativarAusentes(tenant.id, linhas);
    }

    relatorio = {
      ok: true,
      em: new Date().toISOString(),
      duracaoMs: Date.now() - inicio,
      formato,
      total: linhas.length,
      criados: junto.criados,
      atualizados: junto.atualizados,
      fotos: junto.fotos,
      erros: junto.erros.slice(0, 20),
      totalErros: junto.erros.length,
      desativados: ausentes.desativados,
      feedVazio: ausentes.ignoradoPorFeedVazio,
      copiaDeFotos: {
        copiadas: copia.copiadas,
        falhas: copia.falhas.length,
        indisponivel: fonte.entidade === "imoveis" && !copiaDeFotosConfigurada,
      },
    };
  } catch (erro) {
    /* Falha da FONTE não é falha nossa, e o relatório precisa dizer qual das
       duas foi: "a URL respondeu 404" manda a pessoa ao lugar certo; "erro
       interno" manda ao suporte. */
    const daFonte = erro instanceof ErroDeFonte || erro instanceof ErroDeFormato;
    if (!daFonte) console.error(`[sincronizacao] fonte ${fonte.id}:`, erro);
    relatorio = {
      ok: false,
      em: new Date().toISOString(),
      duracaoMs: Date.now() - inicio,
      erro: daFonte ? erro.message : "Erro interno ao sincronizar.",
    };
  }

  await prisma.fonteImportacao
    .update({
      where: { id: fonte.id },
      data: { ultimaSync: new Date(), ultimoResultado: relatorio },
    })
    .catch(() => {});

  return relatorio;
}

/**
 * Sincroniza uma fonte a partir do agendador — sem requisição HTTP por trás.
 * Abre o contexto da trilha para o que for gravado ter autor.
 */
export function sincronizarAgendada(fonte, tenant) {
  const req = { ip: null, method: "CRON", originalUrl: `/sincronizacao/${fonte.id}`, path: "" };
  return new Promise((resolve) => {
    preencherContexto(
      req,
      { tenantId: tenant.id, usuarioNome: `Sincronização · ${fonte.nome}` },
      () => { sincronizar(fonte, tenant).then(resolve); },
    );
  });
}

/* ── O agendador ─────────────────────────────────────────────────────────────
   Mesma forma da faxina de trials: opt-in por variável de ambiente, porque com
   mais de uma instância no ar todas rodariam o mesmo trabalho ao mesmo tempo —
   e duas leituras simultâneas da mesma fonte disputariam as mesmas linhas.

   O intervalo é largo de propósito. Feed de imobiliária muda algumas vezes por
   dia; ler de hora em hora já é mais frequente que a realidade, e cada leitura
   custa uma varredura completa do acervo do outro lado. */
const INTERVALO_MS = 60 * 60 * 1000;

export function agendarSincronizacoes() {
  if (process.env.SINCRONIZACAO_AUTOMATICA !== "true") return null;

  async function rodada() {
    try {
      const fontes = await prisma.fonteImportacao.findMany({
        where: { ativa: true },
        include: { tenant: { select: { id: true, slug: true, ativo: true, statusPagamento: true } } },
      });
      for (const fonte of fontes) {
        /* Conta desativada ou cancelada não sincroniza. Mesma razão do feed dos
           portais: dado de quem saiu não continua circulando — e ninguém deve
           pagar processamento por uma conta encerrada. */
        if (!fonte.tenant?.ativo || fonte.tenant.statusPagamento === "CANCELADO") continue;
        // Em série: cada uma varre um acervo inteiro, e em paralelo elas
        // disputariam as conexões do banco com o tráfego real do painel.
        await sincronizarAgendada(fonte, fonte.tenant);
      }
    } catch (erro) {
      console.error("[sincronizacao] rodada falhou:", erro.message);
    }
  }

  console.log("[sincronizacao] agendador ligado (a cada 60 min)");
  const timer = setInterval(rodada, INTERVALO_MS);
  // `unref` para o temporizador não segurar o processo no encerramento.
  timer.unref?.();
  return timer;
}
