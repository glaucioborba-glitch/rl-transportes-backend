import type { AuthLoginResponse } from "@/lib/api/types";
import type { PermissoesPessoaRow, SolicitacaoRow } from "@/lib/api/portal-client";

export const E2E_CNPJ = "19131243000197";
export const E2E_PORTAL_PASSWORD = "Cliente@PortalQA2026";
export const E2E_STAFF_CPF = "52998224725";
/** @deprecated Use E2E_STAFF_CPF — login intranet aceita apenas CPF. */
export const E2E_STAFF_CNPJ = E2E_STAFF_CPF;
export const E2E_STAFF_PASSWORD = "Admin@123";

export const E2E_SOLICITACAO_ID = "e2e-solicitacao-coleta-1";
export const E2E_TRIAGEM_ID = "e2e-triagem-agendamento-1";
export const E2E_CADASTRO_PENDENTE_ID = "e2e-cadastro-pendente-1";

export const E2E_PERMISSOES: PermissoesPessoaRow = {
  podeCriarSolicitacao: true,
  podeAnexarDocumentos: true,
  podeAgendarTurno: true,
  podeVisualizarFinanceiro: true,
  podeAprovarOS: true,
  podeVerOS: true,
  podeAlterarDadosGate: true,
  podeGerarPDF: true,
  podeGerenciarPessoas: true,
};

export function buildPortalLoginResponse() {
  return {
    accessToken: "e2e-portal-access-token",
    refreshToken: "e2e-portal-refresh-token",
    tokenType: "Bearer",
    portalIdentity: {
      sub: "e2e-portal-user-id",
      email: "portal.qa@rl-transportes.test",
      cpfCnpj: E2E_CNPJ,
      portalPapel: "CLIENTE",
      tenantId: "default",
    },
    clienteId: "e2e-cliente-id",
    portalPapel: "CLIENTE",
    tenantId: "default",
    tipo: "PJ" as const,
    skipSelectPessoa: true,
    cliente: {
      id: "e2e-cliente-id",
      nomeFantasia: "Cliente QA E2E",
      razaoSocial: "Cliente QA E2E LTDA",
      cpfCnpj: E2E_CNPJ,
    },
    usuario: {
      id: "e2e-portal-user-id",
      nome: "Operador Portal QA",
      tipo: "PJ" as const,
      email: "portal.qa@rl-transportes.test",
      cpfCnpj: E2E_CNPJ,
    },
    pessoaAutorizada: {
      id: "e2e-pessoa-id",
      nome: "Responsável QA",
      email: "responsavel.qa@rl-transportes.test",
      telefone: "11999990000",
    },
  };
}

export function buildMinhasPermissoesResponse() {
  return {
    sucesso: true,
    permissoes: E2E_PERMISSOES,
    pessoa: {
      id: "e2e-pessoa-id",
      nome: "Responsável QA",
      email: "responsavel.qa@rl-transportes.test",
      telefone: "11999990000",
    },
    precisaSelecionarPessoa: false,
  };
}

export function buildPortalDashboardResponse() {
  return {
    cliente: {
      id: "e2e-cliente-id",
      nome: "Cliente QA E2E",
      tipo: "PJ",
      cpfCnpj: E2E_CNPJ,
      emailNfse: "nfse@rl-transportes.test",
      endereco: {
        cep: "01310100",
        logradouro: "Av. Paulista",
        numero: "1000",
        complemento: null,
        bairro: "Bela Vista",
        cidade: "São Paulo",
        uf: "SP",
        codigoIbge: "3550308",
      },
    },
    solicitacoes: {
      abertas: 1,
      emAndamento: 0,
      concluidas: 0,
      canceladas: 0,
      ultimas: [],
    },
    totalSolicitacoes: 1,
    solicitacoesRecentes: [],
    kpis: { abertas: 1, emAndamento: 0, concluídas: 0 },
    kpisCx: {
      personalizaveis: ["ciclo_medio_horas", "containers_ativos", "faturamento_aberto"],
      valores: {
        ciclo_medio_horas: null,
        containers_ativos: 1,
        faturamento_aberto: 0,
      },
    },
    financeiro: {
      boletosPendentes: 0,
      nfseEmitidas: 0,
      faturadoMes: 0,
      totalFaturadoPeriodo: 0,
    },
    condicaoPagamento: "FATURAMENTO",
    slas: { cumpridos: 0, violados: 0, desempenho: 100 },
    slasCx: {
      tenantId: "default",
      contratadosProxy: {},
      historicoProxy: [{ periodo: "30d", cumprimentoPctProxy: 100 }],
    },
    unidades: { total: 1, import: 0, export: 0, gateIn: 0, gateOut: 0 },
    tendencias: { solicitacoesMesVsAnteriorPct: 0, faturadoMesVsAnteriorPct: 0 },
    trackingSample: [],
    solicitacoesHoje: [],
    recent: { items: [], total: 0, page: 1, limit: 8, orderBy: "createdAt", order: "desc" },
    meta: { tenantId: "default", slasMinutosMeta: null },
    isBloqueadoFinanceiramente: false,
  };
}

