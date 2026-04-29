import {
  construirDivergenciasFaturamento,
  divergenciasNotasDuplicadasPorNumero,
  extrairValorMonetarioXmlNfse,
  indiceConfiabilidadeFiscalPct,
  nfsStatusEmitidoOk,
  scoreRiscoFiscalPct,
  scoreRiscoOperacionalPct,
} from './fiscal-governanca.calculations';

describe('fiscal-governanca.calculations', () => {
  it('detecta faturamento sem NFS-e aceita', () => {
    const divs = construirDivergenciasFaturamento([
      {
        id: 'f1',
        valorTotal: 1000,
        itensValorSoma: 1000,
        nfsEmitidas: [{ id: 'n1', numeroNfe: '1', statusIpm: 'pendente', xmlNfe: '', updatedAt: new Date() }],
        boletos: [],
        solicitacoesCount: 1,
        itensDescricaoVazia: false,
        itensValorZero: false,
      },
    ]);
    expect(divs.some((d) => d.codigo === 'FAT_SEM_NFSE_EMITIDA')).toBe(true);
  });

  it('extrai valor monetário do XML quando presente', () => {
    const xml = '<root><ValorLiquidoNfse>1.234,56</ValorLiquidoNfse></root>';
    expect(extrairValorMonetarioXmlNfse(xml)).toBe(1234.56);
  });

  it('scoreRiscoFiscalPct limita em 100', () => {
    const many = Array.from({ length: 20 }, () => ({ severidade: 'ALTA' as const }));
    expect(scoreRiscoFiscalPct(many)).toBe(100);
  });

  it('indiceConfiabilidadeFiscalPct combina riscos', () => {
    expect(indiceConfiabilidadeFiscalPct(10, 10)).toBeGreaterThan(80);
  });

  it('duplicidade por número gera divergência quando há grupos', () => {
    const d = divergenciasNotasDuplicadasPorNumero([
      { id: 'a', numeroNfe: '10', faturamentoId: 'f1' },
      { id: 'b', numeroNfe: '10', faturamentoId: 'f2' },
    ]);
    expect(d[0]?.codigo).toBe('NFSE_NUMERO_DUPLICADO');
  });

  it('scoreRiscoOperacionalPct considera segurança', () => {
    const s = scoreRiscoOperacionalPct({
      eventosCriticos: 2,
      fluxosAnomalos: 1,
      segurancaEventos: 5,
    });
    expect(s).toBeGreaterThan(0);
  });

  it('nfsStatusEmitidoOk reconhece ACEITO', () => {
    expect(nfsStatusEmitidoOk('ACEITO')).toBe(true);
  });
});
