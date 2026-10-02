import { resolveDebounceAlertaMs, resolveWebhookAlerta } from './resolve-canal-alerta.util';

describe('resolveWebhookAlerta', () => {
  it('usa o webhook do terminal quando habilitado', () => {
    const r = resolveWebhookAlerta(
      { url: 'https://hooks.slack.com/terminal', habilitado: true },
      'https://hooks.slack.com/env',
    );
    expect(r).toEqual({ origem: 'tenant', url: 'https://hooks.slack.com/terminal' });
  });

  it('ignora o webhook do terminal quando desabilitado', () => {
    const r = resolveWebhookAlerta(
      { url: 'https://hooks.slack.com/terminal', habilitado: false },
      'https://hooks.slack.com/env',
    );
    expect(r).toEqual({ origem: 'env', url: 'https://hooks.slack.com/env' });
  });

  it('cai no .env quando o terminal está habilitado sem URL', () => {
    const r = resolveWebhookAlerta({ url: '  ', habilitado: true }, 'https://hooks.slack.com/env');
    expect(r.origem).toBe('env');
  });

  it('marca none sem webhook em lugar nenhum', () => {
    expect(resolveWebhookAlerta(undefined, undefined)).toEqual({ origem: 'none', url: '' });
  });
});

describe('resolveDebounceAlertaMs', () => {
  it('converte os minutos do terminal em milissegundos', () => {
    expect(resolveDebounceAlertaMs(5, '60000')).toBe(300_000);
  });

  it('usa o .env quando o terminal não define', () => {
    expect(resolveDebounceAlertaMs(undefined, '60000')).toBe(60_000);
  });

  it('cai no padrão de 15 min com valores inválidos', () => {
    expect(resolveDebounceAlertaMs(0, 'abc')).toBe(900_000);
    expect(resolveDebounceAlertaMs(undefined, undefined)).toBe(900_000);
  });
});
