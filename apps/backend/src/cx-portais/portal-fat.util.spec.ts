import { mapFaturamentoToFat, mapGateOutToFat, numeroFat, unificarFats } from './portal-fat.util';

describe('portal-fat.util', () => {
  it('numera FAT com ano/mês UTC e sufixo do id', () => {
    expect(numeroFat(new Date('2026-09-15T12:00:00.000Z'), 'aaaaaaaa-bbbb-cccc-dddd-eeeeee123abc')).toBe(
      'FAT-202609-123ABC',
    );
  });

  it('envelope mensal junta NFS-e, boleto e IDs de pátio no demonstrativo', () => {
    const fat = mapFaturamentoToFat({
      id: 'fat-mensal-00000001',
      periodo: '2026-09',
      valorTotal: 100,
      statusNfe: 'autorizada',
      statusBoleto: 'pendente',
      createdAt: new Date('2026-09-10T00:00:00.000Z'),
      itens: [{ id: 'i1', descricao: 'Handling', valor: 40 }],
      nfsEmitidas: [
        {
          id: 'n1',
          numeroNfe: '123',
          statusIpm: 'autorizada',
          createdAt: new Date('2026-09-10T00:00:00.000Z'),
          linkNfsePdf: 'https://nfse.example/123',
        },
      ],
      boletos: [
        {
          id: 'b1',
          numeroBoleto: 'BOL-1',
          valorBoleto: 100,
          dataVencimento: new Date('2026-10-10T00:00:00.000Z'),
          statusPagamento: 'pendente',
          linkPdf: 'https://boleto.example/1',
        },
      ],
      faturasArmazenagem: [
        {
          id: 'arm-1',
          valorTotal: 60,
          statusPagamento: 'AGUARDANDO_PAGAMENTO',
          dataEmissao: new Date('2026-09-09T00:00:00.000Z'),
          linkNfse: null,
          linkBoleto: null,
          linkPix: null,
          preFatura: { containerIso: 'ABCD1234567', diasCobrados: 3 },
        },
      ],
    });
    expect(fat.numeroFat).toBe('FAT-202609-000001');
    expect(fat.origem).toBe('FATURAMENTO');
    expect(fat.itens.map((i) => i.descricao)).toEqual([
      'Handling',
      'ID operacional ABCD1234567 · 3 diária(s)',
    ]);
    expect(fat.nfsEmitidas[0]?.numeroNfe).toBe('123');
    expect(fat.boletos[0]?.numeroBoleto).toBe('BOL-1');
  });

  it('não duplica Gate-Out já ligado ao faturamento mensal', () => {
    const mensal = {
      id: 'm1',
      periodo: '2026-09',
      valorTotal: 10,
      statusNfe: 'pendente',
      statusBoleto: 'pendente',
      createdAt: new Date('2026-09-12T00:00:00.000Z'),
      faturasArmazenagem: [
        {
          id: 'arm-ligada',
          valorTotal: 10,
          statusPagamento: 'PAGO',
          dataEmissao: new Date('2026-09-11T00:00:00.000Z'),
          linkNfse: null,
          linkBoleto: null,
          linkPix: null,
        },
      ],
    };
    const avulsa = {
      id: 'arm-avulsa',
      valorTotal: 20,
      dataEmissao: new Date('2026-09-13T00:00:00.000Z'),
      statusPagamento: 'AGUARDANDO_PAGAMENTO',
      linkNfse: 'https://nfse',
      linkBoleto: 'https://bol',
      linkPix: null,
      preFatura: { containerIso: 'XYZU1234567', diasCobrados: 2 },
    };
    const fats = unificarFats([mensal], [mensal.faturasArmazenagem[0], avulsa]);
    expect(fats.map((f) => f.origem).sort()).toEqual(['FATURAMENTO', 'GATE_OUT']);
    expect(fats.find((f) => f.origem === 'GATE_OUT')?.id).toBe('arm-avulsa');
    expect(mapGateOutToFat(avulsa).referencia).toContain('XYZU1234567');
  });
});
