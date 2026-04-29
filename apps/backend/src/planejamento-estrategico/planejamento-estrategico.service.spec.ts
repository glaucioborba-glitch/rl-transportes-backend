import { ConfigService } from '@nestjs/config';
import { PlanejamentoEstrategicoService } from './planejamento-estrategico.service';

describe('PlanejamentoEstrategicoService', () => {
  it('instanciável com dependências mínimas', () => {
    const prisma = {} as never;
    const config = { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService;
    const svc = new PlanejamentoEstrategicoService(prisma, config);
    expect(svc).toBeTruthy();
  });
});
