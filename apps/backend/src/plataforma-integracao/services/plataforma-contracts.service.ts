import { Injectable } from '@nestjs/common';

@Injectable()
export class PlataformaContractsService {
  obterSchema(nome: string): Record<string, unknown> {
    const baseEnvelope = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      title: 'EnvelopesPublicosV1',
      type: 'object',
      required: ['success', 'meta'],
      properties: {
        success: { type: 'boolean' },
        data: {},
        error: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            message: { type: 'string' },
          },
        },
        meta: {
          type: 'object',
          properties: {
            apiVersion: { const: 'v1' },
            timestamp: { type: 'string', format: 'date-time' },
            tenantId: { type: 'string' },
            requestId: { type: 'string' },
          },
        },
      },
    };

    const map: Record<string, Record<string, unknown>> = {
      envelope: baseEnvelope,
      solicitacoes: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        description: 'GET /public/v1/solicitacoes',
        properties: {
          total: { type: 'integer' },
          page: { type: 'integer' },
          limit: { type: 'integer' },
          itens: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                protocolo: { type: 'string' },
                clienteId: { type: 'string' },
                status: { type: 'string' },
              },
            },
          },
        },
      },
      webhook_gate_registrado: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        required: ['evento', 'occurredAt', 'payload'],
        properties: {
          evento: { const: 'gate.registrado' },
          occurredAt: { type: 'string', format: 'date-time' },
          payload: {
            type: 'object',
            properties: {
              solicitacaoId: { type: 'string' },
              ricAssinado: { type: 'boolean' },
            },
          },
        },
      },
      webhook_patio_movimentado: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          evento: { const: 'patio.movimentado' },
          payload: {
            type: 'object',
            properties: {
              solicitacaoId: { type: 'string' },
              quadra: { type: 'string' },
              posicao: { type: 'string' },
            },
          },
        },
      },
      webhook_saida_registrada: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          evento: { const: 'saida.registrada' },
          payload: {
            type: 'object',
            properties: { solicitacaoId: { type: 'string' }, dataHoraSaida: { type: 'string' } },
          },
        },
      },
      webhook_nfse_emitida: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          evento: { const: 'nfse.emitida' },
          payload: {
            type: 'object',
            properties: {
              nfsEmitidaId: { type: 'string' },
              faturamentoId: { type: 'string' },
              statusIpm: { type: 'string' },
            },
          },
        },
      },
      webhook_boleto_pago: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          evento: { const: 'boleto.pago' },
          payload: {
            type: 'object',
            properties: {
              boletoId: { type: 'string' },
              faturamentoId: { type: 'string' },
              valor: { type: 'number' },
            },
          },
        },
      },
    };

    return map[nome] ?? { erro: 'schema_nao_encontrado', nomeSolicitado: nome };
  }

  webhookContratos() {
    return [
      { evento: 'gate.registrado', schemaRef: '/api-contracts/v1/schemas/webhook_gate_registrado' },
      { evento: 'patio.movimentado', schemaRef: '/api-contracts/v1/schemas/webhook_patio_movimentado' },
      { evento: 'saida.registrada', schemaRef: '/api-contracts/v1/schemas/webhook_saida_registrada' },
      { evento: 'nfse.emitida', schemaRef: '/api-contracts/v1/schemas/webhook_nfse_emitida' },
      { evento: 'boleto.pago', schemaRef: '/api-contracts/v1/schemas/webhook_boleto_pago' },
    ];
  }
}
