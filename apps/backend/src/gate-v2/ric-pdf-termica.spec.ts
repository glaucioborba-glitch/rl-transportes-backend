import { ASSINATURA_BIOMETRIA_OK } from './assinatura-ric.util';
import { usaRicTermica80 } from './ric-pdf-termica';

describe('usaRicTermica80', () => {
  it('cupom 80mm só com impressão digital', () => {
    expect(usaRicTermica80({ assinaturaModo: 'DIGITAL', assinatura: ASSINATURA_BIOMETRIA_OK })).toBe(
      true,
    );
    expect(usaRicTermica80({ assinaturaModo: 'MANUAL', assinatura: '' })).toBe(false);
    expect(usaRicTermica80({ assinaturaModo: 'DIGITAL', assinatura: '' })).toBe(false);
  });
});
