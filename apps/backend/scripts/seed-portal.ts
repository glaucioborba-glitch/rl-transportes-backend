import * as bcrypt from 'bcrypt';
import {
  Role,
  StatusCadastroCliente,
  StatusContainer,
  StatusSolicitacao,
  TipoCaminhao,
  TipoCliente,
  TipoFluxoLogistico,
  TipoOperacaoSolicitacaoIntent,
  TurnoAgendamento,
} from '@prisma/client';
import {
  BCRYPT_ROUNDS,
  DEFAULT_TENANT,
  decimal,
  ensureTenant,
  gerarCnpj,
  gerarCpf,
  getPrisma,
  SEED_CLIENT_PASSWORD,
  SEED_CONTAINERS,
  SEED_EMAIL_DOMAIN,
  SEED_PROTOCOL,
  SEED_TERMOS_VERSAO,
  type SeedCadastrosIds,
  type SeedPortalIds,
} from './seed-utils';

type EmpresaSeed = {
  idx: number;
  razaoSocial: string;
  nomeFantasia: string;
  cnpjRoot: string;
  cpfPessoaRoot: string;
  emailLocal: string;
  responsavel: string;
  cidade: string;
  cep: string;
  ibge: string;
  condicaoPagamento: string;
};

const EMPRESAS: EmpresaSeed[] = [
  {
    idx: 1,
    razaoSocial: 'Costa Sul Armazéns Gerais LTDA',
    nomeFantasia: 'Costa Sul',
    cnpjRoot: '270002450001',
    cpfPessoaRoot: '390533501',
    emailLocal: 'costasul',
    responsavel: 'Carlos Mendes',
    cidade: 'Florianópolis',
    cep: '88010000',
    ibge: '4205407',
    condicaoPagamento: '30_DIAS',
  },
  {
    idx: 2,
    razaoSocial: 'Brasil Cargo Exportação EIRELI',
    nomeFantasia: 'Brasil Cargo',
    cnpjRoot: '270002450002',
    cpfPessoaRoot: '390533502',
    emailLocal: 'brasilcargo',
    responsavel: 'Fernanda Alves',
    cidade: 'Itajaí',
    cep: '88020000',
    ibge: '4208203',
    condicaoPagamento: '30_60',
  },
  {
    idx: 3,
    razaoSocial: 'Depot Container Services LTDA',
    nomeFantasia: 'DCS',
    cnpjRoot: '270002450003',
    cpfPessoaRoot: '390533503',
    emailLocal: 'dcs',
    responsavel: 'Juliana Prado',
    cidade: 'São José',
    cep: '88030000',
    ibge: '4216602',
    condicaoPagamento: 'A_VISTA',
  },
  {
    idx: 4,
    razaoSocial: 'Atlântico Logística Integrada LTDA',
    nomeFantasia: 'Atlântico Log',
    cnpjRoot: '270002450004',
    cpfPessoaRoot: '390533504',
    emailLocal: 'atlanticolog',
    responsavel: 'Marcos Vieira',
    cidade: 'Itajaí',
    cep: '88040000',
    ibge: '4208203',
    condicaoPagamento: '30_60_90',
  },
  {
    idx: 5,
    razaoSocial: 'Meridional Transportes e Logística LTDA',
    nomeFantasia: 'Meridional',
    cnpjRoot: '270002450005',
    cpfPessoaRoot: '390533505',
    emailLocal: 'meridional',
    responsavel: 'Patrícia Nunes',
    cidade: 'Joinville',
    cep: '88050000',
    ibge: '4209102',
    condicaoPagamento: '30_DIAS',
  },
];

const MOTORISTAS_PORTAL = [
  { nome: 'João da Silva', cpf: gerarCpf('123456789') },
  { nome: 'Maria Oliveira', cpf: gerarCpf('987654321') },
  { nome: 'Pedro Santos', cpf: gerarCpf('456789123') },
  { nome: 'Ana Costa', cpf: gerarCpf('321654987') },
];

