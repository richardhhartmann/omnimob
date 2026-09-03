import { Suspense, lazy, useState } from "react";
import { Link } from "react-router-dom";
import { COMPLETO, useCapacidade } from "../utils/capacidadeDaMaquina";
import { Alert, Eyebrow, LogoLockup, OmnimobStyles, Reveal } from "../styles/omnimobKit";

/* ────────────────────────────────────────────────────────────────────────────
   A casca das telas de acesso — login do cliente, login do super-admin e
   recuperação de senha.

   ── POR QUE UMA SÓ ──

   Eram duas cascas quase iguais (uma no `LoginPage`, outra escrita à mão no
   `AdminLoginPage`) e elas já tinham divergido: paddings, tamanho do título,
   posição do logo e o fundo. É o mesmo defeito que o editor de vitrine teve
   duas vezes, e na tela de ENTRADA custa mais caro: quem chega ao login pelo
   link de recuperação e vê outra página acha que caiu num golpe.

   O que varia entre as telas é o TOM (`cliente` | `admin`) — paleta e cor do
   fluido. Nunca a estrutura.

   ── A PLANTA ──

   Duas seções e nada mais:

     51%  o acesso. Fundo chapado, logo no canto superior esquerdo, e o
          formulário centralizado. Sem cartão, sem vidro, sem moldura — o
          formulário é tipografia sobre o fundo, e é dele que a tela trata.
     49%  o fluido. SÓ o fluido. Nenhum texto, nenhuma forma, nada por cima.

   O formulário não tem cartão de propósito. Uma caixa em volta dele desenha
   uma borda entre a pessoa e o campo em que ela vai digitar, e não acrescenta
   informação nenhuma — o que separa as duas metades já é a divisão da tela.

   ── O CUSTO DO FLUIDO, E COMO ELE É PAGO ──

   `LiquidEther` traz o `three` (734 kB) e roda um solver de fluidos por
   quadro. Duas travas, as duas necessárias:

     · entra por `lazy()`, então o pacote comum — que TODA sessão baixa —
       continua sem o three; quem paga é só quem abre uma tela de acesso;
     · só monta em máquina classificada como `completo`
       (`utils/capacidadeDaMaquina`), o que já embute "reduzir movimento",
       `saveData` e a ausência de WebGL. Nas outras, um degradê parado ocupa a
       mesma metade — a tela é a MESMA, o que muda é o efeito.

   A decisão é congelada na montagem: a medição de quadros pode rebaixar o
   nível 1,2s depois, e desmontar um canvas WebGL debaixo de quem já está
   digitando a senha seria pior que o efeito que se quis economizar.

   ── O QUE NÃO MUDA ──

   A saída animada (`authx-out` + `authx-card`), o reveal de entrada e as
   primitivas do kit.
   ──────────────────────────────────────────────────────────────────────────── */

const LiquidEther = lazy(() => import("./LiquidEther.jsx"));

/* As paletas moram FORA do componente porque `LiquidEther` tem o array de cores
   na lista de dependências do efeito que monta a simulação inteira: um literal
   novo a cada render reconstruiria o solver a cada tecla digitada. */
const FLUIDO_CLIENTE = ["#312e81", "#6366f1", "#a5b4fc"];
const FLUIDO_ADMIN = ["#4c1d95", "#a78bfa", "#f0abfc"];

const TONS = {
  cliente: FLUIDO_CLIENTE,
  admin: FLUIDO_ADMIN,
};

