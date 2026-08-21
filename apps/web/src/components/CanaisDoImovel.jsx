import { useEffect, useState } from "react";
import { api } from "../api";
import { RssSimple, Storefront, ArrowSquareOut } from "@phosphor-icons/react";
import { PORTAIS } from "../utils/portais.js";

/* ────────────────────────────────────────────────────────────────────────────
   Portais e Mercado Livre, no último passo do cadastro.

   ── POR QUE ELES NÃO SÃO "MAIS UM CARD DE REDE SOCIAL" ──

   Facebook, Instagram e WhatsApp publicam AGORA: aperta e o post existe. Estes
   dois não funcionam assim, e cada um por um motivo diferente:

   • PORTAIS (ZAP, VivaReal, OLX Imóveis) leem um arquivo XML no nosso servidor,
     por conta deles, uma vez por dia. Não existe "publicar agora" — existe
     estar ou não estar no arquivo quando a carga passar. O que esta tela
     oferece é a chave que decide isso, e o texto diz quando o anúncio aparece.

   • MERCADO LIVRE publica de verdade por API, mas exige conta conectada e um
     pacote de anúncios contratado com o comercial deles.

   ── UM CARD PARA TRÊS PORTAIS ──

   ZAP, VivaReal e OLX Imóveis leem O MESMO arquivo, no mesmo endereço. Três
   cards com três chaves seria mentira: não há como incluir o imóvel num e não
   no outro sem tirá-lo do arquivo, que é o que a chave única já faz. Os três
   nomes aparecem no card para quem procura por eles encontrar.

   ── QUANDO A AUTOMAÇÃO ESTÁ LIGADA, NÃO HÁ BOTÃO ──

   A imobiliária que ligou publicação automática em Configurações › Canais já
   decidiu. Oferecer aqui um botão de publicar, ou de desfazer, seria abrir uma
   segunda decisão sobre algo que já saiu — e no Mercado Livre isso significa um
   segundo anúncio do mesmo imóvel. O card mostra o estado e não pede nada.
   ──────────────────────────────────────────────────────────────────────────── */

function Card({ Icone, cor, nome, selo, seloTom = "neutro", children, acao }) {
  return (
    <div className="ci-card">
      <div className="ci-card__topo">
        <span className="ci-card__icone" style={{ background: cor }}><Icone size={16} weight="fill" color="#fff" /></span>
        <strong>{nome}</strong>
        {selo ? <span className={`ci-selo is-${seloTom}`}>{selo}</span> : null}
      </div>
      <p className="ci-card__texto">{children}</p>
      {acao}
    </div>
  );
}

export function CanaisDoImovel({
  tenantSlug, propertyId, publicarPortais, aoTrocarPortais, disabled,
}) {
  const [automacao, setAutomacao] = useState(null);
  const [canais, setCanais] = useState([]);
  const [publicandoML, setPublicandoML] = useState(false);
  const [resultadoML, setResultadoML] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!tenantSlug) return;
    /* Falha em silêncio: a central de canais é Profissional+, e quem está no
       Básico não tem nada disso. O cadastro não pode mostrar erro por causa de
       um recurso que aquele plano nem oferece. */
    api.getAutomacao(tenantSlug).then(setAutomacao).catch(() => {});
    api.listarCanais(tenantSlug).then((r) => setCanais(r.canais || [])).catch(() => {});
  }, [tenantSlug]);

  const auto = (id) => (automacao?.canais || []).find((c) => c.id === id)?.ligado === true;
  const ml = canais.find((c) => c.id === "mercadolivre");
  const mlConectado = Boolean(ml?.conectado);

  async function publicarNoML() {
    setPublicandoML(true);
    setErro("");
    try {
      const r = await api.publicarMercadoLivre(tenantSlug, propertyId);
      setResultadoML(r);
    } catch (e) {
      setErro(e.message || "O Mercado Livre recusou a publicação.");
    } finally {
      setPublicandoML(false);
    }
  }

  const mlAuto = auto("mercadoLivre");

  return (
    <div className="ci-grade">
      {/* ── Portais, um cartão por portal ────────────────────────────────
          Eram um cartão só ("ZAP · VivaReal · OLX"), porque os três leem o mesmo
          formato. Mas quem contrata é a imobiliária, e ela contrata um a um. */}
      {PORTAIS.map((portal) => {
        const automatico = auto(`portais:${portal.id}`);
        const dentro = portais.includes(portal.id);
        return (
          <Card
            key={portal.id}
            Icone={RssSimple}
            cor={portal.cor}
            nome={portal.nome}
            selo={automatico ? "automático" : dentro ? "incluído" : "fora"}
            seloTom={automatico ? "auto" : dentro ? "on" : "off"}
            acao={
              automatico ? null : (
                <label className="ci-chave">
                  <input
                    type="checkbox"
                    className="sw"
                    checked={dentro}
                    onChange={(e) => aoTrocarPortais(portal.id, e.target.checked)}
                    disabled={disabled}
                  />
                  <span>Incluir este imóvel</span>
                </label>
              )
            }
          >
            {automatico ? (
              <>Este imóvel entra no arquivo do {portal.nome} automaticamente. O portal busca uma
              vez por dia — o anúncio costuma aparecer no dia seguinte.</>
            ) : (
              <>O {portal.nome} lê um arquivo no nosso servidor, uma vez por dia. Marcado, o imóvel
              entra na próxima carga; não existe publicar agora.</>
            )}
          </Card>
        );
      })}

      {/* ── Mercado Livre ───────────────────────────────────────────────── */}
      <Card
        Icone={Storefront}
        cor="#ffe600"
        nome="Mercado Livre"
        selo={
          mlAuto ? "automático"
          : resultadoML ? "publicado"
          : mlConectado ? "pronto" : "não conectado"
        }
        seloTom={mlAuto ? "auto" : resultadoML ? "on" : mlConectado ? "neutro" : "off"}
        acao={
          mlAuto || resultadoML ? null : mlConectado ? (
            <button
              type="button"
              className="ci-botao"
              onClick={publicarNoML}
              disabled={publicandoML || disabled || !propertyId}
            >
              {publicandoML ? "Publicando…" : "Publicar anúncio"}
            </button>
          ) : null
        }
      >
        {mlAuto ? (
          <>O anúncio é criado sozinho assim que o imóvel é cadastrado.</>
        ) : resultadoML ? (
          <>
            Anúncio criado.{" "}
            {resultadoML.permalink ? (
              <a href={resultadoML.permalink} target="_blank" rel="noreferrer" className="ci-link">
                Ver no Mercado Livre <ArrowSquareOut size={12} />
              </a>
            ) : null}
          </>
        ) : mlConectado ? (
          <>Publica de verdade, na hora. Exige um pacote de anúncios contratado com o comercial
          deles — sem ele a conexão funciona e a publicação é recusada.</>
        ) : (
          <>Conecte a conta em <strong>Configurações › Canais</strong> para publicar por aqui.</>
        )}
      </Card>

      {erro ? <p className="ci-erro">{erro}</p> : null}
    </div>
  );
}
