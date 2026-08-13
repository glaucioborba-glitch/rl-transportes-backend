import { canIntranetStaffLogin } from './intranet-staff-roles.util';
import { Role } from '@prisma/client';

describe('canIntranetStaffLogin', () => {
  it('permite perfis operacionais staff', () => {
    expect(canIntranetStaffLogin(Role.ADMIN)).toBe(true);
    expect(canIntranetStaffLogin(Role.OPERADOR_GATE)).toBe(true);
  });

  it('bloqueia perfis portal cliente', () => {
    expect(canIntranetStaffLogin(Role.CLIENTE)).toBe(false);
    expect(canIntranetStaffLogin(Role.ADMIN_CLIENTE)).toBe(false);
    expect(canIntranetStaffLogin(Role.TRANSPORTADORA_TERCEIRA)).toBe(false);
  });
});
