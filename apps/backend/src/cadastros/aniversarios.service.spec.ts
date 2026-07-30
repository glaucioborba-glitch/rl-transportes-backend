import { AniversariosService } from './aniversarios.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AniversariosService', () => {
  const prisma = {
    colaboradorFamiliar: {
      findMany: jest.fn(),
    },
  };

  const service = new AniversariosService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retorna aniversários ordenados nos próximos N dias', async () => {
    const year = new Date().getFullYear();
    const in5Days = new Date();
    in5Days.setDate(in5Days.getDate() + 5);
    const in20Days = new Date();
    in20Days.setDate(in20Days.getDate() + 20);

    prisma.colaboradorFamiliar.findMany.mockResolvedValue([
      {
        nome: 'Maria',
        parentesco: 'Cônjuge',
        dataAniversario: in20Days,
        colaborador: { nome: 'João', departamento: 'RH', cargo: 'Analista' },
      },
      {
        nome: 'Pedro',
        parentesco: 'Filho(a)',
        dataAniversario: in5Days,
        colaborador: { nome: 'João', departamento: 'RH', cargo: 'Analista' },
      },
    ]);

    const result = await service.getProximosAniversarios(30);
    expect(result).toHaveLength(2);
    expect(result[0].familiar).toBe('Pedro');
    expect(result[1].familiar).toBe('Maria');
    expect(result[0].colaborador).toBe('João');
    expect(result[0].dataAniversario.getFullYear()).toBeGreaterThanOrEqual(year);
  });
});
