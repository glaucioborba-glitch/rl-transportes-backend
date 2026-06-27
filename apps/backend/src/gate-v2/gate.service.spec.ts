jest.mock('puppeteer-core', () => ({
  __esModule: true,
  default: { launch: jest.fn() },
}));
jest.mock('@sparticuz/chromium', () => ({
  __esModule: true,
  default: { executablePath: jest.fn(), args: [] },
}));

import { Test } from '@nestjs/testing';
import { AnguloFotoVistoria, StatusSolicitacao, TipoCaminhao } from '@prisma/client';
import { VistoriaService } from '../vistoria/vistoria.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PdfOperacionalV2Service } from '../pdf-operacional-v2/pdf-operacional-v2.service';
import { SecurityEventsService } from '../security-center/security-events.service';
import { SolicitacaoAnexoStorageService } from '../modules/solicitacoes-v2/solicitacao-anexo.storage';
import { SolicitacoesV2Service } from '../modules/solicitacoes-v2/solicitacoes-v2.service';
import { PatioV2Service } from '../patio-v2/patio.service';
import { ArmazenagemBillingService } from '../armazenagem-faturamento/armazenagem-billing.service';
import { YardAllocationService } from '../yard-allocation/yard-allocation.service';
import { PrismaService } from '../prisma/prisma.service';
import { HoldReleaseService } from '../hold-release/hold-release.service';
import { GateV2Service } from './gate.service';

