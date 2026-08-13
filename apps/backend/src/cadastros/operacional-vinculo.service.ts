import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VincularEquipamentoDto } from './dto/cadastros-equipamento-form.dto';

@Injectable()
export class OperacionalVinculoService {
  constructor(private readonly prisma: PrismaService) {}

  async vincularEquipamento(operadorId: string, dto: VincularEquipamentoDto) {
    const equipamento = await this.prisma.cadastroEquipamento.findFirst({
      where: {
        id: dto.equipamentoId,
        deletedAt: null,
        ativo: true,
        status: { in: ['DISPONIVEL', 'EM_USO'] },
        NOT: { status: 'EM_MANUTENCAO' },
      },
    });
    if (!equipamento) {
      throw new NotFoundException('Equipamento não encontrado ou indisponível.');
    }

    if (equipamento.proximaManutencao && equipamento.proximaManutencao < new Date()) {
      throw new BadRequestException('Equipamento com manutenção preventiva vencida.');
    }

    const emUso = await this.prisma.cadastroEquipamentoVinculo.findFirst({
      where: { equipamentoId: dto.equipamentoId, ativo: true },
    });
    if (emUso && emUso.operadorId !== operadorId) {
      throw new BadRequestException('Equipamento já está em uso por outro operador.');
    }
    if (emUso && emUso.operadorId === operadorId) {
      return { equipamentoId: dto.equipamentoId, operadorId, vinculado: true };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.cadastroEquipamentoVinculo.updateMany({
        where: { operadorId, ativo: true },
        data: { ativo: false, desvinculadoEm: new Date() },
      });

      if (!emUso) {
        await tx.cadastroEquipamentoVinculo.create({
          data: {
            equipamentoId: dto.equipamentoId,
            operadorId,
          },
        });
      }

      await tx.cadastroEquipamento.update({
        where: { id: dto.equipamentoId },
        data: { status: 'EM_USO' },
      });
    });

    return { equipamentoId: dto.equipamentoId, operadorId, vinculado: true };
  }

  async desvincularEquipamento(operadorId: string) {
    const vinculo = await this.prisma.cadastroEquipamentoVinculo.findFirst({
      where: { operadorId, ativo: true },
    });
    if (!vinculo) return { desvinculado: false };

    await this.prisma.$transaction(async (tx) => {
      await tx.cadastroEquipamentoVinculo.update({
        where: { id: vinculo.id },
        data: { ativo: false, desvinculadoEm: new Date() },
      });
      await tx.cadastroEquipamento.update({
        where: { id: vinculo.equipamentoId },
        data: { status: 'DISPONIVEL' },
      });
    });

    return { desvinculado: true, equipamentoId: vinculo.equipamentoId };
  }

  async equipamentoAtual(operadorId: string) {
    const vinculo = await this.prisma.cadastroEquipamentoVinculo.findFirst({
      where: { operadorId, ativo: true },
      include: {
        equipamento: {
          select: {
            id: true,
            codigo: true,
            tipo: true,
            marca: true,
            modelo: true,
            status: true,
            horimetro: true,
          },
        },
      },
    });
    if (!vinculo) return { vinculado: false, equipamento: null };
    return {
      vinculado: true,
      vinculadoEm: vinculo.vinculadoEm.toISOString(),
      equipamento: vinculo.equipamento,
    };
  }
}
