import {
  DEFAULT_TENANT,
  ensureTenant,
  gerarCnpj,
  gerarCpf,
  getPrisma,
  type SeedCadastrosIds,
} from './seed-utils';

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
    { codigo: 'DRY', nome: 'Dry Standard', tamanhos: ['20DC', '40DC'], tomadaReefer: false, ativo: true },
    { codigo: 'HC', nome: 'High Cube', tamanhos: ['40HC', '45HC'], tomadaReefer: false, ativo: true },
    { codigo: 'REEFER', nome: 'Reefer (Refrigerado)', tamanhos: ['20RF', '40RF'], tomadaReefer: true, ativo: true },
    { codigo: 'OT', nome: 'Open Top', tamanhos: ['20OT', '40OT'], tomadaReefer: false, ativo: true },
    { codigo: 'FR', nome: 'Flat Rack', tamanhos: ['20FR', '40FR'], tomadaReefer: false, ativo: true },
    { codigo: 'TANK', nome: 'Tank', tamanhos: ['20TK'], tomadaReefer: false, ativo: true },
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

  return ids;
}
