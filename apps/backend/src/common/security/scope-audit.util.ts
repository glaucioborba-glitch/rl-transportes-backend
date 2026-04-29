import { AcaoAuditoria } from '@prisma/client';
import { AuditoriaService } from '../../auditoria/auditoria.service';

type AuditCtx = { usuario: string; ip?: string; userAgent?: string };

/** Regista tentativa de filtrar / aceder a recurso de outro cliente (escopo). */
export async function registrarTentativaForaDeEscopo(
  auditoria: AuditoriaService,
  ctx: AuditCtx,
  detalhe: { recurso: string; tentativaClienteId?: string; atorClienteId: string | null; registroId?: string },
) {
  await auditoria.registrar({
    tabela: 'escopo_cliente',
    registroId: detalhe.registroId ?? detalhe.atorClienteId ?? 'n/a',
    acao: AcaoAuditoria.SEGURANCA,
    usuario: ctx.usuario,
    dadosDepois: {
      event: 'TENTATIVA_FORA_ESCOPO',
      ...detalhe,
    },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
}

export async function registrarLeituraSensivel(
  auditoria: AuditoriaService,
  ctx: AuditCtx,
  tabela: string,
  registroId: string,
  dados: Record<string, unknown> = {},
) {
  await auditoria.registrar({
    tabela,
    registroId,
    acao: AcaoAuditoria.READ,
    usuario: ctx.usuario,
    dadosDepois: { event: 'LEITURA_SENSIVEL', ...dados },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
}
