import { Injectable, Logger } from '@nestjs/common';
import { request as httpsRequest, type RequestOptions } from 'node:https';
import { URL } from 'node:url';
import type { CertificadoA1 } from './certificado-a1.util';
import { resolverEndpoints, type AmbienteNfseNacional } from './nfse-nacional-endpoints.util';
import { interpretarRespostaNfse, type RespostaNfseNacional } from './nfse-nacional-resposta.util';

export type ContextoEnvio = {
  ambiente: AmbienteNfseNacional;
  certificado: CertificadoA1;
  timeoutMs?: number;
};

type RespostaHttp = { status: number; corpo: Buffer };

const TIMEOUT_PADRAO_MS = 20_000;

/** Erros de rede/indisponibilidade do Sefin (não são rejeição de nota). */
export class SefinIndisponivelError extends Error {}

@Injectable()
export class NfseNacionalAdapter {
  private readonly logger = new Logger(NfseNacionalAdapter.name);

  /** Toda chamada ao Sefin é autenticada por mTLS com o certificado do titular. */
  private enviar(
    url: string,
    metodo: 'GET' | 'POST' | 'HEAD',
    ctx: ContextoEnvio,
    corpo?: string,
  ): Promise<RespostaHttp> {
    const alvo = new URL(url);
    const opcoes: RequestOptions = {
      method: metodo,
      hostname: alvo.hostname,
      port: alvo.port || 443,
      path: `${alvo.pathname}${alvo.search}`,
      cert: ctx.certificado.certificadoPem,
      key: ctx.certificado.chavePrivadaPem,
      ca: ctx.certificado.cadeiaPem.length ? ctx.certificado.cadeiaPem : undefined,
      timeout: ctx.timeoutMs ?? TIMEOUT_PADRAO_MS,
      headers: {
        Accept: 'application/json',
        ...(corpo
          ? {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(corpo).toString(),
            }
          : {}),
      },
    };

    return new Promise<RespostaHttp>((resolve, reject) => {
      const req = httpsRequest(opcoes, (res) => {
        const partes: Buffer[] = [];
        res.on('data', (c: Buffer) => partes.push(c));
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, corpo: Buffer.concat(partes) }),
        );
      });
      req.on('timeout', () => {
        req.destroy(new SefinIndisponivelError('Tempo esgotado na conexão com o Sefin Nacional.'));
      });
      req.on('error', (e) =>
        reject(
          e instanceof SefinIndisponivelError
            ? e
            : new SefinIndisponivelError(`Falha de rede com o Sefin Nacional: ${e.message}`),
        ),
      );
      if (corpo) req.write(corpo);
      req.end();
    });
  }

  /** POST /nfse — emissão síncrona da DPS assinada (GZip + Base64). */
  async emitir(dpsXmlGZipB64: string, ctx: ContextoEnvio): Promise<RespostaNfseNacional> {
    const { sefin } = resolverEndpoints(ctx.ambiente);
    const t0 = Date.now();
    const r = await this.enviar(`${sefin}/nfse`, 'POST', ctx, JSON.stringify({ dpsXmlGZipB64 }));
    this.logger.log(`NFS-e Nacional: emissão HTTP ${r.status} em ${Date.now() - t0}ms`);
    return interpretarRespostaNfse(r.status, r.corpo.toString('utf8'));
  }

  /** GET /nfse/{chaveAcesso} — consulta da nota já gerada. */
  async consultarPorChave(chaveAcesso: string, ctx: ContextoEnvio): Promise<RespostaNfseNacional> {
    const { sefin } = resolverEndpoints(ctx.ambiente);
    const r = await this.enviar(`${sefin}/nfse/${encodeURIComponent(chaveAcesso)}`, 'GET', ctx);
    return interpretarRespostaNfse(r.status, r.corpo.toString('utf8'));
  }

  /** GET /dps/{id} — descobre a chave a partir do identificador da DPS. */
  async consultarPorDpsId(dpsId: string, ctx: ContextoEnvio): Promise<RespostaNfseNacional> {
    const { sefin } = resolverEndpoints(ctx.ambiente);
    const r = await this.enviar(`${sefin}/dps/${encodeURIComponent(dpsId)}`, 'GET', ctx);
    return interpretarRespostaNfse(r.status, r.corpo.toString('utf8'));
  }

  /** POST /nfse/{chave}/eventos — cancelamento e demais eventos assinados. */
  async registrarEvento(
    chaveAcesso: string,
    eventoXmlGZipB64: string,
    ctx: ContextoEnvio,
  ): Promise<RespostaNfseNacional> {
    const { sefin } = resolverEndpoints(ctx.ambiente);
    const r = await this.enviar(
      `${sefin}/nfse/${encodeURIComponent(chaveAcesso)}/eventos`,
      'POST',
      ctx,
      JSON.stringify({ pedidoRegistroEventoXmlGZipB64: eventoXmlGZipB64 }),
    );
    return interpretarRespostaNfse(r.status, r.corpo.toString('utf8'));
  }

  /** GET /danfse/{chave} no ADN — PDF oficial da nota. */
  async baixarDanfse(chaveAcesso: string, ctx: ContextoEnvio): Promise<Buffer> {
    const { danfse } = resolverEndpoints(ctx.ambiente);
    const r = await this.enviar(`${danfse}/${encodeURIComponent(chaveAcesso)}`, 'GET', ctx);
    if (r.status < 200 || r.status >= 300) {
      throw new Error(`DANFSe indisponível (HTTP ${r.status}).`);
    }
    return r.corpo;
  }

  /**
   * Handshake mTLS contra o Sefin. Qualquer resposta HTTP significa que o
   * certificado foi aceito e o serviço está no ar; 401/403 indica certificado recusado.
   */
  async probe(ctx: ContextoEnvio): Promise<{
    ok: boolean;
    status?: number;
    latencyMs: number;
    motivo?: string;
  }> {
    const { sefin } = resolverEndpoints(ctx.ambiente);
    const inicio = Date.now();
    try {
      const r = await this.enviar(`${sefin}/dps/0`, 'HEAD', { ...ctx, timeoutMs: 8_000 });
      const latencyMs = Date.now() - inicio;
      if (r.status === 401 || r.status === 403) {
        return { ok: false, status: r.status, latencyMs, motivo: 'Certificado recusado pelo Sefin.' };
      }
      return { ok: r.status > 0 && r.status < 500, status: r.status, latencyMs };
    } catch (e) {
      return {
        ok: false,
        latencyMs: Date.now() - inicio,
        motivo: e instanceof Error ? e.message : String(e),
      };
    }
  }
}
