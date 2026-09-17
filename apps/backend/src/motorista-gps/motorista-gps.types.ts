import type { MotoristaGpsOrigem } from '@prisma/client';
import { MOTORISTA_GPS_JWT_TYP } from './motorista-gps.util';

export type MotoristaGpsJwtPayload = {
  typ: typeof MOTORISTA_GPS_JWT_TYP;
  sub: string;
  origem: MotoristaGpsOrigem;
  cpf: string;
  tenantId: string;
};
