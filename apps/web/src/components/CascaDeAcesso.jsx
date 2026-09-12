import { Suspense, lazy, useState } from "react";
import { Link } from "react-router-dom";
import { COMPLETO, useCapacidade } from "../utils/capacidadeDaMaquina";
import { useMarcaDoAcesso } from "../utils/marcaDoAcesso";
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

   `Grainient` é um shader de tela cheia sobre `ogl` — que já estava no projeto.
   Ele substituiu o `LiquidEther`, que trazia o `three` (734 kB) e resolvia um
   campo de fluidos a 32 iterações de Poisson por quadro; a troca é de ordem de
   grandeza, não de gosto. Duas travas continuam de pé:

     · entra por `lazy()`, então o pacote comum — que TODA sessão baixa —
       continua sem ele; quem paga é só quem abre uma tela de acesso;
     · só monta em máquina classificada como `completo`
       (`utils/capacidadeDaMaquina`), o que já embute "reduzir movimento",
       `saveData` e a ausência de WebGL. Nas outras, um degradê parado ocupa a
       mesma metade — a tela é a MESMA, o que muda é o efeito.

   A decisão é congelada na montagem: a medição de quadros pode rebaixar o
   nível 1,2s depois, e desmontar um canvas WebGL debaixo de quem já está
   digitando a senha seria pior que o efeito que se quis economizar.

   ── A MARCA DE QUEM ESTÁ ENTRANDO ──

   Quando dá para saber a imobiliária antes do login, o logo do canto é o DELA,
   com um crédito discreto à Omnimob embaixo. A resolução mora aqui, e não em
   cada página, para que login, recuperação de senha e primeiro acesso nunca
   apareçam vestidos de forma diferente — nessas telas, diferença de aparência
   entre uma e outra é o que faz a pessoa suspeitar de golpe.

   Só no tom `cliente`. O super-admin é a Omnimob olhando os clientes dela; ali
   a marca de uma imobiliária não teria significado nenhum.

   ── O QUE NÃO MUDA ──

   A saída animada (`authx-out` + `authx-card`), o reveal de entrada e as
   primitivas do kit.
   ──────────────────────────────────────────────────────────────────────────── */

const Grainient = lazy(() => import("./Grainient.jsx"));

/* As três paradas do degradê. O `Grainient` recebe cada uma como prop separada
   (`color1/2/3`), então não há array de dependência a estabilizar como havia no
   `LiquidEther` — mas elas ficam aqui de qualquer forma: é a paleta do produto,
   e paleta é decisão de identidade, não detalhe de render.

   O tom do super-admin puxa para o violeta pelo mesmo motivo de sempre: é a
   única pista, antes de digitar, de que esta não é a porta do cliente. */
/* A máscara por cima do fluido, uma por tom. São vetores gerados de
   `design/mascara_login*.png` por `npm run mascara` — editar o PNG e rodar o
   script é o caminho; o SVG não se edita à mão. */
const MASCARAS = {
  cliente: "/mascara_login.svg",
  admin: "/mascara_login_admin.svg",
};

