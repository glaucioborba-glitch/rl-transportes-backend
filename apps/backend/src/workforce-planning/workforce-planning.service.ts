import { Injectable } from '@nestjs/common';
import {
  CargoFuncionario,
  StatusFuncionario,
  StatusSolicitacao,
  TurnoAgendamento,
  TurnoEscala,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CHECKINS_POR_GATE_CHECKER,
  MOVIMENTOS_POR_OPERADOR_EMPILHADEIRA,
  WORKFORCE_PLANNING_HORIZON_DIAS,
} from './workforce-planning.constants';
import type { RiscoEscalaAlert, WorkforcePlanningSnapshot } from './workforce-planning.types';

const TURNO_LABEL: Record<TurnoEscala, string> = {
  MANHA: 'Manhã',
  TARDE: 'Tarde',
  NOITE: 'Noite',
};

const CARGO_LABEL: Record<CargoFuncionario, string> = {
  GATE_CHECKER: 'Gate Checker',
  OPERADOR_EMPILHADEIRA: 'Operador Empilhadeira',
  ADMINISTRATIVO: 'Administrativo',
};

type CargoCapacidade = Extract<CargoFuncionario, 'GATE_CHECKER' | 'OPERADOR_EMPILHADEIRA'>;

const CAPACIDADE_POR_CARGO: Record<CargoCapacidade, number> = {
  OPERADOR_EMPILHADEIRA: MOVIMENTOS_POR_OPERADOR_EMPILHADEIRA,
  GATE_CHECKER: CHECKINS_POR_GATE_CHECKER,
};

const CARGOS_ALVO: CargoCapacidade[] = ['OPERADOR_EMPILHADEIRA', 'GATE_CHECKER'];

function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatBrDate(iso: string): string {
  const [, m, day] = iso.split('-');
  return `${day}/${m}`;
}

function turnoAgendamentoToEscala(turno: TurnoAgendamento): TurnoEscala {
  return turno === TurnoAgendamento.MANHA ? TurnoEscala.MANHA : TurnoEscala.TARDE;
}

@Injectable()
export class WorkforcePlanningService {
  constructor(private readonly prisma: PrismaService) {}

  async analyzeGargalos(opts?: { dias?: number; dataInicio?: Date }): Promise<WorkforcePlanningSnapshot> {
    const dias = opts?.dias ?? WORKFORCE_PLANNING_HORIZON_DIAS;
    const inicio = startOfDayUtc(opts?.dataInicio ?? new Date());
    const fim = new Date(inicio);
    fim.setUTCDate(fim.getUTCDate() + dias - 1);

    const [demandaRows, escalaRows] = await Promise.all([
      this.prisma.agendamentoSolicitacao.groupBy({
        by: ['dataRef', 'turno'],
        where: {
          dataRef: { gte: inicio, lte: fim },
          solicitacao: {
            deletedAt: null,
            status: {
              notIn: [StatusSolicitacao.CANCELADO, StatusSolicitacao.REJEITADO],
            },
          },
        },
        _count: { id: true },
      }),
      this.prisma.escalaTurno.findMany({
        where: {
          data: { gte: inicio, lte: fim },
          funcionario: {
            status: StatusFuncionario.ATIVO,
            cargo: {
              in: ['GATE_CHECKER', 'OPERADOR_EMPILHADEIRA'] as CargoFuncionario[],
            },
          },
        },
        select: {
          data: true,
          turno: true,
          funcionario: { select: { cargo: true } },
        },
      }),
    ]);

    const demanda = new Map<string, number>();
    for (const row of demandaRows) {
      const turnoEscala = turnoAgendamentoToEscala(row.turno);
      const key = `${isoDate(row.dataRef)}|${turnoEscala}`;
      demanda.set(key, (demanda.get(key) ?? 0) + row._count.id);
    }

    const escalados = new Map<string, Record<CargoFuncionario, number>>();
    for (const row of escalaRows) {
      const key = `${isoDate(row.data)}|${row.turno}`;
      const bucket = escalados.get(key) ?? {
        GATE_CHECKER: 0,
        OPERADOR_EMPILHADEIRA: 0,
        ADMINISTRATIVO: 0,
      };
      bucket[row.funcionario.cargo] = (bucket[row.funcionario.cargo] ?? 0) + 1;
      escalados.set(key, bucket);
    }

    const alertas: RiscoEscalaAlert[] = [];

    for (let i = 0; i < dias; i++) {
      const dia = new Date(inicio);
      dia.setUTCDate(dia.getUTCDate() + i);
      const diaIso = isoDate(dia);

      for (const turno of [TurnoEscala.MANHA, TurnoEscala.TARDE, TurnoEscala.NOITE]) {
        const key = `${diaIso}|${turno}`;
        const demandaMov = turno === TurnoEscala.NOITE ? 0 : (demanda.get(key) ?? 0);
        const esc = escalados.get(key) ?? {
          GATE_CHECKER: 0,
          OPERADOR_EMPILHADEIRA: 0,
          ADMINISTRATIVO: 0,
        };

        for (const cargo of CARGOS_ALVO) {
          const capUnit = CAPACIDADE_POR_CARGO[cargo];
          const nEscalados = esc[cargo] ?? 0;
          const capacidade = nEscalados * capUnit;
          const necessarios = demandaMov > 0 ? Math.ceil(demandaMov / capUnit) : 0;
          const deficit = Math.max(0, necessarios - nEscalados);
          const gargalo = demandaMov > 0 && demandaMov > capacidade;

          if (!gargalo) continue;

          const unidade =
            cargo === 'OPERADOR_EMPILHADEIRA' ? 'movimentos' : 'check-ins';
          const papel = cargo === 'OPERADOR_EMPILHADEIRA' ? 'Operador' : 'Checker';
          const papelPlural = cargo === 'OPERADOR_EMPILHADEIRA' ? 'Operadores' : 'Checkers';
          const papelEsc = nEscalados === 1 ? papel : papelPlural;
          const papelDef = deficit === 1 ? papel : papelPlural;

          alertas.push({
            data: diaIso,
            turno,
            turnoLabel: TURNO_LABEL[turno],
            cargo,
            cargoLabel: CARGO_LABEL[cargo],
            demanda: demandaMov,
            capacidade,
            escalados: nEscalados,
            deficit,
            severidade: 'GARGALO',
            mensagem: `⚠️ Gargalo Projetado: Turno da ${TURNO_LABEL[turno]} (${formatBrDate(diaIso)}). Demanda: ${demandaMov} ${unidade}. Capacidade: ${capacidade} ${unidade} (${nEscalados} ${papelEsc}). Necessário remanejar +${deficit} ${papelDef}.`,
          });
        }
      }
    }

    alertas.sort((a, b) => a.data.localeCompare(b.data) || a.turno.localeCompare(b.turno));

    return {
      geradoEm: new Date().toISOString(),
      horizonteDias: dias,
      alertas,
    };
  }
}
