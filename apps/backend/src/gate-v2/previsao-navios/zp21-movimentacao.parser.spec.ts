import { parseZp21MovimentacaoHtml } from './zp21-movimentacao.parser';

const FIXTURE = `
<html><body>
<h2>Manobras previstas</h2>
<table>
  <thead><tr><th>Data</th><th>Horário</th><th>Manobra</th><th>Berço</th><th>Bordo</th><th>Navio</th><th>Rota</th><th>Loa</th><th>Boca</th><th>Calado</th><th>Situação</th></tr></thead>
  <tbody>
    <tr><td>05/08/2026</td><td>05:00 ETB</td><td>Entrada</td><td>PNAVE 01</td><td>BB</td><td>LOG-IN JACARANDA</td><td>Bacia 1</td><td>218,45</td><td>29,80</td><td>7,00/9,10</td><td>Fundeado</td></tr>
  </tbody>
</table>
<h2>Navios Atracados</h2>
<table>
  <thead><tr><th>Berço</th><th>Bordo</th><th>Navio</th><th>Rota</th><th>Data - Hora</th></tr></thead>
  <tbody>
    <tr><td>JBS 2</td><td>BE</td><td>MAERSK LOTA</td><td></td><td>04/08/2026 - 16:11</td></tr>
  </tbody>
</table>
<h2>Navios Fundeados</h2>
<table>
  <thead><tr><th>Navio</th><th>Loa</th><th>Posicao</th><th>Calado</th><th>Rota</th><th>Data - Hora</th></tr></thead>
  <tbody>
    <tr><td>MSC ALBANY</td><td>299,18</td><td>26 53,53 S</td><td>TBC</td><td></td><td>02/08/2026 - 00:04</td></tr>
  </tbody>
</table>
<h2>Navios Previstos</h2>
<table>
  <thead><tr><th>Navio</th><th>Loa</th><th>Calado</th><th>Rota</th><th>Previsão de chegada</th><th>Rebocadores</th></tr></thead>
  <tbody>
    <tr><td>ONE AMAZON</td><td>329,86</td><td>TBC</td><td></td><td>04/08/2026 - 13:00</td><td></td></tr>
    <tr><td>WIDE HOTEL</td><td>255,00</td><td>TBC</td><td></td><td>05/08/2026 - 07:00</td><td></td></tr>
  </tbody>
</table>
</body></html>
`;

describe('parseZp21MovimentacaoHtml', () => {
  it('extrai previstos, atracados, fundeados e manobras', () => {
    const snap = parseZp21MovimentacaoHtml(FIXTURE);
    expect(snap.previstos).toHaveLength(2);
    expect(snap.previstos[0]).toMatchObject({
      navio: 'ONE AMAZON',
      previsaoChegada: '04/08/2026 - 13:00',
    });
    expect(snap.atracados[0]).toMatchObject({ navio: 'MAERSK LOTA', berco: 'JBS 2' });
    expect(snap.fundeados[0]).toMatchObject({ navio: 'MSC ALBANY' });
    expect(snap.manobrasPrevistas[0]).toMatchObject({
      navio: 'LOG-IN JACARANDA',
      manobra: 'Entrada',
      horario: '05:00 ETB',
    });
  });
});
