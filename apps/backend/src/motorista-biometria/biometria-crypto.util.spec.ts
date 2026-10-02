import {
  cifrarTemplateBiometrico,
  decifrarTemplateBiometrico,
  estaCriptografado,
} from './biometria-crypto.util';

const TEMPLATE = 'Rk1SACAyMAAAAAEAAAABAAABAAAAAAAAAAAAAAAAAAA=';

describe('criptografia do template biométrico', () => {
  const original = process.env.BIOMETRIA_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.BIOMETRIA_ENCRYPTION_KEY = 'chave-de-teste-biometria-32-chars!!';
  });

  afterAll(() => {
    if (original === undefined) delete process.env.BIOMETRIA_ENCRYPTION_KEY;
    else process.env.BIOMETRIA_ENCRYPTION_KEY = original;
  });

  it('cifra e recupera o template', () => {
    const cifrado = cifrarTemplateBiometrico(TEMPLATE);
    expect(cifrado).not.toContain(TEMPLATE);
    expect(estaCriptografado(cifrado)).toBe(true);
    expect(decifrarTemplateBiometrico(cifrado)).toBe(TEMPLATE);
  });

  it('gera texto diferente a cada gravação (IV aleatório)', () => {
    expect(cifrarTemplateBiometrico(TEMPLATE)).not.toBe(cifrarTemplateBiometrico(TEMPLATE));
  });

  it('mantém funcionando os registros antigos em texto claro', () => {
    expect(estaCriptografado(TEMPLATE)).toBe(false);
    expect(decifrarTemplateBiometrico(TEMPLATE)).toBe(TEMPLATE);
  });

  it('não devolve template com a chave trocada', () => {
    const cifrado = cifrarTemplateBiometrico(TEMPLATE);
    process.env.BIOMETRIA_ENCRYPTION_KEY = 'outra-chave-totalmente-diferente!!';
    expect(decifrarTemplateBiometrico(cifrado)).toBeNull();
  });

  it('trata valor ausente', () => {
    expect(decifrarTemplateBiometrico(null)).toBeNull();
  });
});
