import { api } from "../api";
import { TEMAS } from "../utils/temaDoPainel";
import { useCallback, useState } from "react";
import { IdentificationBadge, Keyboard, Palette, Compass, Sun, Moon, CircleHalf, GoogleLogo, Buildings } from "@phosphor-icons/react";
import { EditorDeAtalhos } from "./EditorDeAtalhos.jsx";
import { apenasMudancas } from "../utils/atalhos";

/* O ícone de cada tema. Estava no AdminLayout, junto do atalho da barra; veio
   com ele quando a escolha virou uma linha só, aqui. */
const ICONE_DO_TEMA = { claro: Sun, escuro: Moon, auto: CircleHalf };

/* ────────────────────────────────────────────────────────────────────────────
   Os dois modais que o menu do perfil abre.

   ── A LINHA QUE OS SEPARA DE "CONFIGURAÇÕES" ──

   Configurações (a tela) é da IMOBILIÁRIA: plano, cobrança, domínio, cores da
   marca, dados legais. Tudo ali vale para a empresa inteira e é o administrador
   quem mexe.

   Isto aqui é da PESSOA: o tema que ELA vê, se a barra abre recolhida para ELA,
   se ELA quer ser guiada por tours. Um corretor mexe nisto sem pedir licença, e
   nada do que ele mudar aparece para o colega ao lado.

   Ter os dois com o mesmo nome em lugares diferentes seria confuso; ter um só
   seria pior — o corretor precisaria de permissão de administrador para
   escolher o próprio tema.
   ──────────────────────────────────────────────────────────────────────────── */

/* `abas` é opcional: modal simples continua recebendo só `children`, e é o caso
   de "Meus dados". Quando há abas, elas ficam à ESQUERDA e não no topo — a
   lista cresce (aparência, atalhos, e o que vier), e abas no topo de um modal
   estreito viram duas fileiras ou rolagem horizontal. */
