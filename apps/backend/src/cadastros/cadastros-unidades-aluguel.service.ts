import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { StatusUnidadeAluguel } from '@prisma/client';
import { normalizeContainerIso } from '../common/utils/data-sanitize';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeTamanhoAluguel } from '../aluguel/aluguel-pricing.util';
import { CadastrosUnidadeAluguelFormDto } from './dto/cadastros-unidade-aluguel-form.dto';

const DEFAULT_TENANT = 'default';

@Injectable()
export class CadastrosUnidadesAluguelService {
  constructor(private readonly prisma: PrismaService) {}

  async list(status?: string) {
    const rows = await this.prisma.cadastroUnidadeAluguel.findMany({
      where: {
        tenantId: DEFAULT_TENANT,
        deletedAt: null,
        ...(status && status !== 'todos'
          ? { status: status as StatusUnidadeAluguel }
          : {}),
      },
      include: {
        alugueis: {
          where: { status: 'ATIVO' },
          take: 1,
          include: {
            cliente: { select: { razaoSocial: true } },
            unidadeProcesso: { select: { id: true, numero: true } },
          },
        },
      },
      orderBy: { unidadeIso: 'asc' },
    });
    return { items: rows.map((r) => this.toShape(r)), total: rows.length };
  }

  async findOne(id: string) {
    return this.toShape(await this.getOrThrow(id));
  }

  async create(dto: CadastrosUnidadeAluguelFormDto) {
    const unidadeIso = this.normIso(dto.unidadeIso);
    await this.assertIsoLivre(unidadeIso);
    const row = await this.prisma.cadastroUnidadeAluguel.create({
      data: {
        tenantId: DEFAULT_TENANT,
        unidadeIso,
        tipoContainerCodigo: dto.tipoContainerCodigo.trim().toUpperCase(),
        containerTamanho: normalizeTamanhoAluguel(dto.containerTamanho),
        capacidadeCodigo: dto.capacidadeCodigo?.trim().toUpperCase() || null,
        status: (dto.status as StatusUnidadeAluguel) ?? StatusUnidadeAluguel.DISPONIVEL,
        observacao: dto.observacao?.trim() || null,
      },
    });
    return this.toShape(row);
  }

  async update(id: string, dto: CadastrosUnidadeAluguelFormDto) {
    const existing = await this.getOrThrow(id);
    if (existing.status === StatusUnidadeAluguel.ALUGADA) {
      throw new BadRequestException('Unidade alugada. Altere o status só depois da devolução.');
    }
    const unidadeIso = this.normIso(dto.unidadeIso);
    await this.assertIsoLivre(unidadeIso, id);
    const nextStatus = (dto.status as StatusUnidadeAluguel) ?? existing.status;
    if (nextStatus === StatusUnidadeAluguel.ALUGADA) {
      throw new BadRequestException('O status Alugada é definido ao iniciar o contrato.');
    }
    const row = await this.prisma.cadastroUnidadeAluguel.update({
      where: { id },
      data: {
        unidadeIso,
        tipoContainerCodigo: dto.tipoContainerCodigo.trim().toUpperCase(),
        containerTamanho: normalizeTamanhoAluguel(dto.containerTamanho),
        capacidadeCodigo: dto.capacidadeCodigo?.trim().toUpperCase() || null,
        status: nextStatus,
        observacao: dto.observacao?.trim() || null,
        deletedAt: nextStatus === StatusUnidadeAluguel.INATIVA ? existing.deletedAt : null,
      },
    });
    return this.toShape(row);
  }

  private async assertIsoLivre(unidadeIso: string, excludeId?: string) {
    const dup = await this.prisma.cadastroUnidadeAluguel.findFirst({
      where: {
        tenantId: DEFAULT_TENANT,
        unidadeIso,
        deletedAt: null,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    if (dup) throw new ConflictException(`ISO já cadastrada na frota de aluguel: ${unidadeIso}.`);
  }

  private async getOrThrow(id: string) {
    const row = await this.prisma.cadastroUnidadeAluguel.findFirst({
      where: { id, deletedAt: null },
      include: {
        alugueis: {
          where: { status: 'ATIVO' },
          take: 1,
          include: {
            cliente: { select: { razaoSocial: true } },
            unidadeProcesso: { select: { id: true, numero: true } },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Unidade de aluguel não encontrada.');
    return row;
  }

  private normIso(raw: string) {
    return normalizeContainerIso(raw).replace(/\s/g, '').toUpperCase();
  }

  private toShape(row: {
    id: string;
    unidadeIso: string;
    tipoContainerCodigo: string;
    containerTamanho: string;
    capacidadeCodigo: string | null;
    status: StatusUnidadeAluguel;
    observacao: string | null;
    alugueis?: Array<{
      id: string;
      cliente: { razaoSocial: string };
      unidadeProcesso: { id: string; numero: number };
    }>;
  }) {
    const ativo = row.alugueis?.[0];
    return {
      id: row.id,
      unidadeIso: row.unidadeIso,
      tipoContainerCodigo: row.tipoContainerCodigo,
      containerTamanho: row.containerTamanho,
      capacidadeCodigo: row.capacidadeCodigo,
      status: row.status,
      observacao: row.observacao,
      aluguelAtivo: ativo
        ? {
            id: ativo.id,
            clienteNome: ativo.cliente.razaoSocial,
            unidadeProcessoId: ativo.unidadeProcesso.id,
            numero: ativo.unidadeProcesso.numero,
          }
        : null,
    };
  }
}
