import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import { assertSafeStorageSegments, canonicalMediaKey, resolveSafeLocalPath } from './safe-local-path.util';

describe('resolveSafeLocalPath', () => {
  const cwd = process.cwd();
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rl-uploads-'));
    jest.spyOn(process, 'cwd').mockReturnValue(tmpRoot);
    const dir = path.join(tmpRoot, 'uploads', 'vistorias', 's1');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'foto.jpg'), 'x');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.chdir(cwd);
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('abre arquivo dentro do namespace', () => {
    const full = resolveSafeLocalPath('vistorias', 's1/foto.jpg');
    expect(full.endsWith(path.join('s1', 'foto.jpg'))).toBe(true);
  });

  it('recusa path traversal', () => {
    expect(() => resolveSafeLocalPath('vistorias', '../secret.txt')).toThrow(ForbiddenException);
    expect(() => resolveSafeLocalPath('vistorias', 's1/../../etc/passwd')).toThrow(ForbiddenException);
  });

  it('404 se o arquivo não existe', () => {
    expect(() => resolveSafeLocalPath('vistorias', 's1/missing.jpg')).toThrow(NotFoundException);
  });

  it('normaliza barras da chave', () => {
    expect(canonicalMediaKey('a\\b')).toBe('a/b');
  });

  it('recusa segmentos com travessia', () => {
    expect(() => assertSafeStorageSegments(['ok', '..'])).toThrow(BadRequestException);
    expect(() => assertSafeStorageSegments(['logistica', 'vistorias'])).not.toThrow();
  });
});
