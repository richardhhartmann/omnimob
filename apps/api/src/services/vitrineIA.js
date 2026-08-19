/* ────────────────────────────────────────────────────────────────────────────
   Assistente de vitrine: instrução em português → plano de operações.

   ── POR QUE OPERAÇÕES, E NÃO UM `showcaseConfig` NOVO ──

   Pedir o documento inteiro de volta é o caminho óbvio e o errado, por três
   motivos concretos:

     1. O modelo perde coisas. Um config com quinze peças reescrito do zero volta
        com quatorze, e o que sumiu foi justamente o que a pessoa não pediu para
        mexer. Operação só toca no que nomeia.

     2. Não dá para mostrar acontecendo. "Arrumou tudo" é um pulo; uma lista de
        passos é um robô trabalhando à vista, que é o que foi pedido.

     3. A física deixaria de valer. As posições que o modelo inventa passam pela
        MESMA engine que governa o arrasto do mouse (colisão, cascata,
        afastamento). A IA propõe; `layoutEngine` dispõe. Com um documento
        pronto, teríamos de confiar que o modelo respeitou regras que ele não
        tem como verificar.

   ── SOBRE "USAR O CÓDIGO COMO CONTEXTO" ──

   Mandar `ShowcaseEditorPage.jsx` para o modelo seria caro e pior: código diz
   COMO a tela funciona, e o que ele precisa saber é o VOCABULÁRIO — que peças
   existem, o que cada uma serve, em que unidade ficam as coordenadas e o que a
   engine não deixa fazer. Esse contrato está aqui embaixo, e o catálogo de
   widgets vem do cliente a cada chamada, lido de `builder/data/biblioteca.jsx`
   — a mesma lista que desenha a gaveta de peças. Uma cópia dela aqui divergiria
   no dia em que um widget novo nascesse.
   ──────────────────────────────────────────────────────────────────────────── */

/* Operações que o cliente sabe aplicar. Mexer aqui exige mexer no aplicador do
   front (`builder/ia/aplicarOperacoes.js`) — são as duas pontas do contrato. */
export const ACOES = ["mover", "redimensionar", "adicionar", "remover", "estilo", "conteudo", "tema", "ocultar", "mostrar"];

/* Esquema da resposta. Um objeto plano com campos opcionais, e não uma união
   discriminada: o `responseSchema` do Gemini não modela união, e um esquema que
   ele não entende volta como texto livre — que é pior do que campos sobrando. */
const ESQUEMA = {
  type: "OBJECT",
  properties: {
    resumo: { type: "STRING" },
    operacoes: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          acao: { type: "STRING", enum: ACOES },
          alvo: { type: "STRING" },
          motivo: { type: "STRING" },
          tipo: { type: "STRING" },
          x: { type: "NUMBER" },
          y: { type: "NUMBER" },
          w: { type: "NUMBER" },
          h: { type: "NUMBER" },
          title: { type: "STRING" },
          content: { type: "STRING" },
          ctaLabel: { type: "STRING" },
          ctaUrl: { type: "STRING" },
          backgroundColor: { type: "STRING" },
          color: { type: "STRING" },
          appearanceMode: { type: "STRING", enum: ["dark", "light"] },
          globalFont: { type: "STRING" },
          primaryColor: { type: "STRING" },
          secondaryColor: { type: "STRING" },
        },
        required: ["acao", "motivo"],
      },
    },
  },
  required: ["resumo", "operacoes"],
};

/* O contrato. É o que o modelo precisa saber para propor algo aplicável —
   escrito uma vez, e é a única coisa deste arquivo que descreve a vitrine. */
