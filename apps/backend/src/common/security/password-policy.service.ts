import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { DEFAULT_TENANT_ID } from '../../tenant/tenant.constants';
import { TenantConfigService } from '../../tenant/tenant-config.service';
import type { TenantParametrosSeguranca } from '../../tenant/tenant-config.types';

const SPECIAL_RE = /[!@#$%*?]/;
const BLACKLIST = new Set([
  'password',
  'qwerty',
  '12345678',
  '123456789',
  'abcdef',
  'senha123',
  'admin123',
]);

export type PasswordPolicyResult =
  | { ok: true }
  | { ok: false; message: string };

@Injectable()
export class PasswordPolicyService {
  constructor(@Optional() private readonly tenantConfig?: TenantConfigService) {}

  private policy(tenantId = DEFAULT_TENANT_ID): TenantParametrosSeguranca {
    return this.tenantConfig?.getParametrosSegurancaSync(tenantId) ?? {
      tentativasLoginAntesBloqueio: 5,
      duracaoBloqueioMin: 15,
      sessoesMaximasConcorrentes: 10,
      ttlSessaoHoras: 168,
      senhaMinLength: 8,
      senhaExigirMaiuscula: true,
      senhaExigirNumero: true,
      senhaExigirEspecial: true,
      senhaBloquearSequencias: true,
      validarDominioCorporativo: true,
    };
  }

  validate(password: string, tenantId = DEFAULT_TENANT_ID): PasswordPolicyResult {
    const p = this.policy(tenantId);
    if (!password || typeof password !== 'string') {
      return { ok: false, message: 'Senha obrigatória.' };
    }
    if (password.length < p.senhaMinLength) {
      return {
        ok: false,
        message: `A senha deve ter pelo menos ${p.senhaMinLength} caracteres.`,
      };
    }
    if (p.senhaExigirMaiuscula && !/[A-Z]/.test(password)) {
      return { ok: false, message: 'Inclua pelo menos uma letra maiúscula.' };
    }
    if (!/[a-z]/.test(password)) {
      return { ok: false, message: 'Inclua pelo menos uma letra minúscula.' };
    }
    if (p.senhaExigirNumero && !/\d/.test(password)) {
      return { ok: false, message: 'Inclua pelo menos um número.' };
    }
    if (p.senhaExigirEspecial && !SPECIAL_RE.test(password)) {
      return { ok: false, message: 'Inclua pelo menos um caractere especial (!@#$%*?).' };
    }
    if (/(.)\1{5,}/.test(password)) {
      return { ok: false, message: 'Evite caracteres repetidos em sequência longa.' };
    }
    if (BLACKLIST.has(password.toLowerCase())) {
      return { ok: false, message: 'Esta senha não é permitida por política de segurança.' };
    }
    if (p.senhaBloquearSequencias && this.hasAscendingSequence(password, 5)) {
      return { ok: false, message: 'Evite sequências previsíveis (ex.: 12345 ou abcde).' };
    }
    return { ok: true };
  }

  private hasAscendingSequence(password: string, len: number): boolean {
    const lower = password.toLowerCase();
    for (let i = 0; i <= lower.length - len; i++) {
      const slice = lower.slice(i, i + len);
      if (/^[a-z]+$/.test(slice) && this.isStrictAscending(slice)) return true;
      if (/^\d+$/.test(slice) && this.isStrictAscending(slice)) return true;
    }
    return false;
  }

  private isStrictAscending(s: string): boolean {
    for (let k = 1; k < s.length; k++) {
      if (s.charCodeAt(k) !== s.charCodeAt(k - 1) + 1) return false;
    }
    return true;
  }

  assertStrong(password: string, tenantId = DEFAULT_TENANT_ID): void {
    const r = this.validate(password, tenantId);
    if (r.ok) return;
    throw new BadRequestException({
      ok: false,
      field: 'senha',
      message: 'A senha não atende aos requisitos mínimos de segurança.',
      detail: r.message,
    });
  }
}
