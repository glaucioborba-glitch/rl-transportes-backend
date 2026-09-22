import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CapacidadeVeiculoTerceiro } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { onlyDigits, normalizePlate } from '../common/utils/data-sanitize';
import { validateCpfDigits } from '../common/utils/br-documents';
import { isValidPlacaMercosulExtended } from '../common/utils/mercosul';
import { CadastrosTerceirosDocumentosService } from './cadastros-terceiros-documentos.service';
import { CadastrosTiposContainerService } from './cadastros-tipos-container.service';
import { CadastrosTerceiroFormDto } from './dto/cadastros-terceiro-form.dto';
import {
  capacidadeFromPinos,
  normalizeCarretasTerceiro,
  normalizePinosTerceiro,
  resumoCapacidadeCarretas,
} from './terceiro-placas-carretas.util';

const DEFAULT_TENANT = 'default';



@Injectable()
export class CadastrosTerceirosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentos: CadastrosTerceirosDocumentosService,
    private readonly tiposContainer: CadastrosTiposContainerService,
  ) {}

  async list(search?: string) {
    const q = search?.trim();
    const digits = q ? onlyDigits(q) : '';
    const rows = await this.prisma.cadastroTerceiro.findMany({
      where: {
        deletedAt: null,
        ...(q
          ? {
              OR: [
                { motoristaNome: { contains: q, mode: 'insensitive' } },
                { donoNome: { contains: q, mode: 'insensitive' } },
                { pix: { contains: q, mode: 'insensitive' } },
                ...(digits.length >= 4 ? [{ whatsapp: { contains: digits } }] : []),
                { placaCavalo: { contains: q.replace(/[\s-]/g, ''), mode: 'insensitive' } },
                { placaCarreta: { contains: q.replace(/[\s-]/g, ''), mode: 'insensitive' } },
                { placaCarreta02: { contains: q.replace(/[\s-]/g, ''), mode: 'insensitive' } },
                { placasCarretas: { has: q.replace(/[\s-]/g, '').toUpperCase() } },
                ...(digits.length >= 3 ? [{ motoristaCpf: { contains: digits } }] : []),
              ],
            }
          : {}),
      },
      orderBy: { motoristaNome: 'asc' },
    });
    return { items: rows.map((r) => this.toShape(r)), total: rows.length };
  }

  async findOne(id: string) {
    const row = await this.getRowOrThrow(id);
    const documentos = await this.prisma.cadastroTerceiroDocumento.findMany({
      where: { terceiroId: id, tenantId: DEFAULT_TENANT },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        tipo: true,
        indice: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        extraido: true,
        createdAt: true,
      },
    });
    return { ...this.toShape(row), documentos };
  }

  async create(dto: CadastrosTerceiroFormDto) {
    const data = await this.toData(dto);
    await this.assertCpfUnico(data.motoristaCpf);
    const row = await this.prisma.cadastroTerceiro.create({ data });
    await this.documentos.vincular(row.id, dto.documentoIds ?? []);
    return this.findOne(row.id);
  }

  async update(id: string, dto: CadastrosTerceiroFormDto) {
    await this.getRowOrThrow(id);
    const data = await this.toData(dto);
    await this.assertCpfUnico(data.motoristaCpf, id);
    await this.prisma.cadastroTerceiro.update({
      where: { id },
      data: {
        ...data,
        deletedAt: dto.ativo === false ? new Date() : null,
      },
    });
    await this.documentos.vincular(id, dto.documentoIds ?? []);
    return this.findOne(id);
  }

  private async toData(dto: CadastrosTerceiroFormDto) {
    const cpf = onlyDigits(dto.motoristaCpf);
    if (!validateCpfDigits(cpf)) {
      throw new BadRequestException('CPF inválido — dígitos verificadores não conferem.');
    }
    const placaCavalo = this.assertPlaca(dto.placaCavalo, 'Cavalo');
    const catalogo = await this.tiposContainer.listTamanhosCatalogo();
    const carretas = normalizeCarretasTerceiro(
      dto.carretas,
      dto.placasCarretas ?? [dto.placaCarreta, dto.placaCarreta02],
      dto.capacidade ?? CapacidadeVeiculoTerceiro.AMBOS,
    ).map((c, i) => {
      const pinos = normalizePinosTerceiro(c.pinos, c.capacidade, catalogo);
      if (!pinos.length) {
        throw new BadRequestException(
          `${i === 0 ? 'Carreta' : `Carreta ${i + 1}`}: selecione a capacidade (pinos) pelos tamanhos do cadastro de tipos de contêiner.`,
        );
      }
      return { ...c, pinos, capacidade: capacidadeFromPinos(pinos) };
    });
    for (const [i, c] of carretas.entries()) {
      this.assertPlaca(c.placa, i === 0 ? 'Carreta' : `Carreta ${i + 1}`);
    }
    const placasCarretas = carretas.map((c) => c.placa);
    const whatsapp = this.normalizeWhatsapp(dto.whatsapp);
    const cat = dto.cnhCategoria?.trim().toUpperCase() || null;
    const validade = dto.cnhValidade?.trim() ? new Date(`${dto.cnhValidade.trim()}T12:00:00.000Z`) : null;
    const crlvCavalo = dto.crlvValidadeCavalo?.trim()
      ? new Date(`${dto.crlvValidadeCavalo.trim()}T12:00:00.000Z`)
      : null;
    const renavamCavalo = onlyDigits(dto.renavamCavalo ?? '');
    return {
      tenantId: DEFAULT_TENANT,
      motoristaNome: dto.motoristaNome.trim(),
      motoristaCpf: cpf,
      donoNome: dto.donoNome?.trim() || '',
      pix: dto.pix?.trim() || '',
      placaCavalo,
      renavamCavalo: renavamCavalo.length >= 9 ? renavamCavalo.slice(0, 11) : null,
      crlvValidadeCavalo: crlvCavalo && !Number.isNaN(crlvCavalo.getTime()) ? crlvCavalo : null,
      placaCarreta: placasCarretas[0] ?? null,
      placaCarreta02: placasCarretas[1] ?? null,
      placasCarretas,
      carretas,
      cnhCategoria: cat,
      cnhValidade: validade && !Number.isNaN(validade.getTime()) ? validade : null,
      whatsapp,
      capacidade: resumoCapacidadeCarretas(carretas),
      ativo: dto.ativo ?? true,
    };
  }

  private normalizeWhatsapp(raw?: string | null): string | null {
    if (!raw?.trim()) return null;
    let digits = raw.replace(/\D/g, '');
    if (digits.startsWith('55') && digits.length >= 12) digits = digits.slice(2);
    digits = digits.slice(0, 11);
    if (digits.length < 10) {
      throw new BadRequestException('WhatsApp inválido — informe DDD e número.');
    }
    return digits;
  }

  private assertPlaca(raw: string, label: string) {
    const n = normalizePlate(raw);
    if (!isValidPlacaMercosulExtended(n)) {
      throw new BadRequestException(`${label}: placa inválida (Mercosul).`);
    }
    return n;
  }

  private async assertCpfUnico(cpf: string, excludeId?: string) {
    const dup = await this.prisma.cadastroTerceiro.findFirst({
      where: {
        tenantId: DEFAULT_TENANT,
        motoristaCpf: cpf,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    if (dup) throw new ConflictException(`Já existe terceiro com este CPF: ${cpf}.`);
  }

  private async getRowOrThrow(id: string) {
    const row = await this.prisma.cadastroTerceiro.findUnique({ where: { id } });
    if (!row || row.deletedAt) {
      throw new NotFoundException('Terceiro não encontrado.');
    }
    return row;
  }

  private toShape(row: {
    id: string;
    motoristaNome: string;
    motoristaCpf: string;
    donoNome: string;
    pix: string;
    placaCavalo: string;
    renavamCavalo: string | null;
    crlvValidadeCavalo: Date | null;
    placaCarreta: string | null;
    placaCarreta02: string | null;
    placasCarretas: string[];
    carretas: unknown;
    cnhCategoria: string | null;
    cnhValidade: Date | null;
    whatsapp: string | null;
    capacidade: CapacidadeVeiculoTerceiro;
    ativo: boolean;
  }) {
    const carretas = normalizeCarretasTerceiro(
      row.carretas,
      row.placasCarretas?.length ? row.placasCarretas : [row.placaCarreta, row.placaCarreta02],
      row.capacidade,
    );
    return {
      id: row.id,
      motoristaNome: row.motoristaNome,
      motoristaCpf: row.motoristaCpf,
      donoNome: row.donoNome,
      pix: row.pix,
      placaCavalo: row.placaCavalo,
      renavamCavalo: row.renavamCavalo,
      crlvValidadeCavalo: row.crlvValidadeCavalo?.toISOString().slice(0, 10) ?? null,
      placaCarreta: row.placaCarreta,
      placaCarreta02: row.placaCarreta02,
      placasCarretas: carretas.map((c) => c.placa),
      carretas,
      cnhCategoria: row.cnhCategoria,
      cnhValidade: row.cnhValidade?.toISOString().slice(0, 10) ?? null,
      whatsapp: row.whatsapp,
      capacidade: row.capacidade,
      ativo: row.ativo,
    };
  }
}
