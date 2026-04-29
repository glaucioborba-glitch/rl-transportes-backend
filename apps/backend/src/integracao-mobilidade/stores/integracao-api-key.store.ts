import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Mapeamento API Key → clienteId (env INTEGRACAO_API_KEYS). Sem migração — configuração por ambiente. */
@Injectable()
export class IntegracaoApiKeyStore {
  constructor(private readonly config: ConfigService) {}

  private parse(): Map<string, string> {
    const map = new Map<string, string>();
    const raw =
      process.env.INTEGRACAO_API_KEYS ??
      this.config.get<string>('INTEGRACAO_API_KEYS') ??
      '';
    for (const part of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
      const [key, clienteId] = part.split('|').map((s) => s.trim());
      if (key && clienteId) map.set(key, clienteId);
    }
    return map;
  }

  resolveClienteId(apiKey: string): string | undefined {
    return this.parse().get(apiKey.trim());
  }

  has(key: string): boolean {
    return this.parse().has(key.trim());
  }
}
