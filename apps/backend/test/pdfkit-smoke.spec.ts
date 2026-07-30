import { generateRICPDFBuffer, type RICData } from '../src/gate-v2/ric-pdf.service';

function minimalRicData(overrides: Partial<RICData> = {}): RICData {
  const now = new Date().toISOString();
  return {
    protocolo: 'TEST-001',
    containerNumero: 'TEST1234567',
    containerTipo: 'DRY',
    containerTamanho: '40',
    containerSituacao: 'CHEIO',
    tipoOperacao: 'GATE_IN',
    placa: 'ABC1D23',
    motoristaNome: 'João Teste',
    motoristaCPF: '12345678901',
    transportadoraNome: 'Transportadora Teste',
    transportadoraCNPJ: '12345678000199',
    clienteNome: 'Cliente Teste',
    clienteCNPJ: '98765432000188',
    vistoria: {
      fotos: [],
      avarias: [],
      dataVistoria: now,
      portariaResponsavel: 'Portaria Teste',
    },
    reconfirmacao: {
      responsavel: 'Gate Teste',
      dataReconfirmacao: now,
      checklist: { containerConfere: true },
    },
    assinatura: '',
    dataAssinatura: now,
    qrToken: 'test-token',
    ...overrides,
  };
}

describe('RIC PDF (pdfkit smoke)', () => {
  it('deve gerar um PDF válido sem TypeError', async () => {
    const buffer = await generateRICPDFBuffer(
      minimalRicData({
        containerNumero: 'TEST1234567',
        clienteNome: 'Cliente Teste',
        motoristaNome: 'João Teste',
        placa: 'ABC1D23',
      }),
    );

    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.toString('ascii', 0, 4)).toBe('%PDF');
  });
});
