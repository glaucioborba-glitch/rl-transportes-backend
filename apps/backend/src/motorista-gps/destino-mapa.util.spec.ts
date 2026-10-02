import { escolherDestinoMapa } from './destino-mapa.util';

describe('escolherDestinoMapa', () => {
  const fl = { id: 'fl', tipo: 'TERMINAL', lat: -26.9, lng: -48.65 };
  const porto = { id: 'pn', tipo: 'PORTO', lat: -26.89, lng: -48.66 };
  const sem = { id: 'x', tipo: 'CIDADE', lat: null, lng: null };

  it('usa o id pedido quando tem coordenada', () => {
    expect(escolherDestinoMapa([fl, porto, sem], 'pn')?.id).toBe('pn');
  });

  it('ignora id sem coordenada e cai no terminal', () => {
    expect(escolherDestinoMapa([fl, porto, sem], 'x')?.id).toBe('fl');
  });

  it('sem pedido prefere TERMINAL', () => {
    expect(escolherDestinoMapa([porto, fl], null)?.id).toBe('fl');
  });

  it('sem nenhum ponto devolve null', () => {
    expect(escolherDestinoMapa([sem], 'x')).toBeNull();
  });
});
