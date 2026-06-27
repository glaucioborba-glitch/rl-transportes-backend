/** Máscara visual CPF/CNPJ para inputs (somente apresentação). */

export function formatCpfCnpjBr(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) {
    let out = "";
    for (let i = 0; i < d.length; i++) {
      if (i === 3 || i === 6) out += ".";
      if (i === 9) out += "-";
      out += d[i];
    }
    return out;
  }
  let out = "";
  for (let i = 0; i < d.length; i++) {
    if (i === 2 || i === 5) out += ".";
    if (i === 8) out += "/";
    if (i === 12) out += "-";
    out += d[i];
  }
  return out;
}

/** Máscara apenas CPF (11 dígitos) para cadastro PF. */
export function formatCpfBr(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  return formatCpfCnpjBr(d);
}
