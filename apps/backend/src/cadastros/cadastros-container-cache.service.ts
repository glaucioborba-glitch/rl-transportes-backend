import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { stripContainerIsoCanonical } from '../common/utils/data-sanitize';
import { isValidIso6346 } from '../common/utils/iso6346';
import { PrismaService } from '../prisma/prisma.service';
import { CadastrosContainerCacheCreateDto } from './dto/cadastros-tipo-container-form.dto';

function formatIsoDisplay(iso: string): string {
  if (iso.length !== 11) return iso;
  return `${iso.slice(0, 4)} ${iso.slice(4, 10)}-${iso.slice(10)}`;
}

@Injectable()
export class CadastrosContainerCacheService {
  constructor(private readonly prisma: PrismaService) {}

  async findByNumero(numeroRaw: string, tenantId = 'default') {
    const numeroIso = stripContainerIsoCanonical(numeroRaw);
    const row = await this.prisma.cadastroContainerCache.findFirst({
      where: { numeroIso, tenantId },
    });
    if (!row) throw new NotFoundException('Cache de contêiner não encontrado.');
    return this.toShape(row);
  }

  async ensure(dto: CadastrosContainerCacheCreateDto, tenantId = 'default') {
    const numeroIso = stripContainerIsoCanonical(dto.numeroISO);
    if (!isValidIso6346(numeroIso)) {
      throw new BadRequestException('Número ISO 6346 inválido.');
    }

    const existing = await this.prisma.cadastroContainerCache.findFirst({
      where: { numeroIso, tenantId },
    });
    if (existing) return this.toShape(existing);

    const created = await this.prisma.cadastroContainerCache.create({
      data: {
        tenantId,
        numeroIso,
        tipo: dto.tipo?.trim() || null,
        tamanho: dto.tamanho?.trim() || null,
      },
    });
    return this.toShape(created);
  }

  async getHistorico(numeroRaw: string, tenantId = 'default') {
    const numeroIso = stripContainerIsoCanonical(numeroRaw);
    if (!isValidIso6346(numeroIso)) {
      throw new BadRequestException('Número ISO 6346 inválido.');
    }

    let cache = await this.prisma.cadastroContainerCache.findFirst({
      where: { numeroIso, tenantId },
    });

    const historico = await this.buildHistorico(numeroIso, tenantId);

    if (!cache && historico.length === 0) {
      throw new NotFoundException(
        'Contêiner não encontrado no sistema. Nenhuma operação registrada para esta unidade.',
      );
    }

    if (!cache) {
      const first = historico[0];
      cache = await this.prisma.cadastroContainerCache.create({
        data: {
          tenantId,
          numeroIso,
          tipo: first?.tipoContainer ?? null,
          tamanho: first?.tamanhoContainer ?? null,
          primeiraPassagem: first?.dataProcesso ? new Date(first.dataProcesso) : new Date(),
        },
      });
    }

    return {
      numeroISO: cache.numeroIso,
      numeroFormatado: formatIsoDisplay(cache.numeroIso),
      tipo: cache.tipo,
      tamanho: cache.tamanho,
      primeiraPassagem: cache.primeiraPassagem.toISOString(),
      historico,
    };
  }

