import { construirStarSchema } from './datahub-star.builder';
import type { RawExtractBundle } from './datahub-extract.types';

describe('datahub-star.builder', () => {
  it('construirStarSchema gera fatos e dimensões', () => {
    const raw: RawExtractBundle = {
      extraidoEm: new Date().toISOString(),
      duracaoMs: 12,
      clientes: [{ id: 'c1', nome: 'Acme', tipo: 'PJ' }],
      solicitacoes: [
        {
          id: 's1',
          clienteId: 'c1',
          protocolo: 'P1',
          status: 'CONCLUIDO',
          createdAt: new Date('2026-04-01T10:00:00Z'),
          updatedAt: new Date('2026-04-03T10:00:00Z'),
          qtUnidades: 2,
          hasPortaria: true,
          hasGate: true,
          hasPatio: true,
          hasSaida: true,
          gateRicAssinado: true,
          saidaEm: new Date('2026-04-03T12:00:00Z'),
        },
      ],
      faturamentos: [
        {
          id: 'f1',
          clienteId: 'c1',
          periodo: '2026-04',
          valorTotal: 1200,
          createdAt: new Date('2026-04-02T00:00:00Z'),
          qtItens: 2,
        },
      ],
      boletos: [
        {
          id: 'b1',
          clienteId: 'c1',
          valor: 600,
          vencimento: new Date('2026-05-01'),
          statusPagamento: 'PENDENTE',
        },
      ],
      nfs: [],
      usuariosInternos: [{ id: 'u1', role: 'GERENTE' }],
      auditoriaLinhas: 3,
    };

    const out = construirStarSchema(raw);
    expect(out.fatos.FATO_Solicitacoes?.length).toBe(1);
    expect(out.dimensoes.DIM_Clientes?.length).toBe(1);
    expect(out.linhasTotal).toBeGreaterThan(5);
  });
});
