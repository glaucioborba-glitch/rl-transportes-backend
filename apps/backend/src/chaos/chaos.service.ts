import { randomUUID } from 'node:crypto';
import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { AcaoAuditoria } from '@prisma/client';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ObservabilityBridgeService } from '../observability/observability-bridge.service';
import { PrismaService } from '../prisma/prisma.service';
import { AutoRecoveryService } from '../resilience/auto-recovery.service';
import type { ChaosPathGroup } from './chaos-gate.service';
import { ChaosGateService } from './chaos-gate.service';
import type { ChaosBloqueioDto } from './dto/chaos-bloqueio.dto';
import type { ChaosLatenciaDto } from './dto/chaos-latencia.dto';

@Injectable()
export class ChaosService {
  private readonly logger = new Logger(ChaosService.name);

  constructor(
    private readonly gate: ChaosGateService,
    private readonly audit: AuditoriaService,
    private readonly bridge: ObservabilityBridgeService,
    private readonly prisma: PrismaService,
    private readonly recovery: AutoRecoveryService,
  ) {}

  assertAllowed(): void {
    if (!this.gate.isChaosEnvironment()) {
      throw new ForbiddenException('Chaos Monkey RL desligado neste ambiente.');
    }
  }

  private emit(
    type: 'CHAOS_TRIGGERED' | 'CHAOS_RECOVERY' | 'CHAOS_ERROR' | 'CHAOS_FINISHED',
    payload: Record<string, unknown>,
  ): void {
    this.bridge.emit({ type, payload });
  }

  private async persistAuditAndAlert(params: {
    userId: string;
    action: string;
    detail: Record<string, unknown>;
    ip?: string;
    userAgent?: string;
  }): Promise<void> {
    const registroId = randomUUID();
    try {
      await this.audit.registrar({
        tabela: 'chaos_monkey',
        registroId,
        acao: AcaoAuditoria.SEGURANCA,
        usuario: params.userId,
        dadosDepois: { action: params.action, ...params.detail },
        ip: params.ip,
        userAgent: params.userAgent,
      });
    } catch (e) {
      this.logger.warn(`auditoria chaos: ${(e as Error).message}`);
    }
    try {
      await this.prisma.securityAlert.create({
        data: {
          userId: params.userId,
          tipo: 'CHAOS_SYNTHETIC',
          rota: '/admin/chaos',
          metodo: 'POST',
          contexto: {
            action: params.action,
            ...params.detail,
            nivel: 'INFO',
          },
          ip: params.ip?.slice(0, 64),
        },
      });
    } catch (e) {
      this.logger.warn(`security_alert chaos: ${(e as Error).message}`);
    }
  }

  async falhaDb(userId: string, ms: number | undefined, ip?: string, ua?: string): Promise<{ ok: true; ms: number }> {
    this.assertAllowed();
    const applied = this.gate.setDbFailure(ms ?? 2000);
    await this.persistAuditAndAlert({
      userId,
      action: 'falha-db',
      detail: { ms: applied },
      ip,
      userAgent: ua,
    });
    this.emit('CHAOS_TRIGGERED', { scenario: 'falha-db', ms: applied, at: new Date().toISOString() });
    setTimeout(() => {
      this.emit('CHAOS_FINISHED', { scenario: 'falha-db', at: new Date().toISOString() });
      void this.recovery
        .forceProbeCycle()
        .then(() => this.emit('CHAOS_RECOVERY', { scenario: 'falha-db', at: new Date().toISOString() }))
        .catch((e) =>
          this.emit('CHAOS_ERROR', { scenario: 'falha-db', message: (e as Error).message }),
        );
    }, applied + 50);
    return { ok: true, ms: applied };
  }

  async falhaRedis(userId: string, ms: number | undefined, ip?: string, ua?: string): Promise<{ ok: true; ms: number }> {
    this.assertAllowed();
    const applied = this.gate.setRedisFreeze(ms ?? 2000);
    await this.persistAuditAndAlert({
      userId,
      action: 'falha-redis',
      detail: { ms: applied },
      ip,
      userAgent: ua,
    });
    this.emit('CHAOS_TRIGGERED', { scenario: 'falha-redis', ms: applied, at: new Date().toISOString() });
    setTimeout(() => {
      this.emit('CHAOS_FINISHED', { scenario: 'falha-redis', at: new Date().toISOString() });
      void this.recovery
        .forceProbeCycle()
        .then(() => this.emit('CHAOS_RECOVERY', { scenario: 'falha-redis', at: new Date().toISOString() }))
        .catch((e) =>
          this.emit('CHAOS_ERROR', { scenario: 'falha-redis', message: (e as Error).message }),
        );
    }, applied + 50);
    return { ok: true, ms: applied };
  }

