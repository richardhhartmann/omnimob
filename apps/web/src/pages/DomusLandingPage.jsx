import { Link } from "react-router-dom";

const ACCENT = "#6366f1";
const ACCENT2 = "#818cf8";
const GOLD = "#d4af37";

const FEATURES = [
  { icon: "🏠", title: "Gestão de imóveis", desc: "Cadastre imóveis com fotos, atributos, tipos e status. Tudo organizado e pronto para divulgar." },
  { icon: "🎨", title: "Vitrine personalizável", desc: "Um editor visual de arrastar e soltar para montar a página pública da sua imobiliária, do seu jeito." },
  { icon: "📈", title: "Leads e métricas", desc: "Capture interessados pela vitrine e acompanhe visualizações, leads e vendas por imóvel." },
  { icon: "📣", title: "Publicação em redes", desc: "Divulgue imóveis no Facebook, Instagram e WhatsApp com legenda pronta em poucos cliques." },
  { icon: "👥", title: "Usuários e permissões", desc: "Crie cargos com permissões granulares para corretores, marketing, gerência e mais." },
  { icon: "🔒", title: "Multi-tenant seguro", desc: "Cada imobiliária com seus próprios dados, usuários e vitrine — isolados e seguros." },
];

const STEPS = [
  { n: "1", title: "Cadastre sua imobiliária", desc: "Em minutos você tem seu ambiente pronto, com vitrine e painel administrativo." },
  { n: "2", title: "Adicione seus imóveis", desc: "Suba fotos, defina atributos e publique. A vitrine atualiza automaticamente." },
  { n: "3", title: "Atraia e converta", desc: "Compartilhe sua vitrine, receba leads e acompanhe os resultados em tempo real." },
];

const PLANS = [
  { name: "Essencial", price: "R$ 99", per: "/mês", desc: "Para quem está começando.", features: ["Até 50 imóveis", "Vitrine personalizável", "Captura de leads", "1 usuário"], highlight: false },
  { name: "Profissional", price: "R$ 199", per: "/mês", desc: "Para imobiliárias em crescimento.", features: ["Imóveis ilimitados", "Publicação em redes sociais", "Usuários e permissões", "Métricas e relatórios"], highlight: true },
  { name: "Enterprise", price: "Sob consulta", per: "", desc: "Para grandes operações.", features: ["Tudo do Profissional", "Suporte dedicado", "Domínio próprio", "Onboarding assistido"], highlight: false },
];

