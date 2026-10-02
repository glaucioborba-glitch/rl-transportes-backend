import { Injectable, Logger } from '@nestjs/common';
import type { Cliente, Fatura } from '@prisma/client';
import { RetriableOutboxError } from '../outbox/outbox.errors';
import { IntegrationCredentialsService } from '../tenant/integration-credentials.service';
import type { ResolvedNfseNacional } from '../tenant/integration-credentials.util';
import type { FiscalEmissaoResult } from '../fiscal-integracao/fiscal-integracao.types';
import { diasParaVencer, lerCertificadoA1, type CertificadoA1 } from './certificado-a1.util';
import { construirDpsXml, construirEventoCancelamentoXml } from './dps-xml.builder';
import { assinarXmlNacional, comprimirParaEnvio } from './dps-signer.util';
import { NfseNacionalAdapter, SefinIndisponivelError, type ContextoEnvio } from './nfse-nacional.adapter';
import { resolverEndpoints } from './nfse-nacional-endpoints.util';

export const VERSAO_APLICATIVO = 'RLTerminal-2.0';

/** Armazenagem de bens (item 11.04 da lista de serviços). */
const CTRIB_NAC_PADRAO = '110401';

export type ContextoEmissaoNacional = {
  containerIso: string;
  diasCobrados: number;
  gateOutAt: Date;
  outboxId: string;
};

export type StatusCertificadoNacional = {
  presente: boolean;
  titular?: string;
  validoAte?: Date;
  diasParaVencer?: number;
  documentoTitular?: string;
  erro?: string;
};

@Injectable()
export class NfseNacionalService {
  private readonly logger = new Logger(NfseNacionalService.name);

  constructor(
    private readonly adapter: NfseNacionalAdapter,
    private readonly credenciais: IntegrationCredentialsService,
  ) {}

  async config(tenantId?: string): Promise<ResolvedNfseNacional> {
    return this.credenciais.resolveNfseNacional(tenantId);
  }

  /** Pronta para emitir: certificado válido + dados fiscais do terminal. */
  async estaPronta(tenantId?: string): Promise<boolean> {
    const cfg = await this.config(tenantId);
    return cfg.configured && cfg.ativacao !== 'DESLIGADO';
  }

  private abrirCertificado(cfg: ResolvedNfseNacional): CertificadoA1 {
    if (!cfg.certificadoPfxBase64) {
      throw new Error('Certificado A1 do Emissor Nacional não configurado.');
    }
    return lerCertificadoA1(cfg.certificadoPfxBase64, cfg.certificadoSenha ?? '');
  }

  inspecionarCertificado(cfg: ResolvedNfseNacional): StatusCertificadoNacional {
    if (!cfg.certificadoPresente) return { presente: false };
    try {
      const cert = this.abrirCertificado(cfg);
      return {
        presente: true,
        titular: cert.titular,
        validoAte: cert.validoAte,
        diasParaVencer: diasParaVencer(cert),
        documentoTitular: cert.documentoTitular,
      };
    } catch (e) {
      return { presente: true, erro: e instanceof Error ? e.message : String(e) };
    }
  }

  private contexto(cfg: ResolvedNfseNacional): ContextoEnvio {
    return { ambiente: cfg.ambiente, certificado: this.abrirCertificado(cfg) };
  }

  /**
   * Número da DPS dentro da série. Usa o relógio para não repetir entre
   * processos; o Sefin recusa número já usado na mesma série (duplicidade).
   */
  private proximoNumeroDps(): number {
    return Number(String(Date.now()).slice(-12));
  }

