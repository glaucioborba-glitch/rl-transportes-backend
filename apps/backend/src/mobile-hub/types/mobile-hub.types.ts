/** Papéis oficiais do hub mobile (sem migration Prisma). */
export type MobileRole = 'OPERADOR_MOBILE' | 'MOTORISTA' | 'CLIENTE_APP';

export type MobileRequestUser = {
  sub: string;
  email: string;
  mobileRole: MobileRole;
  deviceId: string;
  tv: number;
  /** Motorista: protocolo contexto opcional */
  protocoloContexto?: string;
  /** Cliente / operador Prisma */
  prismaUserId?: string;
  clienteId?: string | null;
};

export type MobileAccessPayload = {
  sub: string;
  email: string;
  mobileRole: MobileRole;
  deviceId: string;
  tv: number;
  kind: 'mobile_access';
  protocoloContexto?: string;
  clienteId?: string | null;
};

export type MobileRefreshPayload = {
  sub: string;
  tv: number;
  kind: 'mobile_refresh';
  mobileRole: MobileRole;
  deviceId: string;
};
