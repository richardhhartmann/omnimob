import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api } from "../api";
import { useConfirm } from "./ConfirmModal";
import { IconeCheck, IconeX } from "./Icones.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   Disponibilizar os dados da imobiliária para outras plataformas.

   Até aqui, tirar dado do Omnimob era o feed VRSync: público, só de leitura e
   só de imóveis. Quem quisesse levar a carteira para um CRM, alimentar um site
   próprio ou manter dois sistemas em dia não tinha caminho — e "os dados são
   meus" é uma pergunta que toda imobiliária faz antes de assinar.

   A tela tem duas metades e uma regra:

     ENDEREÇOS  o que existe para ler, com o link pronto para copiar. Aparece
                antes das chaves porque é o que responde "o que dá para fazer?",
                e a chave só faz sentido depois dessa resposta.

     CHAVES     o crachá de cada integração. Uma por sistema, com escopos
                próprios, revogável sozinha.

   ── A REGRA: A CHAVE APARECE UMA VEZ ──

   O banco guarda o hash. O texto integral existe no corpo de uma única
   resposta, e some quando a pessoa fecha o aviso. Isso não é rigor de
   segurança abstrato: uma chave com `clientes:ler` exporta a carteira inteira
   com CPF e telefone, e um dump do banco não pode virar isso.

   Por isso o aviso de chave nova é grande, tem botão de copiar e não fecha
   sozinho. Quem perder gera outra — o custo é um clique, e o desenho da tela
   precisa deixar isso óbvio antes, não depois.
   ──────────────────────────────────────────────────────────────────────────── */

const bloco = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: "14px",
  padding: "16px 18px",
};

/* A base da API, da mesma fonte que o resto do cliente HTTP usa. Cravar
   "api.omnimob.app" aqui daria um endereço que não funciona em desenvolvimento
   e um endereço errado no dia em que a API mudar de casa. */
const BASE = (import.meta.env.VITE_API_URL || "https://api.omnimob.app").replace(/\/+$/, "");

/** Endereço + o que ele devolve. Um lugar só; a tela desenha a partir daqui. */
function endpointsDe(slug) {
  return [
    {
      grupo: "Imóveis",
      itens: [
        { metodo: "GET", caminho: "/api/v1/imoveis", desc: "Acervo paginado. `?desde=` traz só o que mudou; `?cursor=` é o certo para varrer tudo.", escopo: "imoveis:ler" },
        { metodo: "GET", caminho: "/api/v1/imoveis/{id}", desc: "Um imóvel específico.", escopo: "imoveis:ler" },
        { metodo: "GET", caminho: "/api/v1/imoveis/feed.xml", desc: "O acervo em VRSync, autenticado — inclusive rascunhos, com `?status=`.", escopo: "imoveis:ler" },
        { metodo: "POST", caminho: "/api/v1/imoveis", desc: "Cria ou atualiza em lote. Aceita JSON e XML; casa pelo código de origem.", escopo: "imoveis:escrever" },
        { metodo: "PUT", caminho: "/api/v1/imoveis/{id}", desc: "Atualiza um só, sem remontar o lote.", escopo: "imoveis:escrever" },
        { metodo: "DELETE", caminho: "/api/v1/imoveis/{id}", desc: "Desativa (não apaga): sai da vitrine e dos portais, o histórico fica.", escopo: "imoveis:escrever" },
      ],
    },
    {
      grupo: "Clientes e equipe",
      itens: [
        { metodo: "GET", caminho: "/api/v1/clientes", desc: "A carteira, com documento e contato.", escopo: "clientes:ler" },
        { metodo: "GET", caminho: "/api/v1/clientes/{id}", desc: "Um cliente específico.", escopo: "clientes:ler" },
        { metodo: "POST", caminho: "/api/v1/clientes", desc: "Cria ou atualiza clientes.", escopo: "clientes:escrever" },
        { metodo: "GET", caminho: "/api/v1/usuarios", desc: "A equipe. Nunca inclui senha.", escopo: "usuarios:ler" },
        { metodo: "POST", caminho: "/api/v1/usuarios", desc: "Cria ou atualiza usuários.", escopo: "usuarios:escrever" },
      ],
    },
    {
      grupo: "Leads",
      itens: [
        { metodo: "GET", caminho: "/api/v1/leads", desc: "Contatos recebidos, com o imóvel de origem. `?desde=` traz só os novos.", escopo: "leads:ler" },
        { metodo: "POST", caminho: "/api/v1/leads", desc: "Registra um lead vindo de fora — o formulário do seu site manda para cá.", escopo: "leads:escrever" },
      ],
    },
    {
      grupo: "Sem chave",
      itens: [
        {
          metodo: "GET",
          caminho: `/public/${slug}/feed.xml`,
          desc: "O feed VRSync público — é este que você cadastra no ZAP, no VivaReal e na OLX. Só imóveis ativos marcados para publicar.",
          escopo: null,
        },
        {
          metodo: "GET",
          caminho: "/api/v1/openapi.json",
          desc: "A especificação da API. Cole no Postman ou no Insomnia e as chamadas vêm prontas.",
          escopo: null,
        },
      ],
    },
  ];
}

