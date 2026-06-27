import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  StatusContainer,
  StatusSolicitacao,
  TipoCaminhao,
  TurnoAgendamento,
} from '@prisma/client';
import type { Request } from 'express';
import { SolicitacoesV2Service } from './solicitacoes-v2.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { AgendamentosService } from '../../agendamentos/agendamentos.service';
import { RedisService } from '../../redis/redis.service';
import { SecurityEventsService } from '../../security-center/security-events.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SolicitacaoAnexoStorageService } from './solicitacao-anexo.storage';
import { YardAllocationService } from '../../yard-allocation/yard-allocation.service';
import type { CreateSolicitacaoV2Dto } from './dto/create-solicitacao-v2.dto';
import type { CxPortalRequestUser } from '../../cx-portais/types/cx-portal.types';
import { TipoOperacaoSolicitacaoIntent } from '@prisma/client';

function lsDto(): CreateSolicitacaoV2Dto {
  return {
    tipoOperacao: TipoOperacaoSolicitacaoIntent.SOLICITAR_COLETA,
    transporte: {
      nomeMotorista: 'Motorista Teste',
      cpfMotorista: '12345678901',
      tipoCaminhao: TipoCaminhao.LS,
      placaCavalo: 'ABC1D23',
      placaCarreta01: 'ABC1D24',
    },
    containers: [
      {
        unidade: 'RLTU1234567',
        booking: 'BK001',
        processo: 'P1',
        tamanho: '40',
        tipo: 'HC',
        status: StatusContainer.VAZIO,
        refrigerado: false,
        ordem: 1,
      },
    ],
    agendamento: {
      dataRef: '2026-06-01',
      turno: TurnoAgendamento.MANHA,
      atendimentoEspecial: false,
    },
    solicitante: {
      nome: 'Fulano',
      telefone: '11999999999',
      email: 'a@b.com',
    },
  };
}

