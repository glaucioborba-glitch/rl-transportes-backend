import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AcaoAuditoria,
  ModalidadeTransporte,
  Prisma,
  StatusAgendamentoTerminal,
  StatusCarga,
  StatusFrete,
  TipoFrete,
  TurnoAgendamento,
} from '@prisma/client';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeContainerIso, normalizeCpfDigits, normalizePlate } from '../common/utils/data-sanitize';
import { isValidIso6346 } from '../common/utils/iso6346';
import { CreateFreteDto, UpdateFreteDto } from './dto/frete.dto';
import { freteUncheckedCreateFromAgendamento } from './frete-from-agendamento';

export type FreteListQuery = {
  from?: string;
  to?: string;
  status?: StatusFrete;
  q?: string;
};

function parseDataRef(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) throw new BadRequestException('Data inválida. Use AAAA-MM-DD.');
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new BadRequestException('Data inválida.');
  return d;
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const t = value.trim();
  return t ? t : null;
}

function digitsOrNull(value: string | null | undefined): string | null {
  if (value == null || !String(value).replace(/\D/g, '')) return null;
  return normalizeCpfDigits(value);
}

function plateOrNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const p = normalizePlate(value);
  return p || null;
}

function toDto(row: {
  id: string;
  dataRef: Date;
  janela: string | null;
  turno: TurnoAgendamento | null;
  numeroIso: string;
  statusCarga: StatusCarga;
  tipo: TipoFrete;
  local: string | null;
  clienteId: string | null;
  clienteNome: string;
  motoristaNome: string | null;
  cpfMotorista: string | null;
  placaCavalo: string | null;
  placaCarreta: string | null;
  valor: Prisma.Decimal | null;
  booking: string | null;
  observacao: string | null;
  status: StatusFrete;
  solicitacaoId: string | null;
  agendamentoId: string | null;
  solicitacao: { protocolo: string } | null;
}) {
  return {
    id: row.id,
    dataRef: row.dataRef.toISOString().slice(0, 10),
    janela: row.janela,
    turno: row.turno,
    numeroIso: row.numeroIso,
    statusCarga: row.statusCarga,
    tipo: row.tipo,
    local: row.local,
    clienteId: row.clienteId,
    clienteNome: row.clienteNome,
    motoristaNome: row.motoristaNome,
    cpfMotorista: row.cpfMotorista,
    placaCavalo: row.placaCavalo,
    placaCarreta: row.placaCarreta,
    valor: row.valor != null ? Number(row.valor) : null,
    booking: row.booking,
    observacao: row.observacao,
    status: row.status,
    solicitacaoId: row.solicitacaoId,
    agendamentoId: row.agendamentoId,
    protocolo: row.solicitacao?.protocolo ?? null,
  };
}

const INCLUDE_SOL = { solicitacao: { select: { protocolo: true } } } as const;

@Injectable()
export class FretesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(tenantId: string, query: FreteListQuery) {
    const where: Prisma.FreteWhereInput = { tenantId };
    if (query.from || query.to) {
      where.dataRef = {};
      if (query.from) where.dataRef.gte = parseDataRef(query.from);
      if (query.to) where.dataRef.lte = parseDataRef(query.to);
    }
    if (query.status) where.status = query.status;
    const q = query.q?.trim();
    if (q) {
      const iso = normalizeContainerIso(q);
      where.OR = [
        { numeroIso: { contains: iso || q, mode: 'insensitive' } },
        { clienteNome: { contains: q, mode: 'insensitive' } },
        { motoristaNome: { contains: q, mode: 'insensitive' } },
        { local: { contains: q, mode: 'insensitive' } },
        { booking: { contains: q, mode: 'insensitive' } },
      ];
    }

    const items = await this.prisma.frete.findMany({
      where,
      include: INCLUDE_SOL,
      orderBy: [{ dataRef: 'desc' }, { janela: 'asc' }, { createdAt: 'asc' }],
      take: 800,
    });

