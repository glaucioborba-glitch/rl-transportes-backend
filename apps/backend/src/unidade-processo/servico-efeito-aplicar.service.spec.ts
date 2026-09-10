import { BadRequestException } from '@nestjs/common';
import { ServicoEfeitoAplicarService } from './servico-efeito-aplicar.service';

describe('ServicoEfeitoAplicarService transbordo', () => {
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
});