  /** Emite a NFS-e no padrão nacional a partir da fatura do gate-out. */
  async emitirParaFatura(
    fatura: Fatura,
    cliente: Cliente,
    ctx: ContextoEmissaoNacional,
    tenantId?: string,
  ): Promise<FiscalEmissaoResult> {
    const cfg = await this.config(tenantId ?? fatura.tenantId);
    if (!cfg.configured) {
      throw new Error('Emissor Nacional não configurado para este terminal.');
    }

    const numero = this.proximoNumeroDps();
    const valor = Number(fatura.valorTotal);
    const descricao =
      `Armazenagem de contêiner ${ctx.containerIso} — ${ctx.diasCobrados} diária(s) após free time. ` +
      `Ref. ${fatura.id.slice(0, 8)}.`;

    const { xml, id } = construirDpsXml({
      tpAmb: resolverEndpoints(cfg.ambiente).tpAmb,
      serie: cfg.serieDps,
      numero,
      emitidaEm: ctx.gateOutAt,
      versaoAplicativo: VERSAO_APLICATIVO,
      prestador: {
        cnpj: cfg.cnpjPrestador!,
        inscricaoMunicipal: cfg.inscricaoMunicipal,
        municipioIbge: cfg.municipioIbge!,
        optanteSimplesNacional: (cfg.optanteSimplesNacional as 1 | 2 | 3) ?? 3,
        regimeEspecialTributacao: cfg.regimeEspecialTributacao,
      },
      tomador: {
        documento: cliente.cpfCnpj,
        nome: cliente.razaoSocial,
        email: (cliente.emailNfse ?? cliente.email ?? '').trim().toLowerCase() || undefined,
        telefone: cliente.telefone ?? undefined,
        municipioIbge: cliente.codigoMunicipioIbge ?? undefined,
        cep: cliente.enderecoCep ?? undefined,
        logradouro: cliente.enderecoLogradouro ?? undefined,
        numero: cliente.enderecoNumero ?? undefined,
        complemento: cliente.enderecoComplemento ?? undefined,
        bairro: cliente.enderecoBairro ?? undefined,
        uf: cliente.enderecoUf ?? undefined,
      },
      servico: {
        municipioPrestacaoIbge: cfg.municipioIbge!,
        codigoTributacaoNacional: cfg.codigoTributacaoNacional ?? CTRIB_NAC_PADRAO,
        descricao,
        valor,
        aliquotaIssPercent: cfg.aliquotaIssPercent,
      },
      informacoesComplementares: `Emissão pelo Sistema Nacional NFS-e. Outbox ${ctx.outboxId}.`,
    });

    const assinado = assinarXmlNacional(xml, id, this.abrirCertificado(cfg));

    let resposta;
    try {
      resposta = await this.adapter.emitir(comprimirParaEnvio(assinado), this.contexto(cfg));
    } catch (e) {
      if (e instanceof SefinIndisponivelError) {
        throw new RetriableOutboxError(`Sefin Nacional indisponível: ${e.message}`);
      }
      throw e;
    }

    if (!resposta.sucesso) {
      throw new Error(
        `NFS-e Nacional rejeitada: ${resposta.erros.join(' | ') || 'motivo não informado'}`,
      );
    }

    const chave = resposta.chaveAcesso ?? '';
    this.logger.log(
      `NFS-e Nacional emitida (${cfg.ambiente}) para fatura ${fatura.id} — chave ${chave.slice(-8)}`,
    );

    return {
      mode: 'emitida',
      numeroNfse: resposta.numeroNfse ?? chave,
      linkNfse: chave ? `${resolverEndpoints(cfg.ambiente).danfse}/${chave}` : '',
      codVerificador: chave,
      xmlResposta: resposta.xmlNfse ?? '',
      rpsNumero: String(numero),
      rpsSerie: cfg.serieDps,
    };
  }

  async consultarPorChave(chaveAcesso: string, tenantId?: string) {
    const cfg = await this.config(tenantId);
    if (!cfg.configured) return null;
    return this.adapter.consultarPorChave(chaveAcesso, this.contexto(cfg));
  }

  /** Cancela a NFS-e pelo evento e101101 assinado. */
  async cancelar(
    chaveAcesso: string,
    motivo: string,
    opcoes?: { codigoMotivo?: 1 | 2 | 3 | 4; tenantId?: string },
  ) {
    const cfg = await this.config(opcoes?.tenantId);
    if (!cfg.configured) {
      throw new Error('Emissor Nacional não configurado para este terminal.');
    }
    const { xml, id } = construirEventoCancelamentoXml({
      tpAmb: resolverEndpoints(cfg.ambiente).tpAmb,
      chaveAcesso,
      cnpjAutor: cfg.cnpjPrestador!,
      codigoMotivo: opcoes?.codigoMotivo ?? 4,
      motivo,
      ocorridoEm: new Date(),
      versaoAplicativo: VERSAO_APLICATIVO,
    });
    const assinado = assinarXmlNacional(xml, id, this.abrirCertificado(cfg), 'infEvento');
    return this.adapter.registrarEvento(chaveAcesso, comprimirParaEnvio(assinado), this.contexto(cfg));
  }

  async baixarDanfse(chaveAcesso: string, tenantId?: string): Promise<Buffer> {
    const cfg = await this.config(tenantId);
    if (!cfg.configured) throw new Error('Emissor Nacional não configurado para este terminal.');
    return this.adapter.baixarDanfse(chaveAcesso, this.contexto(cfg));
  }

  /** Teste da tela do Super Admin: valida certificado e handshake com o Sefin. */
  async testarConexao(tenantId?: string): Promise<{
    connected: boolean;
    message: string;
    latencyMs?: number;
  }> {
    const cfg = await this.config(tenantId);
    if (!cfg.certificadoPresente) {
      return { connected: false, message: 'Certificado A1 não enviado.' };
    }

    const cert = this.inspecionarCertificado(cfg);
    if (cert.erro) return { connected: false, message: cert.erro };
    if ((cert.diasParaVencer ?? 0) < 0) {
      return { connected: false, message: `Certificado vencido em ${cert.validoAte?.toLocaleDateString('pt-BR')}.` };
    }
    if (!cfg.cnpjPrestador || !cfg.municipioIbge) {
      return { connected: false, message: 'Informe o CNPJ do prestador e o município (IBGE).' };
    }
    if (cert.documentoTitular && cfg.cnpjPrestador && cert.documentoTitular !== cfg.cnpjPrestador) {
      return {
        connected: false,
        message: `Certificado é de ${cert.documentoTitular} e o prestador informado é ${cfg.cnpjPrestador}.`,
      };
    }

    const probe = await this.adapter.probe(this.contexto(cfg));
    const ambiente = cfg.ambiente === 'producao' ? 'produção' : 'produção restrita';
    return {
      connected: probe.ok,
      latencyMs: probe.latencyMs,
      message: probe.ok
        ? `Sefin Nacional (${ambiente}) respondeu. Certificado de ${cert.titular} válido por ${cert.diasParaVencer} dia(s).`
        : probe.motivo ?? `Sefin Nacional não respondeu (HTTP ${probe.status ?? '—'}).`,
    };
  }
}