export function CascaDeAcesso({
  tom = "cliente",
  eyebrow,
  strong,
  soft,
  descricao,
  error,
  aviso,
  nota,
  rodape,
  onSubmit,
  saindo,
  children,
}) {
  const cores = TONS[tom] || TONS.cliente;
  const { nivel } = useCapacidade();
  // Congelado na montagem — ver o cabeçalho.
  const [comFluido] = useState(() => nivel === COMPLETO);

  return (
    <div className={`dl-root dl-page ax-root ax-root--${tom}${saindo ? " authx-out" : ""}`}>
      <OmnimobStyles extra={CSS} />

      {/* ── Seção 1: o acesso ─────────────────────────────────────────────── */}
      <section className="ax-acesso">
        <Link to="/" className="dl-logo ax-logo" aria-label="Omnimob — início">
          <LogoLockup height={34} />
        </Link>

        <Reveal as="form" className="ax-form authx-card" onSubmit={onSubmit}>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="ax-titulo">
            <span>{strong}</span>
            <span className="dl-h1__accent">{soft}</span>
          </h1>
          {/* Sem descrição o parágrafo saía vazio e mesmo assim cobrava as
              margens, abrindo um vão morto entre o título e os campos. */}
          {descricao ? <p className="ax-sub">{descricao}</p> : null}

          {/* O aviso vem antes do erro e em tom neutro: "sessão encerrada" é o
              desfecho de algo que a pessoa pediu, não uma falha. Se ela errar a
              senha em seguida, o erro entra logo abaixo e os dois convivem sem
              se confundir. */}
          {aviso ? <Alert tone="info">{aviso}</Alert> : null}
          {error ? <Alert tone="danger">{error}</Alert> : null}

          <div className="ax-campos">{children}</div>

          {nota ? <p className="dl-mono ax-nota">{nota}</p> : null}
          {rodape ? <div className="ax-foot">{rodape}</div> : null}
        </Reveal>
      </section>

      {/* ── Seção 2: o fluido ─────────────────────────────────────────────────
          `aria-hidden` e sem nada dentro: é superfície, não conteúdo. Quem lê a
          tela por leitor de voz não perde uma palavra por ela não existir. */}
      <section className="ax-fluido" aria-hidden="true">
        {comFluido ? (
          /* Fallback nulo de propósito: o degradê já está pintado no fundo da
             seção, então o fluido só aparece por cima quando termina de baixar
             — sem lampejo de caixa vazia no meio da tela. */
          <Suspense fallback={null}>
            <LiquidEther
              colors={cores}
              mouseForce={20}
              cursorSize={100}
              isViscous={false}
              viscous={30}
              iterationsViscous={32}
              iterationsPoisson={32}
              resolution={0.5}
              isBounce={false}
              autoDemo
              autoSpeed={0.5}
              autoIntensity={2.2}
              takeoverDuration={0.25}
              autoResumeDelay={3000}
              autoRampDuration={0.6}
            />
          </Suspense>
        ) : null}
      </section>
    </div>
  );
}

/* O "ou continuar com" do bloco de entrada por terceiro. Componente, e não
   marcação solta em cada página, porque a classe é da casca: quem usa não
   deveria precisar saber o nome dela para desenhar um traço no lugar certo. */
export function DivisorDeAcesso({ children = "ou continuar com" }) {
  return <div className="ax-divisor"><span>{children}</span></div>;
}

/* ── Estilos ─────────────────────────────────────────────────────────────────
   A planta das duas seções + a sobrescrita de tokens por tom. Botões, inputs,
   eyebrow e reveal vêm do kit e se adaptam à paleta.
   ────────────────────────────────────────────────────────────────────────── */

