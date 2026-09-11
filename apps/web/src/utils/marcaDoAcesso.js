import { useEffect, useState } from "react";
import { api } from "../api";
import { slugDoDominioAtual } from "./dominioVitrine";

/* ────────────────────────────────────────────────────────────────────────────
   De quem é a casa em que esta tela de acesso está.

   Quando dá para saber a imobiliária ANTES do login, a tela de entrada veste a
   marca dela em vez da nossa. Não é enfeite: quem digita a senha precisa
   reconhecer onde está, e o corretor que recebeu o endereço do gerente não tem
   por que aterrissar numa página de uma empresa da qual nunca ouviu falar.

   ── DE ONDE SAI O SLUG ──

   Duas fontes, nesta ordem:

     1. `?tenant=` no endereço — explícito, e vale mesmo em `omnimob.app`.
        É o link que a imobiliária manda para a equipe dela.
     2. O HOST, por `slugDoDominioAtual()`: subdomínio nosso resolve na hora
        (o slug é o rótulo), domínio próprio pergunta ao servidor.

   Hoje a segunda fonte não se realiza, e isso não é descuido: em host de
   imobiliária as rotas do produto não existem — ver o comentário do `App.jsx`,
   onde qualquer caminho desconhecido volta para a vitrine. A fonte fica aqui
   porque é ela que este arquivo passa a resolver de graça no dia em que essa
   decisão mudar; tirá-la faria a mudança ser em dois arquivos em vez de um.

   ── O QUE ELA NÃO TRAZ ──

   Cor. A tela de acesso é escura e fixa, e pintá-la com um valor escolhido pelo
   cliente produz, mais cedo ou mais tarde, texto ilegível — a vitrine tem
   máquina de tema para isso, o login não. Ver o comentário da rota
   `GET /public/:slug/marca`.
   ──────────────────────────────────────────────────────────────────────────── */

async function slugDoAcesso() {
  try {
    const daUrl = new URLSearchParams(window.location.search).get("tenant");
    if (daUrl) return daUrl.trim();
    return await slugDoDominioAtual();
  } catch {
    return null;
  }
}

/**
 * @returns {{ nome: string, slug: string, logoUrl: string|null } | null}
 *   `null` enquanto resolve e sempre que não houver imobiliária — nos dois
 *   casos a tela mostra a marca da Omnimob, que é a verdade ali.
 */
export function useMarcaDoAcesso(ligado = true) {
  const [marca, setMarca] = useState(null);

  useEffect(() => {
    if (!ligado) return undefined;
    let vivo = true;

    (async () => {
      const slug = await slugDoAcesso();
      if (!vivo || !slug) return;
      try {
        const m = await api.marcaDoTenant(slug);
        /* Sem nome não há marca nenhuma para vestir. Falha de rede, slug
           inexistente e imobiliária desativada caem todos aqui, e o desfecho é
           o mesmo: a tela segue sendo a da Omnimob, sem erro na cara de quem
           só quer entrar. */
        if (vivo && m?.nome) setMarca(m);
      } catch { /* segue com a marca da Omnimob */ }
    })();

    return () => { vivo = false; };
  }, [ligado]);

  return marca;
}
