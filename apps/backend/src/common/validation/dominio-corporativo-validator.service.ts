import { Injectable, Logger } from '@nestjs/common';
import { ValidacaoDominio } from '@prisma/client';
import { compareDominioCorporativo } from './dominio-corporativo.util';

const BRASILAPI_CNPJ_URL = 'https://brasilapi.com.br/api/cnpj/v1';
const UPSTREAM_TIMEOUT_MS = 8000;

type BrasilApiCnpjPayload = {
  email?: unknown;
};

@Injectable()
export class DominioCorporativoValidatorService {
  private readonly logger = new Logger(DominioCorporativoValidatorService.name);

  /** Consulta BrasilAPI e compara domínio do e-mail informado com o da Receita. Nunca bloqueia cadastro. */
  async validar(cnpj: string, emailInformado: string): Promise<ValidacaoDominio> {
    const digits = cnpj.replace(/\D/g, '');
    if (digits.length !== 14) return ValidacaoDominio.INDISPONIVEL;

    try {
      const res = await fetch(`${BRASILAPI_CNPJ_URL}/${digits}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'RL-Transportes-Backend/1.0',
        },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      if (!res.ok) {
        this.logger.warn(`BrasilAPI CNPJ HTTP ${res.status} para validação de domínio`);
        return ValidacaoDominio.INDISPONIVEL;
      }
      const body = (await res.json()) as BrasilApiCnpjPayload;
      const receitaEmail = typeof body.email === 'string' ? body.email : '';
      return compareDominioCorporativo(emailInformado, receitaEmail);
    } catch (e) {
      this.logger.warn(
        `BrasilAPI indisponível para validação de domínio: ${e instanceof Error ? e.message : e}`,
      );
      return ValidacaoDominio.INDISPONIVEL;
    }
  }
}
