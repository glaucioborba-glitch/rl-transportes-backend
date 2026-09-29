import { RhAgendaService } from './rh-agenda.service';
import { PrismaService } from '../prisma/prisma.service';

describe('RhAgendaService', () => {
  const prisma = {
    cadastroColaborador: {
      findMany: jest.fn(),
    },
  };

  const service = new RhAgendaService(prisma as unknown as PrismaService);
  const hoje = new Date('2026-09-29T12:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('agrega aniversários, experiência, NR, CNH e reach stacker no horizonte', async () => {
    prisma.cadastroColaborador.findMany.mockResolvedValue([
      {
        id: 'c1',
        nome: 'Ana Operadora',
        cargo: 'Operador de reach stacker',
        departamento: 'PATIO',
        vinculo: 'CLT',
        dataAdmissao: new Date('2026-08-01T00:00:00.000Z'),
        dados: {
          dataNascimento: '1992-10-04',
          cnhValidade: '2026-10-10',
          cursoReachStackerValidade: '2026-10-20',
          nrs: [{ codigo: 'NR-11', validade: '2026-10-15' }],
        },
        familiares: [
          {
            nome: 'João',
            parentesco: 'Filho(a)',
            dataAniversario: new Date('2018-10-02T00:00:00.000Z'),
          },
        ],
      },
    ]);

    const result = await service.listAgenda(90, hoje);
    const tipos = result.eventos.map((e) => e.tipo);

    expect(tipos).toEqual(
      expect.arrayContaining([
        'ANIVERSARIO_COLABORADOR',
        'ANIVERSARIO_DEPENDENTE',
        'AVALIACAO_EXPERIENCIA',
        'CONTRATO_EXPERIENCIA',
        'CNH',
        'NR',
        'CURSO_REACH_STACKER',
      ]),
    );
    expect(result.eventos[0].data <= result.eventos[result.eventos.length - 1].data).toBe(true);
    expect(result.eventos.find((e) => e.tipo === 'ANIVERSARIO_DEPENDENTE')?.titulo).toContain('João');
  });

  it('não lista aniversário fora da janela', async () => {
    prisma.cadastroColaborador.findMany.mockResolvedValue([
      {
        id: 'c2',
        nome: 'Bruno',
        cargo: null,
        departamento: null,
        vinculo: 'CLT',
        dataAdmissao: new Date('2020-01-01T00:00:00.000Z'),
        dados: { dataNascimento: '1990-03-01' },
        familiares: [],
      },
    ]);

    const result = await service.listAgenda(30, hoje);
    expect(result.eventos.some((e) => e.tipo === 'ANIVERSARIO_COLABORADOR')).toBe(false);
    expect(result.eventos.some((e) => e.tipo === 'CONTRATO_EXPERIENCIA')).toBe(false);
  });
});
