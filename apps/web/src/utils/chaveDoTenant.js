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
  /* ATALHO de leitura, não fonte de verdade — mesma natureza de
     `tourResolvido`, abaixo. Quem manda sobre as boas-vindas é o banco
     (`Tenant.boasVindasVistas`); isto aqui existe só para o recarregamento de
     quem já foi recebido não segurar a tela num véu de "Preparando seu painel…"
     esperando por uma resposta que só pode ser "não há nada a mostrar".
     Ver `BoasVindasModal`. */
  boasVindasResolvido: "domus_boas_vindas_resolvido",
  leadsVistos: "domus_leads_seen",
  historicoEditor: "domus_builder_history",
  pulsoTrial: "domus_pulso_trial",
  /* ATALHO de leitura, não fonte de verdade: quem manda sobre o tour continua
     sendo o banco. Guardamos só o "já resolvido" para o recarregamento não
     esperar uma ida e voltar ao servidor mostrando um véu. Ver
     `PrimeiroAcessoTour`. */
  tourResolvido: "domus_tour_resolvido",
  /* Em que módulo a pessoa estava da última vez (Hub ou Flow).

     É PREFERÊNCIA, não permissão — cabe no navegador. Quem manda sobre o acesso
     continua sendo o banco (`Tenant.modulos` mais `Cargo.acessarFlow`), e o
     valor guardado aqui é conferido contra os dois na leitura: um cargo que
     perdeu o Flow volta para o Hub sozinho, mesmo com a marca antiga no
     armazenamento.

     Chaveada por USUÁRIO dentro do tenant, e é o mesmo motivo do
     `tourResolvido`: numa recepção com um computador compartilhado, guardar por
     imobiliária faria a corretora que trabalha no Flow abrir o painel no módulo
     em que o colega do administrativo parou. */
  moduloAtivo: "domus_modulo_ativo",
  /* Mesmo atalho do `tourResolvido`, para o tour do OUTRO módulo. Uma chave
     própria e não um sufixo na mesma: o tour do Hub e o do Flow são resolvidos
     em momentos diferentes (um no primeiro acesso ao painel, outro na primeira
     entrada no módulo), e uma marca só faria concluir um silenciar o outro. */
  tourFlowResolvido: "domus_tour_flow_resolvido",
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
