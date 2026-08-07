import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { formatCep, formatCnpj, formatCreci, formatPhone, onlyDigits } from "../utils/masks";
import { uploadLogoWithBackgroundRemoval } from "../utils/uploadToCloudinary";

/* ────────────────────────────────────────────────────────────────────────────
   Segundo passo das boas-vindas: a ficha da imobiliária.

   POR QUE AQUI, e não só nas Configurações: estes dados são o que a vitrine
   pública mostra ao visitante — nome, contato, endereço, cores, logo. Um
   ambiente recém-criado tem tudo em branco, e a primeira coisa que a pessoa faz
   é abrir a vitrine e ver uma página sem marca nenhuma. Perguntar agora, com
   três campos já preenchidos pelo cadastro do teste, é mais barato que pedir
   depois que ela se decepcionou com a página vazia.

   NADA É OBRIGATÓRIO. O botão de pular está sempre visível e leva ao painel do
   mesmo jeito. Quem acabou de entrar num teste raramente tem o CNPJ e o CRECI
   na ponta da língua, e travar a porta de entrada num campo desses é trocar um
   cadastro completo por uma desistência.

   Tudo cai em `PUT /api/tenants/me/configuracao` — a mesma rota da tela de
   Configurações, com o mesmo schema. Não há campo aqui que não exista lá.
   ──────────────────────────────────────────────────────────────────────────── */

const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT",
  "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
];

/* O telefone do cadastro pode vir com o código do país (o fluxo do teste aceita
   "5511999999999"), e a máscara de 11 dígitos leria o "55" como DDD — saía
   "(55) 11999-9999". Tiramos o DDI só quando o número tem 12 ou 13 dígitos:
   com 11 o "55" inicial é DDD de verdade, o de Santa Maria. */
function telefoneLocal(valor) {
  const d = onlyDigits(valor);
  const semDdi = (d.length === 12 || d.length === 13) && d.startsWith("55") ? d.slice(2) : d;
  return formatPhone(semDdi);
}

const VAZIO = {
  name: "", slogan: "", cnpj: "", creci: "", whatsapp: "", telefone: "", email: "",
  cep: "", endereco: "", cidade: "", estado: "", logoUrl: "",
  primaryColor: "#6366f1", secondaryColor: "#d4af37",
};

