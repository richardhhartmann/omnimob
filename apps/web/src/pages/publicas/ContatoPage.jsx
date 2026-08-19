import { useState } from "react";
import { Link } from "react-router-dom";
import { PaginaPublica, Secao } from "../../components/PaginaPublica.jsx";
import { api } from "../../api";

/* ────────────────────────────────────────────────────────────────────────────
   Contato.

   Reaproveita o endpoint que a landing já usa (`POST /public/interesse`) em vez
   de criar outro: é o mesmo pedido — alguém querendo falar com a Omnimob — e
   dois destinos para a mesma mensagem significaria dois lugares para checar a
   caixa de entrada.

   A página começa dizendo que NÃO é preciso falar com ninguém para começar.
   Formulário de contato em SaaS costuma ser um pedágio: a pessoa quer ver o
   produto e é obrigada a marcar reunião. Aqui o teste é imediato e sem cartão,
   então o honesto é dizer isso antes de pedir o telefone dela.

   O campo `website` é armadilha para robô: fica fora da vista e fora da ordem
   de tabulação. Robô preenche tudo que encontra; gente não vê. A API descarta
   silenciosamente quem o preenche — responder com erro ensinaria o robô a
   deixá-lo vazio na próxima.
   ──────────────────────────────────────────────────────────────────────────── */

const CANAIS = [
  {
    titulo: "WhatsApp",
    texto: "O caminho mais rápido para dúvida comercial ou dificuldade no uso.",
    acao: "Abrir conversa",
    href: "https://wa.me/",
    externo: true,
  },
  {
    titulo: "E-mail",
    texto: "Para assuntos que rendem anexo — proposta, migração de base, nota fiscal.",
    acao: "contato@omnimob.app",
    href: "mailto:contato@omnimob.app",
  },
  {
    titulo: "Privacidade e dados",
    texto: "Pedidos de acesso, correção ou exclusão de dados pessoais, e comunicação de incidente.",
    acao: "privacidade@omnimob.app",
    href: "mailto:privacidade@omnimob.app",
  },
];

function formatarTelefone(v) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

const VAZIO = { imobiliaria: "", email: "", telefone: "", temWhatsapp: true, website: "" };

export function ContatoPage() {
  const [form, setForm] = useState(VAZIO);
  const [estado, setEstado] = useState("parado"); // parado | enviando | enviado
  const [erro, setErro] = useState("");

  const campo = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function enviar(e) {
    e.preventDefault();
    setErro("");
    setEstado("enviando");
    try {
      await api.enviarInteresseOmnimob(form);
      setEstado("enviado");
      setForm(VAZIO);
    } catch (erroDoEnvio) {
      setErro(erroDoEnvio.message || "Não consegui enviar. Tente pelo WhatsApp.");
      setEstado("parado");
    }
  }

  return (
    <PaginaPublica
      olho="Fale com a gente"
      titulo="Contato"
      subtitulo="Para testar não é preciso falar com ninguém — o ambiente sai em segundos e sem cartão. Mas se você prefere conversar antes, é por aqui."
      descricao="Canais de contato da Omnimob: WhatsApp, e-mail comercial, privacidade de dados e formulário para retorno."
    >
      <Secao titulo="Canais diretos">
        <div className="ct-canais">
          {CANAIS.map((c) => (
            <div key={c.titulo} className="ct-canal">
              <h3>{c.titulo}</h3>
              <p>{c.texto}</p>
              <a
                href={c.href}
                target={c.externo ? "_blank" : undefined}
                rel={c.externo ? "noreferrer" : undefined}
              >
                {c.acao}
              </a>
            </div>
          ))}
        </div>
      </Secao>

      <Secao titulo="Prefere que a gente ligue?">
        {estado === "enviado" ? (
          <div className="ct-ok">
            <strong>Recebemos.</strong> Entramos em contato pelo telefone ou e-mail informados,
            normalmente no mesmo dia útil. Se for urgente, chame no WhatsApp — é mais rápido.
          </div>
        ) : (
          <form className="ct-form" onSubmit={enviar}>
            <label className="ct-campo">
              <span>Nome da imobiliária ou seu nome</span>
              <input
                value={form.imobiliaria}
                onChange={(e) => campo("imobiliaria", e.target.value)}
                required
                minLength={2}
                maxLength={120}
                autoComplete="organization"
              />
            </label>

            <label className="ct-campo">
              <span>E-mail</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => campo("email", e.target.value)}
                required
                maxLength={160}
                autoComplete="email"
              />
            </label>

            <label className="ct-campo">
              <span>Telefone com DDD</span>
              <input
                value={form.telefone}
                onChange={(e) => campo("telefone", formatarTelefone(e.target.value))}
                required
                inputMode="tel"
                autoComplete="tel"
                placeholder="(11) 99999-9999"
              />
            </label>

            <label className="ct-caixa">
              <input
                type="checkbox"
                checked={form.temWhatsapp}
                onChange={(e) => campo("temWhatsapp", e.target.checked)}
              />
              <span>Este número tem WhatsApp</span>
            </label>

            {/* Armadilha para robô — invisível e fora da ordem de tabulação. */}
            <div className="ct-armadilha" aria-hidden="true">
              <label>
                Não preencha
                <input
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.website}
                  onChange={(e) => campo("website", e.target.value)}
                />
              </label>
            </div>

            {erro ? <p className="ct-erro">{erro}</p> : null}

            <button type="submit" className="ct-enviar" disabled={estado === "enviando"}>
              {estado === "enviando" ? "Enviando…" : "Quero que entrem em contato"}
            </button>

            <p className="ct-nota">
              Usamos seus dados só para responder este contato. Veja a{" "}
              <Link to="/privacidade">Política de Privacidade</Link>.
            </p>
          </form>
        )}
      </Secao>

      <Secao titulo="Já é cliente?">
        <p>
          Suporte e dúvidas de uso são atendidos <strong>de dentro do painel</strong>, no botão de
          ajuda da barra lateral — de lá o chamado já chega com a sua imobiliária identificada, sem
          você precisar explicar quem é. Para entrar, use o{" "}
          <Link to="/login">acesso do cliente</Link>.
        </p>
      </Secao>

      <style>{CSS}</style>
    </PaginaPublica>
  );
}

