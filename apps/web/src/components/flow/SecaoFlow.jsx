import { useEffect, useState } from "react";
import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { api } from "../../api";
import { reais } from "../../utils/flow";

/* ────────────────────────────────────────────────────────────────────────────
   CONFIGURAÇÕES → OMNIMOB FLOW.

   Duas coisas, e só duas: com quem assinar e como dividir a comissão. É pouco
   de propósito — configuração que cresce vira uma tela que ninguém termina de
   preencher, e o módulo tem que funcionar no primeiro dia com o que já vem.

   ── O TOKEN NUNCA VOLTA ──

   `assinaturaToken` é cifrado em repouso (`services/cofre.js`) e filtrado na
   saída por `SEGREDOS_DO_TENANT`. Esta tela nunca o recebe: ela mostra se ele
   EXISTE (`assinaturaConfigurada`) e oferece substituí-lo. Um campo que
   voltasse preenchido com asteriscos convidaria a "salvar sem mexer" e
   gravaria os asteriscos por cima da chave boa — já aconteceu com o token da
   página do Facebook em outro produto.

   ── OS PERCENTUAIS SÃO PADRÃO, NÃO REGRA ──

   6% e 50/50 são o costume do mercado brasileiro. Cada negócio pode ter os
   seus, e o que ficar aqui só vale para os PRÓXIMOS: negócio já fechado
   congelou o dele. A frase está na tela porque é a primeira dúvida de quem
   mexe neste campo.
   ──────────────────────────────────────────────────────────────────────────── */

const PROVEDORES = [
  {
    key: "clicksign",
    rotulo: "Clicksign",
    nota: "Brasileira, cobra em real e aceita assinatura por e-mail, SMS e WhatsApp.",
    campoConta: null,
    ondePegar: "Painel da Clicksign → Configurações → API → Access Token.",
  },
  {
    key: "docusign",
    rotulo: "DocuSign",
    nota: "Padrão internacional. Exige também o Account ID da conta.",
    campoConta: "Account ID",
    ondePegar: "DocuSign Admin → Apps and Keys → o Account ID e um token OAuth.",
  },
];