    return { items: items.map(toDto), total: items.length };
  }

  async criar(tenantId: string, dto: CreateFreteDto, actorUserId: string) {
    const numeroIso = normalizeContainerIso(dto.numeroIso);
    if (numeroIso.length < 4) {
      throw new BadRequestException('Informe o número do contêiner.');
    }
    if (!isValidIso6346(numeroIso)) {
      throw new BadRequestException('Número ISO inválido (dígito verificador ISO 6346).');
    }
    const clienteNome = dto.clienteNome.trim();
    if (clienteNome.length < 2) {
      throw new BadRequestException('Informe o cliente.');
    }

    const row = await this.prisma.frete.create({
      data: {
        tenantId,
        dataRef: parseDataRef(dto.dataRef),
        janela: emptyToNull(dto.janela),
        turno: dto.turno ?? null,
        numeroIso,
        statusCarga: dto.statusCarga,
        tipo: dto.tipo,
        local: emptyToNull(dto.local),
        clienteNome,
        motoristaNome: emptyToNull(dto.motoristaNome),
        cpfMotorista: digitsOrNull(dto.cpfMotorista),
        placaCavalo: plateOrNull(dto.placaCavalo),
        placaCarreta: plateOrNull(dto.placaCarreta),
        valor: dto.valor != null ? new Prisma.Decimal(dto.valor.toFixed(2)) : null,
        booking: emptyToNull(dto.booking),
        observacao: emptyToNull(dto.observacao),
        status: dto.status ?? StatusFrete.PENDENTE,
      },
      include: INCLUDE_SOL,
    });

    await this.auditoria.registrar({
      tabela: 'fretes',
      registroId: row.id,
      acao: AcaoAuditoria.INSERT,
      usuario: actorUserId,
      dadosDepois: { numeroIso: row.numeroIso, status: row.status },
    });

    return toDto(row);
  }

  async atualizar(id: string, tenantId: string, dto: UpdateFreteDto, actorUserId: string) {
    const atual = await this.prisma.frete.findFirst({ where: { id, tenantId } });
    if (!atual) throw new NotFoundException('Frete não encontrado.');

    const data: Prisma.FreteUpdateInput = {};
    if (dto.dataRef != null) data.dataRef = parseDataRef(dto.dataRef);
    if (dto.janela !== undefined) data.janela = emptyToNull(dto.janela);
    if (dto.turno !== undefined) data.turno = dto.turno;
    if (dto.numeroIso != null) {
      const iso = normalizeContainerIso(dto.numeroIso);
      if (iso.length < 4) throw new BadRequestException('Informe o número do contêiner.');
      if (!isValidIso6346(iso)) {
        throw new BadRequestException('Número ISO inválido (dígito verificador ISO 6346).');
      }
      data.numeroIso = iso;
    }
    if (dto.statusCarga != null) data.statusCarga = dto.statusCarga;
    if (dto.tipo != null) data.tipo = dto.tipo;
    if (dto.local !== undefined) data.local = emptyToNull(dto.local);
    if (dto.clienteNome != null) {
      const nome = dto.clienteNome.trim();
      if (nome.length < 2) throw new BadRequestException('Informe o cliente.');
      data.clienteNome = nome;
    }
    if (dto.motoristaNome !== undefined) data.motoristaNome = emptyToNull(dto.motoristaNome);
    if (dto.cpfMotorista !== undefined) {
      data.cpfMotorista = digitsOrNull(dto.cpfMotorista);
    }
    if (dto.placaCavalo !== undefined) {
      data.placaCavalo = plateOrNull(dto.placaCavalo);
    }
    if (dto.placaCarreta !== undefined) {
      data.placaCarreta = plateOrNull(dto.placaCarreta);
    }
    if (dto.valor !== undefined) {
      data.valor = dto.valor == null ? null : new Prisma.Decimal(Number(dto.valor).toFixed(2));
    }
    if (dto.booking !== undefined) data.booking = emptyToNull(dto.booking);
    if (dto.observacao !== undefined) data.observacao = emptyToNull(dto.observacao);
    if (dto.status != null) data.status = dto.status;

    const row = await this.prisma.frete.update({
      where: { id },
      data,
      include: INCLUDE_SOL,
    });

    await this.auditoria.registrar({
      tabela: 'fretes',
      registroId: row.id,
      acao: AcaoAuditoria.UPDATE,
      usuario: actorUserId,
      dadosAntes: { status: atual.status },
      dadosDepois: { status: row.status },
    });

    return toDto(row);
  }

  async sincronizarDeAgendamentos(tenantId: string, actorUserId: string) {
    const pendentes = await this.prisma.agendamentoTerminal.findMany({
      where: {
        tenantId,
        modalidadeTransporte: ModalidadeTransporte.FROTA_FL,
        status: { notIn: [StatusAgendamentoTerminal.CANCELADO, StatusAgendamentoTerminal.CANCELADO_CLIENTE] },
        frete: { is: null },
      },
      include: {
        cliente: { select: { razaoSocial: true, nomeFantasia: true } },
        solicitacao: { include: { containersSolicitacao: { select: { unidade: true, booking: true } } } },
      },
      take: 500,
    });

    let criados = 0;
    for (const ag of pendentes) {
      const booking =
        ag.solicitacao?.containersSolicitacao.find(
          (c) => c.unidade.replace(/\s/g, '').toUpperCase() === ag.numeroIso.replace(/\s/g, '').toUpperCase(),
        )?.booking ??
        ag.solicitacao?.containersSolicitacao[0]?.booking ??
        null;

      try {
        const row = await this.prisma.frete.create({
          data: freteUncheckedCreateFromAgendamento(ag, booking, tenantId),
        });
        criados += 1;
        await this.auditoria.registrar({
          tabela: 'fretes',
          registroId: row.id,
          acao: AcaoAuditoria.INSERT,
          usuario: actorUserId,
          dadosDepois: { origem: 'sincronizar', agendamentoId: ag.id },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
        throw e;
      }
    }

    return { criados, analisados: pendentes.length };
  }
}
