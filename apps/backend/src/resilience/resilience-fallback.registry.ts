import type { ResilienceServiceKey } from './resilience.constants';

/** Shape mínimo de `GET /cliente/portal/dashboard` para o Next não quebrar em degradação. */
export function portalDashboardFallbackPayload(tenantId = 'default') {
  return {
    cliente: null,
    solicitacoes: {
      abertas: 0,
      emAndamento: 0,
      concluidas: 0,
      canceladas: 0,
      ultimas: [] as unknown[],
    },
    slas: { cumpridos: 0, violados: 0, desempenho: 100 },
    financeiro: {
      boletosPendentes: 0,
      nfseEmitidas: 0,
      faturadoMes: 0,
      totalFaturadoPeriodo: 0,
    },
    unidades: { total: 0, import: 0, export: 0, gateIn: 0, gateOut: 0 },
    tendencias: { solicitacoesMesVsAnteriorPct: 0, faturadoMesVsAnteriorPct: 0 },
    totalSolicitacoes: 0,
    solicitacoesRecentes: [] as unknown[],
    kpis: { abertas: 0, emAndamento: 0, concluídas: 0 },
    kpisCx: {
      personalizaveis: ['ciclo_medio_horas', 'containers_ativos', 'faturamento_aberto'],
      valores: {
        ciclo_medio_horas: null as number | null,
        containers_ativos: 0,
        faturamento_aberto: 0,
      },
    },
    slasCx: {
      tenantId,
      contratadosProxy: {} as Record<string, number>,
      historicoProxy: [{ periodo: '30d', cumprimentoPctProxy: 100 }],
    },
    trackingSample: [] as unknown[],
    solicitacoesHoje: [] as unknown[],
    recent: {
      items: [] as unknown[],
      total: 0,
      page: 1,
      limit: 8,
      orderBy: 'createdAt',
      order: 'desc',
    },
    meta: {
      tenantId,
      slasMinutosMeta: null as Record<string, number> | null,
      cacheHit: false,
      resilienceFallback: true,
    },
    isBloqueadoFinanceiramente: false,
  };
}

/** Payloads estáveis quando o handler falha mas o circuito ainda está CLOSED (degradação graciosa). */
export function buildFallbackPayload(service: ResilienceServiceKey, path: string): unknown {
  const p = path.split('?')[0] || '';

  if (service === 'portal' && p.includes('/dashboard')) {
    return portalDashboardFallbackPayload();
  }

  if (service === 'security') {
    return {
      riscoGlobal: 0,
      status: 'fallback',
      engine: 'offline',
      motivo: 'resilience-fallback',
      ultimasAnomalias: [] as unknown[],
      fingerprintAtual: '',
      fingerprintSelo: 'novo' as const,
      riscoPorDispositivo: [] as Array<{ sessionId: string; fingerprint: string; score: number }>,
      recomendacao: '',
    };
  }

  if (service === 'financeiro') {
    return {
      faturas: [] as unknown[],
      totalPeriodo: 0,
      status: 'fallback',
      motivo: 'serviço degradado',
    };
  }

  if (service === 'agendamentos') {
    return {
      slots: [] as unknown[],
      status: 'fallback',
      motivo: 'serviço lento',
    };
  }

  if (service === 'auditoria') {
    return {
      items: [] as unknown[],
      status: 'fallback',
      motivo: 'auditoria indisponível',
    };
  }

  if (service === 'portal' && p.includes('solicitacoes')) {
    return {
      data: [] as unknown[],
      meta: { total: 0, status: 'fallback' },
      status: 'fallback',
    };
  }

  return {
    status: 'fallback',
    motivo: 'serviço degradado',
    path: p.slice(0, 200),
  };
}
