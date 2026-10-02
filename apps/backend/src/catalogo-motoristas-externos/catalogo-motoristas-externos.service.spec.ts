import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CatalogoMotoristasExternosService } from './catalogo-motoristas-externos.service';
import { MSG_MOTORISTA_INDISPONIVEL_PORTAL } from './catalogo-motoristas-externos.util';

describe('CatalogoMotoristasExternosService', () => {
  const prisma = {
    catalogoMotoristaExterno: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      upsert: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };
  const tenantCtx = { getTenantId: () => 'default' };
  const auth = {
    verifyGerenteCredentials: jest.fn().mockResolvedValue({ id: 'g1', role: 'GERENTE' }),
  };
  const service = new CatalogoMotoristasExternosService(
    prisma as never,
    tenantCtx as never,
    auth as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.catalogoMotoristaExterno.updateMany.mockResolvedValue({ count: 0 });
    auth.verifyGerenteCredentials.mockResolvedValue({ id: 'g1', role: 'GERENTE' });
  });

  it('não registra CPF placeholder da frota FL', async () => {
    await service.registrarDaSolicitacao({
      cpf: '000.000.000-00',
      nome: 'Frota FL',
      origem: 'PORTAL',
    });
    expect(prisma.catalogoMotoristaExterno.upsert).not.toHaveBeenCalled();
    expect(prisma.catalogoMotoristaExterno.findFirst).not.toHaveBeenCalled();
  });

  it('bloqueia motorista ainda suspenso com mensagem amigável', async () => {
    prisma.catalogoMotoristaExterno.findFirst.mockResolvedValue({
      id: 'm1',
      cpf: '39053344705',
      nome: 'João',
      origem: 'PORTAL',
      suspensoAte: new Date(Date.now() + 86_400_000),
      suspensaoDias: 7,
      suspensaoMotivo: 'pátio',
      suspensoEm: new Date(),
      updatedAt: new Date(),
    });
    await expect(service.assertNaoSuspenso('390.533.447-05')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.assertNaoSuspenso('390.533.447-05')).rejects.toMatchObject({
      message: MSG_MOTORISTA_INDISPONIVEL_PORTAL,
    });
  });

  it('suspende com prazo, início e autorização gerencial', async () => {
    prisma.catalogoMotoristaExterno.findFirst.mockResolvedValue({
      id: 'm1',
      cpf: '39053344705',
      nome: 'João',
      origem: 'PORTAL',
      suspensoAte: null,
      suspensaoDias: null,
      suspensaoMotivo: null,
      suspensoEm: null,
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
    const out = await service.suspender('m1', {
      dias: 7,
      motivo: 'desrespeito à regra',
      documento: '03650163900',
      password: 'x',
    });
    expect(out.suspenso).toBe(true);
    expect(out.suspensaoDias).toBe(7);
    expect(auth.verifyGerenteCredentials).toHaveBeenCalled();
    expect(prisma.catalogoMotoristaExterno.update).toHaveBeenCalled();
  });

  it('não suspende motorista de outro contexto', async () => {
    prisma.catalogoMotoristaExterno.findFirst.mockResolvedValue(null);
    await expect(
      service.suspender('x', {
        dias: 3,
        motivo: 'motivo ok',
        documento: '03650163900',
        password: 'x',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('grava CPF uma vez no catálogo de pré-preenchimento (upsert)', async () => {
    prisma.catalogoMotoristaExterno.upsert.mockResolvedValue({
      id: 'm1',
      cpf: '39053344705',
      nome: 'João Silva',
    });
    await service.registrarDaSolicitacao({
      cpf: '390.533.447-05',
      nome: 'João Silva',
      origem: 'PORTAL',
    });
    expect(prisma.catalogoMotoristaExterno.upsert).toHaveBeenCalledWith({
      where: { tenantId_cpf: { tenantId: 'default', cpf: '39053344705' } },
      create: {
        tenantId: 'default',
        cpf: '39053344705',
        nome: 'João Silva',
        origem: 'PORTAL',
      },
      update: { nome: 'João Silva', origem: 'PORTAL' },
    });
    expect(prisma.catalogoMotoristaExterno.create).not.toHaveBeenCalled();
  });
});
