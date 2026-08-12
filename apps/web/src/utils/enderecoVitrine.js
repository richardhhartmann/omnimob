/* ────────────────────────────────────────────────────────────────────────────
   Onde a vitrine desta imobiliária vive, na internet.

   Existe um lugar só para responder isso porque a resposta mudou: antes era
   sempre `omnimob.app/vitrine/<slug>`, e agora pode ser o domínio da própria
   imobiliária. Cada tela que montava a URL na mão ("Ver página", copiar link,
   o link que vai no post de divulgação, o e-mail) precisaria aprender a nova
   regra — e a que esquecesse mandaria o cliente para o endereço errado sem
   ninguém perceber, porque os dois funcionam.

   O domínio próprio só vale quando está ATIVO. Em PENDENTE o DNS ainda não
   aponta para cá: divulgar esse endereço levaria a lugar nenhum, ou pior, ao
   site antigo que ainda estiver no ar.
   ──────────────────────────────────────────────────────────────────────────── */

import { loadSession } from "../session";

/* Sem argumento, lê a sessão guardada.

   Metade dos lugares que montam este link não recebe a sessão por prop — o
   modal de divulgação e o formulário de imóvel só conhecem o `tenantSlug`. Ou
   se passava a sessão de mão em mão por quatro níveis, ou a função busca onde
   ela já está. A segunda opção também garante que nenhuma tela nova esqueça. */
function tenantAtual(tenant) {
  return tenant || loadSession()?.tenant || null;
}

/* Domínio em que os subdomínios de vitrine vivem, e a chave que liga o
   recurso. Enquanto `VITE_VITRINE_SUBDOMINIO` não for "true", o endereço
   padrão continua sendo o caminho — `omnimob.app/vitrine/<slug>`.

   O interruptor existe porque a parte de infraestrutura não é reversível num
   clique: o subdomínio exige registro DNS curinga (`*.omnimob.app`) e o domínio
   curinga cadastrado na Vercel, que por sua vez exige que o domínio use os
   nameservers dela. Ligar o código antes disso passaria a divulgar endereços
   que não resolvem — pior que o caminho feio. */
const SUBDOMINIO_LIGADO = import.meta.env?.VITE_VITRINE_SUBDOMINIO === "true";
const DOMINIO_RAIZ = import.meta.env?.VITE_DOMINIO_RAIZ || "omnimob.app";

/** Base pública da vitrine, sem barra no fim. */
export function baseDaVitrine(tenant) {
  const t = tenantAtual(tenant);
  if (!t?.slug) return "";
  if (t.dominioProprio && t.dominioStatus === "ATIVO") {
    return `https://${t.dominioProprio}`;
  }
  if (SUBDOMINIO_LIGADO) return `https://${t.slug}.${DOMINIO_RAIZ}`;

  const origem = typeof window !== "undefined" ? window.location.origin : `https://${DOMINIO_RAIZ}`;
  return `${origem}/vitrine/${t.slug}`;
}

/**
 * O mesmo endereço, sem protocolo — para MOSTRAR na tela.
 *
 * Existe separado do `baseDaVitrine` porque endereço exibido e endereço clicado
 * são coisas diferentes: um `https://` no meio de uma frase polui, mas um link
 * sem protocolo não abre. Ter as duas formas saindo da mesma fonte é o que
 * impede a tela de anunciar um endereço e o botão levar a outro.
 *
 * Aceita só o slug, para as telas que ainda estão montando o tenant (o cadastro
 * do super-admin mostra o endereço se formando enquanto se digita o nome).
 */
export function enderecoVisivel(slugOuTenant) {
  const t = typeof slugOuTenant === "string" ? { slug: slugOuTenant } : tenantAtual(slugOuTenant);
  if (!t?.slug) return "";
  if (t.dominioProprio && t.dominioStatus === "ATIVO") return t.dominioProprio;
  if (SUBDOMINIO_LIGADO) return `${t.slug}.${DOMINIO_RAIZ}`;
  return `${DOMINIO_RAIZ}/vitrine/${t.slug}`;
}

/** Endereço de um imóvel dentro da vitrine. */
export function linkDoImovel(propertyId, tenant) {
  const base = baseDaVitrine(tenant);
  return base ? `${base}/imovel/${propertyId}` : "";
}

/** True quando a vitrine já vive no domínio da imobiliária. */
export function usaDominioProprio(tenant) {
  const t = tenantAtual(tenant);
  return Boolean(t?.dominioProprio && t.dominioStatus === "ATIVO");
}