export function DomusLandingPage() {
  const navLink = { color: "rgba(255,255,255,0.75)", textDecoration: "none", fontSize: "14px", fontWeight: 500 };
  const ctaPrimary = { display: "inline-block", padding: "14px 28px", borderRadius: "12px", background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`, color: "#fff", fontWeight: 700, fontSize: "15px", textDecoration: "none", boxShadow: `0 10px 30px ${ACCENT}55`, border: "none", cursor: "pointer" };
  const ctaGhost = { display: "inline-block", padding: "14px 28px", borderRadius: "12px", background: "transparent", color: "#fff", fontWeight: 600, fontSize: "15px", textDecoration: "none", border: "1px solid rgba(255,255,255,0.2)" };

  return (
    <div style={{ background: "#0b1020", color: "#f8fafc", fontFamily: "'Inter', system-ui, sans-serif", overflowX: "hidden" }}>
      <style>{`
        .domus-section { max-width: 1140px; margin: 0 auto; padding: 0 24px; }
        .domus-feature:hover { transform: translateY(-6px); border-color: rgba(129,140,248,0.4); }
        .domus-plan:hover { transform: translateY(-6px); }
        @keyframes domusFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
      `}</style>

      {/* ── Nav ── */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(11,16,32,0.8)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="domus-section" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: "68px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "34px", height: "34px", borderRadius: "9px", background: `linear-gradient(135deg, ${GOLD}, ${ACCENT})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>D</div>
            <span style={{ fontSize: "18px", fontWeight: 800, letterSpacing: "-0.02em" }}>Domus</span>
          </div>
          <nav style={{ display: "flex", alignItems: "center", gap: "28px" }}>
            <a href="#recursos" style={navLink}>Recursos</a>
            <a href="#como-funciona" style={navLink}>Como funciona</a>
            <a href="#planos" style={navLink}>Planos</a>
            <Link to="/login" style={navLink}>Entrar</Link>
            <a href="#contato" style={{ ...ctaPrimary, padding: "10px 20px", fontSize: "14px" }}>Começar agora</a>
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section style={{ position: "relative", padding: "90px 0 80px", background: "radial-gradient(900px 500px at 70% -10%, rgba(99,102,241,0.25), transparent), radial-gradient(700px 400px at 10% 10%, rgba(212,175,55,0.10), transparent)" }}>
        <div className="domus-section" style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "48px", alignItems: "center" }}>
          <div>
            <span style={{ display: "inline-block", padding: "6px 14px", borderRadius: "999px", background: "rgba(129,140,248,0.15)", border: "1px solid rgba(129,140,248,0.3)", color: ACCENT2, fontSize: "13px", fontWeight: 600, marginBottom: "20px" }}>
              A plataforma completa para imobiliárias
            </span>
            <h1 style={{ fontSize: "52px", lineHeight: 1.07, fontWeight: 800, letterSpacing: "-0.03em", margin: 0 }}>
              Gestão imobiliária e <span style={{ background: `linear-gradient(135deg, ${ACCENT2}, ${GOLD})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>vitrine digital</span> num só lugar
            </h1>
            <p style={{ fontSize: "18px", color: "rgba(255,255,255,0.7)", lineHeight: 1.6, margin: "22px 0 32px", maxWidth: "520px" }}>
              Cadastre imóveis, monte uma vitrine impecável, capture leads e divulgue nas redes — tudo num painel pensado para quem vende imóveis.
            </p>
            <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
              <a href="#contato" style={ctaPrimary}>Agendar demonstração</a>
              <a href="#recursos" style={ctaGhost}>Ver recursos</a>
            </div>
            <div style={{ display: "flex", gap: "28px", marginTop: "40px", flexWrap: "wrap" }}>
              {[["+1.200", "imóveis publicados"], ["98%", "satisfação"], ["24/7", "vitrine no ar"]].map(([n, l]) => (
                <div key={l}>
                  <div style={{ fontSize: "26px", fontWeight: 800 }}>{n}</div>
                  <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)" }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Mock visual do painel */}
          <div style={{ animation: "domusFloat 6s ease-in-out infinite" }}>
            <div style={{ borderRadius: "20px", border: "1px solid rgba(255,255,255,0.1)", background: "linear-gradient(160deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))", boxShadow: "0 40px 80px rgba(0,0,0,0.5)", overflow: "hidden" }}>
              <div style={{ display: "flex", gap: "6px", padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#f87171" }} />
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#fbbf24" }} />
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#4ade80" }} />
              </div>
              <div style={{ padding: "18px", display: "grid", gap: "12px" }}>
                <div style={{ height: "14px", width: "45%", borderRadius: "6px", background: "rgba(255,255,255,0.18)" }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} style={{ borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", padding: "12px" }}>
                      <div style={{ height: "60px", borderRadius: "8px", background: `linear-gradient(135deg, ${ACCENT}40, ${GOLD}30)`, marginBottom: "10px" }} />
                      <div style={{ height: "8px", width: "70%", borderRadius: "4px", background: "rgba(255,255,255,0.2)", marginBottom: "6px" }} />
                      <div style={{ height: "8px", width: "40%", borderRadius: "4px", background: "rgba(255,255,255,0.12)" }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Recursos ── */}
      <section id="recursos" style={{ padding: "80px 0" }}>
        <div className="domus-section">
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <h2 style={{ fontSize: "36px", fontWeight: 800, letterSpacing: "-0.02em", margin: 0 }}>Tudo que sua imobiliária precisa</h2>
            <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "17px", marginTop: "12px" }}>Um sistema, do cadastro à conversão.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
            {FEATURES.map((f) => (
              <div key={f.title} className="domus-feature" style={{ padding: "28px", borderRadius: "18px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", transition: "transform 0.3s ease, border-color 0.3s ease" }}>
                <div style={{ fontSize: "30px", marginBottom: "14px" }}>{f.icon}</div>
                <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 8px" }}>{f.title}</h3>
                <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "14px", lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Como funciona ── */}
      <section id="como-funciona" style={{ padding: "80px 0", background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="domus-section">
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <h2 style={{ fontSize: "36px", fontWeight: 800, letterSpacing: "-0.02em", margin: 0 }}>Comece em 3 passos</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "24px" }}>
            {STEPS.map((s) => (
              <div key={s.n} style={{ textAlign: "center", padding: "24px" }}>
                <div style={{ width: "56px", height: "56px", borderRadius: "16px", margin: "0 auto 18px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", fontWeight: 800, background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`, boxShadow: `0 10px 24px ${ACCENT}55` }}>{s.n}</div>
                <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 8px" }}>{s.title}</h3>
                <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "14px", lineHeight: 1.6, margin: 0 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Planos ── */}
      <section id="planos" style={{ padding: "80px 0" }}>
        <div className="domus-section">
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <h2 style={{ fontSize: "36px", fontWeight: 800, letterSpacing: "-0.02em", margin: 0 }}>Planos para cada momento</h2>
            <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "17px", marginTop: "12px" }}>Sem fidelidade. Cancele quando quiser.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", alignItems: "stretch" }}>
            {PLANS.map((p) => (
              <div key={p.name} className="domus-plan" style={{ padding: "32px", borderRadius: "20px", border: p.highlight ? `1px solid ${ACCENT2}` : "1px solid rgba(255,255,255,0.08)", background: p.highlight ? "linear-gradient(160deg, rgba(99,102,241,0.18), rgba(255,255,255,0.02))" : "rgba(255,255,255,0.02)", transition: "transform 0.3s ease", position: "relative", display: "flex", flexDirection: "column" }}>
                {p.highlight ? <span style={{ position: "absolute", top: "-12px", left: "50%", transform: "translateX(-50%)", padding: "4px 14px", borderRadius: "999px", background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`, fontSize: "12px", fontWeight: 700 }}>Mais popular</span> : null}
                <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 6px" }}>{p.name}</h3>
                <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px", margin: "0 0 18px" }}>{p.desc}</p>
                <div style={{ marginBottom: "20px" }}>
                  <span style={{ fontSize: "34px", fontWeight: 800 }}>{p.price}</span>
                  <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "15px" }}>{p.per}</span>
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "grid", gap: "10px", flex: 1 }}>
                  {p.features.map((f) => (
                    <li key={f} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "rgba(255,255,255,0.8)" }}>
                      <span style={{ color: "#4ade80", fontWeight: 800 }}>✓</span> {f}
                    </li>
                  ))}
                </ul>
                <a href="#contato" style={{ ...(p.highlight ? ctaPrimary : ctaGhost), textAlign: "center", width: "100%", boxSizing: "border-box" }}>Quero este</a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section id="contato" style={{ padding: "90px 0" }}>
        <div className="domus-section">
          <div style={{ borderRadius: "28px", padding: "60px 40px", textAlign: "center", background: `linear-gradient(135deg, ${ACCENT}, #4f46e5)`, boxShadow: `0 40px 90px ${ACCENT}44` }}>
            <h2 style={{ fontSize: "38px", fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 14px" }}>Pronto para vender mais imóveis?</h2>
            <p style={{ fontSize: "18px", color: "rgba(255,255,255,0.85)", margin: "0 0 28px" }}>Fale com a nossa equipe e veja a Domus funcionando na prática.</p>
            <div style={{ display: "flex", gap: "14px", justifyContent: "center", flexWrap: "wrap" }}>
              <a href="https://wa.me/" target="_blank" rel="noreferrer" style={{ ...ctaPrimary, background: "#fff", color: ACCENT }}>Falar no WhatsApp</a>
              <a href="mailto:contato@domus.com" style={{ ...ctaGhost, borderColor: "rgba(255,255,255,0.6)" }}>Enviar e-mail</a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "40px 0" }}>
        <div className="domus-section" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: `linear-gradient(135deg, ${GOLD}, ${ACCENT})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "14px" }}>D</div>
            <span style={{ fontWeight: 700 }}>Domus</span>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px", marginLeft: "8px" }}>© {new Date().getFullYear()}</span>
          </div>
          <div style={{ display: "flex", gap: "22px", alignItems: "center" }}>
            <Link to="/login" style={navLink}>Acesso do cliente</Link>
            <Link to="/admin/login" style={{ ...navLink, color: "rgba(255,255,255,0.45)" }}>Área administrativa</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
