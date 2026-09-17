import { ConfigService } from '@nestjs/config';
import { BankingBoletoService } from './banking-boleto.service';
import type { Cliente, Fatura } from '@prisma/client';

jest.mock('qrcode', () => ({
  __esModule: true,
  default: {
    toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,ZmFrZQ=='),
  },
}));

describe('BankingBoletoService', () => {
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'banking.provider') return 'sandbox';
      if (key === 'banking.sandboxPublicBaseUrl') return 'http://localhost:3000/portal/financeiro';
      if (key === 'banking.vencimentoDias') return 7;
      return '';
    }),
  } as unknown as ConfigService;

  const integrationCreds = {
    peekBanking: () => ({ configured: false, provider: 'sandbox', origem: 'none', lockedByEnv: false }),
    resolveBanking: async () => ({
      configured: false,
      provider: 'sandbox',
      origem: 'none',
      lockedByEnv: false,
    }),
    resolvePix: async () => ({
      configured: false,
      origem: 'none',
      lockedByEnv: false,
      chavePixPresent: false,
    }),
  };
  const svc = new BankingBoletoService(config, integrationCreds as never);

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

  it('gera PIX sandbox para crédito na conta corrente', async () => {
    const r = await svc.gerarPixCobranca({
      referencia: 'CC-CLIENTE01-123',
      valor: 80,
      descricao: 'Crédito conta corrente',
      cliente: {
        razaoSocial: 'Cliente',
        cpfCnpj: '19131243000197',
        email: 'a@test.com',
        emailNfse: 'a@test.com',
      },
    });

    expect(r.sandbox).toBe(true);
    expect(r.provedor).toBe('sandbox');
    expect(r.pixCopiaCola).toContain('br.gov.bcb.pix');
    expect(r.pixQrCodeUrl).toMatch(/^data:image\/png;base64,/);
  });
});
