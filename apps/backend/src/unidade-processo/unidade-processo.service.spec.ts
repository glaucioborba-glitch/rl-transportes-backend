import { BadRequestException, ConflictException } from '@nestjs/common';
import { StatusUnidadeProcesso, TipoOperacaoSolicitacaoIntent } from '@prisma/client';
import { UnidadeProcessoService } from './unidade-processo.service';

describe('UnidadeProcessoService.assertPodeCriarSolicitacao', () => {
  const patio = { provisionFromProcesso: jest.fn(), finalizeFromProcesso: jest.fn() };
  const billing = { openPreFaturasForProcesso: jest.fn(), consolidateOnProcesso: jest.fn() };
  const outbox = { enqueue: jest.fn() };

  function makeService(aberto: { numero: number; clienteId?: string } | null) {
    const prisma = {
      unidadeProcesso: {
        findFirst: jest.fn().mockResolvedValue(
          aberto
            ? {
                id: 'up1',
                numero: aberto.numero,
                clienteId: aberto.clienteId ?? 'c1',
                status: StatusUnidadeProcesso.ABERTO,
              }
            : null,
        ),
      },
      cadastroLocalTransporte: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    return new UnidadeProcessoService(prisma as never, patio as never, billing as never, outbox as never);
  }

  it('bloqueia coleta sem ID aberto', async () => {
    const svc = makeService(null);
    await expect(
      svc.assertPodeCriarSolicitacao({
        clienteId: 'c1',
        intent: TipoOperacaoSolicitacaoIntent.SOLICITAR_COLETA,
        containers: [{ unidade: 'MSKU1234567', status: 'VAZIO' }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('bloqueia nova entrada se o ISO já tem ID aberto', async () => {
    const svc = makeService({ numero: 1284 });
    await expect(
      svc.assertPodeCriarSolicitacao({
        clienteId: 'c1',
        intent: TipoOperacaoSolicitacaoIntent.SOLICITAR_BAIXA,
        containers: [{ unidade: 'MSKU1234567', status: 'CHEIO' }],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('bloqueia nova entrada no ISO de outro cliente sem vazar o número do ID', async () => {
    const svc = makeService({ numero: 9999, clienteId: 'outro' });
    await expect(
      svc.assertPodeCriarSolicitacao({
        clienteId: 'c1',
        intent: TipoOperacaoSolicitacaoIntent.SOLICITAR_BAIXA,
        containers: [{ unidade: 'MSKU1234567', status: 'CHEIO' }],
      }),
    ).rejects.toThrow(/já está em estoque/);
    await expect(
      svc.assertPodeCriarSolicitacao({
        clienteId: 'c1',
        intent: TipoOperacaoSolicitacaoIntent.SOLICITAR_BAIXA,
        containers: [{ unidade: 'MSKU1234567', status: 'CHEIO' }],
      }),
    ).rejects.not.toThrow(/9999/);
  });

  it('permite hospedar no pátio mesmo com aluguel aberto (IDs independentes)', async () => {
    const svc = makeService(null);
    await expect(
      svc.assertPodeCriarSolicitacao({
        clienteId: 'c1',
        intent: TipoOperacaoSolicitacaoIntent.SOLICITAR_BAIXA,
        containers: [{ unidade: 'RLAU1234567', status: 'VAZIO' }],
      }),
    ).resolves.toBeUndefined();
  });

  it('permite coleta quando há ID aberto', async () => {
    const svc = makeService({ numero: 1284 });
    await expect(
      svc.assertPodeCriarSolicitacao({
        clienteId: 'c1',
        intent: TipoOperacaoSolicitacaoIntent.SOLICITAR_COLETA,
        containers: [{ unidade: 'MSKU1234567', status: 'VAZIO' }],
      }),
    ).resolves.toBeUndefined();
  });

  it('não permite coleta no ISO aberto de outro cliente e não vaza o número do ID', async () => {
    const svc = makeService({ numero: 1284, clienteId: 'outro' });
    await expect(
      svc.assertPodeCriarSolicitacao({
        clienteId: 'c1',
        intent: TipoOperacaoSolicitacaoIntent.SOLICITAR_COLETA,
        containers: [{ unidade: 'MSKU1234567', status: 'VAZIO' }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
