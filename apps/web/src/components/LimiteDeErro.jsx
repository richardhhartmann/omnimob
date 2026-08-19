import { Component } from "react";

/* ────────────────────────────────────────────────────────────────────────────
   Rede de segurança das rotas carregadas sob demanda.

   A divisão por rota trouxe um modo de falha que não existia quando tudo vinha
   num pacote só: o `import()` de um pedaço pode FALHAR. Três situações reais:

     · o servidor de desenvolvimento reiniciou entre o clique e o download;
     · saiu um deploy enquanto a pessoa estava com a aba aberta — os nomes dos
       arquivos têm hash, e o pedaço que a página conhece deixou de existir;
     · a rede caiu no meio.

   Sem uma barreira, a promessa rejeitada sobe pelo React e desmonta a árvore:
   tela branca, sem explicação e sem saída. Com ela, a pessoa lê o que houve e
   recarrega — que é o gesto que de fato resolve, porque recarregar busca o
   índice novo com os nomes de arquivo novos.

   ── POR QUE UMA CLASSE ──

   Porque não existe equivalente em hook. `componentDidCatch` e
   `getDerivedStateFromError` só existem em componente de classe; é a única
   parte do React que ainda não tem versão funcional.
   ──────────────────────────────────────────────────────────────────────────── */

/* Falha de download de pedaço tem cara própria e merece texto próprio: dizer
   "erro inesperado" para quem só precisa recarregar transforma um contratempo
   de dois segundos em um chamado no suporte. */
const ERRO_DE_PEDACO =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError/i;

export class LimiteDeErro extends Component {
  constructor(props) {
    super(props);
    this.state = { erro: null };
  }

  static getDerivedStateFromError(erro) {
    return { erro };
  }

  componentDidCatch(erro, info) {
    // Sem serviço de monitoramento ainda; o console é o que existe hoje.
    console.error("[LimiteDeErro]", erro, info?.componentStack);
  }

  render() {
    const { erro } = this.state;
    if (!erro) return this.props.children;

    const ehPedaco = ERRO_DE_PEDACO.test(erro?.message || "");

    return (
      <div className="lim-erro" role="alert">
        <div className="lim-erro__caixa">
          <h1>{ehPedaco ? "Esta página não terminou de carregar" : "Algo deu errado aqui"}</h1>
          <p>
            {ehPedaco
              ? "Normalmente é uma atualização do sistema que aconteceu com a sua aba aberta. Recarregar resolve."
              : "A tela não conseguiu abrir. Recarregar costuma resolver; se insistir, avise o suporte."}
          </p>
          <div className="lim-erro__acoes">
            <button type="button" onClick={() => window.location.reload()}>Recarregar</button>
            <a href="/">Voltar ao início</a>
          </div>
          {!ehPedaco && erro?.message ? <code className="lim-erro__detalhe">{erro.message}</code> : null}
        </div>

        <style>{CSS}</style>
      </div>
    );
  }
}

const CSS = `
.lim-erro {
  min-height: 100vh; display: grid; place-items: center; padding: 24px;
  background: #0a0a0b; color: #e8e8ee;
  font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;
}
.lim-erro__caixa {
  max-width: 460px; text-align: center;
  display: flex; flex-direction: column; gap: 14px; align-items: center;
}
.lim-erro__caixa h1 {
  margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.02em; text-wrap: balance;
}
.lim-erro__caixa p { margin: 0; font-size: 14.5px; line-height: 1.65; color: #b6b6c2; }
.lim-erro__acoes { display: flex; gap: 10px; align-items: center; margin-top: 6px; }
.lim-erro__acoes button {
  padding: 11px 22px; border-radius: 999px; border: 0; cursor: pointer;
  background: #e8e8ee; color: #0a0a0b; font-size: 14px; font-weight: 650;
}
.lim-erro__acoes a { font-size: 13.5px; color: #b6b6c2; text-decoration: none; padding: 11px 8px; }
.lim-erro__acoes a:hover { color: #e8e8ee; }
.lim-erro__detalhe {
  margin-top: 6px; font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11.5px; color: #7d7d8a; word-break: break-word;
}
`;
