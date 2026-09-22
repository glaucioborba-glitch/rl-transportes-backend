import { resolveAlertaDestinatarios } from './resolve-alerta-destinatarios.util';

describe('resolveAlertaDestinatarios', () => {
  const envCheio = { candidatos: ['financeiro@rl.com.br', 'backup@rl.com.br'] };

  it('prioriza a lista do terminal', () => {
    const r = resolveAlertaDestinatarios(['fin@terminal.com.br', 'ger@terminal.com.br'], envCheio);
    expect(r.origem).toBe('tenant');
    expect(r.destinatarios).toEqual(['fin@terminal.com.br', 'ger@terminal.com.br']);
    expect(r.to).toBe('fin@terminal.com.br, ger@terminal.com.br');
  });

  it('normaliza espaços, maiúsculas e repetidos', () => {
    const r = resolveAlertaDestinatarios(['  Fin@Terminal.com.br ', 'fin@terminal.com.br'], envCheio);
    expect(r.destinatarios).toEqual(['fin@terminal.com.br']);
  });

  it('ignora entradas sem @ e cai no .env quando sobra nada', () => {
    const r = resolveAlertaDestinatarios(['   ', 'invalido'], envCheio);
    expect(r.origem).toBe('env');
    expect(r.destinatarios).toEqual(['financeiro@rl.com.br']);
  });

  it('usa o primeiro candidato do .env quando o terminal não tem lista', () => {
    const r = resolveAlertaDestinatarios(undefined, {
      candidatos: [undefined, ' SMTP@rl.com.br '],
    });
    expect(r.origem).toBe('env');
    expect(r.to).toBe('smtp@rl.com.br');
  });

  it('marca none quando não há destino em lugar nenhum', () => {
    const r = resolveAlertaDestinatarios([], { candidatos: [undefined, ''] });
    expect(r.origem).toBe('none');
    expect(r.to).toBe('');
  });
});
