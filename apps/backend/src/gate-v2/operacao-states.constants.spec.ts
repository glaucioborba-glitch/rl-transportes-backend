import { canTransition } from './operacao-states.constants';

describe('operacao-states', () => {
  it('permite devolver da conferência do Gate só para a vistoria, sem rejeitar', () => {
    expect(canTransition('AGUARDANDO_RECONFIRMACAO', 'VISTORIA_FOTOGRAFICA')).toBe(true);
    expect(canTransition('AGUARDANDO_RECONFIRMACAO', 'REJEITADA')).toBe(true);
    expect(canTransition('REJEITADA', 'VISTORIA_FOTOGRAFICA')).toBe(false);
    expect(canTransition('RECONFIRMADA', 'VISTORIA_FOTOGRAFICA')).toBe(false);
  });
});
