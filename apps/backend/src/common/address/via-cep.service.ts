import { Injectable, Logger } from '@nestjs/common';
import type { ViaCepResponse } from './types/via-cep.types';

const VIACEP_TIMEOUT_MS = 12_000;

@Injectable()
export class ViaCepService {
  private readonly logger = new Logger(ViaCepService.name);

  async consultarCep(cep8: string): Promise<ViaCepResponse> {
    const url = `https://viacep.com.br/ws/${cep8}/json/`;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), VIACEP_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        this.logger.warn(`ViaCEP HTTP ${res.status} para ${cep8}`);
        return { erro: true };
      }
      const data = (await res.json()) as ViaCepResponse;
      return data;
    } catch (e) {
      this.logger.warn(`ViaCEP falhou (${cep8}): ${(e as Error).message}`);
      return { erro: true };
    } finally {
      clearTimeout(t);
    }
  }
}
