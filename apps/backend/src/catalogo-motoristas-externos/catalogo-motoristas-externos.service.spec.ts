import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CatalogoMotoristasExternosService } from './catalogo-motoristas-externos.service';

describe('CatalogoMotoristasExternosService', () => {
  const prisma = {
    catalogoMotoristaExterno: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };
  const service = new CatalogoMotoristasExternosService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('não registra CPF placeholder da frota FL', async () => {
    await service.registrarDaSolicitacao({
      cpf: '000.000.000-00',
      nome: 'Frota FL',
      origem: 'PORTAL',
    });
    expect(prisma.catalogoMotoristaExterno.findFirst).not.toHaveBeenCalled();
  });

  it('bloqueia motorista ainda suspenso', async () => {
    prisma.catalogoMotoristaExterno.findFirst.mockResolvedValue({
      id: 'm1',
      cpf: '39053344705',
      nome: 'João',
      origem: 'PORTAL',
      suspensoAte: new Date(Date.now() + 86_400_000),
      suspensaoDias: 7,
      suspensaoMotivo: 'pátio',
      updatedAt: new Date(),
    });
    await expect(service.assertNaoSuspenso('390.533.447-05')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('suspende com prazo e motivo', async () => {
    prisma.catalogoMotoristaExterno.findFirst.mockResolvedValue({
      id: 'm1',
      cpf: '39053344705',
      nome: 'João',
      origem: 'PORTAL',
      suspensoAte: null,
      suspensaoDias: null,
      suspensaoMotivo: null,
      updatedAt: new Date(),
    });
    prisma.catalogoMotoristaExterno.update.mockImplementation(({ data }: { data: object }) =>
      Promise.resolve({
        id: 'm1',
        cpf: '39053344705',
        nome: 'João',
        origem: 'PORTAL',
        updatedAt: new Date(),
        ...data,
      }),
    );
    const out = await service.suspender('m1', 7, 'desrespeito à regra', 'u1');
    expect(out.suspenso).toBe(true);
    expect(out.suspensaoDias).toBe(7);
    expect(prisma.catalogoMotoristaExterno.update).toHaveBeenCalled();
  });

  it('não suspende motorista de outro contexto', async () => {
    prisma.catalogoMotoristaExterno.findFirst.mockResolvedValue(null);
    await expect(service.suspender('x', 3, 'motivo ok', 'u1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