describe('GateV2Service', () => {
  let service: GateV2Service;
  let prisma: {
    gateCheckIn: { findFirst: jest.Mock; create: jest.Mock };
    solicitacao: { findFirst: jest.Mock; update: jest.Mock };
    $transaction: jest.Mock;
    gateCheckOut: { create: jest.Mock };
    saida: { upsert: jest.Mock };
  };
  let pdf: { verificarAuthenticidade: jest.Mock };
  let security: { emit: jest.Mock };
  let storage: { persist: jest.Mock; deleteUploadedObjects: jest.Mock };
  let solicitacoesV2: { obterDetalheStaff: jest.Mock };
  let patioV2: { provisionFromGateIn: jest.Mock; finalizeFromGateOut: jest.Mock };
  let vistoria: {
    assertFotosCompletas: jest.Mock;
    createVistoria: jest.Mock;
    rollbackUploaded: jest.Mock;
  };
  let holdRelease: { assertSemBloqueioAtivo: jest.Mock };

  function fotosCompletas() {
    const map = new Map();
    for (const angulo of [
      AnguloFotoVistoria.FRENTE,
      AnguloFotoVistoria.TRASEIRA,
      AnguloFotoVistoria.LATERAL_DIREITA,
      AnguloFotoVistoria.LATERAL_ESQUERDA,
    ]) {
      map.set(angulo, { angulo, buffer: Buffer.from('x'), mimeType: 'image/jpeg' });
    }
    return map;
  }

  beforeEach(async () => {
    pdf = { verificarAuthenticidade: jest.fn().mockResolvedValue({ valido: true, divergencias: [] }) };
    security = { emit: jest.fn() };
    storage = {
      persist: jest.fn().mockResolvedValue({ url: 'local://s1/f.jpg', storageKey: 'k' }),
      deleteUploadedObjects: jest.fn().mockResolvedValue(undefined),
    };
    solicitacoesV2 = { obterDetalheStaff: jest.fn() };
    patioV2 = {
      provisionFromGateIn: jest.fn().mockResolvedValue(1),
      finalizeFromGateOut: jest.fn().mockResolvedValue(undefined),
    };

    vistoria = {
      assertFotosCompletas: jest.fn(),
      createVistoria: jest.fn().mockResolvedValue({
        publicUrls: ['u1', 'u2', 'u3', 'u4'],
        fotos: [{ storageKey: 'k1' }],
      }),
      rollbackUploaded: jest.fn(),
    };
    holdRelease = { assertSemBloqueioAtivo: jest.fn().mockResolvedValue(undefined) };

    const tx = {
      gateCheckIn: {
        create: jest.fn().mockResolvedValue({ id: 'gin1', dataHora: new Date() }),
        update: jest.fn(),
      },
      solicitacao: {
        update: jest.fn(),
      },
      gateCheckOut: {
        create: jest.fn().mockResolvedValue({ id: 'out1' }),
        update: jest.fn(),
      },
      saida: {
        upsert: jest.fn(),
      },
    };

    prisma = {
      gateCheckIn: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      solicitacao: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      gateCheckOut: { create: jest.fn() },
      saida: { upsert: jest.fn() },
      auditoria: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    } as unknown as typeof prisma;

    const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };

    const mod = await Test.createTestingModule({
      providers: [
        GateV2Service,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditoriaService, useValue: auditoria },
        { provide: PdfOperacionalV2Service, useValue: pdf },
        { provide: SolicitacaoAnexoStorageService, useValue: storage },
        { provide: SecurityEventsService, useValue: security },
        { provide: SolicitacoesV2Service, useValue: solicitacoesV2 },
        { provide: PatioV2Service, useValue: patioV2 },
        { provide: ArmazenagemBillingService, useValue: { openPreFaturasForGateIn: jest.fn(), consolidateOnGateOut: jest.fn(), onGateOut: jest.fn() } },
        { provide: YardAllocationService, useValue: { applyGiroEstimado: jest.fn().mockResolvedValue(null) } },
        { provide: VistoriaService, useValue: vistoria },
        { provide: HoldReleaseService, useValue: holdRelease },
      ],
    }).compile();

    service = mod.get(GateV2Service);
  });

  function transportSol(status: StatusSolicitacao) {
    return {
      id: 's1',
      clienteId: 'c1',
      status,
      transporteSolicitacao: {
        placaCavalo: 'ABC1D23',
        placaCarreta01: 'DEF4G56',
        placaCarreta02: null,
        nomeMotorista: 'João',
        cpfMotorista: '52998224725',
        tipoCaminhao: TipoCaminhao.LS,
      },
      containersSolicitacao: [{ ordem: 1, unidade: 'MSKU1234567' }],
    };
  }

  it('check-in válido grava GateCheckIn e move status para EM_PATIO', async () => {
    prisma.gateCheckIn.findFirst.mockResolvedValue(null);
    prisma.solicitacao.findFirst.mockResolvedValue(transportSol(StatusSolicitacao.AGUARDANDO_GATE_IN));

    const r = await service.checkIn(
      's1',
      'op1',
      {
        placaCavalo: 'ABC1D23',
        placaCarreta01: 'DEF4G56',
        motoristaNome: 'João',
        motoristaCpf: '52998224725',
        pdfHash: 'a'.repeat(64),
      },
      fotosCompletas(),
    );
    expect(r.id).toBe('gin1');
    expect(security.emit).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'GATE_CHECKIN' }),
    );
  });

  it('check-in com divergência crítica emite GATE_DIVERGENCIA_CRITICA', async () => {
    prisma.gateCheckIn.findFirst.mockResolvedValue(null);
    prisma.solicitacao.findFirst.mockResolvedValue(transportSol(StatusSolicitacao.AGUARDANDO_GATE_IN));

    await service.checkIn(
      's1',
      'op1',
      {
        placaCavalo: 'ZZZ9Z99',
        placaCarreta01: 'DEF4G56',
        motoristaNome: 'João',
        motoristaCpf: '52998224725',
      },
      fotosCompletas(),
    );

    expect(security.emit).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'GATE_DIVERGENCIA_CRITICA' }),
    );
  });

  it('check-out válido conclui solicitação', async () => {
    prisma.gateCheckIn.findFirst.mockResolvedValue({
      id: 'gin1',
      solicitacaoId: 's1',
      checkOut: null,
      divergenciasJson: [],
      solicitacao: { id: 's1', status: StatusSolicitacao.EM_PATIO },
    });

    await service.checkOut('gin1', 'op1', {}, fotosCompletas());

    expect(security.emit).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'GATE_CHECKOUT' }),
    );
  });

  it('ocrPlacaMockFromBuffer delega ao pipeline mock', async () => {
    const r = await service.ocrPlacaMockFromBuffer(Buffer.from('fake-image'));
    expect(r.placa).toEqual(expect.any(String));
    expect(r.providerUsado).toBeDefined();
  });

  it('validarQrCredencial rejeita versão desatualizada', async () => {
    prisma.solicitacao.findFirst.mockResolvedValue({
      id: 's1',
      protocolo: 'RL-2026-TEST',
      status: StatusSolicitacao.APROVADO,
      versaoCredencial: 2,
      tipoOperacao: 'SOLICITAR_BAIXA',
      containersSolicitacao: [{ ordem: 1, unidade: 'MSKU1234567' }],
      agendamentoSolicitacao: { dataRef: new Date('2026-06-10'), turno: 'MANHA' },
      transporteSolicitacao: {
        placaCavalo: 'ABC1D23',
        placaCarreta01: 'DEF4G56',
        placaCarreta02: null,
        nomeMotorista: 'João',
      },
      cliente: { razaoSocial: 'Cliente QA', nomeFantasia: null },
      agendamentos: [],
    });
    (prisma as { unidade?: { findMany: jest.Mock } }).unidade = {
      findMany: jest.fn().mockResolvedValue([]),
    };

    await expect(
      service.validarQrCredencial('RL-2026-TEST', 'MSKU1234567', 1),
    ).rejects.toThrow('QR Code desatualizado ou inválido');
  });

  it('validarQrCredencial aceita versão corrente', async () => {
    prisma.solicitacao.findFirst.mockResolvedValue({
      id: 's1',
      protocolo: 'RL-2026-TEST',
      status: StatusSolicitacao.APROVADO,
      versaoCredencial: 1,
      tipoOperacao: 'SOLICITAR_BAIXA',
      containersSolicitacao: [{ ordem: 1, unidade: 'MSKU1234567' }],
      agendamentoSolicitacao: { dataRef: new Date('2026-06-10'), turno: 'MANHA' },
      transporteSolicitacao: {
        placaCavalo: 'ABC1D23',
        placaCarreta01: 'DEF4G56',
        placaCarreta02: null,
        nomeMotorista: 'João',
      },
      cliente: { razaoSocial: 'Cliente QA', nomeFantasia: null },
      agendamentos: [],
    });
    (prisma as { unidade?: { findMany: jest.Mock } }).unidade = {
      findMany: jest.fn().mockResolvedValue([]),
    };

    const r = await service.validarQrCredencial('RL-2026-TEST', 'MSKU1234567', 1);
    expect(r.valido).toBe(true);
    expect(r.solicitacao?.versaoCredencial).toBe(1);
    expect(holdRelease.assertSemBloqueioAtivo).toHaveBeenCalledWith('s1');
  });

  it('validarQrCredencial rejeita bloqueio ativo com 403', async () => {
    prisma.solicitacao.findFirst.mockResolvedValue({
      id: 's1',
      protocolo: 'RL-2026-TEST',
      status: StatusSolicitacao.EM_PATIO,
      versaoCredencial: 1,
      tipoOperacao: 'SOLICITAR_BAIXA',
      containersSolicitacao: [{ ordem: 1, unidade: 'MSKU1234567' }],
      agendamentoSolicitacao: null,
      transporteSolicitacao: null,
      cliente: null,
      agendamentos: [],
    });
    holdRelease.assertSemBloqueioAtivo.mockRejectedValue(
      Object.assign(new Error('blocked'), {
        response: {
          message:
            'ACESSO NEGADO. Unidade possui bloqueio ativo do tipo FINANCEIRO. Motivo: Inadimplência. Procure a administração.',
        },
        status: 403,
      }),
    );

    await expect(service.validarQrCredencial('RL-2026-TEST', 'MSKU1234567', 1)).rejects.toThrow();
    expect(holdRelease.assertSemBloqueioAtivo).toHaveBeenCalledWith('s1');
  });

  it('preCheckIn chama verificação de PDF quando hash informado', async () => {
    solicitacoesV2.obterDetalheStaff.mockResolvedValue({
      solicitacao: transportSol(StatusSolicitacao.AGUARDANDO_GATE_IN),
      auditoria: [],
      securityAlerts: [],
      timeline: [],
      statusV2Label: 'x',
      resumoRisco: { totalAlertas: 0, riscoMax: null },
    });
    prisma.gateCheckIn.findFirst.mockResolvedValue(null);

    await service.preCheckInContext('s1', 'b'.repeat(64));
    expect(pdf.verificarAuthenticidade).toHaveBeenCalled();
  });
});
