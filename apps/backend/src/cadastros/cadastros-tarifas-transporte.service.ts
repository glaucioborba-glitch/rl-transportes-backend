import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CadastrosTarifaTransporteFormDto } from './dto/cadastros-tarifa-transporte-form.dto';
import {
  pairLocaisTransporte,
  rotuloTrecho,
  valorCobradoTransporte,
  valorPagoTerceiroEfetivo,
} from './local-transporte-pair.util';

const DEFAULT_TENANT = 'default';

const localSelect = { id: true, codigo: true, nome: true, tipo: true } as const;

@Injectable()
export class CadastrosTarifasTransporteService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tabelaId?: string, search?: string) {
    if (!tabelaId?.trim()) {
      throw new BadRequestException('Informe a tabela de transportes.');
    }
    await this.assertTabela(tabelaId);
    const q = search?.trim();
    const rows = await this.prisma.cadastroTarifaTransporte.findMany({
      where: {
        tabelaId,
        deletedAt: null,
        ...(q
          ? {
              OR: [
                { localA: { nome: { contains: q, mode: 'insensitive' } } },
                { localB: { nome: { contains: q, mode: 'insensitive' } } },
                { localA: { codigo: { contains: q, mode: 'insensitive' } } },
                { localB: { codigo: { contains: q, mode: 'insensitive' } } },
                { tipoContainerCodigo: { contains: q, mode: 'insensitive' } },
                { statusCarga: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { localA: { select: localSelect }, localB: { select: localSelect } },
      orderBy: { createdAt: 'desc' },
    });
    const tipoNomes = await this.tipoNomesMap(rows.map((r) => r.tipoContainerCodigo));
    return { items: rows.map((r) => this.toShape(r, tipoNomes)), total: rows.length };
  }

  async findOne(id: string) {
    const row = await this.getRowOrThrow(id);
    const tipoNomes = await this.tipoNomesMap([row.tipoContainerCodigo]);
    return this.toShape(row, tipoNomes);
  }

  async create(dto: CadastrosTarifaTransporteFormDto) {
    const tabelaId = await this.assertTabela(dto.tabelaId);
    const pair = await this.resolvePair(dto.origemId, dto.destinoId, true);
    const tipos = await this.resolveTipos(dto, true);
    const retorno = dto.retorno === true;
    const dups: string[] = [];
    for (const tipoCodigo of tipos) {
      const dup = await this.findDup(
        tabelaId,
        pair.localAId,
        pair.localBId,
        dto.statusCarga,
        tipoCodigo,
        retorno,
      );
      if (dup) dups.push(tipoCodigo);
    }
    if (dups.length) {
      throw new ConflictException(
        `Já existe tarifa neste trecho para: ${dups.join(', ')}. Desmarque esses tipos ou edite o cadastro existente.`,
      );
    }
    const created = await this.prisma.$transaction(
      tipos.map((tipoCodigo) =>
        this.prisma.cadastroTarifaTransporte.create({
          data: this.toData(dto, pair, tipoCodigo, retorno, tabelaId),
          include: { localA: { select: localSelect }, localB: { select: localSelect } },
        }),
      ),
    );
    const tipoNomes = await this.tipoNomesMap(created.map((r) => r.tipoContainerCodigo));
    const items = created.map((r) => this.toShape(r, tipoNomes));
    return { ...items[0], criados: items.length, items };
  }

  async update(id: string, dto: CadastrosTarifaTransporteFormDto) {
    const atual = await this.getRowOrThrow(id);
    const tabelaId = dto.tabelaId || atual.tabelaId;
    await this.assertTabela(tabelaId);
    const pair = await this.resolvePair(dto.origemId, dto.destinoId, false);
    const tipos = await this.resolveTipos(dto, false);
    const retorno = dto.retorno === true;

    await this.prisma.$transaction(async (tx) => {
      for (const tipoCodigo of tipos) {
        const existing = await tx.cadastroTarifaTransporte.findFirst({
          where: {
            tenantId: DEFAULT_TENANT,
            tabelaId,
            localAId: pair.localAId,
            localBId: pair.localBId,
            statusCarga: dto.statusCarga,
            tipoContainerCodigo: tipoCodigo,
            retorno,
            deletedAt: null,
          },
        });
        const data = this.toData(dto, pair, tipoCodigo, retorno, tabelaId);
        if (existing) {
          await tx.cadastroTarifaTransporte.update({
            where: { id: existing.id },
            data: { ...data, deletedAt: dto.ativo === false ? new Date() : null },
          });
        } else {
          await tx.cadastroTarifaTransporte.create({ data });
        }
      }
      if (!tipos.includes(atual.tipoContainerCodigo)) {
        await tx.cadastroTarifaTransporte.update({
          where: { id },
          data: { ativo: false, deletedAt: new Date() },
        });
      }
    });

    const keep = await this.prisma.cadastroTarifaTransporte.findFirst({
      where: {
        tenantId: DEFAULT_TENANT,
        tabelaId,
        localAId: pair.localAId,
        localBId: pair.localBId,
        statusCarga: dto.statusCarga,
        tipoContainerCodigo: tipos.includes(atual.tipoContainerCodigo)
          ? atual.tipoContainerCodigo
          : tipos[0],
        retorno,
        deletedAt: null,
      },
      include: { localA: { select: localSelect }, localB: { select: localSelect } },
    });
    if (!keep) throw new NotFoundException('Tarifa de transporte não encontrada.');
    const tipoNomes = await this.tipoNomesMap([keep.tipoContainerCodigo]);
    return this.toShape(keep, tipoNomes);
  }

  async remove(id: string) {
    await this.getRowOrThrow(id);
    await this.prisma.cadastroTarifaTransporte.update({
      where: { id },
      data: { ativo: false, deletedAt: new Date() },
    });
  }

  private toData(
    dto: CadastrosTarifaTransporteFormDto,
    pair: { localAId: string; localBId: string },
    tipoCodigo: string,
    retorno: boolean,
    tabelaId: string,
  ) {
    return {
      tenantId: DEFAULT_TENANT,
      tabelaId,
      localAId: pair.localAId,
      localBId: pair.localBId,
      statusCarga: dto.statusCarga,
      tipoContainerCodigo: tipoCodigo,
      retorno,
      valor: new Prisma.Decimal(dto.valor),
      valorPagoTerceiro:
        dto.valorPagoTerceiro != null && !Number.isNaN(Number(dto.valorPagoTerceiro))
          ? new Prisma.Decimal(dto.valorPagoTerceiro)
          : null,
      observacao: dto.observacao?.trim() || null,
      ativo: dto.ativo ?? true,
    };
  }

  private async resolvePair(origemId: string, destinoId: string, requireAtivo: boolean) {
    const pair = pairLocaisTransporte(origemId, destinoId);
    const [a, b] = await Promise.all([
      this.prisma.cadastroLocalTransporte.findUnique({ where: { id: pair.localAId } }),
      this.prisma.cadastroLocalTransporte.findUnique({ where: { id: pair.localBId } }),
    ]);
    if (!a || a.deletedAt || (requireAtivo && !a.ativo)) {
      throw new BadRequestException('Origem/destino inválido ou inativo.');
    }
    if (!b || b.deletedAt || (requireAtivo && !b.ativo)) {
      throw new BadRequestException('Origem/destino inválido ou inativo.');
    }
    return pair;
  }

  private async resolveTipos(dto: CadastrosTarifaTransporteFormDto, requireAtivo: boolean) {
    const bruto = [
      ...(dto.tipoContainerCodigos ?? []),
      ...(dto.tipoContainerCodigo ? [dto.tipoContainerCodigo] : []),
    ];
    const unicos = [
      ...new Set(
        bruto
          .map((c) => (typeof c === 'string' ? c.trim().toUpperCase() : ''))
          .filter(Boolean),
      ),
    ];
    if (!unicos.length) {
      throw new BadRequestException('Selecione ao menos um tipo de contêiner.');
    }
    const resolvidos: string[] = [];
    for (const codigo of unicos) {
      resolvidos.push(await this.resolveTipoCodigo(codigo, requireAtivo));
    }
    return resolvidos;
  }

  private async resolveTipoCodigo(codigo: string, requireAtivo: boolean) {
    const tipo = await this.prisma.cadastroTipoContainer.findFirst({
      where: { tenantId: DEFAULT_TENANT, codigo, deletedAt: null },
    });
    if (!tipo || (requireAtivo && !tipo.ativo)) {
      throw new BadRequestException(`Tipo de contêiner inválido: ${codigo}.`);
    }
    return tipo.codigo;
  }

  private async findDup(
    tabelaId: string,
    localAId: string,
    localBId: string,
    statusCarga: string,
    tipoContainerCodigo: string,
    retorno: boolean,
    excludeId?: string,
  ) {
    return this.prisma.cadastroTarifaTransporte.findFirst({
      where: {
        tenantId: DEFAULT_TENANT,
        tabelaId,
        localAId,
        localBId,
        statusCarga,
        tipoContainerCodigo,
        retorno,
        deletedAt: null,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      include: { localA: { select: { nome: true } }, localB: { select: { nome: true } } },
    });
  }

  private async assertTabela(tabelaId?: string) {
    const id = tabelaId?.trim();
    if (!id) throw new BadRequestException('Informe a tabela de transportes.');
    const tabela = await this.prisma.cadastroTabelaTransporte.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!tabela) throw new BadRequestException('Tabela de transportes não encontrada.');
    return tabela.id;
  }

  private async getRowOrThrow(id: string) {
    const row = await this.prisma.cadastroTarifaTransporte.findUnique({
      where: { id },
      include: { localA: { select: localSelect }, localB: { select: localSelect } },
    });
    if (!row || row.deletedAt) {
      throw new NotFoundException('Tarifa de transporte não encontrada.');
    }
    return row;
  }

  private async tipoNomesMap(codigos: string[]) {
    const unicos = [...new Set(codigos.filter(Boolean))];
    if (!unicos.length) return new Map<string, string>();
    const tipos = await this.prisma.cadastroTipoContainer.findMany({
      where: { tenantId: DEFAULT_TENANT, codigo: { in: unicos } },
      select: { codigo: true, nome: true },
    });
    return new Map(tipos.map((t) => [t.codigo, t.nome]));
  }

  private toShape(
    row: {
      id: string;
      tabelaId: string;
      localAId: string;
      localBId: string;
      statusCarga: string;
      tipoContainerCodigo: string;
      retorno: boolean;
      valor: Prisma.Decimal;
      valorPagoTerceiro: Prisma.Decimal | null;
      observacao: string | null;
      ativo: boolean;
      localA: { id: string; codigo: string; nome: string; tipo: string };
      localB: { id: string; codigo: string; nome: string; tipo: string };
    },
    tipoNomes: Map<string, string>,
  ) {
    const valor = Number(row.valor);
    return {
      id: row.id,
      tabelaId: row.tabelaId,
      origemId: row.localAId,
      destinoId: row.localBId,
      trecho: rotuloTrecho(row.localA.nome, row.localB.nome),
      localA: row.localA,
      localB: row.localB,
      statusCarga: row.statusCarga,
      tipoContainerCodigo: row.tipoContainerCodigo,
      tipoContainerNome: tipoNomes.get(row.tipoContainerCodigo) ?? row.tipoContainerCodigo,
      retorno: row.retorno,
      valor,
      valorCobrado: valorCobradoTransporte(valor, row.retorno),
      valorPagoTerceiro: row.valorPagoTerceiro != null ? Number(row.valorPagoTerceiro) : null,
      valorPagoTerceiroEfetivo: valorPagoTerceiroEfetivo(
        row.valorPagoTerceiro != null ? Number(row.valorPagoTerceiro) : null,
        row.retorno,
      ),
      observacao: row.observacao,
      ativo: row.ativo,
    };
  }
}
