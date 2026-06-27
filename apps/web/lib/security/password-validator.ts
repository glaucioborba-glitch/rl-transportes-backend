/**
 * Alinhado à política do backend (`PasswordPolicyService`).
 */

const MIN_LEN = 8;
const SPECIAL_RE = /[!@#$%*?]/;
const BLACKLIST = new Set([
  "password",
  "qwerty",
  "12345678",
  "123456789",
  "abcdef",
  "senha123",
  "admin123",
]);

export type PasswordChecklist = {
  minLength: boolean;
  upper: boolean;
  lower: boolean;
  digit: boolean;
  special: boolean;
  noLongRepeat: boolean;
  noSequence: boolean;
  notBlacklisted: boolean;
};

function hasAscendingSequence(password: string, len: number): boolean {
  const lower = password.toLowerCase();
  for (let i = 0; i <= lower.length - len; i++) {
    const slice = lower.slice(i, i + len);
    if (/^[a-z]+$/.test(slice) && isStrictAscending(slice)) return true;
    if (/^\d+$/.test(slice) && isStrictAscending(slice)) return true;
  }
  return false;
}

function isStrictAscending(s: string): boolean {
  for (let k = 1; k < s.length; k++) {
    if (s.charCodeAt(k) !== s.charCodeAt(k - 1) + 1) return false;
  }
  return true;
}

export function evaluatePassword(password: string): {
  checklist: PasswordChecklist;
  valid: boolean;
  /** 0 fraca … 4 forte (para barra segmentada). */
  strength: 0 | 1 | 2 | 3 | 4;
} {
  const p = password ?? "";
  const checklist: PasswordChecklist = {
    minLength: p.length >= MIN_LEN,
    upper: /[A-Z]/.test(p),
    lower: /[a-z]/.test(p),
    digit: /\d/.test(p),
    special: SPECIAL_RE.test(p),
    noLongRepeat: !/(.)\1{5,}/.test(p),
    noSequence: !hasAscendingSequence(p, 5),
    notBlacklisted: !BLACKLIST.has(p.toLowerCase()),
  };

  const values = Object.values(checklist);
  const passed = values.filter(Boolean).length;
  const valid = passed === values.length;

  let strength: 0 | 1 | 2 | 3 | 4 = 0;
  if (p.length === 0) strength = 0;
  else if (passed === 8) strength = 4;
  else if (passed <= 2) strength = 1;
  else if (passed <= 4) strength = 2;
  else strength = 3;

  return {
    checklist,
    valid,
    strength,
  };
}
