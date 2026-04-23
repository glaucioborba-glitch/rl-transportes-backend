import { buildEmissaoNfseIpmXml, buildCancelamentoNfseIpmXml, buildConsultaNfseIpmPorAutenticidade } from './ipm-nfse-xml.builder';

describe('ipm-nfse-xml.builder', () => {
  const tomador = {
    tipo: 'J' as const,
    cpfcnpj: '21425093000176',
    ie: '',
    nomeRazaoSocial: 'UNITRADING LOGISTICA',
    sobrenomeNomeFantasia: 'UNITRADING LOGISTICA',
    numeroResidencia: '433',
    complemento: 'BLOCO B',
    pontoReferencia: '0',
    pais: 'Brasil',
    siglaPais: 'BR',
    codigoIbgePais: '1058',
    estado: 'SP',
    cidadeTom: '7071',
    logradouro: 'AVENIDA ANA COSTA',
    bairro: 'GONZAGA',
    cep: '11060003',
    dddFoneResidencial: '0',
    dddFoneComercial: '0',
    foneResidencial: '00000000000',
    foneComercial: '0',
    dddFax: '0',
    foneFax: '0',
    email: 'financeiro@example.com',
  };

  it('gera XML de emissão com tags do layout 430', () => {
    const xml = buildEmissaoNfseIpmXml({
      rps: {
        nroReciboProvisorio: '225',
        serieReciboProvisorio: 'RPS',
        dataEmissao: '22/04/2026',
        horaEmissao: '16:30:00',
      },
      dataFato: '22/04/2026',
      valorTotal: 5840,
      observacao: '0',
      prestador: { cnpj: '27692077000126', cidadeTom: '8221' },
      tomador,
      servico: {
        codigoLocalPrestacao: '8221',
        codigoAtividade: '4930201',
        codigoItemListaServico: '160201',
        descritivo: 'Linha 1\nLinha 2',
        aliquotaPercent: 2,
        situacaoTributaria: '0',
        valorTributavel: 5840,
        tributaMunicipioPrestador: 'S',
        tributaMunicipioTomador: 'N',
      },
    });
    expect(xml).toContain('<?xml version="1.0" encoding="ISO-8859-1"?>');
    expect(xml).toContain('<cpfcnpj>27692077000126</cpfcnpj>');
    expect(xml).toContain('<cidade>8221</cidade>');
    expect(xml).toContain('<codigo_item_lista_servico>160201</codigo_item_lista_servico>');
    expect(xml).toContain('<codigo_atividade>4930201</codigo_atividade>');
    expect(xml).toContain('<valor_tributavel>5.840,00</valor_tributavel>');
    expect(xml).toContain('2,0000');
    expect(xml).toContain('Linha 1');
    expect(xml).not.toContain('<script');
  });

  it('gera XML de cancelamento com tipo C e motivo', () => {
    const xml = buildCancelamentoNfseIpmXml({
      numeroNfse: '430',
      serieNfse: '1',
      motivo: 'Erro de emissão',
      prestador: { cnpj: '27692077000126', cidadeTom: '8221' },
    });
    expect(xml).toContain('<numero_nfse>430</numero_nfse>');
    expect(xml).toContain('<tipo>C</tipo>');
    expect(xml).toContain('Erro de emissão');
  });

  it('gera XML de consulta por código de autenticidade', () => {
    const c = '8221220426163029540276920772026047397602';
    const xml = buildConsultaNfseIpmPorAutenticidade(c);
    expect(xml).toContain(c);
    expect(xml).toContain('<codigo_autenticidade>');
  });
});
