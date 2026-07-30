import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { resolveStoreTenantId } from '../common/stores/store-tenant.util';
import type {
  BeneficioRhEntity,
  ColaboradorRhEntity,
  PresencaRhEntity,
} from './folha-rh.domain';

@Injectable()
export class FolhaRhStoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  private tenantId() {
    return resolveStoreTenantId(this.tenantCtx);
  }

  async createColaborador(input: Omit<ColaboradorRhEntity, 'id' | 'createdAt'>): Promise<ColaboradorRhEntity> {
    const id = randomUUID();
    const row = await this.prisma.folhaColaboradorRh.create({
      data: {
        id,
        tenantId: this.tenantId(),
        nome: input.nome,
        cpf: input.cpf,
        cargo: input.cargo,
        turno: input.turno,
        salarioBase: input.salarioBase,
        tipoContratacao: input.tipoContratacao,
        dataAdmissao: new Date(input.dataAdmissao.slice(0, 10)),
        dataDemissao: input.dataDemissao ? new Date(input.dataDemissao.slice(0, 10)) : null,
        beneficiosAtivos: input.beneficiosAtivos,
      },
    });
    return this.mapColaborador(row);
  }

  async listColaboradores(): Promise<ColaboradorRhEntity[]> {
    const rows = await this.prisma.folhaColaboradorRh.findMany({
      where: { tenantId: this.tenantId() },
    });
    return rows.map((r) => this.mapColaborador(r)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  async getColaborador(id: string): Promise<ColaboradorRhEntity | undefined> {
    const row = await this.prisma.folhaColaboradorRh.findFirst({
      where: { id, tenantId: this.tenantId() },
    });
    return row ? this.mapColaborador(row) : undefined;
  }

  async createBeneficio(input: Omit<BeneficioRhEntity, 'id' | 'createdAt'>): Promise<BeneficioRhEntity> {
    const id = randomUUID();
    const row = await this.prisma.folhaBeneficio.create({
      data: {
        id,
        tenantId: this.tenantId(),
        nomeBeneficio: input.nomeBeneficio,
        valorMensal: input.valorMensal,
        tipoBeneficio: input.tipoBeneficio,
      },
    });
    return this.mapBeneficio(row);
  }

  async listBeneficios(): Promise<BeneficioRhEntity[]> {
    const rows = await this.prisma.folhaBeneficio.findMany({
      where: { tenantId: this.tenantId() },
    });
    return rows
      .map((r) => this.mapBeneficio(r))
      .sort((a, b) => a.nomeBeneficio.localeCompare(b.nomeBeneficio, 'pt-BR'));
  }

  async createPresenca(input: Omit<PresencaRhEntity, 'id' | 'createdAt'>): Promise<PresencaRhEntity> {
    const id = randomUUID();
    const row = await this.prisma.folhaPresenca.create({
      data: {
        id,
        tenantId: this.tenantId(),
        colaboradorId: input.colaboradorId,
        dataRef: new Date(input.data.slice(0, 10)),
        horasTrabalhadas: input.horasTrabalhadas,
        horasExtras: input.horasExtras,
        adicionalNoturnoHoras: input.adicionalNoturnoHoras,
        falta: input.falta,
      },
    });
    return this.mapPresenca(row);
  }

  async listPresencas(): Promise<PresencaRhEntity[]> {
    const rows = await this.prisma.folhaPresenca.findMany({
      where: { tenantId: this.tenantId() },
    });
    return rows.map((r) => this.mapPresenca(r)).sort((a, b) => b.data.localeCompare(a.data));
  }

  async presencasDoMes(colaboradorId: string, mesPrefix: string): Promise<PresencaRhEntity[]> {
    const [y, m] = mesPrefix.split('-').map(Number);
    const ini = new Date(y, m - 1, 1);
    const fim = new Date(y, m, 0);
    const rows = await this.prisma.folhaPresenca.findMany({
      where: {
        tenantId: this.tenantId(),
        colaboradorId,
        dataRef: { gte: ini, lte: fim },
      },
    });
    return rows.map((r) => this.mapPresenca(r));
  }

  private mapColaborador(row: {
    id: string;
    nome: string;
    cpf: string;
    cargo: string;
    turno: string;
    salarioBase: { toNumber(): number } | number;
    tipoContratacao: string;
    dataAdmissao: Date;
    dataDemissao: Date | null;
    beneficiosAtivos: unknown;
    createdAt: Date;
  }): ColaboradorRhEntity {
    return {
      id: row.id,
      nome: row.nome,
      cpf: row.cpf,
      cargo: row.cargo,
      turno: row.turno as ColaboradorRhEntity['turno'],
      salarioBase: typeof row.salarioBase === 'number' ? row.salarioBase : row.salarioBase.toNumber(),
      tipoContratacao: row.tipoContratacao as ColaboradorRhEntity['tipoContratacao'],
      dataAdmissao: row.dataAdmissao.toISOString().slice(0, 10),
      dataDemissao: row.dataDemissao?.toISOString().slice(0, 10),
      beneficiosAtivos: Array.isArray(row.beneficiosAtivos) ? (row.beneficiosAtivos as string[]) : [],
      createdAt: row.createdAt.toISOString(),
    };
  }

  private mapBeneficio(row: {
    id: string;
    nomeBeneficio: string;
    valorMensal: { toNumber(): number } | number;
    tipoBeneficio: string;
    createdAt: Date;
  }): BeneficioRhEntity {
    return {
      id: row.id,
      nomeBeneficio: row.nomeBeneficio,
      valorMensal: typeof row.valorMensal === 'number' ? row.valorMensal : row.valorMensal.toNumber(),
      tipoBeneficio: row.tipoBeneficio as BeneficioRhEntity['tipoBeneficio'],
      createdAt: row.createdAt.toISOString(),
    };
  }

  private mapPresenca(row: {
    id: string;
    colaboradorId: string;
    dataRef: Date;
    horasTrabalhadas: { toNumber(): number } | number;
    horasExtras: { toNumber(): number } | number;
    adicionalNoturnoHoras: { toNumber(): number } | number;
    falta: boolean;
    createdAt: Date;
  }): PresencaRhEntity {
    const num = (v: { toNumber(): number } | number) => (typeof v === 'number' ? v : v.toNumber());
    return {
      id: row.id,
      colaboradorId: row.colaboradorId,
      data: row.dataRef.toISOString().slice(0, 10),
      horasTrabalhadas: num(row.horasTrabalhadas),
      horasExtras: num(row.horasExtras),
      adicionalNoturnoHoras: num(row.adicionalNoturnoHoras),
      falta: row.falta,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
