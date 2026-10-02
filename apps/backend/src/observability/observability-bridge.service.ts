import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

export type ObservabilityWsEvent =
  | {
      type: 'LOG_EVENT';
      payload: {
        route: string;
        method: string;
        ms: number;
        status: number;
        at: string;
        service: string;
      };
    }
  | {
      type: 'ERROR_EVENT';
      payload: {
        route: string;
        message: string;
        service: string;
        timestamp: string;
        level: string;
      };
    }
  | {
      type: 'HEALTH_UPDATE';
      payload: Record<string, unknown>;
    }
  | {
      type: 'CIRCUIT_EVENT';
      payload: Record<string, unknown>;
    }
  | {
      type: 'RECOVERY_EVENT';
      payload: Record<string, unknown>;
    }
  | {
      type: 'FALLBACK_EVENT';
      payload: Record<string, unknown>;
    }
  | {
      type: 'CHAOS_TRIGGERED';
      payload: Record<string, unknown>;
    }
  | {
      type: 'CHAOS_RECOVERY';
      payload: Record<string, unknown>;
    }
  | {
      type: 'CHAOS_ERROR';
      payload: Record<string, unknown>;
    }
  | {
      type: 'CHAOS_FINISHED';
      payload: Record<string, unknown>;
    };

/**
 * Ponte síncrona para o gateway WebSocket (sem Redis pub/sub nesta fase).
 */
@Injectable()
export class ObservabilityBridgeService {
  private readonly subject = new Subject<ObservabilityWsEvent>();

  events$() {
    return this.subject.asObservable();
  }

  emit(evt: ObservabilityWsEvent): void {
    try {
      this.subject.next(evt);
    } catch {
      /* */
    }
  }
}
