/* ────────────────────────────────────────────────────────────────────────────
   O AUTOSAVE DO EDITOR DE VITRINE — a regra, sem React (31/10/2026).

   Saiu de dentro do `VitrinePuckPage` para ter teste
   (`apps/web/test/autosave.test.js`). As três regras que ele guarda custaram
   caro, e nenhuma aparece na tela quando quebra:

   ── 1. A ABERTURA NÃO GRAVA ──

   O Puck normaliza o documento ao carregar, e o `resolveData` de cada peça roda
   logo depois: chegam `onChange` com documento diferente sem ninguém ter
   tocado em nada. Numa versão anterior isso migrava em silêncio toda
   imobiliária que só ABRIA o editor. Por isso nada é gravado antes de `armar()`,
   que a tela chama no `onAction` do Puck — o sinal de que uma PESSOA agiu.

   ── 2. UMA GRAVAÇÃO DE CADA VEZ ──

   Cada gravação do rascunho devolve a versão nova, e a próxima precisa dela
   (é o que o servidor usa para recusar dois editores ao mesmo tempo). Duas em
   voo levariam a mesma versão e a segunda seria recusada como conflito com a
   própria aba. Mudança que chega com uma gravação em voo espera ela terminar e
   vai depois — só a mais recente.

   ── 3. A FALHA NÃO SE PERDE ──

   Se a gravação falha, o documento volta a ser o pendente: vai de novo na
   próxima mudança, ou em `agora()`. `pausar()` para tudo (o conflito de
   versão: gravar de novo seria insistir por cima de outra pessoa).
   ──────────────────────────────────────────────────────────────────────────── */

export function criarAutosave({ gravar, espera = 1000, relogio = globalThis, aoMudarSituacao } = {}) {
  let armado = false;
  let pausado = false;
  let pendente = null; // o documento mais recente ainda não gravado
  let temporizador = null;
  let emVoo = null; // a promessa da gravação em curso
  let falhou = false;

  const avisar = () => aoMudarSituacao?.(situacao());

  function situacao() {
    if (pausado) return "pausado";
    if (emVoo) return "salvando";
    if (falhou) return "falhou";
    if (pendente !== null) return "pendente";
    return "em-dia";
  }

  function limparRelogio() {
    if (temporizador !== null) { relogio.clearTimeout(temporizador); temporizador = null; }
  }

  async function enviar() {
    limparRelogio();
    if (pausado || emVoo || pendente === null) return emVoo;
    const dados = pendente;
    pendente = null;
    emVoo = (async () => {
      try {
        await gravar(dados);
        falhou = false;
      } catch (erro) {
        falhou = true;
        // Volta a ser o pendente, a não ser que já haja um mais novo.
        if (pendente === null) pendente = dados;
        throw erro;
      } finally {
        emVoo = null;
        avisar();
      }
    })();
    avisar();
    try {
      await emVoo;
    } catch {
      return undefined;
    }
    // Chegou mudança enquanto gravava: ela vai agora, em seguida.
    if (pendente !== null && !falhou) return enviar();
    return undefined;
  }

  return {
    /** Uma pessoa agiu: a partir daqui as mudanças são gravadas. */
    armar() { armado = true; },
    get armado() { return armado; },

    /** O `onChange` do Puck. Antes de `armar()`, não faz nada. */
    aoMudar(dados) {
      if (!armado || pausado) return;
      pendente = dados;
      limparRelogio();
      if (!emVoo) temporizador = relogio.setTimeout(() => { temporizador = null; void enviar(); }, espera);
      avisar();
    },

    /** Grava já o que estiver pendente e espera tudo terminar — inclusive a
     *  gravação que já estava em voo. Devolve `true` se ficou tudo salvo. É o
     *  que o "Publicar" chama antes de publicar. */
    async agora() {
      for (;;) {
        if (emVoo) { try { await emVoo; } catch { /* a falha fica em `falhou` */ } continue; }
        if (pausado) return false;
        if (pendente === null) return !falhou;
        await enviar();
        if (falhou) return false;
      }
    },

    /** O documento ainda não gravado, ou `null`. Para o envio da saída. */
    get pendente() { return pendente; },
    get situacao() { return situacao(); },

    /** Há algo que fecharia a aba sem estar salvo? */
    temPendencia() { return pendente !== null || Boolean(emVoo) || falhou; },

    /** Para de gravar (conflito de versão). Só `retomar()` volta. */
    pausar() { pausado = true; limparRelogio(); avisar(); },
    retomar() { pausado = false; avisar(); },

    /** Volta ao estado da abertura: desarmado, sem pendência, sem pausa. É o
     *  que a tela chama ao (re)carregar o documento — a regra 1 vale de novo. */
    reiniciar() { armado = false; pausado = false; pendente = null; falhou = false; limparRelogio(); avisar(); },

    /** Esquece o pendente (o documento foi trocado por outro já gravado). */
    descartar() { pendente = null; falhou = false; limparRelogio(); avisar(); },
  };
}
