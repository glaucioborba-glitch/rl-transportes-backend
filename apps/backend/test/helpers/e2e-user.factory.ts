/* CNPJs válidos gerados para testes e2e (unicidade por e-mail). */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const POOL: string[] = require('./e2e-user-docs.json') as string[];

/** Atribui um CPF/CNPJ de teste determinístico por e-mail (evita colisão entre suites). */
export function cpfCnpjForTestUser(email: string, salt = ''): string {
  let h = 0;
  const s = `${email}|${salt}`;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return POOL[h % POOL.length];
}
