import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api } from "../api";
import { copiarUrlsParaCloudinary } from "../utils/uploadToCloudinary";
import { EXTENSOES_ACEITAS, lerPlanilha, normalizarTexto } from "../utils/planilha";
import {
  CAMPOS,
  ROTULO_ENTIDADE,
  aplicarMapeamento,
  conferirLinhas,
  palpitarMapeamento,
} from "../utils/mapeamentoImportacao";

/* ────────────────────────────────────────────────────────────────────────────
   Importar dados de outra plataforma.

   Mora dentro da aba "Dados" de Configurações. É conteúdo, não tela: quem
   monta o cabeçalho e a moldura é a página — por isso aqui não há
   `main-content` nem título de página, só os blocos do passo a passo.

   O caminho é arquivo → pareamento → prévia → importação. A prévia não é
   enfeite: é o único momento em que dá para perceber que "Valor" foi pareado
   com "Quartos" antes de quinhentos imóveis entrarem errados. Por isso ela fica
   junto do pareamento e se refaz a cada troca — conferir depois de importar já
   é tarde.

   A planilha inteira nunca vai para o servidor de uma vez; ver
   `importacaoService.js` no back para o porquê da divisão de trabalho.
   ──────────────────────────────────────────────────────────────────────────── */

const LINHAS_NA_PREVIA = 8;

/* Sobre o que cada aba pode escrever. Mesmas permissões que o back cobra em
   `importacaoRoutes.js`: trazer quinhentos imóveis é a mesma decisão que
   cadastrar quinhentos imóveis, só que mais rápida. */
const PERMISSAO = {
  clientes: "gerenciarClientes",
  imoveis: "gerenciarImoveis",
  usuarios: "gerenciarUsuarios",
};

const AJUDA = {
  clientes: "Nomes, contatos e documentos da sua carteira.",
  imoveis: "Entram como rascunho, com as fotos copiadas para cá. Você publica quando quiser.",
  usuarios: "Cada pessoa recebe uma senha provisória e troca no primeiro acesso.",
};

/** Quem pode importar ao menos um tipo de dado. A aba só existe para eles. */
export function podeImportar(cargo) {
  return Object.values(PERMISSAO).some((p) => cargo?.[p]);
}

