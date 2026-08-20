import dns from "node:dns/promises";
import net from "node:net";

/* ────────────────────────────────────────────────────────────────────────────
   Buscar o feed que a imobiliária apontou.

   ── ISTO É UM PEDIDO PARA O SERVIDOR ABRIR UMA URL ARBITRÁRIA ──

   E é exatamente a forma do SSRF. Sem trava, qualquer cliente do painel poderia
   colar `http://169.254.169.254/latest/meta-data/` e receber, pela tela de
   importação, as credenciais da instância; ou varrer `http://10.0.0.x` e nos
   usar como scanner de porta dentro da rede do provedor. O servidor tem acesso
   a coisas que o navegador de quem pediu não tem, e é essa diferença que o
   ataque explora.

   Quatro travas, e nenhuma delas é opcional:

     1. Só http e https. `file://` leria o disco; `gopher://` e `ftp://` são os
        vetores clássicos de contrabando de protocolo.

     2. O endereço é RESOLVIDO ANTES e o IP conferido. Conferir só o nome não
        adianta: `interno.exemplo.com` pode apontar para 127.0.0.1, e um domínio
        controlado por quem ataca aponta para onde ele quiser.

     3. Redirecionamento não é seguido cegamente. Um destino público pode
        responder 302 para 169.254.169.254 — e a checagem do passo 2 já teria
        passado. Seguimos poucos saltos, revalidando cada um.

     4. Teto de tamanho e de tempo. Um feed de imobiliária grande tem alguns
        megabytes; uma URL que transmite sem parar encheria a memória do
        processo até derrubá-lo.

   ── O QUE NÃO PROTEGEMOS ──

   Não há como impedir que a imobiliária aponte para um feed público de um
   concorrente e importe o acervo dele. Isso não é uma falha técnica nossa: o
   feed é público por construção (é o que os portais leem), e a decisão de
   copiá-lo é de quem cola o endereço.
   ──────────────────────────────────────────────────────────────────────────── */

/** Feed de imobiliária grande tem poucos MB. 20 é folgado e ainda cabe. */
const TETO_BYTES = 20 * 1024 * 1024;
const TEMPO_LIMITE_MS = 20_000;
const SALTOS_MAXIMOS = 3;

export class ErroDeFonte extends Error {}

/* Faixas que nunca são um feed de cliente, e que o servidor alcança por estar
   onde está. As de IPv6 incluem o mapeamento de IPv4 (`::ffff:10.0.0.1`), que é
   a forma mais fácil de escapar de uma checagem escrita só para IPv4. */
function ehEnderecoInterno(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    // 169.254/16 — link-local. É onde vive o serviço de metadados da AWS, do
    // GCP e do Azure, e por isso o alvo mais valioso deste ataque.
    if (a === 169 && b === 254) return true;
    // 100.64/10 — CGNAT, a rede interna de vários provedores de nuvem.
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const baixo = ip.toLowerCase();
    if (baixo === "::1" || baixo === "::") return true;
    // fc00::/7 (único local) e fe80::/10 (link-local).
    if (/^f[cd]/.test(baixo) || /^fe[89ab]/.test(baixo)) return true;
    // IPv4 embrulhado em IPv6 — confere pelas regras de IPv4.
    const embrulhado = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(baixo);
    if (embrulhado) return ehEnderecoInterno(embrulhado[1]);
    return false;
  }
  // Não é IP reconhecível: recusa. O desconhecido não ganha o benefício da
  // dúvida quando o custo do erro é o servidor abrir a rede interna.
  return true;
}

