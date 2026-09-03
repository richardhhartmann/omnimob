import { useEffect, useState } from "react";
import { adminApi } from "../../api";
import { Alert, Button, Eyebrow, Reveal } from "../../styles/omnimobKit";

/* ────────────────────────────────────────────────────────────────────────────
   Segurança da conta de super-admin.

   Uma coisa só por enquanto: ligar e desligar o aplicativo autenticador.

   ── O CADASTRO TEM TRÊS ESTADOS, E ELES IMPORTAM ──

     desligado  entra só com a senha.
     pendente   a chave existe no banco, o aplicativo pode já tê-la lido, mas o
                login AINDA não pede código.
     ativo      o login pede código.

   O estado do meio existe de propósito. Ativar no mesmo instante em que a chave
   é gerada é a forma exata de se trancar para fora: bastaria fechar a aba antes
   de escanear para o login passar a exigir um código que nenhum aplicativo
   consegue gerar. Só o código digitado prova que a chave chegou ao celular.

   ── POR QUE CHAVE DIGITADA E NÃO QR ──

   Um QR exige um codificador — e nenhuma das bibliotecas de QR está no projeto.
   Entrada manual ("inserir chave de configuração") existe em todo aplicativo
   autenticador e não custa dependência nenhuma. O `otpauth://` fica ao lado
   para quem abrir esta tela no próprio celular: ali ele é um link que o
   aplicativo entende, e o QR seria o caminho mais longo.
   ──────────────────────────────────────────────────────────────────────────── */

