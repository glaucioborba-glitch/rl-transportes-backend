import { ConfigService } from '@nestjs/config';
import { BankingBoletoService } from './banking-boleto.service';
import type { Cliente, Fatura } from '@prisma/client';

describe('BankingBoletoService', () => {
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'banking.provider') return 'sandbox';
      if (key === 'banking.sandboxPublicBaseUrl') return 'http://localhost:3000/portal/financeiro';
      if (key === 'banking.vencimentoDias') return 7;
      return '';
    }),
  } as unknown as ConfigService;

  const svc = new BankingBoletoService(config);

  it('gera boleto sandbox com PIX', async () => {
    const fatura = { id: 'fat-abc-123', valorTotal: { toString: () => '375.00' } } as Fatura;
    const cliente = {
      razaoSocial: 'Cliente',
      cpfCnpj: '19131243000197',
      email: 'a@test.com',
      emailNfse: 'a@test.com',
    } as Cliente;

    const r = await svc.registrarBoleto(fatura, cliente, {
      gateOutAt: new Date('2026-06-09T12:00:00Z'),
      containerIso: 'MSKU1234567',
    });

    expect(r.provedor).toBe('sandbox');
    expect(r.linkPdf).toContain('fat-abc-123');
    expect(r.pixCopiaCola).toContain('br.gov.bcb.pix');
  });
});
