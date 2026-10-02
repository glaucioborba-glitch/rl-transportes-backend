import {
  agruparDiasPorFaixa,
  calcularArmazenagemEscalonada,
  calcularEnergiaEscalonada,
  FAIXAS_DIARIA_PADRAO,
  formatarDiariasExcedentes,
  formatarFaixasCobranca,
  resolveFaixasEnergiaFromCadastroItem,
  resolveFaixasFromCadastroItem,
  SUBSTANTIVO_DIA_ENERGIA,
} from './faixa-diaria-calculator';

describe('FaixaDiariaCalculator', () => {
  const faixas = FAIXAS_DIARIA_PADRAO;

  it('7 dias free + 18 dias permanência = R$ 375', () => {
    expect(calcularArmazenagemEscalonada(18, 7, faixas)).toBe(375);
  });

  it('dentro do free time = R$ 0', () => {
    expect(calcularArmazenagemEscalonada(7, 7, faixas)).toBe(0);
    expect(calcularArmazenagemEscalonada(5, 7, faixas)).toBe(0);
  });

  it('free time comercial 15 dias — só cobra a partir do dia 16', () => {
    expect(calcularArmazenagemEscalonada(20, 15, faixas)).toBe(45 + 45 + 45 + 45 + 45);
  });

  it('sem faixas = R$ 0', () => {
    expect(calcularArmazenagemEscalonada(20, 7, [])).toBe(0);
  });

  it('cadastro sem faixas e sem diária plana não inventa faixa padrão', () => {
    expect(resolveFaixasFromCadastroItem({})).toEqual([]);
    expect(resolveFaixasFromCadastroItem({ faixasDiaria: [], tarifaDiariaArmazenagem: null })).toEqual([]);
  });

  it('energia: 16 dias conectados nas faixas 8–15 / 16+ = R$ 285', () => {
    expect(calcularEnergiaEscalonada(16, faixas)).toBe(285);
  });

  it('energia: dias 1–7 sem faixa correspondente = R$ 0', () => {
    expect(calcularEnergiaEscalonada(7, faixas)).toBe(0);
  });

  it('energia: tarifa plana vira faixa 1..∞', () => {
    expect(resolveFaixasEnergiaFromCadastroItem({ tarifaEnergiaReeferDiaria: 220 })).toEqual([
      { diaInicio: 1, diaFim: null, valorDiaria: 220 },
    ]);
    expect(calcularEnergiaEscalonada(16, resolveFaixasEnergiaFromCadastroItem({ tarifaEnergiaReeferDiaria: 220 }))).toBe(
      3520,
    );
  });

  it('agrupa e descreve diárias por faixa no padrão de fatura', () => {
    const grupos = agruparDiasPorFaixa(8, 16, faixas);
    expect(grupos).toEqual([
      { quantidade: 8, valorUnitario: 30 },
      { quantidade: 1, valorUnitario: 45 },
    ]);
    expect(formatarDiariasExcedentes(grupos)).toBe(
      '08 diárias excedentes de R$ 30,00 cada + 01 diária excedente de R$ 45,00 cada',
    );
    expect(formatarDiariasExcedentes([{ quantidade: 4, valorUnitario: 30 }])).toBe(
      '04 diárias excedentes de R$ 30,00 cada',
    );
  });

  it('descreve energia por faixa com o mesmo padrão', () => {
    const grupos = agruparDiasPorFaixa(1, 16, faixas);
    expect(formatarFaixasCobranca(grupos, SUBSTANTIVO_DIA_ENERGIA)).toBe(
      '08 dias de R$ 30,00 e 01 de R$ 45,00',
    );
  });
});
