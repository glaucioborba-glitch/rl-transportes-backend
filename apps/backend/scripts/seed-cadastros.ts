import {
  DEFAULT_TENANT,
  ensureTenant,
  gerarCnpj,
  gerarCpf,
  getPrisma,
  type SeedCadastrosIds,
} from './seed-utils';
import { ensureDefaultPricingSynced } from './pricing-sync-seed';

export async function seedCadastros(): Promise<SeedCadastrosIds> {
  await ensureTenant();
  const prisma = getPrisma();
  const ids: SeedCadastrosIds = {
    tiposContainer: [],
    colaboradores: [],
    transportadoras: [],
    motoristas: [],
    equipamentos: [],
  };

  const tipos = [
    { codigo: 'DRY', nome: 'Dry Standard (latão)', tamanhos: ["20'", "40'", "45'"], tomadaReefer: false, ativo: true },
    { codigo: 'REEFER', nome: 'Reefer (Refrigerado)', tamanhos: ["20'", "40'"], tomadaReefer: true, ativo: true },
    { codigo: 'OT', nome: 'Open Top', tamanhos: ["20'", "40'"], tomadaReefer: false, ativo: true },
    { codigo: 'FR', nome: 'Flat Rack', tamanhos: ["20'", "40'"], tomadaReefer: false, ativo: true },
    { codigo: 'TANK', nome: 'Tank', tamanhos: ["20'"], tomadaReefer: false, ativo: true },
  ];

  for (const tipo of tipos) {
    const row = await prisma.cadastroTipoContainer.upsert({
      where: { tenantId_codigo: { tenantId: DEFAULT_TENANT, codigo: tipo.codigo } },
      update: {
        nome: tipo.nome,
        tamanhos: tipo.tamanhos,
        tomadaReefer: tipo.tomadaReefer,
        ativo: tipo.ativo,
      },
      create: {
        tenantId: DEFAULT_TENANT,
        codigo: tipo.codigo,
        nome: tipo.nome,
        tamanhos: tipo.tamanhos,
        tomadaReefer: tipo.tomadaReefer,
        ativo: tipo.ativo,
      },
    });
    ids.tiposContainer.push(row.id);
  }

  const capacidades = [
    { codigo: 'DC', nome: 'Dry Container (altura padrão)', ativo: true },
    { codigo: 'HC', nome: 'High Cube', ativo: true },
  ];
  for (const cap of capacidades) {
    await prisma.cadastroCapacidadeContainer.upsert({
      where: { tenantId_codigo: { tenantId: DEFAULT_TENANT, codigo: cap.codigo } },
      update: { nome: cap.nome, ativo: cap.ativo, deletedAt: null },
      create: { tenantId: DEFAULT_TENANT, ...cap },
    });
  }

  // Desativa HC como tipo legado (agora é capacidade)
  await prisma.cadastroTipoContainer.updateMany({
    where: { tenantId: DEFAULT_TENANT, codigo: 'HC' },
    data: { ativo: false, deletedAt: new Date() },
  });

  const transportadoras = [
    {
      razaoSocial: 'Expresso Portuário SC LTDA',
      nomeFantasia: 'Expresso SC',
      cnpj: gerarCnpj('270002450010'),
      rntrc: '00012345',
      rntrcValidade: new Date('2027-12-31'),
      ie: '123456789',
      email: 'contato@expressosc.seed',
      telefone: '4833330001',
      cidade: 'Itajaí',
      uf: 'SC',
      ativo: true,
    },
    {
      razaoSocial: 'TransLog Sul Transportes LTDA',
      nomeFantasia: 'TransLog',
      cnpj: gerarCnpj('270002450020'),
      rntrc: '00067890',
      rntrcValidade: new Date('2026-08-15'),
      ie: '987654321',
      email: 'operacao@translogsul.seed',
      telefone: '4833330002',
      cidade: 'São José',
      uf: 'SC',
      ativo: true,
    },
  ];

  for (const transp of transportadoras) {
    const row = await prisma.cadastroTransportadora.upsert({
      where: { tenantId_cnpj: { tenantId: DEFAULT_TENANT, cnpj: transp.cnpj } },
      update: transp,
      create: { tenantId: DEFAULT_TENANT, ...transp },
    });
    ids.transportadoras.push(row.id);
  }

  const motoristas = [
    {
      nome: 'João da Silva Santos',
      cpf: gerarCpf('123456789'),
      transportadoraId: ids.transportadoras[0],
      cnhNumero: '01234567890',
      cnhCategoria: 'E',
      cnhValidade: new Date('2027-06-30'),
      cnhUfEmissao: 'SC',
      celular: '48999000001',
      ativo: true,
    },
    {
      nome: 'Carlos Eduardo Ferreira',
      cpf: gerarCpf('987654321'),
      transportadoraId: ids.transportadoras[0],
      cnhNumero: '09876543210',
      cnhCategoria: 'C',
      cnhValidade: new Date('2026-02-28'),
      cnhUfEmissao: 'SC',
      celular: '48999000002',
      ativo: true,
    },
    {
      nome: 'Pedro Alves Lima',
      cpf: gerarCpf('456789123'),
      transportadoraId: ids.transportadoras[1],
      cnhNumero: '04567891230',
      cnhCategoria: 'E',
      cnhValidade: new Date('2025-12-15'),
      cnhUfEmissao: 'SC',
      celular: '48999000003',
      ativo: true,
    },
    {
      nome: 'Ana Paula Costa',
      cpf: gerarCpf('321654987'),
      transportadoraId: ids.transportadoras[1],
      cnhNumero: '03216549870',
      cnhCategoria: 'D',
      cnhValidade: new Date('2028-01-20'),
      cnhUfEmissao: 'SC',
      celular: '48999000004',
      ativo: true,
    },
  ];

  for (const mot of motoristas) {
    const row = await prisma.cadastroMotorista.upsert({
      where: { tenantId_cpf: { tenantId: DEFAULT_TENANT, cpf: mot.cpf } },
      update: mot,
      create: { tenantId: DEFAULT_TENANT, ...mot },
    });
    ids.motoristas.push(row.id);
  }

  const colaboradores = [
    {
      nome: 'Marcos Roberto Silva',
      cpf: gerarCpf('111222333'),
      matricula: '0001',
      dataAdmissao: new Date('2020-01-01'),
      cargo: 'Gerente de Operações',
      departamento: 'OPERACIONAL',
      vinculo: 'CLT',
      status: 'ATIVO',
      centroCustoCodigo: 'CC-OP',
      centroCustoNome: 'Operações',
      dados: { email: 'marcos.silva@rltransportes.com', turno: 'T1', salario: 8500 },
    },
    {
      nome: 'Roberto Carlos Mendes',
      cpf: gerarCpf('222333444'),
      matricula: '0002',
      dataAdmissao: new Date('2021-03-01'),
      cargo: 'Operador de Gate CPO',
      departamento: 'GATE',
      vinculo: 'CLT',
      status: 'ATIVO',
      centroCustoCodigo: 'CC-GATE',
      centroCustoNome: 'Gate',
      dados: { email: 'roberto.mendes@rltransportes.com', turno: 'T1', salario: 4500 },
    },
    {
      nome: 'Sandra Maria Oliveira',
      cpf: gerarCpf('333444555'),
      matricula: '0003',
      dataAdmissao: new Date('2022-06-15'),
      cargo: 'Operador de Empilhadeira',
      departamento: 'PATIO',
      vinculo: 'CLT',
      status: 'ATIVO',
      centroCustoCodigo: 'CC-OP',
      centroCustoNome: 'Operações',
      dados: { email: 'sandra.oliveira@rltransportes.com', turno: 'T2', salario: 3800 },
    },
    {
      nome: 'Fernanda Souza Lima',
      cpf: gerarCpf('444555666'),
      matricula: '0004',
      dataAdmissao: new Date('2023-01-10'),
      cargo: 'Analista Financeiro',
      departamento: 'FINANCEIRO',
      vinculo: 'CLT',
      status: 'ATIVO',
      centroCustoCodigo: 'CC-FIN',
      centroCustoNome: 'Financeiro',
      dados: { email: 'fernanda.lima@rltransportes.com', turno: 'T1', salario: 5000 },
    },
    {
      nome: 'José Antônio Pereira',
      cpf: gerarCpf('555666777'),
      matricula: '0005',
      dataAdmissao: new Date('2020-07-01'),
      cargo: 'Operador de Reach Stacker',
      departamento: 'PATIO',
      vinculo: 'CLT',
      status: 'ATIVO',
      centroCustoCodigo: 'CC-OP',
      centroCustoNome: 'Operações',
      dados: { email: 'jose.pereira@rltransportes.com', turno: 'T1', salario: 4200 },
    },
  ];

  for (const colab of colaboradores) {
    const row = await prisma.cadastroColaborador.upsert({
      where: { tenantId_cpf: { tenantId: DEFAULT_TENANT, cpf: colab.cpf } },
      update: colab,
      create: { tenantId: DEFAULT_TENANT, ...colab },
    });
    ids.colaboradores.push(row.id);
  }

  const equipamentos = [
    {
      codigo: 'EMP-01',
      tipo: 'EMPILHADEIRA_FRONTAL',
      marca: 'Toyota',
      modelo: '8FDU15',
      capacidade: '2.5',
      alturaMaxima: '4.5',
      status: 'DISPONIVEL',
      horimetro: 3450,
      ultimaManutencao: new Date('2026-06-01'),
      proximaManutencao: new Date('2026-12-01'),
      centroCusto: 'CC-OP',
      ativo: true,
    },
    {
      codigo: 'EMP-02',
      tipo: 'EMPILHADEIRA_FRONTAL',
      marca: 'Hyster',
      modelo: 'H50FT',
      capacidade: '5.0',
      alturaMaxima: '5.0',
      status: 'DISPONIVEL',
      horimetro: 2100,
      ultimaManutencao: new Date('2026-05-15'),
      proximaManutencao: new Date('2026-11-15'),
      centroCusto: 'CC-OP',
      ativo: true,
    },
    {
      codigo: 'RS-01',
      tipo: 'REACH_STACKER',
      marca: 'Kalmar',
      modelo: 'DRG450',
      capacidade: '45',
      alturaMaxima: '12.0',
      status: 'EM_USO',
      horimetro: 8900,
      ultimaManutencao: new Date('2026-04-01'),
      proximaManutencao: new Date('2026-10-01'),
      centroCusto: 'CC-OP',
      ativo: true,
    },
    {
      codigo: 'RS-02',
      tipo: 'REACH_STACKER',
      marca: 'Kalmar',
      modelo: 'DRG450',
      capacidade: '45',
      alturaMaxima: '12.0',
      status: 'EM_MANUTENCAO',
      horimetro: 9200,
      ultimaManutencao: new Date('2026-07-01'),
      proximaManutencao: new Date('2027-01-01'),
      centroCusto: 'CC-OP',
      ativo: true,
    },
    {
      codigo: 'EMP-03',
      tipo: 'EMPILHADEIRA_LATERAL',
      marca: 'Toyota',
      modelo: '8FBE20',
      capacidade: '2.0',
      alturaMaxima: '3.5',
      status: 'DISPONIVEL',
      horimetro: 1200,
      ultimaManutencao: new Date('2026-06-15'),
      proximaManutencao: new Date('2026-12-15'),
      centroCusto: 'CC-OP',
      ativo: true,
    },
  ];

  for (const eq of equipamentos) {
    const row = await prisma.cadastroEquipamento.upsert({
      where: { tenantId_codigo: { tenantId: DEFAULT_TENANT, codigo: eq.codigo } },
      update: eq,
      create: { tenantId: DEFAULT_TENANT, ...eq },
    });
    ids.equipamentos.push(row.id);
  }

  // ========== POSIÇÕES DE PÁTIO ==========
  const zonaA = await prisma.posicaoPatioZona.upsert({
    where: { tenantId_codigo: { tenantId: DEFAULT_TENANT, codigo: 'A' } },
    update: { nome: 'Zona A — Dry', cor: '#3B82F6', deletedAt: null, ativo: true },
    create: { tenantId: DEFAULT_TENANT, codigo: 'A', nome: 'Zona A — Dry', cor: '#3B82F6' },
  });
  const baiaA01 = await prisma.posicaoPatioBaia.upsert({
    where: { tenantId_zonaId_codigo: { tenantId: DEFAULT_TENANT, zonaId: zonaA.id, codigo: 'A-01' } },
    update: { deletedAt: null, ativo: true },
    create: { tenantId: DEFAULT_TENANT, zonaId: zonaA.id, codigo: 'A-01' },
  });
  const baiaA02 = await prisma.posicaoPatioBaia.upsert({
    where: { tenantId_zonaId_codigo: { tenantId: DEFAULT_TENANT, zonaId: zonaA.id, codigo: 'A-02' } },
    update: { deletedAt: null, ativo: true },
    create: { tenantId: DEFAULT_TENANT, zonaId: zonaA.id, codigo: 'A-02' },
  });

  for (const baia of [baiaA01, baiaA02]) {
    for (let slot = 1; slot <= 4; slot++) {
      for (let stack = 1; stack <= 3; stack++) {
        const codigo = `${baia.codigo}-${String(slot).padStart(2, '0')}-${stack}`;
        await prisma.cadastroPosicaoPatio.upsert({
          where: { tenantId_codigo: { tenantId: DEFAULT_TENANT, codigo } },
          update: {
            status: stack === 1 && slot <= 2 ? 'OCUPADO' : 'LIVRE',
            deletedAt: null,
            ativo: true,
          },
          create: {
            tenantId: DEFAULT_TENANT,
            zonaId: zonaA.id,
            baiaId: baia.id,
            codigo,
            zonaCodigo: zonaA.codigo,
            baiaCodigo: baia.codigo,
            zonaNome: zonaA.nome,
            zonaCor: zonaA.cor,
            slotNumero: slot,
            stackAltura: stack,
            tipoAceito: 'DRY',
            tomadaReefer: false,
            capacidadePeso: 30,
            status: stack === 1 && slot <= 2 ? 'OCUPADO' : 'LIVRE',
            ativo: true,
          },
        });
      }
    }
  }

  const zonaR = await prisma.posicaoPatioZona.upsert({
    where: { tenantId_codigo: { tenantId: DEFAULT_TENANT, codigo: 'R' } },
    update: { nome: 'Zona R — Reefer', cor: '#06B6D4', deletedAt: null, ativo: true },
    create: { tenantId: DEFAULT_TENANT, codigo: 'R', nome: 'Zona R — Reefer', cor: '#06B6D4' },
  });
  const baiaR01 = await prisma.posicaoPatioBaia.upsert({
    where: { tenantId_zonaId_codigo: { tenantId: DEFAULT_TENANT, zonaId: zonaR.id, codigo: 'R-01' } },
    update: { deletedAt: null, ativo: true },
    create: { tenantId: DEFAULT_TENANT, zonaId: zonaR.id, codigo: 'R-01' },
  });
  for (let slot = 1; slot <= 4; slot++) {
    for (let stack = 1; stack <= 2; stack++) {
      const codigo = `${baiaR01.codigo}-${String(slot).padStart(2, '0')}-${stack}`;
      await prisma.cadastroPosicaoPatio.upsert({
        where: { tenantId_codigo: { tenantId: DEFAULT_TENANT, codigo } },
        update: { deletedAt: null, ativo: true, status: 'LIVRE' },
        create: {
          tenantId: DEFAULT_TENANT,
          zonaId: zonaR.id,
          baiaId: baiaR01.id,
          codigo,
          zonaCodigo: zonaR.codigo,
          baiaCodigo: baiaR01.codigo,
          zonaNome: zonaR.nome,
          zonaCor: zonaR.cor,
          slotNumero: slot,
          stackAltura: stack,
          tipoAceito: 'REEFER',
          tomadaReefer: true,
          capacidadePeso: 30,
          status: 'LIVRE',
          ativo: true,
        },
      });
    }
  }

  const tiposOp = [
    { codigo: 'BAIXA', nome: 'Baixa de Contêiner', direcao: 'ENTRADA', exigeContainer: true, exigeCaminhao: true, exigeEmpilhadeira: true, tempoPadrao: 30, cor: '#10B981', ativo: true },
    { codigo: 'COLETA', nome: 'Coleta de Contêiner', direcao: 'SAIDA', exigeContainer: true, exigeCaminhao: true, exigeEmpilhadeira: true, tempoPadrao: 25, cor: '#8B5CF6', ativo: true },
    { codigo: 'TRANSFERENCIA', nome: 'Transferência Interna', direcao: 'INTERNA', exigeContainer: true, exigeCaminhao: false, exigeEmpilhadeira: true, tempoPadrao: 15, cor: '#3B82F6', ativo: true },
    { codigo: 'INSPECAO', nome: 'Inspeção CSC', direcao: 'INTERNA', exigeContainer: true, exigeCaminhao: false, exigeEmpilhadeira: false, tempoPadrao: 20, cor: '#F59E0B', ativo: true },
    { codigo: 'REPARO', nome: 'Reparo de Avaria', direcao: 'INTERNA', exigeContainer: true, exigeCaminhao: false, exigeEmpilhadeira: true, tempoPadrao: 60, cor: '#EF4444', ativo: true },
  ];
  for (const t of tiposOp) {
    await prisma.cadastroTipoOperacao.upsert({
      where: { tenantId_codigo: { tenantId: DEFAULT_TENANT, codigo: t.codigo } },
      update: { ...t, deletedAt: null },
      create: { tenantId: DEFAULT_TENANT, ...t },
    });
  }

  const turnosSeed = [
    { codigo: 'T1', nome: 'Manhã', horaInicio: '06:00', horaFim: '14:00', capacidadeMaxima: 5, diasSemana: ['SEG', 'TER', 'QUA', 'QUI', 'SEX'], ativo: true },
    { codigo: 'T2', nome: 'Tarde', horaInicio: '14:00', horaFim: '22:00', capacidadeMaxima: 5, diasSemana: ['SEG', 'TER', 'QUA', 'QUI', 'SEX'], ativo: true },
    { codigo: 'T3', nome: 'Noite', horaInicio: '22:00', horaFim: '06:00', capacidadeMaxima: 3, diasSemana: ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'], ativo: true },
  ];
  for (const t of turnosSeed) {
    await prisma.cadastroTurno.upsert({
      where: { tenantId_codigo: { tenantId: DEFAULT_TENANT, codigo: t.codigo } },
      update: { ...t, deletedAt: null },
      create: { tenantId: DEFAULT_TENANT, ...t },
    });
  }

  const motivos = [
    { codigo: 'CONTAINER_DANIFICADO', descricao: 'Contêiner danificado na chegada', tipo: 'REJEICAO_GATE', exigeObservacao: true, notificaCliente: true, ativo: true },
    { codigo: 'DOCUMENTACAO_INCOMPLETA', descricao: 'Documentação incompleta ou inválida', tipo: 'REJEICAO_GATE', exigeObservacao: true, notificaCliente: false, ativo: true },
    { codigo: 'CNH_VENCIDA', descricao: 'CNH do motorista vencida', tipo: 'REJEICAO_GATE', exigeObservacao: false, notificaCliente: true, ativo: true },
    { codigo: 'PLACA_DIVERGENTE', descricao: 'Placa do veículo não confere com a autorização', tipo: 'REJEICAO_GATE', exigeObservacao: true, notificaCliente: false, ativo: true },
    { codigo: 'EXCESSO_PESO', descricao: 'Excesso de peso no contêiner', tipo: 'REJEICAO_GATE', exigeObservacao: true, notificaCliente: true, ativo: true },
    { codigo: 'AVARIA_CRITICA', descricao: 'Avaria crítica impede operação', tipo: 'RETORNO_PATIO', exigeObservacao: true, notificaCliente: true, ativo: true },
    { codigo: 'CANCELAMENTO_SOLICITANTE', descricao: 'Cancelamento solicitado pelo cliente', tipo: 'CANCELAMENTO_CLIENTE', exigeObservacao: true, notificaCliente: false, ativo: true },
    { codigo: 'FORA_HORARIO', descricao: 'Chegada fora do horário agendado', tipo: 'REJEICAO_GATE', exigeObservacao: false, notificaCliente: false, ativo: true },
  ];
  for (const m of motivos) {
    await prisma.cadastroMotivoRejeicao.upsert({
      where: { tenantId_codigo: { tenantId: DEFAULT_TENANT, codigo: m.codigo } },
      update: { ...m, deletedAt: null },
      create: { tenantId: DEFAULT_TENANT, ...m },
    });
  }

  // ========== BANCOS ==========
  const bancos = [
    { codigo: '001', nome: 'Banco do Brasil S.A.', cnpj: '00000000000191', site: 'www.bb.com.br', ativo: true },
    { codigo: '237', nome: 'Banco Bradesco S.A.', cnpj: '60746948000112', site: 'www.bradesco.com.br', ativo: true },
    { codigo: '341', nome: 'Banco Itaú S.A.', cnpj: '60701190000104', site: 'www.itau.com.br', ativo: true },
    { codigo: '075', nome: 'Banco Santander S.A.', cnpj: '90400888000142', site: 'www.santander.com.br', ativo: true },
  ];
  for (const b of bancos) {
    await prisma.cadastroBanco.upsert({
      where: { tenantId_codigo: { tenantId: DEFAULT_TENANT, codigo: b.codigo } },
      update: { ...b, deletedAt: null },
      create: { tenantId: DEFAULT_TENANT, ...b },
    });
  }

  // ========== CENTROS DE CUSTO ==========
  const ccRaiz = await prisma.cadastroCentroCusto.upsert({
    where: { tenantId_codigo: { tenantId: DEFAULT_TENANT, codigo: 'CC' } },
    update: { deletedAt: null, ativo: true },
    create: { tenantId: DEFAULT_TENANT, codigo: 'CC', nome: 'Centros de Custo', tipo: 'SINTETICO', ativo: true },
  });
  const ccOp = await prisma.cadastroCentroCusto.upsert({
    where: { tenantId_codigo: { tenantId: DEFAULT_TENANT, codigo: 'CC-OP' } },
    update: { paiId: ccRaiz.id, deletedAt: null, ativo: true },
    create: { tenantId: DEFAULT_TENANT, codigo: 'CC-OP', nome: 'Operacional', tipo: 'SINTETICO', paiId: ccRaiz.id, ativo: true },
  });
  await prisma.cadastroCentroCusto.upsert({
    where: { tenantId_codigo: { tenantId: DEFAULT_TENANT, codigo: 'CC-GATE' } },
    update: { paiId: ccOp.id, deletedAt: null, ativo: true },
    create: { tenantId: DEFAULT_TENANT, codigo: 'CC-GATE', nome: 'Gate CPO', tipo: 'ANALITICO', paiId: ccOp.id, ativo: true },
  });
  await prisma.cadastroCentroCusto.upsert({
    where: { tenantId_codigo: { tenantId: DEFAULT_TENANT, codigo: 'CC-PATIO' } },
    update: { paiId: ccOp.id, deletedAt: null, ativo: true },
    create: { tenantId: DEFAULT_TENANT, codigo: 'CC-PATIO', nome: 'Pátio / Movimentação', tipo: 'ANALITICO', paiId: ccOp.id, ativo: true },
  });
  const ccAdmin = await prisma.cadastroCentroCusto.upsert({
    where: { tenantId_codigo: { tenantId: DEFAULT_TENANT, codigo: 'CC-ADM' } },
    update: { paiId: ccRaiz.id, deletedAt: null, ativo: true },
    create: { tenantId: DEFAULT_TENANT, codigo: 'CC-ADM', nome: 'Administrativo', tipo: 'SINTETICO', paiId: ccRaiz.id, ativo: true },
  });
  await prisma.cadastroCentroCusto.upsert({
    where: { tenantId_codigo: { tenantId: DEFAULT_TENANT, codigo: 'CC-FIN' } },
    update: { paiId: ccAdmin.id, deletedAt: null, ativo: true },
    create: { tenantId: DEFAULT_TENANT, codigo: 'CC-FIN', nome: 'Financeiro', tipo: 'ANALITICO', paiId: ccAdmin.id, ativo: true },
  });
  await prisma.cadastroCentroCusto.upsert({
    where: { tenantId_codigo: { tenantId: DEFAULT_TENANT, codigo: 'CC-RH' } },
    update: { paiId: ccAdmin.id, deletedAt: null, ativo: true },
    create: { tenantId: DEFAULT_TENANT, codigo: 'CC-RH', nome: 'Recursos Humanos', tipo: 'ANALITICO', paiId: ccAdmin.id, ativo: true },
  });

  // ========== PLANO DE CONTAS ==========
  type ContaSeed = {
    codigo: string;
    nome: string;
    natureza: string;
    tipo: string;
    paiCodigo?: string;
    ativo: boolean;
  };
  const contas: ContaSeed[] = [
    { codigo: '1', nome: 'Receitas', natureza: 'RECEITA', tipo: 'SINTETICA', ativo: true },
    { codigo: '1.01', nome: 'Receita Operacional', natureza: 'RECEITA', tipo: 'SINTETICA', paiCodigo: '1', ativo: true },
    { codigo: '1.01.001', nome: 'Receita de Movimentação de Contêiner', natureza: 'RECEITA', tipo: 'ANALITICA', paiCodigo: '1.01', ativo: true },
    { codigo: '1.01.002', nome: 'Receita de Armazenagem (Storage)', natureza: 'RECEITA', tipo: 'ANALITICA', paiCodigo: '1.01', ativo: true },
    { codigo: '1.01.003', nome: 'Receita de Inspeção e Vistoria', natureza: 'RECEITA', tipo: 'ANALITICA', paiCodigo: '1.01', ativo: true },
    { codigo: '1.02', nome: 'Receita Não Operacional', natureza: 'RECEITA', tipo: 'SINTETICA', paiCodigo: '1', ativo: true },
    { codigo: '1.02.001', nome: 'Receita de Multas e Penalidades', natureza: 'RECEITA', tipo: 'ANALITICA', paiCodigo: '1.02', ativo: true },
    { codigo: '2', nome: 'Despesas', natureza: 'DESPESA', tipo: 'SINTETICA', ativo: true },
    { codigo: '2.01', nome: 'Despesa Operacional', natureza: 'DESPESA', tipo: 'SINTETICA', paiCodigo: '2', ativo: true },
    { codigo: '2.01.001', nome: 'Combustível e Lubrificantes', natureza: 'DESPESA', tipo: 'ANALITICA', paiCodigo: '2.01', ativo: true },
    { codigo: '2.01.002', nome: 'Manutenção de Equipamentos', natureza: 'DESPESA', tipo: 'ANALITICA', paiCodigo: '2.01', ativo: true },
    { codigo: '2.01.003', nome: 'Salários e Encargos Operacionais', natureza: 'DESPESA', tipo: 'ANALITICA', paiCodigo: '2.01', ativo: true },
    { codigo: '2.02', nome: 'Despesa Administrativa', natureza: 'DESPESA', tipo: 'SINTETICA', paiCodigo: '2', ativo: true },
    { codigo: '2.02.001', nome: 'Salários e Encargos Administrativos', natureza: 'DESPESA', tipo: 'ANALITICA', paiCodigo: '2.02', ativo: true },
    { codigo: '2.02.002', nome: 'Software e Licenças', natureza: 'DESPESA', tipo: 'ANALITICA', paiCodigo: '2.02', ativo: true },
  ];
  const contasMap = new Map<string, string>();
  for (const conta of contas) {
    const paiId = conta.paiCodigo ? contasMap.get(conta.paiCodigo) ?? null : null;
    const row = await prisma.cadastroPlanoContas.upsert({
      where: { tenantId_codigo: { tenantId: DEFAULT_TENANT, codigo: conta.codigo } },
      update: {
        nome: conta.nome,
        natureza: conta.natureza,
        tipo: conta.tipo,
        paiId,
        ativo: conta.ativo,
        deletedAt: null,
      },
      create: {
        tenantId: DEFAULT_TENANT,
        codigo: conta.codigo,
        nome: conta.nome,
        natureza: conta.natureza,
        tipo: conta.tipo,
        paiId,
        ativo: conta.ativo,
      },
    });
    contasMap.set(conta.codigo, row.id);
  }

  // ========== TABELAS DE PREÇOS ==========
  const tabelaExistente = await prisma.cadastroTabelaPreco.findFirst({
    where: { tenantId: DEFAULT_TENANT, nome: 'Tabela Padrão 2026', deletedAt: null },
  });
  const tabelaGeral =
    tabelaExistente ??
    (await prisma.cadastroTabelaPreco.create({
      data: {
        tenantId: DEFAULT_TENANT,
        nome: 'Tabela Padrão 2026',
        descricao: 'Tabela padrão do terminal — armazenagem + operações',
        clienteId: null,
        moeda: 'BRL',
        dataInicio: new Date('2026-01-01'),
        dataFim: null,
        ativo: true,
        padrao: true,
      },
    }));

  await prisma.cadastroTabelaPreco.update({
    where: { id: tabelaGeral.id },
    data: { padrao: true, ativo: true, deletedAt: null },
  });

  await prisma.cadastroTabelaPrecoItem.deleteMany({ where: { tabelaId: tabelaGeral.id } });

  const faixasPadrao = [
    { diaInicio: 8, diaFim: 15, valorDiaria: 30 },
    { diaInicio: 16, diaFim: null, valorDiaria: 45 },
  ];
  const matrixSeed = [
    { tipo: 'DRY', cap: 'DC', tam: "20'", status: 'CHEIO' as const, handling: 150, free: 7 },
    { tipo: 'DRY', cap: 'DC', tam: "40'", status: 'CHEIO' as const, handling: 180, free: 7 },
    { tipo: 'DRY', cap: 'HC', tam: "40'", status: 'CHEIO' as const, handling: 200, free: 7 },
    { tipo: 'DRY', cap: 'DC', tam: "20'", status: 'VAZIO' as const, handling: 120, free: 10 },
    { tipo: 'REEFER', cap: null, tam: "40'", status: 'CHEIO' as const, handling: 250, free: 5, reefer: 45 },
  ];
  for (const m of matrixSeed) {
    await prisma.cadastroTabelaPrecoItem.create({
      data: {
        tabelaId: tabelaGeral.id,
        categoriaItem: 'ARMAZENAGEM',
        tipoOperacaoCodigo: 'ARMAZENAGEM',
        tipoContainerCodigo: m.tipo,
        capacidadeCodigo: m.cap,
        containerTamanho: m.tam,
        statusContainer: m.status,
        valor: 0,
        unidade: 'POR_CICLO',
        valorHandling: m.handling,
        freeTimeDias: m.free,
        faixasDiaria: faixasPadrao,
        tarifaEnergiaReeferDiaria: m.reefer ?? null,
      },
    });
  }

  const itensTabela = [
    { tipoOperacaoCodigo: 'BAIXA', tipoContainerCodigo: 'DRY', containerTamanho: "20'", valor: 180.0, unidade: 'POR_OPERACAO' },
    { tipoOperacaoCodigo: 'BAIXA', tipoContainerCodigo: 'DRY', containerTamanho: "40'", valor: 280.0, unidade: 'POR_OPERACAO' },
    { tipoOperacaoCodigo: 'BAIXA', tipoContainerCodigo: 'DRY', containerTamanho: "40'", valor: 320.0, unidade: 'POR_OPERACAO' },
    { tipoOperacaoCodigo: 'BAIXA', tipoContainerCodigo: 'REEFER', containerTamanho: "20'", valor: 220.0, unidade: 'POR_OPERACAO' },
    { tipoOperacaoCodigo: 'BAIXA', tipoContainerCodigo: 'REEFER', containerTamanho: "40'", valor: 350.0, unidade: 'POR_OPERACAO' },
    { tipoOperacaoCodigo: 'COLETA', tipoContainerCodigo: 'DRY', containerTamanho: "20'", valor: 160.0, unidade: 'POR_OPERACAO' },
    { tipoOperacaoCodigo: 'COLETA', tipoContainerCodigo: 'DRY', containerTamanho: "40'", valor: 250.0, unidade: 'POR_OPERACAO' },
    { tipoOperacaoCodigo: 'COLETA', tipoContainerCodigo: 'DRY', containerTamanho: "40'", valor: 290.0, unidade: 'POR_OPERACAO' },
    { tipoOperacaoCodigo: 'COLETA', tipoContainerCodigo: 'REEFER', containerTamanho: "40'", valor: 320.0, unidade: 'POR_OPERACAO' },
    { tipoOperacaoCodigo: 'TRANSFERENCIA', tipoContainerCodigo: '*', containerTamanho: '*', valor: 80.0, unidade: 'POR_OPERACAO' },
    { tipoOperacaoCodigo: 'INSPECAO', tipoContainerCodigo: '*', containerTamanho: '*', valor: 50.0, unidade: 'POR_OPERACAO' },
    { tipoOperacaoCodigo: 'REPARO', tipoContainerCodigo: '*', containerTamanho: '*', valor: 120.0, unidade: 'POR_HORA' },
  ];
  for (const item of itensTabela) {
    await prisma.cadastroTabelaPrecoItem.create({
      data: { ...item, tabelaId: tabelaGeral.id },
    });
  }

  await ensureDefaultPricingSynced(prisma, DEFAULT_TENANT);

  return ids;
}
