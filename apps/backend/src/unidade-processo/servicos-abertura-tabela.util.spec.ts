import {
  buildLinhaTomadaDiaria,
  buildLinhasAberturaTabela,
  diasTomadaFaturaveis,
  isLancamentoAutomaticoTabela,
  pickItemMatrizArmazenagem,
  pickItemMatrizEnergia,
} from './servicos-abertura-tabela.util';

const dry20Cheio = {
  id: 'dry-20-cheio',
  categoriaItem: 'ARMAZENAGEM',
  tipoOperacaoCodigo: 'ARMAZENAGEM',
  tipoContainerCodigo: 'DRYDC',
  containerTamanho: "20'",
  statusContainer: 'CHEIO',
  valorHandling: 180,
  tarifaEnergiaReeferDiaria: null,
  faixasEnergiaReefer: null,
};

const dry20Vazio = {
  ...dry20Cheio,
  id: 'dry-20-vazio',
  statusContainer: 'VAZIO',
  valorHandling: 120,
};

const reefer40Cheio = {
  id: 'rf-40-cheio',
  categoriaItem: 'ARMAZENAGEM',
  tipoOperacaoCodigo: 'ARMAZENAGEM',
  tipoContainerCodigo: 'REEFER',
  containerTamanho: "40'",
  statusContainer: 'CHEIO',
  valorHandling: 350,
  tarifaEnergiaReeferDiaria: 45,
  faixasEnergiaReefer: [{ diaInicio: 1, diaFim: null, valorDiaria: 45 }],
};

const inspecao = {
  id: 'op-insp',
  categoriaItem: 'OPERACAO',
  tipoOperacaoCodigo: 'INSPECAO',
  tipoContainerCodigo: '*',
  containerTamanho: '*',
  statusContainer: 'AMBOS',
  valor: 50,
  unidade: 'POR_OPERACAO',
};

describe('servicos-abertura-tabela', () => {
  it('escolhe a célula tipo × tamanho × cheio/vazio', () => {
    const itens = [dry20Cheio, dry20Vazio, reefer40Cheio, inspecao];
    expect(pickItemMatrizArmazenagem(itens, 'DRYDC', '20', 'CHEIO')?.id).toBe('dry-20-cheio');
    expect(pickItemMatrizArmazenagem(itens, 'DRYDC', "20'", 'VAZIO')?.id).toBe('dry-20-vazio');
  });

  it('sempre lança Handling e ignora operações extras (inspeção, lavagem…)', () => {
    const linhas = buildLinhasAberturaTabela({
      itens: [dry20Cheio, inspecao],
      tipo: 'DRYDC',
      tamanho: '20',
      status: 'CHEIO',
      refrigerado: false,
    });
    expect(linhas.map((l) => l.codigo)).toEqual(['HANDLING']);
    expect(linhas[0]?.valorTotal).toBe(180);
    expect(linhas[0]?.payload.automatico).toBe(true);
  });

  it('na abertura só lança Handling — Tomada não entra pela flag refrigerado', () => {
    const linhas = buildLinhasAberturaTabela({
      itens: [reefer40Cheio],
      tipo: 'REEFER',
      tamanho: '40',
      status: 'CHEIO',
      refrigerado: true,
    });
    expect(linhas.map((l) => l.codigo)).toEqual(['HANDLING']);
  });

  it('Tomada por diária usa dias ligados e a faixa da matriz', () => {
    const conectado = new Date('2026-09-10T10:00:00.000Z');
    const asOf = new Date('2026-09-12T10:00:00.000Z');
    expect(
      diasTomadaFaturaveis([{ tipo: 'CONECTADO', at: conectado }], asOf, true),
    ).toBeGreaterThanOrEqual(2);
    const mesmoDia = new Date('2026-09-10T18:00:00.000Z');
    expect(
      diasTomadaFaturaveis(
        [
          { tipo: 'CONECTADO', at: conectado },
          { tipo: 'DESCONECTADO', at: mesmoDia },
        ],
        mesmoDia,
        false,
      ),
    ).toBe(1);

    const linha = buildLinhaTomadaDiaria({
      itens: [reefer40Cheio],
      tipo: 'REEFER',
      tamanho: '40',
      status: 'CHEIO',
      dias: 3,
      conectada: true,
    });
    expect(linha?.codigo).toBe('TOMADA');
    expect(linha?.quantidade).toBe(3);
    expect(linha?.valorTotal).toBe(135);
    expect(linha?.payload.automatico).toBe(true);
  });

  it('Tomada de dry ligado usa a diária REEFER da matriz (não a célula dry sem energia)', () => {
    const linha = buildLinhaTomadaDiaria({
      itens: [dry20Cheio, reefer40Cheio],
      tipo: 'DRYDC',
      tamanho: '20',
      status: 'CHEIO',
      dias: 2,
      conectada: true,
    });
    expect(linha?.codigo).toBe('TOMADA');
    expect(linha?.valorUnitario).toBe(45);
    expect(linha?.valorTotal).toBe(90);
    expect(pickItemMatrizEnergia([dry20Cheio, reefer40Cheio], 'DRYDC', '20', 'CHEIO')?.id).toBe(
      'rf-40-cheio',
    );
  });

  it('não inventa preço se a matriz não tem célula', () => {
    const linhas = buildLinhasAberturaTabela({
      itens: [inspecao],
      tipo: 'DRYDC',
      tamanho: '20',
      status: 'CHEIO',
    });
    expect(linhas).toEqual([]);
  });

  it('reconhece payload automático da tabela', () => {
    expect(isLancamentoAutomaticoTabela({ automatico: true, origem: 'TABELA_PRECO' })).toBe(true);
    expect(isLancamentoAutomaticoTabela({ efeito: 'NENHUM' })).toBe(false);
  });
});
