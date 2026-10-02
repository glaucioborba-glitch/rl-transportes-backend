import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StatusCadastroCliente, TipoOpcaoPagamento, ValidacaoDominio } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CondicaoPagamentoService } from './condicao-pagamento.service';
import { cadastroPermiteSolicitacoes } from './cadastro-operacao-inicial';
import { PortalNotificacaoService } from '../portal-notificacoes/portal-notificacao.service';
import {
  cadastroIdAtribuido,
  listCadastroTabelasAtivas,
  toTabelaPrecoAtribuicao,
} from '../cadastros/cadastro-tabela-preco-vigente';
import {
  listCadastroTabelasTransporteAtivas,
  resolveCadastroTabelaTransportePadraoId,
} from '../cadastros/cadastro-tabela-transporte';
import {
  listCadastroTabelasServicoAtivas,
  resolveCadastroTabelaServicoPadraoId,
} from '../cadastros/cadastro-tabela-servico';
import {
  listCadastroTabelasAluguelAtivas,
  resolveCadastroTabelaAluguelPadraoId,
} from '../cadastros/cadastro-tabela-aluguel';

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
  private readonly logger = new Logger(CadastroFinanceiroService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly condicoes: CondicaoPagamentoService,
    private readonly notificacoes: PortalNotificacaoService,
  ) {}

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

  async aprovar(clienteId: string, condicaoPagamento: string, prazoPagamento: string, analistaId: string) {
    await this.condicoes.assertValorPermitido(prazoPagamento, TipoOpcaoPagamento.PRAZO);
    const formaDoPrazo = await this.condicoes.obterFormaVinculada(prazoPagamento);
    const forma = formaDoPrazo ?? condicaoPagamento;
    await this.condicoes.assertValorPermitido(forma);
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, deletedAt: null },
    });
    if (!cliente) throw new NotFoundException('Cliente não encontrado.');
    if (cliente.statusCadastro !== StatusCadastroCliente.PENDENTE_ANALISE_FINANCEIRA) {
      throw new BadRequestException('Cadastro não está pendente de análise financeira.');
    }

    const tabelaTransporteId =
      cliente.cadastroTabelaTransporteId ??
      (await resolveCadastroTabelaTransportePadraoId(this.prisma, cliente.tenantId));
    const tabelaServicoId =
      cliente.cadastroTabelaServicoId ??
      (await resolveCadastroTabelaServicoPadraoId(this.prisma, cliente.tenantId));
    const tabelaAluguelId =
      cliente.cadastroTabelaAluguelId ??
      (await resolveCadastroTabelaAluguelPadraoId(this.prisma, cliente.tenantId));

    const atualizado = await this.prisma.cliente.update({
      where: { id: clienteId },
      data: {
        statusCadastro: StatusCadastroCliente.APROVADO,
        condicaoPagamento: forma,
        prazoPagamento,
        analisadoPor: analistaId,
        analisadoEm: new Date(),
        motivoRejeicaoCadastro: null,
        ...(tabelaTransporteId && !cliente.cadastroTabelaTransporteId
          ? { cadastroTabelaTransporte: { connect: { id: tabelaTransporteId } } }
          : {}),
        ...(tabelaServicoId && !cliente.cadastroTabelaServicoId
          ? { cadastroTabelaServico: { connect: { id: tabelaServicoId } } }
          : {}),
        ...(tabelaAluguelId && !cliente.cadastroTabelaAluguelId
          ? { cadastroTabelaAluguel: { connect: { id: tabelaAluguelId } } }
          : {}),
      },
      select: this.selectPublico(),
    });
    await this.notificarSilencioso(() =>
      this.notificacoes.criarCadastroAprovado({
        clienteId,
        tenantId: cliente.tenantId,
        forma,
        prazo: prazoPagamento,
      }),
    );
    return atualizado;
  }

  async rejeitar(clienteId: string, motivo: string, analistaId: string) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, deletedAt: null },
    });
    if (!cliente) throw new NotFoundException('Cliente não encontrado.');
    if (cliente.statusCadastro !== StatusCadastroCliente.PENDENTE_ANALISE_FINANCEIRA) {
      throw new BadRequestException('Cadastro não está pendente de análise financeira.');
    }

    const atualizado = await this.prisma.cliente.update({
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
    await this.notificarSilencioso(() =>
      this.notificacoes.criarCadastroRejeitado({
        clienteId,
        tenantId: cliente.tenantId,
        motivo: motivo.trim(),
      }),
    );
    return atualizado;
  }

  async listarTabelasPrecoAtribuicao() {
    const ativas = await listCadastroTabelasAtivas(this.prisma, 'default');
    return ativas.map(toTabelaPrecoAtribuicao);
  }

  async listarTabelasTransporteAtribuicao() {
    return listCadastroTabelasTransporteAtivas(this.prisma, 'default');
  }

  async listarTabelasServicoAtribuicao() {
    return listCadastroTabelasServicoAtivas(this.prisma, 'default');
  }

  async listarTabelasAluguelAtribuicao() {
    return listCadastroTabelasAluguelAtivas(this.prisma, 'default');
  }

  async listarCondicoesClientes(busca?: string) {
    const q = busca?.trim();
    const digits = q?.replace(/\D/g, '') ?? '';
    const tabelas = await this.prisma.cadastroTabelaPreco.findMany({
      where: { tenantId: 'default', deletedAt: null },
      select: { id: true, billingTabelaPrecoId: true },
    });
    const rows = await this.prisma.cliente.findMany({
      where: {
        deletedAt: null,
        statusCadastro: StatusCadastroCliente.APROVADO,
        ...(q
          ? {
              OR: [
                { razaoSocial: { contains: q, mode: 'insensitive' } },
                { nomeFantasia: { contains: q, mode: 'insensitive' } },
                ...(digits.length >= 3 ? [{ cpfCnpj: { contains: digits } }] : []),
              ],
            }
          : {}),
      },
      orderBy: { razaoSocial: 'asc' },
      take: 200,
      select: {
        id: true,
        razaoSocial: true,
        nomeFantasia: true,
        cpfCnpj: true,
        condicaoPagamento: true,
        prazoPagamento: true,
        analisadoEm: true,
        tabelaPrecoId: true,
        cadastroTabelaTransporteId: true,
        cadastroTabelaServicoId: true,
        cadastroTabelaAluguelId: true,
        faturamentoModo: true,
        faturamentoHora: true,
      },
    });
    return rows.map((row) => ({
      ...row,
      cadastroTabelaPrecoId: cadastroIdAtribuido(tabelas, row.tabelaPrecoId),
    }));
  }

  async atualizarCondicao(
    clienteId: string,
    dto: {
      condicaoPagamento: string;
      prazoPagamento: string;
      cadastroTabelaPrecoId?: string;
      cadastroTabelaTransporteId?: string;
      cadastroTabelaServicoId?: string;
      cadastroTabelaAluguelId?: string;
      faturamentoModo?: 'MANUAL' | 'AUTOMATICO';
      faturamentoHora?: string;
    },
    analistaId: string,
  ) {
    await this.condicoes.assertValorPermitido(dto.prazoPagamento, TipoOpcaoPagamento.PRAZO);
    const formaDoPrazo = await this.condicoes.obterFormaVinculada(dto.prazoPagamento);
    const condicaoPagamento = formaDoPrazo ?? dto.condicaoPagamento;
    await this.condicoes.assertValorPermitido(condicaoPagamento);
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, deletedAt: null },
    });
    if (!cliente) throw new NotFoundException('Cliente não encontrado.');
    if (cliente.statusCadastro !== StatusCadastroCliente.APROVADO) {
      throw new BadRequestException('Só é possível alterar forma e prazo de clientes aprovados.');
    }

    const billingTabelaPrecoId = await this.resolveBillingTabelaParaAtribuicao(
      dto.cadastroTabelaPrecoId,
      cliente.tenantId,
    );
    const tabelaTransporteId = await this.resolveTabelaTransporteParaAtribuicao(
      dto.cadastroTabelaTransporteId,
      cliente.tenantId,
    );
    const tabelaServicoId = await this.resolveTabelaServicoParaAtribuicao(
      dto.cadastroTabelaServicoId,
      cliente.tenantId,
    );
    const tabelaAluguelId = await this.resolveTabelaAluguelParaAtribuicao(
      dto.cadastroTabelaAluguelId,
      cliente.tenantId,
    );

    const mudouPagamento =
      cliente.condicaoPagamento !== condicaoPagamento || cliente.prazoPagamento !== dto.prazoPagamento;
    const modo = dto.faturamentoModo ?? cliente.faturamentoModo;
    const horaRaw = (dto.faturamentoHora ?? cliente.faturamentoHora ?? '').trim();
    if (horaRaw && !/^([01]\d|2[0-3]):[0-5]\d$/.test(horaRaw)) {
      throw new BadRequestException('Informe a hora no formato HH:mm (ex.: 18:00).');
    }
    const hora = modo === 'AUTOMATICO' ? horaRaw || '18:00' : null;
    const atualizado = await this.prisma.cliente.update({
      where: { id: clienteId },
      data: {
        condicaoPagamento,
        prazoPagamento: dto.prazoPagamento,
        faturamentoModo: modo,
        faturamentoHora: hora,
        analisadoPor: analistaId,
        analisadoEm: new Date(),
        ...(billingTabelaPrecoId
          ? { tabelaPreco: { connect: { id: billingTabelaPrecoId } } }
          : {}),
        cadastroTabelaTransporte: tabelaTransporteId
          ? { connect: { id: tabelaTransporteId } }
          : { disconnect: true },
        cadastroTabelaServico: tabelaServicoId
          ? { connect: { id: tabelaServicoId } }
          : { disconnect: true },
        cadastroTabelaAluguel: tabelaAluguelId
          ? { connect: { id: tabelaAluguelId } }
          : { disconnect: true },
      },
      select: {
        id: true,
        razaoSocial: true,
        condicaoPagamento: true,
        prazoPagamento: true,
        analisadoEm: true,
        tabelaPrecoId: true,
        cadastroTabelaTransporteId: true,
        cadastroTabelaServicoId: true,
        cadastroTabelaAluguelId: true,
        faturamentoModo: true,
        faturamentoHora: true,
      },
    });
    if (mudouPagamento) {
      await this.notificarSilencioso(() =>
        this.notificacoes.criarCondicaoAlterada({
          clienteId,
          tenantId: cliente.tenantId,
          forma: condicaoPagamento,
          prazo: dto.prazoPagamento,
        }),
      );
    }
    return atualizado;
  }

  private async resolveBillingTabelaParaAtribuicao(
    cadastroTabelaPrecoId: string | undefined,
    tenantId: string,
  ): Promise<string | null> {
    const vigentes = await listCadastroTabelasAtivas(this.prisma, tenantId || 'default');
    const escolhida = cadastroTabelaPrecoId
      ? vigentes.find((t) => t.id === cadastroTabelaPrecoId)
      : vigentes.find((t) => t.padrao) ?? vigentes[0];
    if (cadastroTabelaPrecoId && !escolhida) {
      throw new BadRequestException('Tabela de preços não encontrada ou fora de vigência.');
    }
    if (!escolhida) return null;
    if (!escolhida.billingTabelaPrecoId) {
      throw new BadRequestException(
        `A tabela "${escolhida.nome}" ainda não foi sincronizada. Re-sincronize em Cadastros → Tabelas de Preços.`,
      );
    }
    if (!escolhida.ativo) {
      throw new BadRequestException('Selecione uma tabela de preços ativa.');
    }
    return escolhida.billingTabelaPrecoId;
  }

  private async resolveTabelaTransporteParaAtribuicao(
    cadastroTabelaTransporteId: string | undefined,
    tenantId: string,
  ): Promise<string | null> {
    const vigentes = await listCadastroTabelasTransporteAtivas(this.prisma, tenantId || 'default');
    const escolhida = cadastroTabelaTransporteId
      ? vigentes.find((t) => t.id === cadastroTabelaTransporteId)
      : vigentes.find((t) => t.padrao) ?? vigentes[0];
    if (cadastroTabelaTransporteId && !escolhida) {
      throw new BadRequestException('Tabela de transportes não encontrada ou fora de vigência.');
    }
    return escolhida?.id ?? null;
  }

  private async resolveTabelaServicoParaAtribuicao(
    cadastroTabelaServicoId: string | undefined,
    tenantId: string,
  ): Promise<string | null> {
    const vigentes = await listCadastroTabelasServicoAtivas(this.prisma, tenantId || 'default');
    const escolhida = cadastroTabelaServicoId
      ? vigentes.find((t) => t.id === cadastroTabelaServicoId)
      : vigentes.find((t) => t.padrao) ?? vigentes[0];
    if (cadastroTabelaServicoId && !escolhida) {
      throw new BadRequestException('Tabela de serviços não encontrada ou inativa.');
    }
    return escolhida?.id ?? null;
  }

  private async resolveTabelaAluguelParaAtribuicao(
    cadastroTabelaAluguelId: string | undefined,
    tenantId: string,
  ): Promise<string | null> {
    const vigentes = await listCadastroTabelasAluguelAtivas(this.prisma, tenantId || 'default');
    const escolhida = cadastroTabelaAluguelId
      ? vigentes.find((t) => t.id === cadastroTabelaAluguelId)
      : vigentes.find((t) => t.padrao) ?? vigentes[0];
    if (cadastroTabelaAluguelId && !escolhida) {
      throw new BadRequestException('Tabela de aluguel não encontrada ou inativa.');
    }
    return escolhida?.id ?? null;
  }

  async assertClientePodeOperar(clienteId: string): Promise<void> {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, deletedAt: null },
      select: { statusCadastro: true },
    });
    if (!cliente) throw new NotFoundException('Cliente não encontrado.');
    if (!cadastroPermiteSolicitacoes(cliente.statusCadastro)) {
      throw new BadRequestException('Cadastro rejeitado pela análise financeira.');
    }
  }

  private async notificarSilencioso(fn: () => Promise<unknown>): Promise<void> {
    try {
      await fn();
    } catch (e) {
      this.logger.warn(`Falha ao registrar notificação portal: ${e instanceof Error ? e.message : e}`);
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
