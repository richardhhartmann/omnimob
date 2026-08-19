import { Link } from "react-router-dom";
import { PaginaPublica, Secao } from "../../components/PaginaPublica.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   Sobre.

   A página que decide se a pessoa confia. E é a mais fácil de errar: quase toda
   página "Sobre" de SaaS é feita de adjetivos — inovadora, completa, robusta —
   que qualquer concorrente poderia assinar sem trocar uma palavra.

   O que não dá para copiar é POSIÇÃO: o que o produto escolheu não fazer, e
   por quê. É disso que esta página é feita. As decisões abaixo são reais e
   estão no código: não intermediar negócio, não tocar no dinheiro do aluguel,
   uma imobiliária nunca enxergar dado de outra, e o cliente poder sair levando
   os dados.
   ──────────────────────────────────────────────────────────────────────────── */

/* Uma escolha por bloco: o que foi decidido e o que se abriu mão em troca.
   O segundo campo é o que dá credibilidade ao primeiro — promessa sem custo
   declarado é propaganda. */
const ESCOLHAS = [
  {
    titulo: "Software, não corretagem",
    texto:
      "A Omnimob não intermedeia negócio, não avalia imóvel e não fica com percentual de venda. " +
      "Quem fecha é a imobiliária, e o que ela ganha é dela inteiro.",
    custo: "Abrimos mão da receita por transação, que é o modelo mais lucrativo do setor.",
  },
  {
    titulo: "Separação total entre imobiliárias",
    texto:
      "Cada consulta ao banco filtra pela empresa dona do dado, e há testes automatizados que " +
      "tentam ler o registro de outra imobiliária e exigem que a resposta seja “não existe”.",
    custo: "Nenhum recurso de rede entre clientes — nada de acervo compartilhado ou permuta entre imobiliárias.",
  },
  {
    titulo: "Seus dados saem com você",
    texto:
      "Imóveis, clientes e leads podem ser exportados em planilha a qualquer momento, sem pedir " +
      "autorização e sem falar com o suporte.",
    custo: "Facilitamos a saída de quem quiser ir embora — inclusive para um concorrente.",
  },
  {
    titulo: "Não tocamos no dinheiro do aluguel",
    texto:
      "A plataforma cobre venda e vitrine. Não fazemos repasse ao proprietário, não emitimos " +
      "boleto de aluguel e não guardamos valor de terceiro em conta nossa.",
    custo: "Ficamos de fora do módulo de locação, que é onde está boa parte do mercado.",
  },
];

export function SobrePage() {
  return (
    <PaginaPublica
      olho="Quem somos"
      titulo="Uma plataforma que faz menos, e faz inteiro"
      subtitulo="A Omnimob é um sistema de gestão imobiliária brasileiro, feito para imobiliárias que querem vender mais sem virar reféns do software."
      descricao="Quem é a Omnimob, o que a plataforma escolheu fazer e o que decidiu deixar de fora — e por quê."
    >
      <Secao titulo="Por que ela existe">
        <p>
          Imobiliária pequena e média no Brasil vive um dilema conhecido: ou usa um sistema
          completo, caro e pesado, feito para operação com centenas de contratos — e paga por
          módulos que nunca vai abrir —, ou improvisa com planilha, WhatsApp e um site parado que
          ninguém atualiza há dois anos.
        </p>
        <p>
          A Omnimob nasceu no meio disso, com uma pergunta estreita: <strong>o que uma imobiliária
          precisa para vender um imóvel hoje?</strong> Um lugar para cadastrar o imóvel uma vez. Uma
          página pública que ela mesma monta, sem chamar programador. Os anúncios saindo daí para as
          redes sociais e para os portais. E os contatos que chegam caindo numa lista com dono e
          histórico, em vez de morrerem numa caixa de entrada.
        </p>
        <p>
          Tudo que não responde a essa pergunta ficou de fora — e ficou de fora de propósito.
        </p>
      </Secao>

      <Secao titulo="O que decidimos, e o que custou">
        <p>
          Toda escolha de produto tem um preço. As quatro abaixo são as que mais moldam o que a
          Omnimob é, com o que cada uma nos custou:
        </p>
        {ESCOLHAS.map((e) => (
          <div key={e.titulo}>
            <h3>{e.titulo}</h3>
            <p>{e.texto}</p>
            <p style={{ opacity: 0.78, fontSize: "14px" }}>
              <strong>O que isso custa:</strong> {e.custo}
            </p>
          </div>
        ))}
      </Secao>

      <Secao titulo="Como trabalhamos">
        <p>
          A plataforma é desenvolvida no Brasil, em português, para o mercado brasileiro — não é
          tradução de sistema estrangeiro. Isso aparece em detalhes que só quem trabalha aqui
          repara: o campo de CRECI existe e vai para o anúncio, o CEP preenche o endereço sozinho,
          o WhatsApp é o canal principal de contato, e os portais atendidos são os que a
          imobiliária de fato usa.
        </p>
        <p>
          Também aparece no que é levado a sério nos bastidores: separação de dados entre clientes
          coberta por testes, registro de quem criou, alterou e excluiu cada coisa, e senha guardada
          de forma irreversível. Nada disso vende sozinho — mas é o que faz a diferença no dia em
          que alguém precisa de resposta.
        </p>
      </Secao>

      <Secao titulo="Para quem é">
        <ul>
          <li><strong>Corretor autônomo</strong> que precisa de presença digital própria sem depender do site da imobiliária em que atua.</li>
          <li><strong>Imobiliária pequena e média</strong> que quer sair da planilha sem entrar num sistema de gestão pesado.</li>
          <li><strong>Equipe em crescimento</strong> que já sente falta de saber de quem é cada lead e o que já foi feito com ele.</li>
        </ul>
        <p>
          Se a sua operação é principalmente <strong>administração de locação</strong> — repasse ao
          proprietário, régua de cobrança, DIMOB —, a Omnimob ainda não é a ferramenta certa, e
          preferimos dizer isso agora a descobrir junto depois da contratação.
        </p>
      </Secao>

      <Secao titulo="Falar com a gente">
        <p>
          Dá para <Link to="/">testar de graça</Link> sem cartão de crédito e sem conversar com
          ninguém — o ambiente fica pronto em segundos e é seu para mexer à vontade. Se preferir
          conversar antes, a <Link to="/contato">página de contato</Link> tem os caminhos. E se
          quiser ver o resultado antes de decidir, as <Link to="/vitrines">vitrines publicadas</Link>{" "}
          estão no ar.
        </p>
      </Secao>
    </PaginaPublica>
  );
}
