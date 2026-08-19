import { Link } from "react-router-dom";
import { PaginaPublica, Secao } from "../../components/PaginaPublica.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   Política de Privacidade.

   Não é peça de marketing: é obrigação da LGPD (Lei 13.709/2018) para quem
   trata dado pessoal, e a Omnimob trata em dois papéis diferentes ao mesmo
   tempo — o que é justamente a parte que quase toda política de SaaS erra.

     · CONTROLADORA dos dados de quem contrata (a imobiliária e a equipe dela);
     · OPERADORA dos dados que a imobiliária cadastra (clientes e leads).

   A distinção não é jurídica-decorativa: ela decide quem responde a um pedido
   de exclusão. Se um comprador pedir para ser apagado, quem decide é a
   imobiliária, não a Omnimob — e a política precisa dizer isso, senão a
   Omnimob assume um dever que não é dela e a imobiliária deixa de cumprir o
   que é.

   O conteúdo abaixo descreve o que o sistema FAZ DE VERDADE. Cada terceiro
   listado está no código: Cloudinary (upload direto do navegador), Stripe
   (cobrança), Resend (e-mail), Google Gemini (geração de texto), Meta (Graph
   API), Supabase (banco), Vercel e Render (hospedagem).
   ──────────────────────────────────────────────────────────────────────────── */

const ATUALIZADO = "18 de agosto de 2026";

/* Cada linha é um serviço que o código realmente chama. Manter a lista colada
   à realidade é o que separa uma política de um texto genérico — e é ela que
   um encarregado de dados vai conferir primeiro. */
const TERCEIROS = [
  ["Supabase", "Banco de dados (PostgreSQL)", "Todos os dados da plataforma", "Brasil / EUA"],
  ["Cloudinary", "Armazenamento de imagens", "Fotos de imóveis e logotipos", "EUA"],
  ["Stripe", "Cobrança de assinaturas", "Nome, e-mail e dados de pagamento do contratante", "EUA"],
  ["Resend", "Envio de e-mails", "E-mail e nome do destinatário", "EUA"],
  ["Google (Gemini)", "Geração de texto por IA", "Descrição e características do imóvel", "EUA"],
  ["Meta (Facebook/Instagram)", "Publicação em redes sociais", "Conteúdo do anúncio publicado", "EUA"],
  ["Vercel e Render", "Hospedagem da aplicação", "Registros de acesso", "EUA"],
];

