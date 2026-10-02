import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  cifrarTemplateBiometrico,
  decifrarTemplateBiometrico,
} from './biometria-crypto.util';
import { isLikelyFirText, parseCpfBiometria } from './motorista-biometria.util';

export type MotoristaBiometriaStatus = {
  enrolled: boolean;
  enrolledAt: string | null;
  firText: string | null;
};

@Injectable()
export class MotoristaBiometriaService {
  constructor(private readonly prisma: PrismaService) {}

  async status(tenantId: string, cpfRaw: string): Promise<MotoristaBiometriaStatus> {
    const cpf = this.requireCpf(cpfRaw);
    const row = await this.prisma.motoristaBiometria.findFirst({
      where: { tenantId, cpf },
      select: { enrolledAt: true, firText: true },
    });
    if (!row) {
      return { enrolled: false, enrolledAt: null, firText: null };
    }
    // O leitor do Gate compara o template localmente, então ele precisa sair daqui;
    // em repouso o dado fica cifrado (dado biométrico é sensível na LGPD).
    return {
      enrolled: true,
      enrolledAt: row.enrolledAt.toISOString(),
      firText: decifrarTemplateBiometrico(row.firText),
    };
  }

  async enroll(tenantId: string, cpfRaw: string, firText: string, actorUserId: string) {
    const cpf = this.requireCpf(cpfRaw);
    const fir = (firText ?? '').trim();
    if (!isLikelyFirText(fir)) {
      throw new BadRequestException('Template da digital inválido. Use o leitor no PC do Gate.');
    }
    const cifrado = cifrarTemplateBiometrico(fir);
    const row = await this.prisma.motoristaBiometria.upsert({
      where: { tenantId_cpf: { tenantId, cpf } },
      create: {
        tenantId,
        cpf,
        firText: cifrado,
        enrolledByUserId: actorUserId,
      },
      update: {
        firText: cifrado,
        enrolledAt: new Date(),
        enrolledByUserId: actorUserId,
      },
      select: { enrolledAt: true },
    });
    return { enrolled: true, enrolledAt: row.enrolledAt.toISOString(), cpf };
  }

  async remove(tenantId: string, cpfRaw: string) {
    const cpf = this.requireCpf(cpfRaw);
    const existing = await this.prisma.motoristaBiometria.findFirst({
      where: { tenantId, cpf },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Motorista sem digital cadastrada.');
    }
    await this.prisma.motoristaBiometria.delete({ where: { id: existing.id } });
    return { enrolled: false, cpf };
  }

  private requireCpf(cpfRaw: string): string {
    const cpf = parseCpfBiometria(cpfRaw);
    if (!cpf) {
      throw new BadRequestException('CPF do motorista é obrigatório para a digital.');
    }
    return cpf;
  }
}
