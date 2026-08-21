import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api } from "../api";
import { ROTULO_ENTIDADE } from "../utils/rotulosDeImportacao";
import { useConfirm } from "./ConfirmModal";

/* ────────────────────────────────────────────────────────────────────────────
   Importar dados de outra plataforma — por feed ou por API.

   ── O QUE SAIU, E POR QUÊ ──

   Era por PLANILHA: a pessoa exportava um arquivo do sistema antigo, subia
   aqui, e respondia quarenta vezes "esta coluna é o título?". Funcionava, e
   tinha dois defeitos que só apareciam depois de a migração acabar.

   O pareamento errado só era percebido com quinhentos imóveis já dentro. E a
   planilha é uma FOTO: no dia seguinte estava velha, e sincronizar de novo
   significava exportar, parear e conferir tudo outra vez — o trabalho inteiro,
   toda vez.

   Um feed não tem nenhum dos dois problemas. O formato já diz o que cada campo
   é, então não existe o que parear nem como parear errado; e o mesmo endereço,
   lido amanhã, traz o acervo de amanhã.

   ── OS DOIS CAMINHOS, E QUEM USA CADA UM ──

   PUXAR de uma URL é o que a imobiliária faz sozinha: pede o link do feed ao
   fornecedor antigo e cola aqui. É o caminho da migração real, porque VRSync é
   o formato que os portais consomem e que praticamente todo sistema
   imobiliário do Brasil sabe exportar.

   RECEBER na nossa API é o que o outro lado faz: com a chave do tenant, um
   integrador manda os dados para cá. É o único caminho para clientes e equipe,
   que nenhum XML imobiliário descreve — VRSync só tem imóvel.

   ── A PRÉVIA NÃO É ENFEITE ──

   Ela é o único momento em que dá para perceber que o feed aponta para a filial
   errada antes de o acervo dela entrar. Por isso a leitura e a gravação são
   duas ações separadas, e a primeira não escreve nada.
   ──────────────────────────────────────────────────────────────────────────── */

/* Sobre o que cada entidade pode escrever. Mesmas permissões que o back cobra:
   trazer quinhentos imóveis é a mesma decisão que cadastrar quinhentos imóveis,
   só que mais rápida. */
const PERMISSAO = {
  imoveis: "gerenciarImoveis",
  clientes: "gerenciarClientes",
  usuarios: "gerenciarUsuarios",
};

const AJUDA = {
  imoveis: "Entram como rascunho, com as fotos copiadas para cá. Você publica quando quiser.",
  clientes: "Nomes, contatos e documentos da sua carteira.",
  usuarios: "Cada pessoa recebe uma senha provisória e troca no primeiro acesso.",
};

/* Onde cada entidade pode nascer. Imóveis têm um padrão de mercado; clientes e
   equipe não têm nenhum, e dizer isso na tela evita a pessoa procurar um campo
   de URL que não faria sentido existir. */
const FONTES = {
  imoveis: ["url", "api"],
  clientes: ["api"],
  usuarios: ["api"],
};

/** Quem pode importar ao menos um tipo de dado. A seção só existe para eles. */
export function podeImportar(cargo) {
  return Object.values(PERMISSAO).some((p) => cargo?.[p]);
}

const bloco = {
  background: "var(--sup-02, rgba(255,255,255,0.02))",
  border: "1px solid var(--linha-07, rgba(255,255,255,0.07))",
  borderRadius: "14px",
  padding: "16px 18px",
};

const NOME_DO_FORMATO = {
  vrsync: "VRSync (padrão dos portais)",
  omnimob: "XML da Omnimob",
  json: "JSON",
};

