/* ────────────────────────────────────────────────────────────────────────────
   Google Identity Services — o carregador.

   ── POR QUE O SCRIPT VEM DO GOOGLE, E NÃO DE UM PACOTE ──

   Mesma razão do Stripe.js: o arquivo precisa ser buscado no domínio deles a
   cada carga, para que correções cheguem na hora. Empacotar uma cópia
   congelaria a biblioteca de autenticação numa versão — e é a última coisa que
   se quer congelar.

   ── POR QUE O ID TOKEN, E NÃO O FLUXO DE CÓDIGO ──

   O GIS devolve um JWT assinado direto ao navegador. O servidor confere a
   assinatura contra as chaves públicas do Google e pronto — sem `client_secret`
   guardado, sem rota de callback, sem estado no meio. O fluxo de código
   existiria para acessar APIs do Google em nome da pessoa; nós só precisamos
   saber QUEM ela é.

   ── SÓ CARREGA QUANDO ALGUÉM PRECISA ──

   O script tem peso e faz requisições próprias. Quem nunca clica em "entrar com
   Google" não deve pagar por ele, então a carga é sob demanda e o resultado
   fica memorizado.
   ──────────────────────────────────────────────────────────────────────────── */

const SRC = "https://accounts.google.com/gsi/client";
let promessa = null;

export function carregarGoogle() {
  if (promessa) return promessa;

  promessa = new Promise((resolver, rejeitar) => {
    if (window.google?.accounts?.id) {
      resolver(window.google.accounts.id);
      return;
    }
    const existente = document.querySelector(`script[src="${SRC}"]`);
    const script = existente || document.createElement("script");
    script.addEventListener("load", () => {
      if (window.google?.accounts?.id) resolver(window.google.accounts.id);
      else rejeitar(new Error("O script do Google carregou sem expor a API."));
    });
    script.addEventListener("error", () => rejeitar(new Error("Falha ao carregar o Google.")));
    if (!existente) {
      script.src = SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });

  /* Falha de carga não pode virar promessa rejeitada eterna: sem isto, uma
     oscilação de rede na primeira tentativa deixaria o botão morto até a página
     ser recarregada. */
  promessa.catch(() => { promessa = null; });
  return promessa;
}

/* ── POR QUE O BOTÃO RENDERIZADO, E NÃO O One Tap ────────────────────────────

   A primeira versão chamava `google.accounts.id.prompt()` — o One Tap. Ele
   falhou em toda tentativa, e o console explicou por quê:

     · os métodos de status do prompt estão sendo descontinuados pelo FedCM;
     · o navegador pode ter o FedCM desativado, por escolha do usuário ou por
       uma recusa anterior — e aí `prompt()` não abre nada;
     · o endpoint de status devolveu 403.

   O One Tap foi feito para APARECER SOZINHO em quem já está logado no Google,
   e o navegador tem todo o direito de suprimi-lo. Para uma ação explícita —
   alguém clicou em "entrar com Google" — o caminho suportado é o botão que o
   próprio Google desenha e controla.

   O preço é a interface: o visual do botão é deles, não nosso. Vale: um botão
   nosso que não funciona é pior que um deles que funciona, e a marca do Google
   num botão de login do Google não destoa de nada.
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Desenha o botão oficial dentro de `elemento` e chama `aoReceber` com o token.
 *
 * @returns {Promise<void>} resolve quando o botão está desenhado.
 */
export async function renderizarBotaoGoogle(elemento, { clientId, aoReceber, aoFalhar, largura }) {
  const gid = await carregarGoogle();
  gid.initialize({
    client_id: clientId,
    callback: (resposta) => {
      if (resposta?.credential) aoReceber(resposta.credential);
      else aoFalhar?.(new Error("O Google não devolveu a credencial."));
    },
    /* Sem seleção automática: entrar numa conta sem escolher é desconcertante,
       e pior num produto onde a conta decide de QUAL imobiliária é o painel. */
    auto_select: false,
    /* FedCM ligado porque ele é o caminho que o navegador ainda permite; o
       botão renderizado funciona com ou sem, mas pedir explicitamente evita o
       aviso de descontinuação no console. */
    use_fedcm_for_prompt: true,
  });

  gid.renderButton(elemento, {
    type: "standard",
    theme: "filled_black",
    size: "large",
    text: "continue_with",
    shape: "pill",
    logo_alignment: "left",
    locale: "pt-BR",
    ...(largura ? { width: largura } : {}),
  });
}
