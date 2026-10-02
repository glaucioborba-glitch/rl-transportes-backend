import {
  formatProtocoloNumero,
  nextProtocoloSolicitacao,
  numeroIdDaSolicitacao,
  parseProtocoloNumero,
  protocoloBuscaWhere,
  rotuloAuditoriaControle,
  rotuloControleOperacao,
} from './protocolo-solicitacao.util';

describe('protocolo-solicitacao.util', () => {
  it('formata e parseia a sequência numerada', () => {
    expect(formatProtocoloNumero(1)).toBe('1');
    expect(formatProtocoloNumero(1284)).toBe('1284');
    expect(parseProtocoloNumero('42')).toBe(42);
    expect(parseProtocoloNumero('RL-2026-A1B2C3D4')).toBeNull();
    expect(parseProtocoloNumero('#1')).toBeNull();
  });

  it('escolhe o ID da entrada quando existir', () => {
    expect(
      numeroIdDaSolicitacao({
        unidadeProcessosEntrada: [{ numero: 1284 }],
        unidadeProcessosSaida: [{ numero: 99 }],
      }),
    ).toBe(1284);
    expect(numeroIdDaSolicitacao({ unidadeProcessosSaida: [{ numero: 7 }] })).toBe(7);
    expect(numeroIdDaSolicitacao({})).toBeNull();
  });

  it('mantém o ID como controle principal e o protocolo como secundário', () => {
    expect(rotuloControleOperacao({ protocolo: '18' })).toEqual({ primario: 'Protocolo 18' });
    expect(rotuloControleOperacao({ unidadeProcessoNumero: 1284, protocolo: '18' })).toEqual({
      primario: 'ID 1284',
      secundario: 'Protocolo 18',
    });
    expect(rotuloAuditoriaControle({ unidadeProcessoNumero: 1284, protocolo: '18' })).toBe(
      'ID 1284 (Protocolo 18)',
    );
  });

  it('busca numérica cobre protocolo e ID', () => {
    expect(protocoloBuscaWhere('#18')).toEqual({
      OR: [
        { protocolo: '18' },
        { protocolo: { contains: '18', mode: 'insensitive' } },
        { unidadeProcessosEntrada: { some: { numero: 18 } } },
        { unidadeProcessosSaida: { some: { numero: 18 } } },
      ],
    });
    expect(protocoloBuscaWhere('RL-2026-AA')).toEqual({
      protocolo: { contains: 'RL-2026-AA', mode: 'insensitive' },
    });
  });

  it('lê o próximo valor da sequência', async () => {
    const db = { $queryRaw: jest.fn().mockResolvedValue([{ n: 9 }]) };
    await expect(nextProtocoloSolicitacao(db as never)).resolves.toBe('9');
  });
});
