/** Erro retriável — outbox reenfileira com backoff exponencial. */
export class RetriableOutboxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetriableOutboxError';
  }
}