function contrato(catalogo, jaUsados, fontes) {
  const disponiveis = catalogo.filter((c) => !jaUsados.includes(c.tipo));

  return `Você organiza vitrines digitais de imobiliárias na plataforma Omnimob.
Recebe o estado atual de uma vitrine e um pedido do dono dela, e responde com uma
LISTA DE OPERAÇÕES que a plataforma vai executar uma a uma, à vista da pessoa.

## Como a vitrine é feita

A página é uma tela vertical com PEÇAS posicionadas livremente.

- Existem 5 BLOCOS FIXOS, que não podem ser criados nem removidos, só movidos,
  redimensionados, ocultados e recoloridos:
  · b:header      — cabeçalho com logo e nome
  · b:title       — chamada principal (título grande e subtítulo)
  · b:highlights  — três destaques curtos
  · b:properties  — a grade de imóveis (o coração da página)
  · b:footer      — rodapé
- E WIDGETS, identificados por "w:<id>", que podem ser criados e removidos.

## Coordenadas

- x e w são PORCENTAGEM da largura da página: x=0 é a borda esquerda, w=100 é
  largura total. Peça de meia largura tem w=50.
- y e h são PIXELS na vertical. y=0 é o topo. A página costuma ter 3000–5000px.
- x + w nunca passa de 100.
- Duas peças NUNCA devem se sobrepor. Deixe pelo menos 40px entre uma e outra na
  vertical quando estiverem na mesma faixa horizontal.
- Peças lado a lado: uma com x=0 w=48 e a outra com x=52 w=48, no mesmo y.

## Widgets que ainda podem ser criados
${disponiveis.length
    ? disponiveis.map((c) => `- ${c.tipo}: ${c.nome}. ${c.paraQue} (tamanho sugerido: w=${c.w}, h=${c.h})`).join("\n")
    : "- (nenhum: todos os tipos já estão em uso nesta vitrine)"}

${jaUsados.length ? `Tipos JÁ presentes (não crie de novo, cada tipo só existe uma vez): ${jaUsados.join(", ")}` : ""}

## Operações

Cada item da lista tem "acao", "motivo" (uma frase curta em português, que a
pessoa vai LER enquanto acontece) e os campos daquela ação:

- mover          alvo, x, y
- redimensionar  alvo, w, h
- adicionar      tipo, x, y, w, h — e opcionalmente title, content, ctaLabel, ctaUrl, backgroundColor, color
- remover        alvo
- estilo         alvo, backgroundColor e/ou color (cor de fundo e cor do texto da peça)
- conteudo       alvo, title e/ou content e/ou ctaLabel
- tema           appearanceMode ("dark" ou "light"), globalFont, primaryColor, secondaryColor
- ocultar        alvo
- mostrar        alvo

Em "globalFont" só valem estes nomes, exatamente como escritos:
${fontes.join(", ")}

## Regras que não se quebram

1. NUNCA remova nem oculte b:properties. É o motivo da página existir.
2. Cores em hexadecimal ("#0b1220"). Garanta contraste: fundo escuro pede texto
   claro e vice-versa.
3. Ordem vertical faz sentido: cabeçalho no topo, rodapé por último.
4. Prefira POUCAS operações certeiras a muitas. Uma reorganização boa tem de 4 a
   12 operações; acima disso a pessoa perde o fio do que mudou.
5. Escreva "motivo" para quem não é técnico: "aproximei os destaques do título",
   e não "setY(320) em b:highlights".
6. O "resumo" é uma frase dizendo o que você fez e por quê, em português.
7. Se o pedido for impossível ou vago demais, devolva operacoes vazia e explique
   no resumo o que falta saber.`;
}

/** Descreve a vitrine atual em texto. Curto de propósito: JSON cru gasta muito
 *  token e o modelo lê pior do que uma tabela em linhas. */
function descreverVitrine(vitrine) {
  const linhas = [];
  linhas.push(`Aparência: ${vitrine.appearanceMode || "dark"} · fonte: ${vitrine.globalFont || "padrão"}`);
  linhas.push(`Cor principal: ${vitrine.primaryColor || "-"} · secundária: ${vitrine.secondaryColor || "-"}`);
  if (vitrine.nome) linhas.push(`Imobiliária: ${vitrine.nome}`);
  if (vitrine.imoveis != null) linhas.push(`Imóveis publicados: ${vitrine.imoveis}`);
  linhas.push("");
  linhas.push("Peças na página (de cima para baixo):");
  for (const p of vitrine.pecas || []) {
    const partes = [
      `${p.id} (${p.nome})`,
      `x=${Math.round(p.x)} y=${Math.round(p.y)} w=${Math.round(p.w)} h=${Math.round(p.h)}`,
    ];
    if (p.oculta) partes.push("OCULTA");
    if (p.backgroundColor) partes.push(`fundo=${p.backgroundColor}`);
    if (p.title) partes.push(`título="${String(p.title).slice(0, 60)}"`);
    linhas.push(`- ${partes.join(" · ")}`);
  }
  return linhas.join("\n");
}

