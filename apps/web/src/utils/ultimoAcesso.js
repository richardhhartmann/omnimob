/* ────────────────────────────────────────────────────────────────────────────
   Como esta MÁQUINA entrou da última vez.

   O login oferece dois caminhos — senha e Google — e eles não são
   intercambiáveis: quem vinculou a conta Google e passou a usá-la costuma nem
   saber mais qual senha cadastrou. Voltar depois de semanas e encarar os dois
   botões iguais faz a pessoa tentar o errado primeiro, errar a senha e concluir
   que perdeu o acesso.

   ── POR QUE DA MÁQUINA, E NÃO DA PESSOA ──

   Porque na hora em que isto é lido não HÁ pessoa: ninguém entrou ainda. É a
   mesma natureza do "lembrar deste dispositivo" — uma pista do navegador para
   quem quer que se sente nele.

   Isso tem uma consequência que vale dizer: num computador compartilhado, o
   marcador é do último que entrou, não de quem está chegando. É por isso que
   ele é uma DICA e não um atalho — nada é preenchido, nada é escolhido por
   ninguém, e os dois caminhos continuam à mesma distância de um clique.

   ── O QUE NÃO SE GUARDA AQUI ──

   Login, e-mail, nome, foto. Só qual dos dois botões funcionou. Um identificador
   de pessoa neste armazenamento seria dado de conta exposto na tela de entrada
   de um computador que pode ser de recepção.
   ──────────────────────────────────────────────────────────────────────────── */

const CHAVE = "domus_ultimo_acesso";

export const SENHA = "senha";
export const GOOGLE = "google";

const VALIDOS = [SENHA, GOOGLE];

/** `null` quando nunca entrou nesta máquina, ou quando o valor não é conhecido. */
export function lerUltimoAcesso() {
  try {
    const v = localStorage.getItem(CHAVE);
    return VALIDOS.includes(v) ? v : null;
  } catch {
    /* Modo anônimo com armazenamento bloqueado. A tela perde a dica e continua
       inteira — ela nunca dependeu disto para funcionar. */
    return null;
  }
}

export function registrarUltimoAcesso(metodo) {
  if (!VALIDOS.includes(metodo)) return;
  try {
    localStorage.setItem(CHAVE, metodo);
  } catch { /* idem */ }
}
