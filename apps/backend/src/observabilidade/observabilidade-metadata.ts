import { SetMetadata } from '@nestjs/common';

export const OBS_ALERTAS_ADMIN_KEY = 'obsAlertasAdminOnly';

/** POST /observabilidade/alertas — exclusivo ADMIN (GERENTE só leitura nos demais endpoints). */
export const ObservabilidadeAlertasAdminOnly = () =>
  SetMetadata(OBS_ALERTAS_ADMIN_KEY, true);
