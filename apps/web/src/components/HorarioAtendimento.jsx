import { useMemo } from "react";

/* ────────────────────────────────────────────────────────────────────────────
   Horário de atendimento — os dias da semana, com um horário para todos ou
   um por dia.

   Era um campo de texto livre ("Segunda a sexta") ao lado de dois relógios,
   nas duas telas que o pedem (o assistente de boas-vindas e as Configurações).
   Texto livre é o que a pessoa quiser: "seg-sex", "Segunda à Sexta", "dias
   úteis" — e a vitrine, que calcula "aberto agora" a partir daqui, só entende
   alguns. Aqui a pessoa MARCA os dias; o texto sai pronto e sempre no mesmo
   formato.

   ── O FORMATO GRAVADO NÃO MUDOU ──
   Continua `[{ dias, abre, fecha, fechado }]`, que é o que `dadosDaVitrine`,
   o widget de Horários e o JSON-LD já leem. Este componente CONVERTE: lê o
   formato antigo (inclusive o que foi digitado à mão, quando dá para entender)
   e grava o mesmo formato, com `dias` gerado ("Segunda a sexta", "Sábado",
   "Terça e quinta"). Dias consecutivos com o mesmo horário viram uma faixa
   só; o resto, uma faixa por dia. Dia desmarcado é dia sem atendimento e não
   entra na lista — ausência já era "fechado" para quem lê.

   Compartilhado de propósito: um formulário de horário nas duas telas era o
   caminho para os dois divergirem no primeiro ajuste.
   ──────────────────────────────────────────────────────────────────────────── */

export const DIAS_DA_SEMANA = [
  { id: 1, curto: "Seg", nome: "Segunda" },
  { id: 2, curto: "Ter", nome: "Terça" },
  { id: 3, curto: "Qua", nome: "Quarta" },
  { id: 4, curto: "Qui", nome: "Quinta" },
  { id: 5, curto: "Sex", nome: "Sexta" },
  { id: 6, curto: "Sáb", nome: "Sábado" },
  { id: 0, curto: "Dom", nome: "Domingo" },
];
const ORDEM = [1, 2, 3, 4, 5, 6, 0];
const PADRAO = { abre: "09:00", fecha: "18:00" };

const RE_DIA = [
  [/segunda|seg\b|2ª/i, 1], [/ter[cç]a|ter\b|3ª/i, 2], [/quarta|qua\b|4ª/i, 3],
  [/quinta|qui\b|5ª/i, 4], [/sexta|sex\b|6ª/i, 5], [/s[aá]bado|s[aá]b\b/i, 6], [/domingo|dom\b/i, 0],
];
const diaDe = (palavra) => RE_DIA.find(([re]) => re.test(palavra))?.[1];

/** Os dias que um texto de faixa descreve: "Segunda a sexta" → [1,2,3,4,5]. */
export function diasDoTexto(texto) {
  const t = String(texto || "").trim();
  if (!t) return [];
  if (/dias?\s+[uú]teis/i.test(t)) return [1, 2, 3, 4, 5];
  if (/todos os dias|diariamente/i.test(t)) return [...ORDEM];
  const faixa = t.match(/([a-zçãáâ0-9ª]+)\s*(?:a|à|até|-|–)\s*([a-zçãáâ0-9ª]+)/i);
  if (faixa) {
    const a = diaDe(faixa[1]); const b = diaDe(faixa[2]);
    if (a !== undefined && b !== undefined) {
      const ia = ORDEM.indexOf(a); const ib = ORDEM.indexOf(b);
      if (ia <= ib) return ORDEM.slice(ia, ib + 1);
    }
  }
  return ORDEM.filter((d) => RE_DIA.find(([, id]) => id === d)[0].test(t));
}

/** Modelo por dia a partir das faixas gravadas: `{ [dia]: { abre, fecha } }`. */
export function diasDasFaixas(faixas) {
  const saida = {};
  for (const f of Array.isArray(faixas) ? faixas : []) {
    if (f?.fechado) continue;
    for (const d of diasDoTexto(f?.dias)) {
      if (f.abre && f.fecha) saida[d] = { abre: f.abre, fecha: f.fecha };
    }
  }
  return saida;
}

const nomeDe = (d) => DIAS_DA_SEMANA.find((x) => x.id === d).nome;

