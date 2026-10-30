import { useEffect, useState } from "react";
import { adminApi } from "../../api";
import { Alert, Button, Eyebrow, Reveal } from "../../styles/omnimobKit";

/* ────────────────────────────────────────────────────────────────────────────
   INTERESSADOS DA LANDING — quem pediu contato comercial pelo site.

   Porte da aba do VYA. O formulário da landing (`POST /public/interesse`)
   passou a GUARDAR o pedido antes de mandar o e-mail ao comercial: um envio
   que falhava perdia o interesse para sempre. O resultado do e-mail aparece
   na linha, e "Atendido" é a marcação de quem já falou com a pessoa. Não é
   dado de cliente: não muda com o cliente em foco.
   ──────────────────────────────────────────────────────────────────────────── */

const ENVIO = {
  enviado: { rotulo: "e-mail enviado", cor: "#86efac" },
  falhou: { rotulo: "e-mail falhou", cor: "#fda4af" },
  "sem-destino": { rotulo: "sem CONTATO_EMAIL", cor: "#fcd34d" },
};
const somenteDigitos = (v) => String(v || "").replace(/\D/g, "");

export function AdminInteressadosPage({ aoContar }) {
  const [dados, setDados] = useState(null);
  const [pendentes, setPendentes] = useState(true);
  const [pagina, setPagina] = useState(1);
  const [erro, setErro] = useState("");

  async function carregar() {
    setErro("");
    try {
      const r = await adminApi.listInteressados({ pendentes: pendentes ? "1" : "", page: pagina });
      setDados(r);
      aoContar?.(r.pendentes);
    } catch (e) {
      setErro(e.message || "Erro ao listar os interessados.");
    }
  }
  useEffect(() => { carregar(); }, [pendentes, pagina]); // eslint-disable-line react-hooks/exhaustive-deps

  async function marcar(i, atendido) {
    try {
      await adminApi.marcarInteressado(i.id, atendido);
      await carregar();
    } catch (e) {
      setErro(e.message || "Erro ao marcar.");
    }
  }

  const paginas = dados ? Math.max(1, Math.ceil(dados.total / (dados.limit || 40))) : 1;

  return (
    <>
      <Reveal className="sa-head">
        <Eyebrow>INTERESSADOS</Eyebrow>
        <h1 className="dl-h2 sa-title">
          <span className="dl-h2__strong">Quem pediu contato</span>
          <span className="dl-h2__soft">pelo site da Omnimob.</span>
        </h1>
      </Reveal>
      <p className="dl-mono dl-note sa-note">// o formulário comercial da landing · {dados ? `${dados.pendentes} esperando contato` : "…"}</p>

      <div className="sa-bar">
        <label className="av-check">
          <input type="checkbox" checked={pendentes} onChange={(e) => { setPagina(1); setPendentes(e.target.checked); }} />
          Só quem ainda não foi atendido
        </label>
        <Button as="button" type="button" variant="ghost" className="dl-btn--sm" arrow={false} onClick={carregar}>Atualizar</Button>
      </div>

      {erro ? <Alert tone="danger">{erro}</Alert> : null}
      {dados && !dados.interessados.length ? (
        <div className="sa-empty">
          <p className="sa-empty__title">{pendentes ? "Ninguém esperando contato" : "Nenhum interessado ainda"}</p>
          <p className="sa-empty__desc">Os pedidos do formulário comercial da landing aparecem aqui.</p>
        </div>
      ) : null}

      <div className="sa-list">
        {(dados?.interessados || []).map((i) => {
          const envio = ENVIO[i.envio];
          const zap = somenteDigitos(i.telefone);
          return (
            <div key={i.id} className={`av-item${i.atendidoEm ? "" : " is-nova"}`}>
              <div className="av-item__topo">
                <strong className="av-item__quem">{i.imobiliaria}</strong>
                <span className="dl-mono av-item__onde">
                  {i.plano ? `plano ${i.plano.toLowerCase()}` : "sem plano escolhido"}
                  {envio ? <> · <span style={{ color: envio.cor }}>{envio.rotulo}</span></> : null}
                </span>
                <span className="dl-mono av-item__quando">{new Date(i.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
              </div>
              <p className="it-contato">
                <a href={`mailto:${i.email}`}>{i.email}</a>
                {i.telefone ? (
                  <>
                    {" · "}
                    {i.temWhatsapp && zap ? <a href={`https://wa.me/55${zap.replace(/^55/, "")}`} target="_blank" rel="noreferrer">{i.telefone} (WhatsApp)</a> : i.telefone}
                  </>
                ) : null}
              </p>
              <div className="it-acoes">
                {i.atendidoEm ? (
                  <>
                    <span className="dl-mono av-item__onde">atendido {new Date(i.atendidoEm).toLocaleDateString("pt-BR")}{i.atendidoPor ? ` por ${i.atendidoPor}` : ""}</span>
                    <button type="button" className="av-lida" onClick={() => marcar(i, false)}>Desfazer</button>
                  </>
                ) : (
                  <button type="button" className="av-lida" onClick={() => marcar(i, true)}>Marcar como atendido</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {paginas > 1 ? (
        <div className="au-paginas">
          <Button as="button" type="button" variant="ghost" className="dl-btn--sm" arrow={false} disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</Button>
          <span className="dl-mono">página {pagina} de {paginas}</span>
          <Button as="button" type="button" variant="ghost" className="dl-btn--sm" arrow={false} disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}>Próxima</Button>
        </div>
      ) : null}
    </>
  );
}

// Reaproveita as linhas da aba Avaliações (`av-*`); aqui só o que é desta.
export const INTERESSADOS_CSS = `
.it-contato { margin: 8px 0 0; font-size: 13px; color: var(--subtle); }
.it-contato a { color: var(--accent-soft); }
.it-acoes { display: flex; align-items: center; gap: 12px; margin-top: 8px; }
`;

export default AdminInteressadosPage;
