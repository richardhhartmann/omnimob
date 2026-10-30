import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { prisma } from "../db.js";
import { emailDoUsuario, sendEmail } from "../services/notificationService.js";
import { emailRecuperarSenha } from "../services/emailTemplates.js";
import { requireAuth, ESCOPO_REATIVACAO, ESCOPO_DEMO } from "../middlewares/authMiddleware.js";
import { googleConfigurado, verificarTokenDoGoogle } from "../services/google.js";
import { situacaoDeGraca } from "../services/trialService.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import { loginSchema } from "../validators/authValidators.js";
import { PERMISSOES, CARGO_ADMIN } from "../services/cargosPadrao.js";
import { modulosDoTenant } from "../services/modulos.js";
import { normalizarAtalhos } from "../services/atalhos.js";

const JWT_SECRET = process.env.JWT_SECRET || "omnimob-dev-secret";

export const authRouter = Router();

/* O cargo que vai para a sessão, num lugar só.

   Existia escrito à mão em DOIS pontos deste arquivo (login e `/me`), e as duas
   cópias precisavam ser lembradas a cada permissão nova. Não foram: quando
   `verConfiguracoes` nasceu, ela ficou de fora das duas — o banco dizia que o
   Administrador podia ver Configurações, a sessão não carregava o campo, e o
   menu sumia. Pior, o sintoma se resolvia sozinho ao editar o cargo na tela
   (aquele caminho grava o cargo inteiro na sessão), o que faz o bug parecer
   intermitente em vez de sistemático.

   `PERMISSOES` é a mesma lista do catálogo de cargos: uma permissão nova entra
   na sessão sem ninguém precisar lembrar deste arquivo. */
/* ── O cargo como a TELA precisa dele ────────────────────────────────────────

   `PERMISSOES` é a lista do que se ESCOLHE, e `acessarPainel` saiu dela quando
   deixou de ser uma escolha. Só que a tela ainda lê essa chave — para decidir
   entre painel e vitrine, e hoje também para saber se o cargo alcança o HUB
   (é a `porta` do módulo, ver `services/modulos.js`). Sem ela na sessão, todo
   cargo sem `editarPagina` era despejado na vitrine ao entrar.

   ── POR QUE ELA DEIXOU DE SER CRAVADA `true` AQUI ──

   Vinha assim, com o argumento de que o cargo existe, logo entra. O argumento
   valia enquanto havia um painel só. Com dois módulos ela virou a porta do
   Hub, e cravá-la fazia TODO cargo alcançá-lo: um cargo só-Flow — Jurídico,
   Financeiro, ou qualquer um montado com o interruptor do Flow ligado e nada
   do Hub marcado — abria o seletor com os dois módulos, com chevron, e caía no
   Dashboard do Hub ao entrar. Na prática, cargo só-Flow não existia.

   Agora ela vem da COLUNA, que `cargoRoutes` deriva a cada gravação
   (`alcancaOHub`). Dois lugares cravando o mesmo `true` era o suficiente para
   a correção no outro parecer não ter surtido efeito nenhum.

   O `?? true` cobre a linha antiga: cargo gravado antes desta regra pode ter a
   coluna nula, e nula não é "não alcança" — é "ninguém decidiu ainda". */
function cargoDaSessao(cargo) {
  const saida = {
    id: cargo.id,
    descricao: cargo.descricao,
    acessarPainel: cargo.acessarPainel ?? true,
  };
  for (const p of PERMISSOES) saida[p] = Boolean(cargo[p]);
  return saida;
}

// Monta o payload de sessão (token + usuario + tenant) devolvido no login e ao
// definir a senha. `usuario` deve vir com include { tenant, cargo }.
/* Exportada para o super-admin poder ENTRAR numa imobiliária como o
   administrador dela (ver `adminRoutes`). Uma segunda montagem de sessão lá
   divergiria desta na primeira coisa que a tela passasse a ler — e a sessão é o
   objeto de que TODA a interface depende. */
