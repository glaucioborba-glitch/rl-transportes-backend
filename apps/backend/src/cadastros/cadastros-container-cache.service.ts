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

  async findByNumero(numeroRaw: string) {
    const numeroIso = stripContainerIsoCanonical(numeroRaw);
    const row = await this.prisma.cadastroContainerCache.findFirst({
      where: { numeroIso },
    });
    if (!row) throw new NotFoundException('Cache de contêiner não encontrado.');
    return this.toShape(row);
  }

  async ensure(dto: CadastrosContainerCacheCreateDto) {
    const numeroIso = stripContainerIsoCanonical(dto.numeroISO);
    if (!isValidIso6346(numeroIso)) {
      throw new BadRequestException('Número ISO 6346 inválido.');
    }

    const existing = await this.prisma.cadastroContainerCache.findFirst({
      where: { numeroIso },
    });
    if (existing) return this.toShape(existing);

    const created = await this.prisma.cadastroContainerCache.create({
      data: {
        numeroIso,
        tipo: dto.tipo?.trim() || null,
        tamanho: dto.tamanho?.trim() || null,
      },
    });
    return this.toShape(created);
  }

  async getHistorico(numeroRaw: string) {
    const numeroIso = stripContainerIsoCanonical(numeroRaw);
    if (!isValidIso6346(numeroIso)) {
      throw new BadRequestException('Número ISO 6346 inválido.');
    }

    let cache = await this.prisma.cadastroContainerCache.findFirst({
      where: { numeroIso },
    });

    const historico = await this.buildHistorico(numeroIso);

    if (!cache && historico.length === 0) {
      throw new NotFoundException(
        'Contêiner não encontrado no sistema. Nenhuma operação registrada para esta unidade.',
      );
    }

    if (!cache) {
      const first = historico[0];
      cache = await this.prisma.cadastroContainerCache.create({
        data: {
          numeroIso,
          tipo: first?.tipoContainer ?? null,
          tamanho: first?.tamanhoContainer ?? null,
          primeiraPassagem: first?.dataProcesso ?? new Date(),
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

  private async buildHistorico(numeroIso: string) {
    const patioRows = await this.prisma.patioUnidade.findMany({
      where: { unidadeIso: numeroIso },
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
      const gateOut = gateIn.checkOut;

      return {
        processoId: row.solicitacao.protocolo,
        solicitacaoId: row.solicitacao.id,
        tipoOperacao: 'GATE',
        dataProcesso: gateIn.dataHora.toISOString(),
        tipoContainer: container?.tipo ?? null,
        tamanhoContainer: container?.tamanho ?? null,
        entrada: {
          dataHora: gateIn.dataHora.toISOString(),
          situacao: container?.status ?? '—',
          motorista: gateIn.motoristaNome,
          placa: gateIn.placaCavalo,
          empresa: row.solicitacao.cliente?.razaoSocial ?? '—',
        },
        saida: gateOut
          ? {
              dataHora: gateOut.dataHora.toISOString(),
              situacao: container?.status ?? '—',
              motorista: gateIn.motoristaNome,
              placa: gateIn.placaCavalo,
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
