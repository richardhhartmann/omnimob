import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { enderecoVisivel } from "../utils/enderecoVitrine";
import { provedorDoEmail } from "../utils/provedorEmail";
import { formatPhone } from "../utils/masks";
import { slugify, motivoLocal, MOTIVO_SLUG } from "../utils/slug";
import { MODAL_CSS } from "./modalCSS";
import { SelectCustom } from "./SelectCustom";
import { IconeEnvelope } from "./Icones.jsx";

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
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = anterior; };
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
      if (evento.key === "Escape") aoFechar();
      if (evento.key !== "Tab") return;
      const alvos = caixaRef.current?.querySelectorAll(
        "button, input, textarea, [href], [tabindex]:not([tabindex='-1'])",
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
     o Cancelar e o Esc — três saídas deliberadas. */
  return (
    <div className="pm-veu">
      <style>{CSS}</style>
      {/* No celular a caixa é a tela inteira, e no passo do perfil ela vira
          coluna flexível para os dois cartões dividirem entre si toda a altura
          que sobra (ver .tm-caixa--perfil). Nos outros passos ela segue sendo
          um bloco que rola. */}
      <div
        className={`pm-caixa dl-glass${!enviado && passo === "perfil" ? " tm-caixa--perfil" : ""}`}
        ref={caixaRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tm-titulo"
      >
        <button type="button" className="pm-fechar" onClick={aoFechar} aria-label="Fechar">
          ✕
        </button>

        {enviado ? (
          <div className="tm-pronto">
            <span className="tm-envelope" aria-hidden="true"><IconeEnvelope size={24} /></span>
            <h2 id="tm-titulo" className="pm-titulo">Confira seu e-mail</h2>
            <p className="pm-sub">
              Mandamos um link de confirmação para <strong>{form.email}</strong>. Abrir esse link
              cria o ambiente da {form.imobiliaria} na hora.
            </p>
            <p className="tm-aviso">
              O link vale por 30 minutos. Se não aparecer em alguns instantes, confira a caixa de
              spam.
            </p>
            {perfil === "existente" ? (
              <p className="tm-aviso tm-aviso--migracao">
                Sobre trazer a sua base: um especialista vai responder nesse mesmo e-mail para
                combinar a importação. Você pode ir montando o ambiente enquanto isso — nada do que
                fizer se perde.
              </p>
            ) : null}
            {/* O próximo passo de quem acabou de pedir um link de confirmação é
                abrir a caixa de entrada — então o botão principal faz isso, em
                vez de só fechar o modal.

                Só quando reconhecemos o provedor. Para domínio próprio
                (contato@imobiliaria.com.br) não há webmail que se possa
                adivinhar, e aí o botão neutro continua sendo o certo. */}
            <div className="pm-acoes tm-acoes">
              {provedor ? (
                <>
                  <button type="button" className="pm-botao" onClick={aoFechar}>
                    Entendi
                  </button>
                  <a
                    className="pm-botao pm-botao--primario"
                    href={provedor.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={aoFechar}
                  >
                    Abrir {provedor.nome}
                  </a>
                </>
              ) : (
                <button type="button" className="pm-botao pm-botao--primario" onClick={aoFechar}>
                  Entendi
                </button>
              )}
            </div>
          </div>
        ) : passo === "perfil" ? (
          <>
            <span className="dl-mono pm-eyebrow tm-eyebrow">● TESTE GRÁTIS POR 14 DIAS</span>
            <h2 id="tm-titulo" className="pm-titulo">Antes de começar: como está a sua imobiliária hoje?</h2>
            <p className="pm-sub">
              A resposta muda o que preparamos para você. Leva um clique.
            </p>

            <div className="tm-escolha">
              <button type="button" className="tm-opcao" onClick={() => escolherPerfil("nova")}>
                <span className="tm-opcao__icone" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 21h18" /><path d="M5 21V8l7-5 7 5v13" />
                    <path d="M10 21v-6h4v6" />
                  </svg>
                </span>
                <span className="tm-opcao__titulo">Estou abrindo agora</span>
                <span className="tm-opcao__texto">
                  Vou começar do zero com a Omnimob. Quero cadastrar meus primeiros imóveis e colocar
                  a vitrine no ar.
                </span>
                <span className="tm-opcao__seta" aria-hidden="true">→</span>
              </button>

              <button type="button" className="tm-opcao" onClick={() => escolherPerfil("existente")}>
                <span className="tm-opcao__icone" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="8" width="8" height="13" rx="1" />
                    <rect x="13" y="3" width="8" height="18" rx="1" />
                    <path d="M6 12h2M6 16h2M16 7h2M16 11h2M16 15h2" />
                  </svg>
                </span>
                <span className="tm-opcao__titulo">Já tenho uma imobiliária</span>
                <span className="tm-opcao__texto">
                  Já opero, com carteira e clientes em outro sistema ou em planilhas. Quero trazer
                  isso para a Omnimob.
                </span>
                <span className="tm-opcao__seta" aria-hidden="true">→</span>
              </button>
            </div>

            <p className="tm-rodape">
              Sem cartão, sem instalar nada. Você pode mudar de ideia a qualquer momento.
            </p>
          </>
        ) : passo === "migracao" ? (
          <>
            <span className="dl-mono pm-eyebrow tm-eyebrow">● TRAZER A SUA BASE</span>
            <h2 id="tm-titulo" className="pm-titulo">O que você já tem, e como trazemos para cá.</h2>
            <p className="pm-sub">
              Ninguém troca de sistema para redigitar a carteira inteira. Conte o que existe hoje e
              um especialista responde no seu e-mail com o caminho — <strong>a importação é feita
              junto com você</strong>, dentro do próprio teste.
            </p>

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
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pm-campo">
                <span className="pm-rotulo">Como os dados podem sair de lá?</span>
                <div className="tm-fichas">
                  {FORMATOS.map((f) => (
                    <button
                      key={f.valor}
                      type="button"
                      className={`tm-ficha${migracao.formato === f.valor ? " is-on" : ""}`}
                      aria-pressed={migracao.formato === f.valor}
                      onClick={() => setMigracao((m) => ({ ...m, formato: m.formato === f.valor ? "" : f.valor }))}
                    >
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
                <button type="button" className="pm-botao" onClick={() => setPasso("dados")} disabled={criando}>
                  Voltar
                </button>
                {/* Pular não pode custar o teste: quem não sabe responder agora
                    ainda assim merece o ambiente. O time pergunta depois. */}
                <button type="button" className="pm-botao" onClick={() => criar(false)} disabled={criando}>
                  Pular por enquanto
                </button>
                <button
                  type="button"
                  className="pm-botao pm-botao--primario"
                  onClick={() => criar(true)}
                  disabled={criando}
                >
                  {criando ? "Preparando ambiente…" : "Começar o teste"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <span className="dl-mono pm-eyebrow tm-eyebrow">● TESTE GRÁTIS POR 14 DIAS</span>
            <h2 id="tm-titulo" className="pm-titulo">Veja a Omnimob funcionando com a sua cara.</h2>
            <p className="pm-sub">
              Criamos um ambiente completo em segundos, com o plano que você escolher liberado e a
              sua vitrine já no ar. Sem cartão, sem instalar nada.
            </p>

            <form className="pm-form" onSubmit={seguirDosDados} noValidate>
              {/* O plano vem escolhido quando a pessoa clicou num cartão da
                  tabela de preços, e em branco quando ela entrou pelo CTA do
                  fim da página. Nos dois casos o campo é obrigatório: é ele que
                  define o que o ambiente de teste vai liberar.

                  Não é <label> porque o gatilho do combo é um <button> — o
                  clique no rótulo chegaria nele e abriria a lista sozinho. */}
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

              {/* Lembrete do que o plano entrega: quem chegou pelo CTA final
                  não passou pela tabela, e quem passou já rolou para longe. */}
              {planoEscolhido ? (
                <div className="pm-resumo">
                  <p className="pm-resumo__desc">{planoEscolhido.desc}</p>
                  <ul className="pm-resumo__lista">
                    {planoEscolhido.linhas.filter((l) => l.incluso).map((l) => (
                      <li key={l.label}>{l.label}</li>
                    ))}
                  </ul>
                  <span className="dl-mono pm-resumo__nota">
                    // 14 dias com estes recursos, sem cartão
                  </span>
                </div>
              ) : null}

              {/* O nome não é só um rótulo: é dele que sai o endereço da
                  vitrine, que precisa ser único entre todas as imobiliárias.
                  Por isso o campo mostra o endereço se formando e diz na hora
                  se ele está livre. */}
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

                {/* Só existe depois que há um nome: com o campo vazio, o bloco
                    mostrava um endereço de mentira ("sua-imobiliaria") e uma
                    frase sobre uma vitrine que ainda não tem nome — ruído antes
                    de a pessoa ter feito qualquer coisa. */}
                {form.imobiliaria.trim() ? (
                  <span className={`tm-endereco is-${slug.estado}`} id="tm-endereco" aria-live="polite">
                    <span className="tm-endereco__linha">
                      <span className="dl-mono tm-endereco__url">
                        <b>{enderecoVisivel(slug.valor)}</b>
                      </span>
                      <span className="tm-endereco__selo">{SELO_SLUG[slug.estado]}</span>
                    </span>
                    <span className="tm-endereco__nota">
                      {slug.mensagem || "Este será o endereço da sua vitrine pública."}
                    </span>
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
                <button type="button" className="pm-botao" onClick={() => setPasso("perfil")} disabled={criando}>
                  Voltar
                </button>
                {/* Desligado enquanto o endereço não fecha: seguir com um slug
                    ocupado só adiaria a mesma recusa para o fim do cadastro. */}
                <button
                  type="submit"
                  className="pm-botao pm-botao--primario"
                  disabled={criando || slug.estado === "indisponivel" || slug.estado === "checando"}
                >
                  {criando
                    ? "Preparando ambiente…"
                    : slug.estado === "checando" ? "Verificando endereço…"
                    : perfil === "existente" ? "Próximo" : "Começar o teste"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

/* A folha comum (.pm-*) vem do módulo compartilhado; aqui só o que é próprio
   da tela de acesso. */
const CSS = `${MODAL_CSS}
.tm-eyebrow { color: var(--mint); }
.tm-pronto { display: grid; justify-items: center; text-align: center; gap: 12px; }
.tm-pronto .pm-sub { margin-top: 0; }

.tm-aviso {
  font-size: 12px; line-height: 1.65; color: var(--subtle);
  padding: 10px 13px; border-radius: 10px;
  background: rgba(212,175,55,0.09); border: 1px solid rgba(212,175,55,0.24);
}
.tm-aviso--migracao {
  background: rgba(20,184,166,0.09); border-color: rgba(20,184,166,0.26);
}
.tm-acoes { width: 100%; justify-content: center; }
.tm-envelope {
  width: 52px; height: 52px; border-radius: 999px; display: grid; place-items: center;
  background: rgba(99,102,241,0.16); border: 1px solid rgba(99,102,241,0.4);
  color: var(--accent-soft); margin-bottom: 4px;
}
/* ── Endereço da vitrine ──────────────────────────────────────────────────
   Fica colado no campo do nome, com um respiro menor que o do próximo campo:
   é consequência do que foi digitado ali em cima, não um campo novo. A caixa
   troca de cor conforme o estado, e o texto de apoio troca junto — no lugar do
   "este será o endereço" entra o motivo da recusa, sem a linha pular.
   ─────────────────────────────────────────────────────────────────────── */
.tm-endereco {
  display: grid; gap: 5px; margin-top: 1px;
  padding: 9px 12px; border-radius: 10px;
  background: rgba(255,255,255,0.03); border: 1px solid var(--line);
  transition: background 0.22s ease, border-color 0.22s ease;
}
.tm-endereco__linha { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
/* O slug pode ficar longo; ele encolhe e corta, e o selo não sai da linha. */
/* Sem o caixa-alta do .dl-mono: o slug é minúsculo de verdade, e mostrá-lo em
   maiúsculas seria prometer um endereço que não é o que vai ser criado. */
.tm-endereco__url {
  flex: 1 1 auto; min-width: 0; font-size: 11px; color: var(--placeholder);
  text-transform: none; letter-spacing: 0.02em;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.tm-endereco__url b { color: var(--subtle); font-weight: 600; }
.tm-endereco__selo {
  flex: 0 0 auto; font-size: 10.5px; font-weight: 600; letter-spacing: 0.01em;
  color: var(--placeholder);
}
.tm-endereco__nota { font-size: 11px; line-height: 1.5; color: var(--placeholder); }

.tm-endereco.is-checando .tm-endereco__selo { color: var(--subtle); }
.tm-endereco.is-livre {
  background: rgba(20,184,166,0.08); border-color: rgba(20,184,166,0.3);
}
.tm-endereco.is-livre .tm-endereco__url b { color: var(--mint); }
.tm-endereco.is-livre .tm-endereco__selo { color: var(--mint); }
.tm-endereco.is-indisponivel {
  background: rgba(248,113,113,0.09); border-color: rgba(248,113,113,0.3);
}
.tm-endereco.is-indisponivel .tm-endereco__url b { color: #fca5a5; text-decoration: line-through; }
.tm-endereco.is-indisponivel .tm-endereco__selo,
.tm-endereco.is-indisponivel .tm-endereco__nota { color: #fca5a5; }

.tm-opcional {
  font-style: normal; font-weight: 500; color: var(--placeholder); font-size: 10.5px;
  margin-left: 5px;
}

/* ── Passo do perfil ──────────────────────────────────────────────────────
   Duas colunas no desktop, empilhadas no celular. Os cartões têm a mesma
   altura para nenhum dos dois parecer a opção "principal": a escolha é do
   cliente, e um botão maior que o outro já seria uma resposta nossa.
   ─────────────────────────────────────────────────────────────────────── */
.tm-escolha { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 22px; }
.dl-root .tm-opcao {
  display: grid; grid-template-rows: auto auto 1fr auto; gap: 8px; text-align: left;
  width: 100%; padding: 18px 18px 14px; border-radius: 16px; cursor: pointer;
  background: var(--surface); border: 1px solid var(--line);
  color: inherit; font-family: inherit; box-shadow: none; transform: none;
  transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
}
.dl-root .tm-opcao:hover {
  background: var(--surface-2); border-color: var(--accent-soft);
  transform: translateY(-2px); box-shadow: none;
}
.dl-root .tm-opcao:focus-visible { outline: 2px solid var(--accent-soft); outline-offset: 2px; }
.tm-opcao__icone {
  width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center;
  background: rgba(99,102,241,0.14); border: 1px solid rgba(99,102,241,0.3);
  color: var(--accent-soft);
}
.tm-opcao:hover .tm-opcao__icone { background: rgba(212,175,55,0.14); border-color: rgba(212,175,55,0.34); color: var(--gold); }
.tm-opcao__titulo { font-size: 15px; font-weight: 700; color: var(--strong); letter-spacing: -0.015em; }
.tm-opcao__texto { font-size: 12.5px; line-height: 1.6; color: var(--subtle); }
.tm-opcao__seta { font-size: 15px; color: var(--placeholder); transition: color 0.18s ease, transform 0.18s ease; }
.tm-opcao:hover .tm-opcao__seta { color: var(--gold); transform: translateX(3px); }

.tm-rodape {
  margin-top: 18px; text-align: center;
  font-size: 11.5px; line-height: 1.6; color: var(--placeholder);
}

/* ── Passo da migração ── */
.tm-fichas { display: flex; flex-wrap: wrap; gap: 7px; }
.dl-root .tm-ficha {
  width: auto; padding: 8px 13px; border-radius: 999px; cursor: pointer;
  font-family: inherit; font-size: 12.5px; font-weight: 500;
  background: var(--surface); border: 1px solid var(--line); color: var(--subtle);
  box-shadow: none; transform: none;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}
.dl-root .tm-ficha:hover { background: var(--surface-2); color: var(--default); box-shadow: none; transform: none; }
.dl-root .tm-ficha.is-on {
  background: rgba(99,102,241,0.18); border-color: var(--accent-soft); color: var(--strong);
}
.tm-area { resize: vertical; min-height: 74px; line-height: 1.6; }

@media (max-width: 620px) {
  .tm-escolha { grid-template-columns: 1fr; margin-top: 18px; gap: 10px; }
}

@media (max-width: 560px) {
  /* ── Escolha do perfil, em tela cheia ──
     O modal ocupa a tela inteira no celular (ver modalCSS). O passo do perfil é
     o único que não tem formulário nenhum: são duas portas, e nada mais. Então
     as duas portas tomam tudo o que sobra abaixo do texto de abertura, em
     partes iguais — o primeiro cartão vai até a metade da altura, o segundo até
     o pé do modal, e o alvo de toque passa a ser metade de tela cada.

     Antes os cartões vinham comprimidos (ícone ao lado do título, seta
     escondida) porque empilhados eles passavam de uma tela. Com a tela toda o
     problema se inverteu — agora sobra altura —, então some a compressão e vale
     o arranjo em coluna do desktop, que tem a seta ancorada na última linha
     (o "1fr" do texto empurra ela para o rodapé do cartão). */
  .tm-caixa--perfil { display: flex; flex-direction: column; }
  /* flex-basis 0 nas duas: sem isso a altura do conteúdo entraria na conta e o
     cartão de texto mais longo ficaria maior que o outro. */
  .tm-escolha { flex: 1 1 0; margin-top: 16px; grid-template-rows: 1fr 1fr; }
  /* Dentro do cartão alto, NENHUMA linha vira 1fr: a linha elástica engoliria
     sozinha toda a sobra e abriria um vão de 60px no meio do texto. As quatro
     linhas ficam no tamanho do conteúdo e o bloco todo se centra — a sobra vai
     para as pontas, onde ela lê como respiro em vez de buraco.

     E o conteúdo cresce junto com o cartão: um botão de meia tela com ícone e
     título de tamanho de cartãozinho pareceria um cartão pequeno esticado. */
  .dl-root .tm-opcao {
    grid-template-rows: repeat(4, auto); align-content: center;
    gap: 10px; padding: 18px;
  }
  .tm-opcao__icone { width: 48px; height: 48px; border-radius: 14px; }
  .tm-opcao__icone svg { width: 25px; height: 25px; }
  .tm-opcao__titulo { font-size: 17px; }
  .tm-opcao__texto { font-size: 13px; line-height: 1.6; }
  .tm-opcao__seta { font-size: 17px; }
  .tm-rodape { margin-top: 14px; font-size: 11px; }

  /* ── Endereço da vitrine ──
     Sem corte no fim da linha: o endereço quebra e aparece inteiro. Cortado
     com reticências, o que sumiria seria justamente o slug, que fica no final
     e é a única parte que a pessoa escolheu. */
  .tm-endereco__url {
    white-space: normal; overflow: visible; text-overflow: clip;
    overflow-wrap: anywhere; line-height: 1.45;
  }
  .tm-endereco { padding: 8px 10px; }

  .tm-fichas { gap: 6px; }
  .dl-root .tm-ficha { padding: 7px 11px; font-size: 12px; }
  .tm-area { min-height: 62px; }
}
`;

export default TrialModal;
