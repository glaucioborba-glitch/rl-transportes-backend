import { SetMetadata } from '@nestjs/common';

/** POST OKR e rotas exclusivas de política — apenas ADMIN/GERENTE (supervisor não). */
export const RH_PERF_ADMIN_ONLY_KEY = 'rhPerfAdminOnly';

export const RhPerfAdminGerenteOnly = () => SetMetadata(RH_PERF_ADMIN_ONLY_KEY, true);
