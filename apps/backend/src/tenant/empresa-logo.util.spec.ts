import { readImageSize, fallbackSlotChain, isEmpresaLogoSlot } from './empresa-logo.util';

function png(width: number, height: number): Buffer {
  const buf = Buffer.alloc(24);
  buf[0] = 0x89;
  buf[1] = 0x50;
  buf[2] = 0x4e;
  buf[3] = 0x47;
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

describe('empresa-logo.util', () => {
  it('reconhece slots válidos', () => {
    expect(isEmpresaLogoSlot('icone')).toBe(true);
    expect(isEmpresaLogoSlot('portal')).toBe(true);
    expect(isEmpresaLogoSlot('favicon')).toBe(false);
  });

  it('lê dimensões PNG', () => {
    expect(readImageSize(png(512, 512), 'image/png')).toEqual({ width: 512, height: 512 });
  });

  it('portal cai para horizontal e ícone', () => {
    expect(fallbackSlotChain('portal')).toEqual(['portal', 'horizontal', 'icone']);
  });
});
