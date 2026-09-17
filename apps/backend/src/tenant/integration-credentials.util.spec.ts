import {
  mergeIntegracoesCredenciais,
  parseGoogleServiceAccountJson,
  resolveGoogleMaps,
  resolveGoogleVision,
  resolveS3,
  resolveWhatsapp,
  sanitizeTenantParametrosForClient,
  snapshotIntegrationEnv,
} from './integration-credentials.util';

const SERVICE_ACCOUNT = {
  type: 'service_account',
  project_id: 'rl-demo',
  client_email: 'ocr@rl-demo.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\\nfake\\n-----END PRIVATE KEY-----\\n',
};

describe('integration-credentials.util', () => {
  it('aceita JSON de service account e rejeita API key', () => {
    const parsed = parseGoogleServiceAccountJson(JSON.stringify(SERVICE_ACCOUNT));
    expect(parsed.clientEmail).toBe('ocr@rl-demo.iam.gserviceaccount.com');
    expect(() => parseGoogleServiceAccountJson('{"apiKey":"x"}')).toThrow(/service account/i);
  });

  it('env da Vision vence o JSON gravado no tenant', () => {
    const env = snapshotIntegrationEnv({
      GOOGLE_CREDENTIALS_JSON: JSON.stringify(SERVICE_ACCOUNT),
    });
    const resolved = resolveGoogleVision(env, {
      credentialsJson: JSON.stringify({ ...SERVICE_ACCOUNT, client_email: 'outro@x.com' }),
    });
    expect(resolved.origem).toBe('env');
    expect(resolved.lockedByEnv).toBe(true);
    expect(resolved.clientEmail).toBe('ocr@rl-demo.iam.gserviceaccount.com');
  });

  it('aceita API key da Vision gravada no tenant', () => {
    const resolved = resolveGoogleVision(snapshotIntegrationEnv({}), { apiKey: 'AIza-teste' });
    expect(resolved.origem).toBe('tenant');
    expect(resolved.configured).toBe(true);
    expect(resolved.apiKey).toBe('AIza-teste');
  });

  it('usa Vision do tenant quando o ambiente não tem credencial', () => {
    const resolved = resolveGoogleVision(snapshotIntegrationEnv({}), {
      credentialsJson: JSON.stringify(SERVICE_ACCOUNT),
    });
    expect(resolved.origem).toBe('tenant');
    expect(resolved.configured).toBe(true);
    expect(resolved.clientEmail).toBe('ocr@rl-demo.iam.gserviceaccount.com');
  });

  it('não troca token do WhatsApp quando o patch omite o campo', () => {
    const merged = mergeIntegracoesCredenciais(
      { whatsapp: { accessToken: 'secret', phoneNumberId: '111', enabled: true } },
      { whatsapp: { phoneNumberId: '222' } },
    );
    expect(merged.whatsapp?.accessToken).toBe('secret');
    expect(merged.whatsapp?.phoneNumberId).toBe('222');
  });

  it('apaga o JSON da Vision quando o patch manda string vazia', () => {
    const merged = mergeIntegracoesCredenciais(
      { googleVision: { credentialsJson: JSON.stringify(SERVICE_ACCOUNT) } },
      { googleVision: { credentialsJson: '   ' } },
    );
    expect(merged.googleVision).toBeUndefined();
  });

  it('habilita WhatsApp pelo tenant se WHATSAPP_ENABLED não estiver no ambiente', () => {
    const resolved = resolveWhatsapp(snapshotIntegrationEnv({}), {
      enabled: true,
      accessToken: 'tok',
      phoneNumberId: '123',
    });
    expect(resolved.enabled).toBe(true);
    expect(resolved.configured).toBe(true);
    expect(resolved.origem).toBe('tenant');
  });

  it('S3 do ambiente trava a tela e não usa chave do tenant', () => {
    const resolved = resolveS3(
      snapshotIntegrationEnv({
        AWS_S3_BUCKET: 'rl-transportes',
        AWS_ACCESS_KEY_ID: 'env-key',
        AWS_SECRET_ACCESS_KEY: 'env-secret',
        STORAGE_ENDPOINT: 'http://localhost:9000',
      }),
      { bucket: 'outro', accessKeyId: 'tela', secretAccessKey: 'tela' },
    );
    expect(resolved.origem).toBe('env');
    expect(resolved.lockedByEnv).toBe(true);
    expect(resolved.accessKeyId).toBe('env-key');
    expect(resolved.bucket).toBe('rl-transportes');
  });

  it('grava Google Maps, Routes e PIX autônomo no tenant', () => {
    const merged = mergeIntegracoesCredenciais(
      {},
      {
        googleMaps: { apiKey: 'AIza-maps' },
        googleRoutes: { apiKey: 'AIza-routes' },
        pix: { apiBaseUrl: 'https://pix.exemplo/api', apiToken: 'pix-tok', chavePix: '03650163900' },
        boleto: { apiBaseUrl: 'https://boleto.exemplo/api', apiToken: 'bol-tok' },
      },
    );
    expect(merged.googleMaps?.apiKey).toBe('AIza-maps');
    expect(merged.googleRoutes?.apiKey).toBe('AIza-routes');
    expect(merged.pix?.chavePix).toBe('03650163900');
    expect(merged.boleto?.apiToken).toBe('bol-tok');
    expect(merged.banking?.apiToken).toBe('bol-tok');
  });

  it('env do Maps vence a chave do tenant e não mistura com Routes', () => {
    const resolved = resolveGoogleMaps(
      snapshotIntegrationEnv({ GOOGLE_MAPS_API_KEY: 'env-key' }),
      { apiKey: 'tenant-key' },
    );
    expect(resolved.origem).toBe('env');
    expect(resolved.lockedByEnv).toBe(true);
    expect(resolved.apiKey).toBe('env-key');
  });

  it('remove credenciais cruas do payload enviado ao cliente', () => {
    const clean = sanitizeTenantParametrosForClient({
      branding: { corPrimaria: '#14b8a6' },
      integracoesCredenciais: { whatsapp: { accessToken: 'secret' } },
      nfse: { certificadoBase64: 'abc', certificadoSenha: '123' },
    });
    expect(clean).not.toHaveProperty('integracoesCredenciais');
    expect(clean.nfse).toEqual({ certificadoPresente: true });
  });
});