export function ImportadorDados({ session }) {
  const tenantSlug = session?.tenant?.slug;
  const cargo = session?.usuario?.cargo;
  const showToast = useOutletContext()?.showToast;

  const disponiveis = useMemo(
    () => Object.keys(PERMISSAO).filter((e) => cargo?.[PERMISSAO[e]]),
    [cargo],
  );

  const [entidade, setEntidade] = useState(null);
  const [url, setUrl] = useState("");
  const [previa, setPrevia] = useState(null);   // { formato, total, amostra, semIdentificador }
  const [lendo, setLendo] = useState(false);
  const [importando, setImportando] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState(null);
  const [referencias, setReferencias] = useState({ tipos: [], cargos: [] });

  /* As fontes guardadas — o endereço salvo para ser lido de novo. É o que
     separa "importei uma vez" de "está integrado". */
  const { confirm, modal: confirmModal } = useConfirm();
  const [fontesGuardadas, setFontesGuardadas] = useState([]);
  const [salvarFonte, setSalvarFonte] = useState(false);
  const [nomeFonte, setNomeFonte] = useState("");
  const [desativarAusentes, setDesativarAusentes] = useState(false);
  const [sincronizando, setSincronizando] = useState("");

  useEffect(() => {
    if (disponiveis.length === 1 && !entidade) setEntidade(disponiveis[0]);
  }, [disponiveis, entidade]);

  useEffect(() => {
    if (!entidade || !tenantSlug) return;
    api.importacaoReferencias(tenantSlug).then(setReferencias).catch(() => {});
  }, [entidade, tenantSlug]);

  useEffect(() => {
    if (!tenantSlug) return;
    api.listarFontes(tenantSlug).then((r) => setFontesGuardadas(r.fontes || [])).catch(() => {});
  }, [tenantSlug]);

  /* Trocar de entidade zera tudo. Sem isso, a prévia de imóveis continuaria na
     tela embaixo do seletor de clientes — e o botão de importar gravaria a
     coisa certa no lugar errado. */
  function escolher(proxima) {
    setEntidade(proxima);
    setUrl(""); setPrevia(null); setErro(""); setResultado(null);
  }

  async function conferir(e) {
    e?.preventDefault();
    if (!url.trim()) { setErro("Cole o endereço do feed."); return; }
    setLendo(true); setErro(""); setPrevia(null); setResultado(null);
    try {
      setPrevia(await api.importacaoPrevia(tenantSlug, { entidade, url: url.trim() }));
    } catch (err) {
      setErro(err.message);
    } finally {
      setLendo(false);
    }
  }

  async function importar() {
    setImportando(true); setErro("");
    try {
      const r = await api.importacaoExecutar(tenantSlug, { entidade, url: url.trim() });
      setResultado(r);
      showToast?.(
        `${r.criados} ${ROTULO_ENTIDADE[entidade].toLowerCase()} criados, ${r.atualizados} atualizados.`,
      );

      /* Guardar a fonte é opcional e acontece DEPOIS de a importação dar certo.
         Salvar antes deixaria na tela uma fonte que nunca leu nada, e o
         problema só apareceria na primeira sincronização automática — de
         madrugada, sem ninguém olhando. */
      if (salvarFonte) {
        const nova = await api.criarFonte(tenantSlug, {
          entidade, url: url.trim(), nome: nomeFonte, desativarAusentes,
        });
        setFontesGuardadas((prev) => [nova.fonte, ...prev]);
        setSalvarFonte(false);
        setNomeFonte("");
      }
    } catch (err) {
      setErro(err.message);
    } finally {
      setImportando(false);
    }
  }

  async function sincronizarAgora(fonte) {
    setSincronizando(fonte.id);
    try {
      const r = await api.sincronizarFonte(tenantSlug, fonte.id);
      const rel = r.relatorio;
      showToast?.(
        `${rel.criados} criados, ${rel.atualizados} atualizados` +
          (rel.desativados ? `, ${rel.desativados} desativados.` : "."),
      );
      const lista = await api.listarFontes(tenantSlug);
      setFontesGuardadas(lista.fontes || []);
    } catch (err) {
      showToast?.(err.message, "error");
      // Relê mesmo na falha: o relatório de erro fica guardado na fonte.
      api.listarFontes(tenantSlug).then((l) => setFontesGuardadas(l.fontes || [])).catch(() => {});
    } finally {
      setSincronizando("");
    }
  }

  async function alternarFonte(fonte) {
    try {
      const r = await api.atualizarFonte(tenantSlug, fonte.id, { ativa: !fonte.ativa });
      setFontesGuardadas((prev) => prev.map((f) => (f.id === fonte.id ? r.fonte : f)));
    } catch (err) {
      showToast?.(err.message, "error");
    }
  }

  async function alternarAusentes(fonte) {
    /* Ligar isto é o que autoriza a sincronização a DESATIVAR imóveis. Vale uma
       confirmação, porque o efeito acontece sozinho depois — e quem liga hoje
       pode não estar por perto quando a primeira leitura vazia chegar. */
    if (!fonte.desativarAusentes) {
      const ok = await confirm(
        "A partir de agora, imóvel que sumir deste feed será DESATIVADO aqui automaticamente. Ele sai da vitrine e dos portais, mas não é apagado — o histórico de leads e vendas fica, e você pode reativar pelo painel. Uma leitura que volte vazia é ignorada, para um feed quebrado não derrubar o acervo inteiro.",
        "Ligar",
        "primary",
      );
      if (!ok) return;
    }
    try {
      const r = await api.atualizarFonte(tenantSlug, fonte.id, { desativarAusentes: !fonte.desativarAusentes });
      setFontesGuardadas((prev) => prev.map((f) => (f.id === fonte.id ? r.fonte : f)));
    } catch (err) {
      showToast?.(err.message, "error");
    }
  }

  async function removerFonte(fonte) {
    const ok = await confirm(
      `Remover a fonte "${fonte.nome}"? Os registros já importados continuam aqui — o que acaba é a ligação com o endereço.`,
      "Remover",
      "danger",
    );
    if (!ok) return;
    try {
      await api.removerFonte(tenantSlug, fonte.id);
      setFontesGuardadas((prev) => prev.filter((f) => f.id !== fonte.id));
      showToast?.("Fonte removida.");
    } catch (err) {
      showToast?.(err.message, "error");
    }
  }

  if (!disponiveis.length) return null;

  const fontes = entidade ? FONTES[entidade] : [];
  const colunasDaAmostra = previa?.amostra?.length
    ? [...new Set(previa.amostra.flatMap((l) => Object.keys(l)))]
        .filter((c) => c !== "__linha" && c !== "fotos")
        .slice(0, 6)
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {confirmModal}

      {/* ── Fontes guardadas ───────────────────────────────────────────────────
          Vem primeiro porque, depois da primeira migração, é a única parte
          desta seção que alguém abre de novo. Quem já integrou não quer o
          formulário de colar URL — quer ver quando foi a última leitura. */}
      {fontesGuardadas.length ? (
        <div style={bloco}>
          <h4 className="api-titulo">Fontes conectadas</h4>
          <p className="api-ajuda">
            Endereços guardados. Sincronize quando quiser — e, com{" "}
            <code>SINCRONIZACAO_AUTOMATICA</code> ligada no servidor, de hora em hora sozinho.
          </p>
          <div className="api-lista">
            {fontesGuardadas.map((f) => {
              const rel = f.ultimoResultado;
              return (
                <div key={f.id} className={`api-chave${f.ativa ? "" : " is-revogada"}`}>
                  <div className="api-chave__topo">
                    <strong>{f.nome}</strong>
                    <em className="imp-fonte__entidade">{ROTULO_ENTIDADE[f.entidade]}</em>
                    {!f.ativa ? <span className="api-chave__selo">Pausada</span> : null}
                  </div>
                  <div className="api-chave__meta">
                    <span style={{ wordBreak: "break-all" }}>{f.url}</span>
                  </div>
                  <div className="api-chave__meta">
                    {/* O relatório da última leitura mora na própria fonte, e
                        é ele que responde "está funcionando?" sem refazer o
                        trabalho para descobrir. */}
                    {!f.ultimaSync ? (
                      <span>Nunca sincronizada</span>
                    ) : rel?.ok ? (
                      <span>
                        {new Date(f.ultimaSync).toLocaleString("pt-BR")} · {rel.criados} criados,{" "}
                        {rel.atualizados} atualizados
                        {rel.desativados ? `, ${rel.desativados} desativados` : ""}
                        {rel.totalErros ? ` · ${rel.totalErros} com problema` : ""}
                      </span>
                    ) : (
                      <span style={{ color: "#fca5a5" }}>
                        {new Date(f.ultimaSync).toLocaleString("pt-BR")} · falhou: {rel?.erro}
                      </span>
                    )}
                  </div>
                  {rel?.feedVazio ? (
                    <p className="imp-aviso" style={{ marginTop: "8px" }}>
                      A última leitura voltou vazia, então nada foi desativado. Confira se o endereço
                      ainda publica o acervo.
                    </p>
                  ) : null}

                  <div className="api-hook__acoes">
                    <button type="button" onClick={() => sincronizarAgora(f)} disabled={sincronizando === f.id}>
                      {sincronizando === f.id ? "Sincronizando…" : "Sincronizar agora"}
                    </button>
                    <button type="button" onClick={() => alternarFonte(f)}>
                      {f.ativa ? "Pausar" : "Retomar"}
                    </button>
                    {f.entidade === "imoveis" ? (
                      <button type="button" onClick={() => alternarAusentes(f)}>
                        {f.desativarAusentes ? "✓ Desativa os ausentes" : "Desativar os ausentes"}
                      </button>
                    ) : null}
                    <button type="button" className="is-perigo" onClick={() => removerFonte(f)}>Remover</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* ── O que importar ─────────────────────────────────────────────────── */}
      <div style={bloco}>
        <h4 className="api-titulo">O que você quer trazer?</h4>
        <div className="imp-entidades">
          {disponiveis.map((e) => (
            <button
              key={e}
              type="button"
              className={`imp-entidade${entidade === e ? " is-ativa" : ""}`}
              onClick={() => escolher(e)}
            >
              <strong>{ROTULO_ENTIDADE[e]}</strong>
              <small>{AJUDA[e]}</small>
            </button>
          ))}
        </div>
      </div>

      {entidade ? (
        <>
          {/* ── Por URL ────────────────────────────────────────────────────── */}
          {fontes.includes("url") ? (
            <div style={bloco}>
              <h4 className="api-titulo">Puxar de um feed</h4>
              <p className="api-ajuda">
                Peça ao seu sistema atual o <strong>link do feed XML</strong> — é o mesmo endereço
                que ele usa para publicar no ZAP e no VivaReal. Aceitamos VRSync, o XML da Omnimob
                e JSON.
              </p>

              <form onSubmit={conferir} className="imp-url">
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://sistemaantigo.com.br/feed/imoveis.xml"
                  inputMode="url"
                  disabled={lendo || importando}
                />
                <button type="submit" disabled={lendo || importando} style={{ width: "auto", padding: "10px 18px" }}>
                  {lendo ? "Lendo…" : "Conferir"}
                </button>
              </form>

              {erro ? <div className="error" style={{ marginTop: "12px" }}>{erro}</div> : null}

              {/* ── Prévia ───────────────────────────────────────────────── */}
              {previa ? (
                <div className="imp-previa">
                  <div className="imp-previa__resumo">
                    <span><strong>{previa.total}</strong> {ROTULO_ENTIDADE[entidade].toLowerCase()} encontrados</span>
                    <span className="imp-previa__formato">{NOME_DO_FORMATO[previa.formato] || previa.formato}</span>
                  </div>

                  {/* Reimportar é a norma, não a exceção: a primeira tentativa
                      quase sempre aponta para o feed errado. Sem código de
                      origem não há como casar, e a segunda rodada duplicaria
                      tudo — dizer isso ANTES é o ponto inteiro da prévia. */}
                  {previa.semIdentificador > 0 ? (
                    <p className="imp-aviso">
                      {previa.semIdentificador === previa.total
                        ? "Nenhum registro traz código de origem. Se você importar de novo, eles serão duplicados em vez de atualizados."
                        : `${previa.semIdentificador} registros vêm sem código de origem e serão duplicados numa reimportação.`}
                    </p>
                  ) : (
                    <p className="imp-ok">
                      Todos trazem código de origem — importar de novo atualiza o que já está aqui,
                      sem duplicar.
                    </p>
                  )}

                  {colunasDaAmostra.length ? (
                    <div className="imp-tabela-rolagem">
                      <table className="imp-tabela">
                        <thead>
                          <tr>{colunasDaAmostra.map((c) => <th key={c}>{c}</th>)}</tr>
                        </thead>
                        <tbody>
                          {previa.amostra.map((linha, i) => (
                            <tr key={i}>
                              {colunasDaAmostra.map((c) => (
                                <td key={c} title={String(linha[c] ?? "")}>{String(linha[c] ?? "")}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}

                  {entidade === "imoveis" && referencias.tipos?.length === 0 ? (
                    <p className="imp-aviso">
                      Você ainda não tem tipos de imóvel cadastrados. Os que vierem no feed serão
                      criados automaticamente.
                    </p>
                  ) : null}

                  {/* Guardar o endereço é o que transforma esta importação em
                      integração. Oferecido AQUI, junto do botão que importa,
                      porque é o momento em que a pessoa já sabe que o feed está
                      certo — perguntar antes seria pedir um compromisso sobre
                      um endereço que ela ainda não viu funcionar. */}
                  <label className="imp-guardar">
                    <input
                      type="checkbox"
                      checked={salvarFonte}
                      onChange={(e) => setSalvarFonte(e.target.checked)}
                      disabled={importando}
                    />
                    <span>
                      <strong>Guardar este endereço</strong>
                      <small>Para reimportar depois com um clique, sem colar a URL de novo.</small>
                    </span>
                  </label>

                  {salvarFonte ? (
                    <div className="imp-guardar__campos">
                      <input
                        value={nomeFonte}
                        onChange={(e) => setNomeFonte(e.target.value)}
                        placeholder="Nome — ex: Sistema anterior"
                        maxLength={60}
                      />
                      {entidade === "imoveis" ? (
                        <label>
                          <input
                            type="checkbox"
                            checked={desativarAusentes}
                            onChange={(e) => setDesativarAusentes(e.target.checked)}
                          />
                          Desativar aqui o imóvel que sumir de lá
                        </label>
                      ) : null}
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={importar}
                    disabled={importando || !previa.total}
                    style={{ width: "auto", padding: "11px 22px", marginTop: "14px" }}
                  >
                    {importando ? "Importando…" : `Importar ${previa.total} registros`}
                  </button>
                </div>
              ) : null}

              {/* ── Resultado ─────────────────────────────────────────────── */}
              {resultado ? (
                <div className="imp-resultado">
                  <div className="imp-numeros">
                    <span><strong>{resultado.criados}</strong> criados</span>
                    <span><strong>{resultado.atualizados}</strong> atualizados</span>
                    {entidade === "imoveis" ? <span><strong>{resultado.fotos}</strong> fotos</span> : null}
                    {resultado.erros?.length ? (
                      <span className="is-erro"><strong>{resultado.erros.length}</strong> com problema</span>
                    ) : null}
                  </div>

                  {/* O que aconteceu com as fotos. Silêncio aqui seria a pior
                      resposta: sem cópia, os imóveis entram apontando para o
                      servidor do sistema antigo, e a vitrine fica sem imagem no
                      dia em que a imobiliária cancelar aquele contrato. */}
                  {resultado.copiaDeFotos?.indisponivel ? (
                    <p className="imp-aviso">
                      As fotos não foram copiadas para cá — a conta de imagens não está configurada
                      neste ambiente. Os imóveis entraram sem foto. Fale com o suporte antes de
                      publicá-los.
                    </p>
                  ) : resultado.copiaDeFotos?.falhas > 0 ? (
                    <p className="imp-aviso">
                      {resultado.copiaDeFotos.falhas} fotos não puderam ser copiadas e ficaram de
                      fora. Os imóveis entraram com as demais.
                    </p>
                  ) : null}

                  {/* Os erros vêm com o número da linha e o motivo. Mostramos os
                      primeiros: uma lista de trezentos motivos iguais não ajuda
                      ninguém, e o padrão aparece nos primeiros. */}
                  {resultado.erros?.length ? (
                    <ul className="imp-erros">
                      {resultado.erros.slice(0, 10).map((e, i) => (
                        <li key={i}>Linha {e.linha}: {e.motivo}</li>
                      ))}
                      {resultado.erros.length > 10 ? (
                        <li className="is-resto">e mais {resultado.erros.length - 10}…</li>
                      ) : null}
                    </ul>
                  ) : null}

                  {/* Senhas provisórias só existem na resposta desta importação
                      — não são recuperáveis depois, pelo mesmo motivo da chave
                      de API. Quem fechar sem copiar redefine pela tela. */}
                  {resultado.senhas?.length ? (
                    <div className="imp-senhas">
                      <strong>Senhas provisórias</strong>
                      <p>Anote agora: elas não aparecem de novo. Cada pessoa troca no primeiro acesso.</p>
                      <ul>
                        {resultado.senhas.map((s) => <li key={s.login}><code>{s.login}</code> · {s.senha}</li>)}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* ── Pela API ───────────────────────────────────────────────────── */}
          <div style={bloco}>
            <h4 className="api-titulo">Receber pela API</h4>
            {fontes.includes("url") ? (
              <p className="api-ajuda">
                Se o seu sistema atual não publica um feed, o outro lado pode enviar os dados para
                cá com uma chave da API.
              </p>
            ) : (
              /* Ser explícito sobre a ausência é melhor que deixar a pessoa
                 procurar um campo de URL: não existe padrão de mercado para
                 carteira de clientes nem para equipe, e nós não inventamos um. */
              <p className="api-ajuda">
                {ROTULO_ENTIDADE[entidade]} não têm um formato de feed padronizado no mercado —
                nenhum XML imobiliário os descreve. Por isso este é o caminho: quem tem os dados
                envia para a nossa API.
              </p>
            )}
            <div className="imp-endpoint">
              <span className="api-metodo is-post">POST</span>
              <code>/api/v1/{entidade}</code>
            </div>
            <p className="api-ajuda" style={{ marginTop: "10px" }}>
              Aceita JSON e XML. Registros com o mesmo <code>origemExterna</code> são atualizados em
              vez de duplicados, então a integração pode rodar de hora em hora sem acumular lixo.
              Gere a chave logo acima, em <strong>Disponibilizar dados</strong>.
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