export function buildColetaSolicitacao(overrides?: Partial<SolicitacaoRow>): SolicitacaoRow {
  const now = new Date().toISOString();
  return {
    id: E2E_SOLICITACAO_ID,
    protocolo: "E2E-COLETA-001",
    status: "APROVADO",
    versaoCredencial: 1,
    tipoOperacao: "SOLICITAR_COLETA",
    createdAt: now,
    updatedAt: now,
    cliente: {
      id: "e2e-cliente-id",
      razaoSocial: "Cliente QA E2E LTDA",
      nomeFantasia: "Cliente QA E2E",
    },
    transporteSolicitacao: {
      nomeMotorista: "Motorista E2E",
      cpfMotorista: "52998224725",
      tipoCaminhao: "LS",
      placaCavalo: "ABC1D23",
      placaCarreta01: "XYZ9E87",
      placaCarreta02: null,
    },
    containersSolicitacao: [
      {
        id: "e2e-container-1",
        unidade: "MSCU1234567",
        booking: "BK-E2E",
        processo: "PROC-E2E",
        tamanho: '40"',
        tipo: "HC",
        status: "CHEIO",
        lacre: "LACRE-E2E",
        refrigerado: false,
        setPoint: null,
        ordem: 1,
      },
    ],
    agendamentoSolicitacao: {
      dataRef: "2026-06-15",
      turno: "MANHA",
      atendimentoEspecial: false,
      atendimentoEspecialTexto: null,
    },
    solicitanteContato: {
      nome: "Responsável QA",
      telefone: "11999990000",
      email: "responsavel.qa@rl-transportes.test",
    },
    unidades: [{ id: "e2e-unidade-1", numeroIso: "MSCU1234567", tipo: "HC" }],
    ...overrides,
  };
}

export function buildStaffLoginResponse(): AuthLoginResponse {
  return {
    accessToken: "e2e-staff-access-token",
    refreshToken: "e2e-staff-refresh-token",
    user: {
      id: "e2e-admin-id",
      cpfCnpj: E2E_STAFF_CPF,
      email: "admin.qa@rl-transportes.test",
      role: "ADMIN",
      permissions: ["*"],
      clienteId: null,
      tipo: "PJ",
      nome: "Admin QA E2E",
    },
  };
}

export function buildTriagemPendente() {
  return {
    id: E2E_TRIAGEM_ID,
    protocolo: "TRI-E2E-001",
    modalidadeTransporte: "RODO",
    statusCarga: "CHEIO",
    tipoOperacao: "SOLICITAR_COLETA",
    numeroIso: "MSCU1234567",
    dataRef: "2026-06-15",
    turno: "MANHA",
    clienteNome: "Cliente QA E2E",
    localOrigem: "Terminal A",
    localDestino: "Pátio RL",
  };
}

export function buildCadastroPendenteRow() {
  return {
    id: E2E_CADASTRO_PENDENTE_ID,
    razaoSocial: "Nova Empresa E2E LTDA",
    nomeFantasia: "Nova Empresa",
    cpfCnpj: "11222333000181",
    email: "financeiro@nova-empresa.test",
    validacaoDominio: "APROVADO" as const,
    statusCadastro: "PENDENTE_ANALISE_FINANCEIRA" as const,
    createdAt: new Date().toISOString(),
    inscricaoEstadual: "123456789",
    inscricaoMunicipal: null,
    isentoIE: false,
    enderecoLogradouro: "Rua Teste",
    enderecoNumero: "100",
    enderecoComplemento: null,
    enderecoBairro: "Centro",
    enderecoCidade: "São Paulo",
    enderecoUf: "SP",
    enderecoCep: "01310100",
  };
}

/** Snapshot de sessão portal para sobreviver a `page.goto` nos testes E2E. */
export function buildE2ePortalSessionPayload() {
  const login = buildPortalLoginResponse();
  return {
    accessToken: login.accessToken,
    refreshToken: login.refreshToken,
    user: {
      id: login.portalIdentity.sub,
      cpfCnpj: login.portalIdentity.cpfCnpj,
      email: login.portalIdentity.email,
      role: login.portalIdentity.portalPapel,
      permissions: [] as string[],
      clienteId: login.clienteId,
      tipo: "PJ" as const,
      nome: login.usuario?.nome,
    },
    pessoa: login.pessoaAutorizada,
    permissoes: E2E_PERMISSOES,
  };
}
