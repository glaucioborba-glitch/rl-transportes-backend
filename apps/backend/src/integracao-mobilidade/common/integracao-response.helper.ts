import { ApiEnvelopeDto } from '../dto/integracao-envelope.dto';

export function envelopeV1<T>(data: T, requestId?: string): ApiEnvelopeDto<T> {
  return {
    success: true,
    data,
    meta: {
      apiVersion: 'v1',
      timestamp: new Date().toISOString(),
      requestId,
    },
  };
}