const TONS = {
  cliente: { c1: "#ebab97", c2: "#6d48ff", c3: "#B497CF" },
  admin: { c1: "#ffb69f", c2: "#4c1d95", c3: "#a78bfa" },
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
  const marca = useMarcaDoAcesso(tom === "cliente");
  const { nivel } = useCapacidade();
  // Congelado na montagem — ver o cabeçalho.
  const [comFluido] = useState(() => nivel === COMPLETO);

  return (
    <div className={`dl-root dl-page ax-root ax-root--${tom}${saindo ? " authx-out" : ""}`}>
      <OmnimobStyles extra={CSS} />

      {/* ── Seção 1: o acesso ─────────────────────────────────────────────── */}
      <section className="ax-acesso">
        {marca ? (
          /* Sem `Link` aqui: na tela vestida com a marca da imobiliária, um
             logotipo clicável levaria à landing da Omnimob — que é a última
             página que o corretor dela quer abrir no meio do login. */
          <div className="ax-logo ax-logo--cliente">
            {marca.logoUrl
              ? <img src={marca.logoUrl} alt={marca.nome} className="ax-logo__img" />
              : <span className="ax-logo__nome">{marca.nome}</span>}
            <span className="dl-mono ax-logo__credito">acesso por Omnimob</span>
          </div>
        ) : (
          <Link to="/" className="dl-logo ax-logo" aria-label="Omnimob — início">
            <LogoLockup height={34} />
          </Link>
        )}

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
            <Grainient
              color1={cores.c1}
              color2={cores.c2}
              color3={cores.c3}
              timeSpeed={0.25}
              colorBalance={0.0}
              warpStrength={1.0}
              warpFrequency={5.0}
              warpSpeed={2.0}
              warpAmplitude={50.0}
              blendAngle={0.0}
              blendSoftness={0.05}
              rotationAmount={500.0}
              noiseScale={2.0}
              grainAmount={0.1}
              grainScale={2.0}
              grainAnimated={false}
              contrast={1.5}
              gamma={1.0}
              saturation={1.0}
              centerX={0.0}
              centerY={0.0}
              zoom={0.9}
            />
          </Suspense>
        ) : null}
        {/* A máscara por cima do fluido. É o fundo da tela (#0b0d14) em quatro
            níveis de transparência, recortado em formas orgânicas: onde é opaca,
            o fluido some e a arte se funde à coluna do acesso; onde é
            transparente, ele aparece inteiro. Os degraus intermediários são o
            que dá a leitura de camadas — e é por isso que ela fica POR CIMA, e
            não no lugar dele. Vale também para quem não monta o shader: ali
            ela cobre o degradê parado, com o mesmo desenho. */}
        <img src={MASCARAS[tom] || MASCARAS.cliente} alt="" className="ax-mascara" draggable="false" />
      </section>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   O marcador de "último utilizado".

   Envolve o botão do caminho que funcionou nesta máquina da última vez — a
   senha ou o Google — com um contorno que gira e uma etiqueta em cima. Ver
   `utils/ultimoAcesso` para por que a memória é da MÁQUINA e não da pessoa.

   Ele é uma DICA, e o desenho diz isso: não preenche campo, não move foco, não
   reordena os botões. Os dois caminhos continuam à mesma distância de um
   clique — num computador compartilhado o último a entrar não é
   necessariamente quem está chegando.

   Sem `marcado`, ele devolve o filho sem invólucro nenhum: um elemento a mais
   no caminho mudaria a caixa do botão em toda a tela para nada.
   ──────────────────────────────────────────────────────────────────────────── */
