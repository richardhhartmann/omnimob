import { useEffect, useState } from "react";
import { Target } from "@phosphor-icons/react";
import { api } from "../api";

/* ────────────────────────────────────────────────────────────────────────────
   "Quem da minha carteira estava esperando por isto?"

   A mesma regra do bloco de perfis na ficha do cliente, lida do outro lado (ver
   `services/cruzamento.js` na API). Aqui ela vira uma lista de telefones para
   ligar hoje — que é o valor prático do cruzamento: o imóvel acabou de entrar e
   já se sabe para quem oferecer.

   O bloco SOME quando não há ninguém. Um cartão permanente dizendo "nenhum
   interessado" ocuparia espaço em todo imóvel para dar uma informação que não
   pede ação nenhuma.
   ──────────────────────────────────────────────────────────────────────────── */

export function InteressadosNoImovel({ propertyId, tenantSlug }) {
  const [lista, setLista] = useState(null);

  useEffect(() => {
    if (!tenantSlug || !propertyId) return;
    let vivo = true;
    api.interessadosNoImovel(tenantSlug, propertyId)
      .then((r) => { if (vivo) setLista(r.interessados || []); })
      /* Silencioso de propósito: quem não tem `gerenciarClientes` recebe 403
         aqui, e isso não é erro — é o bloco não existindo para essa pessoa. */
      .catch(() => { if (vivo) setLista([]); });
    return () => { vivo = false; };
  }, [tenantSlug, propertyId]);

  if (!lista || lista.length === 0) return null;

  return (
    <div className="glass-panel int-bloco">
      <div className="int-bloco__cabeca">
        <Target size={17} weight="duotone" />
        <strong>
          {lista.length === 1 ? "1 cliente da carteira" : `${lista.length} clientes da carteira`} procura
          {lista.length === 1 ? "" : "m"} algo assim
        </strong>
      </div>

      <ul className="int-lista">
        {lista.map((i) => {
          const whats = (i.cliente?.whatsapp || i.cliente?.telefone || "").replace(/\D/g, "");
          return (
            <li key={i.perfilId} className="int-item">
              <div className="int-item__quem">
                <span className="int-item__nome">{i.cliente?.nome}</span>
                <span className="int-item__perfil">{i.titulo}</span>
                {i.aproximado ? <span className="int-item__aprox">{i.motivos.join(", ")}</span> : null}
              </div>
              <div className="int-item__acoes">
                {whats ? (
                  <a href={`https://wa.me/${whats}`} target="_blank" rel="noreferrer" className="int-acao int-acao--whats">
                    WhatsApp
                  </a>
                ) : null}
                {i.cliente?.email ? (
                  <a href={`mailto:${i.cliente.email}`} className="int-acao">E-mail</a>
                ) : null}
                {!whats && !i.cliente?.email ? <span className="int-item__sem">Sem contato cadastrado</span> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
