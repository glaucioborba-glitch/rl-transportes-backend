import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { readFileSync } from 'node:fs';
import { request as httpsRequest, type RequestOptions } from 'node:https';
import { URL } from 'node:url';
import { IntegrationCredentialsService } from '../tenant/integration-credentials.service';
import type { ResolvedIpm } from '../tenant/integration-credentials.util';
import {
  buildCancelamentoNfseIpmXml,
  buildEmissaoNfseIpmXml,
  buildConsultaNfseIpmPorAutenticidade,
  type EmissaoNfseIpmPayload,
} from './xml/ipm-nfse-xml.builder';
import { parseIpmNfseXmlRetorno } from './xml/ipm-nfse-xml.parser';
import { montarBasicAuthIpm, montarMultipartIpm } from './ipm-multipart.util';

const TIMEOUT_MS = 30_000;

@Injectable()
export class IpmNfseAdapter {
  private readonly logger = new Logger(IpmNfseAdapter.name);

  constructor(private readonly credenciais: IntegrationCredentialsService) {}

  /** Configuração do terminal atual (tela do Super Admin) com o .env como reserva. */
  async config(tenantId?: string): Promise<ResolvedIpm> {
    return this.credenciais.resolveIpm(tenantId);
  }

  configSync(tenantId?: string): ResolvedIpm {
    return this.credenciais.peekIpm(tenantId);
  }

  /** Transmite de verdade só com a senha do portal; sem ela, o fiscal fica em sandbox. */
  isConfigured(tenantId?: string): boolean {
    return this.configSync(tenantId).configured;
  }

  getPrestadorCnpj(tenantId?: string): string {
    return this.configSync(tenantId).prestadorCnpj;
  }

  getPrestadorTom(tenantId?: string): string {
    return this.configSync(tenantId).prestadorTom;
  }

  getMunicipioIbge(tenantId?: string): string {
    return this.configSync(tenantId).municipioIbge;
  }

  getTagIndicadorCancelamento(tenantId?: string): string {
    return this.configSync(tenantId).tagIndicadorCancelamento;
  }

  /** Certificado A1 do terminal (PFX em base64) ou arquivo apontado no .env. */
  private carregarPfx(cfg: ResolvedIpm): Buffer | undefined {
    if (cfg.certificadoPfxBase64) {
      try {
        return Buffer.from(cfg.certificadoPfxBase64.replace(/\s+/g, ''), 'base64');
      } catch {
        this.logger.warn('Certificado IPM do terminal não pôde ser decodificado');
        return undefined;
      }
    }
    if (cfg.certificadoCaminho) {
      try {
        return readFileSync(cfg.certificadoCaminho);
      } catch {
        this.logger.warn(`Certificado IPM não carregado (${cfg.certificadoCaminho})`);
      }
    }
    return undefined;
  }

