import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { enderecoVisivel } from "../utils/enderecoVitrine";
import { provedorDoEmail } from "../utils/provedorEmail";
import { planoLiberaDominio, planoInfo } from "../utils/planos";
import { formatPhone } from "../utils/masks";
import { slugify, motivoLocal, MOTIVO_SLUG } from "../utils/slug";
import { MODAL_CSS } from "./modalCSS";
import { SelectCustom } from "./SelectCustom";
import { IconeEnvelope } from "./Icones.jsx";
import SpecularButton from "./SpecularButton";

/* Botão de ação do modal, no mesmo vidro especular dos botões da landing — é
   dela que este modal é aberto, e um botão de outro idioma no meio do caminho
   denuncia a emenda.

   As classes .pm-botao ficam: o layout das linhas de ação (.pm-acoes, e a regra
   que estica os três para largura cheia no celular) pendura nelas. O modificador
   --especular é quem vence a aparência, sem tocar em .pm-botao — que a
   TrialConfirmarPage também usa, e essa página não estava no pedido. */
function BotaoModal({ primario = false, className = "", children, ...resto }) {
  const cfg = primario
    ? { tint: "#ffffff", tintOpacity: 0.16, textColor: "#f6f6f8", lineColor: "#ffffff", baseColor: "#8a8a95", intensity: 1.35 }
    : { tint: "#ffffff", tintOpacity: 0.03, textColor: "#e7e7ec", lineColor: "#ffffff", baseColor: "#4a4a52", intensity: 0.85 };
  return (
    <SpecularButton
      className={`pm-botao${primario ? " pm-botao--primario" : ""} pm-botao--especular${className ? ` ${className}` : ""}`}
      radius={999}
      /* Curto de propósito: dentro do modal os botões ficam a centímetros uns
         dos outros, e o alcance de 250 da landing acenderia os três de uma vez —
         some justamente a informação de qual deles o cursor está mirando. */
      proximity={140}
      {...cfg}
      {...resto}
    >
      {children}
    </SpecularButton>
  );
}

/* O desenho de cada perfil, num tamanho só de parâmetro: ele aparece duas vezes
   no cartão — pequeno na pastilha do ícone e gigante na marca-d'água do fundo —
   e duplicar o path seria duas coisas para manter em sincronia. */
function Desenho({ tipo, tamanho }) {
  const comum = {
    width: tamanho, height: tamanho, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round",
  };
  return tipo === "nova" ? (
    <svg {...comum}>
      <path d="M3 21h18" /><path d="M5 21V8l7-5 7 5v13" />
      <path d="M10 21v-6h4v6" />
    </svg>
  ) : (
    <svg {...comum}>
      <rect x="3" y="8" width="8" height="13" rx="1" />
      <rect x="13" y="3" width="8" height="18" rx="1" />
      <path d="M6 12h2M6 16h2M16 7h2M16 11h2M16 15h2" />
    </svg>
  );
}

/* As duas portas, lado a lado.

   A etiqueta e o rótulo da ação são novos, e existem pelo mesmo motivo: no
   celular o cartão vira meia tela, e "ícone + título + parágrafo + seta solta"
   é pouco para esse tamanho — sobrava ar no meio e a seta boiava sem dizer para
   onde levava.

   As duas portas continuam simétricas de propósito: mesma etiqueta em forma,
   mesma cor, mesmo peso de ação. Um cartão dourado e outro roxo daria a
   entender que recomendamos um dos caminhos, e a escolha é do cliente. */
const PERFIS = [
  {
    chave: "nova",
    tag: "DO ZERO",
    titulo: "Estou abrindo agora",
    texto: "Vou começar do zero com a Omnimob. Quero cadastrar meus primeiros imóveis e colocar a vitrine no ar.",
    acao: "Começar do zero",
  },
  {
    chave: "existente",
    tag: "JÁ EM OPERAÇÃO",
    titulo: "Já tenho uma imobiliária",
    texto: "Já opero, com carteira e clientes em outro sistema ou em planilhas. Quero trazer isso para a Omnimob.",
    acao: "Trazer minha base",
  },
];

/* As duas portas do primeiro passo, no mesmo vidro. Diferente dos botões de
   ação, o cartão tem layout PRÓPRIO — uma grade de quatro linhas (ícone,
   título, texto, seta) — e por isso vai com `envolver={false}`: dentro do
   invólucro de rótulo os quatro filhos viravam um item de grade só, e a seta
   ancorada na última linha perdia o pé do cartão.

   O alcance é maior que o dos botões de ação porque o alvo também é: são dois
   cartões grandes lado a lado (ou um sobre o outro no celular), e com 140 a luz
   só aparecia quando o cursor já estava quase dentro. */