export function montarSessao(usuario, { escopo = null, validade = null, suporte = null } = {}) {
  const token = jwt.sign(
    {
      userId: usuario.id,
      tenantId: usuario.tenantId,
      cargoCodigo: usuario.cargoCodigo,
      /* O identificador ÚNICO desta sessão. É o que permite encerrá-la sem
         derrubar as outras da mesma pessoa — sair no celular não pode matar o
         painel aberto no computador. Ver `SessaoRevogada` no schema. */
      jti: randomUUID(),
      // Só a sessão de reativação carrega escopo. Ver `authMiddleware.js`.
      ...(escopo ? { escopo } : {}),
      /* A equipe da Omnimob dentro da conta do cliente (o "Entrar" do
         super-admin). Assinado junto com o resto: é o que faz o chamado aberto
         daqui nascer INTERNO, e isso não pode vir do corpo da requisição. */
      ...(suporte ? { suporte } : {}),
    },
    JWT_SECRET,
    /* A sessão de reativação é curta de propósito: ela existe para uma compra,
       não para acompanhar a conta suspensa por uma semana. `validade` permite
       ao chamador encurtar mais — é o que o acesso do super-admin usa. */
    { expiresIn: validade || (escopo === ESCOPO_REATIVACAO ? "2h" : "7d") }
  );
  return {
    token,
    /* O painel inteiro olha para isto: com a conta suspensa, nenhuma tela é
       montada — só a parede de reativação. Ver `App.jsx`. */
    suspenso: escopo === ESCOPO_REATIVACAO,
    graca: escopo === ESCOPO_REATIVACAO ? situacaoDeGraca(usuario.tenant) : null,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      login: usuario.login,
      // Nulo diz "sem e-mail": é o que acende o pedido de e-mail no painel.
      email: usuario.email ?? null,
      cargo: cargoDaSessao(usuario.cargo),
      /* NULO é informação, não ausência: significa "nunca escolhi tema", e é o
         que faz o painel cair no da imobiliária. Normalizar para uma string
         aqui apagaria essa distinção e o administrador nunca mais alcançaria
         esta pessoa ao definir o padrão da casa. */
      temaPainel: usuario.temaPainel ?? null,
      atalhos: usuario.atalhos ?? null,
      /* O que o menu do perfil precisa saber sobre o vínculo. O `googleId` NÃO
         vai: ele é identificador de outra plataforma e não tem uso nenhum na
         tela — mandar seria expor sem motivo. */
      google: usuario.googleId
        ? {
            email: usuario.googleEmail,
            foto: usuario.googleFoto,
            nome: usuario.googleNome,
            vinculadoEm: usuario.googleVinculadoEm,
          }
        : null,
    },
    /* A tela usa para trocar o "abrir um chamado" pelo chamado interno. A
       DECISÃO continua no servidor (o token); isto é só não oferecer o
       formulário errado. */
    suporte: suporte || null,
    tenant: {
      id: usuario.tenant.id,
      name: usuario.tenant.name,
      slug: usuario.tenant.slug,
      whatsapp: usuario.tenant.whatsapp,
      email: usuario.tenant.email,
      description: usuario.tenant.description,
      slogan: usuario.tenant.slogan,
      logoUrl: usuario.tenant.logoUrl,
      // Cores do PAINEL. As da vitrine moram no `showcaseConfig`.
      primaryColor: usuario.tenant.primaryColor,
      secondaryColor: usuario.tenant.secondaryColor,
      temaImobiliaria: usuario.tenant.temaImobiliaria || "escuro",
      /* Os atalhos da casa e o interruptor mestre: o ouvinte do teclado e os
         selos ao lado dos botões leem da sessão, então eles precisam chegar
         junto — não numa segunda chamada depois da tela já ter desenhado. */
      atalhos: usuario.tenant.atalhos ?? null,
      atalhosAtivos: usuario.tenant.atalhosAtivos !== false,
      showcaseHeadline: usuario.tenant.showcaseHeadline,
      showcaseSubheadline: usuario.tenant.showcaseSubheadline,
      showcaseConfig: usuario.tenant.showcaseConfig,
      plano: (usuario.tenant.plano || "BASICO").toUpperCase(),
      autoGerarIA: usuario.tenant.autoGerarIA,
      /* Preferências da marca d'água. Vão na sessão porque quem precisa delas é
         o CADASTRO DE IMÓVEL, que compõe a foto no navegador antes de enviá-la
         — sem isto ele teria de buscar o perfil do tenant só para saber se
         desenha a logo, a cada foto. */
      marcaDaguaAtiva: usuario.tenant.marcaDaguaAtiva,
      marcaDaguaOpacidade: usuario.tenant.marcaDaguaOpacidade,
      /* Endereço público da vitrine. Vai na sessão porque TODO link para ela —
         "Ver página", copiar link, o que vai no post de divulgação — precisa
         apontar para o domínio da imobiliária quando ele existe. Sem isto cada
         tela teria de buscar o domínio por conta própria, e alguma esqueceria. */
      dominioProprio: usuario.tenant.dominioProprio,
      dominioStatus: usuario.tenant.dominioStatus,
      /* ── Os módulos contratados ──────────────────────────────────────────
         Vão na sessão porque quem decide o que DESENHAR é o `AdminLayout`, no
         primeiro quadro: o seletor de módulo, a barra lateral inteira e a rota
         inicial dependem disto. Buscar por uma chamada à parte faria o painel
         montar como Hub e trocar para Flow um segundo depois, na frente da
         pessoa — e quem entra direto numa rota do Flow seria despejado antes de
         a resposta chegar.

         Normalizado aqui e não na tela: `modulosDoTenant` garante o HUB para
         conta antiga (coluna vazia), e essa regra não pode ter duas versões. */
      modulos: modulosDoTenant(usuario.tenant),
    },
  };
}

