import { Injectable } from '@nestjs/common';
import type { PlataformaServicoId } from '../plataforma.types';

export type MarketplaceServicoDto = {
  id: PlataformaServicoId;
  nome: string;
  descricao: string;
  categoria: 'operacional' | 'financeiro' | 'fiscal' | 'analytics';
  pricingConceito: { modelo: 'por_chamada' | 'pacote' | 'assinatura'; faixaUsd: string };
  readOnly: boolean;
};

const CATALOGO: MarketplaceServicoDto[] = [
  {
    id: 'tracking_operacional',
    nome: 'Tracking operacional',
    descricao: 'Consulta de solicitações e etapas (portaria, gate, pátio, saída).',
    categoria: 'operacional',
    pricingConceito: { modelo: 'por_chamada', faixaUsd: 'conceitual — não cobrado Fase 18' },
    readOnly: true,
  },
  {
    id: 'tracking_financeiro',
    nome: 'Tracking financeiro',
    descricao: 'Faturamento e boletos agregados (read-only).',
    categoria: 'financeiro',
    pricingConceito: { modelo: 'assinatura', faixaUsd: 'conceitual' },
    readOnly: true,
  },
  {
    id: 'sla_service',
    nome: 'SLA-as-a-service',
    descricao: 'Indicadores de SLA com configuração por terminal.',
    categoria: 'analytics',
    pricingConceito: { modelo: 'pacote', faixaUsd: 'conceitual' },
    readOnly: true,
  },
  {
    id: 'ciclo_operacional',
    nome: 'Ciclo operacional',
    descricao: 'Métricas de duração média e throughput nas etapas.',
    categoria: 'analytics',
    pricingConceito: { modelo: 'por_chamada', faixaUsd: 'conceitual' },
    readOnly: true,
  },
  {
    id: 'patio_tempo_real',
    nome: 'Pátio em tempo real',
    descricao: 'Posicionamento atual (proxy Fase 4 / cadastro de pátio).',
    categoria: 'operacional',
    pricingConceito: { modelo: 'assinatura', faixaUsd: 'conceitual' },
    readOnly: true,
  },
  {
    id: 'produtividade_stats',
    nome: 'Produtividade e ciclos',
    descricao: 'Estatísticas operacionais agregadas.',
    categoria: 'analytics',
    pricingConceito: { modelo: 'pacote', faixaUsd: 'conceitual' },
    readOnly: true,
  },
  {
    id: 'eventos_fiscal_financeiro',
    nome: 'Eventos fiscais e financeiros',
    descricao: 'Trilha de auditoria e NFS-e resumidas.',
    categoria: 'fiscal',
    pricingConceito: { modelo: 'por_chamada', faixaUsd: 'conceitual' },
    readOnly: true,
  },
  {
    id: 'faturamento_pagamentos',
    nome: 'Status faturamento e pagamentos',
    descricao: 'NFSe, boletos e status (read-only).',
    categoria: 'financeiro',
    pricingConceito: { modelo: 'assinatura', faixaUsd: 'conceitual' },
    readOnly: true,
  },
];

@Injectable()
export class PlataformaMarketplaceService {
  listarServicos(): MarketplaceServicoDto[] {
    return [...CATALOGO];
  }

  obterServico(id: string): MarketplaceServicoDto | undefined {
    return CATALOGO.find((s) => s.id === id);
  }
}
