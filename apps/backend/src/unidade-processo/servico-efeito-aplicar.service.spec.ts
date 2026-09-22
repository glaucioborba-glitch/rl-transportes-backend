import { BadRequestException } from '@nestjs/common';
import { ServicoEfeitoAplicarService } from './servico-efeito-aplicar.service';

describe('ServicoEfeitoAplicarService', () => {
  it('recusa destino que só existe no cadastro, sem estar no pátio', async () => {
    const prisma = {
      unidadeProcesso: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'up-a',
          tenantId: 'default',
          unidadeIso: 'AAAA1111111',
          clienteId: 'c1',
        }),
        findFirst: jest.fn().mockResolvedValue({
          id: 'up-b',
          tenantId: 'default',
          unidadeIso: 'BBBB2222222',
          clienteId: 'c1',
        }),
      },
      patioUnidade: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const svc = new ServicoEfeitoAplicarService(prisma as never, { persistHandlingCheio: jest.fn() } as never);

    await expect(
      svc.aplicar({
        processoId: 'up-a',
        item: { id: 'i1', tabelaId: 't1', codigo: 'TRANSBORDO', nome: 'Transbordo', efeito: 'TRANSBORDO_CARGA' },
        input: { isoDestino: 'BBBB2222222' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.patioUnidade.findFirst).toHaveBeenCalled();
  });

  it('grava a troca de lacre nas observações da RIC com antes e depois', async () => {
    const solicitacaoUpdate = jest.fn();
    const prisma = {
      unidadeProcesso: {
        findUnique: jest.fn().mockResolvedValue({
          unidadeIso: 'GCXU5119401',
          lacreSaida: null,
          lacreSaidaObservacao: null,
          entradaSolicitacaoId: 'sol-entrada',
          saidaSolicitacaoId: null,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      containerSolicitacao: {
        findMany: jest.fn().mockResolvedValue([{ unidade: 'GCXU5119401', lacre: 'CR0381735' }]),
      },
      solicitacao: {
        findUnique: jest.fn().mockResolvedValue({
          operacaoFluxoJson: { observacaoGate: 'Conferido na portaria.', vistoria: { ok: true } },
        }),
        update: solicitacaoUpdate,
      },
      cadastroServicoItem: { findFirst: jest.fn() },
    };
    const svc = new ServicoEfeitoAplicarService(prisma as never, { persistHandlingCheio: jest.fn() } as never);

    const out = await svc.aplicar({
      processoId: 'up-1',
      item: {
        id: 'i1',
        tabelaId: 't1',
        codigo: 'RETIRADA_EXCESSO',
        nome: 'RETIRADA DE EXCESSO',
        efeito: 'SUBSTITUIR_LACRE_SAIDA',
      },
      input: { lacre: 'LACREQA01', origemLacre: 'CLIENTE' },
    });

    expect(out.payload.efeito).toBe('SUBSTITUIR_LACRE_SAIDA');
    expect(prisma.unidadeProcesso.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lacreSaida: 'LACREQA01',
          lacreSaidaObservacao: 'RETIRADA DE EXCESSO: lacre CR0381735 → LACREQA01 (origem cliente).',
        }),
      }),
    );
    expect(solicitacaoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          operacaoFluxoJson: expect.objectContaining({
            observacaoGate: 'Conferido na portaria.',
            vistoria: { ok: true },
            observacoesEfeito: [
              'RETIRADA DE EXCESSO: lacre CR0381735 → LACREQA01 (origem cliente).',
            ],
          }),
        }),
      }),
    );
  });
});
