import {
  mergeIntegracoesCredenciais,
  parseGoogleServiceAccountJson,
  resolveGoogleMaps,
  resolveGoogleVision,
  resolveIpm,
  resolveNfseNacional,
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

  it('IPM: sem nada configurado mantém os padrões e fica em sandbox', () => {
    const r = resolveIpm(snapshotIntegrationEnv({}), undefined);
    expect(r.origem).toBe('none');
    expect(r.configured).toBe(false);
    expect(r.prestadorCnpj).toBe('27692077000126');
    expect(r.municipioIbge).toBe('4211306');
    expect(r.armazenagem.codigoAtividade).toBe('4930201');
  });

  it('IPM: senha e dados do terminal habilitam a emissão real', () => {
    const r = resolveIpm(snapshotIntegrationEnv({}), {
      senha: 'senha-portal',
      prestadorCnpj: '11.222.333/0001-44',
      prestadorTom: '7071',
      municipioIbge: '4205407',
      aliquotaPercent: 3.5,
      certificadoPfxBase64: 'pfx-do-terminal',
      certificadoSenha: 'cert123',
    });
    expect(r.origem).toBe('tenant');
    expect(r.configured).toBe(true);
    expect(r.senhaPresente).toBe(true);
    expect(r.prestadorCnpj).toBe('11222333000144');
    expect(r.municipioIbge).toBe('4205407');
    expect(r.armazenagem.aliquotaPercent).toBe(3.5);
    expect(r.certificadoPresente).toBe(true);
    expect(r.lockedByEnv).toBe(false);
  });

  it('IPM: senha no .env trava a tela e vence a do terminal', () => {
    const r = resolveIpm(
      snapshotIntegrationEnv({
        NFSE_IPM_SENHA: 'senha-do-servidor',
        NFSE_IPM_PRESTADOR_CNPJ: '99999999999999',
        NFSE_IPM_CERT_PATH: 'C:/certs/rl.pfx',
        NFSE_IPM_CERT_PASS: 'env-cert',
      }),
      { senha: 'senha-do-terminal', prestadorCnpj: '11222333000144' },
    );
    expect(r.lockedByEnv).toBe(true);
    expect(r.origem).toBe('env');
    expect(r.senha).toBe('senha-do-servidor');
    expect(r.prestadorCnpj).toBe('99999999999999');
    expect(r.certificadoCaminho).toBe('C:/certs/rl.pfx');
    expect(r.certificadoSenha).toBe('env-cert');
  });

  it('IPM: aproveita o certificado que já estava em Parâmetros Fiscais', () => {
    const r = resolveIpm(
      snapshotIntegrationEnv({}),
      { senha: 'x' },
      { certificadoBase64: 'pfx-legado', certificadoSenha: 'senha-legado' },
    );
    expect(r.certificadoPfxBase64).toBe('pfx-legado');
    expect(r.certificadoSenha).toBe('senha-legado');
    expect(r.certificadoPresente).toBe(true);
  });

  it('IPM: salvar sem reenviar a senha mantém a guardada', () => {
    const atual = mergeIntegracoesCredenciais(
      {},
      { ipm: { senha: 'senha-original', certificadoPfxBase64: 'pfx-original' } },
    );
    const depois = mergeIntegracoesCredenciais(atual, { ipm: { municipioIbge: '4205407' } });
    expect(depois.ipm?.senha).toBe('senha-original');
    expect(depois.ipm?.certificadoPfxBase64).toBe('pfx-original');
    expect(depois.ipm?.municipioIbge).toBe('4205407');

    const apagada = mergeIntegracoesCredenciais(depois, { ipm: { senha: '' } });
    expect(apagada.ipm?.senha).toBeUndefined();
    expect(apagada.ipm?.certificadoPfxBase64).toBe('pfx-original');
  });

  it('NFS-e Nacional: só fica pronta com certificado, CNPJ e município', () => {
    const env = snapshotIntegrationEnv({});
    const parcial = resolveNfseNacional(env, {
      certificadoPfxBase64: 'MIIB-fake',
      ativacao: 'CONTINGENCIA',
    });
    expect(parcial.certificadoPresente).toBe(true);
    expect(parcial.configured).toBe(false);

    const completa = resolveNfseNacional(env, {
      certificadoPfxBase64: 'MIIB-fake',
      certificadoSenha: 'x',
      cnpjPrestador: '27.692.077/0001-26',
      municipioIbge: '4211306',
      ativacao: 'CONTINGENCIA',
      ambiente: 'producao',
      serieDps: '900',
    });
    expect(completa.configured).toBe(true);
    expect(completa.origem).toBe('tenant');
    expect(completa.cnpjPrestador).toBe('27692077000126');
    expect(completa.ambiente).toBe('producao');
    expect(completa.serieDps).toBe('900');
  });

  it('NFS-e Nacional: certificado do ambiente trava a tela e vence o do terminal', () => {
    const resolved = resolveNfseNacional(
      snapshotIntegrationEnv({
        NFSE_NACIONAL_CERT_BASE64: 'env-pfx',
        NFSE_NACIONAL_CERT_SENHA: 'env-senha',
      }),
      { certificadoPfxBase64: 'tenant-pfx', cnpjPrestador: '27692077000126', municipioIbge: '4211306' },
    );
    expect(resolved.lockedByEnv).toBe(true);
    expect(resolved.origem).toBe('env');
    expect(resolved.certificadoPfxBase64).toBe('env-pfx');
    expect(resolved.certificadoSenha).toBe('env-senha');
  });

  it('NFS-e Nacional: ativação inválida fica desligada e padrões são aplicados', () => {
    const r = resolveNfseNacional(snapshotIntegrationEnv({}), {
      ativacao: 'TALVEZ' as never,
    });
    expect(r.ativacao).toBe('DESLIGADO');
    expect(r.ambiente).toBe('homologacao');
    expect(r.serieDps).toBe('1');
    expect(r.aliquotaIssPercent).toBe(2);
    expect(r.optanteSimplesNacional).toBe(3);
  });

  it('NFS-e Nacional: salvar sem reenviar o certificado mantém o guardado', () => {
    const atual = mergeIntegracoesCredenciais(
      {},
      {
        nfseNacional: {
          certificadoPfxBase64: 'pfx-original',
          certificadoSenha: 'senha-original',
          cnpjPrestador: '27692077000126',
        },
      },
    );
    const depois = mergeIntegracoesCredenciais(atual, {
      nfseNacional: { municipioIbge: '4211306', ativacao: 'SEMPRE' },
    });
    expect(depois.nfseNacional?.certificadoPfxBase64).toBe('pfx-original');
    expect(depois.nfseNacional?.certificadoSenha).toBe('senha-original');
    expect(depois.nfseNacional?.municipioIbge).toBe('4211306');
    expect(depois.nfseNacional?.ativacao).toBe('SEMPRE');

    const apagado = mergeIntegracoesCredenciais(depois, {
      nfseNacional: { certificadoPfxBase64: '' },
    });
    expect(apagado.nfseNacional?.certificadoPfxBase64).toBeUndefined();
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