/* Descarta o que não é aplicável ANTES de mandar para a tela.
 *
 * O modelo erra de formas previsíveis: inventa alvo que não existe, manda x=140,
 * cria um tipo já presente. Barrar aqui é melhor do que no cliente por um motivo
 * de produto: uma operação recusada no meio da execução é um robô que trava na
 * frente da pessoa. */
function filtrar(operacoes, { idsValidos, tiposValidos, tiposUsados, fontesValidas }) {
  const saida = [];
  const criados = new Set();

  for (const op of operacoes) {
    if (!ACOES.includes(op.acao)) continue;

    const numero = (v, min, max) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null;
    };

    if (op.acao === "tema") {
      const t = {};
      if (op.appearanceMode === "dark" || op.appearanceMode === "light") t.appearanceMode = op.appearanceMode;
      /* A fonte tem de vir da lista da tela (`builder/data/temas.js`), e não é
         formalidade: o seletor do inspetor só sabe desenhar aqueles sete nomes,
         então um valor livre gravaria um estado que a interface não consegue
         mostrar de volta. Aconteceu no primeiro teste contra o modelo de
         verdade — ele escolheu "serif". */
      if (op.globalFont && fontesValidas.includes(op.globalFont)) t.globalFont = op.globalFont;
      for (const c of ["primaryColor", "secondaryColor"]) {
        if (/^#[0-9a-f]{3,8}$/i.test(op[c] || "")) t[c] = op[c];
      }
      if (Object.keys(t).length) saida.push({ acao: "tema", motivo: op.motivo, ...t });
      continue;
    }

    if (op.acao === "adicionar") {
      const tipo = String(op.tipo || "");
      // Cada tipo existe uma vez só na vitrine — é regra da biblioteca, não do modelo.
      if (!tiposValidos.includes(tipo) || tiposUsados.includes(tipo) || criados.has(tipo)) continue;
      criados.add(tipo);
      saida.push({
        acao: "adicionar",
        motivo: op.motivo,
        tipo,
        x: numero(op.x, 0, 100) ?? 0,
        y: numero(op.y, 0, 20000) ?? 0,
        w: numero(op.w, 10, 100) ?? 50,
        h: numero(op.h, 60, 2000) ?? 220,
        ...(op.title ? { title: String(op.title).slice(0, 200) } : {}),
        ...(op.content ? { content: String(op.content).slice(0, 1200) } : {}),
        ...(op.ctaLabel ? { ctaLabel: String(op.ctaLabel).slice(0, 60) } : {}),
        ...(op.ctaUrl ? { ctaUrl: String(op.ctaUrl).slice(0, 300) } : {}),
        ...(/^#[0-9a-f]{3,8}$/i.test(op.backgroundColor || "") ? { backgroundColor: op.backgroundColor } : {}),
        ...(/^#[0-9a-f]{3,8}$/i.test(op.color || "") ? { color: op.color } : {}),
      });
      continue;
    }

    const alvo = String(op.alvo || "");
    if (!idsValidos.includes(alvo)) continue;

    /* A grade de imóveis não sai e não some, diga o modelo o que disser. É o
       conteúdo pelo qual a vitrine existe, e uma instrução ambígua ("deixe mais
       limpa") não pode acabar numa página sem imóveis. */
    if ((op.acao === "remover" || op.acao === "ocultar") && alvo === "b:properties") continue;
    // Bloco fixo não se remove — a engine nem tem operação para isso.
    if (op.acao === "remover" && alvo.startsWith("b:")) continue;

    if (op.acao === "mover") {
      const x = numero(op.x, 0, 100);
      const y = numero(op.y, 0, 20000);
      if (x === null && y === null) continue;
      saida.push({ acao: "mover", motivo: op.motivo, alvo, x, y });
      continue;
    }
    if (op.acao === "redimensionar") {
      const w = numero(op.w, 10, 100);
      const h = numero(op.h, 60, 4000);
      if (w === null && h === null) continue;
      saida.push({ acao: "redimensionar", motivo: op.motivo, alvo, w, h });
      continue;
    }
    if (op.acao === "estilo") {
      const e = {};
      if (/^#[0-9a-f]{3,8}$/i.test(op.backgroundColor || "")) e.backgroundColor = op.backgroundColor;
      if (/^#[0-9a-f]{3,8}$/i.test(op.color || "")) e.color = op.color;
      if (!Object.keys(e).length) continue;
      saida.push({ acao: "estilo", motivo: op.motivo, alvo, ...e });
      continue;
    }
    if (op.acao === "conteudo") {
      const c = {};
      if (op.title) c.title = String(op.title).slice(0, 200);
      if (op.content) c.content = String(op.content).slice(0, 1200);
      if (op.ctaLabel) c.ctaLabel = String(op.ctaLabel).slice(0, 60);
      if (!Object.keys(c).length) continue;
      saida.push({ acao: "conteudo", motivo: op.motivo, alvo, ...c });
      continue;
    }
    saida.push({ acao: op.acao, motivo: op.motivo, alvo });
  }

  /* Teto de 20. Sem ele, "refaça tudo" volta com sessenta passos e a pessoa
     assiste a um robô mexendo por dois minutos sem entender o que mudou. */
  return saida.slice(0, 20);
}

/**
 * Monta o plano.
 *
 * @param {string} instrucao   o que a pessoa pediu, em português
 * @param {object} vitrine     estado atual (peças, tema, cores)
 * @param {Array}  catalogo    widgets disponíveis, vindos do cliente
 * @param {Function} chamar    função que fala com o modelo (injetada para o teste)
 * @param {string[]} fontes    nomes de fonte que a tela sabe aplicar
 */
export async function planejarVitrine(instrucao, vitrine, catalogo, chamar, fontes = []) {
  const tiposUsados = (vitrine.pecas || [])
    .filter((p) => p.id.startsWith("w:") && p.tipo)
    .map((p) => p.tipo);

  const system = contrato(catalogo, tiposUsados, fontes);
  const prompt = `## Vitrine atual\n\n${descreverVitrine(vitrine)}\n\n## Pedido do dono da imobiliária\n\n"${String(instrucao).slice(0, 600)}"`;

  const texto = await chamar(prompt, {
    system,
    // Baixa de propósito: isto é arrumação de layout, não redação. Temperatura
    // alta aqui vira peça no lugar errado com uma justificativa criativa.
    temperature: 0.35,
    responseSchema: ESQUEMA,
  });

  let bruto;
  try {
    bruto = JSON.parse(texto);
  } catch {
    const err = new Error("A IA respondeu num formato que não consegui ler.");
    err.code = "AI_PARSE";
    throw err;
  }

  const operacoes = filtrar(Array.isArray(bruto.operacoes) ? bruto.operacoes : [], {
    idsValidos: (vitrine.pecas || []).map((p) => p.id),
    tiposValidos: catalogo.map((c) => c.tipo),
    tiposUsados,
    fontesValidas: fontes,
  });

  return {
    resumo: String(bruto.resumo || "").slice(0, 600),
    operacoes,
    /* Quantas foram descartadas. A tela não mostra o número, mas ele vai para o
       log: uma taxa alta de descarte é sinal de que o contrato acima envelheceu
       em relação ao que a engine aceita. */
    descartadas: (Array.isArray(bruto.operacoes) ? bruto.operacoes.length : 0) - operacoes.length,
  };
}
