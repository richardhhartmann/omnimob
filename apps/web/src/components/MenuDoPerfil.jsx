import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import {
  GearSix, Question, SignOut, CaretRight, GoogleLogo, IdentificationBadge,
  LifebuoyIcon, Notebook, FileText, ShieldCheck, Bug, Check, Buildings, ChatsCircle,
} from "@phosphor-icons/react";
import { planoInfo } from "../utils/planos";

/* ────────────────────────────────────────────────────────────────────────────
   O menu do perfil — um balão que sobe do rodapé da barra lateral.

   ── POR QUE SUBSTITUI ITENS SOLTOS NO RODAPÉ ──

   Ajuda e Encerrar Sessão eram duas linhas da navegação, ao lado de Início,
   Imóveis e Relatórios. Só que elas não são navegação: são coisas sobre VOCÊ e
   sobre o SISTEMA, não sobre o trabalho da imobiliária. Misturadas na mesma
   lista, competiam pelo olho com os itens que a pessoa usa o dia inteiro.

   Reunidas atrás do próprio nome, elas ficam onde qualquer pessoa já procura
   por elas — que é a razão de todo produto com conta ter esse menu no mesmo
   canto.

   ── SUBMENU POR HOVER, COM ATRASO NA SAÍDA ──

   O submenu abre ao passar o mouse e fecha com 180ms de atraso. O atraso não é
   enfeite: sem ele, o caminho diagonal do ponteiro até um item do submenu passa
   por fora do item que o abriu, e o menu fecha na cara de quem está indo nele.
   É o defeito clássico de menu em cascata.

   Teclado alcança tudo: Tab percorre, Enter/Espaço abre o submenu, Escape
   fecha. Um menu que só existe para o mouse exclui quem navega por teclado das
   ÚNICAS ações de conta que o produto tem.

   ── POR QUE PORTAL, E POR QUE ELE NÃO SEGUE O TEMA ──

   A barra lateral tem `overflow-x: hidden` e `overflow-y: auto` — precisa
   disso para rolar quando o menu cresce. Só que overflow recorta descendente, e
   um balão que sobe do rodapé e um submenu que sai pela direita são exatamente
   o que ele recorta. Nascendo dentro dela, o menu aparecia pela metade.

   Portal tira o menu da árvore da barra; a posição passa a ser calculada da
   ÂNCORA, em coordenadas de tela.

   E o balão é SEMPRE ESCURO, mesmo com o painel no tema claro. Ele nasce
   colado na barra, que é escura nos dois temas — um balão branco brotando de
   uma barra preta parece de outro programa. Quem segue o tema são os MODAIS,
   que abrem centralizados sobre o conteúdo.
   ──────────────────────────────────────────────────────────────────────────── */

const ATRASO_PARA_FECHAR_MS = 180;

function Submenu({ aberto, children }) {
  if (!aberto) return null;
  return <div className="mp-flutuante">{children}</div>;
}

/* ── O PLANO DA IMOBILIÁRIA, E POR QUE ELE MORA AQUI ────────────────────────

   O selo vivia na face da imobiliária dentro do seletor de módulo, no topo da
   barra lateral. Funcionou enquanto aquela face tinha a largura de uma barra
   aberta; quando o seletor mudou para a faixa do topo, ela passou a viver em
   ~146px — e a pílula é a única peça de largura fixa lá (não pode virar
   "Premi…"), então o nome e o slug encolheram até `P…` e `pap…`. O selo comeu
   justamente a informação que aquela face existe para dar.

   Aqui a linha tem 232px, o plano fica ao lado do nome da imobiliária, e um
   clique leva a Configurações › Plano — que é o único lugar onde ele muda. A
   pergunta que o selo responde é a mesma de antes: "que Omnimob é esta?", e por
   que metade das telas esconde recurso. Sem ela, a ausência de um botão parece
   defeito em vez de limite do plano.

   Reaproveita `.ds-plano`, da folha do `AdminLayout`: é uma ideia só no produto
   e merece uma aparência só — a mesma que a landing e o painel super-admin
   usam. O balão sai por portal, mas aquela regra não é escopada em `.ds-shell`,
   então ela alcança daqui.
   ────────────────────────────────────────────────────────────────────────────── */
