import { canIntranetStaffLogin, isGerenteMinimo } from './intranet-staff-roles.util';
import { Role } from '@prisma/client';

describe('canIntranetStaffLogin', () => {
  it('permite perfis operacionais staff', () => {
    expect(canIntranetStaffLogin(Role.ADMIN)).toBe(true);
    expect(canIntranetStaffLogin(Role.OPERADOR_GATE)).toBe(true);
  });

  it('gerente mínimo aceita ADMIN/GERENTE e recusa operador', () => {
    expect(isGerenteMinimo(Role.GERENTE)).toBe(true);
    expect(isGerenteMinimo(Role.ADMIN)).toBe(true);
    expect(isGerenteMinimo(Role.SUPER_ADMIN)).toBe(true);
    expect(isGerenteMinimo(Role.OPERADOR_GATE)).toBe(false);
  });

  it('bloqueia perfis portal cliente', () => {
    expect(canIntranetStaffLogin(Role.CLIENTE)).toBe(false);
    expect(canIntranetStaffLogin(Role.ADMIN_CLIENTE)).toBe(false);
    expect(canIntranetStaffLogin(Role.TRANSPORTADORA_TERCEIRA)).toBe(false);
  });
});
