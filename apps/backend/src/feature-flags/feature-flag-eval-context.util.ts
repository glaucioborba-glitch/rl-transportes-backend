import type { Request } from 'express';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import type { CxPortalRequestUser } from '../cx-portais/types/cx-portal.types';
import type { FeatureFlagEvalContext } from './feature-flag.keys';

type RequestWithActors = Request & {
  user?: AuthUser;
  cxUser?: CxPortalRequestUser;
};

/** Extrai contexto de avaliação (CNPJ/tenant) a partir da requisição HTTP. */
export function featureFlagEvalContextFromRequest(req: RequestWithActors): FeatureFlagEvalContext {
  const cx = req.cxUser;
  if (cx?.cpfCnpj) {
    return { cnpj: cx.cpfCnpj, tenantId: cx.tenantId };
  }
  const staff = req.user;
  if (staff?.cpfCnpj) {
    return { cnpj: staff.cpfCnpj, tenantId: staff.clienteId ?? undefined };
  }
  return {};
}
