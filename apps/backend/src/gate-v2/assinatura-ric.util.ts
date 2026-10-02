export const ASSINATURA_BIOMETRIA_OK = 'BIOMETRIA_OK';

export function isAssinaturaBiometria(value?: string | null): boolean {
  return (value ?? '').trim() === ASSINATURA_BIOMETRIA_OK;
}
