import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StatusCadastroCliente, ValidacaoDominio } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CondicaoPagamentoCadastro } from './dto/cadastro-financeiro.dto';

export type CadastroPendenteRow = {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cpfCnpj: string;
  email: string;
  validacaoDominio: ValidacaoDominio;
  statusCadastro: StatusCadastroCliente;
  createdAt: Date;
  inscricaoEstadual: string | null;
  inscricaoMunicipal: string | null;
  isentoIE: boolean;
  enderecoLogradouro: string;
  enderecoNumero: string;
  enderecoComplemento: string | null;
  enderecoBairro: string;
  enderecoCidade: string;
  enderecoUf: string;
  enderecoCep: string;
};

@Injectable()
export class CadastroFinanceiroService {
  constructor(private readonly prisma: PrismaService) {}

  async contarPendentes(): Promise<{ count: number }> {
    const count = await this.prisma.cliente.count({
      where: {
        deletedAt: null,
        statusCadastro: StatusCadastroCliente.PENDENTE_ANALISE_FINANCEIRA,
      },
    });
    return { count };
  }

  async listarPendentes(): Promise<CadastroPendenteRow[]> {
    const rows = await this.prisma.cliente.findMany({
      where: {
        deletedAt: null,
        statusCadastro: StatusCadastroCliente.PENDENTE_ANALISE_FINANCEIRA,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        razaoSocial: true,
        nomeFantasia: true,
        cpfCnpj: true,
        email: true,
        validacaoDominio: true,
        statusCadastro: true,
        createdAt: true,
        inscricaoEstadual: true,
        inscricaoMunicipal: true,
        isentoIE: true,
        enderecoLogradouro: true,
        enderecoNumero: true,
        enderecoComplemento: true,
        enderecoBairro: true,
        enderecoCidade: true,
        enderecoUf: true,
        enderecoCep: true,
      },
    });
    return rows;
  }

  async aprovar(
    clienteId: string,
    condicaoPagamento: CondicaoPagamentoCadastro,
    analistaId: string,
  ) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, deletedAt: null },
    });
    if (!cliente) throw new NotFoundException('Cliente não encontrado.');
    if (cliente.statusCadastro !== StatusCadastroCliente.PENDENTE_ANALISE_FINANCEIRA) {
      throw new BadRequestException('Cadastro não está pendente de análise financeira.');
    }

    return this.prisma.cliente.update({
      where: { id: clienteId },
      data: {
        statusCadastro: StatusCadastroCliente.APROVADO,
        condicaoPagamento,
        analisadoPor: analistaId,
        analisadoEm: new Date(),
        motivoRejeicaoCadastro: null,
      },
      select: this.selectPublico(),
    });
  }

  async rejeitar(clienteId: string, motivo: string, analistaId: string) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, deletedAt: null },
    });
    if (!cliente) throw new NotFoundException('Cliente não encontrado.');
    if (cliente.statusCadastro !== StatusCadastroCliente.PENDENTE_ANALISE_FINANCEIRA) {
      throw new BadRequestException('Cadastro não está pendente de análise financeira.');
    }

    return this.prisma.cliente.update({
      where: { id: clienteId },
      data: {
        statusCadastro: StatusCadastroCliente.REJEITADO,
        condicaoPagamento: null,
        analisadoPor: analistaId,
        analisadoEm: new Date(),
        motivoRejeicaoCadastro: motivo.trim(),
      },
      select: this.selectPublico(),
    });
  }

  async assertClientePodeOperar(clienteId: string): Promise<void> {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, deletedAt: null },
      select: { statusCadastro: true },
    });
    if (!cliente) throw new NotFoundException('Cliente não encontrado.');
    if (cliente.statusCadastro === StatusCadastroCliente.REJEITADO) {
      throw new BadRequestException('Cadastro rejeitado pela análise financeira.');
    }
    if (cliente.statusCadastro === StatusCadastroCliente.PENDENTE_ANALISE_FINANCEIRA) {
      throw new BadRequestException(
        'Cadastro pendente de análise financeira. Você pode visualizar informações, mas não criar solicitações.',
      );
    }
  }

  private selectPublico(): Prisma.ClienteSelect {
    return {
      id: true,
      razaoSocial: true,
      nomeFantasia: true,
      cpfCnpj: true,
      email: true,
      validacaoDominio: true,
      statusCadastro: true,
      condicaoPagamento: true,
      analisadoPor: true,
      analisadoEm: true,
      motivoRejeicaoCadastro: true,
      createdAt: true,
    };
  }
}