  private enviar(
    cfg: ResolvedIpm,
    corpo: Buffer,
    contentType: string,
    timeoutMs = TIMEOUT_MS,
  ): Promise<{ status: number; texto: string }> {
    const alvo = new URL(cfg.baseUrl);
    const pfx = this.carregarPfx(cfg);
    const opcoes: RequestOptions = {
      method: 'POST',
      hostname: alvo.hostname,
      port: alvo.port || 443,
      path: `${alvo.pathname}${alvo.search}`,
      timeout: timeoutMs,
      headers: {
        Authorization: montarBasicAuthIpm(cfg.prestadorCnpj, cfg.senha),
        'Content-Type': contentType,
        'Content-Length': corpo.length.toString(),
      },
      ...(pfx ? { pfx, passphrase: cfg.certificadoSenha, rejectUnauthorized: true } : {}),
    };

    return new Promise((resolve, reject) => {
      const req = httpsRequest(opcoes, (res) => {
        const partes: Buffer[] = [];
        res.on('data', (c: Buffer) => partes.push(c));
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            texto: Buffer.concat(partes).toString('latin1'),
          }),
        );
      });
      req.on('timeout', () => req.destroy(new Error('timeout na conexão com a prefeitura')));
      req.on('error', reject);
      req.write(corpo);
      req.end();
    });
  }

  /**
   * Transmite XML (emissão, cancelamento ou consulta) via POST multipart, conforme NTE-35.
   * Não loga corpo, headers sensíveis nem resposta bruta com dados fiscais completos.
   */
  async transmitirXml(
    xml: string,
    operacao: 'emissao' | 'cancelamento' | 'consulta' = 'emissao',
    cfgRecebida?: ResolvedIpm,
  ): Promise<string> {
    const cfg = cfgRecebida ?? (await this.config());
    if (!cfg.configured) {
      throw new Error('Senha do portal IPM não configurada');
    }

    const { body, contentType } = montarMultipartIpm(xml);
    const t0 = Date.now();
    let resposta: { status: number; texto: string };
    try {
      resposta = await this.enviar(cfg, body, contentType);
    } catch (e) {
      this.logger.warn(`Falha de rede IPM após ${Date.now() - t0}ms (sem detalhe sensível)`);
      throw e;
    }

    if (resposta.status < 200 || resposta.status >= 300) {
      this.logger.warn(`HTTP ${resposta.status} IPM após ${Date.now() - t0}ms`);
    }
    this.logger.log(
      `NFS-e IPM: resposta recebida (${operacao}, ${resposta.texto.length} bytes, ${Date.now() - t0}ms)`,
    );
    return resposta.texto;
  }

  async emitir(
    payload: EmissaoNfseIpmPayload,
    cfgRecebida?: ResolvedIpm,
  ): Promise<{
    retorno: ReturnType<typeof parseIpmNfseXmlRetorno>;
    xmlEnviado: string;
    xmlResposta: string;
  }> {
    const xml = buildEmissaoNfseIpmXml({
      ...payload,
      identificadorArquivo: payload.identificadorArquivo ?? randomUUID(),
    });
    const raw = await this.transmitirXml(xml, 'emissao', cfgRecebida);
    return {
      retorno: parseIpmNfseXmlRetorno(raw, 'emissao'),
      xmlEnviado: xml,
      xmlResposta: raw,
    };
  }

  async cancelar(input: { numeroNfse: string; serieNfse: string; motivo: string }): Promise<{
    retorno: ReturnType<typeof parseIpmNfseXmlRetorno>;
    xmlResposta: string;
  }> {
    const cfg = await this.config();
    const xml = buildCancelamentoNfseIpmXml({
      ...input,
      tagIndicadorCancelamento: cfg.tagIndicadorCancelamento,
      prestador: { cnpj: cfg.prestadorCnpj, cidadeTom: cfg.prestadorTom },
    });
    const raw = await this.transmitirXml(xml, 'cancelamento', cfg);
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

  /**
   * Health probe — verifica conectividade com o endpoint IPM (sem expor credenciais nos logs).
   * Em sandbox (sem senha) retorna ok com mode=sandbox.
   */
  async probeHealth(tenantId?: string): Promise<{
    ok: boolean;
    latencyMs: number;
    mode: 'live' | 'sandbox' | 'offline';
    reason?: string;
  }> {
    const cfg = await this.config(tenantId);
    if (!cfg.configured) {
      return {
        ok: true,
        latencyMs: 0,
        mode: 'sandbox',
        reason: 'Senha do portal IPM não configurada',
      };
    }
    if (!cfg.baseUrl) {
      return { ok: false, latencyMs: 0, mode: 'offline', reason: 'URL do IPM ausente' };
    }

    const inicio = Date.now();
    try {
      const { body, contentType } = montarMultipartIpm('');
      const r = await this.enviar(cfg, body, contentType, 8_000);
      const latencyMs = Date.now() - inicio;
      // IPM costuma responder 400/415 sem XML válido — ainda indica serviço alcançável.
      const alcancavel = r.status > 0 && r.status < 500;
      return {
        ok: alcancavel,
        latencyMs,
        mode: 'live',
        reason: alcancavel ? undefined : `HTTP ${r.status}`,
      };
    } catch (e) {
      return {
        ok: false,
        latencyMs: Date.now() - inicio,
        mode: 'offline',
        reason: (e as Error).message,
      };
    }
  }
}
