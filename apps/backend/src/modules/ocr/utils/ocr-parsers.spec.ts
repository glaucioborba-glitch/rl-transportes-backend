import {
  buildOcrIndicativoTipo,
  capacidadeDcHcFromTipoIso,
  compararTipoIsoCadastro,
  parseContainerExtras,
  parseContainerNumber,
  parsePlaca,
} from './ocr-parsers';

describe('parseContainerNumber', () => {
  it('extrai número ISO válido', () => {
    const r = parseContainerNumber('MSCU1001137');
    expect(r.numero).toBe('MSCU1001137');
    expect(r.confianca).toBeGreaterThanOrEqual(0.9);
  });

  it('corrige O por 0 nos dígitos', () => {
    const r = parseContainerNumber('MSCU1OO1137');
    expect(r.numero).toBe('MSCU1001137');
    expect(r.confianca).toBeGreaterThanOrEqual(0.7);
  });

  it('aceita espaços e hífens', () => {
    const r = parseContainerNumber('MSCU 100113-7');
    expect(r.numero).toBe('MSCU1001137');
  });

  it('usa as 4 letras do prefixo e ignora a barra do fecho lida como U', () => {
    const r = parseContainerNumber('SEGUU 6254167\n45G1\nMGW 32500 KGS');
    expect(r.numero).toBe('SEGU6254167');
    expect(r.confianca).toBeGreaterThanOrEqual(0.9);
  });

  it('lê prefixo e série separados pela barra do fecho', () => {
    const r = parseContainerNumber('SEGU 6254167');
    expect(r.numero).toBe('SEGU6254167');
  });
});

describe('parseContainerExtras', () => {
  const porta = 'SEGUU 6254167\n45G1\nMGW 32500 KGS\nTARE 3880 KGS\nPAYLOAD 28620 KGS\nSEACO BRIDGETOWN';

  it('lê tipo ISO 45G1 como 40\' HC e pesos da porta', () => {
    const extras = parseContainerExtras(porta);
    expect(extras.tipoIso).toBe('45G1');
    expect(extras.tamanhoPes).toBe('40');
    expect(extras.perfil).toBe('HC');
    expect(extras.rotulo).toBe("40' HC");
    expect(extras.mgwKg).toBe('32500');
    expect(extras.taraKg).toBe('3880');
    expect(extras.payloadKg).toBe('28620');
    expect(extras.owner).toBe('SEACO');
  });

  it('lê 22G1 como 20\' DC', () => {
    const extras = parseContainerExtras('MSCU 1001137\n22G1');
    expect(extras.tipoIso).toBe('22G1');
    expect(extras.tamanhoPes).toBe('20');
    expect(extras.perfil).toBe('DC');
  });

  it('lê 45R1 como 40\' reefer', () => {
    const extras = parseContainerExtras('45R1');
    expect(extras.tipoIso).toBe('45R1');
    expect(extras.perfil).toBe('REEFER');
    expect(extras.tamanhoPes).toBe('40');
    expect(capacidadeDcHcFromTipoIso(extras.tipoIso)).toBe('HC');
  });

  it('não quebra quando o texto não tem tipo ISO', () => {
    expect(parseContainerExtras('SEGU6254167')).toEqual({});
  });

  it('acha 45G1 mesmo sem quebra de linha', () => {
    const extras = parseContainerExtras('SEGUU625416745G1MGW32500KGS');
    expect(extras.tipoIso).toBe('45G1');
    expect(extras.mgwKg).toBe('32500');
  });
});

describe('compararTipoIsoCadastro', () => {
  it('confere 45G1 com DRYHC / 40\'', () => {
    const extras = parseContainerExtras('45G1');
    expect(compararTipoIsoCadastro(extras, 'DRYHC', "40'")).toBe('CONFERE');
  });

  it('marca divergente quando o cadastro é DC e a porta é HC', () => {
    const extras = parseContainerExtras('45G1');
    expect(compararTipoIsoCadastro(extras, 'DRYDC', '40')).toBe('DIVERGENTE');
  });

  it('marca divergente quando o tamanho do cadastro não bate', () => {
    const extras = parseContainerExtras('22G1');
    expect(compararTipoIsoCadastro(extras, 'DRYHC', '40')).toBe('DIVERGENTE');
  });

  it('confere reefer 45R1 com REEFER / 40\'', () => {
    const extras = parseContainerExtras('45R1');
    expect(compararTipoIsoCadastro(extras, 'REEFER', '40')).toBe('CONFERE');
  });

  it('não entra na conferência quando não há captura', () => {
    expect(compararTipoIsoCadastro({}, 'DRYHC', '40')).toBe('SEM_CAPTURA');
  });
});

describe('buildOcrIndicativoTipo', () => {
  it('mostra que o cadastro confere sem parecer obrigatório', () => {
    const extras = parseContainerExtras('45G1\nMGW 32500 KGS');
    const ind = buildOcrIndicativoTipo(extras, 'DRYHC', '40', "DRYHC / 40'");
    expect(ind?.status).toBe('CONFERE');
    expect(ind?.mensagem).toContain('45G1');
    expect(ind?.mensagem).toContain('confere com o cadastro');
    expect(ind?.mensagem).not.toContain('trava');
    expect(ind?.mgwKg).toBe('32500');
  });

  it('devolve null se a leitura não trouxe extras', () => {
    expect(buildOcrIndicativoTipo({}, 'DRYHC', '40')).toBeNull();
  });
});

describe('parsePlaca', () => {
  it('reconhece Mercosul ABC1D23', () => {
    const r = parsePlaca('ABC1D23');
    expect(r.placa).toBe('ABC1D23');
    expect(r.confianca).toBeGreaterThanOrEqual(0.85);
  });

  it('reconhece formato antigo ABC1234', () => {
    const r = parsePlaca('ABC-1234');
    expect(r.placa).toBe('ABC1234');
    expect(r.confianca).toBeGreaterThanOrEqual(0.85);
  });
});
