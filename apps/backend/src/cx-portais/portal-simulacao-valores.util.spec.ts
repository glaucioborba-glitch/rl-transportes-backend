import {
  isServicoAdicionalCodigo,
  mesclarPreFaturaComProjecao,
  parseDataSaida,
  pickOperacaoItem,
  scoreOperacaoItem,
} from './portal-simulacao-valores.util';

describe('portal-simulacao-valores.util', () => {
  it('exclui operações do ciclo de armazenagem/gate', () => {
    expect(isServicoAdicionalCodigo('INSPECAO')).toBe(true);
    expect(isServicoAdicionalCodigo('reparo')).toBe(true);
    expect(isServicoAdicionalCodigo('ARMAZENAGEM')).toBe(false);
    expect(isServicoAdicionalCodigo('BAIXA')).toBe(false);
    expect(isServicoAdicionalCodigo('COLETA')).toBe(false);
    expect(isServicoAdicionalCodigo('HANDLING')).toBe(false);
    expect(isServicoAdicionalCodigo('TOMADA')).toBe(false);
  });

  it('escolhe o item mais específico da tabela', () => {
    const itens = [
      { tipoOperacaoCodigo: 'INSPECAO', tipoContainerCodigo: '*', containerTamanho: '*', valor: 50, unidade: 'POR_OPERACAO' },
      { tipoOperacaoCodigo: 'INSPECAO', tipoContainerCodigo: 'DRYDC', containerTamanho: "40'", valor: 70, unidade: 'POR_OPERACAO' },
      { tipoOperacaoCodigo: 'REPARO', tipoContainerCodigo: '*', containerTamanho: '*', valor: 120, unidade: 'POR_HORA' },
    ];
    const hit = pickOperacaoItem(itens, 'inspecao', 'DRY', "40'", false);
    expect(hit?.valor).toBe(70);
    const wildcard = pickOperacaoItem(itens, 'REPARO', 'REEFER', '20', true);
    expect(wildcard?.valor).toBe(120);
    expect(pickOperacaoItem(itens, 'LAVAGEM', 'DRYDC', '40', false)).toBeNull();
  });

  it('rejeita item de outro tipo/tamanho', () => {
    const item = {
      tipoOperacaoCodigo: 'INSPECAO',
      tipoContainerCodigo: 'DRYDC',
      containerTamanho: "20'",
      valor: 40,
      unidade: 'POR_OPERACAO',
    };
    expect(scoreOperacaoItem(item, ['REEFER'], "40'")).toBe(-1);
    expect(scoreOperacaoItem(item, ['DRYDC'], "40'")).toBe(-1);
    expect(scoreOperacaoItem(item, ['DRYDC'], "20'")).toBeGreaterThan(0);
  });

  it('interpreta a data de saída como fim do dia UTC', () => {
    const asOf = parseDataSaida('2026-08-20', new Date('2026-08-17T12:00:00.000Z'));
    expect(asOf.toISOString()).toBe('2026-08-20T23:59:59.999Z');
  });

  it('rejeita data inválida ou muito futura', () => {
    expect(() => parseDataSaida('20/08/2026')).toThrow(/AAAA-MM-DD/);
    expect(() => parseDataSaida('2026-13-40')).toThrow(/inválida/);
    expect(() => parseDataSaida('2035-01-01', new Date('2026-08-17T00:00:00.000Z'))).toThrow(/3 anos/);
  });

  it('mantém itens já lançados na pré-fatura e projeta diária/energia/saída', () => {
    const merged = mesclarPreFaturaComProjecao(
      [
        { eventoGatilho: 'GATE_IN', descricao: 'Handling', quantidade: 1, valorUnitario: 180, valorTotal: 180 },
        { eventoGatilho: 'SERVICO_ADICIONAL', descricao: 'Lavagem', quantidade: 1, valorUnitario: 90, valorTotal: 90 },
        { eventoGatilho: 'SHIFTING_EXTRA', descricao: 'Shifting', quantidade: 1, valorUnitario: 40, valorTotal: 40 },
        { eventoGatilho: 'DIARIA_ARMAZENAGEM', descricao: 'Diária (hoje)', quantidade: 2, valorUnitario: 85, valorTotal: 170 },
      ],
      [
        { eventoGatilho: 'GATE_IN', descricao: 'Handling (tabela)', quantidade: 1, valorUnitario: 180, valorTotal: 180 },
        { eventoGatilho: 'DIARIA_ARMAZENAGEM', descricao: 'Diária até a saída', quantidade: 5, valorUnitario: 85, valorTotal: 425 },
        { eventoGatilho: 'ENERGIA_REEFER', descricao: 'Energia', quantidade: 3, valorUnitario: 40, valorTotal: 120 },
        { eventoGatilho: 'GATE_OUT', descricao: 'Gate-out', quantidade: 1, valorUnitario: 50, valorTotal: 50 },
      ],
    );
    expect(merged.map((i) => `${i.origem}:${i.eventoGatilho}:${i.valorTotal}`)).toEqual([
      'PRE_FATURA:GATE_IN:180',
      'PRE_FATURA:SERVICO_ADICIONAL:90',
      'PRE_FATURA:SHIFTING_EXTRA:40',
      'PROJECAO:DIARIA_ARMAZENAGEM:425',
      'PROJECAO:ENERGIA_REEFER:120',
      'PROJECAO:GATE_OUT:50',
    ]);
  });
});