describe('SolicitacoesV2Service', () => {
  let service: SolicitacoesV2Service;

  const prisma = {
    cliente: { findFirst: jest.fn() },
    solicitacao: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    transporteSolicitacao: { create: jest.fn() },
    containerSolicitacao: { create: jest.fn(), count: jest.fn() },
    agendamentoSolicitacao: { create: jest.fn() },
    solicitanteContato: { create: jest.fn() },
    unidade: { create: jest.fn() },
    solicitacaoAnexo: { create: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
    auditoria: { findMany: jest.fn() },
    securityAlert: { findMany: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  };

  const redis = {
    incr: jest.fn(),
    decr: jest.fn(),
    expire: jest.fn(),
  };

  const auditoria = { registrar: jest.fn().mockResolvedValue({}) };
  const agendamentos = {
    criar: jest.fn(),
    assertCapacidadeTurno: jest.fn().mockResolvedValue(undefined),
    criarNaTransacao: jest.fn().mockResolvedValue({ id: 'ag-1' }),
    posCriacao: jest.fn().mockResolvedValue({ id: 'ag-1' }),
    dispararTransporteSolicitado: jest.fn(),
  };
  const securityEvents = {
    emit: jest.fn(),
    emitRiskChanged: jest.fn(),
    emitSolicitacaoV2RiscoClassificado: jest.fn(),
  };
  const storage = {
    persist: jest.fn().mockResolvedValue({ url: 'local://s1/f', storageKey: 'k' }),
    removeLocalIfApplicable: jest.fn(),
  };

  const cx: CxPortalRequestUser = {
    sub: 'portal-user-1',
    portalPapel: 'CLIENTE',
    clienteId: 'cliente-1',
    cpfCnpj: '11000000000108',
    email: 'c@d.com',
    tenantId: 't1',
    tokenVersion: 1,
    auth: 'portal',
  };

  const req = {
    ip: '127.0.0.1',
    get: jest.fn().mockReturnValue('jest'),
    headers: { 'x-device-fingerprint': 'fp1', 'x-session-id': 'sid1' },
  } as unknown as Request;

  beforeEach(async () => {
    jest.clearAllMocks();
    redis.incr.mockResolvedValue(1);
    redis.expire.mockResolvedValue(1);
    redis.decr.mockResolvedValue(1);
    prisma.cliente.findFirst.mockResolvedValue({ id: 'cliente-1' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SolicitacoesV2Service,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: AuditoriaService, useValue: auditoria },
        { provide: AuditLogService, useValue: { log: jest.fn() } },
        { provide: AgendamentosService, useValue: agendamentos },
        { provide: SecurityEventsService, useValue: securityEvents },
        { provide: SolicitacaoAnexoStorageService, useValue: storage },
        { provide: YardAllocationService, useValue: { applyGiroEstimado: jest.fn().mockResolvedValue(null) } },
      ],
    }).compile();

    service = module.get(SolicitacoesV2Service);
  });

  it('exige lacre quando container CHEIO', async () => {
    const dto = lsDto();
    dto.containers[0].status = StatusContainer.CHEIO;
    dto.containers[0].lacre = '';
    await expect(service.criarPortal(dto, cx, req)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('exige setPoint quando reefer', async () => {
    const dto = lsDto();
    dto.containers[0].refrigerado = true;
    dto.containers[0].setPoint = undefined;
    await expect(service.criarPortal(dto, cx, req)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('Rodotrem exige 2 containers', async () => {
    const dto = lsDto();
    dto.transporte!.tipoCaminhao = TipoCaminhao.RODOTREM;
    dto.transporte!.placaCarreta02 = 'ABC1D25';
    dto.containers = [
      { ...dto.containers[0], ordem: 1, booking: 'B1' },
      {
        unidade: 'RLTU7654321',
        booking: 'B2',
        processo: 'P2',
        tamanho: '40',
        tipo: 'HC',
        status: StatusContainer.VAZIO,
        refrigerado: false,
        ordem: 2,
      },
    ];
    dto.containers.pop();
    await expect(service.criarPortal(dto, cx, req)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('bloqueia portal após 15 solicitações na hora (pré-check Redis)', async () => {
    redis.incr.mockResolvedValue(16);
    const dto = lsDto();
    await expect(service.criarPortal(dto, cx, req)).rejects.toBeInstanceOf(ForbiddenException);
    expect(redis.decr).toHaveBeenCalled();
  });

  it('registrarMetricasSegurancaPortal inclui sinal BOOKING_DUPLICADO_NO_FORMULARIO', async () => {
    const dto = lsDto();
    dto.transporte!.tipoCaminhao = TipoCaminhao.RODOTREM;
    dto.transporte!.placaCarreta02 = 'ABC1D25';
    dto.containers = [
      { ...dto.containers[0], ordem: 1, booking: 'BK-DUP', unidade: 'RLTU1111111' },
      {
        unidade: 'RLTU2222222',
        booking: 'BK-DUP',
        processo: 'P2',
        tamanho: '40',
        tipo: 'HC',
        status: StatusContainer.VAZIO,
        refrigerado: false,
        ordem: 2,
      },
    ];
    await service.registrarMetricasSegurancaPortal({
      cx,
      req,
      dto,
      solicitacaoId: 'sol-dup',
    });
    expect(securityEvents.emitSolicitacaoV2RiscoClassificado).toHaveBeenCalledWith(
      expect.objectContaining({
        sinais: expect.arrayContaining(['BOOKING_DUPLICADO_NO_FORMULARIO']),
      }),
    );
  });

  it('rotuloStatusV2 expõe rótulo para relatório sem mudar enum', () => {
    expect(service.rotuloStatusV2(StatusSolicitacao.APROVADO)).toBe('APROVADA');
    expect(service.rotuloStatusV2(StatusSolicitacao.PENDENTE)).toBe('PENDENTE');
  });

  it('registrarMetricasSegurancaPortal emite SOLICITACAO_V2_RISCO_CLASSIFICADO', async () => {
    const dto = lsDto();
    await service.registrarMetricasSegurancaPortal({
      cx,
      req,
      dto,
      solicitacaoId: 'sol-1',
    });
    expect(securityEvents.emitSolicitacaoV2RiscoClassificado).toHaveBeenCalledWith(
      expect.objectContaining({
        solicitacaoId: 'sol-1',
        userId: cx.sub,
        clienteId: cx.clienteId,
      }),
    );
  });

  it('anexarStaff persiste arquivo e registra auditoria', async () => {
    prisma.solicitacao.findFirst.mockResolvedValue({
      id: 's1',
      transporteSolicitacao: { id: 't1' },
    });
    prisma.solicitacaoAnexo.create.mockResolvedValue({
      id: 'an1',
      filename: 'doc.pdf',
      solicitacaoId: 's1',
      size: 10,
      mimeType: 'application/pdf',
      urlS3: 'x',
      expiresAt: new Date(),
    });

    const file = {
      buffer: Buffer.from('x'),
      size: 10,
      mimetype: 'application/pdf',
      originalname: 'doc.pdf',
    } as Express.Multer.File;

    await service.anexarStaff('s1', { id: 'staff-1' } as any, file);
    expect(storage.persist).toHaveBeenCalled();
    expect(prisma.solicitacaoAnexo.create).toHaveBeenCalled();
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        tabela: 'solicitacao_anexos',
        solicitacaoId: 's1',
      }),
      undefined,
    );
  });

  it('aprovarStaff grava delta de status na auditoria', async () => {
    prisma.solicitacao.findFirst.mockResolvedValue({
      id: 's1',
      status: StatusSolicitacao.PENDENTE,
      anexosSolicitacao: [{ id: 'a1' }],
      transporteSolicitacao: {},
    });
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma));
    prisma.solicitacao.update.mockResolvedValue({
      id: 's1',
      status: StatusSolicitacao.AGUARDANDO_GATE_IN,
      transporteSolicitacao: {},
      containersSolicitacao: [],
      agendamentoSolicitacao: null,
      solicitanteContato: null,
      anexosSolicitacao: [],
    });

    await service.aprovarStaff('s1', { id: 'staff-1' } as any);
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        deltas: [
          { campo: 'status', antes: StatusSolicitacao.PENDENTE, depois: StatusSolicitacao.AGUARDANDO_GATE_IN },
        ],
        solicitacaoId: 's1',
      }),
      prisma,
    );
  });
});
