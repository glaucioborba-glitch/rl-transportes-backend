import { BadRequestException } from '@nestjs/common';
import { MotoristaBiometriaService } from './motorista-biometria.service';

describe('MotoristaBiometriaService', () => {
  const prisma = {
    motoristaBiometria: {
      findFirst: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
  };
  const service = new MotoristaBiometriaService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('status sem cadastro', async () => {
    prisma.motoristaBiometria.findFirst.mockResolvedValue(null);
    await expect(service.status('default', '529.982.247-25')).resolves.toEqual({
      enrolled: false,
      enrolledAt: null,
      firText: null,
    });
  });

  it('recusa FIR curto', async () => {
    await expect(service.enroll('default', '52998224725', 'abc', 'u1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('grava FIR no upsert', async () => {
    const enrolledAt = new Date('2026-09-18T12:00:00.000Z');
    prisma.motoristaBiometria.upsert.mockResolvedValue({ enrolledAt });
    await expect(
      service.enroll('default', '52998224725', 'F'.repeat(40), 'u1'),
    ).resolves.toEqual({
      enrolled: true,
      enrolledAt: enrolledAt.toISOString(),
      cpf: '52998224725',
    });
  });
});