  async latencia(
    userId: string,
    dto: ChaosLatenciaDto,
    ip?: string,
    ua?: string,
  ): Promise<{ ok: true; prefixes: string[]; ms: number; durationMs: number }> {
    this.assertAllowed();
    const prefixes = this.gate.resolvePrefixesFromGroups(dto.targets as ChaosPathGroup[]);
    const durationMs = this.gate.clampDuration(dto.durationMs ?? 12_000, 12_000);
    this.gate.setLatencyForPrefixes(prefixes, dto.ms, durationMs);
    await this.persistAuditAndAlert({
      userId,
      action: 'latencia',
      detail: { prefixes, ms: dto.ms, durationMs },
      ip,
      userAgent: ua,
    });
    this.emit('CHAOS_TRIGGERED', {
      scenario: 'latencia',
      prefixes,
      ms: dto.ms,
      durationMs,
      at: new Date().toISOString(),
    });
    setTimeout(() => {
      this.emit('CHAOS_FINISHED', { scenario: 'latencia', at: new Date().toISOString() });
    }, durationMs + 50);
    return { ok: true, prefixes, ms: dto.ms, durationMs };
  }

  async bloqueioRota(
    userId: string,
    dto: ChaosBloqueioDto,
    ip?: string,
    ua?: string,
  ): Promise<{ ok: true; pathPrefix: string; status: number; durationMs: number }> {
    this.assertAllowed();
    const durationMs = this.gate.clampDuration(dto.durationMs ?? 10_000, 10_000);
    this.gate.addRouteBlock(dto.pathPrefix, dto.status, durationMs);
    await this.persistAuditAndAlert({
      userId,
      action: 'bloqueio-rota',
      detail: { pathPrefix: dto.pathPrefix, status: dto.status, durationMs },
      ip,
      userAgent: ua,
    });
    this.emit('CHAOS_TRIGGERED', {
      scenario: 'bloqueio-rota',
      pathPrefix: dto.pathPrefix,
      status: dto.status,
      durationMs,
      at: new Date().toISOString(),
    });
    setTimeout(() => {
      this.emit('CHAOS_FINISHED', { scenario: 'bloqueio-rota', pathPrefix: dto.pathPrefix, at: new Date().toISOString() });
    }, durationMs + 50);
    return { ok: true, pathPrefix: dto.pathPrefix, status: dto.status, durationMs };
  }

  async turbulencia(
    userId: string,
    durationMs: number | undefined,
    ip?: string,
    ua?: string,
  ): Promise<{ ok: true; durationMs: number }> {
    this.assertAllowed();
    const applied = this.gate.startTurbulence(durationMs ?? 10_000);
    await this.persistAuditAndAlert({
      userId,
      action: 'turbulencia',
      detail: { durationMs: applied },
      ip,
      userAgent: ua,
    });
    this.emit('CHAOS_TRIGGERED', { scenario: 'turbulencia', durationMs: applied, at: new Date().toISOString() });
    setTimeout(() => {
      this.emit('CHAOS_FINISHED', { scenario: 'turbulencia', at: new Date().toISOString() });
      void this.recovery
        .forceProbeCycle()
        .then(() => this.emit('CHAOS_RECOVERY', { scenario: 'turbulencia', at: new Date().toISOString() }))
        .catch((e) =>
          this.emit('CHAOS_ERROR', { scenario: 'turbulencia', message: (e as Error).message }),
        );
    }, applied + 50);
    return { ok: true, durationMs: applied };
  }

  async reset(userId: string, ip?: string, ua?: string): Promise<{ ok: true }> {
    this.assertAllowed();
    this.gate.reset();
    await this.persistAuditAndAlert({
      userId,
      action: 'reset',
      detail: {},
      ip,
      userAgent: ua,
    });
    this.emit('CHAOS_FINISHED', { scenario: 'reset-total', at: new Date().toISOString() });
    this.emit('CHAOS_RECOVERY', { scenario: 'reset-total', at: new Date().toISOString() });
    return { ok: true };
  }

  status(): Record<string, unknown> {
    return this.gate.getSnapshot();
  }
}