/** O texto de um grupo de dias: "Segunda a sexta", "Sábado", "Terça e quinta". */
export function textoDosDias(dias) {
  const lista = ORDEM.filter((d) => dias.includes(d));
  if (!lista.length) return "";
  if (lista.length === 7) return "Todos os dias";
  const idx = lista.map((d) => ORDEM.indexOf(d));
  const consecutivos = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  if (consecutivos && lista.length >= 3) return `${nomeDe(lista[0])} a ${nomeDe(lista[lista.length - 1]).toLowerCase()}`;
  if (lista.length === 1) return nomeDe(lista[0]);
  const nomes = lista.map((d, i) => (i === 0 ? nomeDe(d) : nomeDe(d).toLowerCase()));
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

/** As faixas gravadas a partir do modelo por dia. Consecutivos com o mesmo horário viram uma. */
export function faixasDosDias(porDia) {
  const faixas = [];
  let grupo = null;
  for (const d of ORDEM) {
    const h = porDia[d];
    if (!h) { if (grupo) { faixas.push(grupo); grupo = null; } continue; }
    if (grupo && grupo.abre === h.abre && grupo.fecha === h.fecha) { grupo.dias.push(d); continue; }
    if (grupo) faixas.push(grupo);
    grupo = { dias: [d], abre: h.abre, fecha: h.fecha };
  }
  if (grupo) faixas.push(grupo);
  return faixas.map((g) => ({ dias: textoDosDias(g.dias), abre: g.abre, fecha: g.fecha, fechado: false }));
}

/**
 * @param {object} p
 * @param {Array}  p.valor      as faixas gravadas (`[{dias, abre, fecha, fechado}]`)
 * @param {Function} p.aoMudar  recebe as faixas novas
 * @param {boolean} [p.desabilitado]
 * @param {string}  [p.classeEntrada]  classe dos inputs de hora (cada tela tem a sua)
 */
export function HorarioAtendimento({ valor, aoMudar, desabilitado = false, classeEntrada = "" }) {
  const porDia = useMemo(() => diasDasFaixas(valor), [valor]);
  const marcados = ORDEM.filter((d) => porDia[d]);
  const horarios = [...new Set(marcados.map((d) => `${porDia[d].abre}-${porDia[d].fecha}`))];
  const unico = horarios.length <= 1;
  const referencia = marcados.length ? porDia[marcados[0]] : PADRAO;

  const gravar = (novo) => aoMudar(faixasDosDias(novo));

  function alternarDia(d) {
    const novo = { ...porDia };
    if (novo[d]) delete novo[d];
    else novo[d] = { ...(unico ? referencia : PADRAO) };
    gravar(novo);
  }

  function mudarTodos(campo, v) {
    const novo = {};
    for (const d of marcados) novo[d] = { ...porDia[d], [campo]: v };
    gravar(novo);
  }

  function mudarDia(d, campo, v) {
    gravar({ ...porDia, [d]: { ...porDia[d], [campo]: v } });
  }

  function alternarModo() {
    if (!unico) {
      // Volta ao horário único: o do primeiro dia marcado vale para todos.
      const novo = {}; for (const d of marcados) novo[d] = { ...referencia }; gravar(novo);
      return;
    }
    /* Para "por dia" com todos iguais nada muda no dado — só na tela. Um
       minuto de diferença no último dia é o que marca a escolha; a pessoa vai
       ajustar em seguida, que é o motivo de ter clicado. */
    if (marcados.length < 2) return;
    const ultimo = marcados[marcados.length - 1];
    const [h, m] = String(porDia[ultimo].fecha || "18:00").split(":").map(Number);
    const fecha = `${String(h).padStart(2, "0")}:${String((m + 1) % 60).padStart(2, "0")}`;
    gravar({ ...porDia, [ultimo]: { ...porDia[ultimo], fecha } });
  }

  return (
    <div className="hat">
      <div className="hat__dias" role="group" aria-label="Dias de atendimento">
        {DIAS_DA_SEMANA.map((d) => {
          const ativo = Boolean(porDia[d.id]);
          return (
            <button
              key={d.id}
              type="button"
              className={`hat__dia${ativo ? " is-ativo" : ""}`}
              aria-pressed={ativo}
              title={d.nome}
              onClick={() => alternarDia(d.id)}
              disabled={desabilitado}
            >
              {d.curto}
            </button>
          );
        })}
      </div>

      {marcados.length === 0 ? (
        <p className="hat__vazio">Marque os dias em que a imobiliária atende.</p>
      ) : (
        <>
          <label className="hat__modo">
            <input type="checkbox" checked={unico} onChange={alternarModo} disabled={desabilitado || marcados.length < 2} />
            Mesmo horário para todos os dias marcados
          </label>

          {unico ? (
            <div className="hat__linha">
              <span className="hat__rotulo">{textoDosDias(marcados)}</span>
              <input className={classeEntrada} type="time" value={referencia.abre} onChange={(e) => mudarTodos("abre", e.target.value)} disabled={desabilitado} />
              <em>às</em>
              <input className={classeEntrada} type="time" value={referencia.fecha} onChange={(e) => mudarTodos("fecha", e.target.value)} disabled={desabilitado} />
            </div>
          ) : (
            marcados.map((d) => (
              <div className="hat__linha" key={d}>
                <span className="hat__rotulo">{nomeDe(d)}</span>
                <input className={classeEntrada} type="time" value={porDia[d].abre} onChange={(e) => mudarDia(d, "abre", e.target.value)} disabled={desabilitado} />
                <em>às</em>
                <input className={classeEntrada} type="time" value={porDia[d].fecha} onChange={(e) => mudarDia(d, "fecha", e.target.value)} disabled={desabilitado} />
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}

/* Sem crases: as duas telas embutem isto em template literal. */
export const HORARIO_ATENDIMENTO_CSS = `
.hat { display: flex; flex-direction: column; gap: 10px; }
.hat__dias { display: flex; flex-wrap: wrap; gap: 6px; }
.hat__dia {
  width: auto; min-width: 44px; padding: 7px 10px; border-radius: 999px;
  font-size: 12px; font-weight: 700; letter-spacing: 0.02em; cursor: pointer;
  background: var(--sup-04, rgba(255,255,255,0.04)); border: 1px solid var(--linha-12, rgba(255,255,255,0.12));
  color: var(--text-muted, #94a3b8); box-shadow: none; transform: none; transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.hat__dia:hover { color: var(--text-main, #f1f5f9); box-shadow: none; transform: none; }
.hat__dia.is-ativo { background: rgba(129,140,248,0.16); border-color: rgba(129,140,248,0.55); color: var(--text-main, #f1f5f9); }
.hat__vazio { margin: 0; font-size: 12.5px; color: var(--text-muted, #94a3b8); }
.hat__modo { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--text-muted, #94a3b8); cursor: pointer; }
.hat__modo input { width: auto; margin: 0; }
.hat__linha { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.hat__linha em { font-size: 12px; font-style: normal; color: var(--text-muted, #94a3b8); }
.hat__linha input[type="time"] { width: auto; }
.hat__rotulo { min-width: 150px; font-size: 13px; font-weight: 600; }
`;
