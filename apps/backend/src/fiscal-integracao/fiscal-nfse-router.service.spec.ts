import { RetriableOutboxError } from '../outbox/outbox.errors';
import { FiscalNfseRouterService } from './fiscal-nfse-router.service';

const FATURA = { id: 'fat-1', tenantId: 'default', valorTotal: 100 } as never;
const CLIENTE = { id: 'cli-1', razaoSocial: 'Cliente QA' } as never;
const CTX = {
  containerIso: 'MSCU1234567',
  diasCobrados: 5,
  gateOutAt: new Date('2026-09-21T12:00:00Z'),
  outboxId: 'obx-1',
};

const EMITIDA_IPM = {
  mode: 'emitida' as const,
  numeroNfse: '123',
  linkNfse: 'https://ipm/nota/123',
  xmlResposta: '<nfse/>',
  rpsNumero: '9',
  rpsSerie: 'RPS',
};

const EMITIDA_NACIONAL = {
  ...EMITIDA_IPM,
  numeroNfse: '456',
  linkNfse: 'https://adn/danfse/chave',
};

function montar(opts?: {
  ipm?: Partial<{ emitir: jest.Mock; usesRealIpm: jest.Mock }>;
  nacionalConfig?: Record<string, unknown>;
  nacionalEmitir?: jest.Mock;
}) {
  const ipm = {
    usesRealIpm: opts?.ipm?.usesRealIpm ?? jest.fn(() => true),
    emitirParaFatura: opts?.ipm?.emitir ?? jest.fn().mockResolvedValue(EMITIDA_IPM),
  };
  const nacional = {
    config: jest.fn().mockResolvedValue({
      configured: true,
      ativacao: 'CONTINGENCIA',
      ambiente: 'homologacao',
      ...opts?.nacionalConfig,
    }),
    emitirParaFatura: opts?.nacionalEmitir ?? jest.fn().mockResolvedValue(EMITIDA_NACIONAL),
  };
  const alerts = { fiscalIpmDown: jest.fn().mockResolvedValue(undefined) };
  const router = new FiscalNfseRouterService(ipm as never, nacional as never, alerts as never);
  return { router, ipm, nacional, alerts };
}

describe('FiscalNfseRouterService', () => {
  it('emite pelo IPM quando ele responde', async () => {
    const { router, nacional } = montar();
    const r = await router.emitirParaFatura(FATURA, CLIENTE, CTX);
    expect(r.provedor).toBe('ipm');
    expect(nacional.emitirParaFatura).not.toHaveBeenCalled();
  });

  it('cai para o Emissor Nacional quando o IPM está indisponível', async () => {
    const { router, nacional, alerts } = montar({
      ipm: { emitir: jest.fn().mockRejectedValue(new RetriableOutboxError('IPM indisponível: timeout')) },
    });
    const r = await router.emitirParaFatura(FATURA, CLIENTE, CTX);
    expect(r.provedor).toBe('nacional');
    expect(r.motivoContingencia).toContain('timeout');
    expect(nacional.emitirParaFatura).toHaveBeenCalled();
    expect(alerts.fiscalIpmDown).toHaveBeenCalled();
  });

  it('não usa contingência para rejeição fiscal do IPM', async () => {
    const erro = new Error('NFS-e rejeitada: CNPJ do tomador inválido');
    const { router, nacional } = montar({ ipm: { emitir: jest.fn().mockRejectedValue(erro) } });
    await expect(router.emitirParaFatura(FATURA, CLIENTE, CTX)).rejects.toThrow('rejeitada');
    expect(nacional.emitirParaFatura).not.toHaveBeenCalled();
  });

  it('respeita o desligamento da integração nacional', async () => {
    const { router, nacional } = montar({
      ipm: { emitir: jest.fn().mockRejectedValue(new RetriableOutboxError('IPM fora do ar')) },
      nacionalConfig: { ativacao: 'DESLIGADO' },
    });
    await expect(router.emitirParaFatura(FATURA, CLIENTE, CTX)).rejects.toThrow(RetriableOutboxError);
    expect(nacional.emitirParaFatura).not.toHaveBeenCalled();
  });

  it('com ativação SEMPRE, nem chama o IPM', async () => {
    const { router, ipm } = montar({ nacionalConfig: { ativacao: 'SEMPRE' } });
    const r = await router.emitirParaFatura(FATURA, CLIENTE, CTX);
    expect(r.provedor).toBe('nacional');
    expect(ipm.emitirParaFatura).not.toHaveBeenCalled();
  });

  it('se os dois falharem, devolve erro retriável com os dois motivos', async () => {
    const { router } = montar({
      ipm: { emitir: jest.fn().mockRejectedValue(new RetriableOutboxError('IPM fora do ar')) },
      nacionalEmitir: jest.fn().mockRejectedValue(new Error('certificado vencido')),
    });
    await expect(router.emitirParaFatura(FATURA, CLIENTE, CTX)).rejects.toThrow(
      /IPM fora do ar \| Emissor Nacional: certificado vencido/,
    );
  });

  it('não usa contingência quando o terminal não configurou o Nacional', async () => {
    const { router, nacional } = montar({
      ipm: { emitir: jest.fn().mockRejectedValue(new RetriableOutboxError('IPM fora do ar')) },
      nacionalConfig: { configured: false },
    });
    await expect(router.emitirParaFatura(FATURA, CLIENTE, CTX)).rejects.toThrow('IPM fora do ar');
    expect(nacional.emitirParaFatura).not.toHaveBeenCalled();
  });
});
