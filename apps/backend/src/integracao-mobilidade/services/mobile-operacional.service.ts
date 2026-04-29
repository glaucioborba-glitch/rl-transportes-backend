import { Injectable } from '@nestjs/common';
import { AcaoAuditoria } from '@prisma/client';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { ConfigService } from '@nestjs/config';
import { digestBase64Payload } from '../common/integracao-string.util';
import type { MobileCanal } from '../stores/mobile-ops.store';
import { MobileOpsStore } from '../stores/mobile-ops.store';

export interface MobileSubmitDto {
  protocolo?: string;
  observacao?: string;
  imagemBase64?: string;
  lat?: number;
  lng?: number;
}

@Injectable()
export class MobileOperacionalService {
  constructor(
    private readonly store: MobileOpsStore,
    private readonly auditoria: AuditoriaService,
    private readonly config: ConfigService,
  ) {}

  private usuarioAuditoria(): string | undefined {
    return this.config.get<string>('INTEGRACAO_AUDITORIA_USER_ID')?.trim();
  }

  async registrar(
    userId: string,
    canal: MobileCanal,
    dto: MobileSubmitDto,
  ) {
    const digest = digestBase64Payload(dto.imagemBase64);
    const payload: Record<string, unknown> = {
      protocolo: dto.protocolo ?? null,
      observacao: dto.observacao ?? null,
      geo:
        dto.lat != null && dto.lng != null ? { lat: dto.lat, lng: dto.lng } : null,
      imagemDigest: digest,
    };
    const entry = this.store.add({
      userId,
      canal,
      payload,
      payloadDigest: JSON.stringify(digest),
    });
    const usuario = this.usuarioAuditoria();
    if (usuario) {
      try {
        await this.auditoria.registrar({
          tabela: 'integracao_mobile_ops',
          registroId: entry.id,
          acao: AcaoAuditoria.SEGURANCA,
          usuario,
          dadosDepois: {
            integrationAudit: true,
            canal,
            userId,
            protocolo: dto.protocolo,
          },
        });
      } catch {
        /* auditoria opcional */
      }
    }
    return {
      id: entry.id,
      canal,
      recebidoEm: entry.receivedAt,
      offlineRetryToken: entry.id,
      payloadDigest: digest,
    };
  }

  listOps(userId: string) {
    return this.store.byUser(userId);
  }

  turno(_userId: string) {
    return {
      turnoId: `turno_${new Date().toISOString().slice(0, 10)}`,
      inicioPrevisto: `${new Date().toISOString().slice(0, 10)}T06:00:00.000Z`,
      status: 'ativo',
      observacao: 'Definição de turno sincronizada com planejamento — placeholder Fase 14.',
    };
  }
}
