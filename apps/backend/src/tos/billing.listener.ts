import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { TosEventEmitter } from './tos-event-emitter';
import { TRANSPORTE_SOLICITADO_EVENT, type TransporteSolicitadoPayload } from '../agendamentos/agendamento-transporte.util';

@Injectable()
export class BillingListener implements OnModuleInit {
  private readonly logger = new Logger(BillingListener.name);

  constructor(private readonly eventEmitter: TosEventEmitter) {}

  onModuleInit(): void {
    this.eventEmitter.on(TRANSPORTE_SOLICITADO_EVENT, (payload: TransporteSolicitadoPayload) => {
      this.logger.log(
        `[DESPACHO FL] Transporte solicitado — ${payload.numeroIso} ${payload.tipoOperacao} (${payload.localOrigem ?? payload.localDestino ?? 'N/A'})`,
      );
    });
  }
}
