import { EstagioCobranca } from '@prisma/client';
import {
  resolveProximoEstagioCobranca,
  mergeReguaCobranca,
  DEFAULT_REGUA_COBRANCA,
  buildDunningMessage,
} from './regua-cobranca.util';

describe('regua-cobranca.util', () => {
  const venc = new Date('2026-07-15T12:00:00.000Z');

  it('dispara pré-vencimento X dias antes', () => {
    const regua = mergeReguaCobranca({ diasPreVencimento: 2 });
    const asOf = new Date('2026-07-13T12:00:00.000Z');
    expect(
      resolveProximoEstagioCobranca({
        estagioAtual: EstagioCobranca.NENHUM,
        dataVencimento: venc,
        diasToleranciaBloqueio: 30,
        regua,
        asOf,
      }),
    ).toBe(EstagioCobranca.PRE_VENCIMENTO);
  });

  it('dispara vencimento hoje após pré-vencimento', () => {
    const regua = mergeReguaCobranca({});
    const asOf = new Date('2026-07-15T12:00:00.000Z');
    expect(
      resolveProximoEstagioCobranca({
        estagioAtual: EstagioCobranca.PRE_VENCIMENTO,
        dataVencimento: venc,
        diasToleranciaBloqueio: 30,
        regua,
        asOf,
      }),
    ).toBe(EstagioCobranca.VENCIMENTO_HOJE);
  });

  it('dispara atraso leve após Y dias', () => {
    const regua = mergeReguaCobranca({ diasAtrasoLeve: 3 });
    const asOf = new Date('2026-07-18T12:00:00.000Z');
    expect(
      resolveProximoEstagioCobranca({
        estagioAtual: EstagioCobranca.VENCIMENTO_HOJE,
        dataVencimento: venc,
        diasToleranciaBloqueio: 30,
        regua,
        asOf,
      }),
    ).toBe(EstagioCobranca.ATRASO_LEVE);
  });

  it('dispara pré-bloqueio no último dia de tolerância', () => {
    const regua = mergeReguaCobranca({ diasPreBloqueio: 1 });
    const asOf = new Date('2026-08-14T12:00:00.000Z');
    expect(
      resolveProximoEstagioCobranca({
        estagioAtual: EstagioCobranca.ATRASO_LEVE,
        dataVencimento: venc,
        diasToleranciaBloqueio: 30,
        regua,
        asOf,
      }),
    ).toBe(EstagioCobranca.PRE_BLOQUEIO);
  });

  it('não avança se régua desativada', () => {
    expect(
      resolveProximoEstagioCobranca({
        estagioAtual: EstagioCobranca.NENHUM,
        dataVencimento: venc,
        diasToleranciaBloqueio: 30,
        regua: { ...DEFAULT_REGUA_COBRANCA, ativo: false },
        asOf: new Date('2026-07-13T12:00:00.000Z'),
      }),
    ).toBeNull();
  });

  it('gera copy B2B para pré-vencimento', () => {
    const msg = buildDunningMessage(EstagioCobranca.PRE_VENCIMENTO, {
      faturaNumero: 'RPS-123',
      valorExibicao: 1500.5,
      dataVencimento: venc,
      portalLink: 'https://portal/link',
      diasAtraso: 0,
    });
    expect(msg).toContain('RPS-123');
    expect(msg).toContain('https://portal/link');
  });
});