const CSS = `
.ct-canais { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(min(230px, 100%), 1fr)); margin-bottom: 8px; }
.ct-canal { padding: 18px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); }
.ct-canal h3 { margin: 0 0 6px; font-size: 14.5px; font-weight: 650; }
.ct-canal p { margin: 0 0 12px; font-size: 13px; line-height: 1.6; color: var(--subtle); }
.ct-canal a { font-size: 13px; font-weight: 600; color: var(--accent-soft); text-decoration: none; }
.ct-canal a:hover { text-decoration: underline; }

.ct-form { display: flex; flex-direction: column; gap: 14px; max-width: 460px; }
.ct-campo { display: flex; flex-direction: column; gap: 6px; }
.ct-campo > span { font-size: 12.5px; font-weight: 600; color: var(--subtle); }
.ct-campo input {
  width: 100%; padding: 11px 14px; font-size: 14px; border-radius: 10px;
  background: var(--surface); border: 1px solid var(--line); color: var(--default);
  outline: none; transition: border-color 0.16s ease;
}
.ct-campo input:focus { border-color: var(--accent-soft); }

.ct-caixa { display: flex; align-items: center; gap: 9px; font-size: 13.5px; color: var(--subtle); cursor: pointer; }
.ct-caixa input { width: 16px; height: 16px; accent-color: var(--accent); }

/* Fora da vista sem 'display: none': campo escondido assim é ignorado por parte
   dos robôs, e a armadilha deixaria de funcionar justamente com os mais espertos. */
.ct-armadilha { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }

.ct-enviar {
  align-self: flex-start; padding: 12px 22px; border-radius: 999px; border: 0;
  background: var(--default); color: var(--bg);
  font-size: 14px; font-weight: 650; cursor: pointer;
  transition: opacity 0.16s ease;
}
.ct-enviar:hover { opacity: 0.86; }
.ct-enviar:disabled { opacity: 0.5; cursor: progress; }

.ct-erro { margin: 0; font-size: 13px; color: var(--danger); }
.ct-nota { margin: 0; font-size: 12.5px; color: var(--subtle); opacity: 0.85; }
.ct-nota a { color: var(--accent-soft); }

.ct-ok {
  padding: 18px 20px; border-radius: 14px; font-size: 14.5px; line-height: 1.65;
  background: rgba(52,211,153,0.08); border: 1px solid rgba(52,211,153,0.3); color: var(--subtle);
}
.ct-ok strong { color: var(--mint); }
`;