export function PerfilInicialPasso({ tenantSlug, aoConcluir, aoPular }) {
  const [form, setForm] = useState(VAZIO);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [cepBuscando, setCepBuscando] = useState(false);
  const [logoSubindo, setLogoSubindo] = useState(false);
  const arquivoRef = useRef(null);

  /* Nome, e-mail e telefone já vieram do formulário do teste e estão gravados
     no tenant desde o provisionamento — então não perguntamos de novo: lemos e
     mostramos preenchidos, para a pessoa só conferir. */
  useEffect(() => {
    if (!tenantSlug) return;
    api
      .getTenantProfile(tenantSlug)
      .then((t) => {
        setForm({
          name: t.name || "",
          slogan: t.slogan || "",
          cnpj: t.cnpj ? formatCnpj(t.cnpj) : "",
          creci: t.creci || "",
          whatsapp: telefoneLocal(t.whatsapp),
          telefone: telefoneLocal(t.telefone),
          email: t.email || "",
          cep: t.cep ? formatCep(t.cep) : "",
          endereco: t.endereco || "",
          cidade: t.cidade || "",
          estado: t.estado || "",
          logoUrl: t.logoUrl || "",
          primaryColor: t.primaryColor || "#6366f1",
          secondaryColor: t.secondaryColor || "#d4af37",
        });
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, [tenantSlug]);

  function set(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  /* CEP completo busca o resto do endereço. Só preenche o que está VAZIO: quem
     já corrigiu a rua na mão não pode ver a correção ser desfeita por uma
     consulta que rodou depois. */
  async function buscarCep(valor) {
    const limpo = onlyDigits(valor);
    if (limpo.length !== 8) return;
    setCepBuscando(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
      const d = await r.json();
      if (d?.erro) return;
      setForm((f) => ({
        ...f,
        endereco: f.endereco || d.logradouro || "",
        cidade: f.cidade || d.localidade || "",
        estado: f.estado || d.uf || "",
      }));
    } catch {
      /* sem internet ou ViaCEP fora: a pessoa preenche na mão */
    } finally {
      setCepBuscando(false);
    }
  }

  async function enviarLogo(evento) {
    const arquivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!arquivo) return;
    setLogoSubindo(true);
    setErro("");
    try {
      const { url } = await uploadLogoWithBackgroundRemoval(arquivo);
      set("logoUrl", url);
    } catch (e) {
      setErro(e?.message || "Não consegui enviar a imagem. Tente outra.");
    } finally {
      setLogoSubindo(false);
    }
  }

  async function salvar() {
    setSalvando(true);
    setErro("");
    try {
      await api.updateTenantConfiguracao(tenantSlug, {
        ...form,
        // O banco guarda só os dígitos; a máscara é coisa da tela.
        cnpj: onlyDigits(form.cnpj),
        cep: onlyDigits(form.cep),
        estado: form.estado.toUpperCase().slice(0, 2),
        creci: form.creci.trim(),
      });
      aoConcluir?.(form);
    } catch (e) {
      setErro(e?.message || "Não foi possível salvar agora. Você pode preencher depois em Configurações.");
      setSalvando(false);
    }
  }

  if (carregando) {
    return <p className="pi-carregando">Carregando os dados do seu cadastro…</p>;
  }

  const ocupado = salvando || logoSubindo;

  return (
    <div className="pi-corpo">
      <div className="pi-grade">
        <Campo rotulo="Nome da imobiliária" largo>
          <input className="pi-entrada" value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={120} disabled={ocupado} />
        </Campo>

        <Campo rotulo="Slogan" dica="Aparece embaixo do nome na vitrine." largo>
          <input className="pi-entrada" value={form.slogan} onChange={(e) => set("slogan", e.target.value)} placeholder="O seu próximo endereço começa aqui" maxLength={120} disabled={ocupado} />
        </Campo>

        <Campo rotulo="CNPJ">
          <input className="pi-entrada" value={form.cnpj} onChange={(e) => set("cnpj", formatCnpj(e.target.value))} placeholder="00.000.000/0000-00" inputMode="numeric" disabled={ocupado} />
        </Campo>

        {/* O CRECI da PESSOA JURÍDICA. É ele que precisa constar dos anúncios
            da imobiliária — ver a nota no rodapé deste passo. */}
        <Campo rotulo="CRECI jurídico" dica="Da imobiliária, não do corretor.">
          <input className="pi-entrada" value={form.creci} onChange={(e) => set("creci", formatCreci(e.target.value))} placeholder="12345-J/SP" disabled={ocupado} />
        </Campo>

        <Campo rotulo="Contato (WhatsApp)">
          <input className="pi-entrada" value={form.whatsapp} onChange={(e) => set("whatsapp", formatPhone(e.target.value))} placeholder="(11) 99999-9999" inputMode="tel" disabled={ocupado} />
        </Campo>

        <Campo rotulo="Telefone fixo">
          <input className="pi-entrada" value={form.telefone} onChange={(e) => set("telefone", formatPhone(e.target.value))} placeholder="(11) 3333-3333" inputMode="tel" disabled={ocupado} />
        </Campo>

        <Campo rotulo="E-mail" largo>
          <input className="pi-entrada" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="contato@imobiliaria.com.br" disabled={ocupado} />
        </Campo>

        <Campo rotulo="CEP" dica={cepBuscando ? "Buscando o endereço…" : "Preenche o resto sozinho."}>
          <input
            className="pi-entrada"
            value={form.cep}
            onChange={(e) => { const v = formatCep(e.target.value); set("cep", v); buscarCep(v); }}
            placeholder="00000-000"
            inputMode="numeric"
            disabled={ocupado}
          />
        </Campo>

        <Campo rotulo="Cidade">
          <input className="pi-entrada" value={form.cidade} onChange={(e) => set("cidade", e.target.value)} disabled={ocupado} />
        </Campo>

        <Campo rotulo="Endereço" largo>
          <input className="pi-entrada" value={form.endereco} onChange={(e) => set("endereco", e.target.value)} placeholder="Rua, número e complemento" disabled={ocupado} />
        </Campo>

        <Campo rotulo="UF">
          {/* Lista fechada: UF é o campo que mais recebe "São Paulo" por
              extenso, e a vitrine imprime o que vier. */}
          <select className="pi-entrada" value={form.estado} onChange={(e) => set("estado", e.target.value)} disabled={ocupado}>
            <option value="">—</option>
            {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
          </select>
        </Campo>

        <Campo rotulo="Logotipo" dica="Cole um endereço https ou envie um arquivo." largo>
          <div className="pi-logo">
            <span className="pi-logo__previa">
              {form.logoUrl
                ? <img src={form.logoUrl} alt="" onError={(e) => { e.currentTarget.style.opacity = 0; }} />
                : <span className="pi-logo__vazio">{(form.name || "D").charAt(0).toUpperCase()}</span>}
            </span>
            <input
              className="pi-entrada pi-logo__url"
              value={form.logoUrl}
              onChange={(e) => set("logoUrl", e.target.value.trim())}
              placeholder="https://…/logo.png"
              disabled={ocupado}
            />
            <button type="button" className="pi-botao pi-botao--fino" onClick={() => arquivoRef.current?.click()} disabled={ocupado}>
              {logoSubindo ? "Enviando…" : "Enviar"}
            </button>
            <input ref={arquivoRef} type="file" accept="image/*" onChange={enviarLogo} hidden />
          </div>
        </Campo>

        <Campo rotulo="Cor primária">
          <Cor valor={form.primaryColor} aoMudar={(v) => set("primaryColor", v)} desabilitado={ocupado} />
        </Campo>

        <Campo rotulo="Cor secundária">
          <Cor valor={form.secondaryColor} aoMudar={(v) => set("secondaryColor", v)} desabilitado={ocupado} />
        </Campo>
      </div>

      <p className="pi-nota">
        O <strong>CRECI jurídico</strong> passa a aparecer na sua vitrine e nos anúncios gerados
        aqui. A legislação brasileira exige que o número conste da publicidade imobiliária — sem
        ele, a página vai ao ar sem a identificação que a fiscalização procura.
      </p>

      {erro ? <p className="pi-erro">{erro}</p> : null}

      <div className="pi-acoes">
        <button type="button" className="pi-botao pi-botao--fantasma" onClick={aoPular} disabled={ocupado}>
          Preencher depois
        </button>
        <button type="button" className="pi-botao pi-botao--primario" onClick={salvar} disabled={ocupado}>
          {salvando ? "Salvando…" : "Salvar e começar"}
        </button>
      </div>
    </div>
  );
}

function Campo({ rotulo, dica, largo, children }) {
  return (
    <label className={`pi-campo${largo ? " pi-campo--largo" : ""}`}>
      <span className="pi-rotulo">{rotulo}</span>
      {children}
      {dica ? <span className="pi-dica">{dica}</span> : null}
    </label>
  );
}

/* Amostra clicável + hex digitável. O <input type="color"> nativo fica invisível
   por cima do quadrado: o seletor do sistema abre no clique, e quem prefere
   colar o hexadecimal da marca digita ao lado. */
function Cor({ valor, aoMudar, desabilitado }) {
  const valido = /^#[0-9a-fA-F]{6}$/.test(valor);
  return (
    <span className="pi-cor">
      <span className="pi-cor__amostra" style={{ background: valido ? valor : "#6366f1" }}>
        <input type="color" value={valido ? valor : "#6366f1"} onChange={(e) => aoMudar(e.target.value)} disabled={desabilitado} />
      </span>
      <input
        className="pi-entrada pi-cor__hex"
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        placeholder="#6366f1"
        maxLength={7}
        disabled={desabilitado}
      />
    </span>
  );
}

export const PERFIL_INICIAL_CSS = `
.pi-carregando { font-size: 13px; color: var(--bv-fraco, #94a3b8); padding: 26px 0; text-align: center; }
.pi-corpo { display: flex; flex-direction: column; gap: 16px; text-align: left; }

.pi-grade { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.pi-campo { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.pi-campo--largo { grid-column: 1 / -1; }
.pi-rotulo {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 8.5px; letter-spacing: 0.14em; text-transform: uppercase; color: #7c748f;
}
.pi-dica { font-size: 10.5px; line-height: 1.5; color: #6f6883; }

/* O styles.css global estiliza input/select por elemento; aqui o modal é escuro
   e a aparência precisa ser redefinida por inteiro. */
.bv-caixa .pi-entrada {
  width: 100%; padding: 9px 11px; border-radius: 9px;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(167,139,250,0.18);
  color: #f1edf9; font-family: inherit; font-size: 12.8px; line-height: 1.4;
  box-shadow: none; transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.bv-caixa .pi-entrada::placeholder { color: #6f6883; }
.bv-caixa .pi-entrada:focus {
  outline: none; border-color: #a78bfa; box-shadow: 0 0 0 3px rgba(139,92,246,0.16);
}
.bv-caixa .pi-entrada:disabled { opacity: 0.6; }
.bv-caixa select.pi-entrada option { background: #14121c; color: #f1edf9; }

.pi-logo { display: flex; align-items: center; gap: 9px; }
.pi-logo__previa {
  width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0; overflow: hidden;
  display: grid; place-items: center;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(167,139,250,0.18);
}
.pi-logo__previa img { width: 100%; height: 100%; object-fit: contain; }
.pi-logo__vazio { font-size: 15px; font-weight: 700; color: #a9a3ba; }
.bv-caixa .pi-logo__url { flex: 1; min-width: 0; }

.pi-cor { display: flex; align-items: center; gap: 8px; }
.pi-cor__amostra {
  position: relative; width: 38px; height: 34px; border-radius: 9px; flex-shrink: 0;
  border: 1px solid rgba(255,255,255,0.16);
}
.pi-cor__amostra input {
  position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; border: none; padding: 0;
}
.bv-caixa .pi-cor__hex { flex: 1; min-width: 0; font-family: 'JetBrains Mono', ui-monospace, monospace; }

.pi-nota {
  margin: 0; font-size: 11.5px; line-height: 1.65; color: #a9a3ba;
  padding: 10px 12px; border-radius: 10px;
  background: rgba(212,175,55,0.08); border: 1px solid rgba(212,175,55,0.22);
}
.pi-nota strong { color: #e5c158; font-weight: 650; }

.pi-erro {
  margin: 0; font-size: 12px; line-height: 1.55; color: #fca5a5;
  padding: 9px 12px; border-radius: 10px;
  background: rgba(239,68,68,0.10); border: 1px solid rgba(239,68,68,0.26);
}

.pi-acoes { display: flex; gap: 9px; justify-content: flex-end; margin-top: 2px; }
.bv-caixa .pi-botao {
  width: auto; padding: 10px 17px; border-radius: 10px; cursor: pointer;
  font-family: inherit; font-size: 12.5px; font-weight: 650;
  border: 1px solid transparent; box-shadow: none; transform: none;
  transition: background 0.15s ease, color 0.15s ease;
}
.bv-caixa .pi-botao--primario { background: #d4af37; color: #17130a; }
.bv-caixa .pi-botao--primario:hover { background: #e5c158; box-shadow: none; transform: none; }
.bv-caixa .pi-botao--fantasma { background: transparent; border-color: rgba(167,139,250,0.22); color: #a9a3ba; }
.bv-caixa .pi-botao--fantasma:hover { background: rgba(139,92,246,0.14); color: #ede9f6; box-shadow: none; transform: none; }
.bv-caixa .pi-botao--fino { padding: 8px 13px; font-size: 12px; background: rgba(139,92,246,0.18); color: #ede9f6; flex-shrink: 0; }
.bv-caixa .pi-botao--fino:hover { background: rgba(139,92,246,0.30); box-shadow: none; transform: none; }
.bv-caixa .pi-botao:disabled { opacity: 0.55; cursor: default; }

@media (max-width: 620px) {
  .pi-grade { grid-template-columns: 1fr; }
  .pi-acoes { flex-direction: column-reverse; }
  .bv-caixa .pi-acoes .pi-botao { width: 100%; }
}
`;

export default PerfilInicialPasso;
