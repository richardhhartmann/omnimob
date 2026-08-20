import { ShowcaseTexto, usaFonteReal, useDadosDaVitrine } from "../contexto.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   Horário de atendimento.

   Até aqui este widget nem existia: `hours` caía no renderizador de texto, e o
   conteúdo era uma string com `<br>` no meio — "Segunda a Sexta: 09h às 18h<br>
   Sábados: 09h às 13h". Dava um texto apresentável e um dado que nenhuma outra
   parte do sistema conseguia ler: nem o rodapé, nem a página do imóvel, nem uma
   futura resposta automática de WhatsApp fora do expediente.

   Agora as faixas vivem no cadastro da imobiliária (Configurações › Perfil) e
   este componente as desenha. O texto manual continua valendo para quem tem um
   arranjo que a lista não descreve.

   ── ABERTO AGORA ──

   O selo é a informação que a pessoa realmente quer às 21h de um sábado, e é a
   única coisa aqui que o servidor NÃO pode calcular: ele responde uma vez e a
   resposta fica em cache por um minuto, enquanto a página pode ficar aberta a
   tarde inteira. Então é o navegador que decide, com o relógio de quem olha.

   Isso tem um custo honesto: o relógio é o do VISITANTE. Quem abrir a vitrine
   de outro fuso vê o selo pelo horário dele. Corrigir exigiria guardar o fuso
   da imobiliária, e para o público real de uma vitrine — gente da mesma cidade
   — o erro não acontece.
   ──────────────────────────────────────────────────────────────────────────── */

const DIAS_DA_SEMANA = [
  ["domingo", 0],
  ["segunda", 1],
  ["terça", 2], ["terca", 2],
  ["quarta", 3],
  ["quinta", 4],
  ["sexta", 5],
  ["sábado", 6], ["sabado", 6],
];

/* Que dias uma faixa cobre, lendo o texto que a imobiliária escreveu.

   Aceita "Segunda a sexta" (intervalo), "Sábado" (um dia) e "Segunda, quarta e
   sexta" (lista). É reconhecimento de texto livre, e ele erra: uma faixa
   escrita de um jeito que não casa devolve lista vazia, e o selo simplesmente
   não conta com ela. Vazio é o desfecho seguro — melhor não dizer nada do que
   dizer "aberto agora" para uma porta fechada. */
function diasDaFaixa(texto) {
  const t = String(texto || "").toLowerCase();
  const achados = DIAS_DA_SEMANA.filter(([nome]) => t.includes(nome));
  if (!achados.length) return [];

  // "Segunda a sexta" — o " a " entre dois dias é o que marca o intervalo.
  if (/\ba\b|\baté\b|—|–|-/.test(t) && achados.length >= 2) {
    const inicio = achados[0][1];
    const fim = achados[achados.length - 1][1];
    const dias = [];
    for (let d = inicio; ; d = (d + 1) % 7) {
      dias.push(d);
      if (d === fim) break;
      if (dias.length > 7) break;
    }
    return dias;
  }
  return [...new Set(achados.map(([, d]) => d))];
}

/** `"09:30"` → minutos desde a meia-noite. `null` quando não é hora. */
function emMinutos(hora) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hora || "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function estaAbertoAgora(faixas, agora = new Date()) {
  if (!Array.isArray(faixas) || !faixas.length) return null;
  const dia = agora.getDay();
  const minutoAtual = agora.getHours() * 60 + agora.getMinutes();

  let algumaFaixaEntendida = false;
  for (const faixa of faixas) {
    const dias = diasDaFaixa(faixa.dias);
    if (!dias.length) continue;
    algumaFaixaEntendida = true;
    if (!dias.includes(dia)) continue;
    if (faixa.fechado) return false;
    const abre = emMinutos(faixa.abre);
    const fecha = emMinutos(faixa.fecha);
    if (abre === null || fecha === null) continue;
    if (minutoAtual >= abre && minutoAtual < fecha) return true;
  }
  /* Nenhuma faixa reconhecida = não sabemos, e o selo some. Faixas
     reconhecidas e nenhuma cobrindo agora = está fechado, e isso é uma
     resposta útil. */
  return algumaFaixaEntendida ? false : null;
}

export function HoursWidget({ widget }) {
  const dados = useDadosDaVitrine();
  const faixas = dados?.horarios || [];
  const real = usaFonteReal(widget, faixas);
  const cor = widget.color ? { color: widget.color } : undefined;

  if (!real) {
    return (
      <div className="widget-hours">
        <ShowcaseTexto as="h3" campo={`widget|${widget.id}|title`} umaLinha html={widget.title} style={cor} />
        <ShowcaseTexto as="div" className="widget-hours__texto" campo={`widget|${widget.id}|content`} html={widget.content} />
      </div>
    );
  }

  const aberto = estaAbertoAgora(faixas);

  return (
    <div className="widget-hours">
      <div className="widget-hours__head">
        <ShowcaseTexto as="h3" campo={`widget|${widget.id}|title`} umaLinha html={widget.title} style={cor} />
        {aberto === null ? null : (
          <span className={`widget-hours__selo${aberto ? " is-aberto" : ""}`}>
            <span className="widget-hours__ponto" aria-hidden />
            {aberto ? "Aberto agora" : "Fechado agora"}
          </span>
        )}
      </div>
      <ul className="widget-hours__lista">
        {faixas.map((faixa, i) => (
          <li key={`${faixa.dias}-${i}`}>
            <span className="widget-hours__dias">{faixa.dias}</span>
            <span className="widget-hours__faixa">
              {faixa.fechado ? "Fechado" : `${faixa.abre} às ${faixa.fecha}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
