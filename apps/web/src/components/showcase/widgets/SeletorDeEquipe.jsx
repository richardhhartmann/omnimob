import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../../../api";

/* ────────────────────────────────────────────────────────────────────────────
   Quem aparece na vitrine — escolhido DENTRO do widget.

   Antes a equipe da vitrine saía de um opt-in no cadastro de cada usuário
   (`exibirNaVitrine`), e montar a seção era ir à tela de Usuários, abrir pessoa
   por pessoa e marcar uma caixa — sem nunca ver o resultado. Agora se monta
   olhando para a peça.

   ── ELE NÃO É DO EDITOR, MAS SÓ APARECE NELE ──

   Vive em `showcase/` porque é o widget que o desenha, e o widget é um só nas
   duas telas. Quem decide se ele existe é o MODO, lido do contexto pelo
   `TeamWidget` — o mesmo mecanismo do texto editável. Nenhuma peça daqui
   importa de `builder/`: seria a porta para o editor voltar a vazar para dentro
   da vitrine.

   ── A LISTA VEM DE UMA ROTA PRÓPRIA ──

   `GET /api/tenants/me/equipe-possivel`, e não `/api/usuarios`: aquela exige
   `gerenciarUsuarios`, e quem monta a vitrine tem `editarPagina`. Obrigar um a
   ter a permissão do outro daria a quem mexe no site o poder de criar e apagar
   contas.
   ──────────────────────────────────────────────────────────────────────────── */

function iniciais(nome) {
  return String(nome || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function SeletorDeEquipe({ tenantSlug, escolhidos, aoConfirmar, aoFechar }) {
  const [pessoas, setPessoas] = useState(null);
  const [erro, setErro] = useState("");
  const [selecao, setSelecao] = useState(() => escolhidos || []);

  useEffect(() => {
    let vivo = true;
    api.equipePossivel(tenantSlug)
      .then((lista) => { if (vivo) setPessoas(lista || []); })
      .catch((e) => { if (vivo) setErro(e.message || "Não consegui carregar a equipe."); });
    return () => { vivo = false; };
  }, [tenantSlug]);

  useEffect(() => {
    const aoTeclar = (e) => { if (e.key === "Escape") { e.preventDefault(); aoFechar(); } };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aoFechar]);

  /* Marcar acrescenta NO FIM: a ordem da lista é a ordem em que a vitrine
     mostra, e mexer nela por trás faria a pessoa reordenar sem querer. */
  const alternar = (id) => setSelecao((atual) => (
    atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]
  ));

  return createPortal(
    <div className="seq-veu" onMouseDown={(e) => { if (e.target === e.currentTarget) aoFechar(); }}>
      <div className="seq-caixa modal-cartao" role="dialog" aria-modal="true" aria-label="Escolher a equipe da vitrine">
        <header className="seq-topo">
          <h2>Quem aparece na vitrine</h2>
          <p>A ordem em que você marcar é a ordem em que eles aparecem na página.</p>
        </header>

        {erro ? <p className="seq-erro">{erro}</p> : null}
        {pessoas === null && !erro ? <p className="seq-vazio">Carregando…</p> : null}
        {pessoas?.length === 0 ? (
          <p className="seq-vazio">
            Não há usuários ativos nesta imobiliária além de você. Cadastre a equipe em Usuários
            e volte aqui.
          </p>
        ) : null}

        <ul className="seq-lista">
          {(pessoas || []).map((p) => {
            const marcado = selecao.includes(p.id);
            const posicao = selecao.indexOf(p.id) + 1;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  className={`seq-item${marcado ? " is-marcado" : ""}`}
                  onClick={() => alternar(p.id)}
                  aria-pressed={marcado}
                >
                  <span className="seq-avatar">
                    {p.foto ? <img src={p.foto} alt="" /> : <span>{iniciais(p.nome)}</span>}
                  </span>
                  <span className="seq-texto">
                    <strong>{p.nome}</strong>
                    <span>{p.cargo}{p.creci ? ` · ${p.creci}` : ""}</span>
                  </span>
                  {/* O número diz a POSIÇÃO, não só que está marcado: é o que
                      torna a ordem visível enquanto se escolhe. */}
                  <span className="seq-marca">{marcado ? posicao : "+"}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <footer className="seq-acoes">
          <span className="seq-conta">{selecao.length} na vitrine</span>
          <button type="button" className="editor-button" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="editor-button is-primary" onClick={() => aoConfirmar(selecao)}>
            Salvar equipe
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
