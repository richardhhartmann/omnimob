import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { transform } from "esbuild";

/* Carregador mínimo para rodar os componentes da vitrine sob `node --test`.

   Duas coisas separam o código do app do Node puro: os imports sem extensão
   (que o Vite resolve e o Node ESM não) e a sintaxe JSX. O esbuild já está aqui
   como dependência do próprio Vite, então isto não acrescenta nada ao projeto —
   é ferramenta de teste, não de produção. */

const EXTENSOES = [".js", ".jsx", "/index.js", "/index.jsx"];

export async function resolve(especificador, contexto, proximo) {
  try {
    return await proximo(especificador, contexto);
  } catch (erro) {
    if (!especificador.startsWith(".")) throw erro;
    for (const ext of EXTENSOES) {
      try {
        return await proximo(especificador + ext, contexto);
      } catch {}
    }
    throw erro;
  }
}

export async function load(url, contexto, proximo) {
  if (!url.endsWith(".jsx")) return proximo(url, contexto);
  const fonte = await readFile(fileURLToPath(url), "utf8");
  const { code } = await transform(fonte, { loader: "jsx", format: "esm", jsx: "automatic" });
  return { format: "module", source: code, shortCircuit: true };
}
