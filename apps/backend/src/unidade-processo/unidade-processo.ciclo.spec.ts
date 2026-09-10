import { BadRequestException, ConflictException } from '@nestjs/common';
import { StatusUnidadeProcesso, TipoOperacaoSolicitacaoIntent } from '@prisma/client';
import { UnidadeProcessoService } from './unidade-processo.service';

describe('UnidadeProcessoService ciclo', () => {
  type Aberto = {
    id: string;
    numero: number;
    clienteId: string;
    tenantId: string;
    unidadeIso: string;
    status: StatusUnidadeProcesso;
    saidaSolicitacaoId: string | null;
    entradaSolicitacaoId?: string;
  };

  const patio = { provisionFromProcesso: jest.fn(), finalizeFromProcesso: jest.fn() };
  const billing = { openPreFaturasForProcesso: jest.fn(), consolidateOnProcesso: jest.fn() };
  const outbox = { enqueue: jest.fn() };

  it('baixa abre ID, outro CNPJ não coleta, dono coleta e encerra', async () => {
    const box: { current: Aberto | null } = { current: null };

    const prisma = {
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx)),
      unidadeProcesso: {
        findFirst: jest.fn(async () => box.current),
      },
      cadastroLocalTransporte: { findFirst: jest.fn().mockResolvedValue(null) },
    };

    const tx = {
      solicitacao: {
        findUnique: jest.fn(),
      },
      unidadeProcesso: {
        findFirst: jest.fn(async (args: { where?: { clienteId?: string } }) => {
          if (!box.current) return null;
          if (args.where?.clienteId && args.where.clienteId !== box.current.clienteId) return null;
          return box.current;
        }),
        create: jest.fn(async ({
          data,
        }: {
          data: { clienteId: string; tenantId: string; unidadeIso: string; entradaSolicitacaoId?: string };
        }) => {
          box.current = {
            id: 'up1',
            numero: 1284,
            clienteId: data.clienteId,
            tenantId: data.tenantId,
            unidadeIso: data.unidadeIso,
            status: StatusUnidadeProcesso.ABERTO,
            saidaSolicitacaoId: null,
            entradaSolicitacaoId: data.entradaSolicitacaoId ?? 'sol-in',
          };
          return box.current;
        }),
        update: jest.fn(async () => {
          const prev = box.current;
          if (prev) {
            box.current = { ...prev, status: StatusUnidadeProcesso.ENCERRADO };
          }
          return prev;
        }),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ n: 1284 }]),
    };

    const svc = new UnidadeProcessoService(
      prisma as never,
      patio as never,
      billing as never,
      outbox as never,
    );

    tx.solicitacao.findUnique.mockResolvedValueOnce({
      id: 'sol-in',
      tipoOperacao: TipoOperacaoSolicitacaoIntent.SOLICITAR_BAIXA,
      cliente: { id: 'c1', tenantId: 'default' },
      containersSolicitacao: [{ unidade: 'MSKU1234567', refrigerado: false, setPoint: null }],
      gateCheckIns: [],
    });

    await svc.onLiberarOperacao('sol-in', 'actor', tx as never);
    expect(box.current?.numero).toBe(1284);
    expect(billing.openPreFaturasForProcesso).toHaveBeenCalled();

    await expect(
      svc.assertPodeCriarSolicitacao({
        clienteId: 'c-outro',
        intent: TipoOperacaoSolicitacaoIntent.SOLICITAR_COLETA,
        containers: [{ unidade: 'MSKU1234567', status: 'VAZIO' }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      svc.assertPodeCriarSolicitacao({
        clienteId: 'c1',
        intent: TipoOperacaoSolicitacaoIntent.SOLICITAR_COLETA,
        containers: [{ unidade: 'MSKU1234567', status: 'VAZIO' }],
      }),
    ).resolves.toBeUndefined();

    await expect(
      svc.assertPodeCriarSolicitacao({
        clienteId: 'c1',
        intent: TipoOperacaoSolicitacaoIntent.SOLICITAR_BAIXA,
        containers: [{ unidade: 'MSKU1234567', status: 'CHEIO' }],
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    tx.solicitacao.findUnique.mockResolvedValueOnce({
      id: 'sol-out',
      tipoOperacao: TipoOperacaoSolicitacaoIntent.SOLICITAR_COLETA,
      cliente: { id: 'c1', tenantId: 'default' },
      containersSolicitacao: [{ unidade: 'MSKU1234567', refrigerado: false, setPoint: null }],
      gateCheckIns: [],
    });

    await svc.onLiberarOperacao('sol-out', 'actor', tx as never);
    expect(billing.consolidateOnProcesso).toHaveBeenCalledWith('up1', expect.any(Date), tx);
    expect(box.current?.status).toBe(StatusUnidadeProcesso.ENCERRADO);
  });

  it('emite o ID na RIC e não reabre no liberar', async () => {
    const box: { current: Aberto | null } = { current: null };
    const tx = {
      solicitacao: { findUnique: jest.fn() },
      unidadeProcesso: {
        findFirst: jest.fn(async () => box.current),
        create: jest.fn(async ({ data }: { data: { clienteId: string; tenantId: string; unidadeIso: string } }) => {
          box.current = {
            id: 'up1',
            numero: 42,
            clienteId: data.clienteId,
            tenantId: data.tenantId,
            unidadeIso: data.unidadeIso,
            status: StatusUnidadeProcesso.ABERTO,
            saidaSolicitacaoId: null,
            entradaSolicitacaoId: 'sol-in',
          };
          return box.current;
        }),
        update: jest.fn(),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ n: 42 }]),
    };
    const prisma = {
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx)),
      unidadeProcesso: { findFirst: jest.fn() },
      cadastroLocalTransporte: { findFirst: jest.fn() },
    };
    const svc = new UnidadeProcessoService(
      prisma as never,
      patio as never,
      billing as never,
      outbox as never,
    );
    const solIn = {
      id: 'sol-in',
      tipoOperacao: TipoOperacaoSolicitacaoIntent.SOLICITAR_BAIXA,
      cliente: { id: 'c1', tenantId: 'default' },
      containersSolicitacao: [{ unidade: 'MSKU1234567', refrigerado: false, setPoint: null }],
      gateCheckIns: [],
    };
    tx.solicitacao.findUnique.mockResolvedValue(solIn);

    await svc.ensureIdNaEmissaoRic('sol-in', 'actor');
    expect(tx.unidadeProcesso.create).toHaveBeenCalledTimes(1);
    expect(box.current?.numero).toBe(42);

    await svc.onLiberarOperacao('sol-in', 'actor', tx as never);
    expect(tx.unidadeProcesso.create).toHaveBeenCalledTimes(1);
  });
});
