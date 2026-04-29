/**
 * Tag XML do indicador de cancelamento (NTE-35 / variação municipal).
 * Ajuste `NFSE_IPM_TAG_CANCEL` se o portal IPM rejeitar o padrão `tipo`.
 */
const TAG_SANITIZE = /[^a-zA-Z0-9_]/g;

export function sanitizeIpmNfseCancelTag(raw?: string | null): string {
  const t = (raw ?? 'tipo').replace(TAG_SANITIZE, '');
  return t || 'tipo';
}

/** Requisitos mínimos para gerar &lt;tag&gt;C&lt;/tag&gt; no cancelamento. */
export function assertCancelTagIpmUsavel(tag: string): void {
  if (!tag || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(tag)) {
    throw new Error(
      `Tag de cancelamento inválida após sanitização: "${tag}". Defina NFSE_IPM_TAG_CANCEL alinhada ao município (ex.: tipo).`,
    );
  }
}
