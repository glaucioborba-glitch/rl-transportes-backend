import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MovTipo, PatioStatus } from '@prisma/client';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { SecurityEventsService } from '../security-center/security-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { YardSnapshotService } from '../yard-read/yard-snapshot.service';
import { PatioV2Service } from './patio.service';

describe('PatioV2Service', () => {
  let service: PatioV2Service;
  let prisma: {
    patioUnidade: Record<string, jest.Mock>;
    patioPosicao: Record<string, jest.Mock>;
    patioMovimentacao: Record<string, jest.Mock>;
    containerSolicitacao: Record<string, jest.Mock>;
    solicitacao: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };
  let security: { emit: jest.Mock };

  beforeEach(async () => {
    security = { emit: jest.fn() };
    const tx = {
      patioUnidade: {
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      containerSolicitacao: { findMany: jest.fn() },
      patioMovimentacao: { create: jest.fn() },
      pilhaLogica: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    prisma = {
      patioUnidade: {
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      patioPosicao: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      patioMovimentacao: { create: jest.fn() },
      containerSolicitacao: {
        findMany: jest.fn().mockResolvedValue([
          { unidade: 'MSKU1234567', refrigerado: false, ordem: 1 },
        ]),
      },
      solicitacao: { update: jest.fn() },
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    };

    const mod = await Test.createTestingModule({
      providers: [
        PatioV2Service,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditoriaService, useValue: { registrar: jest.fn() } },
        { provide: SecurityEventsService, useValue: security },
        { provide: YardSnapshotService, useValue: { onYardMutation: jest.fn() } },
      ],
    }).compile();

    service = mod.get(PatioV2Service);
  });

  it('provisionFromGateIn cria PatioUnidade SEPARADO por container', async () => {
    const tx = {
      patioUnidade: { count: jest.fn().mockResolvedValue(0), create: jest.fn() },
      containerSolicitacao: {
        findMany: jest.fn().mockResolvedValue([{ unidade: 'TEMU6079348', refrigerado: true, ordem: 1 }]),
      },
    };
    const n = await service.provisionFromGateIn('gin1', 's1', tx as never);
    expect(n).toBe(1);
    expect(tx.patioUnidade.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: PatioStatus.SEPARADO, gateInId: 'gin1' }),
      }),
    );
  });

  it('posicionamento válido atualiza baia e status ESTOCADO', async () => {
    prisma.patioUnidade.findUnique.mockResolvedValue({
      id: 'u1',
      unidadeIso: 'TEMU6079348',
      solicitacaoId: 's1',
      posicaoAtualId: null,
      status: PatioStatus.SEPARADO,
      posicaoAtual: null,
      solicitacao: { clienteId: 'cli-1' },
    });
    prisma.patioPosicao.findUnique.mockResolvedValue({
      id: 'p1',
      codigoBaia: 'A01',
      capacidade: 4,
      unidadesAtuais: [],
      _count: { unidadesAtuais: 1 },
    });

    const txUpdate = jest.fn().mockResolvedValue({ id: 'u1', unidadeIso: 'TEMU6079348', solicitacaoId: 's1' });
    prisma.$transaction.mockImplementation(async (fn) =>
      fn({
        patioUnidade: { update: txUpdate },
        patioMovimentacao: { create: jest.fn().mockResolvedValue({ id: 'm1' }) },
        pilhaLogica: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn(),
          update: jest.fn(),
        },
        patioPosicao: { findUnique: jest.fn().mockResolvedValue({ id: 'p1', codigoBaia: 'A01' }) },
      }),
    );

    await service.posicionar('op1', { unidadeId: 'u1', codigoBaia: 'A01' });
    expect(txUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: PatioStatus.ESTOCADO, posicaoAtualId: 'p1' }),
      }),
    );
    expect(security.emit).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'PATIO_POSICIONAMENTO' }),
    );
  });

  it('movimentação para baia cheia → BadRequestException', async () => {
    prisma.patioUnidade.findUnique.mockResolvedValue({
      id: 'u1',
      unidadeIso: 'X',
      solicitacaoId: 's1',
      posicaoAtualId: 'p0',
      status: PatioStatus.ESTOCADO,
      posicaoAtual: { id: 'p0', codigoBaia: 'B01' },
      solicitacao: { clienteId: 'cli-1' },
    });
    prisma.patioPosicao.findUnique.mockResolvedValue({
      id: 'p1',
      codigoBaia: 'A01',
      capacidade: 2,
      unidadesAtuais: [{ id: 'other' }, { id: 'other2' }],
    });

    await expect(
      service.movimentar('op1', {
        unidadeId: 'u1',
        codigoBaiaDestino: 'A01',
        tipo: MovTipo.SHIFT,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('inventario detecta divergência unidade sem posição', async () => {
    prisma.patioPosicao.findMany.mockResolvedValue([
      {
        id: 'p1',
        codigoBaia: 'A01',
        comprimento: 12,
        largura: 3,
        capacidade: 4,
        unidadesAtuais: [],
      },
    ]);
    prisma.patioUnidade.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'u1', unidadeIso: 'ISO1', status: PatioStatus.SEPARADO, solicitacaoId: 's1' },
      ]);

    const inv = await service.inventario();
    expect(inv.divergencias).toHaveLength(1);
    expect(inv.divergencias[0].unidadeIso).toBe('ISO1');
  });

  it('historico unidade inexistente → NotFoundException', async () => {
    prisma.patioUnidade.findMany.mockResolvedValue([]);
    await expect(service.historicoUnidade('ZZZZ0000000')).rejects.toBeInstanceOf(NotFoundException);
  });
});
