import { api } from "../api";
import { TEMAS } from "../utils/temaDoPainel";
import {
  LARGURA_DE_MONITOR_LARGO,
  aplicarLayoutCentrado,
  centradoNoAutomatico,
  layoutCentradoAtual,
  salvarLayoutCentrado,
} from "../utils/layoutCentrado";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  IdentificationBadge,
  Keyboard,
  Palette,
  Compass,
  Sun,
  Moon,
  CircleHalf,
  GoogleLogo,
  Buildings,
  X,
  Check,
  CheckCircle,
  WarningCircle,
  ShieldCheck,
  UserCircle,
  Info,
  Monitor,
  ArrowsOutLineHorizontal,
  Columns,
} from "@phosphor-icons/react";
import { EditorDeAtalhos } from "./EditorDeAtalhos.jsx";
import { apenasMudancas } from "../utils/atalhos";
import { TODAS_AS_PERMISSOES } from "../utils/permissoesCargo.jsx";

const ICONE_DO_TEMA = { claro: Sun, escuro: Moon, auto: CircleHalf };

const META_DO_TEMA = {
  claro: { descricao: "Sempre claro" },
  escuro: { descricao: "Sempre escuro" },
  auto: { descricao: "Segue seu dispositivo" },
};

const SAIDA_MS = 180;

/* ────────────────────────────────────────────────────────────────────────────
   Modal base

   A nova camada visual usa o prefixo `mpx-*` para ficar isolada do CSS antigo
   do menu de perfil (`mp-*`). Assim a modernização não interfere nos botões,
   balões e submenus que compartilham o arquivo de estilos.
   ──────────────────────────────────────────────────────────────────────────── */
