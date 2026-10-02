import { Link } from "react-router-dom";
import { NavigationArrow } from "@phosphor-icons/react";
import { partesDaMensagem } from "../utils/mencoes";

/* O texto de uma fala do chamado, com as menções de tela ("@" do suporte —
   ver utils/mencoes.js) virando um selo clicável. Os dois lados usam:

   · o CLIENTE (Meus chamados) navega pelo roteador, para a tela citada;
   · o SUPORTE (super-admin) abre o caminho numa aba nova — o painel dele não é
     o da imobiliária, e sair da fila para conferir uma tela perderia o lugar.

   Endereço solto (https://…) também vira link, sempre em aba nova. */
const URL_SOLTA = /(https?:\/\/[^\s<]+)/gi;

function comLinks(texto, chave) {
  const pedacos = String(texto).split(URL_SOLTA);
  return pedacos.map((p, i) =>
    i % 2 === 1
      ? <a key={`${chave}-${i}`} href={p} target="_blank" rel="noopener noreferrer">{p}</a>
      : p,
  );
}

export function TextoDoChamado({ texto, abrirEmNovaAba = false, className = "ch-tela" }) {
  return (
    <>
      {partesDaMensagem(texto).map((p, i) => {
        if (p.texto != null) return <span key={i}>{comLinks(p.texto, i)}</span>;
        const conteudo = <><NavigationArrow size={11} weight="fill" />{p.rotulo}</>;
        return abrirEmNovaAba ? (
          <a key={i} href={p.caminho} target="_blank" rel="noopener noreferrer" className={className} title="Abrir esta tela">
            {conteudo}
          </a>
        ) : (
          <Link key={i} to={p.caminho} className={className} title="Ir para esta tela">{conteudo}</Link>
        );
      })}
    </>
  );
}
