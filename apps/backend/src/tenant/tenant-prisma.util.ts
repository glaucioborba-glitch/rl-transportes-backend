import { DEFAULT_TENANT_ID } from './tenant.constants';

export function userWhereByDocumento(tenantId: string, cpfCnpj: string) {
  return { tenantId_cpfCnpj: { tenantId, cpfCnpj } } as const;
}

export function userWhereByEmail(tenantId: string, email: string) {
  return { tenantId_email: { tenantId, email: email.toLowerCase() } } as const;
}

export function clienteWhereByDocumento(tenantId: string, cpfCnpj: string) {
  return { tenantId_cpfCnpj: { tenantId, cpfCnpj } } as const;
}

export { DEFAULT_TENANT_ID };
