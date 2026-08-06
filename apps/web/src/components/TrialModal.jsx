import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { formatPhone } from "../utils/masks";
import { MODAL_CSS } from "./modalCSS";

/* ────────────────────────────────────────────────────────────────────────────
   Teste grátis com auto-atendimento.

   Pede o mínimo — nome da imobiliária e e-mail — porque cada campo a mais
   derruba quem chega até o fim. O telefone fica opcional.

   O ambiente NÃO nasce aqui: este passo só dispara um link de confirmação por
   e-mail. O tenant é criado quando a pessoa abre esse link (TrialConfirmarPage),
   o que prova a posse do endereço — sem isso, qualquer um criaria ambientes em
   nome de terceiros.
   ──────────────────────────────────────────────────────────────────────────── */

const VAZIO = { imobiliaria: "", email: "", telefone: "", website: "" };

function validar(form) {
  const erros = {};
  if (form.imobiliaria.trim().length < 2) erros.imobiliaria = "Informe o nome da imobiliária.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) erros.email = "E-mail inválido.";
  return erros;
}

export function TrialModal({ aberto, aoFechar }) {
  const [form, setForm] = useState(VAZIO);
  const [erros, setErros] = useState({});
  const [criando, setCriando] = useState(false);
  const [enviado, setEnviado] = useState(false); // link de confirmação a caminho
  const [falha, setFalha] = useState("");
  const caixaRef = useRef(null);
  const primeiroRef = useRef(null);

  useEffect(() => {
    if (!aberto) return;
    setForm(VAZIO);
    setErros({});
    setEnviado(false);
    setFalha("");
    setCriando(false);
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return undefined;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const foco = setTimeout(() => primeiroRef.current?.focus(), 60);
    return () => {
      document.body.style.overflow = anterior;
      clearTimeout(foco);
    };
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return undefined;
    function aoTeclar(evento) {
      if (evento.key === "Escape") aoFechar();
      if (evento.key !== "Tab") return;
      const alvos = caixaRef.current?.querySelectorAll(
        "button, input, [href], [tabindex]:not([tabindex='-1'])",
      );
      if (!alvos?.length) return;
      const primeiro = alvos[0];
      const ultimo = alvos[alvos.length - 1];
      if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto, aoFechar]);

  if (!aberto) return null;

  function definir(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
    setErros((e) => (e[campo] ? { ...e, [campo]: undefined } : e));
  }

  async function criar(evento) {
    evento.preventDefault();
    const achados = validar(form);
    setErros(achados);
    if (Object.keys(achados).length) return;

    setCriando(true);
    setFalha("");
    try {
      await api.criarTrialDomus({
        imobiliaria: form.imobiliaria.trim(),
        email: form.email.trim(),
        telefone: form.telefone.trim(),
        website: form.website,
      });
      setEnviado(true);
    } catch (erro) {
      setFalha(erro.message || "Não foi possível criar o ambiente agora.");
    } finally {
      setCriando(false);
    }
  }

  return (
    <div className="pm-veu" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <style>{CSS}</style>
      <div
        className="pm-caixa dl-glass"
        ref={caixaRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tm-titulo"
      >
        <button type="button" className="pm-fechar" onClick={aoFechar} aria-label="Fechar">
          ✕
        </button>

        {enviado ? (
          <div className="tm-pronto">
            <span className="tm-envelope" aria-hidden="true">✉</span>
            <h2 id="tm-titulo" className="pm-titulo">Confira seu e-mail</h2>
            <p className="pm-sub">
              Mandamos um link de confirmação para <strong>{form.email}</strong>. Abrir esse link
              cria o ambiente da {form.imobiliaria} na hora.
            </p>
            <p className="tm-aviso">
              O link vale por 30 minutos. Se não aparecer em alguns instantes, confira a caixa de
              spam.
            </p>
            <div className="pm-acoes tm-acoes">
              <button type="button" className="pm-botao pm-botao--primario" onClick={aoFechar}>
                Entendi
              </button>
            </div>
          </div>
        ) : (
          <>
            <span className="dl-mono pm-eyebrow tm-eyebrow">● TESTE GRÁTIS POR 14 DIAS</span>
            <h2 id="tm-titulo" className="pm-titulo">Veja a Domus funcionando com a sua cara.</h2>
            <p className="pm-sub">
              Criamos um ambiente completo em segundos, já com imóveis de exemplo, vitrine no ar e
              métricas. Sem cartão, sem instalar nada.
            </p>

            <form className="pm-form" onSubmit={criar} noValidate>
              <label className="pm-campo">
                <span className="pm-rotulo">Nome da imobiliária</span>
                <input
                  ref={primeiroRef}
                  className={`pm-entrada${erros.imobiliaria ? " is-erro" : ""}`}
                  value={form.imobiliaria}
                  onChange={(e) => definir("imobiliaria", e.target.value)}
                  placeholder="Imobiliária Centro"
                  autoComplete="organization"
                />
                {erros.imobiliaria ? <span className="pm-erro">{erros.imobiliaria}</span> : null}
              </label>

              <div className="pm-dupla">
                <label className="pm-campo">
                  <span className="pm-rotulo">E-mail</span>
                  <input
                    type="email"
                    className={`pm-entrada${erros.email ? " is-erro" : ""}`}
                    value={form.email}
                    onChange={(e) => definir("email", e.target.value)}
                    placeholder="voce@imobiliaria.com.br"
                    autoComplete="email"
                  />
                  {erros.email ? <span className="pm-erro">{erros.email}</span> : null}
                </label>

                <label className="pm-campo">
                  <span className="pm-rotulo">
                    Telefone <em className="tm-opcional">opcional</em>
                  </span>
                  <input
                    inputMode="tel"
                    className="pm-entrada"
                    value={form.telefone}
                    onChange={(e) => definir("telefone", formatPhone(e.target.value))}
                    placeholder="(11) 99999-9999"
                    autoComplete="tel"
                  />
                </label>
              </div>

              <input
                className="pm-isca"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={form.website}
                onChange={(e) => definir("website", e.target.value)}
              />

              {falha ? <p className="pm-falha">{falha}</p> : null}

              <div className="pm-acoes">
                <button type="button" className="pm-botao" onClick={aoFechar} disabled={criando}>
                  Cancelar
                </button>
                <button type="submit" className="pm-botao pm-botao--primario" disabled={criando}>
                  {criando ? "Preparando ambiente…" : "Começar o teste"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

/* A folha comum (.pm-*) vem do módulo compartilhado; aqui só o que é próprio
   da tela de acesso. */
const CSS = `${MODAL_CSS}
.tm-eyebrow { color: var(--mint); }
.tm-pronto { display: grid; justify-items: center; text-align: center; gap: 12px; }
.tm-pronto .pm-sub { margin-top: 0; }

.tm-aviso {
  font-size: 12px; line-height: 1.65; color: var(--subtle);
  padding: 10px 13px; border-radius: 10px;
  background: rgba(212,175,55,0.09); border: 1px solid rgba(212,175,55,0.24);
}
.tm-acoes { width: 100%; justify-content: center; }
.tm-envelope {
  width: 52px; height: 52px; border-radius: 999px; display: grid; place-items: center;
  background: rgba(99,102,241,0.16); border: 1px solid rgba(99,102,241,0.4);
  color: var(--accent-soft); font-size: 22px; margin-bottom: 4px;
}
.tm-opcional {
  font-style: normal; font-weight: 500; color: var(--placeholder); font-size: 10.5px;
  margin-left: 5px;
}
`;

export default TrialModal;
