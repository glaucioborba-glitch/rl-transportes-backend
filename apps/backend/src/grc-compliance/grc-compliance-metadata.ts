import { SetMetadata } from '@nestjs/common';

export const GRC_ADMIN_ONLY_KEY = 'grcAdminOnly';

/** POST /controles e políticas sensíveis: apenas ADMIN/GERENTE (supervisor não). */
export const GrcAdminGerenteOnly = () => SetMetadata(GRC_ADMIN_ONLY_KEY, true);