/** Valida o endereço e devolve a URL. Lança `ErroDeFonte` com texto para a tela. */
async function conferirEndereco(bruto) {
  let url;
  try {
    url = new URL(String(bruto || "").trim());
  } catch {
    throw new ErroDeFonte("Endereço inválido. Inclua http:// ou https://.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ErroDeFonte("Só endereços http e https são aceitos.");
  }

  let enderecos;
  try {
    enderecos = await dns.lookup(url.hostname, { all: true });
  } catch {
    throw new ErroDeFonte(`Não consegui resolver o endereço "${url.hostname}". Confira se está correto.`);
  }

  /* TODOS os IPs, não o primeiro. Um nome pode responder com um IP público e um
     interno; validar só um deixaria a conexão cair no outro. */
  if (enderecos.some((e) => ehEnderecoInterno(e.address))) {
    throw new ErroDeFonte(
      "Esse endereço aponta para uma rede interna e não pode ser lido daqui. Use uma URL acessível pela internet.",
    );
  }

  return url;
}

/**
 * Busca o conteúdo de uma URL de feed, com as travas acima.
 * @returns {Promise<{corpo: string, tipoConteudo: string, url: string}>}
 */
export async function buscarFonte(enderecoInicial) {
  let alvo = await conferirEndereco(enderecoInicial);

  for (let salto = 0; salto <= SALTOS_MAXIMOS; salto += 1) {
    const controle = new AbortController();
    const relogio = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);

    let resposta;
    try {
      resposta = await fetch(alvo, {
        // `manual` para nós mesmos revalidarmos o destino de cada redirecionamento
        // — seguir automático anularia a checagem de IP feita acima.
        redirect: "manual",
        signal: controle.signal,
        headers: {
          Accept: "application/xml, text/xml, application/json;q=0.9, */*;q=0.5",
          "User-Agent": "Omnimob-Importador/1.0 (+https://omnimob.app)",
        },
      });
    } catch (erro) {
      clearTimeout(relogio);
      if (erro.name === "AbortError") {
        throw new ErroDeFonte(`A fonte demorou mais de ${TEMPO_LIMITE_MS / 1000}s para responder.`);
      }
      throw new ErroDeFonte(`Não consegui acessar o endereço: ${erro.message}`);
    }
    clearTimeout(relogio);

    if (resposta.status >= 300 && resposta.status < 400) {
      const destino = resposta.headers.get("location");
      if (!destino) throw new ErroDeFonte("A fonte redirecionou sem dizer para onde.");
      if (salto === SALTOS_MAXIMOS) throw new ErroDeFonte("A fonte redirecionou vezes demais.");
      alvo = await conferirEndereco(new URL(destino, alvo).href);
      continue;
    }

    if (!resposta.ok) {
      /* O status importa para quem vai consertar: 401 e 403 significam "o feed
         existe mas exige credencial", e a saída é outra (colar a URL com token,
         ou usar o endpoint de escrita). 404 é endereço errado. */
      throw new ErroDeFonte(
        resposta.status === 401 || resposta.status === 403
          ? "A fonte exigiu autenticação. Use uma URL de feed pública, ou envie os dados pela API com a sua chave."
          : `A fonte respondeu ${resposta.status}. Confira o endereço.`,
      );
    }

    /* Lê em pedaços, contando. `resposta.text()` carregaria tudo antes de
       podermos reclamar do tamanho — que é justamente o que o teto evita. */
    const leitor = resposta.body?.getReader();
    if (!leitor) throw new ErroDeFonte("A fonte respondeu sem conteúdo.");

    const pedacos = [];
    let total = 0;
    while (true) {
      const { done, value } = await leitor.read();
      if (done) break;
      total += value.byteLength;
      if (total > TETO_BYTES) {
        await leitor.cancel().catch(() => {});
        throw new ErroDeFonte(`O arquivo passa de ${TETO_BYTES / 1024 / 1024} MB. Divida o feed ou fale com o suporte.`);
      }
      pedacos.push(value);
    }

    return {
      corpo: Buffer.concat(pedacos).toString("utf8"),
      tipoConteudo: resposta.headers.get("content-type") || "",
      url: alvo.href,
    };
  }

  throw new ErroDeFonte("A fonte redirecionou vezes demais.");
}
