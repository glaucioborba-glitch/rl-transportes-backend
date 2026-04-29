import { Role } from '@prisma/client';
import {
  DATAHUB_TI_PIPELINE_PERMISSIONS,
  isGerenteDatahubTi,
  permissionsForRole,
} from './role-permissions';

describe('role-permissions (datahub TI)', () => {
  it('GERENTE puro só tem DW + BI do datahub', () => {
    const p = permissionsForRole(Role.GERENTE, {
      email: 'gerente@corp.com',
      datahubTiEmailCsv: '',
    });
    expect(p).toContain('datahub:dw:read');
    expect(p).toContain('datahub:bi:read');
    expect(p).not.toContain('datahub:lake:list');
    expect(p).not.toContain('datahub:export:read');
  });

  it('GERENTE em DATAHUB_TI_EMAILS recebe permissões de pipeline', () => {
    const p = permissionsForRole(Role.GERENTE, {
      email: 'ti@corp.com',
      datahubTiEmailCsv: 'other@test.com, ti@corp.com',
    });
    for (const x of DATAHUB_TI_PIPELINE_PERMISSIONS) {
      expect(p).toContain(x);
    }
  });

  it('isGerenteDatahubTi respeita lista CSV e case', () => {
    expect(isGerenteDatahubTi('A@LOCAL', 'b@test.com, a@local')).toBe(true);
    expect(isGerenteDatahubTi('a@local', undefined)).toBe(false);
    expect(isGerenteDatahubTi('a@local', '')).toBe(false);
  });
});
