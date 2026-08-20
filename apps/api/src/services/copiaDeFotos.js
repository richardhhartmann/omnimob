/* ────────────────────────────────────────────────────────────────────────────
   Trazer as fotos do sistema antigo para a nossa conta do Cloudinary.

   ── POR QUE ISTO EXISTE ──

   No caminho da planilha, quem copiava as fotos era o NAVEGADOR: ele lia as
   URLs da planilha, mandava cada uma para o Cloudinary e entregava ao servidor
   os links já nossos. O `importacaoService` recebe a lista pronta e só grava.

   Com a importação por feed, o servidor é quem tem as URLs — e sem este passo
   ele gravaria os endereços do sistema antigo direto no banco. O acervo
   pareceria importado, com todas as fotos no lugar, e continuaria dependendo do
   sistema que a imobiliária está deixando: no dia em que ela cancelasse aquele
   contrato, a vitrine inteira ficaria sem imagem. Uma falha silenciosa,
   descoberta semanas depois, quando ninguém mais liga uma coisa à outra.

   ── COMO ──

   O Cloudinary aceita uma URL no lugar do arquivo e busca a imagem sozinho: não
   baixamos nada para a memória deste processo, e um feed com mil fotos não vira
   mil buffers aqui dentro. É o mesmo endpoint sem assinatura que o navegador já
   usa, com o mesmo preset — nenhuma credencial nova.

   ── QUANDO NÃO DÁ ──

   Sem `CLOUDINARY_CLOUD_NAME` e `CLOUDINARY_UPLOAD_PRESET` no ambiente, a
   função devolve as URLs originais e diz que não copiou. Importar com foto
   emprestada é pior que importar sem foto? Não — sem foto o anúncio não vai
   para portal nenhum. Então seguimos, e quem chama AVISA na tela em vez de
   fingir que deu tudo certo.
   ──────────────────────────────────────────────────────────────────────────── */

const CLOUD = process.env.CLOUDINARY_CLOUD_NAME || "";
const PRESET = process.env.CLOUDINARY_UPLOAD_PRESET || "";

export const copiaDeFotosConfigurada = Boolean(CLOUD && PRESET);

/* Quatro de cada vez. A espera aqui é de rede, não de processador: uma por vez
   desperdiça o tempo parado, e centenas ao mesmo tempo fazem o Cloudinary
   responder 420 e derrubar o lote inteiro. O mesmo número que o navegador usava
   — foi calibrado contra o mesmo serviço. */
const FRENTES = 4;
const TEMPO_LIMITE_MS = 30_000;

async function copiarUma(url) {
  const corpo = new FormData();
  corpo.append("file", url); // o Cloudinary busca a imagem neste endereço
  corpo.append("upload_preset", PRESET);

  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);
  try {
    const resposta = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, {
      method: "POST",
      body: corpo,
      signal: controle.signal,
    });
    if (!resposta.ok) {
      const erro = await resposta.json().catch(() => ({}));
      throw new Error(erro?.error?.message || `Cloudinary respondeu ${resposta.status}.`);
    }
    return (await resposta.json()).secure_url;
  } finally {
    clearTimeout(relogio);
  }
}

/**
 * Copia todas as fotos das linhas, no lugar.
 *
 * Trabalha sobre o conjunto de URLs ÚNICAS de todas as linhas, e não linha a
 * linha: feed de imobiliária repete a mesma foto de fachada em vários imóveis
 * do mesmo prédio, e copiar cada repetição gastaria a cota do cliente para
 * gravar o mesmo arquivo várias vezes.
 *
 * @param {Array<object>} linhas  já convertidas, com `fotos` em URLs remotas
 * @returns {Promise<{copiadas: number, falhas: Array, pulou: boolean}>}
 */
export async function copiarFotosDasLinhas(linhas) {
  if (!copiaDeFotosConfigurada) return { copiadas: 0, falhas: [], pulou: true };

  const todas = [...new Set(linhas.flatMap((l) => (Array.isArray(l.fotos) ? l.fotos : [])))]
    .filter((u) => /^https?:\/\//i.test(u));
  if (!todas.length) return { copiadas: 0, falhas: [], pulou: false };

  const mapa = new Map();
  const falhas = [];
  const fila = [...todas];

  async function trabalhar() {
    while (fila.length) {
      const url = fila.shift();
      try {
        mapa.set(url, await copiarUma(url));
      } catch (erro) {
        falhas.push({ url, motivo: erro.message });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(FRENTES, fila.length) }, trabalhar));

  /* Foto que não copiou sai da lista em vez de entrar com o endereço antigo.
     Meio-termo é o pior desfecho possível: um acervo em que parte das imagens
     some daqui a três meses e parte não, sem ninguém saber quais. */
  for (const linha of linhas) {
    if (!Array.isArray(linha.fotos)) continue;
    linha.fotos = linha.fotos.map((u) => mapa.get(u)).filter(Boolean);
  }

  return { copiadas: mapa.size, falhas, pulou: false };
}