const PLACAS = ['QAB1C23', 'RXY2D45', 'SCZ3E67', 'TUV4F89', 'UVW5G12'];

const PORTAL_STATUSES: StatusSolicitacao[] = [
  StatusSolicitacao.PENDENTE,
  StatusSolicitacao.EM_ANALISE,
  StatusSolicitacao.APROVADO,
  StatusSolicitacao.REJEITADO,
  StatusSolicitacao.CONCLUIDO,
];

export async function seedPortal(_cadastrosIds?: SeedCadastrosIds): Promise<SeedPortalIds> {
  await ensureTenant();
  const prisma = getPrisma();
  const passwordHash = await bcrypt.hash(SEED_CLIENT_PASSWORD, BCRYPT_ROUNDS);
  const aceiteBase = new Date('2026-06-09T14:00:00.000Z');
  const result: SeedPortalIds = { clientes: [] };

  for (const emp of EMPRESAS) {
    const cnpj = gerarCnpj(emp.cnpjRoot);
    const cpfPessoa = gerarCpf(emp.cpfPessoaRoot);
    const email = `${emp.emailLocal}${SEED_EMAIL_DOMAIN}`;
    const aceiteEm = new Date(aceiteBase.getTime() + emp.idx * 3_600_000);

    const cliente = await prisma.cliente.upsert({
      where: { tenantId_cpfCnpj: { tenantId: DEFAULT_TENANT, cpfCnpj: cnpj } },
      update: {
        razaoSocial: emp.razaoSocial,
        nomeFantasia: emp.nomeFantasia,
        email,
        statusCadastro: StatusCadastroCliente.APROVADO,
        condicaoPagamento: emp.condicaoPagamento,
        termosAceitosEm: aceiteEm,
        termosVersao: SEED_TERMOS_VERSAO,
      },
      create: {
        tenantId: DEFAULT_TENANT,
        razaoSocial: emp.razaoSocial,
        nomeFantasia: emp.nomeFantasia,
        tipo: TipoCliente.PJ,
        cpfCnpj: cnpj,
        email,
        emailNfse: `nfse@${emp.emailLocal}.seed`,
        telefone: `4833${String(100000 + emp.idx).slice(-6)}`,
        enderecoLogradouro: `Rua Seed ${emp.idx}`,
        enderecoNumero: String(100 + emp.idx),
        enderecoBairro: 'Centro',
        enderecoCidade: emp.cidade,
        enderecoUf: 'SC',
        enderecoCep: emp.cep,
        codigoMunicipioIbge: emp.ibge,
        responsavel: emp.responsavel,
        responsavelTelefone: `4799${String(800000 + emp.idx).slice(-7)}`,
        responsavelEmail: `resp@${emp.emailLocal}.seed`,
        statusCadastro: StatusCadastroCliente.APROVADO,
        condicaoPagamento: emp.condicaoPagamento,
        termosAceitosEm: aceiteEm,
        termosAceitosIp: `177.45.${emp.idx}.10`,
        termosVersao: SEED_TERMOS_VERSAO,
        diasToleranciaBloqueio: 20,
        percentualMultaAtraso: decimal('2.00'),
        percentualJurosAoMes: decimal('1.00'),
      },
    });

    await prisma.user.upsert({
      where: { tenantId_email: { tenantId: DEFAULT_TENANT, email } },
      create: {
        tenantId: DEFAULT_TENANT,
        cpfCnpj: cnpj,
        email,
        password: passwordHash,
        role: Role.ADMIN_CLIENTE,
        clienteId: cliente.id,
      },
      update: {
        cpfCnpj: cnpj,
        password: passwordHash,
        role: Role.ADMIN_CLIENTE,
        clienteId: cliente.id,
      },
    });

    const pessoa = await prisma.pessoaAutorizada.upsert({
      where: { clienteId_cpf: { clienteId: cliente.id, cpf: cpfPessoa } },
      create: {
        clienteId: cliente.id,
        nome: `${emp.responsavel} (Operador)`,
        email: `pessoa@${emp.emailLocal}.seed`,
        cpf: cpfPessoa,
        telefone: `4799${String(700000 + emp.idx).slice(-7)}`,
        permissoes: {
          create: {
            podeCriarSolicitacao: true,
            podeAnexarDocumentos: true,
            podeAgendarTurno: true,
            podeVisualizarFinanceiro: true,
            podeAprovarOS: true,
            podeVerOS: true,
            podeAlterarDadosGate: true,
            podeGerarPDF: true,
            podeGerenciarPessoas: true,
          },
        },
      },
      update: {
        nome: `${emp.responsavel} (Operador)`,
        ativo: true,
      },
    });
    void pessoa;

    result.clientes.push({
      id: cliente.id,
      cnpj,
      razaoSocial: emp.razaoSocial,
      cpfPessoa,
      email,
    });
  }

  for (let i = 0; i < 10; i++) {
    const cliente = result.clientes[i % result.clientes.length];
    const cont = SEED_CONTAINERS[i];
    const mot = MOTORISTAS_PORTAL[i % MOTORISTAS_PORTAL.length];
    const protocolo = `${SEED_PROTOCOL.portal}-${String(i + 1).padStart(3, '0')}`;
    const status = PORTAL_STATUSES[i % PORTAL_STATUSES.length];
    const dataRef = new Date();
    dataRef.setDate(dataRef.getDate() + (i - 5));
    const dataRefOnly = new Date(dataRef.toISOString().slice(0, 10) + 'T12:00:00.000Z');

    await prisma.solicitacao.upsert({
      where: { protocolo },
      create: {
        tenantId: DEFAULT_TENANT,
        protocolo,
        clienteId: cliente.id,
        status,
        tipoOperacao:
          i % 2 === 0
            ? TipoOperacaoSolicitacaoIntent.SOLICITAR_BAIXA
            : TipoOperacaoSolicitacaoIntent.SOLICITAR_COLETA,
        tipoFluxo: i % 2 === 0 ? TipoFluxoLogistico.ENTREGA_BAIXA : TipoFluxoLogistico.COLETA_CONTAINER,
        transporteSolicitacao: {
          create: {
            nomeMotorista: mot.nome,
            cpfMotorista: mot.cpf,
            tipoCaminhao: i % 2 === 0 ? TipoCaminhao.LS : TipoCaminhao.RODOTREM,
            placaCavalo: PLACAS[i % PLACAS.length],
            placaCarreta01: PLACAS[(i + 1) % PLACAS.length],
          },
        },
        containersSolicitacao: {
          create: {
            unidade: cont.numero,
            booking: `BK-PORT-${i + 1}`,
            processo: `PROC-PORT-${i + 1}`,
            tamanho: cont.tamanho,
            tipo: cont.tipo,
            status: cont.situacao === 'VAZIO' ? StatusContainer.VAZIO : StatusContainer.CHEIO,
            ordem: 1,
          },
        },
        agendamentoSolicitacao: {
          create: {
            dataRef: dataRefOnly,
            turno: i % 2 === 0 ? TurnoAgendamento.MANHA : TurnoAgendamento.TARDE,
            atendimentoEspecial: i === 3,
            atendimentoEspecialTexto: i === 3 ? 'Contêiner com avaria na porta lateral' : null,
          },
        },
        solicitanteContato: {
          create: {
            nome: mot.nome,
            telefone: `4799${String(600000 + i).slice(-7)}`,
            email: `solicitante.port.${i + 1}${SEED_EMAIL_DOMAIN}`,
          },
        },
        createdAt: new Date(Date.now() - i * 86_400_000),
      },
      update: {
        clienteId: cliente.id,
        status,
      },
    });
  }

  return result;
}
