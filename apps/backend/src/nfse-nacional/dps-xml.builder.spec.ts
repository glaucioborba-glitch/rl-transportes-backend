import {
  construirDpsXml,
  construirEventoCancelamentoXml,
  dataHoraBrasilia,
  type DpsInput,
} from './dps-xml.builder';

const BASE: DpsInput = {
  tpAmb: 2,
  serie: '1',
  numero: 15,
  emitidaEm: new Date('2026-09-21T15:30:00.000Z'),
  versaoAplicativo: 'RLTerminal-2.0',
  prestador: {
    cnpj: '27692077000126',
    inscricaoMunicipal: '12345',
    municipioIbge: '4211306',
    optanteSimplesNacional: 3,
    regimeEspecialTributacao: 0,
  },
  tomador: {
    documento: '19131243000197',
    nome: 'Cliente Portal QA',
    email: 'financeiro@cliente.com.br',
    telefone: '(47) 3333-4444',
    municipioIbge: '4205407',
    cep: '88301-000',
    logradouro: 'Rua das Flores',
    numero: '100',
    bairro: 'Centro',
  },
  servico: {
    municipioPrestacaoIbge: '4211306',
    codigoTributacaoNacional: '110101',
    descricao: 'Armazenagem de contêiner MSCU1234567 — 5 diárias',
    valor: 1234.567,
    aliquotaIssPercent: 2,
  },
};

describe('construirDpsXml', () => {
  it('monta a DPS com Id âncora e namespace nacional', () => {
    const { xml, id } = construirDpsXml(BASE);
    expect(id).toBe('DPS4211306227692077000126' + '00001' + '000000000000015');
    expect(xml).toContain('<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">');
    expect(xml).toContain(`<infDPS Id="${id}">`);
    expect(xml).toContain('<tpAmb>2</tpAmb>');
    expect(xml).toContain('<cLocEmi>4211306</cLocEmi>');
  });

  it('arredonda valores para 2 casas e mantém a alíquota', () => {
    const { xml } = construirDpsXml(BASE);
    expect(xml).toContain('<vServ>1234.57</vServ>');
    expect(xml).toContain('<pAliq>2.00</pAliq>');
  });

  it('usa CNPJ ou CPF conforme o tomador', () => {
    expect(construirDpsXml(BASE).xml).toContain('<CNPJ>19131243000197</CNPJ>');
    const pf = construirDpsXml({
      ...BASE,
      tomador: { ...BASE.tomador, documento: '123.456.789-09' },
    });
    expect(pf.xml).toContain('<CPF>12345678909</CPF>');
    const semDoc = construirDpsXml({ ...BASE, tomador: { nome: 'Consumidor' } });
    expect(semDoc.xml).not.toContain('<CPF>');
    expect(semDoc.xml).toContain('<xNome>Consumidor</xNome>');
  });

  it('escapa caracteres especiais da descrição', () => {
    const { xml } = construirDpsXml({
      ...BASE,
      servico: { ...BASE.servico, descricao: 'Armazenagem <A & B> "extra"' },
    });
    expect(xml).toContain('Armazenagem &lt;A &amp; B&gt; &quot;extra&quot;');
    expect(xml).not.toContain('<A &');
  });

  it('emite data/hora em horário de Brasília', () => {
    expect(dataHoraBrasilia(new Date('2026-09-21T15:30:00.000Z'))).toBe('2026-09-21T12:30:00-03:00');
    expect(construirDpsXml(BASE).xml).toContain('<dCompet>2026-09-21</dCompet>');
  });

  it('sai em uma linha só, para a assinatura bater', () => {
    expect(construirDpsXml(BASE).xml).not.toMatch(/\n/);
  });
});

describe('construirEventoCancelamentoXml', () => {
  it('monta o evento e101101 com chave e motivo', () => {
    const { xml, id } = construirEventoCancelamentoXml({
      tpAmb: 2,
      chaveAcesso: '1'.repeat(50),
      cnpjAutor: '27692077000126',
      codigoMotivo: 2,
      motivo: 'Serviço não prestado',
      ocorridoEm: new Date('2026-09-21T15:30:00.000Z'),
      versaoAplicativo: 'RLTerminal-2.0',
    });
    expect(id).toBe(`EVT${'1'.repeat(50)}101101001`);
    expect(xml).toContain('<cMotivo>2</cMotivo>');
    expect(xml).toContain('<chNFSe>' + '1'.repeat(50) + '</chNFSe>');
  });
});
