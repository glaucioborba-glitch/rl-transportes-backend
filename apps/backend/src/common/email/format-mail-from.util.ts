/** Monta o cabeçalho From: "Nome <email>" ou só o e-mail. */
export function formatMailFrom(opts: {
  email?: string | null;
  nome?: string | null;
  fallback: string;
}): string {
  const email = opts.email?.trim() ?? '';
  if (!email) return opts.fallback;
  const nome = (opts.nome ?? '').replace(/[<>]/g, '').trim().slice(0, 120);
  return nome ? `${nome} <${email}>` : email;
}