  private async buildHistorico(numeroIso: string, tenantId: string) {
    const processos = await this.prisma.unidadeProcesso.findMany({
      where: { unidadeIso: numeroIso, tenantId },
      include: {
        cliente: { select: { razaoSocial: true } },
        entradaSolicitacao: {
          select: {
            id: true,
            protocolo: true,
            tipoOperacao: true,
            transporteSolicitacao: {
              select: { nomeMotorista: true, placaCavalo: true },
            },
            portaria: {
              select: { motoristaNome: true, placaVeiculo: true },
            },
            containersSolicitacao: {
              where: { unidade: { equals: numeroIso, mode: 'insensitive' } },
              take: 1,
            },
          },
        },
        saidaSolicitacao: {
          select: {
            id: true,
            protocolo: true,
            tipoOperacao: true,
            transporteSolicitacao: {
              select: { nomeMotorista: true, placaCavalo: true },
            },
            portaria: {
              select: { motoristaNome: true, placaVeiculo: true },
            },
            containersSolicitacao: {
              where: { unidade: { equals: numeroIso, mode: 'insensitive' } },
              take: 1,
            },
          },
        },
      },
      orderBy: { entradaEm: 'desc' },
    });

    if (processos.length) {
      return processos.map((row) => {
        const entradaC = row.entradaSolicitacao?.containersSolicitacao[0];
        const saidaC = row.saidaSolicitacao?.containersSolicitacao[0];
        const entradaT = row.entradaSolicitacao?.transporteSolicitacao;
        const saidaT = row.saidaSolicitacao?.transporteSolicitacao;
        return {
          processoId: `ID ${row.numero}`,
          unidadeProcessoNumero: row.numero,
          status: row.status,
          solicitacaoId: row.entradaSolicitacao?.id ?? row.id,
          tipoOperacao: row.entradaSolicitacao?.tipoOperacao ?? (row.modalidade === 'ALUGUEL' ? 'ALUGUEL' : 'ENTRADA'),
          dataProcesso: row.entradaEm.toISOString(),
          tipoContainer: entradaC?.tipo ?? saidaC?.tipo ?? null,
          tamanhoContainer: entradaC?.tamanho ?? saidaC?.tamanho ?? null,
          entrada: {
            dataHora: row.entradaEm.toISOString(),
            situacao: entradaC?.status ?? '—',
            motorista:
              entradaT?.nomeMotorista ??
              row.entradaSolicitacao?.portaria?.motoristaNome ??
              '—',
            placa:
              entradaT?.placaCavalo ??
              row.entradaSolicitacao?.portaria?.placaVeiculo ??
              '—',
            empresa: row.cliente?.razaoSocial ?? '—',
          },
          saida: row.saidaEm
            ? {
                dataHora: row.saidaEm.toISOString(),
                situacao: saidaC?.status ?? entradaC?.status ?? '—',
                motorista:
                  saidaT?.nomeMotorista ??
                  row.saidaSolicitacao?.portaria?.motoristaNome ??
                  '—',
                placa:
                  saidaT?.placaCavalo ??
                  row.saidaSolicitacao?.portaria?.placaVeiculo ??
                  '—',
              }
            : null,
        };
      });
    }

    const patioRows = await this.prisma.patioUnidade.findMany({
      where: {
        unidadeIso: numeroIso,
        solicitacao: { tenantId },
      },
      include: {
        solicitacao: {
          select: {
            id: true,
            protocolo: true,
            cliente: { select: { razaoSocial: true } },
            containersSolicitacao: {
              where: { unidade: { equals: numeroIso, mode: 'insensitive' } },
              take: 1,
            },
          },
        },
        gateIn: {
          include: {
            checkOut: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return patioRows.map((row) => {
      const container = row.solicitacao.containersSolicitacao[0];
      const gateIn = row.gateIn;
      const gateOut = gateIn?.checkOut ?? null;
      return {
        processoId: row.solicitacao.protocolo,
        solicitacaoId: row.solicitacao.id,
        tipoOperacao: 'GATE',
        dataProcesso: (gateIn?.dataHora ?? row.createdAt).toISOString(),
        tipoContainer: container?.tipo ?? null,
        tamanhoContainer: container?.tamanho ?? null,
        entrada: {
          dataHora: (gateIn?.dataHora ?? row.createdAt).toISOString(),
          situacao: container?.status ?? '—',
          motorista: gateIn?.motoristaNome ?? '—',
          placa: gateIn?.placaCavalo ?? '—',
          empresa: row.solicitacao.cliente?.razaoSocial ?? '—',
        },
        saida: gateOut
          ? {
              dataHora: gateOut.dataHora.toISOString(),
              situacao: container?.status ?? '—',
              motorista: gateIn?.motoristaNome ?? '—',
              placa: gateIn?.placaCavalo ?? '—',
            }
          : null,
      };
    });
  }

  private toShape(row: {
    id: string;
    numeroIso: string;
    tipo: string | null;
    tamanho: string | null;
    primeiraPassagem: Date;
  }) {
    return {
      id: row.id,
      numeroISO: row.numeroIso,
      numeroFormatado: formatIsoDisplay(row.numeroIso),
      tipo: row.tipo,
      tamanho: row.tamanho,
      primeiraPassagem: row.primeiraPassagem.toISOString(),
    };
  }
}
