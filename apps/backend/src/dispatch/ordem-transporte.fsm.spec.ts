import { BadRequestException } from '@nestjs/common';
import { StatusOrdemTransporte } from '@prisma/client';
import { assertOrdemStatusTransition } from './ordem-transporte.fsm';

describe('ordem-transporte.fsm', () => {
  it('permite sequência operacional', () => {
    expect(() =>
      assertOrdemStatusTransition(
        StatusOrdemTransporte.DESPACHADA,
        StatusOrdemTransporte.EM_TRANSITO,
      ),
    ).not.toThrow();
  });

  it('bloqueia salto inválido', () => {
    expect(() =>
      assertOrdemStatusTransition(
        StatusOrdemTransporte.DESPACHADA,
        StatusOrdemTransporte.CONCLUIDA,
      ),
    ).toThrow(BadRequestException);
  });
});