function OpcaoPerfil({ children, ...resto }) {
  return (
    <SpecularButton
      className="tm-opcao tm-opcao--especular"
      envolver={false}
      radius={16}
      tint="#ffffff"
      tintOpacity={0.05}
      textColor="#e7e7ec"
      lineColor="#ffffff"
      baseColor="#4a4a52"
      intensity={1.05}
      proximity={230}
      {...resto}
    >
      {children}
    </SpecularButton>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Teste grátis com auto-atendimento — a ÚNICA porta de entrada da landing.

   Não existe mais "assinar sem testar": quem quer a Omnimob testa primeiro, e
   assina de dentro do painel. Isso simplifica a promessa da página (um botão,
   um caminho) e tira do ar o fluxo em que alguém digitava o cartão antes de
   ver o produto.

   O ambiente NÃO nasce aqui: este passo só dispara um link de confirmação por
   e-mail. O tenant é criado quando a pessoa abre esse link (TrialConfirmarPage),
   o que prova a posse do endereço — sem isso, qualquer um criaria ambientes em
   nome de terceiros.

   TRÊS PASSOS, e o do meio é o único obrigatório:

     perfil   → está abrindo a imobiliária agora ou já tem uma rodando?
     dados    → nome, e-mail, telefone
     migração → só para quem já tem: o que existe hoje e como trazer para cá

   O passo de perfil abre o modal porque a resposta muda o resto da conversa.
   Quem está começando não tem nada para importar e o caminho curto é o certo.
   Quem já opera tem uma base inteira em outro sistema, e o medo de perdê-la é
   o que trava a decisão — perguntar isso ANTES do cadastro é o que permite
   responder a esse medo em vez de ignorá-lo.
   ──────────────────────────────────────────────────────────────────────────── */

const VAZIO = { plano: "", imobiliaria: "", email: "", telefone: "", website: "" };

const MIGRACAO_VAZIA = { sistemaAtual: "", itens: [], volume: "", formato: "", observacao: "" };

/* O que a imobiliária pode querer trazer. A lista espelha o que a Omnimob tem
   hoje: prometer importação de contrato ou financeiro seria vender módulo que
   ainda não existe. */
const ITENS_MIGRACAO = [
  { valor: "imoveis",  rotulo: "Imóveis e fotos" },
  { valor: "clientes", rotulo: "Clientes" },
  { valor: "leads",    rotulo: "Leads" },
  { valor: "usuarios", rotulo: "Usuários e cargos" },
];

const VOLUMES = ["Até 50", "51 a 200", "201 a 500", "Mais de 500"];

/* Quanto tempo sem digitar antes de perguntar ao servidor se o endereço está
   livre. Curto o bastante para a resposta chegar antes de a pessoa passar para
   o campo seguinte, longo o bastante para não consultar letra por letra. */
const ESPERA_SLUG = 450;

/* O endereço da vitrine que aparece enquanto a pessoa digita o nome da
   imobiliária sai de `enderecoVisivel`, a mesma função que monta os links de
   verdade no painel. Antes era montado aqui com `/vitrine/` cravado, e no dia
   em que o subdomínio for ligado esta tela continuaria anunciando o formato
   antigo — prometendo um endereço e entregando outro. */

const SLUG_VAZIO = { valor: "", estado: "vazio", mensagem: "" };

// Selo ao lado do endereço. O estado "vazio" não diz nada de propósito: quem
// mal começou a digitar não tem o que ser avisado.
const SELO_SLUG = {
  vazio: "",
  checando: "verificando…",
  livre: "✓ disponível",
  indisponivel: "✕ indisponível",
  erro: "não verificado",
};

/* Como os dados podem sair de lá. É a pergunta que decide o custo da migração,
   e por isso ela é feita agora e não na primeira reunião. "Não sei" é resposta
   legítima e a mais comum — quem cuida disso costuma ser o fornecedor antigo. */
const FORMATOS = [
  { valor: "planilha",   rotulo: "Possuo planilha ou CSV" },
  { valor: "exportacao", rotulo: "Consigo exportar do sistema atual" },
  { valor: "api",        rotulo: "Meu sistema possui API" },
  { valor: "nao_sei",    rotulo: "Não sei como exportar" },
];

function validar(form) {
  const erros = {};
  /* O plano é OBRIGATÓRIO. O teste passou a valer o plano escolhido — quem não
     escolhe não tem o que testar, e um default silencioso entregaria Premium a
     quem pediu Básico e frustraria o contrário. */
  if (!form.plano) erros.plano = "Escolha o plano que você quer testar.";
  if (form.imobiliaria.trim().length < 2) erros.imobiliaria = "Informe o nome da imobiliária.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) erros.email = "E-mail inválido.";
  return erros;
}

export function TrialModal({ aberto, aoFechar, planos = [], planoDesejado = "" }) {
  const [passo, setPasso] = useState("perfil");
  const [perfil, setPerfil] = useState("");        // "nova" | "existente"
  const [form, setForm] = useState(VAZIO);
  const [migracao, setMigracao] = useState(MIGRACAO_VAZIA);
  const [erros, setErros] = useState({});
  const [criando, setCriando] = useState(false);
  const [enviado, setEnviado] = useState(false);   // link de confirmação a caminho

  /* Provedor reconhecido pelo domínio do e-mail digitado, para o atalho da tela
     de confirmação. Derivado, não guardado em estado: ele muda junto com o
     campo e não tem vida própria. */
  const provedor = provedorDoEmail(form.email);
  const [falha, setFalha] = useState("");
  /* Endereço da vitrine, derivado do nome da imobiliária.
     estado: "vazio" | "checando" | "livre" | "indisponivel" | "erro" */
  const [slug, setSlug] = useState(SLUG_VAZIO);
  const caixaRef = useRef(null);
  const primeiroRef = useRef(null); // campo do nome da imobiliária
  const focoAnteriorRef = useRef(null); // devolve o foco ao gatilho quando o modal fecha

  useEffect(() => {
    if (!aberto) return;
    setPasso("perfil");
    setPerfil("");
    setForm({ ...VAZIO, plano: planoDesejado || "" });
    setMigracao(MIGRACAO_VAZIA);
    setErros({});
    setEnviado(false);
    setFalha("");
    setCriando(false);
    setSlug(SLUG_VAZIO);
  }, [aberto, planoDesejado]);

  /* ── Endereço da vitrine ────────────────────────────────────────────────
     O slug nasce do nome da imobiliária, e dois tenants não podem dividir o
     mesmo. Descobrir isso só na criação do ambiente seria tarde: ou a pessoa
     ganharia um endereço com sufixo que ela não escolheu, ou o cadastro
     falharia depois de tudo preenchido. Aqui o conflito aparece enquanto o
     nome ainda está sendo digitado, que é quando ele custa um clique.

     O que dá para julgar sem rede (tamanho, caracteres, nomes reservados) é
     julgado na hora; só o "esse já é de alguém" precisa do servidor, e essa
     pergunta espera a digitação parar. A resposta anterior é abortada a cada
     tecla, então uma consulta lenta nunca sobrescreve uma mais nova. */
  const nomeDigitado = form.imobiliaria;
  useEffect(() => {
    if (!aberto) return undefined;

    const bruto = nomeDigitado.trim();
    const valor = slugify(bruto);

    // Ainda no começo da digitação: mostra o endereço se formando, sem cobrar
    // nada de quem mal começou a escrever.
    if (bruto.length < 2) {
      setSlug({ valor, estado: "vazio", mensagem: "" });
      return undefined;
    }

    const motivo = motivoLocal(bruto);
    if (motivo) {
      setSlug({ valor, estado: "indisponivel", mensagem: MOTIVO_SLUG[motivo] });
      return undefined;
    }

    setSlug({ valor, estado: "checando", mensagem: "" });

    const controle = new AbortController();
    const timer = setTimeout(() => {
      api
        .verificarSlugOmnimob(bruto, { signal: controle.signal })
        .then((r) =>
          setSlug({
            valor: r.slug || valor,
            estado: r.disponivel ? "livre" : "indisponivel",
            mensagem: r.mensagem || "",
          }),
        )
        .catch((erro) => {
          if (erro.name === "AbortError") return;
          // Sem resposta não dá para afirmar nada — e travar o cadastro por
          // causa de uma consulta que caiu seria pior que deixar seguir: o
          // servidor confere de novo no envio.
          setSlug({ valor, estado: "erro", mensagem: "" });
        });
    }, ESPERA_SLUG);

    return () => {
      clearTimeout(timer);
      controle.abort();
    };
  }, [aberto, nomeDigitado]);

  useEffect(() => {
    if (!aberto) return undefined;
    focoAnteriorRef.current = document.activeElement;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = anterior;
      focoAnteriorRef.current?.focus?.();
    };
  }, [aberto]);

  // O foco entra no primeiro campo quando o passo de dados abre — não na
  // abertura do modal, que agora começa por dois botões.
  useEffect(() => {
    if (!aberto || passo !== "dados") return undefined;
    const foco = setTimeout(() => primeiroRef.current?.focus(), 60);
    return () => clearTimeout(foco);
  }, [aberto, passo]);

  useEffect(() => {
    if (!aberto) return undefined;
    function aoTeclar(evento) {
      if (evento.key === "Escape") {
        evento.preventDefault();
        evento.stopPropagation();
        aoFechar();
        return;
      }
      if (evento.key !== "Tab") return;
      const alvos = caixaRef.current?.querySelectorAll(
        "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex='-1'])",
      );
      if (!alvos?.length) return;
      const primeiro = alvos[0];
      const ultimo = alvos[alvos.length - 1];
      if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto, aoFechar]);

  if (!aberto) return null;

  const planoEscolhido = planos.find((p) => p.key === form.plano) || null;
  const recursosDoPlano = planoEscolhido?.linhas?.filter((l) => l.incluso) || [];
  const totalPassos = perfil === "existente" ? 3 : 2;

  function definir(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
    setErros((e) => (e[campo] ? { ...e, [campo]: undefined } : e));
  }

  function alternarItem(valor) {
    setMigracao((m) => ({
      ...m,
      itens: m.itens.includes(valor) ? m.itens.filter((i) => i !== valor) : [...m.itens, valor],
    }));
  }

  function escolherPerfil(qual) {
    setPerfil(qual);
    setPasso("dados");
  }

  /* Avança do cadastro. Para quem está abrindo a imobiliária o teste sai daqui
     mesmo; para quem já tem uma, ainda falta a conversa sobre a base atual. */
  function seguirDosDados(evento) {
    evento.preventDefault();
    const achados = validar(form);
    setErros(achados);
    if (Object.keys(achados).length) return;
    /* O botão já fica desligado nestes dois casos; a trava aqui é para o Enter,
       que envia o formulário sem passar por ele. O aviso vermelho embaixo do
       campo já está na tela — só falta levar o cursor até lá. */
    if (slug.estado === "indisponivel" || slug.estado === "checando") {
      primeiroRef.current?.focus();
      return;
    }
    if (perfil === "existente") {
      setFalha("");
      setPasso("migracao");
      return;
    }
    criar();
  }

  /* `comMigracao` distingue "enviou o formulário de migração" de "pulou": pular
     não pode mandar um objeto vazio, que na caixa de entrada do time viraria
     uma migração pedida sem nenhum dado. */
  async function criar(comMigracao = false) {
    setCriando(true);
    setFalha("");
    try {
      await api.criarTrialOmnimob({
        imobiliaria: form.imobiliaria.trim(),
        email: form.email.trim(),
        telefone: form.telefone.trim(),
        website: form.website,
        perfil: perfil || "nova",
        planoDesejado: form.plano,
        migracao: comMigracao
          ? {
              sistemaAtual: migracao.sistemaAtual.trim(),
              itens: migracao.itens,
              volume: migracao.volume,
              formato: migracao.formato,
              observacao: migracao.observacao.trim(),
            }
          : undefined,
      });
      setEnviado(true);
    } catch (erro) {
      /* O servidor confere o endereço de novo na hora do envio, e ele pode ter
         sido levado por outra imobiliária entre a digitação e o clique. Quando
         é isso, o erro pertence ao campo do nome — volta para lá em vez de
         virar um aviso genérico no rodapé da etapa de migração. */
      if (erro.body?.code === "SLUG_INDISPONIVEL") {
        setSlug({
          valor: erro.body.slug || slug.valor,
          estado: "indisponivel",
          mensagem: erro.message,
        });
        setFalha("");
        setPasso("dados");
        setTimeout(() => primeiroRef.current?.focus(), 60);
        return;
      }
      setFalha(erro.message || "Não foi possível criar o ambiente agora.");
    } finally {
      setCriando(false);
    }
  }

  /* O véu não fecha ao clique. Aqui dentro a pessoa está digitando dados de
     cadastro; um clique fora por engano apagaria tudo. Para sair existem o ✕,
     os botões de voltar/cancelar e o Esc — saídas deliberadas. */
  return (
    <div className="pm-veu">
      <style>{CSS}</style>

      <div
        className={`pm-caixa dl-glass tm-caixa-v2 tm-caixa--${enviado ? "pronto" : passo}`}
        ref={caixaRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tm-titulo"
      >
        <button type="button" className="pm-fechar" onClick={aoFechar} aria-label="Fechar">
          <span aria-hidden="true">✕</span>
        </button>

        {enviado ? (
          <div className="tm-pronto">
            <div className="tm-pronto__halo" aria-hidden="true" />
            <span className="tm-envelope" aria-hidden="true"><IconeEnvelope size={26} /></span>
            <span className="dl-mono pm-eyebrow tm-eyebrow">● LINK DE CONFIRMAÇÃO ENVIADO</span>
            <h2 id="tm-titulo" className="pm-titulo">Seu próximo passo está no e-mail.</h2>
            <p className="pm-sub">
              Mandamos o link para <strong>{form.email}</strong>. Ao abrir, o ambiente da{" "}
              <strong>{form.imobiliaria}</strong> é criado na hora.
            </p>

            <div className="tm-pronto__cartoes">
              <div className="tm-aviso">
                <span className="tm-aviso__num">30</span>
                <span>
                  <strong>minutos de validade</strong>
                  Se não aparecer em alguns instantes, confira também a caixa de spam.
                </span>
              </div>

              {perfil === "existente" ? (
                <div className="tm-aviso tm-aviso--migracao">
                  <span className="tm-aviso__num">↗</span>
                  <span>
                    <strong>Sua migração já entrou na conversa</strong>
                    Um especialista responde nesse mesmo e-mail para combinar a importação com você.
                  </span>
                </div>
              ) : null}
            </div>

            <div className="pm-acoes tm-acoes tm-pronto__acoes">
              {provedor ? (
                <>
                  <BotaoModal onClick={aoFechar}>Entendi</BotaoModal>
                  <BotaoModal
                    as="a"
                    primario
                    href={provedor.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={aoFechar}
                  >
                    Abrir {provedor.nome}
                  </BotaoModal>
                </>
              ) : (
                <BotaoModal primario onClick={aoFechar}>Entendi</BotaoModal>
              )}
            </div>

            <p className="tm-rodape">Sem cartão. O ambiente só nasce depois que você confirma o e-mail.</p>
          </div>
        ) : passo === "perfil" ? (
          <div className="tm-painel tm-painel--perfil">
            <section className="tm-intro">
              <span className="dl-mono pm-eyebrow tm-eyebrow">● TESTE GRÁTIS POR 14 DIAS</span>
              <h2 id="tm-titulo" className="pm-titulo">
                Vamos preparar a Omnimob para o seu momento.
              </h2>
              <p className="pm-sub">
                Primeiro, conte onde a sua operação está hoje. Isso muda o caminho do teste — e evita
                perguntas que não fazem sentido para você.
              </p>

              <div className="tm-sinais" aria-label="Informações do teste">
                <span><b>14 dias</b><small>para explorar</small></span>
                <span><b>Sem cartão</b><small>para começar</small></span>
                <span><b>Seu ambiente</b><small>com vitrine própria</small></span>
              </div>
            </section>

            <section className="tm-escolha-wrap" aria-label="Escolha o seu momento">
              <div className="tm-escolha">
                {PERFIS.map((p) => (
                  <OpcaoPerfil key={p.chave} onClick={() => escolherPerfil(p.chave)}>
                    <span className="tm-opcao__marca" aria-hidden="true">
                      <Desenho tipo={p.chave} tamanho={190} />
                    </span>
                    <span className="tm-opcao__icone" aria-hidden="true">
                      <Desenho tipo={p.chave} tamanho={22} />
                    </span>
                    <span className="dl-mono tm-opcao__tag">{p.tag}</span>
                    <span className="tm-opcao__titulo">{p.titulo}</span>
                    <span className="tm-opcao__texto">{p.texto}</span>
                    <span className="tm-opcao__acao">
                      <span className="tm-opcao__rotulo">{p.acao}</span>
                      <span className="tm-opcao__seta" aria-hidden="true">→</span>
                    </span>
                  </OpcaoPerfil>
                ))}
              </div>

              <p className="tm-rodape">
                Você não fica preso à escolha: ela só personaliza os próximos passos.
              </p>
            </section>
          </div>
        ) : passo === "migracao" ? (
          <div className="tm-painel tm-painel--etapa">
            <aside className="tm-etapa__aside">
              <div>
                <span className="dl-mono pm-eyebrow tm-eyebrow">● TRAZER A SUA BASE</span>
                <span className="tm-passo">ETAPA 3 DE 3</span>
                <h2 id="tm-titulo" className="pm-titulo">
                  Sua carteira vem junto. Você não recomeça do zero.
                </h2>
                <p className="pm-sub">
                  Conte o que existe hoje. Um especialista responde no seu e-mail com o melhor caminho
                  para importar a base dentro do próprio teste.
                </p>
              </div>

              <div className="tm-etapas" aria-label="Progresso do cadastro">
                <span className="is-ok"><b>1</b><small>Momento</small></span>
                <span className="is-ok"><b>2</b><small>Dados</small></span>
                <span className="is-on"><b>3</b><small>Migração</small></span>
              </div>

              <div className="tm-aside-card">
                <span className="dl-mono">SEU CAMINHO</span>
                <strong>Imobiliária em operação</strong>
                <p>Você pode pular esta etapa e começar o teste normalmente.</p>
              </div>
            </aside>

            <div className="tm-etapa__corpo">
              <div className="tm-form-cab">
                <strong>Sobre a sua base atual</strong>
                <span>Tudo aqui é opcional.</span>
              </div>

              <div className="pm-form">
                <label className="pm-campo">
                  <span className="pm-rotulo">
                    Qual sistema você usa hoje? <em className="tm-opcional">opcional</em>
                  </span>
                  <input
                    className="pm-entrada"
                    value={migracao.sistemaAtual}
                    onChange={(e) => setMigracao((m) => ({ ...m, sistemaAtual: e.target.value }))}
                    placeholder="Nome do sistema, ou “planilhas do Excel”"
                    maxLength={120}
                  />
                </label>

                <div className="pm-campo">
                  <span className="pm-rotulo">O que você quer trazer?</span>
                  <div className="tm-fichas">
                    {ITENS_MIGRACAO.map((item) => (
                      <button
                        key={item.valor}
                        type="button"
                        className={`tm-ficha${migracao.itens.includes(item.valor) ? " is-on" : ""}`}
                        aria-pressed={migracao.itens.includes(item.valor)}
                        onClick={() => alternarItem(item.valor)}
                      >
                        <span className="tm-ficha__check" aria-hidden="true">✓</span>
                        {item.rotulo}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pm-campo">
                  <span className="pm-rotulo">Quantos imóveis, mais ou menos?</span>
                  <div className="tm-fichas">
                    {VOLUMES.map((v) => (
                      <button
                        key={v}
                        type="button"
                        className={`tm-ficha${migracao.volume === v ? " is-on" : ""}`}
                        aria-pressed={migracao.volume === v}
                        onClick={() => setMigracao((m) => ({ ...m, volume: m.volume === v ? "" : v }))}
                      >
                        <span className="tm-ficha__radio" aria-hidden="true" />
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pm-campo">
                  <span className="pm-rotulo">Como os dados podem sair de lá?</span>
                  <div className="tm-fichas tm-fichas--formatos">
                    {FORMATOS.map((f) => (
                      <button
                        key={f.valor}
                        type="button"
                        className={`tm-ficha${migracao.formato === f.valor ? " is-on" : ""}`}
                        aria-pressed={migracao.formato === f.valor}
                        onClick={() => setMigracao((m) => ({ ...m, formato: m.formato === f.valor ? "" : f.valor }))}
                      >
                        <span className="tm-ficha__radio" aria-hidden="true" />
                        {f.rotulo}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="pm-campo">
                  <span className="pm-rotulo">
                    Mais alguma coisa? <em className="tm-opcional">opcional</em>
                  </span>
                  <textarea
                    className="pm-entrada tm-area"
                    rows={3}
                    maxLength={500}
                    value={migracao.observacao}
                    onChange={(e) => setMigracao((m) => ({ ...m, observacao: e.target.value }))}
                    placeholder="Prazos, quem cuida do sistema atual, o que não pode parar…"
                  />
                </label>

                {falha ? <p className="pm-falha">{falha}</p> : null}

                <div className="pm-acoes pm-acoes--tres">
                  <BotaoModal onClick={() => setPasso("dados")} disabled={criando}>
                    Voltar
                  </BotaoModal>
                  <BotaoModal onClick={() => criar(false)} disabled={criando}>
                    Pular por enquanto
                  </BotaoModal>
                  <BotaoModal primario onClick={() => criar(true)} disabled={criando}>
                    {criando ? "Preparando ambiente…" : "Começar o teste"}
                  </BotaoModal>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="tm-painel tm-painel--etapa">
            <aside className="tm-etapa__aside">
              <div>
                <span className="dl-mono pm-eyebrow tm-eyebrow">● TESTE GRÁTIS POR 14 DIAS</span>
                <span className="tm-passo">ETAPA 2 DE {totalPassos}</span>
                <h2 id="tm-titulo" className="pm-titulo">
                  Agora, só o necessário para criar seu ambiente.
                </h2>
                <p className="pm-sub">
                  Escolha o plano, dê um nome à imobiliária e informe seu e-mail. O restante você
                  configura com calma depois.
                </p>
              </div>

              <div className="tm-etapas" aria-label="Progresso do cadastro">
                <span className="is-ok"><b>1</b><small>Momento</small></span>
                <span className="is-on"><b>2</b><small>Dados</small></span>
                {perfil === "existente" ? <span><b>3</b><small>Migração</small></span> : null}
              </div>

              <div className="tm-aside-card">
                <span className="dl-mono">SEU CAMINHO</span>
                <strong>{perfil === "existente" ? "Imobiliária em operação" : "Começando agora"}</strong>
                <p>
                  {planoEscolhido
                    ? `Plano ${planoEscolhido.name} selecionado para o teste.`
                    : "Você escolhe o plano do teste no formulário ao lado."}
                </p>
              </div>
            </aside>

            <div className="tm-etapa__corpo">
              <form className="pm-form" onSubmit={seguirDosDados} noValidate>
                <div className="tm-form-cab">
                  <strong>Dados do ambiente</strong>
                  <span>Leva menos de um minuto.</span>
                </div>

                <div className="pm-campo">
                  <span className="pm-rotulo">Plano que você quer testar</span>
                  <SelectCustom
                    id="tm-plano"
                    ariaLabel="Plano do teste"
                    value={form.plano}
                    placeholder="Escolha um plano…"
                    invalid={Boolean(erros.plano)}
                    options={planos.map((p) => ({
                      value: p.key,
                      label: p.name,
                      description: `${p.price}${p.per || ""}`,
                    }))}
                    onChange={(v) => definir("plano", v)}
                  />
                  {erros.plano ? <span className="pm-erro">{erros.plano}</span> : null}
                </div>

                {planoEscolhido ? (
                  <div className="pm-resumo">
                    <div className="pm-resumo__topo">
                      <div>
                        <span className="dl-mono">PLANO {planoEscolhido.name}</span>
                        <p className="pm-resumo__desc">{planoEscolhido.desc}</p>
                      </div>
                      <strong>{planoEscolhido.price}<small>{planoEscolhido.per || ""}</small></strong>
                    </div>

                    <ul className="pm-resumo__lista">
                      {recursosDoPlano.slice(0, 4).map((l) => (
                        <li key={l.label}>{l.label}</li>
                      ))}
                      {recursosDoPlano.length > 4 ? (
                        <li className="is-mais">+ {recursosDoPlano.length - 4} recursos incluídos</li>
                      ) : null}
                    </ul>

                    <span className="dl-mono pm-resumo__nota">
                      // 14 dias com estes recursos, sem cartão
                    </span>
                  </div>
                ) : null}

                <label className="pm-campo">
                  <span className="pm-rotulo">Nome da imobiliária</span>
                  <input
                    ref={primeiroRef}
                    className={`pm-entrada${erros.imobiliaria || slug.estado === "indisponivel" ? " is-erro" : ""}`}
                    value={form.imobiliaria}
                    onChange={(e) => definir("imobiliaria", e.target.value)}
                    placeholder="Imobiliária Centro"
                    autoComplete="organization"
                    aria-describedby={form.imobiliaria.trim() ? "tm-endereco" : undefined}
                  />
                  {erros.imobiliaria ? <span className="pm-erro">{erros.imobiliaria}</span> : null}

                  {form.imobiliaria.trim() ? (
                    <span className={`tm-endereco is-${slug.estado}`} id="tm-endereco" aria-live="polite">
                      <span className="tm-endereco__linha">
                        <span className="dl-mono tm-endereco__url">
                          <b>{enderecoVisivel(slug.valor)}</b>
                        </span>
                        <span className="tm-endereco__selo">{SELO_SLUG[slug.estado]}</span>
                      </span>
                      <span className="tm-endereco__nota">
                        {slug.mensagem || "Este será o endereço padrão da sua vitrine pública."}
                      </span>

                      {planoLiberaDominio(form.plano) ? (
                        <span className="tm-endereco__bonus">
                          Se a sua imobiliária já tem domínio próprio, dá para usá-lo no lugar deste —
                          o plano {planoInfo(form.plano).nome} inclui isso.
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </label>

                <div className="pm-dupla">
                  <label className="pm-campo">
                    <span className="pm-rotulo">E-mail</span>
                    <input
                      type="email"
                      className={`pm-entrada${erros.email ? " is-erro" : ""}`}
                      value={form.email}
                      onChange={(e) => definir("email", e.target.value)}
                      placeholder="voce@imobiliaria.com.br"
                      autoComplete="email"
                    />
                    {erros.email ? <span className="pm-erro">{erros.email}</span> : null}
                  </label>

                  <label className="pm-campo">
                    <span className="pm-rotulo">
                      Telefone <em className="tm-opcional">opcional</em>
                    </span>
                    <input
                      inputMode="tel"
                      className="pm-entrada"
                      value={form.telefone}
                      onChange={(e) => definir("telefone", formatPhone(e.target.value))}
                      placeholder="(11) 99999-9999"
                      autoComplete="tel"
                    />
                  </label>
                </div>

                <input
                  className="pm-isca"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  value={form.website}
                  onChange={(e) => definir("website", e.target.value)}
                />

                {falha ? <p className="pm-falha">{falha}</p> : null}

                <div className="pm-acoes">
                  <BotaoModal onClick={() => setPasso("perfil")} disabled={criando}>
                    Voltar
                  </BotaoModal>
                  <BotaoModal
                    primario
                    type="submit"
                    disabled={criando || slug.estado === "indisponivel" || slug.estado === "checando"}
                  >
                    {criando
                      ? "Preparando ambiente…"
                      : slug.estado === "checando" ? "Verificando endereço…"
                      : perfil === "existente" ? "Continuar" : "Começar o teste"}
                  </BotaoModal>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );

}

/* A folha comum (.pm-*) vem do módulo compartilhado; aqui só o que é próprio
   da tela de acesso. */
const CSS = `${MODAL_CSS}
/* OMNIMOB_TRIAL_MODAL_V2_START
   Trial Modal V2 — composição editorial e responsiva.
   Este bloco vem DEPOIS de MODAL_CSS e, por isso, consegue refinar o modal sem
   mudar a folha compartilhada pela TrialConfirmarPage. */

/* ── Palco ─────────────────────────────────────────────────────────────── */
.pm-veu {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28px;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 8%, rgba(99,102,241,0.13), transparent 34%),
    rgba(3,4,8,0.76);
  backdrop-filter: blur(18px) saturate(0.85);
  -webkit-backdrop-filter: blur(18px) saturate(0.85);
}

.pm-caixa.tm-caixa-v2 {
  --tm-fundo: #0d0d10;
  --tm-painel: #111116;
  --tm-painel-2: #15151b;
  --tm-linha: rgba(255,255,255,0.085);
  --tm-linha-forte: rgba(255,255,255,0.14);
  --tm-texto: #f6f6f8;
  --tm-suave: #aaaab5;
  --tm-fraco: #72727e;
  --tm-indigo: #818cf8;
  --tm-indigo-soft: #c4b5fd;
  --tm-mint: #5eead4;
  --tm-gold: #d4af37;

  position: relative;
  width: min(980px, calc(100vw - 56px));
  max-width: none;
  max-height: min(790px, calc(100dvh - 56px));
  margin: 0;
  padding: 0;
  overflow: hidden;

  color: var(--tm-texto);
  background:
    radial-gradient(circle at 12% 0%, rgba(99,102,241,0.10), transparent 30%),
    linear-gradient(145deg, rgba(18,18,24,0.985), rgba(9,9,12,0.99));
  border: 1px solid rgba(255,255,255,0.11);
  border-radius: 30px;
  box-shadow:
    0 50px 120px -42px rgba(0,0,0,0.92),
    0 16px 44px -24px rgba(99,102,241,0.34),
    inset 0 1px 0 rgba(255,255,255,0.055);

  display: flex;
  flex-direction: column;
  animation: tmModalEntra 0.42s cubic-bezier(0.22,1,0.36,1) both;
}

.pm-caixa.tm-caixa--dados,
.pm-caixa.tm-caixa--migracao {
  height: min(760px, calc(100dvh - 56px));
}

.pm-caixa.tm-caixa--perfil {
  min-height: min(610px, calc(100dvh - 56px));
}

.pm-caixa.tm-caixa--pronto {
  width: min(650px, calc(100vw - 56px));
}

.pm-caixa.tm-caixa-v2::before {
  content: "";
  position: absolute;
  inset: 0 0 auto;
  height: 1px;
  z-index: 15;
  pointer-events: none;
  background: linear-gradient(90deg, transparent, rgba(196,181,253,0.48), rgba(212,175,55,0.35), transparent);
}

.dl-root .pm-fechar {
  position: absolute;
  top: 18px;
  right: 18px;
  z-index: 30;
  width: 40px;
  height: 40px;
  min-width: 40px;
  padding: 0;
  display: grid;
  place-items: center;
  border: 1px solid var(--tm-linha);
  border-radius: 999px;
  background: rgba(255,255,255,0.035);
  color: var(--tm-suave);
  box-shadow: none;
  transform: none;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: color .18s ease, background .18s ease, border-color .18s ease, scale .18s ease;
}
.dl-root .pm-fechar:hover {
  transform: none;
  color: #fff;
  background: rgba(255,255,255,0.085);
  border-color: rgba(255,255,255,0.18);
  box-shadow: none;
}
.dl-root .pm-fechar:active { scale: .93; }
.dl-root .pm-fechar:focus-visible {
  outline: 2px solid var(--tm-indigo-soft);
  outline-offset: 3px;
}

/* ── Tipografia comum ─────────────────────────────────────────────────── */
.pm-eyebrow.tm-eyebrow {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  margin: 0 0 16px;
  color: var(--tm-mint);
  font-size: 9.5px;
  line-height: 1;
  letter-spacing: .18em;
}

.pm-caixa .pm-titulo {
  margin: 0;
  color: var(--tm-texto);
  font-size: clamp(30px, 3.2vw, 44px);
  line-height: 1.06;
  font-weight: 600;
  letter-spacing: -.045em;
  text-wrap: balance;
}

.pm-caixa .pm-sub {
  margin: 18px 0 0;
  max-width: 54ch;
  color: var(--tm-suave);
  font-size: 13.5px;
  line-height: 1.72;
}

.pm-caixa .pm-sub strong {
  color: var(--tm-texto);
  font-weight: 600;
}

.tm-rodape {
  margin: 18px 0 0;
  color: var(--tm-fraco);
  font-size: 10.5px;
  line-height: 1.55;
}

/* ── Primeira decisão: editorial à esquerda, escolhas à direita ─────── */
.tm-painel {
  width: 100%;
  min-width: 0;
  min-height: 0;
  flex: 1;
}

.tm-painel--perfil {
  display: grid;
  grid-template-columns: minmax(300px, .82fr) minmax(0, 1.18fr);
}

.tm-intro {
  position: relative;
  min-width: 0;
  padding: clamp(54px, 6vw, 78px) clamp(34px, 4vw, 52px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
  border-right: 1px solid var(--tm-linha);
  background:
    radial-gradient(circle at 0% 16%, rgba(99,102,241,.17), transparent 40%),
    linear-gradient(180deg, rgba(255,255,255,.018), transparent);
}

.tm-intro::after {
  content: "";
  position: absolute;
  width: 280px;
  aspect-ratio: 1;
  left: -150px;
  bottom: -165px;
  border-radius: 50%;
  border: 1px solid rgba(212,175,55,.16);
  box-shadow:
    0 0 0 26px rgba(212,175,55,.025),
    0 0 0 58px rgba(99,102,241,.022);
  pointer-events: none;
}

.tm-intro .pm-titulo {
  max-width: 10.8ch;
}

.tm-sinais {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  margin-top: clamp(34px, 5vh, 50px);
  overflow: hidden;
  border: 1px solid var(--tm-linha);
  border-radius: 15px;
  background: var(--tm-linha);
}

.tm-sinais > span {
  min-width: 0;
  padding: 13px 12px;
  display: grid;
  gap: 3px;
  background: rgba(13,13,16,.92);
}

.tm-sinais b {
  color: var(--tm-texto);
  font-size: 11.5px;
  font-weight: 600;
  white-space: nowrap;
}

.tm-sinais small {
  color: var(--tm-fraco);
  font-size: 8.5px;
  line-height: 1.35;
}

.tm-escolha-wrap {
  min-width: 0;
  min-height: 0;
  padding: 58px 48px 34px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow-y: auto;
}

.tm-escolha {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  margin: 0;
}

.dl-root .tm-opcao {
  position: relative;
  width: 100%;
  min-height: 176px;
  padding: 22px 22px 20px;
  display: grid;
  grid-template-columns: 52px minmax(0,1fr) auto;
  grid-template-areas:
    "icone tag acao"
    "icone titulo acao"
    "icone texto acao";
  column-gap: 17px;
  row-gap: 5px;
  align-items: center;

  text-align: left;
  color: inherit;
  background: rgba(255,255,255,.025);
  border: 1px solid var(--tm-linha);
  border-radius: 20px;
  box-shadow: none;
  transform: none;
  overflow: visible;
  cursor: pointer;
  font-family: inherit;
  transition: border-color .22s ease, background .22s ease, transform .25s cubic-bezier(.22,1,.36,1);
}

.dl-root .tm-opcao:hover {
  background: rgba(255,255,255,.052);
  border-color: rgba(196,181,253,.35);
  box-shadow: none;
  transform: translateY(-2px);
}

.dl-root .tm-opcao:active { scale: .992; }
.dl-root .tm-opcao:focus-visible {
  outline: 2px solid var(--tm-indigo-soft);
  outline-offset: 3px;
}

.dl-root .tm-opcao--especular {
  background: color-mix(in srgb, var(--sb-tint) calc(var(--sb-tint-opacity) * 100%), transparent);
  border-color: color-mix(in srgb, var(--sb-base-color) 42%, transparent);
}

.dl-root .tm-opcao--especular:hover {
  background: color-mix(in srgb, var(--sb-tint) calc(var(--sb-tint-opacity) * 150%), transparent);
  border-color: color-mix(in srgb, var(--sb-base-color) 68%, transparent);
}

.tm-opcao__marca {
  position: absolute;
  inset: 0;
  z-index: 0;
  display: block;
  overflow: hidden;
  border-radius: inherit;
  pointer-events: none;
}

.tm-opcao__marca svg {
  position: absolute;
  width: 170px;
  height: 170px;
  right: -54px;
  bottom: -72px;
  color: var(--tm-indigo-soft);
  opacity: .035;
  transform: rotate(-8deg);
  transition: opacity .25s ease, color .25s ease, transform .35s cubic-bezier(.22,1,.36,1);
}

.tm-opcao:hover .tm-opcao__marca svg {
  color: var(--tm-gold);
  opacity: .075;
  transform: rotate(-5deg) translate(-4px,-4px);
}

.tm-opcao__icone {
  grid-area: icone;
  align-self: start;
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(129,140,248,.25);
  border-radius: 14px;
  background: rgba(99,102,241,.10);
  color: var(--tm-indigo-soft);
  transition: color .2s ease, border-color .2s ease, background .2s ease;
}

.tm-opcao:hover .tm-opcao__icone {
  color: var(--tm-gold);
  border-color: rgba(212,175,55,.32);
  background: rgba(212,175,55,.09);
}

.tm-opcao__tag {
  grid-area: tag;
  position: relative;
  z-index: 2;
  display: block;
  align-self: end;
  color: var(--tm-fraco);
  font-size: 8.5px;
  letter-spacing: .16em;
}

.tm-opcao__titulo {
  grid-area: titulo;
  position: relative;
  z-index: 2;
  color: var(--tm-texto);
  font-size: 16px;
  font-weight: 650;
  line-height: 1.3;
  letter-spacing: -.02em;
}

.tm-opcao__texto {
  grid-area: texto;
  position: relative;
  z-index: 2;
  align-self: start;
  max-width: 48ch;
  color: var(--tm-suave);
  font-size: 11.5px;
  line-height: 1.55;
}

.tm-opcao__acao {
  grid-area: acao;
  position: relative;
  z-index: 2;
  align-self: center;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tm-opcao__rotulo {
  display: none;
}

.tm-opcao__seta {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border: 1px solid var(--tm-linha);
  border-radius: 999px;
  color: var(--tm-suave);
  background: rgba(255,255,255,.035);
  font-size: 14px;
  line-height: 1;
  transition: color .2s ease, border-color .2s ease, background .2s ease, transform .2s ease;
}

.tm-opcao:hover .tm-opcao__seta {
  color: var(--tm-gold);
  border-color: rgba(212,175,55,.3);
  background: rgba(212,175,55,.09);
  transform: translateX(2px);
}

/* ── Passos 2 e 3: contexto fixo + conteúdo rolável ─────────────────── */
.tm-painel--etapa {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(260px,.72fr) minmax(0,1.28fr);
}

.tm-etapa__aside {
  position: relative;
  min-width: 0;
  min-height: 0;
  padding: 54px 34px 36px;
  display: flex;
  flex-direction: column;
  gap: 28px;
  overflow: hidden;
  border-right: 1px solid var(--tm-linha);
  background:
    radial-gradient(circle at 10% 10%, rgba(99,102,241,.14), transparent 38%),
    rgba(255,255,255,.012);
}

.tm-etapa__aside::after {
  content: "";
  position: absolute;
  width: 280px;
  height: 280px;
  right: -190px;
  bottom: -150px;
  border: 1px solid rgba(196,181,253,.12);
  border-radius: 50%;
  pointer-events: none;
}

.tm-etapa__aside .pm-titulo {
  max-width: 12ch;
  font-size: clamp(28px, 3vw, 39px);
}

.tm-etapa__aside .pm-sub {
  max-width: 34ch;
  font-size: 12.5px;
}

.tm-passo {
  display: block;
  width: fit-content;
  margin: -5px 0 15px;
  color: var(--tm-fraco);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: .14em;
}

.tm-etapas {
  display: grid;
  gap: 7px;
}

.tm-etapas > span {
  position: relative;
  display: grid;
  grid-template-columns: 28px 1fr;
  align-items: center;
  gap: 10px;
  min-height: 34px;
  color: var(--tm-fraco);
}

.tm-etapas > span:not(:last-child)::after {
  content: "";
  position: absolute;
  left: 13px;
  top: 28px;
  width: 1px;
  height: 13px;
  background: var(--tm-linha-forte);
}

.tm-etapas b {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border: 1px solid var(--tm-linha-forte);
  border-radius: 999px;
  font-size: 9.5px;
  font-weight: 600;
}

.tm-etapas small {
  font-size: 10.5px;
  font-weight: 550;
}

.tm-etapas .is-ok { color: var(--tm-suave); }
.tm-etapas .is-ok b {
  color: #081311;
  background: var(--tm-mint);
  border-color: var(--tm-mint);
}
.tm-etapas .is-on { color: var(--tm-texto); }
.tm-etapas .is-on b {
  color: #fff;
  background: rgba(99,102,241,.24);
  border-color: rgba(196,181,253,.55);
  box-shadow: 0 0 0 4px rgba(99,102,241,.08);
}

.tm-aside-card {
  position: relative;
  z-index: 1;
  margin-top: auto;
  padding: 14px 15px;
  border: 1px solid var(--tm-linha);
  border-radius: 15px;
  background: rgba(255,255,255,.025);
}

.tm-aside-card > span {
  display: block;
  margin-bottom: 6px;
  color: var(--tm-fraco);
  font-size: 8px;
  letter-spacing: .16em;
}

.tm-aside-card strong {
  display: block;
  color: var(--tm-texto);
  font-size: 11.5px;
  font-weight: 600;
}

.tm-aside-card p {
  margin: 5px 0 0;
  color: var(--tm-fraco);
  font-size: 9.5px;
  line-height: 1.5;
}

.tm-etapa__corpo {
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 46px 46px 0;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,.18) transparent;
}

.tm-etapa__corpo::-webkit-scrollbar { width: 9px; }
.tm-etapa__corpo::-webkit-scrollbar-thumb {
  border: 3px solid transparent;
  border-radius: 999px;
  background: rgba(255,255,255,.18);
  background-clip: padding-box;
}

.tm-form-cab {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}

.tm-form-cab strong {
  color: var(--tm-texto);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -.01em;
}

.tm-form-cab span {
  color: var(--tm-fraco);
  font-size: 10px;
}

.pm-caixa .pm-form {
  display: grid;
  gap: 18px;
  width: 100%;
  min-width: 0;
}

.pm-caixa .pm-campo {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.pm-caixa .pm-rotulo {
  color: #d7d7df;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.3;
}

.tm-opcional {
  margin-left: 4px;
  color: var(--tm-fraco);
  font-style: normal;
  font-size: 9.5px;
  font-weight: 500;
}

.pm-caixa .pm-entrada {
  width: 100%;
  min-height: 46px;
  padding: 12px 14px;
  border: 1px solid var(--tm-linha-forte);
  border-radius: 13px;
  outline: 0;
  background: rgba(255,255,255,.035);
  color: var(--tm-texto);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.018);
  font: inherit;
  font-size: 12.5px;
  transition: border-color .18s ease, background .18s ease, box-shadow .18s ease;
}

.pm-caixa .pm-entrada:hover {
  border-color: rgba(255,255,255,.19);
  background: rgba(255,255,255,.045);
}

.pm-caixa .pm-entrada:focus {
  border-color: rgba(129,140,248,.72);
  background: rgba(255,255,255,.052);
  box-shadow: 0 0 0 3px rgba(99,102,241,.12);
}

.pm-caixa .pm-entrada::placeholder { color: #62626e; }
.pm-caixa .pm-entrada.is-erro {
  border-color: rgba(248,113,113,.62);
  box-shadow: 0 0 0 3px rgba(248,113,113,.08);
}

.pm-caixa .pm-dupla {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.pm-caixa .pm-erro {
  color: #fca5a5;
  font-size: 10px;
  line-height: 1.4;
}

.pm-caixa .pm-falha {
  margin: 0;
  padding: 11px 13px;
  border: 1px solid rgba(248,113,113,.25);
  border-radius: 12px;
  background: rgba(248,113,113,.07);
  color: #fca5a5;
  font-size: 10.5px;
  line-height: 1.5;
}

.pm-caixa .pm-isca {
  position: absolute !important;
  left: -10000px !important;
  width: 1px !important;
  height: 1px !important;
  opacity: 0 !important;
  pointer-events: none !important;
}

.tm-area {
  min-height: 92px !important;
  resize: vertical;
  line-height: 1.55;
}

/* Plano escolhido: mostra só o suficiente para confirmar a decisão. */
.pm-caixa .pm-resumo {
  display: grid;
  gap: 13px;
  padding: 15px;
  border: 1px solid rgba(129,140,248,.22);
  border-radius: 15px;
  background:
    radial-gradient(circle at 100% 0%, rgba(99,102,241,.10), transparent 42%),
    rgba(99,102,241,.045);
}

.pm-resumo__topo {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.pm-resumo__topo > div > span {
  color: var(--tm-indigo-soft);
  font-size: 8px;
  letter-spacing: .14em;
}

.pm-resumo__topo > strong {
  color: var(--tm-texto);
  font-size: 18px;
  font-weight: 650;
  white-space: nowrap;
  letter-spacing: -.025em;
}

.pm-resumo__topo > strong small {
  margin-left: 2px;
  color: var(--tm-fraco);
  font-size: 9px;
  font-weight: 500;
}

.pm-resumo .pm-resumo__desc {
  margin: 5px 0 0;
  color: var(--tm-suave);
  font-size: 10.5px;
  line-height: 1.45;
}

.pm-resumo__lista {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.pm-resumo__lista li {
  position: relative;
  padding-left: 15px;
  color: var(--tm-suave);
  font-size: 9.5px;
  line-height: 1.4;
}

.pm-resumo__lista li::before {
  content: "✓";
  position: absolute;
  left: 0;
  top: 0;
  color: var(--tm-mint);
  font-weight: 700;
}

.pm-resumo__lista li.is-mais {
  color: var(--tm-indigo-soft);
  font-weight: 600;
}

.pm-resumo__lista li.is-mais::before { content: "+"; }

.pm-resumo__nota {
  color: var(--tm-fraco);
  font-size: 8.5px;
  letter-spacing: .05em;
}

/* Endereço da vitrine: consequência visual do nome digitado. */
.tm-endereco {
  display: grid;
  gap: 5px;
  margin-top: 1px;
  padding: 10px 12px;
  border: 1px solid var(--tm-linha);
  border-radius: 12px;
  background: rgba(255,255,255,.025);
  transition: background .2s ease, border-color .2s ease;
}

.tm-endereco__linha {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.tm-endereco__url {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: var(--tm-fraco);
  font-size: 10.5px;
  text-transform: none;
  letter-spacing: .01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tm-endereco__url b {
  color: var(--tm-suave);
  font-weight: 600;
}

.tm-endereco__selo {
  flex: 0 0 auto;
  color: var(--tm-fraco);
  font-size: 9.5px;
  font-weight: 600;
}

.tm-endereco__nota,
.tm-endereco__bonus {
  color: var(--tm-fraco);
  font-size: 9.5px;
  line-height: 1.45;
}

.tm-endereco__bonus {
  margin-top: 5px;
  padding-top: 7px;
  border-top: 1px solid var(--tm-linha);
  color: var(--tm-suave);
}

.tm-endereco.is-checando .tm-endereco__selo { color: var(--tm-suave); }
.tm-endereco.is-livre {
  border-color: rgba(94,234,212,.26);
  background: rgba(20,184,166,.055);
}
.tm-endereco.is-livre .tm-endereco__url b,
.tm-endereco.is-livre .tm-endereco__selo { color: var(--tm-mint); }

.tm-endereco.is-indisponivel {
  border-color: rgba(248,113,113,.3);
  background: rgba(248,113,113,.06);
}
.tm-endereco.is-indisponivel .tm-endereco__url b {
  color: #fca5a5;
  text-decoration: line-through;
}
.tm-endereco.is-indisponivel .tm-endereco__selo,
.tm-endereco.is-indisponivel .tm-endereco__nota { color: #fca5a5; }

/* Migração: chips com estado legível sem depender só da cor. */
.tm-fichas {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.dl-root .tm-ficha {
  width: auto;
  min-height: 36px;
  padding: 8px 11px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 1px solid var(--tm-linha);
  border-radius: 999px;
  background: rgba(255,255,255,.025);
  color: var(--tm-suave);
  box-shadow: none;
  transform: none;
  font: inherit;
  font-size: 10.5px;
  font-weight: 550;
  cursor: pointer;
  transition: color .16s ease, background .16s ease, border-color .16s ease;
}

.dl-root .tm-ficha:hover {
  transform: none;
  box-shadow: none;
  color: var(--tm-texto);
  background: rgba(255,255,255,.055);
  border-color: rgba(255,255,255,.16);
}

.dl-root .tm-ficha.is-on {
  color: #eeeeff;
  background: rgba(99,102,241,.16);
  border-color: rgba(129,140,248,.42);
}

.tm-ficha__check,
.tm-ficha__radio {
  flex: 0 0 auto;
  width: 15px;
  height: 15px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(255,255,255,.18);
  color: transparent;
  font-size: 9px;
  line-height: 1;
}

.tm-ficha__check { border-radius: 4px; }
.tm-ficha__radio { border-radius: 50%; }

.tm-ficha.is-on .tm-ficha__check {
  color: #fff;
  background: var(--tm-indigo);
  border-color: var(--tm-indigo);
}

.tm-ficha.is-on .tm-ficha__radio {
  border: 4px solid var(--tm-indigo-soft);
  background: #111116;
}

/* Ações: ficam ao alcance mesmo quando o formulário é alto. */
.pm-caixa .pm-acoes {
  position: sticky;
  bottom: 0;
  z-index: 12;
  display: flex;
  justify-content: flex-end;
  gap: 9px;
  margin: 4px -46px 0;
  padding: 18px 46px 24px;
  border-top: 1px solid rgba(255,255,255,.055);
  background: linear-gradient(180deg, rgba(13,13,16,.72), rgba(13,13,16,.98) 30%);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.pm-caixa .tm-acoes,
.tm-pronto .pm-acoes {
  position: static;
  width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  justify-content: center;
}

.pm-caixa .pm-acoes--tres {
  display: grid;
  grid-template-columns: auto auto auto;
}

.dl-root .pm-botao {
  width: auto;
  min-width: 112px;
  min-height: 43px;
  padding: 11px 17px;
  border-radius: 999px;
  transform: none;
  box-shadow: none;
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.dl-root .pm-botao:hover { transform: none; }
.dl-root .pm-botao:active:not(:disabled) { scale: .98; }

.dl-root .pm-botao--especular {
  background: color-mix(in srgb, var(--sb-tint) calc(var(--sb-tint-opacity) * 100%), transparent);
  border: 1px solid color-mix(in srgb, var(--sb-base-color) 42%, transparent);
  color: var(--sb-text-color);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
}

.dl-root .pm-botao--especular:hover {
  background: color-mix(in srgb, var(--sb-tint) calc(var(--sb-tint-opacity) * 155%), transparent);
  border-color: color-mix(in srgb, var(--sb-base-color) 72%, transparent);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.065);
}

.dl-root .pm-botao--primario {
  min-width: 150px;
}

/* ── Confirmação por e-mail ───────────────────────────────────────────── */
.tm-pronto {
  position: relative;
  isolation: isolate;
  width: 100%;
  min-height: 560px;
  padding: 64px 60px 46px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
  text-align: center;
}

.tm-pronto__halo {
  position: absolute;
  z-index: -1;
  width: 420px;
  height: 240px;
  top: -80px;
  left: 50%;
  translate: -50% 0;
  background: radial-gradient(ellipse, rgba(99,102,241,.20), transparent 70%);
  pointer-events: none;
}

.tm-envelope {
  width: 66px;
  height: 66px;
  margin-bottom: 18px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(129,140,248,.36);
  border-radius: 20px;
  background: rgba(99,102,241,.12);
  color: var(--tm-indigo-soft);
  box-shadow: 0 16px 42px -24px rgba(99,102,241,.9);
}

.tm-pronto .pm-eyebrow { margin-bottom: 12px; }
.tm-pronto .pm-titulo {
  max-width: 12ch;
  font-size: clamp(34px, 4vw, 48px);
}

.tm-pronto .pm-sub {
  max-width: 51ch;
  margin-top: 14px;
}

.tm-pronto__cartoes {
  width: min(100%, 510px);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
  margin: 26px 0 24px;
}

.tm-pronto__cartoes:has(.tm-aviso:only-child) {
  grid-template-columns: 1fr;
}

.tm-aviso {
  min-width: 0;
  padding: 13px;
  display: flex;
  align-items: flex-start;
  gap: 11px;
  text-align: left;
  border: 1px solid rgba(212,175,55,.20);
  border-radius: 14px;
  background: rgba(212,175,55,.055);
  color: var(--tm-suave);
  font-size: 9.5px;
  line-height: 1.45;
}

.tm-aviso--migracao {
  border-color: rgba(94,234,212,.18);
  background: rgba(20,184,166,.045);
}

.tm-aviso__num {
  flex: 0 0 auto;
  min-width: 34px;
  height: 34px;
  padding: 0 5px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(212,175,55,.25);
  border-radius: 10px;
  color: var(--tm-gold);
  font-size: 11px;
  font-weight: 700;
}

.tm-aviso--migracao .tm-aviso__num {
  color: var(--tm-mint);
  border-color: rgba(94,234,212,.24);
}

.tm-aviso strong {
  display: block;
  margin-bottom: 3px;
  color: var(--tm-texto);
  font-size: 10px;
  font-weight: 600;
}

.tm-pronto__acoes {
  margin-top: 0 !important;
}

/* ── Tablet ───────────────────────────────────────────────────────────── */
@media (max-width: 820px) {
  .pm-veu { padding: 18px; }

  .pm-caixa.tm-caixa-v2 {
    width: min(720px, calc(100vw - 36px));
    max-height: calc(100dvh - 36px);
    border-radius: 26px;
  }

  .pm-caixa.tm-caixa--dados,
  .pm-caixa.tm-caixa--migracao {
    height: min(820px, calc(100dvh - 36px));
  }

  .tm-painel--perfil {
    grid-template-columns: 1fr;
  }

  .tm-intro {
    padding: 42px 44px 32px;
    border-right: 0;
    border-bottom: 1px solid var(--tm-linha);
  }

  .tm-intro .pm-titulo { max-width: 16ch; }

  .tm-sinais {
    width: min(520px,100%);
    margin-top: 25px;
  }

  .tm-escolha-wrap {
    padding: 28px 44px 34px;
  }

  .tm-painel--etapa {
    grid-template-columns: 220px minmax(0,1fr);
  }

  .tm-etapa__aside {
    padding: 48px 25px 30px;
  }

  .tm-etapa__corpo {
    padding-left: 30px;
    padding-right: 30px;
  }

  .pm-caixa .pm-acoes {
    margin-left: -30px;
    margin-right: -30px;
    padding-left: 30px;
    padding-right: 30px;
  }
}

/* ── Celular: bottom sheet de verdade, não desktop encolhido ─────────── */
@media (max-width: 620px) {
  .pm-veu {
    align-items: flex-end;
    padding: 0;
    background: rgba(3,4,8,.82);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .pm-caixa.tm-caixa-v2,
  .pm-caixa.tm-caixa--pronto {
    width: 100%;
    height: min(94dvh, 880px);
    min-height: 0;
    max-height: 94dvh;
    border-left: 0;
    border-right: 0;
    border-bottom: 0;
    border-radius: 28px 28px 0 0;
    animation-name: tmModalEntraMobile;
  }

  .pm-caixa.tm-caixa-v2::after {
    content: "";
    position: absolute;
    z-index: 26;
    top: 9px;
    left: 50%;
    width: 38px;
    height: 4px;
    translate: -50% 0;
    border-radius: 999px;
    background: rgba(255,255,255,.16);
    pointer-events: none;
  }

  .dl-root .pm-fechar {
    top: 19px;
    right: 16px;
    width: 38px;
    height: 38px;
    min-width: 38px;
  }

  .pm-caixa .pm-titulo {
    font-size: clamp(27px, 8.2vw, 36px);
    line-height: 1.08;
  }

  .pm-caixa .pm-sub {
    margin-top: 12px;
    font-size: 12.5px;
    line-height: 1.62;
  }

  .pm-eyebrow.tm-eyebrow {
    margin-bottom: 12px;
    font-size: 8.5px;
  }

  /* Perfil: cabeçalho compacto + duas portas roláveis. */
  .tm-painel--perfil {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .tm-intro {
    flex: 0 0 auto;
    padding: 52px 20px 22px;
    border-bottom: 1px solid var(--tm-linha);
    background:
      radial-gradient(circle at 10% 0%, rgba(99,102,241,.14), transparent 42%),
      transparent;
  }

  .tm-intro::after { display: none; }
  .tm-intro .pm-titulo { max-width: 15ch; }
  .tm-intro .pm-sub { max-width: 42ch; }

  .tm-sinais {
    display: flex;
    gap: 7px;
    margin-top: 20px;
    overflow: visible;
    border: 0;
    background: none;
  }

  .tm-sinais > span {
    flex: 1 1 0;
    padding: 9px 8px;
    border: 1px solid var(--tm-linha);
    border-radius: 11px;
    background: rgba(255,255,255,.025);
  }

  .tm-sinais b { font-size: 9.5px; }
  .tm-sinais small { display: none; }

  .tm-escolha-wrap {
    flex: 1 0 auto;
    min-height: auto;
    padding: 18px 14px calc(20px + env(safe-area-inset-bottom));
    overflow: visible;
  }

  .tm-escolha { gap: 9px; }

  .dl-root .tm-opcao {
    min-height: 150px;
    padding: 17px 16px;
    grid-template-columns: 43px minmax(0,1fr);
    grid-template-areas:
      "icone tag"
      "icone titulo"
      "texto texto"
      "acao acao";
    column-gap: 12px;
    row-gap: 5px;
    border-radius: 17px;
  }

  .tm-opcao__icone {
    width: 42px;
    height: 42px;
    border-radius: 12px;
  }

  .tm-opcao__titulo { font-size: 15px; }
  .tm-opcao__texto {
    margin-top: 5px;
    font-size: 11px;
    line-height: 1.5;
  }

  .tm-opcao__acao {
    justify-self: start;
    margin-top: 6px;
    padding: 6px 7px 6px 11px;
    gap: 7px;
    border: 1px solid var(--tm-linha);
    border-radius: 999px;
    background: rgba(255,255,255,.03);
  }

  .tm-opcao__rotulo {
    display: block;
    color: var(--tm-suave);
    font-size: 9.5px;
    font-weight: 600;
  }

  .tm-opcao__seta {
    width: 22px;
    height: 22px;
    font-size: 11px;
  }

  .tm-opcao__marca svg {
    width: 150px;
    height: 150px;
    right: -54px;
    bottom: -62px;
    opacity: .055;
  }

  .tm-rodape {
    margin-top: 13px;
    padding: 0 4px;
    text-align: center;
    font-size: 9.5px;
  }

  /* Dados/migração: a lateral vira cabeçalho; só o formulário rola. */
  .tm-painel--etapa {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .tm-etapa__aside {
    flex: 0 0 auto;
    min-height: 0;
    padding: 50px 20px 17px;
    gap: 15px;
    overflow: visible;
    border-right: 0;
    border-bottom: 1px solid var(--tm-linha);
    background:
      radial-gradient(circle at 8% 0%, rgba(99,102,241,.13), transparent 42%),
      rgba(255,255,255,.012);
  }

  .tm-etapa__aside::after,
  .tm-aside-card { display: none; }

  .tm-etapa__aside .pm-eyebrow { margin-bottom: 8px; }
  .tm-passo {
    margin: 0 0 8px;
    font-size: 8px;
  }

  .tm-etapa__aside .pm-titulo {
    max-width: 18ch;
    font-size: clamp(23px, 6.8vw, 30px);
  }

  .tm-etapa__aside .pm-sub {
    display: none;
  }

  .tm-etapas {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .tm-etapas > span {
    flex: 1 1 0;
    min-width: 0;
    min-height: 28px;
    grid-template-columns: 24px minmax(0,1fr);
    gap: 6px;
  }

  .tm-etapas > span:not(:last-child)::after {
    display: none;
  }

  .tm-etapas b {
    width: 24px;
    height: 24px;
    font-size: 8.5px;
  }

  .tm-etapas small {
    overflow: hidden;
    font-size: 8.5px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tm-etapa__corpo {
    flex: 1 1 auto;
    min-height: 0;
    padding: 20px 16px 0;
    overflow-y: auto;
  }

  .tm-form-cab {
    margin-bottom: 18px;
  }

  .tm-form-cab strong { font-size: 13px; }
  .tm-form-cab span { font-size: 9px; }

  .pm-caixa .pm-form { gap: 16px; }
  .pm-caixa .pm-dupla {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .pm-caixa .pm-entrada {
    min-height: 46px;
    font-size: 16px; /* evita zoom automático do Safari ao focar */
  }

  .pm-resumo__topo > strong { font-size: 16px; }
  .pm-resumo__lista {
    grid-template-columns: 1fr;
    gap: 5px;
  }
  .pm-resumo__lista li:nth-child(n+4):not(.is-mais) { display: none; }

  .tm-endereco__url {
    white-space: normal;
    overflow: visible;
    text-overflow: clip;
    overflow-wrap: anywhere;
    line-height: 1.45;
  }

  .tm-fichas {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 7px;
  }

  .tm-fichas--formatos { grid-template-columns: 1fr; }

  .dl-root .tm-ficha {
    width: 100%;
    min-height: 42px;
    justify-content: flex-start;
    padding: 9px 10px;
    border-radius: 12px;
    font-size: 10px;
    text-align: left;
  }

  .tm-area { min-height: 84px !important; }

  .pm-caixa .pm-acoes {
    margin: 3px -16px 0;
    padding: 13px 16px calc(14px + env(safe-area-inset-bottom));
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .dl-root .pm-botao {
    width: 100%;
    min-width: 0;
    min-height: 46px;
    padding: 11px 12px;
    font-size: 10.5px;
  }

  .pm-caixa .pm-acoes .pm-botao--primario {
    order: -1;
    grid-column: 1 / -1;
  }

  .pm-caixa .pm-acoes:not(.pm-acoes--tres) > .pm-botao:not(.pm-botao--primario) {
    grid-column: 1 / -1;
  }

  .pm-caixa .pm-acoes--tres {
    grid-template-columns: 1fr 1fr;
  }

  .pm-caixa .pm-acoes--tres .pm-botao--primario {
    grid-column: 1 / -1;
  }

  /* Confirmação. */
  .tm-pronto {
    min-height: 100%;
    justify-content: flex-start;
    padding: 64px 18px calc(28px + env(safe-area-inset-bottom));
  }

  .tm-pronto__halo { top: -95px; }
  .tm-envelope {
    width: 58px;
    height: 58px;
    margin-bottom: 14px;
    border-radius: 17px;
  }

  .tm-pronto .pm-titulo {
    max-width: 12ch;
    font-size: clamp(30px, 9vw, 39px);
  }

  .tm-pronto__cartoes {
    grid-template-columns: 1fr;
    margin: 22px 0 20px;
  }

  .tm-pronto .tm-acoes {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
    width: 100%;
    max-width: 420px;
  }

  .tm-pronto .tm-acoes .pm-botao--primario {
    order: -1;
  }
}

@media (max-width: 380px) {
  .tm-sinais { flex-wrap: wrap; }
  .tm-sinais > span { flex: 1 1 calc(50% - 4px); }
  .tm-fichas { grid-template-columns: 1fr; }
  .tm-etapas small { display: none; }
}

@media (max-height: 700px) and (min-width: 621px) {
  .pm-caixa.tm-caixa-v2 { max-height: calc(100dvh - 28px); }
  .pm-caixa.tm-caixa--dados,
  .pm-caixa.tm-caixa--migracao { height: calc(100dvh - 28px); }
  .tm-intro { padding-top: 42px; padding-bottom: 42px; }
  .tm-escolha-wrap { padding-top: 38px; padding-bottom: 26px; }
  .tm-etapa__aside { padding-top: 40px; padding-bottom: 26px; }
  .tm-etapa__corpo { padding-top: 34px; }
}

@media (prefers-reduced-motion: reduce) {
  .pm-caixa.tm-caixa-v2 { animation: none; }
  .dl-root .tm-opcao,
  .tm-opcao__marca svg,
  .tm-opcao__seta { transition-duration: 1ms !important; }
}

@keyframes tmModalEntra {
  from { opacity: 0; transform: translateY(14px) scale(.975); }
  to { opacity: 1; transform: none; }
}

@keyframes tmModalEntraMobile {
  from { opacity: .7; transform: translateY(28px); }
  to { opacity: 1; transform: none; }
}
/* OMNIMOB_TRIAL_MODAL_V2_END */`;

export default TrialModal;
