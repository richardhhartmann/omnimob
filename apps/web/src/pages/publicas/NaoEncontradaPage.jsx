import { Link } from "react-router-dom";
import { PaginaPublica } from "../../components/PaginaPublica.jsx";
import { Ilustracao } from "../../components/Ilustracao.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   404 — o endereço que não existe.

   ── POR QUE ELA PASSOU A EXISTIR ──

   O catch-all do roteador mandava tudo para `/` com um `<Navigate replace>`.
   Isso não é um 404: é um desaparecimento. Quem clicou num link velho de
   e-mail, num resultado de busca que envelheceu ou num endereço com um
   caractere errado caía na home sem nenhuma explicação, e a leitura natural é
   "o site perdeu a minha página" — ou pior, "cliquei errado e nem percebi".

   O `replace` agravava: apagava o endereço torto do histórico, então o botão
   voltar também não levava de volta ao ponto de partida.

   ── O QUE ELA FAZ ──

   Diz o que houve, mostra o endereço tentado (é o que a pessoa vai colar ao
   pedir ajuda) e oferece as saídas que existem. Sem humor: quem chega aqui já
   está frustrado, e piada em tela de erro custa mais do que rende.

   ── SOBRE O DESENHO ──

   Este é um dos três lugares onde ilustração de pessoa cabe (ver o cabeçalho
   de `components/Ilustracao.jsx`): a alternativa aqui é espaço vazio. Enquanto
   não houver arquivo, o encaixe desenha as formas da marca, e a página fica
   inteira do mesmo jeito.
   ──────────────────────────────────────────────────────────────────────────── */

export function NaoEncontradaPage() {
  /* Lido na hora, e não por hook de rota: esta página é o fim da linha do
     roteador e não vai remontar com outro endereço. */
  const endereco = typeof window !== "undefined" ? window.location.pathname : "";

  return (
    <PaginaPublica
      titulo="Esta página não existe."
      subtitulo="O endereço pode ter mudado de lugar, ou o link que te trouxe até aqui pode estar incompleto."
      olho="Erro 404"
      descricao="A página que você procura não foi encontrada no site da Omnimob."
    >
      <Ilustracao src="/ilustracoes/erro-404.png" alt="Pessoa diante de uma porta solta, conferindo o número num papel" altura={220} />

      {endereco && endereco !== "/" ? (
        <p className="pp-404__endereco">
          Você tentou abrir <code>{endereco}</code>
        </p>
      ) : null}

      <p>
        Se você chegou por um link nosso — de um e-mail, de uma proposta ou do painel —, ele está
        quebrado e a gente quer saber. É o tipo de coisa que só descobrimos quando alguém avisa.
      </p>

      <div className="pp-404__saidas">
        <Link to="/" className="pp-404__saida pp-404__saida--forte">
          Voltar para o início
        </Link>
        <Link to="/contato" className="pp-404__saida">
          Avisar sobre o link quebrado
        </Link>
        <Link to="/vitrines" className="pp-404__saida">
          Ver vitrines reais
        </Link>
      </div>

      <style>{`
.pp-404__endereco {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 13px;
  color: var(--subtle);
}
.pp-404__endereco code {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 6px;
  padding: 2px 7px;
  color: var(--strong);
  /* Endereco longo nao pode empurrar a coluna: numa tela estreita um caminho
     de sessenta caracteres criava rolagem horizontal na pagina inteira. */
  overflow-wrap: anywhere;
}
.pp-404__saidas {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 30px;
}
.pp-404__saida {
  display: inline-flex;
  align-items: center;
  padding: 10px 18px;
  border-radius: 999px;
  border: 1px solid var(--line);
  font-size: 13.5px;
  color: var(--default);
  transition: border-color 0.2s ease, color 0.2s ease;
}
.pp-404__saida:hover { border-color: var(--accent-soft); color: var(--strong); }
.pp-404__saida--forte {
  background: var(--strong);
  border-color: var(--strong);
  color: var(--bg);
}
.pp-404__saida--forte:hover { color: var(--bg); opacity: 0.88; }
      `}</style>
    </PaginaPublica>
  );
}
