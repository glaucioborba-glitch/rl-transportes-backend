import { generateRICPDF, generateRICPDFBuffer, type RICData } from '../src/gate-v2/ric-pdf.service';

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

  it('cupom térmico 80mm na assinatura digital: ID em destaque, sem OCR, duas identidades', async () => {
    const { inflateSync } = await import('zlib');
    const { FRASE_IDENTIDADE_DIGITAL, RIC_TERMICA_LARGURA_PT } = await import(
      '../src/gate-v2/ric-pdf-termica'
    );
    const buffer = await generateRICPDFBuffer(
      minimalRicData({
        assinatura: 'BIOMETRIA_OK',
        assinaturaModo: 'DIGITAL',
        unidadeProcesso: 'ID 7',
        motoristaNome: 'Glauco Andre de Borba',
        motoristaCPF: '03650163900',
        operadorNome: 'Operador Gate',
        operadorCPF: '39053344705',
        ocrPorta: {
          tipoIso: '45G1',
          rotulo: 'nao deve aparecer',
          status: 'CONFERE',
        },
        vistoria: {
          fotos: [{ tipo: 'CONTAINER_OCR', imagem: 'data:image/png;base64,xx', ocrResult: 'GCXU5119401' }],
          avarias: [],
          dataVistoria: new Date().toISOString(),
          portariaResponsavel: 'Portaria RL',
        },
      }),
    );

    expect(buffer.toString('ascii', 0, 4)).toBe('%PDF');
    const raw = buffer.toString('latin1');
    expect(raw).toContain(`/MediaBox [0 0 ${RIC_TERMICA_LARGURA_PT.toFixed(6)}`);
    expect(raw).toContain('/Helvetica-Oblique');

    const streamMatch = raw.match(/stream\r?\n([\s\S]*?)\nendstream/);
    expect(streamMatch).toBeTruthy();
    const content = inflateSync(Buffer.from(streamMatch![1], 'latin1')).toString('latin1');
    const shown = [...content.matchAll(/<([0-9A-Fa-f]+)>/g)]
      .map((m) => Buffer.from(m[1], 'hex').toString('latin1'))
      .join('');
    expect(shown).toContain('ID 7');
    expect(shown).toContain(FRASE_IDENTIDADE_DIGITAL);
    expect(shown.split(FRASE_IDENTIDADE_DIGITAL).length - 1).toBe(2);
    expect(shown).toContain('Operador Gate');
    expect(shown).toContain('Glauco Andre de Borba');
    expect(shown.toLowerCase()).not.toContain('ocr');
    expect(shown).not.toContain('45G1');
  });

  it('RIC completa força A4 com fotos mesmo na assinatura digital', async () => {
    const { RIC_TERMICA_LARGURA_PT } = await import('../src/gate-v2/ric-pdf-termica');
    const buffer = await generateRICPDFBuffer(
      minimalRicData({
        assinatura: 'BIOMETRIA_OK',
        assinaturaModo: 'DIGITAL',
        unidadeProcesso: 'ID 7',
      }),
    );
    const completa = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const stream = generateRICPDF(
        minimalRicData({
          assinatura: 'BIOMETRIA_OK',
          assinaturaModo: 'DIGITAL',
          unidadeProcesso: 'ID 7',
        }),
        { forcarCompleta: true },
      );
      stream.on('data', (c: Buffer) => chunks.push(c));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });

    expect(buffer.toString('latin1')).toContain(`/MediaBox [0 0 ${RIC_TERMICA_LARGURA_PT.toFixed(6)}`);
    expect(completa.toString('latin1')).not.toContain(
      `/MediaBox [0 0 ${RIC_TERMICA_LARGURA_PT.toFixed(6)}`,
    );
    expect(completa.toString('latin1')).toMatch(/\/MediaBox \[0 0 595/);
  });

  it('A4 duas vias: uma página, booking/processo/navio e assinatura manual', async () => {
    const { inflateSync } = await import('zlib');
    const { generateRicPdfA4Dupla } = await import('../src/gate-v2/ric-pdf-a4-dupla');
    const chunks: Buffer[] = [];
    const stream = generateRicPdfA4Dupla(
      minimalRicData({
        assinaturaModo: 'MANUAL',
        unidadeProcesso: 'ID 7',
        booking: 'BK-4432',
        processo: 'PROC-88',
        navio: 'MSC LORETO',
        motoristaNome: 'Luciana Mendes',
        operadorNome: 'Admin RL',
      }),
    );
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      stream.on('data', (c: Buffer) => chunks.push(c));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });

    expect(buffer.toString('ascii', 0, 4)).toBe('%PDF');
    const pages = buffer.toString('latin1').match(/\/Type\s*\/Page(?!s)/g)?.length ?? 0;
    expect(pages).toBe(1);

    const raw = buffer.toString('latin1');
    const streams = [...raw.matchAll(/stream\r?\n([\s\S]*?)\nendstream/g)];
    const content = streams
      .map((m) => {
        try {
          return inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1');
        } catch {
          return m[1];
        }
      })
      .join('');
    const shown = [...content.matchAll(/<([0-9A-Fa-f]+)>/g)]
      .map((m) => Buffer.from(m[1], 'hex').toString('latin1'))
      .join('');
    expect(shown).toContain('TERMINAL');
    expect(shown).toContain('MOTORISTA');
    expect(shown).toContain('VIA');
    expect(shown).toContain('BK-4432');
    expect(shown).toContain('PROC-88');
    expect(shown).toContain('MSC LORETO');
    expect(shown).toContain('Assine aqui');
    expect((shown.match(/Assine aqui/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });
});
