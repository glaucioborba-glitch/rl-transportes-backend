import { BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  parsePerfilIntranet,
  stripColaboradorLoginSecrets,
  assertSenhasIguais,
} from './colaborador-intranet-login.util';

describe('colaborador-intranet-login.util', () => {
  it('remove senha do payload persistido em dados', () => {
    const out = stripColaboradorLoginSecrets({
      nome: 'Ana',
      senha: 'Segredo@123',
      senhaConfirmacao: 'Segredo@123',
      turno: 'T1',
    });
    expect(out).toEqual({ nome: 'Ana', turno: 'T1' });
    expect('senha' in out).toBe(false);
  });

  it('aceita perfis da intranet e recusa Super Admin', () => {
    expect(parsePerfilIntranet('OPERADOR_GATE')).toBe(Role.OPERADOR_GATE);
    expect(parsePerfilIntranet('')).toBeNull();
    expect(() => parsePerfilIntranet('SUPER_ADMIN')).toThrow(BadRequestException);
  });

  it('exige senha e confirmação iguais', () => {
    expect(() => assertSenhasIguais('a', 'b')).toThrow(BadRequestException);
    expect(() => assertSenhasIguais('igual', 'igual')).not.toThrow();
  });
});