authRouter.post("/login", async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados invalidos para login.", details: parsed.error.flatten() });
    }

    /* ── SEM `include`, E O MOTIVO É O RELÓGIO ──────────────────────────────

       Vinha com `include: { tenant: true, cargo: true }`, e o Prisma resolve
       relação em CONSULTAS SEPARADAS. Contra um banco remoto isso significava
       que o caminho de quem existe custava três idas e o de quem não existe,
       uma — 424 ms de diferença, medidos. A mensagem genérica e o
       `HASH_FANTASMA` não valiam nada diante disso: bastava cronometrar para
       enumerar quem tem conta.

       Agora o caminho de RECUSA é idêntico nos dois casos: uma consulta e um
       bcrypt. As relações só são buscadas depois de a senha conferir — quando
       já não há o que esconder de quem perguntou. */
    /* ── LOGIN OU E-MAIL ─────────────────────────────────────────────────────
       O identificador pode ser o login ("joao-imobiliaria-centro") ou o
       e-mail da pessoa. O e-mail NÃO é único no sistema — o dono que
       administra duas imobiliárias tem o mesmo e-mail nas duas —, então com
       "@" a busca devolve candidatos, e quem decide qual é a SENHA: a conta
       cuja senha confere é a conta. Com um candidato só, o caminho é o de
       sempre (trava de tentativas inclusive). Com vários e nenhum conferindo,
       a recusa é genérica e ninguém é penalizado — contar a falha numa conta
       escolhida ao acaso trancaria a pessoa errada. */
    const SELECAO = {
      id: true, nome: true, login: true, senha: true, ativo: true,
      tenantId: true, cargoCodigo: true, forcaAlterarSenha: true,
      tentativasFalhas: true, bloqueadoAte: true,
    };
    const identificador = parsed.data.login.trim();
    let usuario = null;
    let senhaJaConferida = false;
    if (identificador.includes("@")) {
      const candidatos = await prisma.usuario.findMany({
        where: { ativo: true, email: { equals: identificador, mode: "insensitive" } },
        select: SELECAO,
        orderBy: { createdAt: "asc" },
        take: 5,
      });
      if (candidatos.length === 1) {
        usuario = candidatos[0];
      } else if (candidatos.length > 1) {
        for (const c of candidatos) {
          if (c.senha && (await bcrypt.compare(parsed.data.senha, c.senha))) { usuario = c; senhaJaConferida = true; break; }
        }
        if (!usuario) {
          /* Existe mais de uma conta e a senha não abriu nenhuma. Sem contar
             tentativa em conta nenhuma — e sem a compensação de tempo: aqui
             já foram gastos N bcrypts, mais que o caminho de sucesso. */
          return res.status(401).json({ error: "Usuario ou senha invalidos." });
        }
      }
    } else {
      usuario = await prisma.usuario.findUnique({ where: { login: identificador }, select: SELECAO });
    }

    if (!usuario || !usuario.ativo) {
      /* Gasta o tempo do bcrypt mesmo sem ter contra o que comparar. Ver
         `HASH_FANTASMA`: sem isto o relógio denuncia quem existe, e a mensagem
         genérica logo abaixo não serve para nada. */
      await bcrypt.compare(String(parsed.data.senha || ""), HASH_FANTASMA);

      /* ── E gasta a IDA AO BANCO que o outro caminho gasta ─────────────────

         Quem existe e erra a senha paga uma segunda viagem: a gravação da
         tentativa falha. Contra um banco remoto isso são ~200 ms — mais do que
         os ~100 ms do bcrypt que o `HASH_FANTASMA` acabou de igualar, e
         suficiente para enumerar contas com um cronômetro.

         A alternativa era não esperar a gravação. Foi tentada, e quebrou a
         trava: a décima tentativa ainda não tinha sido contada quando a décima
         primeira chegou. Entre uma trava confiável e uma consulta de sobra por
         login inválido, a consulta é o preço menor.

         `count` sobre um id que não existe: uma viagem de ida e volta, com o
         índice primário respondendo vazio. Não escreve nada, não tranca nada. */
      await prisma.usuario.count({ where: { id: "__compensacao-de-tempo__" } });

      return res.status(401).json({ error: "Usuario ou senha invalidos." });
    }

    /* ── A conta está trancada? ─────────────────────────────────────────────
       ANTES de conferir a senha, e a ordem importa: conferir primeiro deixaria
       o atacante saber que acertou mesmo com a conta trancada, o que é
       exatamente o que ele quer descobrir.

       A mensagem diz o que houve, e isso é deliberado apesar de confirmar que a
       conta existe. Quem está trancado é o DONO tentando entrar — ele precisa
       saber que a espera tem fim, senão abre chamado. E o atacante já sabia que
       a conta existe: foi ele quem a escolheu. */
    if (usuario.bloqueadoAte && usuario.bloqueadoAte > new Date()) {
      const faltam = Math.max(1, Math.ceil((usuario.bloqueadoAte - Date.now()) / 60000));
      return res.status(429).json({
        error: `Muitas tentativas erradas. Tente de novo em ${faltam} minuto${faltam > 1 ? "s" : ""}.`,
        contaBloqueada: true,
      });
    }

    /* ── CONTA AINDA NÃO ATIVADA ────────────────────────────────────────────
       Usuário criado pelo painel nasce SEM senha, e a senha só nasce pelo
       link do e-mail de convite (ver `POST /api/usuarios`). Antes, uma conta
       sem senha entrava aqui e caía na tela de "defina sua senha" — o que
       significava que QUALQUER PESSOA que soubesse o login definia a senha e
       entrava. O convite por e-mail fecha essa porta: sem o link, não há
       ativação. A mensagem diz o caminho, e o administrador pode reenviar. */
    const temSenha = Boolean(usuario.senha);
    if (!temSenha) {
      return res.status(403).json({
        error: "Sua conta ainda não foi ativada. Use o link do e-mail de convite — ou peça ao administrador da sua imobiliária para reenviá-lo.",
        precisaAtivar: true,
        login: usuario.login,
      });
    }
    if (!senhaJaConferida) {
      const passwordMatch = await bcrypt.compare(parsed.data.senha, usuario.senha);
      if (!passwordMatch) {
        /* A tentativa é contada NA CONTA. `increment` e não ler-somar-gravar:
           duas tentativas simultâneas com leitura-e-escrita separadas gravariam
           o mesmo número, e o atacante ganharia tentativas de graça só
           paralelizando. */
        const n = usuario.tentativasFalhas + 1;

        /* ── COM `await`, E A TENTATIVA DE FAZER SEM ELE ENSINOU ALGO ───────

           Cheguei a tirar o `await` daqui, para igualar o tempo de resposta dos
           dois caminhos. Funcionou para o relógio e QUEBROU A TRAVA: a
           gravação da décima tentativa ainda não tinha chegado ao banco quando
           a décima primeira foi conferida, e a conta não bloqueava. O teste
           pegou.

           Uma trava de força bruta que conta com atraso não é uma trava. Então
           o `await` volta, e o tempo é igualado do outro lado — ver
           `passoDeCompensacao`, no caminho de quem não existe. */
        await prisma.usuario.update({
          where: { id: usuario.id },
          data: {
            tentativasFalhas: { increment: 1 },
            ...(n >= TENTATIVAS_ATE_BLOQUEAR
              ? { bloqueadoAte: new Date(Date.now() + MINUTOS_BLOQUEADO * 60000) }
              : {}),
          },
        });

        return res.status(401).json({ error: "Usuario ou senha invalidos." });
      }

      /* Acertou: o contador zera. Quem sabe a senha nunca chega perto da trava,
         e um dia ruim de digitação não se acumula com o do mês passado. */
      if (usuario.tentativasFalhas > 0 || usuario.bloqueadoAte) {
        await prisma.usuario.update({
          where: { id: usuario.id },
          data: { tentativasFalhas: 0, bloqueadoAte: null },
        });
      }
    }

    /* ── AGORA SIM: quem é a imobiliária desta pessoa ───────────────────────
       Segunda consulta, e só para quem provou a senha. Além de igualar o tempo
       do caminho de recusa (ver o comentário na busca acima), isto deixa de
       contar o estado da CONTA para quem não provou nada: antes, uma senha
       errada numa imobiliária suspensa já revelava a suspensão. */
    const conta = await prisma.usuario.findUnique({
      where: { id: usuario.id },
      include: { tenant: true, cargo: true },
    });
    Object.assign(usuario, { tenant: conta.tenant, cargo: conta.cargo, temaPainel: conta.temaPainel,
      atalhos: conta.atalhos, googleId: conta.googleId, googleEmail: conta.googleEmail,
      googleFoto: conta.googleFoto, googleNome: conta.googleNome, googleVinculadoEm: conta.googleVinculadoEm });

    /* ── A IMOBILIÁRIA ainda vale? ─────────────────────────────────────────
       O login conferia só `usuario.ativo`, e não a conta. Um tenant vencido e
       desativado pela faxina continuava deixando entrar: o token saía, o painel
       carregava, e só então cada requisição batia no `requireTenant` e falhava.
       A pessoa via uma tela meio montada quebrando aos poucos, sem nunca ler o
       motivo.

       A mensagem é ESPECÍFICA, e não o "usuário ou senha inválidos" genérico
       das linhas acima. Ali o texto vago existe para não confirmar quais logins
       existem; aqui as credenciais estão certas e quem entrou tem direito de
       saber o que aconteceu com a conta dele — esconder só geraria um chamado
       de suporte para uma pergunta que o e-mail de vencimento já respondeu. */
    /* ── Conta suspensa: parede, não porta trancada ────────────────────────
       Antes isto era um 403 seco, e havia um problema circular nele: a conta
       vencida perde o painel, mas o pagamento MORA no painel. O e-mail de
       vencimento mandava para o login, o login recusava, e a única forma de
       voltar a ser cliente era responder o e-mail e esperar alguém.

       Agora quem responde pela conta entra numa sessão de escopo reduzido —
       alcança duas rotas, ver a situação e assinar, e mais nada (a recusa é no
       `authMiddleware`, antes de qualquer regra de permissão). O painel não é
       montado: a pessoa cai na parede de reativação.

       Quem NÃO responde pela conta continua recebendo a recusa. Não é
       arbitrário: a parede existe para quem pode pagar, e um corretor preso
       nela sem poder fazer nada seria pior que a mensagem clara. */
    if (!usuario.tenant?.ativo) {
      if (usuario.cargo?.verConfiguracoes) {
        return res.json(montarSessao(usuario, { escopo: ESCOPO_REATIVACAO }));
      }
      return res.status(403).json({
        error:
          "O acesso desta imobiliária está suspenso porque o plano venceu. " +
          "Fale com quem responde pela conta: é preciso assinar um plano para recuperar o ambiente.",
        code: "TENANT_SUSPENSO",
      });
    }
    if (usuario.tenant.statusPagamento === "CANCELADO") {
      return res.status(403).json({
        error: "A assinatura desta imobiliária foi cancelada. Fale com o administrador da conta.",
        code: "TENANT_CANCELADO",
      });
    }

    // Marcado para trocar → exige definir nova senha (com a atual conferida).
    if (usuario.forcaAlterarSenha) {
      return res.status(403).json({
        error: "Defina sua senha para continuar.",
        forcaAlterarSenha: true,
        login: usuario.login,
      });
    }

    return res.json(montarSessao(usuario));
  } catch (err) {
    console.error("[POST /auth/login]", err);
    return res.status(500).json({ error: "Erro interno no servidor.", detail: err.message });
  }
});