function Modal({ titulo, subtitulo, onClose, abas, abaAtiva, aoTrocarAba, children }) {
  return (
    <>
      <div className="mp-veu" onMouseDown={(e) => e.target === e.currentTarget && onClose()} />
      <div
        className={`mp-modal${abas?.length ? " mp-modal--abas" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
      >
        <header className="mp-modal__cab">
          <div>
            <h2>{titulo}</h2>
            {subtitulo ? <p>{subtitulo}</p> : null}
          </div>
          <button type="button" className="mp-modal__fechar" onClick={onClose} aria-label="Fechar">×</button>
        </header>

        <div className="mp-modal__area">
          {abas?.length ? (
            <nav className="mp-abas" aria-label="Seções">
              {abas.map((aba) => (
                <button
                  key={aba.id}
                  type="button"
                  className={`mp-aba${abaAtiva === aba.id ? " is-on" : ""}`}
                  onClick={() => aoTrocarAba(aba.id)}
                  aria-current={abaAtiva === aba.id ? "true" : undefined}
                >
                  <aba.Icone size={16} />
                  <span>{aba.rotulo}</span>
                </button>
              ))}
            </nav>
          ) : null}
          <div className="mp-modal__corpo">{children}</div>
        </div>
      </div>
    </>
  );
}

function Secao({ Icone, titulo, descricao, children }) {
  return (
    <section className="mp-secao">
      <div className="mp-secao__cab">
        <span className="mp-secao__icone"><Icone size={17} /></span>
        <div>
          <strong>{titulo}</strong>
          {descricao ? <small>{descricao}</small> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

/* Só os atalhos que EXISTEM de verdade. Uma lista bonita com atalhos que o
   produto não tem é pior que nenhuma lista: quem tenta e não funciona passa a
   desconfiar dos outros. Hoje todos vivem no editor de vitrine — quando
   nascerem atalhos globais, eles entram aqui. */
const ATALHOS = [
  { onde: "Editor de vitrine", teclas: "Ctrl + Z", faz: "Desfaz o último movimento" },
  { onde: "Editor de vitrine", teclas: "Ctrl + Y", faz: "Refaz" },
  { onde: "Editor de vitrine", teclas: "Ctrl + Shift + Z", faz: "Refaz (alternativo)" },
  { onde: "Editor de vitrine", teclas: "Ctrl + roda", faz: "Aproxima e afasta a prancheta" },
  { onde: "Editor de vitrine", teclas: "Ctrl + 0", faz: "Volta ao tamanho original" },
  { onde: "Qualquer modal", teclas: "Esc", faz: "Fecha" },
  /* Esc não é configurável, e por isso mora aqui e não no editor: é o gesto de
     "sair daqui" que o sistema inteiro respeita. */
  { onde: "Qualquer tela", teclas: "Esc", faz: "Volta para a tela anterior" },
];

const ABAS_PREFERENCIAS = [
  { id: "aparencia", rotulo: "Aparência", Icone: Palette },
  { id: "atalhos", rotulo: "Atalhos", Icone: Keyboard },
];

export function ModalPreferencias({ onClose, tema, aoTrocarTema, session, onSessionUpdate }) {
  const [aba, setAba] = useState("aparencia");
  const [meus, setMeus] = useState(() => session?.usuario?.atalhos || {});
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState("");

  const cargo = session?.usuario?.cargo;
  /* O que a IMOBILIÁRIA definiu. É por baixo da escolha desta pessoa — a casa
     estabelece a convenção, quem trabalha o dia inteiro pode discordar. */
  const daCasa = session?.tenant?.atalhos || {};

  /* Sem botão: o editor chama isto com um respiro depois de cada tecla. */
  const salvarAtalhos = useCallback(async (config) => {
    setSalvando(true);
    setAviso("");
    try {
      const enxuto = apenasMudancas(config);
      await api.salvarMeusAtalhos(enxuto);
      /* A sessão acompanha na hora: o ouvinte do teclado e os selos ao lado dos
         botões leem dela, e sem isto a tecla nova só valeria ao recarregar. */
      onSessionUpdate?.({
        ...session,
        usuario: { ...session.usuario, atalhos: enxuto },
      });
      setAviso("Salvo.");
    } catch (e) {
      setAviso(e.message || "Não consegui salvar.");
    } finally {
      setSalvando(false);
    }
  }, [onSessionUpdate, session]);

  return (
    <Modal
      titulo="Suas preferências"
      subtitulo="Valem só para você — ninguém da equipe vê estas escolhas."
      onClose={onClose}
      abas={ABAS_PREFERENCIAS}
      abaAtiva={aba}
      aoTrocarAba={setAba}
    >
      {aba === "aparencia" ? (
        <Secao Icone={Palette} titulo="Tema do painel" descricao="Automático segue o tema do seu sistema operacional.">
          <div className="mp-opcoes">
            {TEMAS.map((t) => {
              const Icone = ICONE_DO_TEMA[t.id] || CircleHalf;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`mp-opcao mp-opcao--icone${tema === t.id ? " is-on" : ""}`}
                  onClick={() => aoTrocarTema(t.id)}
                  aria-pressed={tema === t.id}
                >
                  <Icone size={15} weight={tema === t.id ? "fill" : "regular"} />
                  {t.rotulo}
                </button>
              );
            })}
          </div>
        </Secao>
      ) : (
        <>
          <Secao
            Icone={Keyboard}
            titulo="Seus atalhos"
            descricao="Começam no que a imobiliária definiu. O que você mudar aqui vale só para você."
          >
            <EditorDeAtalhos
              cargo={cargo}
              herdados={daCasa}
              valor={meus}
              aoMudar={setMeus}
              aoSalvar={salvarAtalhos}
              estado={salvando ? "Salvando…" : aviso}
            />
          </Secao>

          <Secao Icone={Keyboard} titulo="Os que não mudam" descricao="Fixos no sistema inteiro.">
            <table className="mp-atalhos">
              <tbody>
                {ATALHOS.map((a) => (
                  <tr key={a.teclas + a.onde}>
                    <td><kbd>{a.teclas}</kbd></td>
                    <td>{a.faz}</td>
                    <td><small>{a.onde}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
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

  /* Desvincular é reversível e sem perda: o acesso por login e senha nunca
     deixou de existir. Por isso não há confirmação — pedir "tem certeza?" para
     uma ação que se desfaz em dois cliques é cerimônia. */
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

  /* As permissões que o cargo dá, em português. Vem do MESMO objeto que o
     painel usa para decidir o que mostrar, então esta lista nunca promete um
     acesso que a tela nega. */
  const PERMISSOES = [
    ["acessarPainel", "Acessar o painel"],
    ["gerenciarImoveis", "Gerenciar imóveis"],
    ["gerenciarClientes", "Gerenciar clientes"],
    ["gerenciarUsuarios", "Gerenciar usuários"],
    ["gerenciarCargos", "Gerenciar cargos"],
    ["verRelatorios", "Ver relatórios"],
    ["verAuditoria", "Ver registro de atividade"],
    ["verConfiguracoes", "Ver configurações"],
    ["editarPagina", "Editar a vitrine"],
    ["publicarRedes", "Publicar nas redes"],
  ].filter(([k]) => cargo[k]);

  return (
    <Modal titulo="Meus dados" subtitulo="O que o sistema sabe sobre o seu acesso." onClose={onClose}>
      {/* ── A conta Google ────────────────────────────────────────────────
          Primeiro porque é o que muda: o resto desta tela é o cadastro, que a
          pessoa não edita daqui. */}
      <Secao
        Icone={GoogleLogo}
        titulo={google ? "Conta Google vinculada" : "Conta Google"}
        descricao={
          google
            ? "Você pode entrar pelo Google. Nome e foto de lá aparecem no painel."
            : "Ainda não vinculada. Vincule pelo menu do seu perfil."
        }
      >
        {google ? (
          <>
            <div className="mp-google">
              {google.foto ? (
                <img src={google.foto} alt="" referrerPolicy="no-referrer" />
              ) : null}
              <div>
                <strong>{google.nome || "—"}</strong>
                <small>{google.email || "—"}</small>
              </div>
            </div>
            {google.vinculadoEm ? (
              <p className="mp-nota">
                Vinculada em {new Date(google.vinculadoEm).toLocaleDateString("pt-BR")}.
              </p>
            ) : null}
            <div className="mp-opcoes">
              <button type="button" className="mp-opcao" onClick={desvincular} disabled={desvinculando}>
                {desvinculando ? "Desvinculando…" : "Desvincular"}
              </button>
            </div>
            <p className="mp-nota">
              Desvincular não tira o seu acesso: login e senha continuam valendo.
            </p>
          </>
        ) : (
          <p className="mp-nota">
            Vinculando, você entra sem digitar senha e o painel passa a mostrar sua
            foto do Google.
          </p>
        )}
        {erro ? <p className="mp-nota" style={{ color: "#fca5a5" }}>{erro}</p> : null}
      </Secao>

      {/* ── O cadastro na Omnimob ─────────────────────────────────────────
          Separado do bloco acima de propósito: são coisas diferentes e a tela
          precisa deixar isso claro. O nome do Google é o que a PESSOA vê no
          painel; o nome daqui é o que a IMOBILIÁRIA publica — na vitrine, nas
          listas, no widget de Equipe. Mostrar os dois juntos, sem rótulo,
          faria parecer que um substituiu o outro. */}
      <Secao Icone={IdentificationBadge} titulo="Seu cadastro na Omnimob" descricao={cargo.descricao || "Operador"}>
        <dl className="mp-ficha">
          <dt>Nome</dt><dd>{u.nome || "—"}</dd>
          <dt>Login</dt><dd>{u.login || "—"}</dd>
          <dt>E-mail</dt><dd>{u.email || "—"}</dd>
        </dl>
      </Secao>

      <Secao Icone={Buildings} titulo={t.name || "Imobiliária"} descricao="A conta a que o seu acesso pertence.">
        <dl className="mp-ficha">
          <dt>Plano</dt><dd style={{ textTransform: "capitalize" }}>{(t.plano || "básico").toLowerCase()}</dd>
          <dt>Endereço</dt><dd>{t.slug ? `${t.slug}.omnimob.app` : "—"}</dd>
        </dl>
      </Secao>

      <Secao Icone={Compass} titulo="O que o seu cargo permite" descricao="Definido por quem administra a conta.">
        {PERMISSOES.length ? (
          <ul className="mp-permissoes">
            {PERMISSOES.map(([k, rotulo]) => <li key={k}>{rotulo}</li>)}
          </ul>
        ) : (
          <p className="mp-nota">Nenhuma permissão marcada neste cargo.</p>
        )}
      </Secao>

      <p className="mp-nota">
        Para trocar nome, e-mail ou senha do cadastro, fale com quem administra a
        conta — estes dados são gerenciados em <strong>Usuários</strong>.
      </p>
    </Modal>
  );
}