function LinhaDaImobiliaria({ tenant, podeVerPlano, aoIr }) {
  const nome = tenant?.name || "Minha imobiliária";
  const info = planoInfo(tenant?.plano);

  const conteudo = (
    <span className="mp-casa">
      <span className="mp-casa__nome">{nome}</span>
      {info ? (
        <span className="ds-plano" style={{ "--plano": info.cor }}>{info.nome}</span>
      ) : null}
    </span>
  );

  /* Sem `verConfiguracoes` não há para onde ir, e a linha vira informação: o
     plano continua dito, sem cursor de mão e sem destino. Mesma regra do rolo
     do seletor de módulo — um botão desabilitado prometeria uma tela que aquela
     pessoa nunca verá. */
  if (!podeVerPlano) {
    return (
      <div className="mp-linha is-informativa">
        <span className="mp-linha__icone"><Buildings size={17} /></span>
        <span className="mp-linha__texto">{conteudo}</span>
      </div>
    );
  }

  return (
    <Linha
      Icone={Buildings}
      rotulo={conteudo}
      detalhe="Plano e recursos"
      aoClicar={aoIr}
    />
  );
}

function Linha({ Icone, rotulo, detalhe, aoClicar, temSubmenu, submenu, aoAbrirSub, aoFecharSub, subAberto, aviso = 0 }) {
  return (
    <div
      className="mp-linha-caixa"
      onMouseEnter={temSubmenu ? aoAbrirSub : undefined}
      onMouseLeave={temSubmenu ? aoFecharSub : undefined}
    >
      <button
        type="button"
        className={`mp-linha${subAberto ? " is-aberta" : ""}`}
        onClick={aoClicar}
        /* Enter e Espaço abrem o submenu para quem chega por Tab: sem isto o
           item existe, recebe foco e não faz nada. */
        onKeyDown={(e) => {
          if (temSubmenu && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            aoAbrirSub?.();
          }
        }}
        onFocus={temSubmenu ? aoAbrirSub : undefined}
        aria-haspopup={temSubmenu ? "menu" : undefined}
        aria-expanded={temSubmenu ? subAberto : undefined}
      >
        {Icone ? <span className="mp-linha__icone"><Icone size={17} /></span> : null}
        <span className="mp-linha__texto">
          {rotulo}
          {detalhe ? <small>{detalhe}</small> : null}
        </span>
        {/* O selo vermelho no fim da linha: novidades nos chamados, no item
            Ajuda — o mesmo número da foto do perfil, para o caminho até ele
            ficar à vista. */}
        {aviso ? <span className="mp-linha__aviso">{aviso > 9 ? "9+" : aviso}</span> : null}
        {temSubmenu ? <CaretRight size={13} className="mp-linha__seta" /> : null}
      </button>
      <Submenu aberto={subAberto}>{submenu}</Submenu>
    </div>
  );
}

/* O que mudou, numa linha — a mesma régua do servidor: resolvido, a fala do
   suporte, a fala de um colega (o Administrador também escreve nos chamados
   da equipe), ou só "atualizado". */
function textoDaNovidade(n) {
  const num = `#${n.numero}`;
  if (n.status === "RESOLVIDO") return `O chamado ${num} foi resolvido`;
  if (n.autorTipo === "SUPORTE") return `O suporte respondeu o ${num}`;
  if (n.autorTipo === "CLIENTE") return `${String(n.autorNome || "Alguém da equipe").replace(/\s*\(.*\)$/, "")} respondeu o ${num}`;
  return `O chamado ${num} foi atualizado`;
}

