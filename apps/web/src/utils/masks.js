// Máscaras de input (formatação em tempo real). Todas trabalham a partir dos
// dígitos digitados e são idempotentes — podem ser aplicadas a cada onChange.

export function onlyDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

// CPF: 000.000.000-00
export function formatCpf(value) {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length > 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length > 6) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  if (d.length > 3) return `${d.slice(0, 3)}.${d.slice(3)}`;
  return d;
}

// RG: 00.000.000-0 (o dígito verificador pode ser número ou X)
export function formatRg(value) {
  const raw = String(value ?? "").toUpperCase().replace(/[^0-9X]/g, "").slice(0, 9);
  if (raw.length > 8) return `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}-${raw.slice(8)}`;
  if (raw.length > 5) return `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5)}`;
  if (raw.length > 2) return `${raw.slice(0, 2)}.${raw.slice(2)}`;
  return raw;
}

// Telefone/WhatsApp: (00) 0000-0000 (fixo) ou (00) 00000-0000 (celular)
export function formatPhone(value) {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// CEP: 00000-000
export function formatCep(value) {
  const d = onlyDigits(value).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

// CNPJ: 00.000.000/0000-00
export function formatCnpj(value) {
  const d = onlyDigits(value).slice(0, 14);
  if (d.length > 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  if (d.length > 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  if (d.length > 5) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length > 2) return `${d.slice(0, 2)}.${d.slice(2)}`;
  return d;
}

/* CRECI: NÚMERO-CATEGORIA/UF — "12345-J/SP".

   A máscara é PROGRESSIVA e não impõe nada que a pessoa não tenha digitado:
   os separadores aparecem conforme as partes chegam.

     "12345"      → 12345
     "12345j"     → 12345-J
     "12345jsp"   → 12345-J/SP

   Isso importa para o apagar funcionar. Uma máscara que emendasse o "-J"
   sozinho assim que houvesse dígitos prenderia o cursor: a pessoa apaga o J, a
   máscara recoloca, e o campo nunca volta a só números.

   O número aceita até seis dígitos porque o comprimento varia entre as
   regionais. A categoria é uma letra só (J de jurídica, F de física) e a UF são
   as duas seguintes — quem digita "12345JSP" ou "12345-J/SP" chega no mesmo
   lugar. */
export function formatCreci(value) {
  const bruto = String(value ?? "").toUpperCase();
  const numero = (bruto.match(/\d+/g) || []).join("").slice(0, 6);
  const letras = (bruto.match(/[A-Z]+/g) || []).join("");

  if (!numero) return letras.slice(0, 1);

  let saida = numero;
  if (letras.length >= 1) saida += `-${letras.slice(0, 1)}`;
  if (letras.length >= 2) saida += `/${letras.slice(1, 3)}`;
  return saida;
}
