import { IaOperacionalService } from './ia-operacional.service';

describe('IaOperacionalService', () => {
  it('processarImagemOcr devolve estrutura validada pelo pipeline mock', () => {
    const prisma = {} as never;
    const svc = new IaOperacionalService(prisma);
    const r = svc.processarImagemOcr(Buffer.from('gate-imagem-test'));
    expect(r).toHaveProperty('confiancaLeitura');
    expect(r).toHaveProperty('providerUsado');
    expect(typeof r.numeroIsoValido6346).toBe('boolean');
  });
});
