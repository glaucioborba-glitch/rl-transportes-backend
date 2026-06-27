/** Resposta `POST /auth/login` e `POST /auth/refresh`. */
export type AuthLoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    cpfCnpj: string;
    email: string;
    role: string;
    tenantId?: string;
    permissions: string[];
    clienteId: string | null;
    tipo?: "PF" | "PJ";
    nome?: string;
    createdAt?: string;
  };
};

export type PortalIdentity = {
  sub: string;
  email: string;
  cpfCnpj: string;
  portalPapel: string;
  tenantId: string;
};

/** `POST /portal/login` e `POST /portal/refresh` (JWT portal). */
export type PortalPessoaAutorizadaSnapshot = {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
};

/** Tenant (cliente) vinculado ao usuário portal — retornado em login/refresh. */
export type PortalClienteSnapshot = {
  id: string;
  nomeFantasia: string | null;
  razaoSocial: string | null;
  cpfCnpj: string;
};

export type PortalLoginResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType?: string;
  portalIdentity: PortalIdentity;
  clienteId: string | null;
  portalPapel?: string;
  tenantId?: string;
  tipo?: "PF" | "PJ";
  cliente?: PortalClienteSnapshot | null;
  usuario?: {
    id: string;
    nome: string;
    tipo: "PF" | "PJ";
    email: string;
    cpfCnpj: string;
  };
  pessoaAutorizada?: PortalPessoaAutorizadaSnapshot;
  /** Role Prisma do tenant (ADMIN_CLIENTE, TRANSPORTADORA_TERCEIRA, …). */
  portalTenantRole?: string;
  /** Transportadora: pula seleção de CPF pós-login. */
  skipSelectPessoa?: boolean;
};

export type AuthMeResponse = {
  sub: string;
  id: string;
  email: string;
  cpfCnpj: string;
  role: string;
  tenantId?: string;
  permissions: string[];
  clienteId?: string | null;
};

/** Payload JWT corporativo (pode incluir `clienteId` após emissão atualizada no backend). */
export type CorporateJwtPayload = {
  sub: string;
  cpfCnpj: string;
  email: string;
  role: string;
  tv?: number;
  clienteId?: string | null;
};

/** Claims típicos do JWT portal (acesso). */
export type PortalJwtAccessPayload = {
  sub: string;
  email: string;
  cpfCnpj: string;
  portalPapel?: string;
  tenantId?: string;
  clienteId?: string | null;
  tv?: number;
  kind?: string;
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
