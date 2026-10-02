import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  addDaysYmd,
  diffDaysYmd,
  inWindow,
  nextOccurrenceYmd,
  nrLabel,
  parseNrs,
  toYmdUtc,
  todayYmd,
  urgenciaDeDias,
  type RhAgendaEvento,
  type RhAgendaTipo,
} from './rh-agenda.util';

const VINCULOS_EXPERIENCIA = new Set(['CLT', 'ESTAGIARIO', 'TEMPORARIO']);
const DIAS_AVALIACAO_CLT = 45;
const DIAS_FIM_EXPERIENCIA_CLT = 90;
const DIAS_ATRAS_VENCIMENTO = 30;

export type RhAgendaResponse = {
  geradoEm: string;
  dias: number;
  total: number;
  resumo: {
    hoje: number;
    proximos7: number;
    vencidos: number;
  };
  eventos: RhAgendaEvento[];
};

@Injectable()
export class RhAgendaService {
  constructor(private readonly prisma: PrismaService) {}

  async listAgenda(dias = 90, agora = new Date()): Promise<RhAgendaResponse> {
    const horizonte = Number.isFinite(dias) ? Math.min(Math.max(Math.trunc(dias), 1), 366) : 90;
    const today = todayYmd(agora);
    const eventos: RhAgendaEvento[] = [];

    const rows = await this.prisma.cadastroColaborador.findMany({
      where: {
        deletedAt: null,
        status: { in: ['ATIVO', 'FERIAS', 'AFASTADO'] },
      },
      include: {
        familiares: { where: { ativo: true } },
      },
    });

    for (const row of rows) {
      const dados = (row.dados ?? {}) as Record<string, unknown>;
      const base = {
        colaboradorId: row.id,
        colaboradorNome: row.nome,
        cargo: row.cargo,
        departamento: row.departamento,
      };

      const nasc = toYmdUtc(
        typeof dados.dataNascimento === 'string' || dados.dataNascimento instanceof Date
          ? dados.dataNascimento
          : null,
      );
      if (nasc) {
        const data = nextOccurrenceYmd(nasc, today);
        this.pushIfInWindow(eventos, {
          ...base,
          tipo: 'ANIVERSARIO_COLABORADOR',
          data,
          titulo: `Aniversário de ${row.nome}`,
          descricao: row.cargo ? `Colaborador · ${row.cargo}` : 'Colaborador',
          today,
          horizonte,
          atras: 0,
        });
      }

      for (const fam of row.familiares) {
        const famNasc = toYmdUtc(fam.dataAniversario);
        if (!famNasc) continue;
        const data = nextOccurrenceYmd(famNasc, today);
        const parentesco = fam.parentesco?.trim() || 'Familiar';
        this.pushIfInWindow(eventos, {
          ...base,
          tipo: 'ANIVERSARIO_DEPENDENTE',
          data,
          titulo: `Aniversário de ${fam.nome}`,
          descricao: `${parentesco} de ${row.nome}`,
          today,
          horizonte,
          atras: 0,
        });
      }

      const admissao = toYmdUtc(row.dataAdmissao);
      if (admissao && VINCULOS_EXPERIENCIA.has(row.vinculo)) {
        const fimInformado = toYmdUtc(
          typeof dados.dataFimExperiencia === 'string' || dados.dataFimExperiencia instanceof Date
            ? dados.dataFimExperiencia
            : null,
        );
        if (row.vinculo === 'CLT') {
          const avaliacao = addDaysYmd(admissao, DIAS_AVALIACAO_CLT);
          this.pushIfInWindow(eventos, {
            ...base,
            tipo: 'AVALIACAO_EXPERIENCIA',
            data: avaliacao,
            titulo: `Avaliação de experiência (45 dias) — ${row.nome}`,
            descricao: 'CLT · checkpoint de 45 dias',
            today,
            horizonte,
            atras: DIAS_ATRAS_VENCIMENTO,
          });
        }
        const fim =
          fimInformado ??
          (row.vinculo === 'CLT' ? addDaysYmd(admissao, DIAS_FIM_EXPERIENCIA_CLT) : null);
        if (fim) {
          this.pushIfInWindow(eventos, {
            ...base,
            tipo: 'CONTRATO_EXPERIENCIA',
            data: fim,
            titulo: `Fim do contrato de experiência — ${row.nome}`,
            descricao: fimInformado
              ? `Informado no cadastro · ${row.vinculo}`
              : `CLT · 90 dias após a admissão`,
            today,
            horizonte,
            atras: DIAS_ATRAS_VENCIMENTO,
          });
        }
      }

      const cnh = toYmdUtc(
        typeof dados.cnhValidade === 'string' || dados.cnhValidade instanceof Date
          ? dados.cnhValidade
          : null,
      );
      if (cnh) {
        this.pushIfInWindow(eventos, {
          ...base,
          tipo: 'CNH',
          data: cnh,
          titulo: `Validade da CNH — ${row.nome}`,
          descricao: typeof dados.cnhCategoria === 'string' && dados.cnhCategoria
            ? `Categoria ${dados.cnhCategoria}`
            : 'Carteira de habilitação',
          today,
          horizonte,
          atras: DIAS_ATRAS_VENCIMENTO,
        });
      }

      for (const nr of parseNrs(dados.nrs)) {
        if (!nr.validade || !nr.codigo) continue;
        this.pushIfInWindow(eventos, {
          ...base,
          tipo: 'NR',
          data: nr.validade,
          titulo: `Vencimento ${nrLabel(nr.codigo)} — ${row.nome}`,
          descricao: 'Norma regulamentadora',
          today,
          horizonte,
          atras: DIAS_ATRAS_VENCIMENTO,
        });
      }

      const reach = toYmdUtc(
        typeof dados.cursoReachStackerValidade === 'string' ||
          dados.cursoReachStackerValidade instanceof Date
          ? dados.cursoReachStackerValidade
          : null,
      );
      if (reach) {
        this.pushIfInWindow(eventos, {
          ...base,
          tipo: 'CURSO_REACH_STACKER',
          data: reach,
          titulo: `Curso de operador de reach stacker — ${row.nome}`,
          descricao: 'Validade do treinamento operacional',
          today,
          horizonte,
          atras: DIAS_ATRAS_VENCIMENTO,
        });
      }
    }

    eventos.sort((a, b) => {
      const byDate = a.data.localeCompare(b.data);
      if (byDate !== 0) return byDate;
      return a.titulo.localeCompare(b.titulo, 'pt-BR');
    });

    return {
      geradoEm: today,
      dias: horizonte,
      total: eventos.length,
      resumo: {
        hoje: eventos.filter((e) => e.dias === 0).length,
        proximos7: eventos.filter((e) => e.dias >= 0 && e.dias <= 7).length,
        vencidos: eventos.filter((e) => e.dias < 0).length,
      },
      eventos,
    };
  }

  private pushIfInWindow(
    eventos: RhAgendaEvento[],
    input: {
      tipo: RhAgendaTipo;
      data: string;
      titulo: string;
      descricao: string;
      colaboradorId: string;
      colaboradorNome: string;
      cargo: string | null;
      departamento: string | null;
      today: string;
      horizonte: number;
      atras: number;
    },
  ) {
    if (!inWindow(input.data, input.today, input.horizonte, input.atras)) return;
    const dias = diffDaysYmd(input.today, input.data);
    eventos.push({
      id: `${input.tipo}:${input.colaboradorId}:${input.data}:${input.titulo}`,
      tipo: input.tipo,
      data: input.data,
      titulo: input.titulo,
      descricao: input.descricao,
      colaboradorId: input.colaboradorId,
      colaboradorNome: input.colaboradorNome,
      cargo: input.cargo,
      departamento: input.departamento,
      dias,
      urgencia: urgenciaDeDias(dias),
    });
  }
}