export function AdminSegurancaPage() {
  const [situacao, setSituacao] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");

  // Cadastro em andamento: o que a rota de iniciar devolveu, que só existe aqui.
  const [cadastro, setCadastro] = useState(null);
  const [codigo, setCodigo] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Os códigos de recuperação, mostrados UMA vez logo depois de ativar.
  const [codigosNovos, setCodigosNovos] = useState(null);

  // Desligar pede senha e código; o formulário só aparece quando pedido.
  const [desligando, setDesligando] = useState(false);
  const [senha, setSenha] = useState("");
  const [codigoDesligar, setCodigoDesligar] = useState("");

  async function carregar() {
    setCarregando(true);
    try {
      setSituacao(await adminApi.totpSituacao());
    } catch (e) {
      setErro(e.message || "Não consegui ler a situação do segundo fator.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  async function iniciar() {
    setErro(""); setOk(""); setSalvando(true);
    try {
      setCadastro(await adminApi.totpIniciar());
      setCodigo("");
    } catch (e) {
      setErro(e.message || "Não consegui gerar a chave.");
    } finally {
      setSalvando(false);
    }
  }

  async function confirmar(e) {
    e.preventDefault();
    setErro(""); setSalvando(true);
    try {
      const res = await adminApi.totpConfirmar(codigo);
      setCadastro(null);
      setCodigo("");
      setCodigosNovos(res.codigos || []);
      setOk("Segundo fator ativado. A partir do próximo login o código será pedido.");
      await carregar();
    } catch (e2) {
      setErro(e2.message || "Código inválido.");
    } finally {
      setSalvando(false);
    }
  }

  async function desligar(e) {
    e.preventDefault();
    setErro(""); setSalvando(true);
    try {
      await adminApi.totpDesativar(senha, codigoDesligar);
      setDesligando(false);
      setSenha(""); setCodigoDesligar("");
      setCodigosNovos(null);
      setOk("Segundo fator desativado. O login voltou a pedir só a senha.");
      await carregar();
    } catch (e2) {
      setErro(e2.message || "Não consegui desativar.");
    } finally {
      setSalvando(false);
    }
  }

  function copiar(texto) {
    navigator.clipboard?.writeText(texto).then(
      () => setOk("Copiado."),
      () => setErro("O navegador não deixou copiar. Selecione e copie à mão."),
    );
  }

  if (carregando) return <p className="seg-carregando">Carregando…</p>;

  const ativo = situacao?.ativo;
  const poucosCodigos = ativo && situacao.codigosRestantes <= 2;

  return (
    <Reveal className="seg-raiz">
      <header className="seg-cabeca">
        <Eyebrow>SEGURANÇA DA CONTA</Eyebrow>
        <h2 className="seg-titulo">Verificação em duas etapas</h2>
        <p className="seg-lead">
          A senha desta conta já é guardada em hash — o que hash não resolve é a senha certa nas
          mãos erradas. Quem entra aqui vê todas as imobiliárias, entra na conta de qualquer
          cliente e mexe em cobrança: é a única porta do produto que abre tudo de uma vez.
        </p>
      </header>

      {erro ? <Alert tone="danger">{erro}</Alert> : null}
      {ok ? <Alert tone="info">{ok}</Alert> : null}

      <div className="seg-estado">
        <span className={`seg-selo ${ativo ? "seg-selo--on" : "seg-selo--off"}`}>
          {ativo ? "Ativo" : "Desligado"}
        </span>
        <span className="seg-estado__texto">
          {ativo
            ? `Ligado em ${new Date(situacao.ativadoEm).toLocaleDateString("pt-BR")} · ${situacao.codigosRestantes} código(s) de recuperação restante(s)`
            : "O login pede só e-mail e senha."}
        </span>
      </div>

      {poucosCodigos ? (
        <Alert tone="danger">
          Restam {situacao.codigosRestantes} códigos de recuperação. Desative e ative o segundo
          fator para gerar uma lista nova antes que acabem — sem eles, perder o celular significa
          perder o acesso à plataforma.
        </Alert>
      ) : null}

      {/* ── Os códigos de recuperação, mostrados uma vez ──────────────────────
          Fica antes de tudo porque é a única chance de copiá-los: o banco só
          guarda o hash, e nem o servidor consegue lê-los de volta. */}
      {codigosNovos ? (
        <section className="seg-bloco seg-bloco--destaque">
          <h3>Guarde estes códigos agora</h3>
          <p className="seg-nota">
            Eles substituem o celular quando você não o tiver. Cada um funciona <strong>uma vez</strong>,
            e esta é a <strong>única</strong> vez que aparecem — o servidor guarda só o hash deles.
          </p>
          <ul className="seg-codigos">
            {codigosNovos.map((c) => <li key={c} className="dl-mono">{c}</li>)}
          </ul>
          <div className="seg-acoes">
            <Button as="button" type="button" variant="ghost" arrow={false} onClick={() => copiar(codigosNovos.join("\n"))}>
              Copiar todos
            </Button>
            <Button as="button" type="button" variant="outline" arrow={false} onClick={() => setCodigosNovos(null)}>
              Já guardei
            </Button>
          </div>
        </section>
      ) : null}

      {/* ── Ligar ─────────────────────────────────────────────────────────── */}
      {!ativo && !cadastro ? (
        <section className="seg-bloco">
          <h3>Ligar o aplicativo autenticador</h3>
          <p className="seg-nota">
            Serve qualquer aplicativo de TOTP — Google Authenticator, Authy, 1Password, Microsoft
            Authenticator, o gerenciador de senhas que você já usa.
            {situacao?.pendente ? " Há um cadastro começado e não confirmado; começar de novo descarta a chave anterior." : ""}
          </p>
          <Button as="button" type="button" variant="accent" onClick={iniciar} disabled={salvando}>
            {salvando ? "Gerando…" : "Gerar chave"}
          </Button>
        </section>
      ) : null}

      {cadastro ? (
        <section className="seg-bloco">
          <h3>Cadastre a chave e confirme</h3>
          <ol className="seg-passos">
            <li>
              No aplicativo, escolha <strong>inserir chave de configuração</strong> e cole:
              <code className="seg-chave dl-mono">{cadastro.segredoFormatado}</code>
              <div className="seg-acoes">
                <Button as="button" type="button" variant="ghost" arrow={false} onClick={() => copiar(cadastro.segredo)}>
                  Copiar chave
                </Button>
                {/* Só faz sentido em quem abriu esta tela no próprio celular; no
                    desktop o link não tem para onde ir, e por isso ele é
                    discreto e não um botão principal. */}
                <a className="seg-link dl-mono" href={cadastro.uri}>abrir no aplicativo deste aparelho</a>
              </div>
            </li>
            <li>O tipo é <strong>baseado em tempo</strong>, seis dígitos.</li>
            <li>Digite abaixo o código que aparecer, para provar que a chave chegou lá.</li>
          </ol>

          <form className="seg-form" onSubmit={confirmar}>
            <input
              className="dl-input seg-input-codigo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="000000"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              disabled={salvando}
            />
            <Button as="button" type="submit" variant="accent" disabled={salvando}>
              {salvando ? "Conferindo…" : "Confirmar e ativar"}
            </Button>
            <Button as="button" type="button" variant="outline" arrow={false} onClick={() => setCadastro(null)} disabled={salvando}>
              Cancelar
            </Button>
          </form>
          <p className="seg-nota">
            Enquanto você não confirmar, o login continua entrando só com a senha — ninguém fica
            trancado do lado de fora por fechar esta aba no meio.
          </p>
        </section>
      ) : null}

      {/* ── Desligar ──────────────────────────────────────────────────────── */}
      {ativo ? (
        <section className="seg-bloco">
          <h3>Desligar</h3>
          <p className="seg-nota">
            Pede a senha <strong>e</strong> um código válido. Só a senha não serviria: senha nas mãos
            erradas é exatamente o que o segundo fator existe para conter.
          </p>
          {desligando ? (
            <form className="seg-form" onSubmit={desligar}>
              <input
                className="dl-input"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Sua senha"
                autoComplete="current-password"
                required
                disabled={salvando}
              />
              <input
                className="dl-input seg-input-codigo"
                value={codigoDesligar}
                onChange={(e) => setCodigoDesligar(e.target.value)}
                placeholder="000000"
                autoComplete="one-time-code"
                maxLength={11}
                required
                disabled={salvando}
              />
              <Button as="button" type="submit" variant="danger" arrow={false} disabled={salvando}>
                {salvando ? "Desativando…" : "Desativar"}
              </Button>
              <Button as="button" type="button" variant="outline" arrow={false} onClick={() => setDesligando(false)} disabled={salvando}>
                Cancelar
              </Button>
            </form>
          ) : (
            <Button as="button" type="button" variant="outline" arrow={false} onClick={() => setDesligando(true)}>
              Desligar segundo fator
            </Button>
          )}
        </section>
      ) : null}
    </Reveal>
  );
}

export const SEGURANCA_CSS = `
.seg-carregando { color: var(--subtle); font-size: 13.5px; }
.seg-raiz { display: grid; gap: 18px; max-width: 720px; }
.seg-cabeca { display: grid; gap: 8px; }
.seg-titulo { font-size: 22px; font-weight: 800; letter-spacing: -0.03em; color: var(--strong); margin: 6px 0 0; }
.seg-lead { font-size: 13.5px; line-height: 1.75; color: var(--subtle); margin: 0; }

.seg-estado { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.seg-selo {
  display: inline-flex; align-items: center; padding: 4px 12px; border-radius: 999px;
  font-size: 11px; font-weight: 700; letter-spacing: 0.04em; border: 1px solid transparent;
}
.seg-selo--on { color: #6ee7b7; background: rgba(52,211,153,0.12); border-color: rgba(52,211,153,0.30); }
.seg-selo--off { color: #fbbf24; background: rgba(251,191,36,0.10); border-color: rgba(251,191,36,0.28); }
.seg-estado__texto { font-size: 12.5px; color: var(--subtle); }

.seg-bloco {
  background: var(--surface); border: 1px solid var(--line);
  border-radius: 16px; padding: 20px 22px; display: grid; gap: 12px;
}
.seg-bloco--destaque { border-color: rgba(129,140,248,0.38); background: rgba(99,102,241,0.07); }
.seg-bloco h3 { margin: 0; font-size: 15px; font-weight: 700; letter-spacing: -0.02em; color: var(--strong); }
.seg-nota { margin: 0; font-size: 12.5px; line-height: 1.7; color: var(--subtle); }
.seg-nota strong { color: var(--strong); }

.seg-passos { margin: 0; padding-left: 18px; display: grid; gap: 12px; list-style: decimal; }
.seg-passos li { font-size: 13px; line-height: 1.7; color: var(--subtle); }
.seg-passos strong { color: var(--strong); }

.seg-chave {
  display: block; margin-top: 8px; padding: 12px 14px; border-radius: 10px;
  background: rgba(0,0,0,0.30); border: 1px solid var(--line);
  color: var(--strong); font-size: 15px; letter-spacing: 0.14em;
  text-transform: none; word-break: break-all; user-select: all;
}

.seg-acoes { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 10px; }
.seg-link { font-size: 10px; color: var(--accent-soft); text-transform: none; letter-spacing: 0.04em; }
.seg-link:hover { text-decoration: underline; }

.seg-form { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.seg-form .dl-input { width: auto; min-width: 190px; }
.seg-form .seg-input-codigo {
  min-width: 150px; max-width: 190px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  letter-spacing: 0.22em; text-align: center;
}

.seg-codigos {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px;
  margin: 0; padding: 0; list-style: none;
}
.seg-codigos li {
  padding: 9px 12px; border-radius: 9px; text-align: center;
  background: rgba(0,0,0,0.28); border: 1px solid var(--line);
  color: var(--strong); font-size: 13px; letter-spacing: 0.10em;
  text-transform: none; user-select: all;
}

@media (max-width: 640px) {
  .seg-codigos { grid-template-columns: 1fr; }
  .seg-form .dl-input { width: 100%; max-width: none; }
}
`;