function Modal({ titulo, subtitulo, onClose, abas, abaAtiva, aoTrocarAba, children }) {
  const [saindo, setSaindo] = useState(false);

  const modalRef = useRef(null);
  const saindoRef = useRef(false);
  const timerRef = useRef(null);
  const focoAnteriorRef = useRef(null);

  const tituloId = useId();
  const subtituloId = useId();

  const fechar = useCallback(() => {
    if (saindoRef.current) return;

    saindoRef.current = true;
    setSaindo(true);

    timerRef.current = window.setTimeout(onClose, SAIDA_MS);
  }, [onClose]);

  /* Esc fecha, Tab fica preso dentro do diálogo e o foco volta para quem abriu
     o modal quando ele sai. É o comportamento esperado de um diálogo de
     configurações e evita o teclado "andar" pela tela que está atrás. */
  useEffect(() => {
    focoAnteriorRef.current = document.activeElement;

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const seletorFocavel = [
      "button:not([disabled])",
      "a[href]",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      '[tabindex]:not([tabindex="-1"])',
    ].join(",");

    const modal = modalRef.current;
    modal?.querySelector(seletorFocavel)?.focus();

    function aoTeclar(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        fechar();
        return;
      }

      if (e.key !== "Tab" || !modalRef.current) return;

      const focaveis = [...modalRef.current.querySelectorAll(seletorFocavel)].filter(
        (el) => !el.hasAttribute("hidden") && el.getAttribute("aria-hidden") !== "true"
      );

      if (!focaveis.length) return;

      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];

      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    }

    document.addEventListener("keydown", aoTeclar, true);

    return () => {
      document.removeEventListener("keydown", aoTeclar, true);
      document.body.style.overflow = overflowAnterior;

      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }

      focoAnteriorRef.current?.focus?.();
    };
  }, [fechar]);

  return (
    <>
      <div
        className={`mpx-veu${saindo ? " is-saindo" : ""}`}
        aria-hidden="true"
      />

      <div
        ref={modalRef}
        className={`mpx-modal${abas?.length ? " mpx-modal--abas" : ""}${saindo ? " is-saindo" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={subtitulo ? subtituloId : undefined}
      >
        <header className="mpx-modal__cab">
          <div className="mpx-modal__titulo">
            <h2 id={tituloId}>{titulo}</h2>
            {subtitulo ? <p id={subtituloId}>{subtitulo}</p> : null}
          </div>

          <button
            type="button"
            className="mpx-fechar"
            onClick={fechar}
            aria-label="Fechar"
            title="Fechar"
          >
            <X size={20} />
          </button>
        </header>

        <div className="mpx-modal__area">
          {abas?.length ? (
            <aside className="mpx-sidebar">
              <nav className="mpx-abas" aria-label="Seções das preferências">
                {abas.map((aba) => {
                  const ativa = abaAtiva === aba.id;

                  return (
                    <button
                      key={aba.id}
                      type="button"
                      className={`mpx-aba${ativa ? " is-on" : ""}`}
                      onClick={() => aoTrocarAba(aba.id)}
                      aria-current={ativa ? "page" : undefined}
                    >
                      <span className="mpx-aba__icone" aria-hidden="true">
                        <aba.Icone size={19} weight={ativa ? "fill" : "regular"} />
                      </span>
                      <span>{aba.rotulo}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="mpx-sidebar__rodape">
                <ShieldCheck size={16} />
                <div>
                  <strong>Só para você</strong>
                  <small>Estas escolhas não alteram a conta da imobiliária.</small>
                </div>
              </div>
            </aside>
          ) : null}

          <div className="mpx-modal__corpo">
            <div className="mpx-modal__conteudo">{children}</div>
          </div>
        </div>
      </div>
    </>
  );
}

function CabecalhoDePagina({ titulo, descricao, children }) {
  return (
    <div className="mpx-pagina-cab">
      <div>
        <h3>{titulo}</h3>
        {descricao ? <p>{descricao}</p> : null}
      </div>
      {children ? <div className="mpx-pagina-cab__acao">{children}</div> : null}
    </div>
  );
}

function Secao({ Icone, titulo, descricao, children, acao = null }) {
  return (
    <section className="mpx-secao">
      <div className="mpx-secao__cab">
        <div className="mpx-secao__identidade">
          {Icone ? (
            <span className="mpx-secao__icone" aria-hidden="true">
              <Icone size={19} />
            </span>
          ) : null}

          <div>
            <h4>{titulo}</h4>
            {descricao ? <p>{descricao}</p> : null}
          </div>
        </div>

        {acao ? <div className="mpx-secao__acao">{acao}</div> : null}
      </div>

      <div className="mpx-secao__conteudo">{children}</div>
    </section>
  );
}

function LinhaDeDados({ rotulo, valor, mono = false }) {
  return (
    <div className="mpx-dado">
      <dt>{rotulo}</dt>
      <dd className={mono ? "is-mono" : undefined}>{valor || "—"}</dd>
    </div>
  );
}

function Aviso({ tipo = "info", children }) {
  const Icone = tipo === "erro" ? WarningCircle : Info;

  return (
    <div className={`mpx-aviso mpx-aviso--${tipo}`} role={tipo === "erro" ? "alert" : "status"}>
      <Icone size={17} weight={tipo === "erro" ? "fill" : "regular"} />
      <span>{children}</span>
    </div>
  );
}

const ATALHOS = [
  { onde: "Editor de vitrine", teclas: "Ctrl + Z", faz: "Desfaz o último movimento" },
  { onde: "Editor de vitrine", teclas: "Ctrl + Y", faz: "Refaz" },
  { onde: "Editor de vitrine", teclas: "Ctrl + Shift + Z", faz: "Refaz (alternativo)" },
  { onde: "Editor de vitrine", teclas: "Ctrl + roda", faz: "Aproxima e afasta a prancheta" },
  { onde: "Editor de vitrine", teclas: "Ctrl + 0", faz: "Volta ao tamanho original" },
  { onde: "Qualquer modal", teclas: "Esc", faz: "Fecha" },
  { onde: "Qualquer tela", teclas: "Esc", faz: "Volta para a tela anterior" },
];

const ABAS_PREFERENCIAS = [
  { id: "aparencia", rotulo: "Aparência", Icone: Palette },
  { id: "atalhos", rotulo: "Atalhos", Icone: Keyboard },
  { id: "painel", rotulo: "Painel", Icone: Monitor },
];

/* O cartão de escolha da aba Painel — o mesmo desenho do cartão de tema (e o
   mesmo componente do VYA, `CartaoDeEscolha`): miniatura, ícone, rótulo e o
   rádio. A miniatura de cada variante está em styles.css (`--largo`,
   `--centrado`). */
function CartaoDeEscolha({ variante, rotulo, descricao, Icone, ativo, aoClicar }) {
  return (
    <button type="button" className={`mpx-tema${ativo ? " is-on" : ""}`} onClick={aoClicar} aria-pressed={ativo}>
      <span className={`mpx-tema__preview mpx-tema__preview--${variante}`} aria-hidden="true">
        <i className="mpx-tema__barra" />
        <span className="mpx-tema__pagina"><i /><i /><i /></span>
      </span>
      <span className="mpx-tema__rodape">
        <span className="mpx-tema__icone" aria-hidden="true"><Icone size={18} weight={ativo ? "fill" : "regular"} /></span>
        <span className="mpx-tema__texto"><strong>{rotulo}</strong><small>{descricao}</small></span>
        <span className={`mpx-radio${ativo ? " is-on" : ""}`} aria-hidden="true">{ativo ? <Check size={11} weight="bold" /> : null}</span>
      </span>
    </button>
  );
}

export function ModalPreferencias({ onClose, tema, aoTrocarTema, session, onSessionUpdate }) {
  const [aba, setAba] = useState("aparencia");
  /* A aba Painel lê o estado da PRÓPRIA página ao abrir: quem manda é o
     atributo no <html> (posto pelo script do index.html e pela sessão), não o
     React — é o que garante que o cartão marcado é o que a tela mostra. */
  const [centrado, setCentrado] = useState(() => layoutCentradoAtual());
  const [largura] = useState(() => window.innerWidth);
  const trocarCentrado = (v) => {
    setCentrado(v);
    aplicarLayoutCentrado(v);
    salvarLayoutCentrado(v);
    /* Na sessão também: é dela que o painel relê a escolha do servidor, e sem
       isto a próxima releitura desfaria o que a pessoa acabou de marcar. */
    onSessionUpdate?.({ ...session, usuario: { ...session?.usuario, layoutCentrado: v } });
  };
  const monitorLargo = centradoNoAutomatico(largura);
  const [meus, setMeus] = useState(() => session?.usuario?.atalhos || {});
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState(null);

  const cargo = session?.usuario?.cargo;
  const daCasa = session?.tenant?.atalhos || {};

  const salvarAtalhos = useCallback(async (config) => {
    setSalvando(true);
    setAviso(null);

    try {
      const enxuto = apenasMudancas(config);
      await api.salvarMeusAtalhos(enxuto);

      onSessionUpdate?.({
        ...session,
        usuario: { ...session.usuario, atalhos: enxuto },
      });

      setAviso({ tipo: "sucesso", texto: "Alterações salvas" });
    } catch (e) {
      setAviso({ tipo: "erro", texto: e.message || "Não consegui salvar." });
    } finally {
      setSalvando(false);
    }
  }, [onSessionUpdate, session]);

  return (
    <Modal
      titulo="Suas preferências"
      subtitulo="Personalize sua experiência no Omnimob."
      onClose={onClose}
      abas={ABAS_PREFERENCIAS}
      abaAtiva={aba}
      aoTrocarAba={setAba}
    >
      {aba === "aparencia" ? (
        <>
          <CabecalhoDePagina
            titulo="Aparência"
            descricao="Escolha como o painel deve aparecer para você. A alteração é aplicada na hora."
          />

          <Secao
            Icone={Palette}
            titulo="Tema do painel"
            descricao="Automático acompanha a preferência do seu sistema operacional."
          >
            <div className="mpx-temas">
              {TEMAS.map((t) => {
                const Icone = ICONE_DO_TEMA[t.id] || CircleHalf;
                const selecionado = tema === t.id;
                const meta = META_DO_TEMA[t.id] || {};

                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`mpx-tema${selecionado ? " is-on" : ""}`}
                    onClick={() => aoTrocarTema(t.id)}
                    aria-pressed={selecionado}
                  >
                    <span
                      className={`mpx-tema__preview mpx-tema__preview--${t.id}`}
                      aria-hidden="true"
                    >
                      <i className="mpx-tema__barra" />
                      <span className="mpx-tema__pagina">
                        <i />
                        <i />
                        <i />
                      </span>
                    </span>

                    <span className="mpx-tema__rodape">
                      <span className="mpx-tema__icone" aria-hidden="true">
                        <Icone size={18} weight={selecionado ? "fill" : "regular"} />
                      </span>

                      <span className="mpx-tema__texto">
                        <strong>{t.rotulo}</strong>
                        <small>{meta.descricao}</small>
                      </span>

                      <span className={`mpx-radio${selecionado ? " is-on" : ""}`} aria-hidden="true">
                        {selecionado ? <Check size={11} weight="bold" /> : null}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Secao>

          <div className="mpx-dica">
            <CircleHalf size={18} />
            <p>
              No modo <strong>Automático</strong>, o painel muda junto com o tema do
              dispositivo, sem você precisar voltar aqui.
            </p>
          </div>
        </>
      ) : aba === "painel" ? (
        <>
          <CabecalhoDePagina titulo="Painel" descricao="Como as telas ocupam o espaço do seu monitor." />
          <Secao Icone={Monitor} titulo="Largura das telas" descricao="Vale para a barra do topo, o cabeçalho e o conteúdo.">
            <div className="mpx-temas mpx-temas--duplo">
              <CartaoDeEscolha variante="largo" rotulo="Largura total" descricao="Usa o monitor inteiro" Icone={ArrowsOutLineHorizontal} ativo={!centrado} aoClicar={() => trocarCentrado(false)} />
              <CartaoDeEscolha variante="centrado" rotulo="Centrado" descricao="Com margem dos dois lados" Icone={Columns} ativo={centrado} aoClicar={() => trocarCentrado(true)} />
            </div>
          </Secao>
          <div className="mpx-dica">
            <Info size={18} />
            <p>
              {monitorLargo
                ? <>Seu monitor tem <strong>{largura}px</strong> de largura. Acima de {LARGURA_DE_MONITOR_LARGO}px as telas já nascem centradas, porque a linha atravessando tudo cansa de ler.</>
                : <>Seu monitor tem <strong>{largura}px</strong> de largura. Abaixo de {LARGURA_DE_MONITOR_LARGO}px as telas nascem em largura total.</>}
            </p>
          </div>
        </>
      ) : (
        <>
          <CabecalhoDePagina
            titulo="Atalhos"
            descricao="Personalize comandos de teclado para trabalhar mais rápido sem alterar a experiência da equipe."
          >
            {salvando ? (
              <span className="mpx-status is-salvando">
                <span className="mpx-spinner" />
                Salvando
              </span>
            ) : aviso?.tipo === "sucesso" ? (
              <span className="mpx-status is-salvo">
                <CheckCircle size={15} weight="fill" />
                {aviso.texto}
              </span>
            ) : null}
          </CabecalhoDePagina>

          {aviso?.tipo === "erro" ? <Aviso tipo="erro">{aviso.texto}</Aviso> : null}

          <Secao
            Icone={Keyboard}
            titulo="Seus atalhos"
            descricao="Eles começam no padrão da imobiliária. Suas mudanças valem apenas para o seu usuário."
          >
            <div className="mpx-editor-atalhos">
              <EditorDeAtalhos
                cargo={cargo}
                herdados={daCasa}
                valor={meus}
                aoMudar={setMeus}
                aoSalvar={salvarAtalhos}
                estado={salvando ? "Salvando…" : aviso?.texto || ""}
              />
            </div>
          </Secao>

          <Secao
            Icone={ShieldCheck}
            titulo="Atalhos do sistema"
            descricao="Estes comandos são universais e não podem ser alterados."
          >
            <div className="mpx-atalhos">
              {ATALHOS.map((a) => (
                <div className="mpx-atalho" key={a.teclas + a.onde}>
                  <div className="mpx-atalho__tecla">
                    <kbd>{a.teclas}</kbd>
                  </div>
                  <div className="mpx-atalho__texto">
                    <strong>{a.faz}</strong>
                    <small>{a.onde}</small>
                  </div>
                </div>
              ))}
            </div>
          </Secao>
        </>
      )}
    </Modal>
  );
}

export function ModalMeusDados({ onClose, session, onSessionUpdate }) {
  const u = session?.usuario || {};
  const t = session?.tenant || {};
  const cargo = u.cargo || {};
  const google = u.google || null;

  const [desvinculando, setDesvinculando] = useState(false);
  const [erro, setErro] = useState("");

  async function desvincular() {
    setDesvinculando(true);
    setErro("");

    try {
      await api.desvincularGoogle(t.slug);
      onSessionUpdate?.({ ...session, usuario: { ...u, google: null } });
    } catch (e) {
      setErro(e.message || "Não consegui desvincular.");
    } finally {
      setDesvinculando(false);
    }
  }

  const permissoesDoCargo = TODAS_AS_PERMISSOES.filter((p) => cargo[p.key]);

  const plano =
    t.plano
      ? t.plano.charAt(0).toUpperCase() + t.plano.slice(1).toLowerCase()
      : "Básico";

  return (
    <Modal
      titulo="Meus dados"
      subtitulo="Conta, acesso e informações vinculadas ao seu usuário."
      onClose={onClose}
    >
      <div className="mpx-perfil">
        <div className="mpx-perfil__avatar">
          {google?.foto ? (
            <img src={google.foto} alt="" referrerPolicy="no-referrer" />
          ) : (
            <UserCircle size={34} weight="duotone" />
          )}
        </div>

        <div className="mpx-perfil__texto">
          <h3>{google?.nome || u.nome || "Seu perfil"}</h3>
          <p>{u.email || u.login || "Usuário Omnimob"}</p>
        </div>
      </div>

      <Secao
        Icone={GoogleLogo}
        titulo="Conta Google"
        descricao={
          google
            ? "Use sua conta Google para entrar no Omnimob sem digitar a senha."
            : "Nenhuma conta Google está vinculada ao seu usuário."
        }
        acao={
          google ? (
            <span className="mpx-badge is-ok">
              <CheckCircle size={14} weight="fill" />
              Vinculada
            </span>
          ) : null
        }
      >
        {google ? (
          <>
            <div className="mpx-google">
              <div className="mpx-google__avatar">
                {google.foto ? (
                  <img src={google.foto} alt="" referrerPolicy="no-referrer" />
                ) : (
                  <GoogleLogo size={23} />
                )}
              </div>

              <div className="mpx-google__texto">
                <strong>{google.nome || "Conta Google"}</strong>
                <span>{google.email || "—"}</span>
                {google.vinculadoEm ? (
                  <small>
                    Vinculada em {new Date(google.vinculadoEm).toLocaleDateString("pt-BR")}
                  </small>
                ) : null}
              </div>

              <button
                type="button"
                className="mpx-acao-texto is-perigo"
                onClick={desvincular}
                disabled={desvinculando}
              >
                {desvinculando ? "Desvinculando…" : "Desvincular"}
              </button>
            </div>

            <div className="mpx-dica mpx-dica--interna">
              <ShieldCheck size={17} />
              <p>
                Desvincular <strong>não remove seu acesso</strong>. Login e senha
                continuam funcionando normalmente.
              </p>
            </div>
          </>
        ) : (
          <div className="mpx-vazio">
            <span className="mpx-vazio__icone">
              <GoogleLogo size={23} />
            </span>
            <div>
              <strong>Nenhuma conta vinculada</strong>
              <p>
                Vincule pelo menu do perfil para entrar mais rápido e usar sua foto
                do Google no painel.
              </p>
            </div>
          </div>
        )}

        {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      </Secao>

      <Secao
        Icone={IdentificationBadge}
        titulo="Cadastro na Omnimob"
        descricao={cargo.descricao || "Dados cadastrados pela imobiliária."}
      >
        <dl className="mpx-dados">
          <LinhaDeDados rotulo="Nome" valor={u.nome} />
          <LinhaDeDados rotulo="Login" valor={u.login} mono />
          <LinhaDeDados rotulo="E-mail" valor={u.email} />
        </dl>
      </Secao>

      <Secao
        Icone={Buildings}
        titulo={t.name || "Imobiliária"}
        descricao="Organização à qual este acesso pertence."
      >
        <dl className="mpx-dados">
          <LinhaDeDados rotulo="Plano" valor={plano} />
          <LinhaDeDados
            rotulo="Endereço"
            valor={t.slug ? `${t.slug}.omnimob.app` : "—"}
            mono
          />
        </dl>
      </Secao>

      <Secao
        Icone={Compass}
        titulo="Permissões do seu cargo"
        descricao="Definidas por quem administra a conta."
      >
        {permissoesDoCargo.length ? (
          <div className="mpx-permissoes">
            {permissoesDoCargo.map((p) => (
              <span className="mpx-permissao" key={p.key}>
                <Check size={12} weight="bold" />
                {p.label}
              </span>
            ))}
          </div>
        ) : (
          <div className="mpx-vazio mpx-vazio--compacto">
            <span className="mpx-vazio__icone">
              <ShieldCheck size={22} />
            </span>
            <div>
              <strong>Nenhuma permissão marcada</strong>
              <p>Este cargo não possui permissões específicas habilitadas.</p>
            </div>
          </div>
        )}
      </Secao>

      <div className="mpx-rodape-nota">
        <IdentificationBadge size={18} />
        <p>
          Para trocar nome, e-mail ou senha do cadastro, fale com quem administra
          a conta. Esses dados são gerenciados em <strong>Usuários</strong>.
        </p>
      </div>
    </Modal>
  );
}
