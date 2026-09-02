/* ────────────────────────────────────────────────────────────────────────────
   O CADASTRO DE IMÓVEL INTERROMPIDO — as regras do lado da tela.

   O formulário de imóvel é a tela mais longa do painel: quatro etapas, quarenta
   campos e as fotos. Sair no meio não é acidente, é o normal — falta a metragem
   exata, falta o CEP, o cliente ligou. Até aqui isso apagava tudo.

   Este arquivo responde três perguntas, e só elas. A gravação mora na `api.js`,
   o gesto mora no `PropertyForm`, e a lista mora no `AdminLayout`.

     1. VALE A PENA guardar? (`valeGuardar`)
     2. Como a pessoa RECONHECE este rascunho na lista? (`rotuloDoRascunho`)
     3. O que dizer sobre o que NÃO voltou junto? (`avisoDeFotos`)

   ── AS FOTOS NÃO VOLTAM, E ISSO É DITO EM VOZ ALTA ──

   Elas só sobem ao Cloudinary no momento de publicar — até lá são objetos
   `File` no navegador, que não atravessam um JSON. Enviá-las por causa de um
   cadastro que talvez nunca seja concluído gastaria cota da conta com o que foi
   abandonado.

   O que se guarda é QUANTAS havia. Um rascunho que volta silenciosamente sem as
   fotos é pior que nenhum rascunho: a pessoa preenche o resto, clica em
   publicar e só então descobre — no meio da validação — que faltam as fotos que
   ela jura ter colocado.
   ────────────────────────────────────────────────────────────────────────── */

/** O parâmetro que abre o formulário já com um rascunho dentro. */
export const PARAMETRO_RASCUNHO = "rascunho";

/** Uma chave nova, para o formulário que está abrindo agora.
 *
 *  `randomUUID` quando existe; a alternativa cobre o navegador antigo e o
 *  contexto sem `crypto` (a suíte de testes monta componentes fora do browser).
 *  O que importa não é ser criptograficamente único — é duas abas abertas ao
 *  mesmo tempo não escreverem no mesmo rascunho. */
export function novaChaveDeRascunho() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch { /* contexto sem crypto — cai no de baixo */ }
  return `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/* Os campos que, preenchidos, significam "esta pessoa começou a cadastrar algo
   de verdade". Não é a lista inteira do formulário de propósito: `finalidade`,
   `status` e `andamento` nascem preenchidos, e contá-los faria TODO formulário
   aberto por engano virar um rascunho na lista de alguém. */
const CAMPOS_QUE_CONTAM = [
  "title", "description", "price", "cep", "address", "neighborhood", "city",
  "state", "bedrooms", "parkingSpots", "suites", "salas", "banheiros",
  "squareFootage", "areaTerreno", "areaConstruida", "areaPrivativa", "areaTotal",
  "tipoImovelId", "tipoContrato",
];

/**
 * Vale guardar este formulário?
 *
 * A resposta é "não" na esmagadora maioria das vezes que o formulário é aberto:
 * quem clica em "Novo Imóvel", olha e sai não começou nada, e um rascunho vazio
 * na lista é ruído que ensina a ignorar a lista inteira.
 *
 * Uma foto solta CONTA. Arrastar as fotos é o primeiro gesto de muita gente —
 * e é justamente quem faz isso que mais perde ao sair, porque a IA preenche
 * título e descrição a partir delas.
 */
export function valeGuardar(form, quantasFotos = 0) {
  if (!form || typeof form !== "object") return false;
  if (quantasFotos > 0) return true;
  if (Array.isArray(form.atributosIds) && form.atributosIds.length > 0) return true;
  return CAMPOS_QUE_CONTAM.some((campo) => {
    const v = form[campo];
    return typeof v === "string" ? v.trim() !== "" : v !== null && v !== undefined && v !== "";
  });
}

/**
 * Como a pessoa reconhece o rascunho na lista.
 *
 * A ordem é a da informação mais específica para a mais genérica: o título que
 * ela escreveu, o endereço, o bairro com a cidade. Sem nenhum dos três não se
 * inventa um nome — "Cadastro sem título" diz a verdade, e a etapa e a hora ao
 * lado é que fazem a pessoa lembrar de qual era.
 */
export function rotuloDoRascunho(form) {
  if (!form || typeof form !== "object") return "";
  const titulo = (form.title || "").trim();
  if (titulo) return titulo.slice(0, 120);

  const endereco = (form.address || "").trim();
  if (endereco) return endereco.slice(0, 120);

  const local = [form.neighborhood, form.city].map((v) => (v || "").trim()).filter(Boolean);
  if (local.length) return local.join(" · ").slice(0, 120);

  return "";
}

/** O aviso sobre as fotos que ficaram para trás, ou `null` quando não havia. */
export function avisoDeFotos(quantas) {
  const n = Number(quantas) || 0;
  if (n <= 0) return null;
  return n === 1
    ? "A foto que você tinha adicionado não é guardada no rascunho — envie-a de novo antes de publicar."
    : `As ${n} fotos que você tinha adicionado não são guardadas no rascunho — envie-as de novo antes de publicar.`;
}

/** "há 3 minutos", "ontem", "12/08". A mesma leitura que as listas do painel
 *  já fazem — quem olha a lista quer saber se é o de agora ou o da semana
 *  passada, não o carimbo exato. */
export function quandoFoi(iso) {
  if (!iso) return "";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  const minutos = Math.floor((Date.now() - data.getTime()) / 60000);
  if (minutos < 1) return "agora mesmo";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return horas === 1 ? "há 1 hora" : `há ${horas} horas`;
  const dias = Math.floor(horas / 24);
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
