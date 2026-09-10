import {
  competenciaAtual,
  competenciaMesAnterior,
  cronPodeFechar,
  previaPodeGravar,
  simularEncargos,
} from './empresa-encargos.util';

describe('simularEncargos', () => {
  it('Simples soma só o DAS (alíquota ISS)', () => {
    const out = simularEncargos({
      regime: 'SIMPLES_NACIONAL',
      receita: 100_000,
      aliquotaIss: 6,
      aliquotaPis: 0.65,
      aliquotaCofins: 3,
      aliquotaCsll: 9,
      aliquotaIrpj: 15,
      simplesAnexo: 'Anexo III',
    });
    expect(out.total).toBe(6000);
    expect(out.linhas.find((l) => l.codigo === 'DAS')?.entraNaSoma).toBe(true);
    expect(out.linhas.filter((l) => l.entraNaSoma)).toHaveLength(1);
    expect(out.cargaEfetivaPct).toBe(6);
  });

  it('Presumido soma ISS + PIS + COFINS + CSLL + IRPJ', () => {
    const out = simularEncargos({
      regime: 'LUCRO_PRESUMIDO',
      receita: 10_000,
      aliquotaIss: 2,
      aliquotaPis: 0.65,
      aliquotaCofins: 3,
      aliquotaCsll: 1.08,
      aliquotaIrpj: 1.2,
    });
    expect(out.total).toBe(793);
    expect(out.linhas.filter((l) => l.entraNaSoma)).toHaveLength(5);
  });

  it('competenciaMesAnterior volta um mês', () => {
    expect(competenciaMesAnterior(new Date(2026, 8, 1))).toBe('2026-08');
    expect(competenciaMesAnterior(new Date(2027, 0, 1))).toBe('2026-12');
  });

  it('competenciaAtual é o mês civil da data', () => {
    expect(competenciaAtual(new Date(2026, 8, 15))).toBe('2026-09');
  });

  it('cron substitui prévia e preserva fechamento gravado', () => {
    expect(cronPodeFechar(null)).toBe(true);
    expect(cronPodeFechar({ geradoPor: 'PREVIA' })).toBe(true);
    expect(cronPodeFechar({ geradoPor: 'CRON' })).toBe(false);
    expect(cronPodeFechar({ geradoPor: 'USUARIO' })).toBe(false);
  });

  it('gerar agora só atualiza prévia', () => {
    expect(previaPodeGravar(null)).toBe(true);
    expect(previaPodeGravar({ geradoPor: 'PREVIA' })).toBe(true);
    expect(previaPodeGravar({ geradoPor: 'CRON' })).toBe(false);
    expect(previaPodeGravar({ geradoPor: 'USUARIO' })).toBe(false);
  });

  it('receita zero não estoura', () => {
    const out = simularEncargos({
      regime: 'LUCRO_REAL',
      receita: 0,
      aliquotaIss: 2,
      aliquotaPis: 0.65,
      aliquotaCofins: 3,
      aliquotaCsll: 9,
      aliquotaIrpj: 15,
    });
    expect(out.total).toBe(0);
    expect(out.cargaEfetivaPct).toBe(0);
  });
});
