import { BadRequestException, Injectable } from '@nestjs/common';

const MIN_LEN = 8;
const SPECIAL_RE = /[!@#$%*?]/;
/** Senhas triviais (minúsculas para comparação). */
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
  validate(password: string): PasswordPolicyResult {
    if (!password || typeof password !== 'string') {
      return { ok: false, message: 'Senha obrigatória.' };
    }
    if (password.length < MIN_LEN) {
      return { ok: false, message: `A senha deve ter pelo menos ${MIN_LEN} caracteres.` };
    }
    if (!/[A-Z]/.test(password)) {
      return { ok: false, message: 'Inclua pelo menos uma letra maiúscula.' };
    }
    if (!/[a-z]/.test(password)) {
      return { ok: false, message: 'Inclua pelo menos uma letra minúscula.' };
    }
    if (!/\d/.test(password)) {
      return { ok: false, message: 'Inclua pelo menos um número.' };
    }
    if (!SPECIAL_RE.test(password)) {
      return { ok: false, message: 'Inclua pelo menos um caractere especial (!@#$%*?).' };
    }
    if (/(.)\1{5,}/.test(password)) {
      return { ok: false, message: 'Evite caracteres repetidos em sequência longa.' };
    }
    if (BLACKLIST.has(password.toLowerCase())) {
      return { ok: false, message: 'Esta senha não é permitida por política de segurança.' };
    }
    if (this.hasAscendingSequence(password, 5)) {
      return { ok: false, message: 'Evite sequências previsíveis (ex.: 12345 ou abcde).' };
    }
    return { ok: true };
  }

  /** Sequências ascendentes de letras minúsculas ou dígitos (comprimento `len`). */
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

  /** Lança `BadRequestException` com envelope corporativo `{ ok, field, message }`. */
  assertStrong(password: string): void {
    const r = this.validate(password);
    if (r.ok) return;
    throw new BadRequestException({
      ok: false,
      field: 'senha',
      message: 'A senha não atende aos requisitos mínimos de segurança.',
      detail: r.message,
    });
  }
}
