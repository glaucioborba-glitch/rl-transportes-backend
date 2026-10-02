import { Test, TestingModule } from '@nestjs/testing';
import { StatusPagamentoFatura } from '@prisma/client';
import { HoldReleaseService } from '../hold-release/hold-release.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConciliacaoService } from './conciliacao.service';

describe('ConciliacaoService', () => {
  let service: ConciliacaoService;
  let prisma: {
    fatura: { findFirst: jest.Mock; update: jest.Mock };
    boleto: { findFirst: jest.Mock; updateMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let holdRelease: { liberarBloqueioFinanceiro: jest.Mock };

  beforeEach(async () => {
    prisma = {
      fatura: { findFirst: jest.fn(), update: jest.fn() },
      boleto: { findFirst: jest.fn(), updateMany: jest.fn() },
      $transaction: jest.fn(async (fn: (tx: typeof prisma) => Promise<void>) => fn(prisma)),
    };
    holdRelease = { liberarBloqueioFinanceiro: jest.fn().mockResolvedValue({ liberados: 1 }) };

    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        ConciliacaoService,
        { provide: PrismaService, useValue: prisma },
        { provide: HoldReleaseService, useValue: holdRelease },
      ],
    }).compile();

    service = mod.get(ConciliacaoService);
  });

  it('baixa fatura quando valor confere e dispara desbloqueio STP', async () => {
    prisma.fatura.findFirst.mockResolvedValue({
      id: 'fat-1',
      clienteId: 'cli-1',
      valorTotal: { toFixed: () => '100.00' },
      valorAtualizado: null,
      faturamentoId: null,
    });
    prisma.fatura.update.mockResolvedValue({});

    const result = await service.processarRetorno('arq-1', 'default', {
      nomeArquivo: 'CB080601.RET',
      linhas: [
        {
          nossoNumero: '12345',
          valorPago: 100,
          dataPagamento: new Date('2026-06-01'),
          codigoMovimento: '06',
        },
      ],
    });

    expect(result.faturasBaixadas).toBe(1);
    expect(prisma.fatura.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'fat-1' },
        data: expect.objectContaining({ statusPagamento: StatusPagamentoFatura.PAGO }),
      }),
    );
    expect(holdRelease.liberarBloqueioFinanceiro).toHaveBeenCalledWith('cli-1', 'default', 'SISTEMA');
    expect(result.clientesDesbloqueados).toBe(1);
  });

  it('registra fatura não encontrada com mensagem para tesouraria', async () => {
    prisma.fatura.findFirst.mockResolvedValue(null);
    prisma.boleto.findFirst.mockResolvedValue(null);

    const result = await service.processarRetorno('arq-1', 'default', {
      nomeArquivo: 'CB080601.RET',
      linhas: [{ nossoNumero: '99999', valorPago: 50, dataPagamento: new Date(), codigoMovimento: '06' }],
    });

    expect(result.faturasNaoEncontradas).toBe(1);
    expect(result.erros[0]!.motivo).toContain('99999');
    expect(result.erros[0]!.motivo).toContain('não encontrado');
  });

  it('rejeita pagamento a menor sem baixa', async () => {
    prisma.fatura.findFirst.mockResolvedValue({
      id: 'fat-2',
      clienteId: 'cli-2',
      valorTotal: { toFixed: () => '200.00' },
      valorAtualizado: null,
      faturamentoId: null,
    });

    const result = await service.processarRetorno('arq-1', 'default', {
      nomeArquivo: 'CB080601.RET',
      linhas: [{ nossoNumero: '12345', valorPago: 80, dataPagamento: new Date(), codigoMovimento: '06' }],
    });

    expect(result.faturasValorDivergente).toBe(1);
    expect(result.faturasBaixadas).toBe(0);
    expect(result.erros[0]!.motivo).toContain('pago a menor');
    expect(holdRelease.liberarBloqueioFinanceiro).not.toHaveBeenCalled();
  });
});
