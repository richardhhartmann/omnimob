import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import {
  GearSix, Question, SignOut, CaretRight, GoogleLogo, IdentificationBadge,
  LifebuoyIcon, Notebook, FileText, ShieldCheck, Bug, Check,
} from "@phosphor-icons/react";

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

function Linha({ Icone, rotulo, detalhe, aoClicar, temSubmenu, submenu, aoAbrirSub, aoFecharSub, subAberto }) {
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
        {temSubmenu ? <CaretRight size={13} className="mp-linha__seta" /> : null}
      </button>
      <Submenu aberto={subAberto}>{submenu}</Submenu>
    </div>
  );
}

export function MenuDoPerfil({
  aberto, aoFechar, usuario, tenant, ancoraRef,
  aoAbrirAjuda, aoAbrirChamado, aoAbrirPreferencias, aoAbrirPerfil, aoSair,
  aoVincularGoogle,
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

      {/* ── 2. Preferências desta pessoa ───────────────────────────────────── */}
      <Linha
        Icone={GearSix}
        rotulo="Configurações"
        aoClicar={() => { aoFechar(); aoAbrirPreferencias(); }}
      />

      <span className="mp-risco" role="separator" />

      {/* ── 3. Ajuda ───────────────────────────────────────────────────────── */}
      <Linha
        Icone={Question}
        rotulo="Ajuda"
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
            <button type="button" className="mp-linha" onClick={() => { aoFechar(); aoAbrirAjuda(); }}>
              <span className="mp-linha__icone"><LifebuoyIcon size={17} /></span>
              <span className="mp-linha__texto">Central de ajuda</span>
            </button>
            {/* Notas de versão não existem como página. Desabilitado e
                anunciado, pelo mesmo motivo do Google acima. */}
            <button type="button" className="mp-linha" disabled title="Ainda não disponível">
              <span className="mp-linha__icone"><Notebook size={17} /></span>
              <span className="mp-linha__texto">Notas de versão<small>em breve</small></span>
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
