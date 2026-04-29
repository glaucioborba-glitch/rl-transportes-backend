import { parseCsvExtrato, parseOfxExtrato } from './extrato-parser';

describe('extrato-parser', () => {
  it('parse CSV básico', () => {
    const csv = `data,valor,historico
2026-04-28,1234.56,teste cobranca`;
    const rows = parseCsvExtrato(csv, 'batch-1');
    expect(rows.length).toBe(1);
    expect(rows[0]?.valor).toBeCloseTo(1234.56, 2);
    expect(rows[0]?.tipo).toBeDefined();
  });

  it('parse OFX mínimo', () => {
    const ofx = `
OFXHEADER:100
<BANKTRANLIST>
<STMTTRN>
<TRNAMT>250.00</TRNAMT>
<DTPOSTED>20260428100000</DTPOSTED>
<MEMO>TEST</MEMO>
<FITID>1</FITID>
</STMTTRN>
</BANKTRANLIST>`;
    const rows = parseOfxExtrato(ofx, 'b2');
    expect(rows.length).toBe(1);
    expect(rows[0]?.valor).toBe(250);
    expect(rows[0]?.tipo).toBe('CREDITO');
  });
});
