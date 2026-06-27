import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import { AcaoAuditoria, StatusSolicitacao, TipoCaminhao } from '@prisma/client';
import { SolicitacoesV2Service } from '../modules/solicitacoes-v2/solicitacoes-v2.service';
import { RedisService } from '../redis/redis.service';
import { PdfOperacionalV2Service, type DetalheStaff } from './pdf-operacional-v2.service';
import { gerarHashAntiFraude } from './utils/hash-antifraude';

jest.mock('qrcode', () => ({
  __esModule: true,
  default: {
    toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,ZmFrZQ=='),
  },
}));

jest.mock('puppeteer-core', () => ({
  __esModule: true,
  default: {
    launch: jest.fn().mockResolvedValue({
      newPage: jest.fn().mockResolvedValue({
        setContent: jest.fn().mockResolvedValue(undefined),
        pdf: jest.fn().mockResolvedValue(Buffer.alloc(52 * 1024)),
      }),
      close: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

function mockReq(fp = 'fp-test'): Request {
  return {
    protocol: 'http',
    get: (h: string) => (h.toLowerCase() === 'host' ? 'localhost:3001' : undefined),
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' } as Request['socket'],
    headers: { 'x-device-fingerprint': fp },
  } as unknown as Request;
}

function baseDetalhe(overrides?: {
  tipoCaminhao?: TipoCaminhao;
  containers?: DetalheStaff['solicitacao']['containersSolicitacao'];
}): DetalheStaff {
  const tipo = overrides?.tipoCaminhao ?? TipoCaminhao.LS;
  const containers =
    overrides?.containers ??
    ([
      {
        id: 'c1',
        solicitacaoId: 'sol-1',
        unidade: 'MSKU123',
        booking: 'BK1',
        processo: 'PROC1',
        tamanho: '40',
        tipo: 'HC',
        status: 'CHEIO',
        lacre: 'LAC-1',
        refrigerado: true,
        setPoint: -18,
        reeferId: null,
        ordem: 1,
        createdAt: new Date(),
      },
      {
        id: 'c2',
        solicitacaoId: 'sol-1',
        unidade: 'MSKU456',
        booking: 'BK2',
        processo: 'PROC2',
        tamanho: '40',
        tipo: 'HC',
        status: 'VAZIO',
        lacre: null,
        refrigerado: false,
        setPoint: null,
        reeferId: null,
        ordem: 2,
        createdAt: new Date(),
      },
    ] as unknown as DetalheStaff['solicitacao']['containersSolicitacao']);

  return {
    solicitacao: {
      id: 'sol-1',
      protocolo: 'RL-V2-TEST',
      clienteId: 'cli-1',
      status: StatusSolicitacao.PENDENTE,
      tipoFluxo: null,
      servicosAdicionais: null,
      createdAt: new Date('2026-05-01T15:00:00.000Z'),
      updatedAt: new Date('2026-05-02T15:00:00.000Z'),
      deletedAt: null,
      cliente: {
        id: 'cli-1',
        razaoSocial: 'Cliente Teste LTDA',
        nomeFantasia: null,
        cpfCnpj: '12345678000199',
      },
      transporteSolicitacao: {
        id: 'ts-1',
        solicitacaoId: 'sol-1',
        nomeMotorista: 'Motorista Integração',
        cpfMotorista: '52998224725',
        tipoCaminhao: tipo,
        placaCavalo: 'ABC1D23',
        placaCarreta01: 'EFG4H56',
        placaCarreta02: tipo === TipoCaminhao.RODOTREM ? 'IJK7L89' : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      containersSolicitacao: containers,
      agendamentoSolicitacao: {
        id: 'ag-1',
        solicitacaoId: 'sol-1',
        dataRef: new Date('2026-05-10T00:00:00.000Z'),
        turno: 'MANHA',
        atendimentoEspecial: true,
        atendimentoEspecialTexto: 'Carga sensível',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      solicitanteContato: {
        id: 'ct-1',
        solicitacaoId: 'sol-1',
        nome: 'Fulano Solicitante',
        telefone: '47999990000',
        email: 'solic@empresa.com',
        createdAt: new Date(),
      },
      anexosSolicitacao: [
        {
          id: 'ax-1',
          solicitacaoId: 'sol-1',
          filename: 'doc.pdf',
          mimeType: 'application/pdf',
          size: 51_200,
          urlS3: 'https://example.invalid/x',
          expiresAt: new Date('2099-01-01'),
          createdAt: new Date(),
        },
      ],
      unidades: [],
      portaria: null,
    },
    auditoria: [
      {
        id: 'au-1',
        tabela: 'solicitacoes',
        registroId: 'sol-1',
        acao: AcaoAuditoria.UPDATE,
        usuario: 'u1',
        createdAt: new Date('2026-05-03T10:00:00.000Z'),
        dadosAntes: { status: StatusSolicitacao.PENDENTE },
        dadosDepois: {
          deltas: [{ campo: 'status', antes: 'PENDENTE', depois: 'EM_ANALISE' }],
        },
      },
    ],
    securityAlerts: [
      {
        id: 'sa-1',
        userId: null,
        clienteId: 'cli-1',
        risco: 7 as unknown as DetalheStaff['securityAlerts'][0]['risco'],
        tipo: 'TEST_ALERT',
        ip: null,
        geo: null,
        fingerprint: null,
        rota: null,
        metodo: null,
        contexto: { solicitacaoId: 'sol-1' },
        createdAt: new Date(),
      },
    ],
    timeline: [
      {
        id: 'tl-1',
        tipo: 'criacao',
        titulo: 'Solicitação criada',
        subtitulo: 'RL-V2-TEST',
        createdAt: '2026-05-01T15:00:00.000Z',
      },
      {
        id: 'tl-2',
        tipo: 'alerta',
        titulo: 'Alerta de segurança',
        subtitulo: 'TEST_ALERT',
        createdAt: '2026-05-03T11:00:00.000Z',
        meta: { risco: 7 },
      },
    ],
    statusV2Label: 'Pendente de análise',
    resumoRisco: { totalAlertas: 1, riscoMax: 7 },
  } as unknown as DetalheStaff;
}

describe('PdfOperacionalV2Service', () => {
  let service: PdfOperacionalV2Service;
  let solicitacoesV2: { obterDetalheStaff: jest.Mock };
  let redis: { setex: jest.Mock; get: jest.Mock };

  beforeEach(async () => {
    solicitacoesV2 = { obterDetalheStaff: jest.fn() };
    redis = { setex: jest.fn().mockResolvedValue('OK'), get: jest.fn().mockResolvedValue(null) };
    const mod = await Test.createTestingModule({
      providers: [
        PdfOperacionalV2Service,
        { provide: SolicitacoesV2Service, useValue: solicitacoesV2 },
        { provide: RedisService, useValue: redis },
        {
          provide: ConfigService,
          useValue: {
            get: (k: string) =>
              k === 'PUPPETEER_EXECUTABLE_PATH' ? 'C:\\fake\\chrome.exe' : undefined,
          },
        },
      ],
    }).compile();
    service = mod.get(PdfOperacionalV2Service);
  });

  it('gera hash SHA-256 estável para payload idêntico', () => {
    const p = {
      solicitacaoId: 'a',
      protocolo: 'p',
      clienteId: 'c',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      tipoCaminhao: 'LS',
      containers: [
        { ordem: 1, status: 'CHEIO', lacre: 'x', refrigerado: false, setPoint: null },
      ],
      riskScore: 3,
      fingerprint: 'fp',
      ultimoGateCheckInId: null,
      ultimoGateCheckOutId: null,
    };
    expect(gerarHashAntiFraude(p)).toBe(gerarHashAntiFraude({ ...p }));
    expect(gerarHashAntiFraude(p)).toHaveLength(64);
  });

  it('detecta divergência quando campo do payload muda (antifraude)', () => {
    const a = service['buildAntifraudPayloadFromDetalhe'](baseDetalhe(), 'fp1');
    const b = service['buildAntifraudPayloadFromDetalhe'](
      baseDetalhe({ tipoCaminhao: TipoCaminhao.RODOTREM }),
      'fp1',
    );
    expect(gerarHashAntiFraude(a)).not.toBe(gerarHashAntiFraude(b));
  });

  it('retorna data URL de QRCode (base64) válida', async () => {
    const url = 'http://localhost:3001/v2/solicitacoes/x/verificar?hash=abc';
    const dataUrl = await service.gerarQRCodeDataUrl(url);
    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);
    expect(dataUrl.length).toBeGreaterThan(20);
  });

  it('renderiza HTML sem erro e inclui seções principais', async () => {
    solicitacoesV2.obterDetalheStaff.mockResolvedValue(baseDetalhe());
    const { html, hash } = await service.buildHtml('sol-1', mockReq());
    expect(html.length).toBeGreaterThan(500);
    expect(html).toContain('Comprovante Operacional');
    expect(html).toContain('RL-V2-TEST');
    expect(html).toContain('Line Set');
    expect(html).toContain('MSKU123');
    expect(html).toContain('SetPoint');
    expect(html).toContain('doc.pdf');
    expect(html).toContain('Eventos consolidados');
    expect(html).toContain('UPDATE');
    expect(html).toContain(hash);
    expect(redis.setex).toHaveBeenCalled();
  });

  it('lista auditoria e timeline coerentes no HTML', async () => {
    solicitacoesV2.obterDetalheStaff.mockResolvedValue(baseDetalhe());
    const { html } = await service.buildHtml('sol-1', mockReq());
    expect(html).toContain('Trilhas de auditoria');
    expect(html).toContain('EM_ANALISE');
    expect(html).toContain('Alerta de segurança');
  });

  it('rótulo Rodotrem aparece quando tipo é RODOTREM', async () => {
    solicitacoesV2.obterDetalheStaff.mockResolvedValue(baseDetalhe({ tipoCaminhao: TipoCaminhao.RODOTREM }));
    const { html } = await service.buildHtml('sol-1', mockReq());
    expect(html).toContain('Rodotrem');
  });

  it('PDF buffer >= 50 KB com Puppeteer mockado', async () => {
    solicitacoesV2.obterDetalheStaff.mockResolvedValue(baseDetalhe());
    const buf = await service.getPdfBuffer('sol-1', mockReq());
    expect(buf.length).toBeGreaterThanOrEqual(50 * 1024);
  });

  it('verificação: válido quando snapshot Redis bate com estado atual', async () => {
    const det = baseDetalhe();
    solicitacoesV2.obterDetalheStaff.mockResolvedValue(det);
    const fp = 'same-fp';
    const { hash } = await service.buildHtml('sol-1', mockReq(fp));
    const snap = service['buildAntifraudPayloadFromDetalhe'](det, fp);
    redis.get.mockImplementation((key: string) => {
      if (key === `v2:pdf:antifraud:sol-1:${hash}`) return JSON.stringify(snap);
      return null;
    });
    const r = await service.verificarAuthenticidade('sol-1', hash);
    expect(r.valido).toBe(true);
    expect(r.divergencias).toEqual([]);
  });

  it('verificação: inválido quando dados mudam após emissão', async () => {
    const det = baseDetalhe();
    solicitacoesV2.obterDetalheStaff.mockResolvedValueOnce(det);
    const fp = 'same-fp';
    const { hash } = await service.buildHtml('sol-1', mockReq(fp));
    const snap = service['buildAntifraudPayloadFromDetalhe'](det, fp);
    const altered = baseDetalhe({ tipoCaminhao: TipoCaminhao.RODOTREM });
    solicitacoesV2.obterDetalheStaff.mockResolvedValue(altered);
    redis.get.mockImplementation((key: string) => {
      if (key === `v2:pdf:antifraud:sol-1:${hash}`) return JSON.stringify(snap);
      return null;
    });
    const r = await service.verificarAuthenticidade('sol-1', hash);
    expect(r.valido).toBe(false);
    expect(r.divergencias.some((d) => d.campo === 'tipoCaminhao')).toBe(true);
  });
});
