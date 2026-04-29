import { SetMetadata } from '@nestjs/common';
import type { PlataformaServicoId } from '../plataforma.types';

export const PLATAFORMA_SERVICO_KEY = 'plataforma_servico_marketplace';

export const PlataformaServico = (id: PlataformaServicoId) =>
  SetMetadata(PLATAFORMA_SERVICO_KEY, id);
