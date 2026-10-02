import { normalizeWhatsappPhone } from './whatsapp-phone.util';

describe('normalizeWhatsappPhone', () => {
  it('normaliza celular BR 11 dígitos', () => {
    expect(normalizeWhatsappPhone('11999990000')).toBe('+5511999990000');
  });

  it('preserva E.164 com 55', () => {
    expect(normalizeWhatsappPhone('5511987654321')).toBe('+5511987654321');
  });

  it('retorna null para telefone curto', () => {
    expect(normalizeWhatsappPhone('123')).toBeNull();
  });
});
