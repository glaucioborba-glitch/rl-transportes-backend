import { formatMailFrom } from './format-mail-from.util';

describe('formatMailFrom', () => {
  const fallback = 'RL Transportes <nao-responder@rl.com>';

  it('usa o fallback quando o e-mail está vazio', () => {
    expect(formatMailFrom({ email: '', nome: 'RL', fallback })).toBe(fallback);
    expect(formatMailFrom({ email: '  ', nome: 'RL', fallback })).toBe(fallback);
  });

  it('devolve só o e-mail quando não há nome', () => {
    expect(formatMailFrom({ email: 'ops@rl.com.br', fallback })).toBe('ops@rl.com.br');
  });

  it('monta Nome <email>', () => {
    expect(
      formatMailFrom({ email: 'ops@rl.com.br', nome: 'RL Transportes', fallback }),
    ).toBe('RL Transportes <ops@rl.com.br>');
  });

  it('remove < > do nome', () => {
    expect(
      formatMailFrom({ email: 'a@b.com', nome: 'RL <ops>', fallback }),
    ).toBe('RL ops <a@b.com>');
  });
});
