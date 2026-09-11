import { createContext, useContext } from "react";

/* ────────────────────────────────────────────────────────────────────────────
   O QUE NÃO É DOCUMENTO.

   O Puck guarda um documento: as peças, a ordem, o que a pessoa escreveu. Mas
   os blocos fixos da vitrine precisam de coisas que NÃO pertencem ao documento
   e nunca podem ser gravadas dentro dele:

     · o acervo — trinta imóveis que mudam quando a imobiliária cadastra o
       trigésimo primeiro;
     · a imobiliária — nome, logotipo, telefone, cores;
     · o link do WhatsApp, que é derivado do telefone.

   Congelar qualquer um desses no documento seria o defeito clássico desta
   migração: a página publicada continuaria mostrando o acervo do dia em que
   alguém abriu o editor. É a mesma armadilha que o `resolveData` da Equipe tem
   — lá ela ainda está em aberto; aqui ela está fechada de propósito.

   Então isto desce por CONTEXTO, e o documento não sabe que existe. Vale para
   as duas telas: o editor põe os dados de quem está editando, a vitrine pública
   põe os de quem está sendo visitada, e os blocos não notam a diferença.

   É irmão do `showcase/contexto.jsx`, e os dois têm papéis distintos de
   propósito: aquele diz COMO desenhar (público × editor, texto editável,
   filtro); este diz COM O QUÊ. Fundi-los faria o construtor voltar a saber
   coisas sobre a vitrine pública.
   ──────────────────────────────────────────────────────────────────────────── */

const VAZIO = {
  tenant: null,
  tenantSlug: "",
  properties: [],
  whatsappHref: "",
  carregando: false,
  erro: "",
};

const Contexto = createContext(VAZIO);

export function ProvedorDaPagina({ valor, children }) {
  return <Contexto.Provider value={valor || VAZIO}>{children}</Contexto.Provider>;
}

/* Cai no vazio em vez de lançar. Um bloco arrastado para a biblioteca de
   componentes do Puck, fora de qualquer página, precisa desenhar alguma coisa —
   e "nenhum imóvel disponível" é uma resposta melhor que uma tela branca com um
   erro de contexto ausente no console. */
export function usarPagina() {
  return useContext(Contexto);
}
