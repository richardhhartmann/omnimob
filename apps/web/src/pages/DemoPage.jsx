import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { OmnimobStyles } from "../styles/omnimobKit";

/* ────────────────────────────────────────────────────────────────────────────
   /demo — a porta do "ver por dentro" da landing.

   Abre uma sessão de DEMONSTRAÇÃO (ver `POST /api/auth/demo`) e leva ao
   painel. A sessão vem marcada com `demo: true`, e é essa marca que faz o
   painel trocar o convite do tour pelo tour obrigatório, esconder o assistente
   de boas-vindas e mostrar a faixa "nada é salvo". Quem trava a escrita é o
   servidor, pelo escopo do token — a página só entra.

   ── SÓ NO DESKTOP ──
   O tour guiado não roda abaixo de 900px (o holofote não tem para onde
   apontar com a barra virada gaveta — ver LARGURA_MINIMA em
   PrimeiroAcessoTour). Uma demonstração que promete o tour e cai num painel
   sem ele seria pior que não abrir: aqui a tela estreita recebe o recado e a
   saída para o teste grátis, que funciona em qualquer tela.
   ──────────────────────────────────────────────────────────────────────────── */

const LARGURA_MINIMA = 900;

export function DemoPage({ onLogin }) {
  const navegar = useNavigate();
  const [estado, setEstado] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < LARGURA_MINIMA ? "estreito" : "entrando",
  );
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (estado !== "entrando") return undefined;
    let vivo = true;
    api.entrarDemo()
      .then((sessao) => {
        if (!vivo) return;
        onLogin?.({ ...sessao, demo: true });
        navegar("/inicio", { replace: true });
      })
      .catch((e) => {
        if (!vivo) return;
        setErro(e?.message || "Não consegui abrir a demonstração agora.");
        setEstado("erro");
      });
    return () => { vivo = false; };
  }, [estado, onLogin, navegar]);

  return (
    <div className="demo-pagina">
      <OmnimobStyles extra={CSS} />
      <div className="demo-caixa">
        {estado === "entrando" ? (
          <>
            <span className="demo-giro" aria-hidden="true" />
            <h1>Preparando a demonstração…</h1>
            <p>Você vai entrar no painel de uma imobiliária de exemplo, com um tour guiado. Nada do que você fizer lá é salvo.</p>
          </>
        ) : estado === "estreito" ? (
          <>
            <h1>A demonstração guiada é para telas maiores</h1>
            <p>
              O tour aponta para os cantos do painel, e num celular ele não tem para onde apontar.
              Abra este mesmo endereço num computador — ou crie seu teste grátis, que funciona em
              qualquer tela.
            </p>
            <div className="demo-acoes">
              <Link className="demo-botao" to="/?teste=1">Criar meu teste grátis</Link>
              <Link className="demo-link" to="/">Voltar</Link>
            </div>
          </>
        ) : (
          <>
            <h1>A demonstração não está disponível agora</h1>
            <p>{erro}</p>
            <div className="demo-acoes">
              <Link className="demo-botao" to="/?teste=1">Criar meu teste grátis</Link>
              <Link className="demo-link" to="/">Voltar</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const CSS = `
.demo-pagina {
  min-height: 100vh; display: grid; place-items: center; padding: 24px;
  background: #0a0a0b; color: #f4f4f7;
  font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;
}
.demo-caixa {
  width: min(520px, 100%); text-align: center; display: grid; justify-items: center; gap: 14px;
  padding: 36px 32px; border-radius: 22px;
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.09);
}
.demo-caixa h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.25; }
.demo-caixa p { margin: 0; font-size: 14px; line-height: 1.7; color: #9b9ba6; }
.demo-giro {
  width: 22px; height: 22px; border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.16); border-top-color: #818cf8;
  animation: demo-giro 0.8s linear infinite;
}
@keyframes demo-giro { to { transform: rotate(360deg); } }
.demo-acoes { display: flex; flex-direction: column; align-items: center; gap: 10px; margin-top: 8px; }
.demo-botao {
  display: inline-flex; align-items: center; padding: 11px 22px; border-radius: 999px;
  background: #f1f5f9; color: #0c0f1a; font-size: 13.5px; font-weight: 600; text-decoration: none;
}
.demo-botao:hover { background: #fff; }
.demo-link { font-size: 13px; color: #9b9ba6; text-decoration: none; }
.demo-link:hover { color: #f4f4f7; }
@media (prefers-reduced-motion: reduce) { .demo-giro { animation-duration: 2.4s; } }
`;

export default DemoPage;
