import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { StatusSolicitacao, TipoUnidade } from '@prisma/client';
import { SolicitacoesService, VALID_STATUS_TRANSITIONS } from './solicitacoes.service';

describe('VALID_STATUS_TRANSITIONS', () => {
  it('PENDENTE -> APROVADO é permitido', () => {
    expect(VALID_STATUS_TRANSITIONS[StatusSolicitacao.PENDENTE]).toContain(
      StatusSolicitacao.APROVADO,
    );
  });

  it('CONCLUIDO -> PENDENTE não é permitido', () => {
    expect(
      VALID_STATUS_TRANSITIONS[StatusSolicitacao.CONCLUIDO].includes(StatusSolicitacao.PENDENTE),
    ).toBe(false);
  });
});

describe('SolicitacoesService.update transições', () => {
  it('lança BadRequestException com mensagem da especificação quando transição inválida', async () => {
    const prisma: any = {
      solicitacao: {
        findFirst: jest.fn().mockResolvedValue({
          id: '1',
          status: StatusSolicitacao.CONCLUIDO,
          cliente: {},
          unidades: [],
        }),
      },
    };
    const auditoria = { registrar: jest.fn() };
    const service = new SolicitacoesService(prisma, auditoria as any);

    await expect(
      service.update('1', { status: StatusSolicitacao.PENDENTE }, 'u'),
    ).rejects.toThrow(BadRequestException);

    try {
      await service.update('1', { status: StatusSolicitacao.PENDENTE }, 'u');
    } catch (e: unknown) {
      expect((e as BadRequestException).message).toContain(
        'Transição de status inválida: de CONCLUIDO para PENDENTE',
      );
    }
  });
});

describe('SolicitacoesService.addContainer', () => {
  const auditoria = { registrar: jest.fn().mockResolvedValue({}) };
  const tx = {
    unidade: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };
  const prisma: {
    solicitacao: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  } = {
    solicitacao: { findFirst: jest.fn() },
    $transaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const service = new SolicitacoesService(prisma as never, auditoria as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((fn: (t: typeof tx) => Promise<unknown>) => fn(tx));
  });

  it('cria container quando solicitação existe e ISO livre', async () => {
    prisma.solicitacao.findFirst.mockResolvedValue({ id: 's1' });
    tx.unidade.findUnique.mockResolvedValue(null);
    tx.unidade.create.mockResolvedValue({
      id: 'u1',
      solicitacaoId: 's1',
      numeroIso: 'TEMU6079348',
      tipo: TipoUnidade.IMPORT,
    });

    const r = await service.addContainer(
      {
        solicitacaoId: 's1',
        numeroIso: 'TEMU6079348',
        tipo: TipoUnidade.IMPORT,
      },
      'user-1',
    );
    expect(r.numeroIso).toBe('TEMU6079348');
    expect(auditoria.registrar).toHaveBeenCalled();
  });

  it('404 quando solicitação não existe', async () => {
    prisma.solicitacao.findFirst.mockResolvedValue(null);
    await expect(
      service.addContainer(
        {
          solicitacaoId: 'x',
          numeroIso: 'TEMU6079348',
          tipo: TipoUnidade.IMPORT,
        },
        'u',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('conflito quando ISO já existe', async () => {
    prisma.solicitacao.findFirst.mockResolvedValue({ id: 's1' });
    tx.unidade.findUnique.mockResolvedValue({ id: 'other' });
    await expect(
      service.addContainer(
        {
          solicitacaoId: 's1',
          numeroIso: 'TEMU6079348',
          tipo: TipoUnidade.IMPORT,
        },
        'u',
      ),
    ).rejects.toThrow(ConflictException);
  });
});

describe('SolicitacoesService.registerPortaria', () => {
  const auditoria = { registrar: jest.fn().mockResolvedValue({}) };
  const tx = {
    portaria: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const prisma: {
    solicitacao: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  } = {
    solicitacao: { findFirst: jest.fn() },
    $transaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const service = new SolicitacoesService(prisma as never, auditoria as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((fn: (t: typeof tx) => Promise<unknown>) => fn(tx));
  });

  it('cria portaria quando não existe', async () => {
    prisma.solicitacao.findFirst.mockResolvedValue({ id: 's1' });
    tx.portaria.findUnique.mockResolvedValue(null);
    tx.portaria.create.mockResolvedValue({
      id: 'p1',
      solicitacaoId: 's1',
      placaVeiculo: 'ABCD1D34',
    });

    await service.registerPortaria({ solicitacaoId: 's1', placa: 'ABCD1D34' }, 'u');
    expect(tx.portaria.create).toHaveBeenCalled();
    expect(auditoria.registrar).toHaveBeenCalled();
  });

  it('atualiza portaria quando já existe', async () => {
    prisma.solicitacao.findFirst.mockResolvedValue({ id: 's1' });
    tx.portaria.findUnique.mockResolvedValue({
      id: 'p1',
      solicitacaoId: 's1',
      placaVeiculo: 'AAAA1A11',
    });
    tx.portaria.update.mockResolvedValue({
      id: 'p1',
      solicitacaoId: 's1',
      placaVeiculo: 'ABCD1D34',
    });

    await service.registerPortaria({ solicitacaoId: 's1', placa: 'ABCD1D34' }, 'u');
    expect(tx.portaria.update).toHaveBeenCalled();
    expect(auditoria.registrar).toHaveBeenCalled();
  });
});
