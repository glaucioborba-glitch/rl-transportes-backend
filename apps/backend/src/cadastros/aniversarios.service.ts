import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type AniversarioProximoItem = {
  familiar: string;
  parentesco: string | null;
  dataAniversario: Date;
  colaborador: string;
  departamento: string | null;
  cargo: string | null;
};

@Injectable()
export class AniversariosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Próximos aniversários de familiares (preparação agenda RH). */
  async getProximosAniversarios(dias = 30): Promise<AniversarioProximoItem[]> {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const limite = new Date(hoje);
    limite.setDate(hoje.getDate() + dias);

    const familiares = await this.prisma.colaboradorFamiliar.findMany({
      where: {
        ativo: true,
        dataAniversario: { not: null },
        colaborador: { deletedAt: null, status: 'ATIVO' },
      },
      include: {
        colaborador: {
          select: { id: true, nome: true, cargo: true, departamento: true },
        },
      },
    });

    return familiares
      .filter((f) => {
        if (!f.dataAniversario) return false;
        const mesDia = new Date(f.dataAniversario);
        mesDia.setFullYear(hoje.getFullYear());
        if (mesDia < hoje) {
          mesDia.setFullYear(hoje.getFullYear() + 1);
        }
        return mesDia >= hoje && mesDia <= limite;
      })
      .sort((a, b) => {
        const dateA = new Date(a.dataAniversario!);
        const dateB = new Date(b.dataAniversario!);
        dateA.setFullYear(hoje.getFullYear());
        dateB.setFullYear(hoje.getFullYear());
        if (dateA < hoje) dateA.setFullYear(hoje.getFullYear() + 1);
        if (dateB < hoje) dateB.setFullYear(hoje.getFullYear() + 1);
        return dateA.getTime() - dateB.getTime();
      })
      .map((f) => ({
        familiar: f.nome,
        parentesco: f.parentesco,
        dataAniversario: f.dataAniversario!,
        colaborador: f.colaborador.nome,
        departamento: f.colaborador.departamento,
        cargo: f.colaborador.cargo,
      }));
  }
}
