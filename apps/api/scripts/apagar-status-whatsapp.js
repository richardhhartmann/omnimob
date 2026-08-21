import "dotenv/config";
import { prisma } from "../src/db.js";
import { decifrar } from "../src/services/cofre.js";

/**
 * ─── Apagar status publicados pela ponte ─────────────────────────────────────
 *
 *   node scripts/apagar-status-whatsapp.js --slug=x                 → lista
 *   node scripts/apagar-status-whatsapp.js --url=… --token=…        → lista
 *   node scripts/apagar-status-whatsapp.js … --apagar               → apaga TODOS
 *   node scripts/apagar-status-whatsapp.js … --apagar --id=ABC123   → apaga um
 *
 * ── POR QUE PRECISOU EXISTIR ──
 *
 * O produto NÃO GUARDA o id da mensagem que a ponte devolve: ele é lido só para
 * dizer "deu certo" e descartado. Sem id não há o que apagar — por isso o script
 * começa perguntando à ponte o que existe.
 *
 * ── O QUE ELE NÃO GARANTE ──
 *
 * A exclusão é ACEITA na hora (`success: true`) e ENTREGUE depois: ela entra na
 * fila da sessão como uma mensagem `action: delete` com status `pending`. Com o
 * canal fora de sincronia ela fica ali — respondida com sucesso e sem efeito
 * nenhum para os contatos. Por isso o script confere a FILA no fim, em vez de
 * confiar no 200.
 *
 * E nada disso alcança quem já ABRIU o status: a mídia foi baixada. A revogação
 * tira do servidor e dos aparelhos que sincronizarem depois. É limite do
 * WhatsApp, e é a razão pela qual "quem vê" precisa estar certo ANTES.
 */

const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=");
const tem = (n) => process.argv.includes(`--${n}`);

/* `status@broadcast` é o nome interno no WhatsApp, e foi o que tentei primeiro:
   o Whapi recusa com 400, porque o parâmetro de chat dele só aceita `0@c.us`,
   `0@s.whatsapp.net` ou um número. Stories têm rota própria. */
const ROTA_STORIES = "/stories?count=100";

async function encerrar(codigo = 0) {
  await prisma.$disconnect().catch(() => {});
  process.exitCode = codigo;
}

let base = arg("url");
let token = arg("token");
const slug = arg("slug");

if (slug && (!base || !token)) {
  const t = await prisma.tenant.findUnique({
    where: { slug },
    select: { whatsappPonteUrl: true, whatsappPonteToken: true },
  });
  if (!t?.whatsappPonteUrl || !t?.whatsappPonteToken) {
    console.error(`A imobiliária "${slug}" não tem ponte configurada neste banco.`);
    console.error("Passe --url= e --token= à mão (o token está no painel da ponte).");
    await encerrar(1);
  } else {
    base = t.whatsappPonteUrl;
    token = decifrar(t.whatsappPonteToken);
  }
}

if (!base || !token) {
  if (process.exitCode !== 1) console.error("Faltou --slug= ou o par --url= e --token=.");
  await encerrar(1);
} else {
  // A pessoa pode ter guardado a URL de envio inteira; o que interessa é a raiz.
  const raiz = new URL(base).origin;

  const chamar = async (caminho, metodo = "GET") => {
    const r = await fetch(`${raiz}${caminho}`, {
      method: metodo,
      headers: { Authorization: `Bearer ${token}`, apikey: token, Accept: "application/json" },
    });
    const texto = await r.text().catch(() => "");
    let corpo = null;
    try { corpo = JSON.parse(texto); } catch { corpo = null; }
    return { status: r.status, ok: r.ok, corpo, texto };
  };

  console.log(`\nPonte: ${raiz}`);
  console.log("Procurando os seus stories…\n");

  const lista = await chamar(ROTA_STORIES);

  if (!lista.ok) {
    console.error(`A ponte respondeu ${lista.status}.`);
    console.error(lista.texto.slice(0, 800));
    await encerrar(1);
  } else {
    /* Só os SEUS: a lista traz também os stories de quem você segue, e status de
       terceiro não é seu para apagar.

       E só os que NÃO são ação: a revogação vira uma mensagem nesta mesma lista,
       com `action.type = "delete"` apontando para o alvo. Sem o segundo filtro,
       uma segunda passada tentaria apagar as exclusões da primeira. */
    const meus = (lista.corpo?.messages || [])
      .filter((m) => m.from_me && !m.action);

    if (meus.length === 0) {
      console.log("Nenhum status seu na lista.");
      await encerrar(0);
    } else {
      console.log(`${meus.length} status seu(s):\n`);
      for (const m of meus) {
        const quando = m.timestamp ? new Date(m.timestamp * 1000).toLocaleString("pt-BR") : "—";
        console.log(`  ${String(m.id).padEnd(26)} ${quando}  ${m.type || ""}  (${m.source || "?"})`);
      }

      if (!tem("apagar")) {
        console.log("\nEnsaio — nada foi apagado.");
        console.log("Rode de novo com --apagar (ou --apagar --id=<id> para um só).\n");
        await encerrar(0);
      } else {
        const escolhido = arg("id");
        const alvos = escolhido ? meus.filter((m) => String(m.id) === escolhido) : meus;

        if (!alvos.length) {
          console.error(`\nNão achei o id "${escolhido}" na lista acima.`);
          await encerrar(1);
        } else {
          console.log(`\nApagando ${alvos.length}…\n`);
          let apagados = 0;
          for (const m of alvos) {
            // eslint-disable-next-line no-await-in-loop
            const r = await chamar(`/messages/${encodeURIComponent(m.id)}`, "DELETE");
            if (r.ok) { apagados += 1; console.log(`  aceito   ${m.id}`); }
            else console.log(`  FALHOU   ${m.id}  (${r.status}) ${r.texto.slice(0, 160)}`);
          }
          console.log(`\n${apagados} de ${alvos.length} aceitos pela ponte.`);

          // "Aceito" não é "entregue". Ver o cabeçalho.
          const conferencia = await chamar(ROTA_STORIES);
          const pendentes = (conferencia.corpo?.messages || [])
            .filter((m) => m.from_me && m.action?.type === "delete" && m.status === "pending");

          if (pendentes.length) {
            console.log(`\n!  ${pendentes.length} exclusão(ões) na FILA, ainda não entregues.`);
            console.log("   Reconecte o canal no painel da ponte para a fila escoar.");
          } else {
            console.log("\nA fila de exclusões escoou.");
          }
          console.log("Quem já tinha ABERTO o status manteve a cópia baixada.\n");
          await encerrar(0);
        }
      }
    }
  }
}
