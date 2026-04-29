import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { NfseService } from './nfse.service';

describe('NfseService', () => {
  const staff = { role: Role.GERENTE, id: 'u1', sub: 'u1', email: 'a@a.com', permissions: [] };
  const prisma = {
    faturamento: { findUnique: jest.fn() },
    nfsEmitida: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    $transaction: jest.fn((fn: (a: object) => Promise<unknown>) => fn({})),
  };
  const auditoria = { registrar: jest.fn() };
  const ipm = {
    isConfigured: jest.fn().mockReturnValue(true),
    getPrestadorCnpj: jest.fn().mockReturnValue('27692077000126'),
    getPrestadorTom: jest.fn().mockReturnValue('8221'),
    getMunicipioIbge: jest.fn().mockReturnValue('4211306'),
    emitir: jest.fn().mockResolvedValue({
      retorno: { sucesso: true, emissao: { numeroNfse: '1' }, erros: [] },
      xmlResposta: '<nfse/>',
    }),
    cancelar: jest.fn().mockResolvedValue({
      retorno: { sucesso: true, erros: [] },
      xmlResposta: '<nfse/>',
    }),
    consultarPorCodigoAutenticidade: jest.fn().mockResolvedValue({
      retorno: { sucesso: true, emissao: { numeroNfse: '1' }, erros: [] },
      xmlResposta: '<nfse/>',
    }),
  };

  const dtoBase = {
    rps: {
      nroReciboProvisorio: '1',
      serieReciboProvisorio: 'RPS',
      dataEmissao: '22/04/2026',
      horaEmissao: '10:00:00',
    },
    servico: {
      codigoLocalPrestacao: '8221',
      codigoAtividade: '4930201',
      codigoItemListaServico: '160201',
      descritivo: 'X',
      aliquotaPercent: 2,
      situacaoTributaria: '0',
      valorTributavel: 100,
      tributaMunicipioPrestador: 'S' as const,
      tributaMunicipioTomador: 'N' as const,
    },
    tomador: {
      tipo: 'J' as const,
      cpfcnpj: '12345678901234',
      nomeRazaoSocial: 'X',
      sobrenomeNomeFantasia: 'X',
      numeroResidencia: '1',
      pais: 'Brasil',
      siglaPais: 'BR',
      codigoIbgePais: '1058',
      estado: 'SC',
      cidadeTom: '8221',
      logradouro: 'Rua',
      bairro: 'B',
      cep: '88300000',
      email: 'a@a.com',
    },
  };

  it('falha com 503 se IPM sem senha', async () => {
    ipm.isConfigured.mockReturnValueOnce(false);
    const s = new NfseService(prisma as never, auditoria as never, ipm as never);
    await expect(
      s.emitirNfse('f1', dtoBase as never, 'u1', staff, '0.0.0.0', 'test'),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('falha com 400 se provedor rejeita', async () => {
    ipm.isConfigured.mockReturnValue(true);
    ipm.emitir.mockResolvedValueOnce({
      retorno: { sucesso: false, emissao: undefined, erros: ['[00999] Erro teste'] },
      xmlResposta: 'x',
    });
    (prisma.faturamento.findUnique as jest.Mock).mockResolvedValue({
      id: 'f1',
      valorTotal: 100,
      nfsEmitidas: [],
    });
    const s = new NfseService(prisma as never, auditoria as never, ipm as never);
    await expect(
      s.emitirNfse('f1', dtoBase as never, 'u1', staff, '0.0.0.0', 'test'),
    ).rejects.toThrow(BadRequestException);
  });

  it('cancelamento com análise pendente no município retorna pendente_analise e grava status', async () => {
    const prismaCancel = {
      faturamento: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'f1',
          nfsEmitidas: [{ id: 'n1', numeroNfe: '42', statusIpm: 'ACEITO' }],
        }),
      },
      $transaction: jest.fn((fn: (tx: object) => Promise<unknown>) =>
        fn({
          nfsEmitida: {
            findUnique: jest.fn().mockResolvedValue({ id: 'n1', statusIpm: 'ACEITO' }),
            update: jest.fn().mockResolvedValue({ id: 'n1', statusIpm: 'PENDENTE_CANCEL' }),
          },
          faturamento: {
            findUnique: jest.fn().mockResolvedValue({ id: 'f1', statusNfe: 'emitida' }),
          },
        }),
      ),
    };
    const ipmCancel = {
      ...ipm,
      cancelar: jest.fn().mockResolvedValue({
        retorno: { sucesso: false, cancelamentoSituacao: 'pendente', erros: [] },
        xmlResposta: '<nfse/>',
      }),
    };
    const s = new NfseService(prismaCancel as never, auditoria as never, ipmCancel as never);
    const r = await s.cancelarNfse(
      'f1',
      { motivo: 'Teste homologação' } as never,
      'u1',
      staff,
      '127.0.0.1',
      'jest',
    );
    expect(r).toEqual(expect.objectContaining({ situacao: 'pendente_analise' }));
    expect(auditoria.registrar).toHaveBeenCalled();
  });
});
