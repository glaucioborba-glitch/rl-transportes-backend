import { tipoRequerTomadaReefer } from './tipo-container-tomada.util';

const tipos = [
  { codigo: 'REEFER', tomadaReefer: true },
  { codigo: 'DRYDC', tomadaReefer: false },
];

describe('tipoRequerTomadaReefer', () => {
  it('só libera quando o cadastro tem Requer tomada marcado', () => {
    expect(tipoRequerTomadaReefer(tipos, 'REEFER')).toBe(true);
    expect(tipoRequerTomadaReefer(tipos, 'reefer')).toBe(true);
    expect(tipoRequerTomadaReefer(tipos, 'DRYDC')).toBe(false);
    expect(tipoRequerTomadaReefer(tipos, '')).toBe(false);
  });
});