function BotaoCopiar({ texto, rotulo = "Copiar" }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      className="api-copiar"
      onClick={() => {
        navigator.clipboard?.writeText(texto).then(
          () => { setCopiado(true); setTimeout(() => setCopiado(false), 1800); },
          () => {},
        );
      }}
    >
      {copiado ? <><IconeCheck size={12} /> Copiado</> : rotulo}
    </button>
  );
}

function formatarData(valor) {
  if (!valor) return "";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function ApiDoTenant({ session }) {
  const tenantSlug = session?.tenant?.slug || "";
  const showToast = useOutletContext()?.showToast;
  const { confirm, modal: confirmModal } = useConfirm();

  const [escopos, setEscopos] = useState([]);
  const [chaves, setChaves] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  // Webhooks e a exportação completa.
  const [eventos, setEventos] = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [criandoHook, setCriandoHook] = useState(false);
  const [urlHook, setUrlHook] = useState("");
  const [eventosHook, setEventosHook] = useState(() => new Set(["lead.criado"]));
  const [salvandoHook, setSalvandoHook] = useState(false);
  const [testando, setTestando] = useState("");
  const [baixando, setBaixando] = useState(false);

  // Formulário da chave nova.
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [marcados, setMarcados] = useState(() => new Set(["imoveis:ler"]));
  const [salvando, setSalvando] = useState(false);
  /* A chave recém-criada, em texto. Vive só neste estado — some ao recarregar,
     e é isso mesmo: ela não existe em lugar nenhum para ser buscada de volta. */
  const [novaChave, setNovaChave] = useState(null);

  useEffect(() => {
    if (!tenantSlug) return;
    let vivo = true;
    Promise.all([
      api.listarEscoposApi(tenantSlug),
      api.listarChavesApi(tenantSlug),
      /* Webhooks e eventos podem falhar por PLANO (Profissional+), e isso não é
         erro: a seção some e o resto da tela continua. Por isso o `catch`
         individual em vez de derrubar o `Promise.all` inteiro. */
      api.listarEventosWebhook(tenantSlug).catch(() => null),
      api.listarWebhooks(tenantSlug).catch(() => null),
    ])
      .then(([e, c, ev, wh]) => {
        if (!vivo) return;
        setEscopos(e.escopos || []);
        setChaves(c.chaves || []);
        setEventos(ev?.eventos || []);
        setWebhooks(wh?.webhooks || []);
      })
      .catch((err) => { if (vivo) setErro(err.message); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [tenantSlug]);

  const porGrupo = useMemo(() => {
    const mapa = new Map();
    for (const e of escopos) {
      if (!mapa.has(e.grupo)) mapa.set(e.grupo, []);
      mapa.get(e.grupo).push(e);
    }
    return [...mapa.entries()];
  }, [escopos]);

  const endpoints = useMemo(() => endpointsDe(tenantSlug), [tenantSlug]);

  function alternar(id) {
    setMarcados((prev) => {
      const proximo = new Set(prev);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }

  async function gerar(e) {
    e.preventDefault();
    if (!marcados.size) { setErro("Escolha ao menos uma permissão."); return; }
    setSalvando(true);
    setErro("");
    try {
      const r = await api.criarChaveApi(tenantSlug, { nome, escopos: [...marcados] });
      setChaves((prev) => [r.chave, ...prev]);
      setNovaChave(r.texto);
      setCriando(false);
      setNome("");
      setMarcados(new Set(["imoveis:ler"]));
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function baixarTudo() {
    setBaixando(true);
    setErro("");
    try {
      const bytes = await api.exportarTudo(tenantSlug);
      showToast?.(`Arquivo gerado (${(bytes / 1024 / 1024).toFixed(1)} MB).`);
    } catch (err) {
      setErro(err.message);
    } finally {
      setBaixando(false);
    }
  }

  function alternarEvento(id) {
    setEventosHook((prev) => {
      const proximo = new Set(prev);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }

  async function criarHook(e) {
    e.preventDefault();
    if (!eventosHook.size) { setErro("Escolha ao menos um evento."); return; }
    setSalvandoHook(true);
    setErro("");
    try {
      const r = await api.criarWebhook(tenantSlug, { url: urlHook.trim(), eventos: [...eventosHook] });
      setWebhooks((prev) => [r.webhook, ...prev]);
      setCriandoHook(false);
      setUrlHook("");
      setEventosHook(new Set(["lead.criado"]));
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvandoHook(false);
    }
  }

  async function testarHook(hook) {
    setTestando(hook.id);
    try {
      const r = await api.testarWebhook(tenantSlug, hook.id);
      showToast?.(
        r.ok ? "Entrega de teste aceita pelo seu endereço." : `O endereço recusou: ${r.ultimaFalha}`,
        r.ok ? "success" : "error",
      );
      // Relê para a tela mostrar o carimbo de último envio ou a falha nova.
      const lista = await api.listarWebhooks(tenantSlug);
      setWebhooks(lista.webhooks || []);
    } catch (err) {
      showToast?.(err.message, "error");
    } finally {
      setTestando("");
    }
  }

  async function alternarHook(hook) {
    try {
      const r = await api.atualizarWebhook(tenantSlug, hook.id, { ativo: !hook.ativo });
      setWebhooks((prev) => prev.map((w) => (w.id === hook.id ? r.webhook : w)));
    } catch (err) {
      showToast?.(err.message, "error");
    }
  }

  async function removerHook(hook) {
    const ok = await confirm(
      `Remover o webhook para ${hook.url}? O sistema do outro lado deixa de ser avisado imediatamente.`,
      "Remover",
      "danger",
    );
    if (!ok) return;
    try {
      await api.removerWebhook(tenantSlug, hook.id);
      setWebhooks((prev) => prev.filter((w) => w.id !== hook.id));
      showToast?.("Webhook removido.");
    } catch (err) {
      showToast?.(err.message, "error");
    }
  }

  async function revogar(chave) {
    /* Confirmação com o nome dentro, e o aviso do que quebra. Revogar é
       instantâneo e sem volta: a integração que usava a chave para de funcionar
       no próximo minuto, e quem clicou merece saber disso antes. */
    const ok = await confirm(
      `Revogar a chave "${chave.nome}"? Qualquer sistema que a esteja usando para de acessar seus dados imediatamente. Isso não pode ser desfeito — você precisará gerar uma chave nova e reconfigurar a integração.`,
      "Revogar chave",
      "danger",
    );
    if (!ok) return;
    try {
      const r = await api.revogarChaveApi(tenantSlug, chave.id);
      setChaves((prev) => prev.map((c) => (c.id === chave.id ? r.chave : c)));
      showToast?.(`Chave "${chave.nome}" revogada.`);
    } catch (err) {
      showToast?.(err.message, "error");
    }
  }

  const exemplo = `curl -H "Authorization: Bearer SUA_CHAVE" \\\n  ${BASE}/api/v1/imoveis`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {confirmModal}
      {erro ? <div className="error">{erro}</div> : null}

      {/* ── A chave nova, uma vez ─────────────────────────────────────────── */}
      {novaChave ? (
        <div className="api-nova">
          <div className="api-nova__cab">
            <strong>Guarde esta chave agora</strong>
            <button type="button" className="api-nova__fechar" onClick={() => setNovaChave(null)} title="Fechar">
              <IconeX size={13} />
            </button>
          </div>
          <p>
            Ela não aparece de novo. Guardamos só um resumo criptográfico — nem nós conseguimos
            recuperá-la. Se perder, é só gerar outra e revogar esta.
          </p>
          <div className="api-nova__valor">
            <code>{novaChave}</code>
            <BotaoCopiar texto={novaChave} rotulo="Copiar chave" />
          </div>
        </div>
      ) : null}

      {/* ── O que dá para ler ─────────────────────────────────────────────── */}
      <div style={bloco}>
        <h4 className="api-titulo">Endereços disponíveis</h4>
        <p className="api-ajuda">
          Base: <code>{BASE}</code>. As respostas saem em JSON por padrão; acrescente{" "}
          <code>?formato=xml</code> para receber XML.
        </p>

        {endpoints.map((g) => (
          <div key={g.grupo} className="api-grupo">
            <span className="api-grupo__nome">{g.grupo}</span>
            {g.itens.map((item) => (
              <div key={item.caminho + item.metodo} className="api-endpoint">
                <span className={`api-metodo is-${item.metodo.toLowerCase()}`}>{item.metodo}</span>
                <div className="api-endpoint__texto">
                  <code>{item.caminho}</code>
                  <small>{item.desc}</small>
                  {item.escopo ? <em className="api-escopo">{item.escopo}</em> : <em className="api-escopo is-livre">sem chave</em>}
                </div>
                <BotaoCopiar texto={`${BASE}${item.caminho}`} />
              </div>
            ))}
          </div>
        ))}

        <div className="api-exemplo">
          <span>Exemplo</span>
          <pre>{exemplo}</pre>
          <BotaoCopiar texto={exemplo} />
        </div>
      </div>

      {/* ── Chaves ────────────────────────────────────────────────────────── */}
      <div style={bloco}>
        <div className="api-cab-linha">
          <h4 className="api-titulo" style={{ margin: 0 }}>Chaves de acesso</h4>
          {!criando ? (
            <button type="button" className="button-secondary" style={{ width: "auto" }} onClick={() => setCriando(true)}>
              + Nova chave
            </button>
          ) : null}
        </div>
        <p className="api-ajuda">
          Uma chave por sistema conectado. Assim, revogar a de um não derruba os outros — e o
          registro de uso mostra qual ainda está viva.
        </p>

        {criando ? (
          <form onSubmit={gerar} className="api-form">
            <label>
              <span>Nome da integração</span>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Site próprio, CRM da equipe"
                maxLength={60}
              />
              <small>Só para você reconhecer depois qual chave é qual.</small>
            </label>

            <div className="api-escopos">
              <span className="api-escopos__titulo">O que esta chave pode fazer</span>
              {porGrupo.map(([grupo, itens]) => (
                <div key={grupo} className="api-escopos__grupo">
                  <span>{grupo}</span>
                  {itens.map((e) => (
                    <label key={e.id} className="api-escopo-item">
                      <input type="checkbox" checked={marcados.has(e.id)} onChange={() => alternar(e.id)} />
                      <span>
                        {e.rotulo}
                        {/* Marcar o que expõe dado pessoal. Quem monta uma
                            integração de vitrine não precisa de CPF de
                            ninguém, e o aviso é o que faz pensar antes. */}
                        {e.sensivel ? <em> · dado pessoal</em> : null}
                      </span>
                    </label>
                  ))}
                </div>
              ))}
            </div>

            <div className="actions">
              <button type="submit" disabled={salvando} style={{ width: "auto", padding: "10px 20px" }}>
                {salvando ? "Gerando…" : "Gerar chave"}
              </button>
              <button
                type="button"
                className="button-secondary"
                style={{ width: "auto", padding: "10px 20px" }}
                onClick={() => { setCriando(false); setErro(""); }}
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : null}

        {carregando ? (
          <p className="api-ajuda">Carregando…</p>
        ) : chaves.length === 0 ? (
          <p className="api-ajuda">Nenhuma chave criada ainda.</p>
        ) : (
          <div className="api-lista">
            {chaves.map((c) => (
              <div key={c.id} className={`api-chave${c.revogadaEm ? " is-revogada" : ""}`}>
                <div className="api-chave__topo">
                  <strong>{c.nome}</strong>
                  <code>{c.prefixo}…</code>
                  {c.revogadaEm ? <span className="api-chave__selo">Revogada</span> : null}
                </div>
                <div className="api-chave__meta">
                  <span>Criada em {formatarData(c.createdAt)}{c.criadaPor ? ` por ${c.criadaPor}` : ""}</span>
                  {/* "Nunca usada" é a informação que responde "posso revogar
                      esta sem quebrar nada?" — a pergunta real de quem olha
                      esta lista meses depois. */}
                  <span>{c.ultimoUso ? `Último uso em ${formatarData(c.ultimoUso)}` : "Nunca usada"}</span>
                </div>
                <div className="api-chave__escopos">
                  {c.escopos.map((e) => <em key={e}>{e}</em>)}
                </div>
                {!c.revogadaEm ? (
                  <button type="button" className="api-chave__revogar" onClick={() => revogar(c)}>
                    Revogar
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Webhooks ──────────────────────────────────────────────────────────
          O inverso do resto desta tela. Acima, o outro sistema vem buscar
          quando quiser; aqui somos nós que avisamos assim que acontece.

          A seção só existe se o servidor devolveu os eventos — ela é
          Profissional+, e quem está no Básico simplesmente não a vê. */}
      {eventos.length ? (
        <div style={bloco}>
          <div className="api-cab-linha">
            <h4 className="api-titulo" style={{ margin: 0 }}>Avisar quando acontecer</h4>
            {!criandoHook ? (
              <button type="button" className="button-secondary" style={{ width: "auto" }} onClick={() => setCriandoHook(true)}>
                + Novo webhook
              </button>
            ) : null}
          </div>
          <p className="api-ajuda">
            Em vez de o seu sistema ficar perguntando se chegou lead, nós avisamos no instante em que
            chega. Cada entrega vai assinada — confira o cabeçalho <code>X-Omnimob-Assinatura</code> com
            o segredo do webhook antes de aceitar.
          </p>

          {criandoHook ? (
            <form onSubmit={criarHook} className="api-form">
              <label>
                <span>Endereço que vai receber</span>
                <input
                  value={urlHook}
                  onChange={(e) => setUrlHook(e.target.value)}
                  placeholder="https://seusistema.com/webhooks/omnimob"
                  inputMode="url"
                />
                {/* HTTPS não é preciosismo: o corpo carrega nome, telefone e
                    mensagem de quem preencheu o formulário — dado de terceiro,
                    que não escolheu nada disso. */}
                <small>Precisa ser https: o aviso carrega dados de contato de quem procurou você.</small>
              </label>

              <div className="api-escopos">
                <span className="api-escopos__titulo">Quando avisar</span>
                {eventos.map((ev) => (
                  <label key={ev.id} className="api-escopo-item">
                    <input type="checkbox" checked={eventosHook.has(ev.id)} onChange={() => alternarEvento(ev.id)} />
                    <span>{ev.rotulo} <em style={{ color: "var(--text-muted)" }}>· {ev.desc}</em></span>
                  </label>
                ))}
              </div>

              <div className="actions">
                <button type="submit" disabled={salvandoHook} style={{ width: "auto", padding: "10px 20px" }}>
                  {salvandoHook ? "Criando…" : "Criar webhook"}
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  style={{ width: "auto", padding: "10px 20px" }}
                  onClick={() => { setCriandoHook(false); setErro(""); }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : null}

          {webhooks.length === 0 ? (
            <p className="api-ajuda">Nenhum webhook configurado.</p>
          ) : (
            <div className="api-lista">
              {webhooks.map((w) => (
                <div key={w.id} className={`api-chave${w.ativo ? "" : " is-revogada"}`}>
                  <div className="api-chave__topo">
                    <strong style={{ wordBreak: "break-all" }}>{w.url}</strong>
                    {!w.ativo ? <span className="api-chave__selo">Desligado</span> : null}
                  </div>
                  <div className="api-chave__meta">
                    <span>{w.ultimoEnvio ? `Última entrega em ${formatarData(w.ultimoEnvio)}` : "Nunca entregou"}</span>
                    {w.ultimaFalha ? <span style={{ color: "#fca5a5" }}>Falha: {w.ultimaFalha}</span> : null}
                  </div>
                  <div className="api-chave__escopos">
                    {w.eventos.map((e) => <em key={e}>{e}</em>)}
                  </div>

                  {/* O segredo continua visível, ao contrário da chave de API.
                      Não é descuido: quem recebe precisa dele para recalcular a
                      assinatura, e um segredo que só nós conhecemos não valida
                      nada. Mesmo arranjo do Stripe. */}
                  <div className="api-nova__valor" style={{ marginTop: "10px" }}>
                    <code>{w.segredo}</code>
                    <BotaoCopiar texto={w.segredo} rotulo="Copiar segredo" />
                  </div>

                  <div className="api-hook__acoes">
                    <button type="button" onClick={() => testarHook(w)} disabled={testando === w.id}>
                      {testando === w.id ? "Enviando…" : "Enviar teste"}
                    </button>
                    <button type="button" onClick={() => alternarHook(w)}>
                      {w.ativo ? "Desligar" : "Religar"}
                    </button>
                    <button type="button" className="is-perigo" onClick={() => removerHook(w)}>Remover</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* ── Levar tudo embora ─────────────────────────────────────────────────
          Fica no fim, e existe mesmo com a API logo acima. A API responde ao
          integrador; isto responde à imobiliária que está saindo e ao titular
          que pede portabilidade — gente que não vai abrir um terminal. */}
      <div style={bloco}>
        <h4 className="api-titulo">Baixar tudo de uma vez</h4>
        <p className="api-ajuda">
          Um arquivo com o acervo inteiro, a carteira de clientes, a equipe, os leads, as vendas e a
          configuração da vitrine. Sem chave, sem paginação. Senhas e credenciais de redes sociais
          ficam de fora, e as fotos vão como endereço.
        </p>
        <button type="button" onClick={baixarTudo} disabled={baixando} style={{ width: "auto", padding: "10px 20px" }}>
          {baixando ? "Gerando…" : "Baixar meus dados"}
        </button>
      </div>
    </div>
  );
}
