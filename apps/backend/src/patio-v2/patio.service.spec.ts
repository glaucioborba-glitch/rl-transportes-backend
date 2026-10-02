jest.mock('../unidade-processo/tomada-diaria-id.util', () => ({
  sincronizarTomadaDiariaDoProcesso: jest.fn().mockResolvedValue(undefined),
}));

import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MovTipo, PatioStatus } from '@prisma/client';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { SecurityEventsService } from '../security-center/security-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { YardSnapshotService } from '../yard-read/yard-snapshot.service';
import { PatioV2Service } from './patio.service';
import { sincronizarTomadaDiariaDoProcesso } from '../unidade-processo/tomada-diaria-id.util';

describe('PatioV2Service', () => {
  let service: PatioV2Service;
  let prisma: {
    patioUnidade: Record<string, jest.Mock>;
    patioPosicao: Record<string, jest.Mock>;
    patioMovimentacao: Record<string, jest.Mock>;
    containerSolicitacao: Record<string, jest.Mock>;
    unidadeProcesso: Record<string, jest.Mock>;
    cadastroTipoContainer: Record<string, jest.Mock>;
    patioFilaTarefa: Record<string, jest.Mock>;
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
      patioMovimentacao: { create: jest.fn() },
      patioTomadaEvent: { create: jest.fn() },
      containerSolicitacao: { findMany: jest.fn(), update: jest.fn() },
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
      unidadeProcesso: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      cadastroTipoContainer: {
        findMany: jest.fn().mockResolvedValue([{ codigo: 'REEFER', tomadaReefer: true }]),
      },
      patioFilaTarefa: {
        findMany: jest.fn().mockResolvedValue([]),
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
      patioUnidade: { count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue({ id: 'u1' }) },
      patioTomadaEvent: { create: jest.fn() },
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
    expect(inv.unidades).toEqual([]);
  });

  it('inventario lista no saldo unidade sem baia', async () => {
    prisma.patioPosicao.findMany.mockResolvedValue([]);
    prisma.patioUnidade.findMany
      .mockResolvedValueOnce([
        {
          id: 'u1',
          unidadeIso: 'TEMU6079348',
          status: PatioStatus.SEPARADO,
          statusContainer: 'CHEIO',
          refrigerado: false,
          createdAt: new Date('2026-09-01T00:00:00.000Z'),
          posicaoAtual: null,
          solicitacao: {
            clienteId: 'c1',
            protocolo: 'P-1',
            cliente: { razaoSocial: 'ACME' },
            containersSolicitacao: [
              {
                unidade: 'TEMU6079348',
                booking: 'BKG-9',
                processo: 'PROC-44',
                navio: 'MSC LORETO',
                status: 'CHEIO',
                tamanho: '40HC',
              },
            ],
          },
          unidadeProcesso: { numero: 12, entradaEm: new Date('2026-09-01T00:00:00.000Z') },
        },
      ])
      .mockResolvedValueOnce([]);

    const inv = await service.inventario();
    expect(inv.lotacaoTotal).toBe(1);
    expect(inv.semBaia).toBe(1);
    expect(inv.unidades).toHaveLength(1);
    expect(inv.unidades[0]).toEqual(
      expect.objectContaining({
        unidadeIso: 'TEMU6079348',
        baia: null,
        zonaPatio: null,
        posicaoPatio: null,
        cliente: 'ACME',
        processoNumero: 12,
        processo: 'PROC-44',
        booking: 'BKG-9',
        navio: 'MSC LORETO',
        situacao: 'CHEIO',
        tamanho: '40',
        tamanhoLabel: "40'",
      }),
    );
  });

  it('conectarTomada amarra o ID aberto e sincroniza a diária', async () => {
    prisma.patioUnidade.findUnique.mockResolvedValue({
      id: 'u1',
      unidadeIso: 'TEMU6079348',
      refrigerado: false,
      unidadeProcessoId: null,
      solicitacaoId: 's1',
      solicitacao: {
        containersSolicitacao: [{ id: 'c1', unidade: 'TEMU6079348', tipo: 'REEFER', setPoint: -18 }],
      },
    });
    prisma.unidadeProcesso.findFirst.mockResolvedValue({ id: 'up1' });

    await service.conectarTomada('u1', 'op1', { setPoint: -18 });

    expect(sincronizarTomadaDiariaDoProcesso).toHaveBeenCalledWith(
      expect.anything(),
      'up1',
      expect.objectContaining({ userId: 'op1' }),
    );
  });

  it('historico unidade inexistente → NotFoundException', async () => {
    prisma.patioUnidade.findMany.mockResolvedValue([]);
    await expect(service.historicoUnidade('ZZZZ0000000')).rejects.toBeInstanceOf(NotFoundException);
  });
});
