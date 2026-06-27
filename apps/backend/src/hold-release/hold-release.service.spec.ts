import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { TipoBloqueioContainer } from '@prisma/client';
import { HoldReleaseService } from './hold-release.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantConfigService } from '../tenant/tenant-config.service';
import { ActiveTenantsService } from '../tenant/active-tenants.service';

describe('HoldReleaseService', () => {
  let service: HoldReleaseService;
  let prisma: {
    bloqueioContainer: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    solicitacao: { findFirst: jest.Mock; findMany: jest.Mock };
    unidade: { updateMany: jest.Mock };
    boleto: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      bloqueioContainer: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      solicitacao: { findFirst: jest.fn(), findMany: jest.fn() },
      unidade: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      boleto: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
    };

    const mod = await Test.createTestingModule({
      providers: [
        HoldReleaseService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: TenantConfigService,
          useValue: {
            getParametros: jest.fn().mockResolvedValue({
              parametros: { operacao: { diasInadimplenciaBloqueio: 30 } },
            }),
          },
        },
        {
          provide: ActiveTenantsService,
          useValue: {
            listActiveTenantIds: jest.fn().mockResolvedValue(['default']),
          },
        },
      ],
    }).compile();

    service = mod.get(HoldReleaseService);
  });

  it('assertSemBloqueioAtivo lança ForbiddenException com mensagem padrão', async () => {
    prisma.bloqueioContainer.findFirst.mockResolvedValue({
      tipo: TipoBloqueioContainer.FINANCEIRO,
      motivo: 'Boleto vencido',
    });

    await expect(service.assertSemBloqueioAtivo('s1')).rejects.toThrow(
      'ACESSO NEGADO. Unidade possui bloqueio ativo do tipo FINANCEIRO. Motivo: Boleto vencido. Procure a administração.',
    );
  });

  it('aplicarBloqueio cria registro e sincroniza unidade', async () => {
    prisma.solicitacao.findFirst.mockResolvedValue({ id: 's1', tenantId: 'default' });
    prisma.bloqueioContainer.create.mockResolvedValue({
      id: 'b1',
      tipo: TipoBloqueioContainer.OPERACIONAL,
      motivo: 'Aguardando vistoria',
      status: 'ATIVO',
      bloqueadoPorId: 'u1',
      dataBloqueio: new Date('2026-06-01'),
      liberadoPorId: null,
      dataLiberacao: null,
    });

    const row = await service.aplicarBloqueio({
      solicitacaoId: 's1',
      tipo: TipoBloqueioContainer.OPERACIONAL,
      motivo: 'Aguardando vistoria',
      bloqueadoPorId: 'u1',
    });

    expect(row.tipo).toBe(TipoBloqueioContainer.OPERACIONAL);
    expect(prisma.unidade.updateMany).toHaveBeenCalled();
  });

  it('liberarBloqueioFinanceiro só libera quando cliente não tem títulos vencidos', async () => {
    jest.spyOn(service, 'clientePossuiInadimplenciaAtiva').mockResolvedValue(false);
    const releaseSpy = jest
      .spyOn(service, 'releaseFinancialHoldsForCliente')
      .mockResolvedValue({ liberados: 2 });

    const r = await service.liberarBloqueioFinanceiro('cli-1', 'default', 'SISTEMA');
    expect(r.liberados).toBe(2);
    expect(releaseSpy).toHaveBeenCalledWith('cli-1', 'SISTEMA');
  });

  it('liberarBloqueioFinanceiro mantém hold se ainda inadimplente', async () => {
    jest.spyOn(service, 'clientePossuiInadimplenciaAtiva').mockResolvedValue(true);
    const releaseSpy = jest.spyOn(service, 'releaseFinancialHoldsForCliente');

    const r = await service.liberarBloqueioFinanceiro('cli-1');
    expect(r.liberados).toBe(0);
    expect(releaseSpy).not.toHaveBeenCalled();
  });
});