// Bloco interno da seção. Discreto de propósito: já está dentro de um painel.
const bloco = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: "14px",
  padding: "16px 18px",
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
  const [planilha, setPlanilha] = useState(null);   // { abas, aba, colunas, linhas }
  const [arquivo, setArquivo] = useState(null);
  const [mapa, setMapa] = useState({});
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState("");
  const [andamento, setAndamento] = useState(null); // { fase, feitas, total }
  const [resultado, setResultado] = useState(null);
  const [referencias, setReferencias] = useState({ tipos: [], cargos: [] });
  const inputRef = useRef(null);

  useEffect(() => {
    if (!entidade || !tenantSlug) return;
    api.importacaoReferencias(tenantSlug).then(setReferencias).catch(() => {});
  }, [entidade, tenantSlug]);

  useEffect(() => {
    if (disponiveis.length === 1 && !entidade) setEntidade(disponiveis[0]);
  }, [disponiveis, entidade]);

  function recomecar() {
    setPlanilha(null); setArquivo(null); setMapa({}); setErro(""); setResultado(null); setAndamento(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function escolherArquivo(file, aba) {
    if (!file) return;
    setLendo(true); setErro(""); setResultado(null);
    try {
      const lida = await lerPlanilha(file, { aba });
      if (!lida.linhas.length) throw new Error("A planilha não tem nenhuma linha de dados.");
      setArquivo(file);
      setPlanilha(lida);
      setMapa(palpitarMapeamento(entidade, lida.colunas));
    } catch (e) {
      setErro(e.message);
      setPlanilha(null);
    } finally {
      setLendo(false);
    }
  }

  /* Uma coluna serve a um campo só. Sem isso "Contato" viraria telefone e
     WhatsApp ao mesmo tempo e ninguém notaria até ver o cadastro duplicado. */
  function parear(chaveCampo, chaveColuna) {
    setMapa((antes) => {
      const novo = { ...antes };
      if (!chaveColuna) { delete novo[chaveCampo]; return novo; }
      for (const [campo, col] of Object.entries(novo)) {
        if (campo !== chaveCampo && !Array.isArray(col) && col === chaveColuna) delete novo[campo];
      }
      novo[chaveCampo] = chaveColuna;
      return novo;
    });
  }

  function alternarColunaDeFotos(chaveColuna) {
    setMapa((antes) => {
      const atuais = Array.isArray(antes.fotos) ? antes.fotos : [];
      const novas = atuais.includes(chaveColuna)
        ? atuais.filter((c) => c !== chaveColuna)
        : [...atuais, chaveColuna];
      const novo = { ...antes };
      if (novas.length) novo.fotos = novas; else delete novo.fotos;
      return novo;
    });
  }

  const campos = entidade ? CAMPOS[entidade] : [];
  const linhasMapeadas = useMemo(
    () => (planilha && entidade ? aplicarMapeamento(entidade, planilha.linhas, mapa) : []),
    [planilha, entidade, mapa],
  );
  const problemas = useMemo(
    () => (entidade ? conferirLinhas(entidade, linhasMapeadas) : []),
    [entidade, linhasMapeadas],
  );

  const faltaObrigatorio = campos.filter((c) => c.obrigatorio && !mapa[c.chave]);
  const linhasValidas = linhasMapeadas.length - new Set(problemas.map((p) => p.linha)).size;

  /* Sem identificador, reimportar duplica. Vale avisar antes: quase toda
     primeira tentativa tem uma coluna pareada errado, e a pessoa vai rodar de
     novo — só que aí já é tarde para desfazer. */
  const semIdentificador = !mapa.origemExterna;

  const tiposNaoCasados = useMemo(() => {
    if (entidade !== "imoveis" || !mapa.tipoImovel) return [];
    const conhecidos = new Set(referencias.tipos.map((t) => normalizarTexto(t.descricao)));
    const vistos = new Set();
    for (const linha of linhasMapeadas) {
      const bruto = String(linha.tipoImovel ?? "").trim();
      if (bruto && !conhecidos.has(normalizarTexto(bruto))) vistos.add(bruto);
    }
    return [...vistos];
  }, [entidade, mapa.tipoImovel, linhasMapeadas, referencias.tipos]);

  const totalFotos = useMemo(() => {
    if (entidade !== "imoveis") return 0;
    return linhasMapeadas.reduce((soma, l) => soma + (l.fotos?.length || 0), 0);
  }, [entidade, linhasMapeadas]);

  async function importar() {
    setErro(""); setResultado(null);
    const acumulado = { criados: 0, atualizados: 0, fotos: 0, erros: [], senhas: [], fotosFalhas: [] };

    try {
      let linhas = linhasMapeadas;

      /* Fotos primeiro, e num passo separado: elas são a parte lenta, e uma
         falha de imagem não pode impedir o imóvel de entrar. Cada URL é copiada
         uma vez só, mesmo repetida em várias linhas. */
      if (entidade === "imoveis" && totalFotos > 0) {
        setAndamento({ fase: "fotos", feitas: 0, total: totalFotos });
        const todas = linhas.flatMap((l) => l.fotos || []);
        const { copiadas, falhas } = await copiarUrlsParaCloudinary(todas, {
          aoProgredir: (feitas, total) => setAndamento({ fase: "fotos", feitas, total }),
        });
        acumulado.fotosFalhas = falhas;
        linhas = linhas.map((l) => ({
          ...l,
          fotos: (l.fotos || []).map((u) => copiadas.get(u)).filter(Boolean),
        }));
      }

      const TAMANHO = referencias.loteMaximo || 200;
      setAndamento({ fase: "linhas", feitas: 0, total: linhas.length });

      for (let i = 0; i < linhas.length; i += TAMANHO) {
        const lote = linhas.slice(i, i + TAMANHO);
        const r = await api.importarLote(tenantSlug, entidade, lote);
        acumulado.criados += r.criados || 0;
        acumulado.atualizados += r.atualizados || 0;
        acumulado.fotos += r.fotos || 0;
        acumulado.erros.push(...(r.erros || []));
        acumulado.senhas.push(...(r.senhas || []));
        setAndamento({ fase: "linhas", feitas: Math.min(i + TAMANHO, linhas.length), total: linhas.length });
      }

      setResultado(acumulado);
      showToast?.(`${acumulado.criados} criados, ${acumulado.atualizados} atualizados.`);
    } catch (e) {
      setErro(e.message);
    } finally {
      setAndamento(null);
    }
  }

  function baixarSenhas() {
    /* As senhas só existem em texto neste instante — depois disto o banco tem
       apenas o hash. Se a pessoa fechar a aba sem anotar, não há como recuperar:
       só gerar de novo. Daí o arquivo. */
    const linhas = [["Nome", "Login", "Senha provisória"], ...resultado.senhas.map((s) => [s.nome, s.login, s.senha])];
    const csv = linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `senhas-provisorias-${tenantSlug}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!disponiveis.length) {
    return (
      <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.6 }}>
        Seu cargo não permite importar dados. Peça a um administrador.
      </p>
    );
  }

  return (
    <>
      {/* ── 1. O que importar ─────────────────────────────────────────────── */}
      <div style={bloco}>
        <Passo numero={1} titulo="O que você quer importar" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px", marginTop: "12px" }}>
          {disponiveis.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => { setEntidade(e); recomecar(); }}
              /* `display: block` é obrigatório aqui: o `button` global é
                 inline-flex centralizado, e sem isto o título e a descrição
                 viram dois itens de flex lado a lado em vez de empilhados. */
              style={{
                width: "auto", display: "block", textAlign: "left",
                padding: "13px 15px", borderRadius: "12px", cursor: "pointer",
                background: entidade === e ? "rgba(99,102,241,0.14)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${entidade === e ? "rgba(99,102,241,0.55)" : "rgba(255,255,255,0.08)"}`,
                boxShadow: "none", transform: "none",
              }}
            >
              <span style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>
                {ROTULO_ENTIDADE[e]}
              </span>
              {/* `fontWeight` explícito: o `button` global é 600, e sem isto a
                  descrição fica tão pesada quanto o título. */}
              <span style={{ display: "block", fontSize: "12px", fontWeight: 400, color: "var(--text-muted)", lineHeight: 1.5 }}>
                {AJUDA[e]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── 2. Arquivo ────────────────────────────────────────────────────── */}
      {entidade ? (
        <div style={bloco}>
          <Passo numero={2} titulo="Envie a planilha" />
          <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "8px 0 14px", lineHeight: 1.6 }}>
            Excel ou CSV, com a primeira linha sendo o cabeçalho. Não precisa arrumar nada antes:
            você diz na próxima etapa o que é cada coluna. O arquivo não sai do seu computador.
          </p>

          <input
            ref={inputRef}
            type="file"
            accept={EXTENSOES_ACEITAS}
            disabled={lendo || Boolean(andamento)}
            onChange={(ev) => escolherArquivo(ev.target.files?.[0])}
            style={{ fontSize: "13px" }}
          />

          {lendo ? <p style={{ fontSize: "13px", marginTop: "10px" }}>Lendo a planilha…</p> : null}

          {planilha ? (
            <div style={{ marginTop: "12px", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: "13px" }}>
                <strong>{planilha.linhas.length}</strong> linha{planilha.linhas.length === 1 ? "" : "s"} em{" "}
                <strong>{planilha.colunas.length}</strong> coluna{planilha.colunas.length === 1 ? "" : "s"}.
              </span>
              {planilha.abas.length > 1 ? (
                <label style={{ fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "8px" }}>
                  Aba:
                  <select
                    value={planilha.aba}
                    onChange={(ev) => escolherArquivo(arquivo, ev.target.value)}
                    style={{ width: "auto", padding: "6px 10px" }}
                  >
                    {planilha.abas.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}

          {erro ? <div className="error" style={{ marginTop: "12px" }}>{erro}</div> : null}
        </div>
      ) : null}

      {/* ── 3. Pareamento + prévia ────────────────────────────────────────── */}
      {planilha && !resultado ? (
        <>
          <div style={bloco}>
            <Passo numero={3} titulo="Diga o que é cada coluna" />
            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "8px 0 16px", lineHeight: 1.6 }}>
              Já chutamos pelo nome das colunas. Confira — principalmente os campos obrigatórios — e corrija o que estiver errado.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
              {campos.filter((c) => !c.multiplas).map((campo) => (
                <label key={campo.chave} style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600 }}>
                    {campo.rotulo}
                    {campo.obrigatorio ? <span style={{ color: "#f87171" }}> *</span> : null}
                  </span>
                  <select
                    value={mapa[campo.chave] || ""}
                    onChange={(ev) => parear(campo.chave, ev.target.value)}
                    style={{ width: "100%", padding: "8px 10px", fontSize: "13px" }}
                  >
                    <option value="">— não importar —</option>
                    {planilha.colunas.map((c) => (
                      <option key={c.chave} value={c.chave}>{c.rotulo}</option>
                    ))}
                  </select>
                  {campo.identificador ? (
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.5 }}>
                      O código do sistema antigo. Com ele, importar de novo corrige o que já veio em vez de duplicar.
                    </span>
                  ) : null}
                </label>
              ))}
            </div>

            {/* Fotos aceitam várias colunas: exportação costuma vir como
                "Foto 1", "Foto 2", "Foto 3" em vez de tudo numa célula só. */}
            {campos.some((c) => c.multiplas) ? (
              <div style={{ marginTop: "18px" }}>
                <span style={{ fontSize: "12px", fontWeight: 600 }}>Fotos (URL)</span>
                <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: "4px 0 10px", lineHeight: 1.5 }}>
                  Marque todas as colunas que tenham link de imagem. As fotos são copiadas para o nosso servidor —
                  assim elas continuam na sua vitrine mesmo depois de você desligar o sistema antigo.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {planilha.colunas.map((c) => {
                    const marcada = (mapa.fotos || []).includes(c.chave);
                    return (
                      <button
                        key={c.chave}
                        type="button"
                        onClick={() => alternarColunaDeFotos(c.chave)}
                        style={{
                          width: "auto", padding: "6px 12px", borderRadius: "8px", fontSize: "12px", cursor: "pointer",
                          background: marcada ? "rgba(16,185,129,0.16)" : "transparent",
                          border: `1px solid ${marcada ? "rgba(16,185,129,0.5)" : "rgba(255,255,255,0.1)"}`,
                          color: marcada ? "#4ade80" : "var(--text-muted)",
                          boxShadow: "none", transform: "none",
                        }}
                      >
                        {c.rotulo}
                      </button>
                    );
                  })}
                </div>
                {totalFotos > 0 ? (
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "10px" }}>
                    {totalFotos} foto{totalFotos === 1 ? "" : "s"} encontrada{totalFotos === 1 ? "" : "s"}. Copiar leva alguns minutos.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Prévia — o único momento de perceber um pareamento errado a tempo */}
          <div style={bloco}>
            <Passo numero={4} titulo="Confira antes de importar" />
            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "8px 0 14px" }}>
              As {Math.min(LINHAS_NA_PREVIA, linhasMapeadas.length)} primeiras linhas, já do jeito que vão entrar.
            </p>

            <div style={{ overflowX: "auto", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "12px", whiteSpace: "nowrap" }}>
                <thead>
                  <tr>
                    <th style={celulaCabecalho}>Linha</th>
                    {campos.filter((c) => mapa[c.chave]).map((c) => (
                      <th key={c.chave} style={celulaCabecalho}>{c.rotulo}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhasMapeadas.slice(0, LINHAS_NA_PREVIA).map((linha) => (
                    <tr key={linha.__linha}>
                      <td style={{ ...celula, color: "var(--text-muted)" }}>{linha.__linha}</td>
                      {campos.filter((c) => mapa[c.chave]).map((c) => {
                        const valor = linha[c.chave];
                        const vazio = valor == null || valor === "" || (Array.isArray(valor) && !valor.length);
                        return (
                          <td key={c.chave} style={{ ...celula, opacity: vazio ? 0.35 : 1 }}>
                            {Array.isArray(valor)
                              ? (valor.length ? `${valor.length} foto${valor.length === 1 ? "" : "s"}` : "—")
                              : (vazio ? "—" : String(valor).slice(0, 60))}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "14px" }}>
              {faltaObrigatorio.length ? (
                <Aviso tom="erro">
                  Falta parear: {faltaObrigatorio.map((c) => c.rotulo).join(", ")}. Sem isso a importação não roda.
                </Aviso>
              ) : null}

              {problemas.length ? (
                <Aviso tom="atencao">
                  {problemas.length} linha{problemas.length === 1 ? "" : "s"} com campo obrigatório em branco —
                  {" "}{[...new Set(problemas.map((p) => p.linha))].slice(0, 12).join(", ")}
                  {problemas.length > 12 ? "…" : ""}. Elas ficam de fora; o resto entra normalmente.
                </Aviso>
              ) : null}

              {tiposNaoCasados.length ? (
                <Aviso tom="atencao">
                  Estes tipos não existem no seu cadastro e os imóveis vão entrar sem tipo:{" "}
                  {tiposNaoCasados.slice(0, 8).join(", ")}{tiposNaoCasados.length > 8 ? "…" : ""}.
                  Cadastre-os em Tipos de imóvel antes, se quiser que casem.
                </Aviso>
              ) : null}

              {semIdentificador ? (
                <Aviso tom="atencao">
                  Nenhuma coluna pareada como código do sistema antigo. Se você importar este arquivo
                  duas vezes, os registros entram duplicados.
                </Aviso>
              ) : null}

              {entidade === "usuarios" ? (
                <Aviso tom="info">
                  Senhas não se importam. Cada pessoa nasce com uma senha provisória, que você recebe
                  aqui ao final e é obrigada a trocar no primeiro acesso.
                </Aviso>
              ) : null}

              {entidade === "imoveis" ? (
                <Aviso tom="info">
                  Os imóveis entram como rascunho, fora da vitrine. Você revisa e publica pela tela de imóveis.
                </Aviso>
              ) : null}
            </div>

            {andamento ? (
              <BarraDeProgresso
                rotulo={andamento.fase === "fotos" ? "Copiando fotos" : "Gravando"}
                feitas={andamento.feitas}
                total={andamento.total}
              />
            ) : (
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "18px" }}>
                <button
                  type="button"
                  onClick={importar}
                  disabled={Boolean(faltaObrigatorio.length) || linhasValidas <= 0}
                  style={{ width: "auto", padding: "10px 20px" }}
                >
                  Importar {linhasValidas} {ROTULO_ENTIDADE[entidade].toLowerCase()}
                </button>
                <button type="button" className="button-secondary" onClick={recomecar} style={{ width: "auto", padding: "10px 20px" }}>
                  Trocar arquivo
                </button>
              </div>
            )}

            {erro ? <div className="error" style={{ marginTop: "12px" }}>{erro}</div> : null}
          </div>
        </>
      ) : null}

      {/* ── 5. Resultado ──────────────────────────────────────────────────── */}
      {resultado ? (
        <div style={bloco}>
          <h4 style={{ margin: "0 0 14px", fontSize: "15px" }}>Importação concluída</h4>

          <div style={{ display: "flex", gap: "22px", flexWrap: "wrap", marginBottom: "16px" }}>
            <Numero valor={resultado.criados} rotulo="criados" cor="#10b981" />
            <Numero valor={resultado.atualizados} rotulo="atualizados" cor="#6366f1" />
            {entidade === "imoveis" ? <Numero valor={resultado.fotos} rotulo="fotos" cor="#0ea5e9" /> : null}
            {resultado.erros.length ? <Numero valor={resultado.erros.length} rotulo="recusados" cor="#f87171" /> : null}
          </div>

          {resultado.senhas.length ? (
            <div style={{ padding: "14px 16px", borderRadius: "10px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", marginBottom: "14px" }}>
              <p style={{ margin: "0 0 10px", fontSize: "13px", lineHeight: 1.6 }}>
                <strong>Anote as senhas provisórias agora.</strong> Elas existem em texto só nesta tela —
                depois de você sair, nem nós conseguimos recuperá-las, só gerar novas.
              </p>
              <button type="button" onClick={baixarSenhas} style={{ width: "auto", padding: "8px 16px", fontSize: "13px" }}>
                Baixar lista de senhas
              </button>
              <div style={{ maxHeight: "180px", overflowY: "auto", marginTop: "12px", fontSize: "12px", fontFamily: "monospace" }}>
                {resultado.senhas.map((s) => (
                  <div key={s.login} style={{ padding: "3px 0" }}>{s.login} — {s.senha}</div>
                ))}
              </div>
            </div>
          ) : null}

          {resultado.fotosFalhas?.length ? (
            <Aviso tom="atencao">
              {resultado.fotosFalhas.length} foto{resultado.fotosFalhas.length === 1 ? "" : "s"} não pôde ser copiada
              (link quebrado ou protegido). Os imóveis entraram; as imagens você adiciona pela tela de imóveis.
            </Aviso>
          ) : null}

          {resultado.erros.length ? (
            <div style={{ marginTop: "12px" }}>
              <p style={{ fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>Linhas que não entraram</p>
              <div style={{ maxHeight: "220px", overflowY: "auto", fontSize: "12px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px" }}>
                {resultado.erros.map((e, i) => (
                  <div key={`${e.linha}-${i}`} style={{ padding: "7px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <strong>Linha {e.linha}</strong> — {e.motivo}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div style={{ marginTop: "18px" }}>
            <button type="button" onClick={recomecar} style={{ width: "auto", padding: "10px 20px" }}>
              Importar outro arquivo
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

/* ─── Peças pequenas ───────────────────────────────────────────────────────── */

const celulaCabecalho = {
  padding: "9px 12px", textAlign: "left", fontSize: "11px", fontWeight: 600,
  textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const celula = { padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)" };

function Passo({ numero, titulo }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <span style={{
        width: "22px", height: "22px", borderRadius: "50%", display: "grid", placeItems: "center",
        background: "rgba(99,102,241,0.18)", color: "#a5b4fc", fontSize: "12px", fontWeight: 700, flexShrink: 0,
      }}>
        {numero}
      </span>
      <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>{titulo}</h4>
    </div>
  );
}

const TONS = {
  erro:     { fundo: "rgba(248,113,113,0.08)", borda: "rgba(248,113,113,0.32)" },
  atencao:  { fundo: "rgba(245,158,11,0.08)",  borda: "rgba(245,158,11,0.3)" },
  info:     { fundo: "rgba(99,102,241,0.07)",  borda: "rgba(99,102,241,0.26)" },
};

function Aviso({ tom = "info", children }) {
  const t = TONS[tom];
  return (
    <div style={{
      padding: "10px 14px", borderRadius: "9px", fontSize: "12px", lineHeight: 1.6,
      background: t.fundo, border: `1px solid ${t.borda}`,
    }}>
      {children}
    </div>
  );
}

function Numero({ valor, rotulo, cor }) {
  return (
    <div>
      <div style={{ fontSize: "26px", fontWeight: 700, color: cor, lineHeight: 1.1 }}>{valor}</div>
      <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{rotulo}</div>
    </div>
  );
}

function BarraDeProgresso({ rotulo, feitas, total }) {
  const pct = total ? Math.round((feitas / total) * 100) : 0;
  return (
    <div style={{ marginTop: "18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "6px" }}>
        <span>{rotulo}…</span>
        <span style={{ color: "var(--text-muted)" }}>{feitas} de {total}</span>
      </div>
      <div style={{ height: "6px", borderRadius: "3px", background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "#6366f1", transition: "width 0.25s ease" }} />
      </div>
    </div>
  );
}
