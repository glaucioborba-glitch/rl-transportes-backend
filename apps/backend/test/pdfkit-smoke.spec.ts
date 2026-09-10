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
    placaCavalo: 'ABC1D23',
    placaCarreta: 'DEF4G56',
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

  it('deve gerar PDF com campos de assinatura manual', async () => {
    const buffer = await generateRICPDFBuffer(
      minimalRicData({
        assinaturaModo: 'MANUAL',
        motoristaNome: 'Luciana Mendes',
        motoristaCPF: '12345678909',
        operadorNome: 'Admin RL',
        operadorCPF: '39053344705',
      }),
    );

    expect(buffer.toString('ascii', 0, 4)).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('mantém grade compacta com 9 fotos SVG (sem páginas vazias)', async () => {
    const svg =
      'data:image/svg+xml;base64,' +
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>').toString('base64');
    const tipos = [
      'CONTAINER_OCR',
      'PLACA_OCR',
      'PLACA_CARRETA_OCR',
      'LACRE_OCR',
      'CABO_TOMADA',
      'LADO_FRONTAL',
      'LADO_TRASEIRO',
      'LADO_DIREITO',
      'LADO_ESQUERDO',
    ];
    const buffer = await generateRICPDFBuffer(
      minimalRicData({
        assinaturaModo: 'MANUAL',
        agendamento: '24/08/2026 - TARDE',
        caminhao: 'LS',
        checkin: '24/08/2026, 19:25:11',
        unidadeProcesso: '—',
        direcao: 'Saída',
        booking: 'BK-SEED',
        processo: 'PROC-SEED',
        navio: '—',
        lacre: 'LAC770006',
        vistoria: {
          fotos: tipos.map((tipo) => ({
            tipo,
            imagem: svg,
            ocrResult: tipo === 'CONTAINER_OCR' ? 'FCIU7700069' : undefined,
            ocrMatch: true,
          })),
          avarias: [{ foto: svg, localizacao: 'Porta', descricao: 'Amassado' }],
          dataVistoria: new Date().toISOString(),
          portariaResponsavel: 'Portaria RL',
        },
      }),
    );

    const pages = buffer.toString('latin1').match(/\/Type\s*\/Page(?!s)/g)?.length ?? 0;
    expect(pages).toBe(1);
  });
});
