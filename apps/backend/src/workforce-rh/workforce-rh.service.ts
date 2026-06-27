import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CargoFuncionario, Prisma, StatusFuncionario, TurnoEscala } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeCpfDigits } from '../common/utils/data-sanitize';
import { CreateFuncionarioDto } from './dto/create-funcionario.dto';
import { UpdateFuncionarioDto } from './dto/update-funcionario.dto';
import { UpsertEscalasDto } from './dto/upsert-escalas.dto';

function parseDateOnly(raw: string): Date {
  const d = new Date(`${raw.trim()}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException('Data inválida');
  }
  return d;
}

function isValidCpf(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== Number(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === Number(cpf[10]);
}

@Injectable()
export class WorkforceRhService {
  constructor(private readonly prisma: PrismaService) {}

  listFuncionarios(opts?: { status?: StatusFuncionario; cargo?: CargoFuncionario }) {
    return this.prisma.funcionario.findMany({
      where: {
        ...(opts?.status ? { status: opts.status } : {}),
        ...(opts?.cargo ? { cargo: opts.cargo } : {}),
      },
      orderBy: [{ status: 'asc' }, { nome: 'asc' }],
    });
  }

  async createFuncionario(dto: CreateFuncionarioDto) {
    const cpf = normalizeCpfDigits(dto.cpf);
    if (!isValidCpf(cpf)) {
      throw new BadRequestException('CPF inválido');
    }
    try {
      return await this.prisma.funcionario.create({
        data: {
          nome: dto.nome.trim(),
          cpf,
          cargo: dto.cargo,
          status: dto.status ?? StatusFuncionario.ATIVO,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('CPF já cadastrado');
      }
      throw e;
    }
  }

  async updateFuncionario(id: string, dto: UpdateFuncionarioDto) {
    await this.assertFuncionario(id);
    return this.prisma.funcionario.update({
      where: { id },
      data: {
        ...(dto.nome !== undefined ? { nome: dto.nome.trim() } : {}),
        ...(dto.cargo !== undefined ? { cargo: dto.cargo } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });
  }

  async inativarFuncionario(id: string) {
    return this.updateFuncionario(id, { status: StatusFuncionario.INATIVO });
  }

  listEscalas(dataInicio: string, dataFim: string) {
    return this.prisma.escalaTurno.findMany({
      where: {
        data: { gte: parseDateOnly(dataInicio), lte: parseDateOnly(dataFim) },
      },
      include: {
        funcionario: { select: { id: true, nome: true, cargo: true, status: true } },
      },
      orderBy: [{ data: 'asc' }, { turno: 'asc' }],
    });
  }

  async upsertEscalas(dto: UpsertEscalasDto) {
    if (!dto.escalas?.length) {
      throw new BadRequestException('Informe ao menos uma escala');
    }

    const results = await this.prisma.$transaction(async (tx) => {
      const out: Awaited<ReturnType<typeof tx.escalaTurno.create>>[] = [];
      for (const item of dto.escalas) {
        const data = parseDateOnly(item.data);
        await this.assertFuncionario(item.funcionarioId, tx);

        if (item.turno === null) {
          await tx.escalaTurno.deleteMany({
            where: { funcionarioId: item.funcionarioId, data },
          });
          continue;
        }

        await tx.escalaTurno.deleteMany({
          where: {
            funcionarioId: item.funcionarioId,
            data,
            turno: { not: item.turno as TurnoEscala },
          },
        });

        const row = await tx.escalaTurno.upsert({
          where: {
            funcionarioId_data_turno: {
              funcionarioId: item.funcionarioId,
              data,
              turno: item.turno,
            },
          },
          create: {
            funcionarioId: item.funcionarioId,
            data,
            turno: item.turno,
          },
          update: {},
        });
        out.push(row);
      }
      return out;
    });

    return { ok: true, processadas: dto.escalas.length, escalas: results };
  }

  private async assertFuncionario(id: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma;
    const row = await db.funcionario.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Funcionário não encontrado');
    return row;
  }
}
