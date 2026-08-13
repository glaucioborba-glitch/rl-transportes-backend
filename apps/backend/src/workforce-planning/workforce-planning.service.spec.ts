import { MOVIMENTOS_POR_OPERADOR_EMPILHADEIRA } from './workforce-planning.constants';
import { WorkforcePlanningService } from './workforce-planning.service';

describe('WorkforcePlanningService.analyzeGargalos', () => {
  const prisma = {
    agendamentoSolicitacao: { groupBy: jest.fn() },
    escalaTurno: { findMany: jest.fn() },
  };

  const svc = new WorkforcePlanningService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('detecta gargalo quando demanda excede capacidade de empilhadeira', async () => {
    const dataRef = new Date('2026-06-15T00:00:00.000Z');
    prisma.agendamentoSolicitacao.groupBy.mockResolvedValue([
      { dataRef, turno: 'TARDE', _count: { id: 40 } },
    ]);
    prisma.escalaTurno.findMany.mockResolvedValue([
      {
        data: dataRef,
        turno: 'TARDE',
        funcionario: { cargo: 'OPERADOR_EMPILHADEIRA' },
      },
    ]);

    const snap = await svc.analyzeGargalos({
      dias: 1,
      dataInicio: dataRef,
    });

    const emp = snap.alertas.find((a) => a.cargo === 'OPERADOR_EMPILHADEIRA');
    expect(emp).toBeDefined();
    expect(emp!.demanda).toBe(40);
    expect(emp!.capacidade).toBe(MOVIMENTOS_POR_OPERADOR_EMPILHADEIRA);
    expect(emp!.deficit).toBe(2);
    expect(emp!.mensagem).toContain('+2 Operadores');
  });

  it('sem alertas de empilhadeira quando capacidade atende demanda', async () => {
    const dataRef = new Date('2026-06-15T00:00:00.000Z');
    prisma.agendamentoSolicitacao.groupBy.mockResolvedValue([
      { dataRef, turno: 'MANHA', _count: { id: 10 } },
    ]);
    prisma.escalaTurno.findMany.mockResolvedValue([
      {
        data: dataRef,
        turno: 'MANHA',
        funcionario: { cargo: 'OPERADOR_EMPILHADEIRA' },
      },
      {
        data: dataRef,
        turno: 'MANHA',
        funcionario: { cargo: 'GATE_CHECKER' },
      },
    ]);

    const snap = await svc.analyzeGargalos({ dias: 1, dataInicio: dataRef });
    expect(snap.alertas.filter((a) => a.cargo === 'OPERADOR_EMPILHADEIRA')).toHaveLength(0);
  });
});