export function PrivacidadePage() {
  return (
    <PaginaPublica
      olho="Documento legal"
      titulo="Política de Privacidade"
      subtitulo="Quais dados a Omnimob trata, por quê, com quem compartilha e como você exerce seus direitos."
      descricao="Política de Privacidade da Omnimob: dados tratados, base legal, terceiros envolvidos e como exercer os direitos previstos na LGPD."
    >
      <p className="pp-atualizado">Última atualização: {ATUALIZADO}</p>

      <div className="pp-aviso">
        <strong>Antes de publicar:</strong> este documento descreve com precisão o que o sistema faz,
        mas não substitui a revisão de um advogado. Confirme com o seu jurídico o enquadramento das
        bases legais e os prazos de retenção antes de tratá-lo como definitivo.
      </div>

      <Secao titulo="1. Quem trata os seus dados">
        <p>
          A Omnimob é uma plataforma de gestão imobiliária que fornece painel administrativo e
          vitrine digital a imobiliárias e corretores. Nesta política, “<strong>Omnimob</strong>”,
          “nós” e “plataforma” se referem à empresa responsável pelo serviço; “<strong>você</strong>”
          se refere a quem usa a plataforma ou tem dados tratados nela.
        </p>
        <p>
          Contato do responsável pelo tratamento de dados:{" "}
          <a href="mailto:privacidade@omnimob.app">privacidade@omnimob.app</a>.
        </p>
      </Secao>

      <Secao titulo="2. Os dois papéis da Omnimob">
        <p>
          A Omnimob trata dados em <strong>duas posições distintas</strong>, e saber qual é qual
          determina a quem você deve dirigir um pedido:
        </p>
        <h3>Como controladora</h3>
        <p>
          Dos dados de quem <strong>contrata</strong> a plataforma: a imobiliária, o corretor
          responsável e os usuários que ela cadastra na equipe. Somos nós que decidimos por que e
          como esses dados são tratados — cadastro, cobrança, suporte e comunicação sobre o serviço.
        </p>
        <h3>Como operadora</h3>
        <p>
          Dos dados que a imobiliária <strong>cadastra dentro da plataforma</strong>: clientes,
          proprietários e as pessoas que preenchem o formulário de interesse na vitrine. Nesses
          casos quem decide o tratamento é a imobiliária — ela é a controladora, e nós tratamos os
          dados seguindo as instruções dela.
        </p>
        <p>
          Na prática: se você preencheu um formulário na vitrine de uma imobiliária e quer que seus
          dados sejam apagados, <strong>peça à imobiliária</strong>. Se ela nos acionar, executamos.
          Se preferir, escreva para nós e encaminhamos o pedido a ela.
        </p>
      </Secao>

      <Secao titulo="3. Dados que tratamos">
        <h3>De quem contrata</h3>
        <ul>
          <li>Identificação da empresa: razão social ou nome, CNPJ e CRECI.</li>
          <li>Contato: e-mail, telefone, WhatsApp e endereço.</li>
          <li>Acesso: nome, login, e-mail e senha (guardada apenas como <em>hash</em> bcrypt — não temos como ler a sua senha).</li>
          <li>Cobrança: plano contratado, situação do pagamento e vencimento. Os dados do cartão ficam com o Stripe; eles não passam pelos nossos servidores.</li>
          <li>Uso: registro de criação, alteração e exclusão feitas no painel, com autor, data, endereço IP e rota — é a trilha de auditoria que a própria imobiliária consulta.</li>
        </ul>

        <h3>De quem a imobiliária cadastra</h3>
        <ul>
          <li>Clientes: nome, CPF, RG, data de nascimento, e-mail, telefone, WhatsApp e endereço.</li>
          <li>Interessados (leads): nome, e-mail, telefone e a mensagem enviada pelo formulário da vitrine.</li>
          <li>Perfis de busca: as preferências de imóvel que o corretor registra para o cliente.</li>
          <li>Consentimento para divulgação: se a pessoa aceitou receber ofertas, e a data em que aceitou.</li>
        </ul>

        <h3>De quem visita uma vitrine</h3>
        <ul>
          <li>Eventos de visualização de imóvel, sem identificação pessoal.</li>
          <li>Registros técnicos de acesso mantidos pelos serviços de hospedagem.</li>
        </ul>
        <p>
          <strong>Não tratamos</strong> dados sensíveis (origem racial, convicção religiosa, opinião
          política, saúde, vida sexual, dado genético ou biométrico) nem dados de crianças e
          adolescentes. A plataforma não os pede em campo nenhum.
        </p>
      </Secao>

      <Secao titulo="4. Por que tratamos (base legal)">
        <ul>
          <li><strong>Execução de contrato</strong> — dar acesso ao painel, hospedar a vitrine, publicar anúncios e cobrar a assinatura.</li>
          <li><strong>Obrigação legal</strong> — guardar registros de acesso conforme o Marco Civil da Internet e cumprir exigências fiscais.</li>
          <li><strong>Legítimo interesse</strong> — segurança da plataforma, prevenção a fraude e a trilha de auditoria que permite a uma imobiliária saber quem alterou o quê.</li>
          <li><strong>Consentimento</strong> — envio de ofertas de imóveis a quem marcou que aceita recebê-las. Pode ser retirado a qualquer momento.</li>
        </ul>
      </Secao>

      <Secao titulo="5. Com quem compartilhamos">
        <p>
          Não vendemos dados pessoais e não os cedemos para publicidade de terceiros. Compartilhamos
          apenas com os prestadores necessários para o serviço funcionar:
        </p>
        <div className="pp-tabela-caixa">
          <table className="pp-tabela">
            <thead>
              <tr><th>Serviço</th><th>Para quê</th><th>O que recebe</th><th>Onde fica</th></tr>
            </thead>
            <tbody>
              {TERCEIROS.map((t) => (
                <tr key={t[0]}>
                  <td>{t[0]}</td><td>{t[1]}</td><td>{t[2]}</td><td>{t[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Parte desses serviços fica fora do Brasil. A transferência internacional segue o artigo 33
          da LGPD, amparada na execução do contrato e nas cláusulas contratuais dos fornecedores.
        </p>
        <p>
          A publicação em Facebook e Instagram só acontece quando a imobiliária conecta a própria
          conta e escolhe publicar. Nada é enviado às redes sem essa ação.
        </p>
      </Secao>

      <Secao titulo="6. Inteligência artificial">
        <p>
          A plataforma usa o Google Gemini para gerar descrições, títulos e textos de divulgação de
          imóveis. O que enviamos ao modelo são <strong>características do imóvel</strong> — tipo,
          área, quartos, bairro, preço. Dados pessoais de clientes e de leads não são enviados para
          geração de conteúdo publicitário.
        </p>
        <p>
          A análise de lead (recurso do plano Premium) envia a mensagem escrita pela pessoa
          interessada para produzir um resumo e uma sugestão de resposta ao corretor. Esse
          processamento é acionado por quem opera o painel, caso a caso, e o resultado não é
          guardado.
        </p>
      </Secao>

      <Secao titulo="7. Por quanto tempo guardamos">
        <ul>
          <li><strong>Enquanto a conta existir</strong> — dados de cadastro, imóveis, clientes e leads.</li>
          <li><strong>Após o encerramento</strong> — a conta é desativada e, terminado o período de recuperação, os dados são removidos junto com ela.</li>
          <li><strong>Registros de acesso</strong> — 6 meses, conforme o Marco Civil da Internet.</li>
          <li><strong>Dados fiscais e de cobrança</strong> — pelo prazo exigido pela legislação tributária.</li>
        </ul>
      </Secao>

      <Secao titulo="8. Segurança">
        <p>Medidas em vigor hoje na plataforma:</p>
        <ul>
          <li>Tráfego cifrado por HTTPS em todos os endereços, com HSTS.</li>
          <li>Senhas guardadas como <em>hash</em> bcrypt — irreversível.</li>
          <li>Separação estrita por imobiliária: toda consulta filtra pela empresa dona do dado, e essa separação é coberta por testes automatizados.</li>
          <li>Permissões por cargo, conferidas no servidor a cada requisição — retirar um acesso vale imediatamente.</li>
          <li>Credenciais de terceiros (como o token da página do Facebook) cifradas em repouso com AES-256-GCM.</li>
          <li>Trilha de auditoria de criações, alterações e exclusões.</li>
          <li>Limite de tentativas de login para conter ataques de força bruta.</li>
        </ul>
        <p>
          Nenhum sistema é imune. Se ocorrer incidente de segurança com risco relevante, comunicamos
          os afetados e a ANPD nos prazos da lei.
        </p>
      </Secao>

      <Secao titulo="9. Seus direitos">
        <p>A LGPD garante a você, a qualquer momento e sem custo:</p>
        <ul>
          <li>Confirmação de que tratamos seus dados e acesso a eles.</li>
          <li>Correção de dados incompletos, inexatos ou desatualizados.</li>
          <li>Anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desacordo com a lei.</li>
          <li>Portabilidade a outro fornecedor.</li>
          <li>Eliminação dos dados tratados com base em consentimento.</li>
          <li>Informação sobre com quem compartilhamos seus dados.</li>
          <li>Revogação do consentimento.</li>
        </ul>
        <p>
          Escreva para <a href="mailto:privacidade@omnimob.app">privacidade@omnimob.app</a>.
          Respondemos em até 15 dias. Podemos pedir informações que confirmem a sua identidade —
          é o que impede alguém de pedir dados no seu lugar.
        </p>
        <p>
          Se os seus dados foram cadastrados por uma imobiliária cliente, veja a seção 2: o pedido
          deve ir a ela, e nós ajudamos a encaminhá-lo.
        </p>
      </Secao>

      <Secao titulo="10. Cookies e armazenamento local">
        <p>
          A plataforma não usa cookies de publicidade nem de rastreamento entre sites. Usamos o
          armazenamento local do navegador para manter você conectado, guardar preferências de
          interface (menu recolhido, nível de animações) e lembrar avisos já vistos. Limpar os
          dados do navegador apaga tudo isso e apenas exige um novo login.
        </p>
      </Secao>

      <Secao titulo="11. Mudanças nesta política">
        <p>
          Quando esta política mudar de forma relevante, avisamos por e-mail e atualizamos a data no
          topo. Continuar usando a plataforma depois disso significa concordar com a versão vigente.
        </p>
      </Secao>

      <Secao titulo="12. Fale conosco">
        <p>
          Dúvidas sobre esta política, pedidos relativos aos seus dados ou comunicação de incidente:{" "}
          <a href="mailto:privacidade@omnimob.app">privacidade@omnimob.app</a>. Para assuntos gerais,
          use a <Link to="/contato">página de contato</Link>. As condições de uso do serviço estão
          nos <Link to="/termos">Termos de Uso</Link>.
        </p>
      </Secao>
    </PaginaPublica>
  );
}
