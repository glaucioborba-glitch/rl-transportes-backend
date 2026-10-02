import { parseDocumentoTerceiro } from './terceiro-documento-extract.util';

describe('parseDocumentoTerceiro', () => {
  it('lê CNH digital: nome, CPF, categoria e validade', () => {
    const texto = `
      REPÚBLICA FEDERATIVA DO BRASIL
      CARTEIRA NACIONAL DE HABILITAÇÃO
      NOME: JOÃO DA SILVA SANTOS
      CPF: 390.533.447-05
      CAT: AE
      VALIDADE 12/03/2029
    `;
    const { sugestoes, campos } = parseDocumentoTerceiro('CNH', texto);
    expect(sugestoes.cpf).toBe('39053344705');
    expect(sugestoes.cnhCategoria).toBe('AE');
    expect(sugestoes.cnhValidade).toBe('2029-03-12');
    expect(sugestoes.nome).toMatch(/João|Joao/i);
    expect(campos).toBeGreaterThanOrEqual(3);
  });

  it('lê CRLV-e: placa e proprietário', () => {
    const texto = `
      CRLV-e
      PLACA ABC1D23
      RENAVAM 12345678901
      VALIDADE 10/03/2027
      PROPRIETÁRIO: MARIA OLIVEIRA LIMA
      CPF 036.501.639-00
    `;
    const { sugestoes } = parseDocumentoTerceiro('CRLV_CAVALO', texto);
    expect(sugestoes.placa).toBe('ABC1D23');
    expect(sugestoes.renavam).toBe('12345678901');
    expect(sugestoes.crlvValidade).toBe('2027-03-10');
    expect(sugestoes.donoNome).toMatch(/Maria Oliveira Lima/i);
  });
});