export function UltimoUtilizado({ marcado, children }) {
  if (!marcado) return children;
  return (
    <div className="ax-ultimo">
      <span className="dl-mono ax-ultimo__selo">último utilizado</span>
      <span className="ax-ultimo__flare">{children}</span>
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
  /* So o acesso e coluna. O fluido e absoluto e comeca DEBAIXO dela — ver
     .ax-fluido — por isso a segunda coluna fica vazia. */
  grid-template-columns: 40% 1fr;
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
/* O degrade PARADO, para a maquina que nao monta o shader. As paradas sao as
   mesmas tres cores do Grainient, so que fixas: quem cai aqui ve a mesma
   familia de cor que os outros veem se mexendo, e nao outra tela.
   Ele fica no fundo da secao mesmo quando o shader monta — e o que o canvas
   tem por baixo enquanto o pedaco baixa. */
.ax-root--cliente .ax-fluido {
  background:
    radial-gradient(820px 660px at 70% 24%, rgba(255,182,159,0.34), transparent 70%),
    radial-gradient(780px 640px at 22% 80%, rgba(109,72,255,0.42), transparent 72%),
    radial-gradient(600px 520px at 50% 50%, rgba(180,151,207,0.18), transparent 74%),
    #140f24;
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
    radial-gradient(820px 660px at 70% 24%, rgba(255,182,159,0.26), transparent 70%),
    radial-gradient(780px 640px at 22% 80%, rgba(76,29,149,0.55), transparent 72%),
    radial-gradient(600px 520px at 50% 50%, rgba(167,139,250,0.20), transparent 74%),
    #100a1e;
}

/* ── Seção 1: o acesso ── */
.ax-acesso {
  position: relative; min-width: 0; z-index: 1;
  display: flex; align-items: center; justify-content: center;
  padding: 104px 48px 56px;
  min-height: 100vh; min-height: 100dvh;
  /* Sem fundo proprio: o fundo e o da raiz, e e sobre ele que a faixa escura
     da mascara se funde. Um fundo aqui cortaria o fluido numa reta de novo. */
}
/* Um brilho de canto só para o preto não ficar morto. Discreto de propósito: o
   efeito de verdade é do outro lado. */
.ax-acesso::before {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(560px 420px at 12% 6%, rgba(255,255,255,0.05), transparent 72%);
}
.ax-logo { position: absolute; top: 36px; left: 48px; z-index: 2; }
/* A arte do cliente vem de onde ele subiu: pode ser larga, alta, clara ou
   escura. A caixa manda na ALTURA e deixa a largura livre, senao logotipo
   horizontal achata e logotipo quadrado estoura a coluna. */
.ax-logo--cliente { display: grid; gap: 6px; max-width: 260px; }
.ax-logo__img { max-height: 44px; max-width: 100%; width: auto; object-fit: contain; display: block; }
.ax-logo__nome { font-size: 17px; font-weight: 800; letter-spacing: -0.03em; color: var(--strong); }
/* O credito e discreto de proposito: a casa e da imobiliaria, mas quem responde
   pela seguranca desta tela e a Omnimob, e esconder isso seria pior. */
.ax-logo__credito { font-size: 8.5px; letter-spacing: 0.16em; color: var(--placeholder); }

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

/* ── O CONTORNO QUE GIRA ─────────────────────────────────────────────────────

   Um degrade conico girando atras do botao, com uma tampa por cima deixando so
   a moldura de 2px a mostra. E o jeito mais barato de fazer isto: uma
   propriedade animada (transform), numa camada propria, sem JavaScript e sem
   laco de quadro.

   Sem @property de proposito — animar o angulo de um gradiente exigiria
   registrar a variavel, e nem todo navegador que este produto atende faz isso.
   Girar o elemento inteiro resolve igual e funciona em qualquer lugar.

   O ::before precisa TRANSBORDAR a caixa (inset negativo): um conico do tamanho
   exato, ao girar, deixaria os cantos sem cor por um instante a cada volta.
   (Sem crases nestes comentarios: template literal.) */
.ax-ultimo { display: grid; gap: 7px; justify-items: start; }
.ax-ultimo__selo {
  font-size: 8.5px; letter-spacing: 0.16em; color: var(--accent-soft);
  padding-left: 2px;
}
.ax-ultimo__flare {
  position: relative; display: block; width: 100%;
  padding: 2px; border-radius: 999px; overflow: hidden;
  isolation: isolate;
}
.ax-ultimo__flare::before {
  content: ""; position: absolute; inset: -75%;
  background: conic-gradient(
    from 0turn,
    transparent 0 58%,
    #ffb69f 74%,
    var(--accent-soft) 86%,
    transparent 100%
  );
  animation: axFlareGira 3.6s linear infinite;
}
/* A tampa: o fundo da coluna de acesso, deixando so a borda do gradiente. */
.ax-ultimo__flare::after {
  content: ""; position: absolute; inset: 2px;
  border-radius: inherit; background: var(--bg);
}
.ax-ultimo__flare > * { position: relative; z-index: 1; }
@keyframes axFlareGira { to { transform: rotate(1turn); } }
/* Sem movimento, o contorno fica PARADO e visivel — some-lo levaria junto a
   informacao, que e o que o marcador existe para dar. */
@media (prefers-reduced-motion: reduce) {
  .ax-ultimo__flare::before { animation: none; }
}

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
  margin-top: 20px;
  padding-top: 18px;
  border-top: 1px solid var(--line-soft);

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;

  text-align: center;
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

/* ── Seção 2: o fluido ──
   Absoluto, comecando a 30% — DENTRO da coluna do acesso, atras dela. A borda
   esquerda dele fica assim debaixo da faixa opaca da mascara, e nao na mesma
   linha que a borda da mascara: coincidindo, qualquer arredondamento de
   subpixel deixava uma fresta de um pixel do fundo roxo, uma linha vertical
   visivel na emenda. Mede 100vw de largura, como a coluna antiga media, para o
   shader continuar com o mesmo enquadramento; o que passa da janela e cortado
   pelo overflow da raiz (.dl-root). */
.ax-fluido {
  position: absolute; top: 0; bottom: 0; left: 30%; width: 100vw;
  overflow: hidden; z-index: 0;
}
/* A mascara e dimensionada pelo VISIVEL (70vw), senao o canto claro dela — o
   que mais importa — cairia fora da janela. Esticada, e nao cortada: as
   formas sao organicas e aguentam, e cortar tiraria o canto ou a faixa escura
   que a funde a coluna do acesso. Um pixel a mais de cada lado por causa do
   mesmo arredondamento. */
.ax-mascara {
  position: absolute; top: -1px; left: -1px;
  width: calc(70vw + 2px); height: calc(100% + 2px);
  object-fit: fill; pointer-events: none; user-select: none;
  z-index: 1;
}

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