/* ─── Conta Google ───────────────────────────────────────────────────────────

   Duas rotas, e a ORDEM entre elas é a regra de segurança inteira.

   VINCULAR exige estar logado. O vínculo nasce de quem JÁ PROVOU ser aquele
   usuário, com login e senha. É isso que impede alguém de apontar a própria
   conta Google para o usuário de outra pessoa.

   ENTRAR só PROCURA. Achou o `googleId`, devolve a sessão daquele usuário; não
   achou, recusa. Ela nunca cria usuário — se criasse, qualquer pessoa com uma
   conta Google entraria no painel de qualquer imobiliária.

   E a busca é por `googleId`, nunca por e-mail. E-mail corporativo é
   reatribuído: quem herdasse `vendas@imobiliaria.com` de um corretor que saiu
   entraria no sistema como ele. O `sub` do Google não é reatribuído nunca.
   ────────────────────────────────────────────────────────────────────────── */

authRouter.get("/google/disponivel", (req, res) => {
  /* A tela de login precisa saber se desenha o botão. Sem isto ela ou some com
     ele sempre, ou mostra um botão que falha no clique. */
  return res.json({ disponivel: googleConfigurado(), clientId: process.env.GOOGLE_CLIENT_ID || null });
});

authRouter.post("/google/vincular", requireAuth, requireTenant, async (req, res) => {
  try {
    const identidade = await verificarTokenDoGoogle(req.body?.credential);

    /* A conta já pertence a outra pessoa? Recusa, e diz o que aconteceu sem
       revelar QUEM — o nome do outro usuário não é assunto de quem tentou. */
    const jaUsada = await prisma.usuario.findUnique({
      where: { googleId: identidade.googleId },
      select: { id: true },
    });
    if (jaUsada && jaUsada.id !== req.authUserId) {
      return res.status(409).json({
        error: "Esta conta do Google já está vinculada a outro usuário.",
        code: "GOOGLE_JA_VINCULADO",
      });
    }

    const usuario = await prisma.usuario.update({
      where: { id: req.authUserId },
      data: {
        googleId: identidade.googleId,
        googleEmail: identidade.email,
        googleFoto: identidade.foto,
        googleNome: identidade.nome,
        googleVinculadoEm: new Date(),
        /* Foto e nome ficam em campos PRÓPRIOS e não tocam em `nome`/`foto` do
           cadastro. A distinção importa: o cadastro é o que a imobiliária
           publica — aparece na vitrine, nas listas, no widget de Equipe. Estes
           servem à MOLDURA DO PAINEL, que é o retrato que a pessoa vê de si
           mesma enquanto trabalha.

           Fossem a mesma coisa, vincular a conta pessoal de um corretor
           trocaria o nome dele na página pública da imobiliária. */
      },
      include: { tenant: true, cargo: true },
    });

    return res.json({
      vinculado: true,
      googleEmail: usuario.googleEmail,
      googleFoto: usuario.googleFoto,
      googleNome: usuario.googleNome,
    });
  } catch (err) {
    if (err.code === "GOOGLE_NAO_CONFIGURADO") return res.status(503).json({ error: err.message, code: err.code });
    if (err.code === "TOKEN_AUSENTE" || err.code === "TOKEN_INVALIDO" || err.code === "EMAIL_NAO_VERIFICADO") {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    console.error("[POST /auth/google/vincular]", err);
    return res.status(500).json({ error: "Erro ao vincular a conta do Google." });
  }
});

authRouter.delete("/google/vincular", requireAuth, requireTenant, async (req, res) => {
  try {
    await prisma.usuario.update({
      where: { id: req.authUserId },
      data: { googleId: null, googleEmail: null, googleFoto: null, googleVinculadoEm: null },
    });
    return res.json({ vinculado: false });
  } catch (err) {
    console.error("[DELETE /auth/google/vincular]", err);
    return res.status(500).json({ error: "Erro ao desvincular." });
  }
});

authRouter.post("/google/entrar", async (req, res) => {
  try {
    const identidade = await verificarTokenDoGoogle(req.body?.credential);

    const usuario = await prisma.usuario.findUnique({
      where: { googleId: identidade.googleId },
      include: { tenant: true, cargo: true },
    });

    /* A mensagem diz o CAMINHO, e não só o obstáculo. "Usuário não encontrado"
       manda a pessoa procurar um erro que não existe; a frase abaixo diz
       exatamente o que fazer — entrar uma vez com login e senha e vincular. */
    if (!usuario) {
      return res.status(404).json({
        error:
          "Nenhum usuário da Omnimob está vinculado a esta conta do Google. " +
          "Entre com seu login e senha uma vez e vincule a conta pelo menu do seu perfil.",
        code: "GOOGLE_SEM_VINCULO",
      });
    }
    if (!usuario.ativo) {
      return res.status(401).json({
        error: "Seu acesso foi encerrado. Fale com o administrador da sua imobiliária.",
        sessaoEncerrada: true,
      });
    }

    /* As MESMAS travas do login por senha. Entrar por Google não pode ser uma
       porta que ignora conta suspensa ou cancelada — seria o caminho mais curto
       para o vencimento não significar nada. */
    if (!usuario.tenant?.ativo) {
      if (usuario.cargo?.verConfiguracoes) {
        return res.json(montarSessao(usuario, { escopo: ESCOPO_REATIVACAO }));
      }
      return res.status(403).json({
        error:
          "O acesso desta imobiliária está suspenso porque o plano venceu. " +
          "Fale com quem responde pela conta.",
        code: "TENANT_SUSPENSO",
      });
    }
    if (usuario.tenant.statusPagamento === "CANCELADO") {
      return res.status(403).json({
        error: "A assinatura desta imobiliária foi cancelada. Fale com o administrador da conta.",
        code: "TENANT_CANCELADO",
      });
    }

    /* A foto do Google acompanha: ela muda quando a pessoa troca no Google, e
       guardar a de ontem daria um retrato desatualizado sem motivo. O CADASTRO
       continua intocado. */
    const mudou =
      (identidade.foto && identidade.foto !== usuario.googleFoto) ||
      (identidade.nome && identidade.nome !== usuario.googleNome);
    if (mudou) {
      await prisma.usuario.update({
        where: { id: usuario.id },
        data: { googleFoto: identidade.foto, googleNome: identidade.nome },
      }).catch(() => {});
      usuario.googleFoto = identidade.foto;
      usuario.googleNome = identidade.nome;
    }

    return res.json(montarSessao(usuario));
  } catch (err) {
    if (err.code === "GOOGLE_NAO_CONFIGURADO") return res.status(503).json({ error: err.message, code: err.code });
    if (err.code === "TOKEN_AUSENTE" || err.code === "TOKEN_INVALIDO" || err.code === "EMAIL_NAO_VERIFICADO") {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    console.error("[POST /auth/google/entrar]", err);
    return res.status(500).json({ error: "Erro ao entrar com o Google." });
  }
});

// Define uma nova senha (primeiro acesso ou troca obrigatória) e já autentica.
// Se o usuário já tiver senha, exige a senha atual; se não tiver (ativação), não.
authRouter.post("/definir-senha", async (req, res) => {
  try {
    const { login, senhaAtual, novaSenha } = req.body || {};
    if (!login || !novaSenha) {
      return res.status(400).json({ error: "Login e nova senha são obrigatórios." });
    }
    if (String(novaSenha).length < 6) {
      return res.status(400).json({ error: "A nova senha deve ter ao menos 6 caracteres." });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { login: String(login) },
      include: { tenant: true, cargo: true },
    });
    if (!usuario || !usuario.ativo) {
      return res.status(401).json({ error: "Usuário inválido." });
    }

    /* Conta sem senha NÃO se ativa por aqui: era o buraco — bastava saber o
       login. A ativação é pelo link do e-mail (`/redefinir-senha`), que só
       chega a quem é dono do endereço. Ver `POST /api/usuarios`. */
    if (!usuario.senha) {
      return res.status(403).json({
        error: "Esta conta ainda não foi ativada. Use o link do e-mail de convite.",
        precisaAtivar: true,
      });
    }

    // A senha atual precisa conferir (evita troca por terceiros).
    const ok = await bcrypt.compare(String(senhaAtual || ""), usuario.senha);
    if (!ok) return res.status(401).json({ error: "Senha atual incorreta." });

    const senhaHash = await bcrypt.hash(String(novaSenha), 10);
    const atualizado = await prisma.usuario.update({
      where: { id: usuario.id },
      data: { senha: senhaHash, forcaAlterarSenha: false },
      include: { tenant: true, cargo: true },
    });

    return res.json(montarSessao(atualizado));
  } catch (err) {
    console.error("[POST /auth/definir-senha]", err);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
});

/* ── A preferência de tema desta pessoa ──────────────────────────────────────
   Fica em `/auth`, e não em `/usuarios`: aquela rota exige `gerenciarUsuarios`
   porque administra OUTRAS pessoas. Esta é sobre si mesmo, e todo mundo que
   entra no painel pode ter uma opinião sobre a própria tela.

   `null` DESFAZ a escolha e devolve a pessoa ao tema da imobiliária — é o
   caminho de volta, e ele precisa existir: quem experimentou o claro e se
   arrependeu não deveria ficar preso a uma escolha.

   Sem `requireTenant`: a preferência é do usuário e não depende do cabeçalho de
   imobiliária. */
/* ── Os atalhos DESTA pessoa ─────────────────────────────────────────────────
   Sem `requireTenant`, pelo mesmo motivo do tema: a preferência é do usuário e
   não depende do cabeçalho de imobiliária.

   Grava só o que difere do padrão — a tela já manda assim (`apenasMudancas`), e
   aqui a validação é do FORMATO: chave de ação conhecida e tecla de uma letra
   ou dígito. String vazia passa de propósito: ela é a escolha "não quero atalho
   para isto", e recusá-la tiraria da pessoa a única forma de desligar um. */
authRouter.put("/meus-atalhos", requireAuth, async (req, res) => {
  try {
    const atalhos = normalizarAtalhos(req.body?.atalhos);
    if (atalhos === null) return res.status(400).json({ error: "Atalhos inválidos." });
    await prisma.usuario.update({ where: { id: req.authUserId }, data: { atalhos } });
    return res.json({ atalhos });
  } catch (erro) {
    console.error("[auth] atalhos:", erro);
    return res.status(500).json({ error: "Erro ao salvar os atalhos." });
  }
});

/* O PEDIDO DE E-MAIL: quem está sem e-mail cadastra o próprio. Só PREENCHE,
   nunca troca — o e-mail é o caminho do "esqueci a senha", e mudar um que já
   existe continua com o administrador (Usuários). O suporte dentro da conta
   não cadastra pelo cliente. */
authRouter.put("/meu-email", requireAuth, async (req, res) => {
  try {
    if (req.authSuporte) return res.status(403).json({ error: "O e-mail é da pessoa; a equipe da Omnimob não cadastra por ela." });
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) {
      return res.status(400).json({ error: "E-mail inválido." });
    }
    const atual = await prisma.usuario.findUnique({ where: { id: req.authUserId }, select: { email: true } });
    if (atual?.email) return res.status(409).json({ error: "Você já tem um e-mail cadastrado. Para trocar, fale com o administrador." });
    await prisma.usuario.update({ where: { id: req.authUserId }, data: { email } });
    return res.json({ email });
  } catch (erro) {
    console.error("[auth] meu-email:", erro);
    return res.status(500).json({ error: "Erro ao salvar o e-mail." });
  }
});

authRouter.put("/meu-tema", requireAuth, async (req, res) => {
  try {
    const bruto = req.body?.tema;
    const tema = bruto === null || bruto === "" ? null : String(bruto);
    if (tema !== null && !["claro", "escuro", "auto"].includes(tema)) {
      return res.status(400).json({ error: "Tema inválido." });
    }
    await prisma.usuario.update({ where: { id: req.authUserId }, data: { temaPainel: tema } });
    return res.json({ temaPainel: tema });
  } catch (erro) {
    console.error("[auth] tema:", erro);
    return res.status(500).json({ error: "Erro ao salvar o tema." });
  }
});

/* ────────────────────────────────────────────────────────────────────────────
   SAIR DE VERDADE.

   O "sair" do painel apagava o token do `localStorage` e mais nada. Isso não é
   encerrar sessão, é esconder a chave: o token continuava válido por até sete
   dias, e quem tivesse copiado aquele texto — de um navegador compartilhado, de
   um log, de um dump de memória — entrava sem obstáculo nenhum.

   ── SEM AUTENTICAÇÃO FORTE, DE PROPÓSITO ──

   Não usa `requireAuth`: ele recusaria um token já expirado ou já revogado, e
   nesses casos a resposta certa é "pronto, não vale mesmo" e não um erro. A
   autorização aqui é o próprio token — quem o apresenta pode encerrá-lo, e
   encerrar uma sessão que já não vale não faz mal a ninguém.

   ── POR QUE 200 EM QUALQUER DESFECHO ──

   Sair não pode falhar. Um erro aqui deixaria a pessoa presa numa tela com um
   botão que não funciona, e o desfecho dela — apagar a sessão local — acontece
   de qualquer jeito. O servidor faz a parte dele em silêncio.
   ──────────────────────────────────────────────────────────────────────────── */
/* ────────────────────────────────────────────────────────────────────────────
   FORÇA BRUTA: A TRAVA QUE SEGURA A CONTA, E NÃO O IP.

   O limite por IP (`authLimiter`, em `server.js`) não alcança o ataque que
   importa. Ele conta tentativas por ORIGEM, e quem ataca uma conta específica
   distribui: mil máquinas fazendo cinco tentativas cada passam por qualquer
   limite por IP sem esforço, e somam cinco mil tentativas contra a mesma senha.

   Estas duas colunas contam por CONTA, então não importa de onde a tentativa
   vem. Dez erros trancam por quinze minutos; o primeiro acerto zera tudo.

   ── OS NÚMEROS, E POR QUE NÃO SÃO MENORES ──

   Dez é generoso de propósito: quem digita a própria senha errado três vezes
   seguidas é rotina, e trancar aí produziria mais chamado de suporte do que
   segurança. Contra força bruta, o que vale não é o teto ser baixo — é ele
   existir: dez tentativas a cada quinze minutos são 960 por dia, contra um
   espaço de senha que não se percorre em séculos nesse ritmo.

   ── E POR QUE A CONTA NÃO FICA TRANCADA PARA SEMPRE ──

   Bloqueio permanente vira arma: basta errar a senha de alguém dez vezes para
   deixá-lo de fora até um humano intervir. A janela que expira sozinha tira o
   ataque de negação de serviço sem abrir mão da trava.
   ──────────────────────────────────────────────────────────────────────────── */
const TENTATIVAS_ATE_BLOQUEAR = 10;
const MINUTOS_BLOQUEADO = 15;

/* ── O TEMPO TAMBÉM CONTA UMA HISTÓRIA ───────────────────────────────────────

   A mensagem de erro é genérica ("Usuario ou senha invalidos"), e isso resolve
   metade do problema. A outra metade é o RELÓGIO: login inexistente respondia
   na hora, login existente com senha errada gastava os ~100 ms do bcrypt. Essa
   diferença é medível de fora, e transforma a mensagem genérica em decoração —
   dá para enumerar quem existe cronometrando as respostas.

   Comparar contra um hash descartável iguala os dois caminhos. O texto abaixo é
   um hash bcrypt de custo 10 de uma senha que ninguém conhece; ele nunca casa
   com nada, só gasta o mesmo tempo. */
const HASH_FANTASMA = "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

/* ── ENTRAR NA DEMONSTRAÇÃO ─────────────────────────────────────────────────
   Sem senha, sem cadastro: devolve uma sessão do Administrador da imobiliária
   de demonstração (`DEMO_TENANT_SLUG`), com o escopo que trava toda escrita
   (ver `ESCOPO_DEMO` no middleware) e validade curta — 45 minutos dão para o
   tour e para uma volta pelo painel; um token de sete dias para uma conta
   compartilhada seria um convite a ficar morando nela.

   Sem imobiliária configurada, ou sem Administrador ativo nela, a resposta é
   404 e a landing esconde o convite — melhor que abrir um painel vazio.

   A MESMA `montarSessao` do login, pelo mesmo motivo do acesso do super-admin:
   a sessão é o objeto de que a interface inteira depende, e uma segunda
   montagem divergiria dela na primeira coisa nova que a tela passasse a ler.
   `demo: true` na saída é o que o painel usa para trocar o convite do tour pelo
   tour obrigatório e mostrar a faixa "nada é salvo". */
authRouter.post("/demo", async (_req, res) => {
  const slug = (process.env.DEMO_TENANT_SLUG || "").trim();
  if (!slug) return res.status(404).json({ error: "A demonstração não está disponível." });

  try {
    const usuario = await prisma.usuario.findFirst({
      where: { ativo: true, tenant: { slug, ativo: true }, cargo: { descricao: CARGO_ADMIN } },
      orderBy: { createdAt: "asc" },
      include: { tenant: true, cargo: true },
    });
    if (!usuario) return res.status(404).json({ error: "A demonstração não está disponível." });

    return res.json({ ...montarSessao(usuario, { escopo: ESCOPO_DEMO, validade: "45m" }), demo: true });
  } catch (erro) {
    console.error("[POST /auth/demo]", erro);
    return res.status(500).json({ error: "Erro ao abrir a demonstração." });
  }
});

authRouter.post("/logout", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.json({ ok: true });

  try {
    /* `verify` e não `decode`: um token forjado não pode inserir linha nenhuma
       nesta tabela. Se ele não é válido, também não há sessão para encerrar. */
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload?.jti && payload?.userId) {
      await prisma.sessaoRevogada.upsert({
        where: { usuarioId_jti: { usuarioId: payload.userId, jti: payload.jti } },
        update: {},
        /* `expiraEm` é o vencimento do próprio token: depois disso ele não vale
           mais por conta própria, e a linha vira lixo que a faxina recolhe.
           Sem isto a tabela cresceria para sempre. */
        create: {
          usuarioId: payload.userId,
          jti: payload.jti,
          expiraEm: new Date((payload.exp ?? Math.floor(Date.now() / 1000) + 604800) * 1000),
        },
      });
    }
  } catch {
    /* Token expirado, forjado ou de antes do `jti`. Nos três casos não há o que
       revogar, e a pessoa está saindo de qualquer forma. */
  }

  return res.json({ ok: true });
});

