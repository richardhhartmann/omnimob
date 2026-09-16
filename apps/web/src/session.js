const STORAGE_KEY = "domus.session";

/* ── A SESSÃO DE DEMONSTRAÇÃO NÃO SOBREVIVE À ABA ────────────────────────────
   Ela vai para o sessionStorage, e não para o localStorage: fechar a aba a
   apaga. Guardada como as outras, quem fechou a demonstração no meio do tour
   e voltou à landing no dia seguinte caía DE NOVO no painel de exemplo, preso
   no tour obrigatório, sem entender por quê — e sem ter nada a perder, porque
   ali nada é salvo. Recarregar a MESMA aba continua funcionando (o
   sessionStorage aguenta o F5); só a aba fechada esquece.

   A leitura olha primeiro o sessionStorage: se há demonstração nesta aba, é
   ela que vale, mesmo que exista uma sessão normal guardada. */
const ehDemo = (session) => Boolean(session?.demo);

function lerDe(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function loadSession() {
  return lerDe(sessionStorage) || lerDe(localStorage);
}

export function saveSession(session) {
  if (ehDemo(session)) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  /* Login normal por cima de uma demonstração aberta nesta aba: a demo sai,
     senão a leitura continuaria preferindo-a. */
  sessionStorage.removeItem(STORAGE_KEY);
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
}
