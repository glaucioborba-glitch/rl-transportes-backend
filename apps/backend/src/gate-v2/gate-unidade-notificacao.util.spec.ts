import {
  corpoNotificacaoUnidade,
  deltasDePatch,
  LABEL_PATCH_CONTAINER,
  tituloNotificacaoUnidade,
} from './gate-unidade-notificacao.util';

describe('gate-unidade-notificacao.util', () => {
  it('monta deltas só quando o valor mudou', () => {
    expect(
      deltasDePatch(
        { booking: 'BK-2', navio: 'MSC OSCAR', processo: 'P1' },
        { booking: 'BK-1', navio: 'MSC OSCAR', processo: 'P1' },
        LABEL_PATCH_CONTAINER,
      ),
    ).toEqual([{ campo: 'booking', label: 'Booking', antes: 'BK-1', depois: 'BK-2' }]);
  });

  it('titulo e corpo descrevem a alteração do ID', () => {
    const campos = [{ campo: 'navio', label: 'Navio', antes: 'A', depois: 'B' }];
    expect(tituloNotificacaoUnidade(42, campos)).toBe('Navio alterado no ID 42');
    expect(corpoNotificacaoUnidade('MSCU1234567', 'PORTAL', 'ACME LTDA', campos)).toContain(
      'pelo portal do cliente',
    );
    expect(tituloNotificacaoUnidade(7, [
      ...campos,
      { campo: 'booking', label: 'Booking', antes: '1', depois: '2' },
    ])).toBe('Alteração no ID 7');
  });
});
