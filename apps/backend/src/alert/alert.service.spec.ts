import { AlertService } from './alert.service';
import type { TenantAvisosConfig } from '../common/email/tenant-avisos.service';

const SEM_TENANT: TenantAvisosConfig = { smtp: {}, emailsAlerta: [], webhookHabilitado: false };

function criar(opts?: {
  env?: Record<string, string | undefined>;
  tenant?: Partial<TenantAvisosConfig>;
  emailEnviado?: boolean;
}) {
  const env = opts?.env ?? {};
  const config = { get: jest.fn((k: string) => env[k]) };
  const avisos = {
    carregar: jest.fn().mockResolvedValue({ ...SEM_TENANT, ...opts?.tenant }),
  };
  const email = {
    sendAlertaInterno: jest.fn().mockResolvedValue({
      enviado: opts?.emailEnviado ?? true,
      origem: 'tenant',
      destinatarios: ['ops@terminal.com.br'],
    }),
  };
  const service = new AlertService(config as never, avisos as never, email as never);
  return { service, avisos, email };
}

describe('AlertService', () => {
  const fetchOriginal = global.fetch;

  afterEach(() => {
    global.fetch = fetchOriginal;
    jest.restoreAllMocks();
  });

  it('só loga quando não há webhook nem e-mail configurado', async () => {
    const { service, email } = criar();
    await expect(service.fiscalIpmDown({ reason: 'timeout' })).resolves.toBeUndefined();
    expect(email.sendAlertaInterno).not.toHaveBeenCalled();
  });

  it('envia e-mail para a lista do terminal mesmo sem webhook', async () => {
    const { service, email } = criar({ tenant: { emailsAlerta: ['ops@terminal.com.br'] } });
    await expect(
      service.notify({ key: 'k1', severity: 'critical', title: 'T', message: 'M' }),
    ).resolves.toBe(true);
    expect(email.sendAlertaInterno).toHaveBeenCalledWith({
      assunto: 'T',
      corpoTexto: expect.stringContaining('Severidade: Crítico'),
    });
  });

  it('usa o webhook do terminal quando habilitado', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as never;
    const { service } = criar({
      env: { ALERT_WEBHOOK_URL: 'https://hooks.slack.com/env' },
      tenant: { webhookUrl: 'https://hooks.slack.com/terminal', webhookHabilitado: true },
    });
    await service.notify({ key: 'k2', severity: 'warning', title: 'T', message: 'M' });
    expect(fetchMock.mock.calls[0][0]).toBe('https://hooks.slack.com/terminal');
  });

  it('respeita o debounce em minutos do terminal', async () => {
    const { service, email } = criar({
      tenant: { emailsAlerta: ['ops@terminal.com.br'], debounceAlertasMin: 30 },
    });
    const payload = { key: 'k3', severity: 'critical' as const, title: 'T', message: 'M' };
    await expect(service.notify(payload)).resolves.toBe(true);
    await expect(service.notify(payload)).resolves.toBe(false);
    expect(email.sendAlertaInterno).toHaveBeenCalledTimes(1);
  });

  it('cai no destino do .env quando o terminal não tem lista', async () => {
    const { service, email } = criar({ env: { FINANCEIRO_NOTIFY_EMAIL: 'fin@rl.com.br' } });
    await expect(
      service.notify({ key: 'k4', severity: 'warning', title: 'T', message: 'M' }),
    ).resolves.toBe(true);
    expect(email.sendAlertaInterno).toHaveBeenCalled();
  });
});
