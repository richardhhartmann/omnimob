/* ────────────────────────────────────────────────────────────────────────────
   Chaves de localStorage amarradas à IMOBILIÁRIA, não ao endereço dela.

   O SLUG É REUTILIZÁVEL. Uma imobiliária cancela, o endereço fica livre, e
   meses depois outra empresa assina e escolhe o mesmo "paper". Para o banco são
   dois tenants diferentes — cada um com o seu `id`, que nunca se repete. Para o
   `localStorage` chaveado por slug, eram a MESMA conta.

   O estrago não era só cosmético:

     · boas-vindas — a imobiliária nova nunca via o modal de primeiro acesso,
       porque o navegador ainda tinha a marca de "já viu" da anterior. Foi o
       sintoma que apareceu primeiro;
     · aviso de leads novos — o contador de "já vistos" vinha da outra empresa,
       então leads novos não acendiam o marcador;
     · histórico do editor de vitrine — o pior deles: a empresa nova abria o
       editor e encontrava os LAYOUTS SALVOS da anterior, com opção de
       restaurar. Configuração de uma imobiliária aparecendo na tela de outra.

   Por isso a chave passa a sair do `id`. Ele é um cuid gerado na criação do
   tenant e não é reaproveitado por ninguém, nunca.

   Devolve `null` quando não há id — e quem chama deve tratar isso pulando o
   armazenamento. Montar a chave assim mesmo produziria `..._undefined`, uma
   gaveta compartilhada por todo tenant sem id, que é o mesmo problema com outro
   nome.
   ──────────────────────────────────────────────────────────────────────────── */
export function chaveDoTenant(prefixo, tenantId) {
  if (!tenantId) return null;
  return `${prefixo}_${tenantId}`;
}

/* Leitura e escrita tolerantes: navegador em modo privado pode recusar o
   armazenamento, e nenhuma dessas informações vale derrubar uma tela. */
export function lerDoTenant(prefixo, tenantId) {
  const chave = chaveDoTenant(prefixo, tenantId);
  if (!chave) return null;
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

export function gravarNoTenant(prefixo, tenantId, valor) {
  const chave = chaveDoTenant(prefixo, tenantId);
  if (!chave) return;
  try {
    localStorage.setItem(chave, valor);
  } catch {
    /* sem storage: o estado volta ao padrão na próxima visita */
  }
}

/* Prefixos usados hoje. Ficam aqui para o próximo recurso que precisar guardar
   algo por imobiliária começar pelo lugar certo — foi a falta de um lugar assim
   que deixou quatro chaves nascerem chaveadas por slug, em quatro arquivos. */
export const CHAVES = {
  boasVindasVisto: "domus_boas_vindas_visto",
  boasVindasModo: "domus_boas_vindas_modo",
  leadsVistos: "domus_leads_seen",
  historicoEditor: "domus_builder_history",
  pulsoTrial: "domus_pulso_trial",
  /* ATALHO de leitura, não fonte de verdade: quem manda sobre o tour continua
     sendo o banco. Guardamos só o "já resolvido" para o recarregamento não
     esperar uma ida e voltar ao servidor mostrando um véu. Ver
     `PrimeiroAcessoTour`. */
  tourResolvido: "domus_tour_resolvido",
};

/* ── Chave da PESSOA, e não da imobiliária ───────────────────────────────────

   Nem tudo que se guarda no navegador é da imobiliária. O progresso do tour é
   da PESSOA: o servidor já o grava assim (`UsuarioTutorial` tem
   `@@unique([usuarioId, etapa])`), e só o atalho local estava chaveado por
   tenant.

   O estrago era exatamente o que a divisão por slug causava, um nível abaixo:
   o administrador concluía o tour, a marca ficava gravada para o TENANT, e a
   próxima pessoa que entrasse NAQUELE MESMO NAVEGADOR nunca via o convite — o
   atalho a silenciava antes de o servidor ser consultado. Ela não tinha como
   descobrir que existia um tour, nem como pedi-lo de volta.

   O `id` do usuário entra junto do id do tenant, e não no lugar dele: assim a
   gaveta continua separada por imobiliária mesmo que dois tenants tivessem, um
   dia, ids de usuário coincidentes.
   ────────────────────────────────────────────────────────────────────────── */
export function lerDoUsuario(prefixo, tenantId, usuarioId) {
  if (!usuarioId) return null;
  return lerDoTenant(`${prefixo}_u${usuarioId}`, tenantId);
}

export function gravarNoUsuario(prefixo, tenantId, usuarioId, valor) {
  if (!usuarioId) return;
  gravarNoTenant(`${prefixo}_u${usuarioId}`, tenantId, valor);
}