authRouter.get("/me", requireAuth, requireTenant, async (req, res) => {
  try {
    const usuario = await prisma.usuario.findFirst({
      where: { id: req.authUserId, tenantId: req.tenant.id },
      include: { cargo: true },
    });
    if (!usuario || !usuario.ativo) {
      return res.status(401).json({ error: "Sessão inválida." });
    }
    return res.json({
      id: usuario.id,
      nome: usuario.nome,
      login: usuario.login,
      email: usuario.email ?? null,
      cargo: cargoDaSessao(usuario.cargo),
      // Mesma regra do login: nulo significa "nunca escolhi tema".
      temaPainel: usuario.temaPainel ?? null,
      atalhos: usuario.atalhos ?? null,
      /* O vínculo com o Google vem por aqui também: o painel relê `/auth/me` na
         montagem e no foco, e é essa releitura que faz o menu do perfil mudar
         de "vincular" para "vinculado" logo depois de a pessoa vincular. */
      google: usuario.googleId
        ? {
            email: usuario.googleEmail,
            foto: usuario.googleFoto,
            nome: usuario.googleNome,
            vinculadoEm: usuario.googleVinculadoEm,
          }
        : null,
      /* ── O que mudou na CONTA, e não na pessoa ───────────────────────────
         Esta rota é relida na montagem do painel e a cada foco da janela, e até
         aqui ela só devolvia o usuário. Bastava enquanto a única coisa volátil
         era a permissão do cargo.

         Com os módulos deixou de bastar: o administrador contrata o Flow e a
         equipe inteira continua sem o seletor na barra lateral por até sete
         dias — o tempo do token —, sem nada na tela explicando por quê. O plano
         tem exatamente o mesmo problema e sempre teve; quem faz upgrade para
         destravar um recurso precisa recarregar para vê-lo.

         Só estes dois campos, e não o tenant inteiro: o resto (cores, logo,
         vitrine) é editado pela própria pessoa em Configurações, que já atualiza
         a sessão na hora. Mandar tudo aqui atropelaria essa edição a cada foco
         da janela. */
      tenant: {
        modulos: modulosDoTenant(req.tenant),
        plano: (req.tenant.plano || "BASICO").toUpperCase(),
      },
    });
  } catch (err) {
    console.error("[GET /auth/me]", err);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
});

/* ─── Recuperação de senha ───────────────────────────────────────────────────
   Duas rotas: pedir o link e usar o link.

   TOKEN SEM TABELA. O link carrega um JWT curto contendo o id do usuário e uma
   IMPRESSÃO DIGITAL da senha atual. Ao redefinir, a senha muda, a impressão
   muda, e o token que sobrou no e-mail para de valer — uso único sem precisar
   guardar nada. Um link vazado depois do uso não abre nada; um link antigo
   deixa de valer assim que um novo é pedido e usado.

   Vale 1 hora. O convite de trial vale 30 minutos, mas ali a pessoa está no
   meio de um cadastro; aqui ela pode estar longe do computador.

   NÃO DIZEMOS SE A CONTA EXISTE. A resposta é a mesma para login conhecido,
   login inexistente e conta sem e-mail. Uma tela que responde "usuário não
   encontrado" é um verificador de logins válidos para quem quiser testar
   uma lista — e o login aqui é derivado do nome da imobiliária, que é público
   na vitrine. */
const VALIDADE_RECUPERACAO = "1h";
const PROPOSITO_RECUPERACAO = "recuperar-senha";

/* Deriva a impressão digital do hash da senha. É o hash de um hash: o valor não
   volta a ser a senha nem em teoria, e ainda assim muda a cada troca — que é a
   única propriedade de que precisamos. */
/* Exportada porque o convite do super-admin (`adminRoutes`) usa o MESMO
   mecanismo de link de uso único — e uma segunda impressão digital ali
   divergiria desta no primeiro ajuste. */
export function impressaoDaSenha(senhaHash) {
  return crypto.createHash("sha256").update(String(senhaHash || "")).digest("hex").slice(0, 16);
}

/* Exportada: o CONVITE de usuário (`POST /api/usuarios`) é o mesmo link de
   uso único — a impressão digital de uma senha vazia também muda quando a
   senha nasce. Só a validade é outra: 24 h, porque quem foi convidado pode
   abrir o e-mail no dia seguinte, e não está no meio de nada. */
export function assinarTokenRecuperacao(usuario, { validade = VALIDADE_RECUPERACAO } = {}) {
  return jwt.sign(
    { userId: usuario.id, proposito: PROPOSITO_RECUPERACAO, fp: impressaoDaSenha(usuario.senha) },
    JWT_SECRET,
    { expiresIn: validade },
  );
}

/**
 * Devolve o usuário do token, ou lança com `.code` explicando o motivo.
 * Um token já usado cai em TOKEN_USADO — mensagem diferente de "expirou",
 * porque a ação que a pessoa precisa tomar é outra (pedir um novo, não esperar).
 */
async function usuarioDoTokenRecuperacao(token) {
  let dados;
  try {
    dados = jwt.verify(String(token || ""), JWT_SECRET);
  } catch (erro) {
    const e = new Error(
      erro.name === "TokenExpiredError"
        ? "Este link expirou. Peça um novo."
        : "Link inválido. Peça um novo.",
    );
    e.code = erro.name === "TokenExpiredError" ? "TOKEN_EXPIRADO" : "TOKEN_INVALIDO";
    throw e;
  }

  if (dados.proposito !== PROPOSITO_RECUPERACAO) {
    const e = new Error("Link inválido. Peça um novo.");
    e.code = "TOKEN_INVALIDO";
    throw e;
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: String(dados.userId || "") },
    include: { tenant: true, cargo: true },
  });
  if (!usuario || !usuario.ativo) {
    const e = new Error("Link inválido. Peça um novo.");
    e.code = "TOKEN_INVALIDO";
    throw e;
  }

  if (dados.fp !== impressaoDaSenha(usuario.senha)) {
    const e = new Error("Este link já foi usado. Peça um novo.");
    e.code = "TOKEN_USADO";
    throw e;
  }

  return usuario;
}