export function MenuDoPerfil({
  aberto, aoFechar, usuario, tenant, ancoraRef,
  aoAbrirAjuda, aoAbrirChamado, aoAbrirSuporte, aoAbrirNovidades, aoAbrirPreferencias, aoAbrirPerfil, aoSair,
  aoVincularGoogle, chamados = { aguardando: 0, novidades: 0 },
}) {
  const navegar = useNavigate();
  const caixaRef = useRef(null);
  const [sub, setSub] = useState(null);
  const relogio = useRef(null);
  const [posicao, setPosicao] = useState(null);
  /* O botão só existe se o servidor tiver `GOOGLE_CLIENT_ID`. Perguntar é mais
     honesto que adivinhar: sem isso a tela ofereceria um vínculo que falha no
     clique, como já aconteceu com o Pix. */
  const [google, setGoogle] = useState({ disponivel: false, clientId: null });
  useEffect(() => {
    if (!aberto) return;
    api.googleDisponivel().then(setGoogle).catch(() => {});
  }, [aberto]);

  /* A versão no ar, para a pessoa dizer ao suporte qual tem ("estou na
     1.4.2"). Uma vez por menu aberto: muda a cada deploy, não a cada clique. */
  const [versao, setVersao] = useState(null);
  useEffect(() => {
    if (!aberto || versao) return;
    api.versao().then(setVersao).catch(() => {});
  }, [aberto, versao]);

  /* AS NOVIDADES DOS CHAMADOS — o que o suporte respondeu ou resolveu e a
     pessoa ainda não abriu, cada uma com a última fala. Perguntado só quando
     o submenu de Ajuda abre e só se o contador diz que há algo: é a lista do
     sino que o painel não tem, no lugar onde a pessoa já procura ajuda.
     Clicar abre o chamado, e abrir marca o visto no servidor. */
  const [novidades, setNovidades] = useState([]);
  useEffect(() => {
    if (!aberto || sub !== "ajuda" || !chamados.novidades || !tenant?.slug) { if (!chamados.novidades) setNovidades([]); return; }
    let vivo = true;
    api.chamadosNovidades(tenant.slug)
      .then((d) => { if (vivo) setNovidades((d?.novidades || []).slice(0, 4)); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [aberto, sub, chamados.novidades, tenant?.slug]);

  /* Mede a âncora e prende o balão em coordenadas de tela.
     `useLayoutEffect` e não `useEffect`: com este, o menu chega a pintar na
     posição zero antes de saltar para o lugar. */
  useLayoutEffect(() => {
    if (!aberto || !ancoraRef?.current) return undefined;
    function medir() {
      const r = ancoraRef.current?.getBoundingClientRect();
      if (r) setPosicao({ esquerda: r.left + 8, base: window.innerHeight - r.top + 8 });
    }
    medir();
    /* A barra rola por dentro e a janela redimensiona. Sem remedir, o balão
       fica parado num lugar que o perfil já deixou. */
    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, true);
    return () => {
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir, true);
    };
  }, [aberto, ancoraRef]);

  function abrirSub(qual) {
    clearTimeout(relogio.current);
    setSub(qual);
  }
  function fecharSub() {
    clearTimeout(relogio.current);
    relogio.current = setTimeout(() => setSub(null), ATRASO_PARA_FECHAR_MS);
  }

  /* Fecha ao clicar fora e no Escape. O clique de fora escuta em `mousedown` e
     não em `click`: com `click`, um botão embaixo do menu recebia o evento
     antes de o menu sair, e a pessoa acionava sem querer o que estava atrás. */
  useEffect(() => {
    if (!aberto) return undefined;
    function foraDaCaixa(e) {
      if (caixaRef.current?.contains(e.target)) return;
      if (ancoraRef?.current?.contains(e.target)) return;
      aoFechar();
    }
    function aoTeclar(e) {
      if (e.key === "Escape") { setSub(null); aoFechar(); }
    }
    document.addEventListener("mousedown", foraDaCaixa);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", foraDaCaixa);
      document.removeEventListener("keydown", aoTeclar);
      clearTimeout(relogio.current);
    };
  }, [aberto, aoFechar, ancoraRef]);

  useEffect(() => { if (!aberto) setSub(null); }, [aberto]);

  if (!aberto || !posicao) return null;

  /* Mesma precedência da barra: a conta Google manda na MOLDURA, o cadastro
     manda no que a imobiliária publica. */
  const nome = usuario?.google?.nome || usuario?.nome || "Usuário";
  const foto = usuario?.google?.foto || usuario?.foto || "";
  const inicial = nome.charAt(0)?.toUpperCase() || "U";
  const cargo = usuario?.cargo?.descricao || "Operador";

  function ir(rota) {
    aoFechar();
    navegar(rota);
  }

  return createPortal(
    <div
      className="mp-balao"
      ref={caixaRef}
      role="menu"
      aria-label="Menu do perfil"
      style={{ left: `${posicao.esquerda}px`, bottom: `${posicao.base}px` }}
    >
      {/* ── 1. Quem é você ─────────────────────────────────────────────────── */}
      <Linha
        temSubmenu
        subAberto={sub === "conta"}
        aoAbrirSub={() => abrirSub("conta")}
        aoFecharSub={fecharSub}
        aoClicar={() => abrirSub("conta")}
        Icone={null}
        rotulo={
          <span className="mp-conta">
            {/* `referrerPolicy` obrigatório: sem ele o Google recusa servir a
                foto quando o referenciador é outro domínio, e o avatar chega
                quebrado justo depois de a pessoa vincular. */}
            {foto
              ? <img className="mp-conta__foto" src={foto} alt="" referrerPolicy="no-referrer" />
              : <span className="mp-conta__foto mp-conta__foto--vazia">{inicial}</span>}
            <span className="mp-conta__texto">
              <strong>{nome}</strong>
              <small>{cargo}</small>
            </span>
          </span>
        }
        submenu={
          <>
            <button type="button" className="mp-linha" onClick={() => { aoFechar(); aoAbrirPerfil(); }}>
              <span className="mp-linha__icone"><IdentificationBadge size={17} /></span>
              <span className="mp-linha__texto">Meus dados</span>
            </button>
            {/* Vincular exige estar logado — e é justamente isso que torna o
                login por Google seguro: o vínculo nasce de quem JÁ PROVOU ser
                este usuário. Ver `authRoutes`. */}
            {/* Já vinculada, a linha vira INFORMAÇÃO e deixa de ser botão.
                Clicar de novo só refazia o mesmo vínculo com a mesma conta —
                nada acontecia, e "nada acontece" é indistinguível de "falhou"
                para quem está olhando. Um `<div>`, e não um `<button disabled>`:
                desabilitado sugere que existe uma ação bloqueada, e aqui não
                existe ação nenhuma a tomar. */}
            {usuario?.google ? (
              <div className="mp-linha is-informativa">
                <span className="mp-linha__icone"><GoogleLogo size={17} /></span>
                <span className="mp-linha__texto">
                  Conta Google vinculada
                  {usuario.google.email ? <small>{usuario.google.email}</small> : null}
                </span>
                <Check size={13} className="mp-linha__ok" aria-label="vinculada" />
              </div>
            ) : (
              <button
                type="button"
                className="mp-linha"
                onClick={() => { aoFechar(); aoVincularGoogle?.(); }}
                disabled={!google.disponivel}
                title={google.disponivel ? undefined : "Entrar com Google não está configurado neste ambiente"}
              >
                <span className="mp-linha__icone"><GoogleLogo size={17} /></span>
                <span className="mp-linha__texto">
                  Vincular conta Google
                  {!google.disponivel ? <small>indisponível</small> : null}
                </span>
              </button>
            )}
          </>
        }
      />

      <span className="mp-risco" role="separator" />

      {/* ── 2. De quem é esta conta, e em que plano ─────────────────────────
          Logo abaixo de quem VOCÊ é, porque as duas são identidade — e antes
          das preferências, que são ajuste. Ver `LinhaDaImobiliaria`. */}
      <LinhaDaImobiliaria
        tenant={tenant}
        podeVerPlano={Boolean(usuario?.cargo?.verConfiguracoes)}
        aoIr={() => { aoFechar(); navegar("/configuracoes?ver=plano"); }}
      />

      <span className="mp-risco" role="separator" />

      {/* ── 3. Preferências desta pessoa ───────────────────────────────────── */}
      <Linha
        Icone={GearSix}
        rotulo="Configurações"
        aoClicar={() => { aoFechar(); aoAbrirPreferencias(); }}
      />

      <span className="mp-risco" role="separator" />

      {/* ── 4. Ajuda ───────────────────────────────────────────────────────── */}
      <Linha
        Icone={Question}
        rotulo="Ajuda"
        aviso={chamados.novidades}
        temSubmenu
        subAberto={sub === "ajuda"}
        aoAbrirSub={() => abrirSub("ajuda")}
        aoFecharSub={fecharSub}
        aoClicar={() => abrirSub("ajuda")}
        submenu={
          <>
            <button type="button" className="mp-linha" onClick={() => { aoFechar(); aoAbrirChamado(); }}>
              <span className="mp-linha__icone"><Bug size={17} /></span>
              <span className="mp-linha__texto">Abrir um chamado</span>
            </button>
            {/* Onde a resposta chega. Sem esta linha o chamado saía daqui e
                sumia: a pessoa só ficava sabendo pelo e-mail. */}
            <button type="button" className="mp-linha" onClick={() => { aoFechar(); aoAbrirSuporte?.(); }}>
              <span className="mp-linha__icone"><ChatsCircle size={17} /></span>
              <span className="mp-linha__texto">
                Meus chamados
                {chamados.aguardando
                  ? <small>{chamados.aguardando === 1 ? "1 esperando você" : `${chamados.aguardando} esperando você`}</small>
                  : null}
              </span>
              {chamados.novidades ? <span className="mp-linha__aviso">{chamados.novidades > 9 ? "9+" : chamados.novidades}</span> : null}
            </button>
            {novidades.map((n) => (
              <button
                key={`${n.numero}-${n.atualizadoEm}`}
                type="button"
                className="mp-linha mp-novidade"
                onClick={() => { aoFechar(); aoAbrirSuporte?.(n.numero); }}
              >
                <span className="mp-novidade__ponto" aria-hidden="true" />
                <span className="mp-linha__texto">
                  {textoDaNovidade(n)}
                  {n.trecho ? <small>“{n.trecho.length > 70 ? `${n.trecho.slice(0, 70)}…` : n.trecho}”</small> : null}
                </span>
              </button>
            ))}
            <button type="button" className="mp-linha" onClick={() => { aoFechar(); aoAbrirAjuda(); }}>
              <span className="mp-linha__icone"><LifebuoyIcon size={17} /></span>
              <span className="mp-linha__texto">Central de ajuda</span>
            </button>
            {/* As Novidades de cada semana (a apresentação), e a versão no ar
                para a pessoa dizer ao suporte qual tem. */}
            <button type="button" className="mp-linha" onClick={() => { aoFechar(); aoAbrirNovidades?.(); }}>
              <span className="mp-linha__icone"><Notebook size={17} /></span>
              <span className="mp-linha__texto">
                Notas de versão
                {versao?.numero && versao.numero !== "dev" ? <small>você está na Omnimob {versao.numero}</small> : null}
              </span>
            </button>
            <span className="mp-risco" role="separator" />
            {/* Abrem em aba nova: são páginas públicas, e tirar alguém do painel
                no meio do trabalho para ler os termos é perder o que ela fazia. */}
            <a className="mp-linha" href="/termos" target="_blank" rel="noreferrer" onClick={aoFechar}>
              <span className="mp-linha__icone"><FileText size={17} /></span>
              <span className="mp-linha__texto">Termos de uso</span>
            </a>
            <a className="mp-linha" href="/privacidade" target="_blank" rel="noreferrer" onClick={aoFechar}>
              <span className="mp-linha__icone"><ShieldCheck size={17} /></span>
              <span className="mp-linha__texto">Política de privacidade</span>
            </a>
          </>
        }
      />

      <span className="mp-risco" role="separator" />

      {/* ── 4. Sair ────────────────────────────────────────────────────────── */}
      <Linha
        Icone={SignOut}
        rotulo="Sair"
        aoClicar={() => { aoFechar(); aoSair(); }}
      />
    </div>,
    document.body,
  );
}
