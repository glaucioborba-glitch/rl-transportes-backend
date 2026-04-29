import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { buildCancelamentoNfseIpmXml, buildEmissaoNfseIpmXml, buildConsultaNfseIpmPorAutenticidade, type EmissaoNfseIpmPayload } from './xml/ipm-nfse-xml.builder';
import { parseIpmNfseXmlRetorno } from './xml/ipm-nfse-xml.parser';

/** Nome do campo multipart exigido pelo NTE-35/2021 (Postman: form-data, tipo File). */
const MULTIPART_FIELD = 'File';

@Injectable()
export class IpmNfseAdapter {
  private readonly logger = new Logger(IpmNfseAdapter.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    const s = this.config.get<string>('nfse.ipm.senha', { infer: true });
    return typeof s === 'string' && s.length > 0;
  }

  getPrestadorCnpj(): string {
    return this.config.get<string>('nfse.ipm.prestadorCnpj', { infer: true }) ?? '27692077000126';
  }

  getPrestadorTom(): string {
    return this.config.get<string>('nfse.ipm.prestadorTom', { infer: true }) ?? '8221';
  }

  getMunicipioIbge(): string {
    return this.config.get<string>('nfse.ipm.municipioIbge', { infer: true }) ?? '4211306';
  }

  getTagIndicadorCancelamento(): string {
    return this.config.get<string>('nfse.ipm.tagIndicadorCancelamento', { infer: true }) ?? 'tipo';
  }

  private getAuthHeader(): string {
    const cnpj = (this.getPrestadorCnpj() ?? '').replace(/\D/g, '');
    const senha = this.config.get<string>('nfse.ipm.senha', { infer: true }) ?? '';
    return `Basic ${Buffer.from(`${cnpj}:${senha}`, 'utf8').toString('base64')}`;
  }

  private getBaseUrl(): string {
    return this.config.get<string>('nfse.ipm.baseUrl', { infer: true }) ?? '';
  }

  /**
   * Transmite XML (emissão, cancelamento ou consulta) via POST multipart, conforme NTE-35.
   * Não loga corpo, headers sensíveis nem resposta bruta com dados fiscais completos.
   */
  async transmitirXml(xml: string, operacao: 'emissao' | 'cancelamento' | 'consulta' = 'emissao'): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('NFSE_IPM_SENHA não configurada');
    }
    const url = this.getBaseUrl();
    const form = new FormData();
    const bodyBuf = Buffer.from(xml, 'latin1');
    const blob = new Blob([bodyBuf], { type: 'text/xml; charset=ISO-8859-1' });
    form.append(MULTIPART_FIELD, blob, 'nfse.xml');

    const t0 = Date.now();
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: this.getAuthHeader(),
        },
        body: form,
      });
    } catch (e) {
      this.logger.warn(`Falha de rede IPM após ${Date.now() - t0}ms (sem detalhe sensível)`);
      throw e;
    }

    if (!res.ok) {
      this.logger.warn(`HTTP ${res.status} IPM após ${Date.now() - t0}ms`);
    }

    const text = await res.text();
    this.logger.log(`NFS-e IPM: resposta recebida (${operacao}, ${text.length} bytes, ${Date.now() - t0}ms)`);
    return text;
  }

  async emitir(payload: EmissaoNfseIpmPayload): Promise<{
    retorno: ReturnType<typeof parseIpmNfseXmlRetorno>;
    xmlEnviado: string;
    xmlResposta: string;
  }> {
    const xml = buildEmissaoNfseIpmXml({
      ...payload,
      identificadorArquivo: payload.identificadorArquivo ?? randomUUID(),
    });
    const raw = await this.transmitirXml(xml, 'emissao');
    return {
      retorno: parseIpmNfseXmlRetorno(raw, 'emissao'),
      xmlEnviado: xml,
      xmlResposta: raw,
    };
  }

  async cancelar(input: {
    numeroNfse: string;
    serieNfse: string;
    motivo: string;
  }): Promise<{
    retorno: ReturnType<typeof parseIpmNfseXmlRetorno>;
    xmlResposta: string;
  }> {
    const xml = buildCancelamentoNfseIpmXml({
      ...input,
      tagIndicadorCancelamento: this.getTagIndicadorCancelamento(),
      prestador: { cnpj: this.getPrestadorCnpj(), cidadeTom: this.getPrestadorTom() },
    });
    const raw = await this.transmitirXml(xml, 'cancelamento');
    return { retorno: parseIpmNfseXmlRetorno(raw, 'cancelamento'), xmlResposta: raw };
  }

  async consultarPorCodigoAutenticidade(codigo: string): Promise<{
    retorno: ReturnType<typeof parseIpmNfseXmlRetorno>;
    xmlResposta: string;
  }> {
    const xml = buildConsultaNfseIpmPorAutenticidade(codigo);
    const raw = await this.transmitirXml(xml, 'consulta');
    return { retorno: parseIpmNfseXmlRetorno(raw, 'consulta'), xmlResposta: raw };
  }
}