authRouter.post("/recuperar-senha", async (req, res) => {
  /* Resposta única, montada antes de qualquer consulta: é o que garante que
     nenhum caminho de erro escape com uma mensagem diferente e entregue, pela
     diferença, a informação que a rota se recusa a dar. */
  const resposta = {
    ok: true,
    mensagem: "Se houver uma conta com esse acesso, enviamos um link para o e-mail cadastrado.",
  };

  try {
    const identificador = String(req.body?.identificador || "").trim();
    if (!identificador) return res.json(resposta);

    /* Aceita login ou e-mail: quem esqueceu a senha costuma não lembrar do
       login com sufixo da imobiliária ("joao-imobiliaria-centro"), e o e-mail
       é o que a pessoa sabe de cor. O do Google também vale: é para ele que o
       link vai, quando há conta vinculada. */
    const usuario = await prisma.usuario.findFirst({
      where: {
        ativo: true,
        OR: [
          { login: identificador },
          { email: { equals: identificador, mode: "insensitive" } },
          { googleEmail: { equals: identificador, mode: "insensitive" } },
        ],
      },
      include: { tenant: true },
    });
    const destino = emailDoUsuario(usuario);

    if (!destino) {
      /* Sem e-mail não há para onde mandar. Fica registrado porque é acionável:
         o administrador da imobiliária precisa preencher o e-mail da pessoa na
         tela de Usuários, e sem este log ninguém fica sabendo que alguém
         tentou e não conseguiu. */
      if (usuario) {
        console.warn(`[recuperar-senha] ${usuario.login} não tem e-mail cadastrado; link não enviado.`);
      }
      return res.json(resposta);
    }

    const token = assinarTokenRecuperacao(usuario);
    const base = (process.env.APP_URL || "").trim().replace(/\/+$/, "") || "https://omnimob.app";
    const link = `${base}/redefinir-senha?token=${encodeURIComponent(token)}`;

    const modelo = emailRecuperarSenha({
      nome: usuario.nome,
      link,
      imobiliaria: usuario.tenant?.name || "",
    });

    /* O envio NÃO é aguardado antes de responder. O transporte tem teto de 10s
       por tentativa, e prender a requisição por isso faria a tela parecer
       travada — além de transformar a demora num sinal de que a conta existe. */
    sendEmail({ to: destino, subject: modelo.subject, body: modelo.body, html: modelo.html })
      .catch((e) => console.error("[recuperar-senha] falha ao enviar:", e.message));

    return res.json(resposta);
  } catch (err) {
    console.error("[POST /auth/recuperar-senha]", err);
    // Mesmo em erro interno a resposta é a mesma. Ver o comentário de `resposta`.
    return res.json(resposta);
  }
});

