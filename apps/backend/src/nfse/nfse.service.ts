import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AcaoAuditoria, Prisma, Role } from '@prisma/client';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { PRISMA_SERIALIZABLE_TX_EXTERNAL } from '../prisma/transaction-options';
import { CancelarNfseDto } from './dto/cancelar-nfse.dto';
import { EmitirNfseDto } from './dto/emitir-nfse.dto';
import { IpmNfseAdapter } from './nfse.adapter';
import type { EmissaoNfseIpmPayload } from './xml/ipm-nfse-xml.builder';
import { parseIpmNfseXmlRetorno } from './xml/ipm-nfse-xml.parser';

type IpmResultado = ReturnType<typeof parseIpmNfseXmlRetorno>;

@Injectable()
export class NfseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly ipm: IpmNfseAdapter,
  ) {}

  private isStaff(actor: AuthUser) {
    return actor.role === Role.ADMIN || actor.role === Role.GERENTE;
  }

  private validarConfig() {
    if (!this.ipm.isConfigured()) {
      throw new ServiceUnavailableException(
        'Integração NFS-e IPM não disponível. Defina NFSE_IPM_SENHA no ambiente (sem comitar).',
      );
    }
  }

  async emitirNfse(
    faturamentoId: string,
    dto: EmitirNfseDto,
    actorUserId: string,
    actor: AuthUser,
    ip: string,
    userAgent: string,
  ) {
    if (!this.isStaff(actor)) {
      throw new ForbiddenException('Apenas ADMIN e GERENTE podem emitir NFS-e.');
    }
    this.validarConfig();

    const fat = await this.prisma.faturamento.findUnique({
      where: { id: faturamentoId },
      include: { nfsEmitidas: true },
    });
    if (!fat) {
      throw new NotFoundException('Faturamento não encontrado');
    }

    const duplicata = fat.nfsEmitidas.some((n) => n.statusIpm === 'ACEITO');
    if (duplicata) {
      throw new ConflictException('Já existe NFS-e emitida (ACEITA) para este faturamento. Cancele antes de emitir outra.');
    }

    const totFat = new Prisma.Decimal(fat.valorTotal);
    const totDto = new Prisma.Decimal(dto.servico.valorTributavel);
    if (totFat.sub(totDto).abs().greaterThan(0.02)) {
      throw new BadRequestException('valorTributavel do serviço deve coincidir com o valor total do faturamento (tolerância R$ 0,02).');
    }

    const dataFato = dto.dataFato?.trim() || dto.rps.dataEmissao;
    const payload: EmissaoNfseIpmPayload = {
      identificadorArquivo: dto.identificadorArquivo,
      modoTeste: dto.modoTeste === true,
      rps: {
        nroReciboProvisorio: dto.rps.nroReciboProvisorio,
        serieReciboProvisorio: dto.rps.serieReciboProvisorio,
        dataEmissao: dto.rps.dataEmissao,
        horaEmissao: dto.rps.horaEmissao,
      },
      dataFato,
      valorTotal: totDto.toNumber(),
      observacao: dto.observacao?.trim() || '0',
      prestador: { cnpj: this.ipm.getPrestadorCnpj().replace(/\D/g, ''), cidadeTom: this.ipm.getPrestadorTom() },
      tomador: dto.tomador,
      servico: {
        codigoLocalPrestacao: dto.servico.codigoLocalPrestacao,
        codigoAtividade: dto.servico.codigoAtividade,
        codigoItemListaServico: dto.servico.codigoItemListaServico,
        descritivo: dto.servico.descritivo,
        aliquotaPercent: dto.servico.aliquotaPercent,
        situacaoTributaria: dto.servico.situacaoTributaria,
        valorTributavel: totDto.toNumber(),
        valorDeducao: dto.servico.valorDeducao,
        valorIssrf: dto.servico.valorIssrf,
        valorDescontoIncondicional: dto.servico.valorDescontoIncondicional,
        tributaMunicipioPrestador: dto.servico.tributaMunicipioPrestador,
        tributaMunicipioTomador: dto.servico.tributaMunicipioTomador,
      },
    };

    let r: { retorno: IpmResultado; xmlResposta: string };
    try {
      r = await this.ipm.emitir(payload);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha de comunicação com o emissor';
      throw new ServiceUnavailableException(`Falha ao contatar o Web Service IPM: ${msg}`);
    }

    if (!r.retorno.sucesso || !r.retorno.emissao) {
      throw new BadRequestException(r.retorno.erros.length ? r.retorno.erros.join(' | ') : 'Emissão rejeitada pelo provedor.');
    }

    const e = r.retorno.emissao;
    return this.prisma.$transaction(
      async (tx) => {
        const nfs = await tx.nfsEmitida.create({
          data: {
            faturamentoId,
            numeroNfe: e.numeroNfse,
            xmlNfe: r.xmlResposta,
            statusIpm: 'ACEITO',
            municipioIbge: this.ipm.getMunicipioIbge(),
            provedor: 'ipm-atende-navegantes',
            referenciaExterna: (e.codVerificadorAutenticidade ?? e.numeroNfse).slice(0, 255),
          },
        });
        const fatAntes = await tx.faturamento.findUnique({ where: { id: faturamentoId } });
        await this.auditoria.registrar(
          {
            tabela: 'nfs_emitidas',
            registroId: nfs.id,
            acao: AcaoAuditoria.INSERT,
            usuario: actorUserId,
            dadosDepois: { ...nfs, chave: e.chaveAcessoNfseNacional, link: e.linkNfse },
            ip,
            userAgent,
          },
          tx,
        );
        const fatDepois = await tx.faturamento.update({
          where: { id: faturamentoId },
          data: { statusNfe: 'emitida' },
        });
        await this.auditoria.registrar(
          {
            tabela: 'faturamentos',
            registroId: faturamentoId,
            acao: AcaoAuditoria.UPDATE,
            usuario: actorUserId,
            dadosAntes: { statusNfe: fatAntes?.statusNfe },
            dadosDepois: { statusNfe: fatDepois.statusNfe, nfsEmitidaId: nfs.id, nfse: e },
            ip,
            userAgent,
          },
          tx,
        );
        return {
          nfsEmitida: nfs,
          comprovante: e,
        };
      },
      PRISMA_SERIALIZABLE_TX_EXTERNAL,
    );
  }

  async cancelarNfse(
    faturamentoId: string,
    dto: CancelarNfseDto,
    actorUserId: string,
    actor: AuthUser,
    ip: string,
    userAgent: string,
  ) {
    if (!this.isStaff(actor)) {
      throw new ForbiddenException('Apenas ADMIN e GERENTE podem cancelar NFS-e.');
    }
    this.validarConfig();

    const fat = await this.prisma.faturamento.findUnique({
      where: { id: faturamentoId },
      include: { nfsEmitidas: { orderBy: { createdAt: 'desc' } } },
    });
    if (!fat) {
      throw new NotFoundException('Faturamento não encontrado');
    }

    const nfs = dto.nfsEmitidaId
      ? fat.nfsEmitidas.find((n) => n.id === dto.nfsEmitidaId)
      : fat.nfsEmitidas.find((n) => n.statusIpm === 'ACEITO');
    if (!nfs) {
      throw new NotFoundException('NFS-e emitida para cancelar não encontrada');
    }
    if (nfs.statusIpm === 'CANCELADA') {
      throw new ConflictException('NFS-e já consta cancelada no sistema.');
    }

    const serie = dto.serieNfse?.trim() || '1';
    let r: { retorno: IpmResultado; xmlResposta: string };
    try {
      r = await this.ipm.cancelar({ numeroNfse: nfs.numeroNfe, serieNfse: serie, motivo: dto.motivo });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha de comunicação com o emissor';
      throw new ServiceUnavailableException(`Falha ao contatar o Web Service IPM: ${msg}`);
    }

    if (r.retorno.cancelamentoSituacao === 'pendente') {
      return this.prisma.$transaction(
        async (tx) => {
          const nAntes = await tx.nfsEmitida.findUnique({ where: { id: nfs.id } });
          const nDepois = await tx.nfsEmitida.update({
            where: { id: nfs.id },
            data: { statusIpm: 'PENDENTE_CANCEL' },
          });
          const fatBefore = await tx.faturamento.findUnique({ where: { id: faturamentoId } });
          await this.auditoria.registrar(
            {
              tabela: 'nfs_emitidas',
              registroId: nfs.id,
              acao: AcaoAuditoria.UPDATE,
              usuario: actorUserId,
              dadosAntes: nAntes,
              dadosDepois: nDepois,
              ip,
              userAgent,
            },
            tx,
          );
          await this.auditoria.registrar(
            {
              tabela: 'faturamentos',
              registroId: faturamentoId,
              acao: AcaoAuditoria.UPDATE,
              usuario: actorUserId,
              dadosAntes: { statusNfe: fatBefore?.statusNfe },
              dadosDepois: {
                statusNfe: fatBefore?.statusNfe,
                nota: 'Cancelamento da NFS-e pendente de análise do município.',
                motivo: dto.motivo,
              },
              ip,
              userAgent,
            },
            tx,
          );
          return { situacao: 'pendente_analise' as const, detalhe: r.retorno };
        },
        PRISMA_SERIALIZABLE_TX_EXTERNAL,
      );
    }

    if (!r.retorno.sucesso) {
      throw new BadRequestException(r.retorno.erros.length ? r.retorno.erros.join(' | ') : 'Cancelamento não aceito pelo provedor.');
    }

    return this.prisma.$transaction(
      async (tx) => {
        const nAntes = await tx.nfsEmitida.findUnique({ where: { id: nfs.id } });
        const nDepois = await tx.nfsEmitida.update({
          where: { id: nfs.id },
          data: { statusIpm: 'CANCELADA', xmlNfe: r.xmlResposta },
        });
        const fatAntes = await tx.faturamento.findUnique({ where: { id: faturamentoId } });
        const fatDepois = await tx.faturamento.update({
          where: { id: faturamentoId },
          data: { statusNfe: 'cancelada' },
        });
        await this.auditoria.registrar(
          {
            tabela: 'nfs_emitidas',
            registroId: nfs.id,
            acao: AcaoAuditoria.UPDATE,
            usuario: actorUserId,
            dadosAntes: nAntes,
            dadosDepois: nDepois,
            ip,
            userAgent,
          },
          tx,
        );
        await this.auditoria.registrar(
          {
            tabela: 'faturamentos',
            registroId: faturamentoId,
            acao: AcaoAuditoria.UPDATE,
            usuario: actorUserId,
            dadosAntes: { statusNfe: fatAntes?.statusNfe },
            dadosDepois: { statusNfe: fatDepois.statusNfe, motivoCancelamento: dto.motivo },
            ip,
            userAgent,
          },
          tx,
        );
        return { situacao: 'cancelada' as const, nfsEmitida: nDepois, xmlResposta: r.xmlResposta };
      },
      PRISMA_SERIALIZABLE_TX_EXTERNAL,
    );
  }

  async consultarPorAutenticidade(
    identificador: string,
    actor: AuthUser,
    actorUserId: string,
    ip: string,
    userAgent: string,
  ) {
    if (!this.isStaff(actor)) {
      throw new ForbiddenException();
    }
    this.validarConfig();
    if (!identificador?.trim()) {
      throw new BadRequestException('Identificador (código de autenticidade) obrigatório');
    }

    const local = await this.prisma.nfsEmitida.findFirst({
      where: { referenciaExterna: identificador.trim() },
    });

    let r: { retorno: IpmResultado; xmlResposta: string };
    try {
      r = await this.ipm.consultarPorCodigoAutenticidade(identificador.trim());
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha de comunicação com o emissor';
      throw new ServiceUnavailableException(`Falha ao contatar o Web Service IPM: ${msg}`);
    }

    if (!r.retorno.sucesso) {
      throw new BadRequestException(r.retorno.erros.join(' | '));
    }

    if (local) {
      await this.auditoria.registrar({
        tabela: 'nfs_emitidas',
        registroId: local.id,
        acao: AcaoAuditoria.UPDATE,
        usuario: actorUserId,
        dadosAntes: { xmlResumo: 'consulta' },
        dadosDepois: { nota: 'Sincronizado via IPM' },
        ip,
        userAgent,
      });
      const situacaoDesc = r.retorno.emissao?.situacaoDescricao;
      if (situacaoDesc === 'Cancelada' && local.statusIpm === 'ACEITO') {
        await this.prisma.$transaction(
          async (tx) => {
            await tx.nfsEmitida.update({ where: { id: local.id }, data: { statusIpm: 'CANCELADA', xmlNfe: r.xmlResposta } });
            await tx.faturamento.update({ where: { id: local.faturamentoId }, data: { statusNfe: 'cancelada' } });
          },
          PRISMA_SERIALIZABLE_TX_EXTERNAL,
        );
      }
    }

    return { retorno: r.retorno.emissao, xmlResposta: r.xmlResposta, registroLocal: local };
  }
}
