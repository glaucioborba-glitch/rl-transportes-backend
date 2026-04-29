/** Resposta `POST /auth/login` e `POST /auth/refresh`. */
export type AuthLoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
    clienteId: string | null;
    createdAt?: string;
  };
};

export type AuthMeResponse = {
  sub: string;
  id: string;
  email: string;
  role: string;
  permissions: string[];
  clienteId?: string | null;
};

/** Payload JWT corporativo (pode incluir `clienteId` após emissão atualizada no backend). */
export type CorporateJwtPayload = {
  sub: string;
  email: string;
  role: string;
  tv?: number;
  clienteId?: string | null;
};

export type PaginatedResponse<T> = {
  items: T[];
  total?: number;
  page?: number;
  limit?: number;
  meta?: { total: number; page: number; limit: number; totalPages: number };
  orderBy?: string;
  order?: string;
};

/** KPIs CX — `GET /cliente/portal/kpis` (Bearer: JWT corporativo cliente ou portal IAM). */
export type KpisResponse = {
  personalizaveis: string[];
  valores: {
    ciclo_medio_horas: number | null;
    containers_ativos: number;
    faturamento_aberto: number;
  };
};

export type SlasResponse = {
  tenantId: string;
  contratadosProxy: Record<string, number>;
  historicoProxy: { periodo: string; cumprimentoPctProxy: number }[];
};
