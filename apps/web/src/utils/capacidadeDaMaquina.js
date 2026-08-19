import { useEffect, useState } from "react";

/* ────────────────────────────────────────────────────────────────────────────
   Quanto de enfeite esta máquina aguenta.

   A landing tem dois shaders WebGL de tela cheia e cinco componentes com laço
   de `requestAnimationFrame`. Em máquina com gráfico integrado antigo isso não
   fica lento — fica travado, e a pessoa culpa o produto.

   ── POR QUE NÃO UMA SEGUNDA PÁGINA "LEVE" ──

   Porque duas cópias do mesmo conteúdo divergem. Preço, texto de plano e
   chamada de ação passariam a existir em dois arquivos, e o segundo seria
   esquecido na primeira alteração — é exatamente o defeito que o editor da
   vitrine teve (duas versões de cada peça, que se afastaram até o cliente
   publicar algo diferente do que via na tela).

   Aqui existe UMA página. O que muda é quais EFEITOS ela monta.

   ── POR QUE MEDIR, E NÃO SÓ PERGUNTAR AO NAVEGADOR ──

   `hardwareConcurrency` e `deviceMemory` mentem nos dois sentidos. Um desktop
   de oito núcleos de 2013 com vídeo onboard reprova em WebGL e passa na conta
   de núcleos; um notebook moderno de quatro núcleos roda tudo liso e seria
   rebaixado por ela. As dicas servem para o CHUTE INICIAL — que precisa existir
   antes do primeiro quadro —, e a medição real corrige depois.

   A medição usa a MEDIANA dos intervalos entre quadros, não a média: o começo
   de qualquer página tem picos de dezenas de milissegundos (montagem, fontes,
   imagens) e a média os transformaria em veredito. A mediana os ignora.
   ──────────────────────────────────────────────────────────────────────────── */

export const COMPLETO = "completo";
export const LEVE = "leve";
export const MINIMO = "minimo";

const ORDEM = [MINIMO, LEVE, COMPLETO];
const CHAVE = "omnimob_efeitos";

/** O nível pedido à mão vence tudo. `null` = decidir sozinho. */
export function nivelManual() {
  try {
    const v = localStorage.getItem(CHAVE);
    return ORDEM.includes(v) ? v : null;
  } catch {
    return null;
  }
}

export function definirNivelManual(nivel) {
  try {
    if (nivel === null) localStorage.removeItem(CHAVE);
    else localStorage.setItem(CHAVE, nivel);
  } catch { /* modo anônimo com armazenamento bloqueado */ }
}

function rebaixar(nivel, degraus = 1) {
  const i = ORDEM.indexOf(nivel);
  return ORDEM[Math.max(0, i - degraus)];
}

/** WebGL existe mesmo? Sem isto, carregar o three seria download puro perdido. */
function temWebGL() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl") || c.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

/* O chute inicial, disponível antes do primeiro quadro.
   Deliberadamente conservador nos vetos e generoso no resto: rebaixar quem
   aguentava custa um pouco de brilho, e promover quem não aguentava custa a
   página inteira travando na frente da pessoa. */
function chuteInicial() {
  if (typeof window === "undefined") return MINIMO;

  const reduzido = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  // Escolha explícita do sistema operacional. Não é dica de desempenho, é
  // preferência declarada — e ela vale mesmo numa máquina potente.
  if (reduzido) return MINIMO;

  const conexao = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conexao?.saveData) return MINIMO;
  if (conexao?.effectiveType && /^(slow-)?2g$/.test(conexao.effectiveType)) return MINIMO;

  if (!temWebGL()) return LEVE;

  const nucleos = navigator.hardwareConcurrency;
  const memoria = navigator.deviceMemory;

  if ((nucleos && nucleos <= 2) || (memoria && memoria <= 2)) return MINIMO;
  if ((nucleos && nucleos <= 4) || (memoria && memoria <= 4)) return LEVE;

  return COMPLETO;
}

/* Mede a fluidez real por ~800ms e devolve a mediana do intervalo entre quadros.
 *
 * Começa depois de dois quadros de aquecimento: o primeiro `rAF` depois da
 * montagem vem sempre atrasado pelo trabalho de layout que acabou de acontecer,
 * e ele sozinho reprovaria máquina boa. */
function medirQuadros(duracao = 800) {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "undefined") { resolve(null); return; }
    const intervalos = [];
    let anterior = null;
    let aquecimento = 2;
    let fim = null;

    function passo(agora) {
      if (aquecimento > 0) {
        aquecimento -= 1;
        anterior = agora;
        requestAnimationFrame(passo);
        return;
      }
      if (fim === null) fim = agora + duracao;
      if (anterior !== null) intervalos.push(agora - anterior);
      anterior = agora;

      if (agora < fim) {
        requestAnimationFrame(passo);
        return;
      }
      if (intervalos.length < 8) { resolve(null); return; }
      intervalos.sort((a, b) => a - b);
      resolve(intervalos[Math.floor(intervalos.length / 2)]);
    }
    requestAnimationFrame(passo);
  });
}

/**
 * O nível de efeitos desta máquina.
 *
 * @returns {{ nivel, chute, medido, manual, definir }}
 *   `nivel`  — o que a página deve obedecer
 *   `medido` — mediana do intervalo entre quadros, em ms (null enquanto mede)
 *   `manual` — o nível escolhido à mão, ou null
 *   `definir` — grava a escolha (null volta ao automático)
 */
export function useCapacidade() {
  const [manual, setManual] = useState(() => nivelManual());
  const [automatico, setAutomatico] = useState(() => chuteInicial());
  const [medido, setMedido] = useState(null);

  useEffect(() => {
    // Escolha à mão não precisa de medição: ela já é a resposta.
    if (manual) return undefined;
    let vivo = true;

    /* Espera a página assentar antes de medir. Sem a folga, o que se mede é o
       custo da montagem — que existe em qualquer máquina e não diz nada sobre
       a capacidade dela de sustentar animação. */
    const atraso = setTimeout(async () => {
      const mediana = await medirQuadros();
      if (!vivo || mediana === null) return;
      setMedido(mediana);
      setAutomatico((atual) => {
        // 60 fps ≈ 16,7ms. Acima de 22ms já não é fluido; acima de 33ms
        // (30 fps) qualquer animação vira arrastão.
        if (mediana > 33) return MINIMO;
        if (mediana > 22) return rebaixar(atual);
        return atual;
      });
    }, 1200);

    return () => { vivo = false; clearTimeout(atraso); };
  }, [manual]);

  function definir(nivel) {
    definirNivelManual(nivel);
    setManual(nivel);
    if (nivel === null) setAutomatico(chuteInicial());
  }

  return { nivel: manual || automatico, chute: automatico, medido, manual, definir };
}
