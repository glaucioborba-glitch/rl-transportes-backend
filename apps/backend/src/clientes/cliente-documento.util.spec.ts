import { ConflictException } from '@nestjs/common';
import { TipoCliente } from '@prisma/client';
import { assertClienteDocumentoDisponivel, normalizeClienteDocumentoStorage } from './cliente-documento.util';

describe('cliente-documento.util', () => {
  it('normaliza CPF para 14 dígitos com zeros à esquerda', () => {
    expect(normalizeClienteDocumentoStorage('52998224725', TipoCliente.PF)).toBe('00052998224725');
  });

  it('mantém CNPJ com 14 dígitos', () => {
    expect(normalizeClienteDocumentoStorage('19131243000197', TipoCliente.PJ)).toBe('19131243000197');
  });

  it('rejeita documento já cadastrado em Cliente (inclui soft-delete)', async () => {
    const prisma = {
      cliente: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'c1',
          tipo: TipoCliente.PJ,
          deletedAt: new Date(),
        }),
      },
      user: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    await expect(
      assertClienteDocumentoDisponivel(prisma as never, '19131243000197'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
