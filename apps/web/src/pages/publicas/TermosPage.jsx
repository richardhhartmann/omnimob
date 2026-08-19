import { Link } from "react-router-dom";
import { PaginaPublica, Secao } from "../../components/PaginaPublica.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   Termos de Uso.

   O par da Política de Privacidade: aquela diz o que fazemos com os dados,
   este diz o que cada lado deve ao outro. Escrito a partir do que a plataforma
   realmente oferece — teste grátis com prazo, planos com limites por recurso,
   assinatura mensal ou anual pelo Stripe, vitrine em subdomínio ou domínio
   próprio, publicação em redes sociais e geração de texto por IA.

   O ponto que mais importa e que quase nunca aparece nesses documentos: quem
   responde pelo CONTEÚDO anunciado é a imobiliária, não a plataforma. Ela é
   quem tem CRECI, quem conhece o imóvel e quem assina o anúncio. Sem essa
   linha, a Omnimob herda responsabilidade sobre preço, metragem e disponibi-
   lidade de imóvel que nunca viu.
   ──────────────────────────────────────────────────────────────────────────── */

const ATUALIZADO = "18 de agosto de 2026";

export function TermosPage() {
  return (
    <PaginaPublica
      olho="Documento legal"
      titulo="Termos de Uso"
      subtitulo="As regras do serviço: o que a Omnimob entrega, o que cabe a você e como a assinatura funciona."
      descricao="Termos de Uso da Omnimob: escopo do serviço, responsabilidades, planos, pagamento, cancelamento e propriedade dos dados."
    >
      <p className="pp-atualizado">Última atualização: {ATUALIZADO}</p>

      <div className="pp-aviso">
        <strong>Antes de publicar:</strong> este texto reflete fielmente como o produto funciona,
        mas condições contratuais têm efeito jurídico. Peça a revisão de um advogado antes de
        colocá-lo no ar como definitivo.
      </div>

      <Secao titulo="1. O que você está contratando">
        <p>
          A Omnimob é uma plataforma de gestão imobiliária entregue como serviço pela internet. Ao
          contratar, você passa a ter acesso a um painel administrativo e a uma vitrine pública
          personalizável para divulgar imóveis.
        </p>
        <p>
          O serviço é <strong>software</strong>. A Omnimob não intermedeia negócios imobiliários,
          não avalia imóveis, não participa de negociações e não recebe comissão sobre vendas ou
          locações fechadas por meio dela.
        </p>
      </Secao>

      <Secao titulo="2. Quem pode contratar">
        <p>
          Pessoas físicas ou jurídicas com capacidade civil que atuem no mercado imobiliário. Ao
          criar uma conta, você declara que as informações são verdadeiras e que tem poderes para
          representar a empresa que está cadastrando.
        </p>
        <p>
          A legislação brasileira exige registro no CRECI para intermediação imobiliária. Manter o
          registro válido e informá-lo corretamente nos anúncios é responsabilidade sua — a
          plataforma oferece o campo, mas não fiscaliza a inscrição.
        </p>
      </Secao>

      <Secao titulo="3. Teste grátis">
        <p>
          Contas novas começam em período de teste com prazo definido no momento do cadastro,
          <strong> sem cobrança e sem cartão de crédito</strong>. Durante o teste, os recursos são os
          do plano escolhido.
        </p>
        <p>
          Terminado o prazo sem assinatura, a conta é desativada: o painel e a vitrine deixam de
          responder. Os dados ficam guardados por um período de recuperação e, depois dele, são
          removidos definitivamente. Assinar antes disso reativa o mesmo ambiente, com tudo que foi
          cadastrado — nada precisa ser refeito.
        </p>
      </Secao>

      <Secao titulo="4. Planos, pagamento e reajuste">
        <ul>
          <li>Os planos e o que cada um inclui estão descritos na <Link to="/">página inicial</Link> e valem a partir da contratação.</li>
          <li>A cobrança é <strong>mensal ou anual</strong>, conforme a escolha, e renova automaticamente até o cancelamento.</li>
          <li>Os pagamentos são processados pelo <strong>Stripe</strong>. Os dados do cartão ficam com ele; a Omnimob não os armazena.</li>
          <li>Trocar de plano vale <strong>na hora</strong> nos recursos. A cobrança se ajusta no ciclo seguinte.</li>
          <li>Preços podem ser reajustados com aviso prévio de 30 dias por e-mail. Você pode cancelar antes de o novo valor entrar em vigor.</li>
        </ul>
        <p>
          Pagamento em atraso pode levar à suspensão do acesso. Avisamos antes; a vitrine sair do ar
          sem aviso prejudicaria os clientes da imobiliária, que não têm parte na cobrança.
        </p>
      </Secao>

      <Secao titulo="5. Cancelamento">
        <p>
          Você pode cancelar quando quiser, pelo próprio painel, em Configurações. O acesso continua
          até o fim do período já pago — <strong>não há cobrança de multa e não há devolução
          proporcional</strong> do período em curso.
        </p>
        <p>
          Depois dessa data a vitrine sai do ar e o painel fica indisponível. Exporte o que precisar
          antes: a plataforma permite baixar imóveis, clientes e leads em planilha a qualquer
          momento enquanto a conta estiver ativa.
        </p>
      </Secao>

      <Secao titulo="6. Suas responsabilidades">
        <ul>
          <li>Manter as credenciais em segredo e não compartilhar login entre pessoas — a plataforma cobra por usuário nomeado justamente para haver rastro de quem fez o quê.</li>
          <li>Responder pelo <strong>conteúdo publicado</strong>: descrição, preço, metragem, fotos e disponibilidade dos imóveis. A Omnimob não verifica nem valida esses dados.</li>
          <li>Ter autorização do proprietário para anunciar e direito de uso sobre as fotos enviadas.</li>
          <li>Cumprir a LGPD em relação aos dados de clientes e interessados cadastrados por você. Nesse tratamento, <strong>você é o controlador</strong> e a Omnimob é a operadora — ver a <Link to="/privacidade">Política de Privacidade</Link>.</li>
          <li>Não usar a plataforma para conteúdo ilegal, discriminatório, enganoso ou que viole direitos de terceiros.</li>
          <li>Não tentar burlar limites de plano, acessar dados de outras imobiliárias ou automatizar acesso sem autorização.</li>
        </ul>
      </Secao>

      <Secao titulo="7. Nossas responsabilidades">
        <ul>
          <li>Manter o serviço disponível, ressalvadas manutenções e falhas de terceiros (hospedagem, provedores de pagamento e de e-mail).</li>
          <li>Guardar seus dados com as medidas de segurança descritas na Política de Privacidade.</li>
          <li>Avisar com antecedência sobre mudanças relevantes de preço, de recursos ou destes Termos.</li>
          <li>Não acessar o conteúdo da sua conta salvo para prestar suporte solicitado por você ou para cumprir ordem legal.</li>
        </ul>
        <p>
          Não há garantia de resultado comercial. A plataforma é ferramenta de trabalho: quantos
          imóveis você vende depende do seu mercado, da sua equipe e do seu atendimento.
        </p>
      </Secao>

      <Secao titulo="8. Recursos que dependem de terceiros">
        <p>
          Alguns recursos funcionam por meio de serviços externos e estão sujeitos às regras e à
          disponibilidade deles:
        </p>
        <ul>
          <li><strong>Publicação no Facebook e Instagram</strong> — exige que você conecte a própria conta e que ela atenda às exigências da Meta (conta Business vinculada a uma Página). Mudanças nas políticas da Meta podem afetar o recurso.</li>
          <li><strong>Geração de texto por inteligência artificial</strong> — produz sugestões a partir dos dados do imóvel. O texto é <strong>ponto de partida</strong>: revisar antes de publicar é responsabilidade de quem anuncia.</li>
          <li><strong>Envio aos portais imobiliários</strong> — disponibilizamos o arquivo no formato que os portais leem; o cadastro, a aprovação e a exibição do anúncio são decisão de cada portal.</li>
          <li><strong>Domínio próprio</strong> — depende da configuração de DNS feita por você no seu registrador.</li>
        </ul>
      </Secao>

      <Secao titulo="9. De quem são os dados e o conteúdo">
        <p>
          <strong>Seus.</strong> Imóveis, fotos, clientes, leads e textos cadastrados continuam
          sendo seus. Você nos concede apenas a licença necessária para hospedar, exibir e
          processar esse conteúdo enquanto prestamos o serviço — inclusive para publicá-lo nos
          canais que você escolher.
        </p>
        <p>
          O software, a marca, a interface e o código da Omnimob são nossos. Contratar o serviço não
          transfere propriedade sobre eles.
        </p>
      </Secao>

      <Secao titulo="10. Suspensão e encerramento por nossa parte">
        <p>
          Podemos suspender ou encerrar uma conta que descumpra estes Termos, especialmente em caso
          de conteúdo ilegal, fraude, tentativa de acesso a dados de outra imobiliária ou uso que
          comprometa a plataforma para os demais clientes. Sempre que possível avisamos antes e
          damos prazo para correção.
        </p>
      </Secao>

      <Secao titulo="11. Limitação de responsabilidade">
        <p>
          Na medida permitida pela lei, a responsabilidade da Omnimob por perdas relacionadas ao
          serviço fica limitada ao valor pago por você nos <strong>12 meses anteriores</strong> ao
          evento. Não respondemos por lucros cessantes, perda de oportunidade de negócio ou danos
          decorrentes de informação incorreta publicada por você.
        </p>
      </Secao>

      <Secao titulo="12. Mudanças nestes Termos">
        <p>
          Podemos alterar estes Termos. Mudanças relevantes são avisadas por e-mail com pelo menos
          30 dias de antecedência, e a data no topo é atualizada. Se você não concordar, pode
          cancelar antes da entrada em vigor.
        </p>
      </Secao>

      <Secao titulo="13. Lei aplicável e foro">
        <p>
          Estes Termos são regidos pela lei brasileira. Fica eleito o foro da comarca do domicílio
          do contratante para dirimir controvérsias, com a ressalva das regras de competência do
          Código de Defesa do Consumidor quando aplicáveis.
        </p>
        <p>
          Dúvidas: <Link to="/contato">fale com a gente</Link> ou escreva para{" "}
          <a href="mailto:contato@omnimob.app">contato@omnimob.app</a>.
        </p>
      </Secao>
    </PaginaPublica>
  );
}
