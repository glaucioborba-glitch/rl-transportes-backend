import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { todayYmd, toYmdUtc } from './rh-agenda.util';
import { nearestSaturdayOnOrAfter, proximoParEspanhol } from './espanhol-sabado.util';
import { RhTurnoJornadaFormDto } from './dto/rh-turno-jornada-form.dto';

const DIAS_UTEIS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX'];

type TurnoRow = {
  id: string;
  codigo: string;
  nome: string;
  horaInicio: string;
  horaFim: string;
  diasSemana: Prisma.JsonValue;
  jornadaSemanalHoras: number | null;
  regimeSabado: string;
  sabadoHoraInicio: string | null;
  sabadoHoraFim: string | null;
  sabadoReferencia: Date | null;
  observacoes: string | null;
  ativo: boolean;
};

@Injectable()
export class RhTurnoJornadaService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    await this.ensureDefaults();
    const [rows, colaboradores] = await Promise.all([
      this.prisma.rhTurnoJornada.findMany({
        where: { deletedAt: null },
        orderBy: { nome: 'asc' },
      }),
      this.prisma.cadastroColaborador.findMany({
        where: { deletedAt: null, status: { in: ['ATIVO', 'FERIAS', 'AFASTADO'] } },
        select: { dados: true },
      }),
    ]);
    return {
      items: rows.map((r) => this.toShape(r, this.countAssigned(r, colaboradores))),
      total: rows.length,
    };
  }

  async findOne(id: string) {
    const row = await this.getRowOrThrow(id);
    const colaboradores = await this.prisma.cadastroColaborador.findMany({
      where: { deletedAt: null, status: { in: ['ATIVO', 'FERIAS', 'AFASTADO'] } },
      select: { dados: true },
    });
    return this.toShape(row, this.countAssigned(row, colaboradores));
  }

  async create(dto: RhTurnoJornadaFormDto) {
    const codigo = dto.codigo.trim().toUpperCase();
    const dup = await this.prisma.rhTurnoJornada.findFirst({
      where: { codigo, deletedAt: null },
    });
    if (dup) throw new ConflictException(`Código já cadastrado: ${codigo}.`);
    const row = await this.prisma.rhTurnoJornada.create({ data: this.toData(dto, codigo) });
    return this.toShape(row, 0);
  }

  async update(id: string, dto: RhTurnoJornadaFormDto) {
    await this.getRowOrThrow(id);
    const codigo = dto.codigo.trim().toUpperCase();
    const dup = await this.prisma.rhTurnoJornada.findFirst({
      where: { codigo, deletedAt: null, NOT: { id } },
    });
    if (dup) throw new ConflictException(`Código já cadastrado: ${codigo}.`);
    const row = await this.prisma.rhTurnoJornada.update({
      where: { id },
      data: {
        ...this.toData(dto, codigo),
        deletedAt: dto.ativo === false ? new Date() : null,
      },
    });
    return this.toShape(row, 0);
  }

  async remove(id: string) {
    await this.getRowOrThrow(id);
    await this.prisma.rhTurnoJornada.update({
      where: { id },
      data: { ativo: false, deletedAt: new Date() },
    });
  }

  private async ensureDefaults() {
    const count = await this.prisma.rhTurnoJornada.count({ where: { deletedAt: null } });
    if (count > 0) return;
    const ref = nearestSaturdayOnOrAfter(todayYmd());
    await this.prisma.rhTurnoJornada.createMany({
      data: [
        {
          codigo: 'ADM',
          nome: 'Administrativo (seg–sex)',
          horaInicio: '08:00',
          horaFim: '17:00',
          diasSemana: DIAS_UTEIS,
          jornadaSemanalHoras: 44,
          regimeSabado: 'SEM_SABADO',
          ativo: true,
        },
        {
          codigo: 'OP_ESP',
          nome: 'Operacional (sistema espanhol)',
          horaInicio: '07:00',
          horaFim: '16:00',
          diasSemana: DIAS_UTEIS,
          jornadaSemanalHoras: 44,
          regimeSabado: 'ESPANHOL',
          sabadoHoraInicio: '07:00',
          sabadoHoraFim: '17:00',
          sabadoReferencia: new Date(`${ref}T12:00:00.000Z`),
          observacoes: 'Trabalha um sábado o dia todo e folga no sábado seguinte.',
          ativo: true,
        },
      ],
    });
  }

  private toData(dto: RhTurnoJornadaFormDto, codigo: string): Prisma.RhTurnoJornadaUncheckedCreateInput {
    const regime = dto.regimeSabado ?? 'SEM_SABADO';
    const dias = dto.diasSemana?.length ? dto.diasSemana : DIAS_UTEIS;
    const ref = dto.sabadoReferencia
      ? nearestSaturdayOnOrAfter(dto.sabadoReferencia.slice(0, 10))
      : null;
    return {
      codigo,
      nome: dto.nome.trim(),
      horaInicio: dto.horaInicio.slice(0, 5),
      horaFim: dto.horaFim.slice(0, 5),
      diasSemana: dias,
      jornadaSemanalHoras: dto.jornadaSemanalHoras ?? null,
      regimeSabado: regime,
      sabadoHoraInicio: regime === 'SEM_SABADO' ? null : dto.sabadoHoraInicio?.slice(0, 5) || '07:00',
      sabadoHoraFim: regime === 'SEM_SABADO' ? null : dto.sabadoHoraFim?.slice(0, 5) || '17:00',
      sabadoReferencia:
        regime === 'ESPANHOL' && ref ? new Date(`${ref}T12:00:00.000Z`) : null,
      observacoes: dto.observacoes?.trim() || null,
      ativo: dto.ativo !== false,
    };
  }

  private countAssigned(
    row: Pick<TurnoRow, 'id' | 'codigo'>,
    colaboradores: { dados: Prisma.JsonValue }[],
  ) {
    return colaboradores.filter((c) => {
      const dados = (c.dados ?? {}) as Record<string, unknown>;
      const t = String(dados.turno ?? dados.turnoId ?? '');
      return t === row.id || t === row.codigo;
    }).length;
  }

  private toShape(row: TurnoRow, colaboradores: number) {
    const diasSemana = Array.isArray(row.diasSemana) ? (row.diasSemana as string[]) : [];
    const ref = toYmdUtc(row.sabadoReferencia);
    const espanhol =
      row.regimeSabado === 'ESPANHOL' && ref
        ? proximoParEspanhol(ref, todayYmd())
        : null;
    return {
      id: row.id,
      codigo: row.codigo,
      nome: row.nome,
      horaInicio: row.horaInicio,
      horaFim: row.horaFim,
      diasSemana,
      jornadaSemanalHoras: row.jornadaSemanalHoras,
      regimeSabado: row.regimeSabado,
      sabadoHoraInicio: row.sabadoHoraInicio,
      sabadoHoraFim: row.sabadoHoraFim,
      sabadoReferencia: ref,
      observacoes: row.observacoes,
      ativo: row.ativo,
      colaboradores,
      espanhol,
    };
  }

  private async getRowOrThrow(id: string) {
    const row = await this.prisma.rhTurnoJornada.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Turno de jornada não encontrado.');
    return row;
  }
}