export function SecaoFlow({ session, Secao, showToast }) {
  const tenantSlug = session?.tenant?.slug;
  const [dados, setDados] = useState(null);
  const [form, setForm] = useState({
    assinaturaProvedor: "clicksign", assinaturaToken: "", assinaturaConta: "",
    assinaturaSandbox: true, comissaoPercentual: "6", comissaoCorretorPerc: "50",
  });
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!tenantSlug) return;
    api.getTenantProfile(tenantSlug)
      .then((t) => {
        setDados(t);
        setForm((f) => ({
          ...f,
          assinaturaProvedor: t.assinaturaProvedor || "clicksign",
          assinaturaConta: t.assinaturaConta || "",
          assinaturaSandbox: t.assinaturaSandbox !== false,
          comissaoPercentual: String(t.comissaoPercentual ?? 6),
          comissaoCorretorPerc: String(t.comissaoCorretorPerc ?? 50),
        }));
      })
      .catch(() => {});
  }, [tenantSlug]);

  const provedor = PROVEDORES.find((p) => p.key === form.assinaturaProvedor) || PROVEDORES[0];
  const jaConfigurado = Boolean(dados?.assinaturaConfigurada);

  /* A prévia de um negócio de meio milhão. Números abstratos ("6% e 50%") não
     dizem nada a quem está decidindo a política; "R$ 30.000, sendo R$ 15.000
     para o corretor" diz. É a mesma conta do servidor, refeita aqui só para
     ilustrar — o valor que vale é sempre o congelado no negócio. */
  const exemplo = (() => {
    const base = 500000;
    const perc = Number(form.comissaoPercentual) || 0;
    const percC = Number(form.comissaoCorretorPerc) || 0;
    const total = (base * perc) / 100;
    const corretor = (total * percC) / 100;
    return { total, corretor, casa: total - corretor };
  })();

  async function salvar() {
    setSalvando(true);
    try {
      const payload = {
        assinaturaProvedor: form.assinaturaProvedor,
        assinaturaConta: form.assinaturaConta || null,
        assinaturaSandbox: form.assinaturaSandbox,
        comissaoPercentual: Number(form.comissaoPercentual) || 0,
        comissaoCorretorPerc: Number(form.comissaoCorretorPerc) || 0,
      };
      /* O token só viaja quando a pessoa digitou algo. Mandar string vazia
         apagaria a chave configurada de quem só veio ajustar a comissão — e o
         sintoma seria "os contratos pararam de sair" no dia seguinte. */
      if (form.assinaturaToken.trim()) payload.assinaturaToken = form.assinaturaToken.trim();

      await api.updateTenantConfiguracao(tenantSlug, payload);
      setForm((f) => ({ ...f, assinaturaToken: "" }));
      setDados((d) => ({ ...d, assinaturaConfigurada: jaConfigurado || Boolean(payload.assinaturaToken) }));
      showToast?.("Configurações do Flow salvas.");
    } catch (e) {
      showToast?.(e.message || "Não consegui salvar.", "error");
    } finally { setSalvando(false); }
  }

  return (
    <>
      <Secao cor="#14b8a6" titulo="Assinatura digital" icone={<CheckCircle size={16} weight="fill" />}>
        <p className="config-nota">
          A conta é sua, no provedor que você contratar — os contratos saem em nome da sua
          imobiliária, não da Omnimob. Sem isto configurado, o Flow gera a minuta preenchida mas não
          consegue mandá-la para assinatura.
        </p>

        <div className={`flow-cfg-estado${jaConfigurado ? " is-ok" : ""}`}>
          {jaConfigurado
            ? <><CheckCircle size={15} weight="fill" /> Conectado ao {provedor.rotulo}
                {form.assinaturaSandbox ? " (ambiente de teste)" : ""}</>
            : <><WarningCircle size={15} weight="fill" /> Nenhum provedor conectado</>}
        </div>

        <div className="flow-form__dupla" style={{ marginTop: 14 }}>
          <label className="flow-campo">
            <span>Provedor</span>
            <select
              value={form.assinaturaProvedor}
              onChange={(e) => setForm((f) => ({ ...f, assinaturaProvedor: e.target.value }))}
            >
              {PROVEDORES.map((p) => <option key={p.key} value={p.key}>{p.rotulo}</option>)}
            </select>
            <small className="flow-cfg-dica">{provedor.nota}</small>
          </label>
          {provedor.campoConta ? (
            <label className="flow-campo">
              <span>{provedor.campoConta}</span>
              <input
                value={form.assinaturaConta}
                onChange={(e) => setForm((f) => ({ ...f, assinaturaConta: e.target.value }))}
                placeholder="ex.: 1a2b3c4d-…"
              />
            </label>
          ) : <div />}
        </div>

        <label className="flow-campo" style={{ marginTop: 12 }}>
          <span>{jaConfigurado ? "Substituir o token" : "Token de acesso"}</span>
          <input
            type="password"
            autoComplete="off"
            value={form.assinaturaToken}
            onChange={(e) => setForm((f) => ({ ...f, assinaturaToken: e.target.value }))}
            placeholder={jaConfigurado ? "deixe em branco para manter o atual" : "cole aqui o token"}
          />
          <small className="flow-cfg-dica">{provedor.ondePegar} Ele é guardado cifrado e nunca mais aparece nesta tela.</small>
        </label>

        <label className="flow-check" style={{ marginTop: 14 }}>
          <input
            type="checkbox" className="sw"
            checked={form.assinaturaSandbox}
            onChange={(e) => setForm((f) => ({ ...f, assinaturaSandbox: e.target.checked }))}
          />
          <span>
            Ambiente de teste (sandbox)
            {/* Ligado por padrão, e é deliberado: o primeiro contrato que
                alguém manda é para ver se funciona, e ele não pode chegar ao
                cliente de verdade nem consumir documento pago. */}
            <small>Recomendado até você conferir o primeiro contrato. Nada enviado aqui tem validade jurídica.</small>
          </span>
        </label>
      </Secao>

      <Secao cor="#d4af37" titulo="Política de comissão" icone={<CheckCircle size={16} weight="fill" />}>
        <p className="config-nota">
          O padrão da casa. Cada negócio pode ter percentuais próprios, e o que você mudar aqui vale
          só para os <strong>próximos</strong> — negócio já fechado congelou os dele, e a conta do
          corretor não é reescrita para trás.
        </p>

        <div className="flow-form__dupla">
          <label className="flow-campo">
            <span>Comissão sobre o valor do negócio</span>
            <div className="flow-cfg-perc">
              <input
                type="number" min="0" max="100" step="0.5"
                value={form.comissaoPercentual}
                onChange={(e) => setForm((f) => ({ ...f, comissaoPercentual: e.target.value }))}
              />
              <span>%</span>
            </div>
          </label>
          <label className="flow-campo">
            <span>Da comissão, quanto vai ao corretor</span>
            <div className="flow-cfg-perc">
              <input
                type="number" min="0" max="100" step="5"
                value={form.comissaoCorretorPerc}
                onChange={(e) => setForm((f) => ({ ...f, comissaoCorretorPerc: e.target.value }))}
              />
              <span>%</span>
            </div>
          </label>
        </div>

        <div className="flow-cfg-exemplo">
          <strong>Num negócio de {reais(500000)}:</strong>
          <span>comissão total de <strong>{reais(exemplo.total)}</strong></span>
          <span>{reais(exemplo.casa)} para a imobiliária</span>
          <span>{reais(exemplo.corretor)} para o corretor</span>
        </div>
      </Secao>

      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
        <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar configurações do Flow"}
        </button>
      </div>
    </>
  );
}
