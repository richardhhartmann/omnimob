import { useState } from "react";
import { UsersThree, Tag, CheckCircle } from "@phosphor-icons/react";
import { api } from "../api";

/* ────────────────────────────────────────────────────────────────────────────
   PASSO PRÓPRIO: o que a conta já vem sabendo.

   ── POR QUE ELE EXISTE ──

   Sete cargos e dezenove tipos de imóvel nasciam com TODA conta, decididos por
   nós. Para muita imobiliária servem; para a que já tem o próprio arranjo, a
   primeira tarefa no sistema era APAGAR o que veio, um por um — e apagar dá
   mais trabalho do que criar. Agora ela escolhe.

   ── POR QUE UM PASSO, E NÃO UM PEDAÇO DA FICHA ──

   Isto começou embaixo do formulário da imobiliária, e estava errado por dois
   motivos. O primeiro é de leitura: a ficha pergunta o que a EMPRESA é (nome,
   CNPJ, endereço, cores), e aqui a pergunta é o que o SISTEMA deve trazer
   pronto — duas conversas numa tela só. O segundo é de espaço: o seeder tende a
   crescer (modelos de minuta, estágios do funil, motivos de perda), e cada
   acréscimo empurrava um formulário que já é longo.

   ── COMO CRESCER ──

   Acrescente uma entrada em `CATALOGOS`. A `chave` é o campo que o servidor
   espera em `POST /api/tenants/me/catalogos-padrao`; o resto é desenho. Nada
   mais neste arquivo precisa mudar, e o passo tem a mesma cara com dois itens
   ou com seis.
   ────────────────────────────────────────────────────────────────────────── */

export const CATALOGOS = [
  {
    chave: "cargos",
    Icone: UsersThree,
    cor: "#f59e0b",
    rotulo: "Cargos da equipe",
    resumo:
      "Seis cargos padrões com as permissões que o nome sugere — de quem só consulta a quem responde pela conta.",
    exemplos: ["Gerente", "Corretor", "Assistente Comercial", "Marketing", "Editor de Vitrine", "Consulta"],
    /* O Administrador não entra na lista: ele não é catálogo, é a PORTA — nasce
       com a conta de qualquer forma, senão ninguém entraria nela. Dizer isso
       aqui evita a pergunta "e o meu cargo, sumiu?". */
    nota: "O Administrador é seu e existe de qualquer forma.",
  },
  {
    chave: "tipos",
    Icone: Tag,
    cor: "#8b5cf6",
    rotulo: "Tipos de imóvel e atributos",
    resumo:
      "Dezenove tipos, cada um com os atributos que a categoria pede. São eles que o cliente usa para filtrar na sua vitrine.",
    exemplos: ["Casa", "Apartamento", "Terreno", "Sala Comercial", "Galpão", "Chácara"],
    nota: "174 atributos prontos, como Piscina, Churrasqueira e Portaria 24h.",
  },
];

export function CatalogosPasso({ tenantSlug, aoConcluir }) {
  /* Ligados por padrão: até aqui TODA conta nascia com eles, e chegar
     desmarcado seria tirar de quem nunca pediu para tirar. O que muda é poder
     desmarcar. */
  const [marcados, setMarcados] = useState(() =>
    Object.fromEntries(CATALOGOS.map((c) => [c.chave, true])),
  );
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState("");

  const algumMarcado = CATALOGOS.some((c) => marcados[c.chave]);

  function alternar(chave) {
    setMarcados((m) => ({ ...m, [chave]: !m[chave] }));
  }

  async function continuar() {
    /* Sem nada marcado não há chamada: seria a viagem inteira ao servidor para
       ele responder "criei zero". */
    if (!algumMarcado) { aoConcluir?.(); return; }
    setCriando(true);
    setErro("");
    try {
      await api.criarCatalogosPadrao(tenantSlug, marcados);
      aoConcluir?.();
    } catch (e) {
      /* Não prende ninguém na porta de entrada: o que falhou é um extra, e as
         duas telas que ele preenche têm o próprio convite para criar à mão. */
      setErro(e?.message || "Não deu para criar agora — dá para seguir e criá-los quando quiser.");
      setCriando(false);
    }
  }

  return (
    <div className="cat-corpo">
      <div className="cat-lista">
        {CATALOGOS.map((c) => (
          <ItemDoCatalogo
            key={c.chave}
            catalogo={c}
            ligado={Boolean(marcados[c.chave])}
            aoAlternar={() => alternar(c.chave)}
            desabilitado={criando}
          />
        ))}
      </div>

      {erro ? <p className="cat-erro">{erro}</p> : null}

      {/* O rodapé é o do assistente (`.bv-acoes` + `.bv-botao`, em
          BoasVindasModal) — cada passo tinha o seu. O que vai acontecer é
          dito pelas chaves marcadas; o botão só continua. */}
      <div className="bv-acoes">
        <button type="button" className="bv-botao" onClick={continuar} disabled={criando}>
          {criando ? "Criando…" : "Continuar"}
        </button>
      </div>
    </div>
  );
}

