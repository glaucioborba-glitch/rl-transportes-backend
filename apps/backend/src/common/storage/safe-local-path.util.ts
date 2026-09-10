import * as fs from 'node:fs';
import * as path from 'node:path';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

export function assertSafeStorageSegments(segments: string[]): void {
  for (const p of segments) {
    if (!p || p.includes('\0') || p === '.' || p === '..' || p.includes('..')) {
      throw new BadRequestException('Caminho de armazenamento inválido.');
    }
  }
}

/** Recusa `..`, nulos e escape do diretório `uploads/<namespace>`. */
export function resolveSafeLocalPath(namespace: string, storageKey: string): string {
  if (!namespace.trim() || namespace.includes('..') || namespace.includes('\0') || /[\\/]/.test(namespace)) {
    throw new BadRequestException('Namespace de arquivo inválido.');
  }
  const raw = storageKey?.trim() ?? '';
  if (!raw || raw.includes('\0')) {
    throw new BadRequestException('Chave de arquivo inválida.');
  }
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    throw new BadRequestException('Chave de arquivo inválida.');
  }
  if (decoded.includes('\0') || /(^|[\\/])\.\.([\\/]|$)/.test(decoded)) {
    throw new ForbiddenException('Caminho de arquivo recusado.');
  }
  const root = path.resolve(process.cwd(), 'uploads', namespace);
  const full = path.resolve(root, decoded);
  const rel = path.relative(root, full);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new ForbiddenException('Caminho de arquivo recusado.');
  }
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
    throw new NotFoundException('Arquivo não encontrado');
  }
  return full;
}

export function canonicalMediaKey(storageKey: string): string {
  let decoded = storageKey.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    decoded = storageKey.trim();
  }
  return decoded.replace(/\\/g, '/').replace(/^\/+/, '');
}
