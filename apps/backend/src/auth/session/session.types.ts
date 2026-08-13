export type AuthChannel = 'staff' | 'portal' | 'mobile';

export type PessoaAutorizadaSessionPayload = {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
};

export type PermissoesPessoaSessionPayload = {
  podeCriarSolicitacao: boolean;
  podeAnexarDocumentos: boolean;
  podeAgendarTurno: boolean;
  podeVisualizarFinanceiro: boolean;
  podeAprovarOS: boolean;
  podeVerOS: boolean;
  podeAlterarDadosGate: boolean;
  podeGerarPDF: boolean;
  podeGerenciarPessoas: boolean;
};

export type SessionRedisPayload = {
  fingerprint: string;
  ip: string;
  userAgent: string;
  createdAt: string;
  lastSeenAt: string;
  channel: AuthChannel;
  /** Identidade individual selecionada após login corporativo (portal cliente). */
  pessoaAutorizada?: PessoaAutorizadaSessionPayload;
  /** RBAC operacional da pessoa selecionada. */
  permissoesPessoa?: PermissoesPessoaSessionPayload;
};

export type DeviceRequestHeaders = {
  clientFingerprint?: string;
  deviceOs?: string;
  deviceBrowser?: string;
  deviceTimezone?: string;
  deviceScreen?: string;
};
