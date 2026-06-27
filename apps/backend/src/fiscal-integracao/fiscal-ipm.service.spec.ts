import { ConfigService } from '@nestjs/config';
import { FiscalIpmService } from './fiscal-ipm.service';
import { IpmNfseAdapter } from '../nfse/nfse.adapter';
import type { Cliente, Fatura } from '@prisma/client';

describe('FiscalIpmService', () => {
  const ipm = {
    isConfigured: jest.fn().mockReturnValue(false),
    getPrestadorCnpj: jest.fn().mockReturnValue('27692077000126'),
    getPrestadorTom: jest.fn().mockReturnValue('8221'),
    emitir: jest.fn(),
  } as unknown as IpmNfseAdapter;

  const config = {
    get: jest.fn((key: string) => {
      if (key === 'banking.sandboxPublicBaseUrl') return 'http://localhost:3000/portal/financeiro';
      if (key === 'nfse.ipm.armazenagem') {
        return {
          codigoLocalPrestacao: '8221',
          codigoAtividade: '4930201',
          codigoItemListaServico: '160201',
          aliquotaPercent: 2,
          situacaoTributaria: '0',
        };
      }
      if (key === 'nfse.ipm.tomadorTomFallback') return '8221';
      return undefined;
    }),
  } as unknown as ConfigService;

  const svc = new FiscalIpmService(ipm, config);

  const cliente = {
    tipo: 'PJ',
    cpfCnpj: '19131243000197',
    razaoSocial: 'Cliente Teste LTDA',
    nomeFantasia: 'Cliente Teste',
    enderecoNumero: '100',
    enderecoComplemento: null,
    enderecoLogradouro: 'Rua A',
    enderecoBairro: 'Centro',
    enderecoUf: 'SC',
    enderecoCep: '88370700',
    codigoMunicipioIbge: '4211306',
    telefone: '4733334444',
    email: 'a@test.com',
    emailNfse: 'a@test.com',
    inscricaoEstadual: null,
    responsavelTelefone: null,
  } as Cliente;

  const fatura = {
    id: 'fat-1',
    valorTotal: { toNumber: () => 375 },
  } as unknown as Fatura;

  it('sandbox quando IPM não configurado', async () => {
    const r = await svc.emitirParaFatura(fatura, cliente, {
      containerIso: 'MSKU1234567',
      diasCobrados: 3,
      gateOutAt: new Date('2026-06-09T12:00:00Z'),
      outboxId: 'ob-1',
    });
    expect(r.mode).toBe('emitida');
    if (r.mode === 'emitida') {
      expect(r.numeroNfse).toContain('SANDBOX');
      expect(r.linkNfse).toContain('fat-1');
    }
  });
});
