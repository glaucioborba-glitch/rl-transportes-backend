import { resolveSmtpConfig } from './resolve-smtp-config.util';

describe('resolveSmtpConfig', () => {
  it('usa o SMTP do terminal quando o host está preenchido', () => {
    const r = resolveSmtpConfig(
      { host: 'smtp.env.com', port: '587', user: 'env', pass: 'envpass' },
      { host: 'smtp.tenant.com', porta: 465, usuario: 'tenant', senha: 'tenantpass' },
    );
    expect(r.origem).toBe('tenant');
    expect(r.host).toBe('smtp.tenant.com');
    expect(r.port).toBe(465);
    expect(r.secure).toBe(true);
    expect(r.user).toBe('tenant');
    expect(r.pass).toBe('tenantpass');
  });

  it('cai no .env quando o terminal não tem host', () => {
    const r = resolveSmtpConfig(
      { host: 'smtp.env.com', port: '587', user: 'env', pass: 'envpass' },
      { host: '   ', porta: 465, usuario: 'tenant' },
    );
    expect(r.origem).toBe('env');
    expect(r.host).toBe('smtp.env.com');
    expect(r.port).toBe(587);
    expect(r.secure).toBe(false);
  });

  it('marca não configurado sem host em lugar nenhum', () => {
    const r = resolveSmtpConfig({}, undefined);
    expect(r.origem).toBe('none');
    expect(r.configurado).toBe(false);
    expect(r.port).toBe(587);
  });

  it('usa porta 587 quando a porta do terminal é inválida', () => {
    const r = resolveSmtpConfig({}, { host: 'smtp.tenant.com', porta: 0 });
    expect(r.port).toBe(587);
    expect(r.secure).toBe(false);
  });

  it('aceita SMTP do terminal sem usuário (relay aberto interno)', () => {
    const r = resolveSmtpConfig({ host: 'smtp.env.com' }, { host: 'smtp.interno.local' });
    expect(r.origem).toBe('tenant');
    expect(r.user).toBe('');
    expect(r.configurado).toBe(true);
  });
});