/* Confere o link ANTES de a pessoa digitar a senha nova.
   Sem isto, ela escreveria a senha duas vezes para só então descobrir que o
   link expirou — e teria de escrever tudo de novo depois de pedir outro. */
authRouter.get("/redefinir-senha/:token", async (req, res) => {
  try {
    const usuario = await usuarioDoTokenRecuperacao(req.params.token);
    return res.json({ valido: true, nome: usuario.nome, login: usuario.login });
  } catch (err) {
    return res.status(400).json({ valido: false, error: err.message, code: err.code });
  }
});

authRouter.post("/redefinir-senha", async (req, res) => {
  try {
    const { token, novaSenha } = req.body || {};
    if (String(novaSenha || "").length < 6) {
      return res.status(400).json({ error: "A nova senha deve ter ao menos 6 caracteres." });
    }

    const usuario = await usuarioDoTokenRecuperacao(token);

    const senhaHash = await bcrypt.hash(String(novaSenha), 10);
    const atualizado = await prisma.usuario.update({
      where: { id: usuario.id },
      /* `forcaAlterarSenha: false` porque a pessoa ACABOU de escolher a senha.
         Deixar a marca de pé mandaria ela para a tela de trocar senha logo após
         ter trocado — que é o tipo de laço que faz alguém desistir de entrar. */
      data: { senha: senhaHash, forcaAlterarSenha: false },
      include: { tenant: true, cargo: true },
    });

    // Já devolve a sessão: quem redefiniu entra direto, sem passar pelo login.
    return res.json(montarSessao(atualizado));
  } catch (err) {
    if (err.code) return res.status(400).json({ error: err.message, code: err.code });
    console.error("[POST /auth/redefinir-senha]", err);
    return res.status(500).json({ error: "Erro ao redefinir a senha." });
  }
});
