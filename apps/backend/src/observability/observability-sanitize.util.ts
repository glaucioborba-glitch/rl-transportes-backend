const SENSITIVE_KEYS =
  /password|passwd|senha|authorization|token|secret|refresh|cookie|cpf|credit/i;

/** Remove trechos que parecem segredos para logs/admin UI. */
export function sanitizeObservabilityMessage(msg: string | undefined | null, maxLen = 512): string {
  if (msg == null || msg === '') return '(sem mensagem)';
  let s = String(msg).replace(/\s+/g, ' ').trim();
  if (SENSITIVE_KEYS.test(s)) {
    return '[redacted — possível dado sensível]';
  }
  // Bearer / JWT-like
  if (/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9._-]+/.test(s)) {
    return '[redacted — token]';
  }
  if (s.length > maxLen) s = `${s.slice(0, maxLen)}…`;
  return s;
}

export function stackForEnv(stack: string | undefined, isProd: boolean): string | undefined {
  if (!stack) return undefined;
  if (isProd) return undefined;
  return stack.slice(0, 8000);
}
