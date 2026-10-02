import { Injectable } from '@nestjs/common';
import { IbgeService } from './ibge.service';
import { AddressInvalidException } from './exceptions/address-invalid.exception';
import { CepCacheService } from '../../cep-cache/cep-cache.service';
import { foldComparable, onlyDigits } from './address-normalizer';

export type PostalAddressInput = {
  cep: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  codigoIbge?: string;
};

export type NormalizedPostalAddress = {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  numero: string;
  complemento: string | null;
  codigoIbge: string;
};

export type CepAutofillResult = {
  cepValido: boolean;
  cep: string;
  logradouro: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  ibge: string | null;
  aviso?: string | null;
};

@Injectable()
export class AddressService {
  constructor(
    private readonly cepCache: CepCacheService,
    private readonly ibge: IbgeService,
  ) {}

  /** Consulta rápida para autocompletar — cache Redis + fallback silencioso. */
  async lookupCepAutofill(cepRaw: string): Promise<CepAutofillResult> {
    const row = await this.cepCache.getCep(cepRaw);
    return {
      cepValido: row.cepValido,
      cep: row.cep,
      logradouro: row.logradouro,
      bairro: row.bairro,
      cidade: row.cidade,
      uf: row.uf,
      ibge: row.ibge,
      aviso: row.aviso,
    };
  }

  /** Normalização fiscal completa antes de persistir cliente. CEP e IBGE são independentes. */
  async normalize(input: PostalAddressInput): Promise<NormalizedPostalAddress> {
    const cep = onlyDigits(input.cep);
    if (cep.length !== 8) {
      throw new AddressInvalidException('CEP inválido: informe 8 dígitos.');
    }

    const cached = await this.cepCache.getCep(cep);
    const viaOk = cached.cepValido && Boolean(cached.cidade?.trim()) && Boolean(cached.uf?.trim());

    let cidadeFinal = viaOk ? cached.cidade!.trim() : (input.cidade ?? '').trim();
    let ufFinal = viaOk ? cached.uf!.trim().toUpperCase() : (input.uf ?? '').trim().toUpperCase();

    if (viaOk) {
      if (input.cidade?.trim() && foldComparable(input.cidade) !== foldComparable(cidadeFinal)) {
        throw new AddressInvalidException(
          'Endereço inválido: cidade/UF não corresponde ao CEP informado.',
        );
      }
      if (input.uf?.trim() && input.uf.trim().toUpperCase() !== ufFinal) {
        throw new AddressInvalidException(
          'Endereço inválido: cidade/UF não corresponde ao CEP informado.',
        );
      }
    } else if (!cidadeFinal || !ufFinal) {
      throw new AddressInvalidException(
        'Informe cidade e UF quando o CEP não puder ser validado automaticamente.',
      );
    }

    let codigoIbge = viaOk && cached.ibge ? cached.ibge : null;
    if (!codigoIbge) {
      codigoIbge = this.normalizeIbgeDigits(input.codigoIbge);
    }
    if (!codigoIbge) {
      codigoIbge = await this.resolveIbgeFromNomeUf(cidadeFinal, ufFinal);
    }
    if (!codigoIbge) {
      throw new AddressInvalidException(
        'Informe o código IBGE do município ou confira cidade/UF.',
      );
    }

    const rowIbge = await this.ibge.assertIbgeValid(codigoIbge, ufFinal, foldComparable(cidadeFinal));
    if (!rowIbge) {
      const resolved = await this.resolveIbgeFromNomeUf(cidadeFinal, ufFinal);
      if (resolved) {
        codigoIbge = resolved;
      } else if (codigoIbge && cidadeFinal && ufFinal) {
        // IBGE indisponível offline — mantém código informado (formulário/CEP) com cidade e UF.
      } else {
        throw new AddressInvalidException(
          'Código IBGE inválido ou não encontrado na base do IBGE.',
        );
      }
    }

    if (input.codigoIbge?.trim()) {
      const sent = this.normalizeIbgeDigits(input.codigoIbge);
      if (sent && sent !== codigoIbge) {
        throw new AddressInvalidException(
          'Endereço inválido: cidade/UF não corresponde ao CEP informado.',
        );
      }
    }

    const logradouro =
      nonEmpty(input.logradouro) ||
      (viaOk ? nonEmpty(cached.logradouro ?? undefined) : undefined) ||
      '';
    const bairro =
      nonEmpty(input.bairro) ||
      (viaOk ? nonEmpty(cached.bairro ?? undefined) : undefined) ||
      '';

    if (!logradouro.trim()) {
      throw new AddressInvalidException('Logradouro é obrigatório para emissão de NFS-e.');
    }
    if (!bairro.trim()) {
      throw new AddressInvalidException('Bairro é obrigatório para emissão de NFS-e.');
    }

    const numero = (input.numero ?? '').trim();
    if (!numero) {
      throw new AddressInvalidException('Número do endereço é obrigatório.');
    }

    const complemento = nonEmpty(input.complemento) ?? null;

    return {
      cep,
      logradouro: logradouro.trim(),
      bairro: bairro.trim(),
      cidade: cidadeFinal,
      uf: ufFinal,
      numero,
      complemento,
      codigoIbge,
    };
  }

  private normalizeIbgeDigits(raw?: string): string | null {
    let ibge = onlyDigits(raw ?? '');
    if (!ibge) return null;
    if (ibge.length > 7) ibge = ibge.slice(-7);
    if (ibge.length < 7) ibge = ibge.padStart(7, '0');
    if (ibge.length !== 7 || ibge === '0000000') return null;
    return ibge;
  }

  private async resolveIbgeFromNomeUf(nomeCidade: string, uf: string): Promise<string | null> {
    const list = await this.ibge.getMunicipios();
    const want = foldComparable(nomeCidade);
    const row = list.find(
      (m) => m.uf === uf.toUpperCase() && foldComparable(m.nome) === want,
    );
    return row?.codigoIbge ?? null;
  }
}

function nonEmpty(s?: string): string | undefined {
  const t = s?.trim();
  return t ? t : undefined;
}
