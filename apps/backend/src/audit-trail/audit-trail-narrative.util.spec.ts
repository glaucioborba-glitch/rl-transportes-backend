import {
  buildAuditNarrative,
  resolveAuditAcao,
  resolveAuditCategoria,
} from './audit-trail-narrative.util';
import { CategoriaAuditLog, StatusBloqueioContainer, StatusPagamentoFatura, StatusSolicitacao } from '@prisma/client';

describe('audit-trail-narrative.util', () => {
  const base = {
    entidadeTipo: 'FATURA',
    entidadeId: 'fat-1',
    usuarioId: 'u1',
    usuarioNome: 'João Silva',
    usuarioRole: 'GERENTE',
    tenantId: 'default',
  };

  it('narrativa de bloqueio financeiro com contêiner', () => {
    const text = buildAuditNarrative({
      ...base,
      acao: 'BLOQUEIO_APLICADO',
      categoria: CategoriaAuditLog.FINANCEIRO,
      containerIso: 'HLBU1234567',
      dadosNovos: { tipo: 'FINANCEIRO', motivo: 'Fatura 998 vencida' },
    });
    expect(text).toContain('João Silva');
    expect(text).toContain('HLBU1234567');
    expect(text).toContain('Fatura 998 vencida');
  });

  it('narrativa de fatura paga via conciliação', () => {
    const text = buildAuditNarrative({
      ...base,
      usuarioRole: 'SISTEMA',
      usuarioNome: 'Sistema',
      acao: 'FATURA_ALTERADA',
      categoria: CategoriaAuditLog.FINANCEIRO,
      containerIso: 'HLBU1234567',
      dadosAnteriores: { statusPagamento: StatusPagamentoFatura.VENCIDA },
      dadosNovos: { statusPagamento: StatusPagamentoFatura.PAGO, origem: 'Conciliação CNAB', numeroRps: '998' },
    });
    expect(text).toContain('Sistema');
    expect(text).toContain('Pago');
    expect(text).toContain('Conciliação CNAB');
  });

  it('resolve ação de liberação de bloqueio', () => {
    expect(
      resolveAuditAcao('BloqueioContainer', 'update', { status: StatusBloqueioContainer.ATIVO }, { status: StatusBloqueioContainer.LIBERADO }),
    ).toBe('BLOQUEIO_LIBERADO');
  });

  it('resolve categoria financeira para fatura', () => {
    expect(resolveAuditCategoria('Fatura', 'FATURA_ALTERADA', null)).toBe(CategoriaAuditLog.FINANCEIRO);
  });

  it('resolve gate in operacional', () => {
    expect(
      resolveAuditAcao('Solicitacao', 'update', { status: StatusSolicitacao.AGUARDANDO_GATE_IN }, { status: StatusSolicitacao.EM_PATIO }),
    ).toBe('GATE_IN_REALIZADO');
  });
});
