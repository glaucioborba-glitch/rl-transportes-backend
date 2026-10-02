export { PatioMovimentarDto } from './movimentar.dto';
export { PatioPosicionarDto, PatioPrepararGateOutDto } from './posicionar.dto';

export class PatioInventarioQueryDto {
  /** Reservado para filtros futuros (cliente, baia). */
  clienteId?: string;
}