const CSS = `
/* Sem overflow hidden aqui, e isso e deliberado: o formulario pode ficar mais
   alto que a janela (aviso + erro + botao do Google numa tela de notebook
   baixa), e um recorte vertical deixaria o botao de entrar inalcancavel, sem
   barra de rolagem. O que a saida animada joga para fora SOBE, e o que sobe
   alem do topo nao pede rolagem em navegador nenhum. */
.ax-root {
  --line-soft: rgba(255,255,255,0.07);
  position: relative;
  display: grid;
  grid-template-columns: 51% 49%;
  /* dvh, com vh de reserva para quem nao conhece a unidade: no celular, 100vh
     conta a barra de endereco que ainda esta na tela, e a tela de acesso
     nascia um naco mais alta que a janela so por causa disso. */
  min-height: 100vh;
  min-height: 100dvh;
}

/* Tom do cliente: a paleta que a tela de login já tinha. */
.ax-root--cliente {
  --bg: #0b0d14;
  --surface: rgba(255,255,255,0.03);
  --surface-2: rgba(255,255,255,0.06);
  --line: rgba(255,255,255,0.09);
  --strong: #f8fafc;
  --default: #e2e8f0;
  --subtle: #94a3b8;
  --placeholder: #64748b;
  --accent: #818cf8;
  --accent-soft: #a5b4fc;
  background: var(--bg);
}
.ax-root--cliente .dl-btn--accent { background: #818cf8; color: #fff; }
.ax-root--cliente .dl-btn--accent .dl-btn__arrow { background: rgba(255,255,255,0.20); }
.ax-root--cliente .dl-btn--accent:hover { background: #6366f1; box-shadow: 0 14px 34px -14px rgba(99,102,241,0.7); }
.ax-root--cliente .dl-input:focus { border-color: #818cf8; box-shadow: 0 0 0 3px rgba(129,140,248,0.18); }
/* O degrade parado que ocupa a metade do fluido em maquina fraca. Ele fica no
   FUNDO da secao mesmo quando o fluido monta: e o que o canvas transparente
   tem por baixo. */
.ax-root--cliente .ax-fluido {
  background:
    radial-gradient(760px 620px at 62% 34%, rgba(99,102,241,0.34), transparent 72%),
    radial-gradient(520px 480px at 22% 82%, rgba(165,180,252,0.16), transparent 72%),
    #06070d;
}

/* Tom do super-admin: mais violeta. A diferença é de propósito — é a única
   pista, antes de digitar, de que esta não é a porta do cliente. */
.ax-root--admin {
  --accent: #a78bfa;
  --accent-soft: #c4b5fd;
  background: var(--bg);
}
.ax-root--admin .dl-input:focus { border-color: #a78bfa; box-shadow: 0 0 0 3px rgba(167,139,250,0.18); }
.ax-root--admin .ax-fluido {
  background:
    radial-gradient(760px 620px at 62% 34%, rgba(139,92,246,0.34), transparent 72%),
    radial-gradient(520px 480px at 22% 82%, rgba(240,171,252,0.14), transparent 72%),
    #06050c;
}

/* ── Seção 1: o acesso ── */
.ax-acesso {
  position: relative; min-width: 0;
  display: flex; align-items: center; justify-content: center;
  padding: 104px 48px 56px;
  min-height: 100vh; min-height: 100dvh;
  background: var(--bg);
}
/* Um brilho de canto só para o preto não ficar morto. Discreto de propósito: o
   efeito de verdade é do outro lado. */
.ax-acesso::before {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(560px 420px at 12% 6%, rgba(255,255,255,0.05), transparent 72%);
}
.ax-logo { position: absolute; top: 36px; left: 48px; z-index: 2; }

/* O formulário: sem fundo, sem borda, sem sombra. */
.ax-form {
  position: relative; z-index: 1;
  width: 100%; max-width: 384px;
  display: flex; flex-direction: column;
}
.ax-titulo {
  display: flex; flex-direction: column; margin: 14px 0 0;
  font-size: clamp(28px, 2.9vw, 36px); line-height: 1.05;
  letter-spacing: -0.04em; font-weight: 800; color: var(--strong);
}
.ax-sub { font-size: 13.5px; line-height: 1.7; color: var(--subtle); margin-top: 12px; }
.ax-sub strong { color: var(--strong); font-weight: 700; }
.ax-root .dl-alert { margin-top: 18px; }
.ax-campos { display: grid; gap: 15px; margin: 26px 0 0; }
.ax-acoes { display: grid; gap: 10px; }

.ax-divisor {
  display: flex; align-items: center; gap: 12px; margin: 4px 0 0;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 9px; letter-spacing: 0.13em; text-transform: uppercase;
  color: var(--placeholder); white-space: nowrap;
}
.ax-divisor::before, .ax-divisor::after {
  content: ""; flex: 1; height: 1px; background: var(--line-soft);
}

.ax-nota {
  color: var(--placeholder); margin-top: 22px;
  text-transform: none; letter-spacing: 0.04em; font-size: 9.5px; line-height: 1.7;
}
.ax-foot {
  margin-top: 20px; padding-top: 18px; border-top: 1px solid var(--line-soft);
}
.ax-legal { display: block; margin-top: 8px; font-size: 11.5px; opacity: 0.72; }
.ax-alt { font-size: 12.5px; color: var(--subtle); transition: color 0.18s ease; }
.ax-alt:hover { color: var(--strong); }
/* O "voltar" do segundo fator e um BOTAO, nao um link: ele desfaz um passo
   desta tela, e nao navega para lugar nenhum. A aparencia e a mesma para quem
   olha; o que muda e o teclado, o leitor de tela e o menu do botao direito. */
.ax-root button.ax-alt {
  background: none; border: 0; padding: 0; cursor: pointer;
  font-family: inherit; text-align: left;
}

/* O campo do codigo: monoespacado e espacado porque seis digitos em fonte de
   texto sao dificeis de conferir contra a tela do celular. */
.ax-root .ax-codigo {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 17px; letter-spacing: 0.24em; text-align: center;
  padding-top: 14px; padding-bottom: 14px;
}
.ax-root .ax-codigo::placeholder { letter-spacing: 0.24em; }

/* ── Seção 2: o fluido ── */
.ax-fluido { position: relative; min-height: 100vh; min-height: 100dvh; overflow: hidden; }

/* ── Abaixo de 900px ──
   A metade do fluido some e o acesso ocupa a tela. Nada muda de lugar: e a
   mesma arvore, sem uma segunda montagem para o celular. Some inteira, e nao
   vira fundo do formulario, por dois motivos: o solver e caro justamente na
   maquina que abre o painel pelo telefone, e um fluido animado atras de um
   formulario sem cartao deixaria o texto ilegivel. */
@media (max-width: 900px) {
  .ax-root { grid-template-columns: 1fr; }
  .ax-fluido { display: none; }
  .ax-acesso { padding: 92px 24px 48px; }
  .ax-logo { top: 30px; left: 24px; }
}

@media (max-width: 420px) {
  .ax-acesso { padding: 88px 20px 40px; }
  .ax-logo { left: 20px; }
}
`;
