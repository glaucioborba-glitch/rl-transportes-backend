import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const PREFIXO = 'enc:v1:';
const ALGORITMO = 'aes-256-gcm';

/**
 * Chave de criptografia da biometria. Usa BIOMETRIA_ENCRYPTION_KEY e,
 * na ausência dela, deriva de JWT_SECRET para não deixar o dado em claro.
 */
function chave(): Buffer | null {
  const bruta =
    process.env.BIOMETRIA_ENCRYPTION_KEY?.trim() || process.env.JWT_SECRET?.trim() || '';
  if (!bruta) return null;
  return createHash('sha256').update(bruta).digest();
}

export function biometriaCriptografiaAtiva(): boolean {
  return chave() !== null;
}

export function estaCriptografado(valor: string | null | undefined): boolean {
  return typeof valor === 'string' && valor.startsWith(PREFIXO);
}

/** Cifra o template (AES-256-GCM). Sem chave disponível, devolve o texto original. */
export function cifrarTemplateBiometrico(texto: string): string {
  const key = chave();
  if (!key) return texto;
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITMO, key, iv);
  const dados = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIXO}${iv.toString('base64')}.${tag.toString('base64')}.${dados.toString('base64')}`;
}

/**
 * Decifra o template. Registros gravados antes desta mudança seguem em texto
 * claro e são devolvidos como estão, para o gate continuar funcionando.
 */
export function decifrarTemplateBiometrico(valor: string | null): string | null {
  if (!valor) return null;
  if (!estaCriptografado(valor)) return valor;
  const key = chave();
  if (!key) return null;
  const [ivB64, tagB64, dadosB64] = valor.slice(PREFIXO.length).split('.');
  if (!ivB64 || !tagB64 || !dadosB64) return null;
  try {
    const decipher = createDecipheriv(ALGORITMO, key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(dadosB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}
