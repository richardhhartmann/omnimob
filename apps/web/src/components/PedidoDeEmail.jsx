import { useEffect, useState } from "react";
import { api } from "../api";
import { marcarTourAberto, quandoSemTour } from "../utils/tourAtivo";
import { CSS_DO_PULSO } from "./PulsoTrialModal";

/* ────────────────────────────────────────────────────────────────────────────
   "Cadastre o seu e-mail" — porte do pedido de e-mail do VYA.

   Para quem usa o painel SEM e-mail: sem ele a pessoa não recebe as Novidades
   nem consegue recuperar a senha sozinha. Aparece no máximo uma vez a cada 7
   dias (marca no navegador, por pessoa), quando nada mais está na tela.

   Só PREENCHE: o servidor recusa trocar um e-mail que já existe
   (`PUT /api/auth/meu-email`) — trocar é do administrador, porque é o caminho
   da recuperação de senha. "Sem e-mail" é `usuario.email === null`, que vem
   do login e do `/auth/me`; campo ausente é "ainda não sei", e aí não pergunta.
   ──────────────────────────────────────────────────────────────────────────── */

const INTERVALO_MS = 7 * 864e5;
const chave = (usuarioId) => `omnimob_pedido_email:${usuarioId}`;

function podePerguntar(usuarioId) {
  try {
    return Date.now() - Number(localStorage.getItem(chave(usuarioId)) || 0) > INTERVALO_MS;
  } catch {
    return false;
  }
}

export function PedidoDeEmail({ session, pronto = true, onSessionUpdate }) {
  const usuario = session?.usuario;
  const semEmail = Boolean(usuario && "email" in usuario && !usuario.email);
  const [aberto, setAberto] = useState(false);
  const [email, setEmail] = useState("");
  const [falha, setFalha] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!semEmail || !pronto || !podePerguntar(usuario.id)) return undefined;
    // Respiro: a tela termina de montar antes de perguntar.
    let cancelar = () => {};
    const t = setTimeout(() => { cancelar = quandoSemTour(() => setAberto(true)); }, 3000);
    return () => { clearTimeout(t); cancelar(); };
  }, [semEmail, pronto, usuario?.id]);

  useEffect(() => (aberto ? marcarTourAberto() : undefined), [aberto]);

  function adiar() {
    try { localStorage.setItem(chave(usuario.id), String(Date.now())); } catch { /* sem armazenamento, pergunta na próxima */ }
    setAberto(false);
  }

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    setFalha("");
    try {
      const r = await api.cadastrarMeuEmail(session.tenant.slug, email.trim());
      onSessionUpdate?.({ ...session, usuario: { ...session.usuario, email: r.email } });
      setAberto(false);
    } catch (erro) {
      setFalha(erro?.message || "Não deu para salvar agora.");
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) return null;
  return (
    <>
      <style>{CSS_DO_PULSO}</style>
      <div className="pt-veu" onMouseDown={(e) => e.target === e.currentTarget && !salvando && adiar()}>
        <form className="pt-caixa" role="dialog" aria-modal="true" aria-labelledby="pe-titulo" onSubmit={salvar}>
          <span className="pt-eyebrow">● SUA CONTA</span>
          <h2 id="pe-titulo" className="pt-titulo">Cadastre o seu e-mail</h2>
          <p className="pt-texto">
            É por ele que chegam as novidades do painel e o link para criar uma senha nova, se você esquecer a sua.
          </p>
          <label className="pt-campo">
            <span className="pt-campo__rotulo">Seu e-mail</span>
            <input
              className="pt-campo__area"
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@imobiliaria.com.br"
            />
          </label>
          {falha ? <p className="pt-falha">{falha}</p> : null}
          <div className="pt-acoes">
            <button type="button" className="pt-btn" disabled={salvando} onClick={adiar}>Agora não</button>
            <button type="submit" className="pt-btn pt-btn--primario" disabled={salvando || !email.trim()}>
              {salvando ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