function ItemDoCatalogo({ catalogo, ligado, aoAlternar, desabilitado }) {
  const { Icone, cor, rotulo, resumo, exemplos, nota } = catalogo;

  return (
    <label className={`cat-item${ligado ? " is-ligado" : ""}`} style={{ "--cat-cor": cor }}>
      <input
        type="checkbox"
        className="cat-item__entrada"
        checked={ligado}
        onChange={aoAlternar}
        disabled={desabilitado}
      />

      <span className="cat-item__disco" aria-hidden="true">
        <Icone size={22} weight="duotone" />
      </span>

      <span className="cat-item__texto">
        <span className="cat-item__topo">
          <span className="cat-item__rotulo">{rotulo}</span>
          <span className="cat-item__trilho" aria-hidden="true"><span className="cat-item__bola" /></span>
        </span>
        <span className="cat-item__resumo">{resumo}</span>

        {/* Os exemplos como etiquetas, e não como frase: a pessoa precisa
            RECONHECER o que vem, e uma lista separada por vírgula obriga a ler
            tudo para achar o que interessa. */}
        <span className="cat-item__chips">
          {exemplos.map((e) => <span className="cat-chip" key={e}>{e}</span>)}
          <span className="cat-chip cat-chip--mais">e mais</span>
        </span>

        {nota ? (
          <span className="cat-item__nota">
            <CheckCircle size={13} weight="fill" /> {nota}
          </span>
        ) : null}
      </span>
    </label>
  );
}

/* Sem CRASE nenhuma nos comentarios daqui: template literal. */
export const CATALOGOS_CSS = `
.cat-corpo { display: flex; flex-direction: column; gap: 16px; text-align: left; }
.cat-lista { display: flex; flex-direction: column; gap: 12px; }

.cat-item {
  display: grid; grid-template-columns: auto minmax(0, 1fr);
  align-items: start; gap: 14px; cursor: pointer;
  padding: 16px 18px; border-radius: 14px;
  border: 1px solid var(--linha-10, rgba(255,255,255,0.10));
  background: var(--sup-02, rgba(255,255,255,0.02));
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
}
.cat-item:hover { transform: translateY(-1px); }
.cat-item.is-ligado {
  border-color: color-mix(in srgb, var(--cat-cor) 40%, transparent);
  background: color-mix(in srgb, var(--cat-cor) 7%, transparent);
}

/* ── A CAIXA DE VERDADE, ESCONDIDA ─────────────────────────────────────────
   O seletor precisa do ELEMENTO junto da classe. O styles.css global desenha
   todo input de tipo checkbox — 18px, position relative — e esse seletor tem
   especificidade maior que uma classe sozinha: a caixa reaparecia dentro da
   grade, empurrava o interruptor para a segunda coluna e jogava o texto para a
   linha de baixo. Era esse o layout quebrado da primeira versao.

   Escondida, mas ALCANCAVEL pelo teclado: o foco desenha no trilho, abaixo. */
.cat-item input[type="checkbox"].cat-item__entrada {
  position: absolute; opacity: 0; width: 1px; height: 1px;
  margin: 0; padding: 0; border: 0; appearance: none; pointer-events: none;
}

.cat-item__disco {
  width: 44px; height: 44px; border-radius: 13px; flex: none;
  display: flex; align-items: center; justify-content: center;
  color: var(--cat-cor);
  background: color-mix(in srgb, var(--cat-cor) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--cat-cor) 26%, transparent);
  transition: background 0.2s ease, border-color 0.2s ease;
}

.cat-item__texto { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.cat-item__topo { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.cat-item__rotulo { font-size: 14px; font-weight: 650; color: var(--bv-forte, #e2e8f0); }
.cat-item__resumo { font-size: 12px; line-height: 1.6; color: var(--bv-fraco, #94a3b8); }

/* O interruptor. Mesmo desenho do resto do painel; o que muda e a cor, que sai
   do proprio catalogo. */
.cat-item__trilho {
  position: relative; flex: none; width: 36px; height: 21px; border-radius: 999px;
  background: var(--sup-08, rgba(255,255,255,0.08));
  border: 1px solid var(--linha-12, rgba(255,255,255,0.12));
  transition: background 0.2s ease, border-color 0.2s ease;
}
.cat-item__bola {
  position: absolute; top: 2px; left: 2px; width: 15px; height: 15px; border-radius: 50%;
  background: #94a3b8; transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1), background 0.2s ease;
}
.cat-item.is-ligado .cat-item__trilho { background: var(--cat-cor); border-color: var(--cat-cor); }
.cat-item.is-ligado .cat-item__bola { background: #fff; transform: translateX(15px); }
.cat-item__entrada:focus-visible ~ .cat-item__texto .cat-item__trilho {
  outline: 2px solid var(--cat-cor); outline-offset: 2px;
}
.cat-item__entrada:disabled ~ .cat-item__texto .cat-item__trilho { opacity: 0.5; }

.cat-item__chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 1px; }
.cat-chip {
  font-size: 10.5px; padding: 3px 8px; border-radius: 999px; white-space: nowrap;
  color: var(--bv-fraco, #94a3b8);
  background: var(--sup-05, rgba(255,255,255,0.05));
  border: 1px solid var(--linha-08, rgba(255,255,255,0.08));
}
.cat-item.is-ligado .cat-chip {
  color: color-mix(in srgb, var(--cat-cor) 75%, #e2e8f0);
  border-color: color-mix(in srgb, var(--cat-cor) 22%, transparent);
  background: color-mix(in srgb, var(--cat-cor) 10%, transparent);
}
.cat-chip--mais { font-style: italic; opacity: 0.75; }

.cat-item__nota {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11px; color: var(--bv-fraco, #94a3b8); opacity: 0.85;
}
.cat-item__nota svg { color: var(--cat-cor); flex: none; }

.cat-erro { margin: 0; font-size: 12px; color: #fca5a5; }

@media (max-width: 560px) {
  .cat-item { grid-template-columns: 1fr; gap: 10px; }
}
@media (prefers-reduced-motion: reduce) {
  .cat-item, .cat-item__bola { transition: none; animation: none; }
}
`;
