import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StatusPagamento } from '@prisma/client';
import type { DespesaEntity } from './tesouraria.domain';
import { TesourariaStoreService } from './tesouraria-store.service';
import {
  addDays,
  avaliarRiscoSaidasFinanceiras,
  expandirContratosParaPagamentos,
  expandirDespesasParaPagamentos,
  gerarSugestoes,
  resolverStatusDespesa,
  scoreConfiabilidadeFinanceira,
  somaSaidaOpexNoPeriodo,
  somaSaidaTotalNoPeriodo,
  somarPagamentosPorDia,
  somarPorMes,
  somarPorSemana,
  mesChave,
  projetarCurvasOpexCapex12Meses,
  totalSaidaNoPeriodo,
} from './tesouraria.calculations';
import type { CreateContratoDto, CreateDespesaDto, CreateFornecedorDto } from './dto/tesouraria.dto';
import type {
  AgendaPagamentosDto,
  ContratoRespostaDto,
  DashboardTesourariaDto,
  DespesaRespostaDto,
  FornecedorRespostaDto,
  ImpactoCaixaJanelaDto,
  ImpactoCaixaRespostaDto,
  SugestaoTesourariaDto,
} from './dto/tesouraria-response.dto';
import { PrismaService } from '../prisma/prisma.service';

function num(d: { toFixed: (n: number) => string } | null | undefined): number {
  if (d === null || d === undefined) return 0;
  return Number(Number(d.toFixed(2)));
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

@Injectable()
export class TesourariaService {
  constructor(
    private readonly store: TesourariaStoreService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private nomeFornecedor(id: string): string | undefined {
    return this.store.getFornecedor(id)?.nome;
  }

  private mapDespesa(d: DespesaEntity): DespesaRespostaDto {
    const statusEfetivo = resolverStatusDespesa(d.status, d.vencimento);
    return {
      id: d.id,
      fornecedor: d.fornecedor,
      categoria: d.categoria,
      descricao: d.descricao,
      valor: d.valor,
      vencimento: d.vencimento,
      status: d.status,
      statusEfetivo,
      recorrencia: d.recorrencia,
      documentoReferencia: d.documentoReferencia,
      createdAt: d.createdAt,
    };
  }

  createDespesa(dto: CreateDespesaDto): DespesaRespostaDto {
    const e = this.store.createDespesa({
      fornecedor: dto.fornecedor.trim(),
      categoria: dto.categoria,
      descricao: dto.descricao.trim(),
      valor: dto.valor,
      vencimento: dto.vencimento.slice(0, 10),
      status: dto.status ?? 'pendente',
      recorrencia: dto.recorrencia ?? 'nenhuma',
      documentoReferencia: dto.documentoReferencia?.trim(),
    });
    return this.mapDespesa(e);
  }

  listDespesas(): DespesaRespostaDto[] {
    return this.store.listDespesas().map((d) => this.mapDespesa(d));
  }

  createFornecedor(dto: CreateFornecedorDto): FornecedorRespostaDto {
    const e = this.store.createFornecedor({
      nome: dto.nome.trim(),
      cnpj: dto.cnpj.replace(/\D/g, ''),
      categoriaFornecedor: dto.categoriaFornecedor,
      contato: dto.contato.trim(),
      prazoPagamentoPadrao: dto.prazoPagamentoPadrao,
    });
    return { ...e };
  }

  listFornecedores(): FornecedorRespostaDto[] {
    return this.store.listFornecedores().map((f) => ({ ...f }));
  }

  createContrato(dto: CreateContratoDto): ContratoRespostaDto {
    const fornecedor = this.store.getFornecedor(dto.fornecedorId);
    if (!fornecedor) {
      throw new BadRequestException('fornecedorId não encontrado no cadastro em memória.');
    }
    const ini = dto.vigenciaInicio.slice(0, 10);
    const fim = dto.vigenciaFim.slice(0, 10);
    if (ini > fim) {
      throw new BadRequestException('vigenciaInicio deve ser anterior ou igual a vigenciaFim.');
    }
    const e = this.store.createContrato({
      fornecedorId: dto.fornecedorId,
      tipoContrato: dto.tipoContrato,
      valorFixo: dto.valorFixo,
      vigenciaInicio: ini,
      vigenciaFim: fim,
      reajusteAnualPct: dto.reajusteAnualPct,
      observacoes: dto.observacoes?.trim(),
    });
    return { ...e };
  }

  listContratos(): ContratoRespostaDto[] {
    return this.store.listContratos().map((c) => ({ ...c }));
  }

  getAgenda(): AgendaPagamentosDto {
    const despesas = this.store.listDespesas();
    const contratos = this.store.listContratos();
    const mapped = despesas.map((d) => this.mapDespesa(d));
    const pendentes = mapped.filter((d) => d.statusEfetivo === 'pendente');
    const atrasadas = mapped.filter((d) => d.statusEfetivo === 'atrasado');

    const hoje = startOfDay(new Date());
    const fim = addDays(hoje, 400);
    const pagamentos = [
      ...expandirDespesasParaPagamentos(despesas, hoje, fim),
      ...expandirContratosParaPagamentos(contratos, (id) => this.nomeFornecedor(id), hoje, fim),
    ];
    const porDia = somarPagamentosPorDia(pagamentos);

    return {
      despesasPendentes: pendentes,
      despesasAtrasadas: atrasadas,
      pagamentosPorDia: porDia,
      pagamentosPorSemana: somarPorSemana(porDia),
      pagamentosPorMes: somarPorMes(porDia),
    };
  }

  private custosFixosMensais(): number {
    const v = parseFloat(
      this.config.get<string>('FINANCEIRO_CUSTOS_FIXOS_MENSAL') ??
        this.config.get<string>('CUSTOS_FIXOS_MENSAL') ??
        '180000',
    );
    return Number.isFinite(v) && v >= 0 ? v : 180000;
  }

  private saldoProxy(): number {
    const v = parseFloat(this.config.get<string>('FINANCEIRO_SALDO_CONTA_PROXY') ?? '0');
    return Number.isFinite(v) ? v : 0;
  }

  private saidasComprometidasMes(): number {
    return parseFloat(this.config.get<string>('FINANCEIRO_SAIDAS_COMPROMETIDAS_MES') ?? '0') || 0;
  }

  private taxaRecuperacaoBoletos(): number {
    const v = parseFloat(this.config.get<string>('FINANCEIRO_RECUPERACAO_BOLETOS_PROXY') ?? '0.65');
    return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 0.65;
  }

  private async entradaBoletosNoPeriodo(dias: number): Promise<number> {
    const hoje = new Date();
    const iniDia = startOfDay(hoje);
    const fim = new Date(hoje);
    fim.setDate(fim.getDate() + dias);

    const boletosAbertos = await this.prisma.boleto.findMany({
      where: {
        statusPagamento: { in: [StatusPagamento.PENDENTE, StatusPagamento.VENCIDO] },
        dataVencimento: { gte: iniDia, lte: fim },
      },
      select: { valorBoleto: true },
    });

    const soma = boletosAbertos.reduce((s, b) => s + num(b.valorBoleto), 0);
    return Math.round(soma * this.taxaRecuperacaoBoletos() * 100) / 100;
  }

  private async buildImpactoJanela(dias: number): Promise<ImpactoCaixaJanelaDto> {
    const ini = startOfDay(new Date());
    const fim = addDays(ini, dias);
    const despesas = this.store.listDespesas();
    const contratos = this.store.listContratos();
    const nomeFn = (id: string) => this.nomeFornecedor(id);

    const saidaTesourariaOpex = somaSaidaOpexNoPeriodo(despesas, contratos, nomeFn, ini, fim);
    const saidaTesourariaTotal = somaSaidaTotalNoPeriodo(despesas, contratos, nomeFn, ini, fim);

    const entradaPrevistaBoletos = await this.entradaBoletosNoPeriodo(dias);
    const custosFixosProrata = Math.round(((this.custosFixosMensais() / 30) * dias + Number.EPSILON) * 100) / 100;
    const saidasComprometidasProrata =
      Math.round(this.saidasComprometidasMes() * Math.min(1, dias / 30) * 100) / 100;

    const caixaLiquidoProjetado =
      Math.round(
        (this.saldoProxy() +
          entradaPrevistaBoletos -
          custosFixosProrata -
          saidasComprometidasProrata -
          saidaTesourariaOpex) *
          100,
      ) / 100;

    return {
      janelaDias: dias,
      saidaTesourariaOpex,
      saidaTesourariaTotal,
      entradaPrevistaBoletos,
      custosFixosProrata,
      saidasComprometidasProrata,
      caixaLiquidoProjetado,
    };
  }

  async getImpactoCaixa(): Promise<ImpactoCaixaRespostaDto> {
    const [w7, w15, w30, w90] = await Promise.all([
      this.buildImpactoJanela(7),
      this.buildImpactoJanela(15),
      this.buildImpactoJanela(30),
      this.buildImpactoJanela(90),
    ]);
    return {
      impactoOpex7d: w7,
      impactoOpex15d: w15,
      impactoOpex30d: w30,
      impactoOpex90d: w90,
    };
  }

  async getDashboard(): Promise<DashboardTesourariaDto> {
    const despesas = this.store.listDespesas();
    const contratos = this.store.listContratos();

    const agora = new Date();
    const iniMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0);

    const pMes = [
      ...expandirDespesasParaPagamentos(despesas, iniMes, fimMes),
      ...expandirContratosParaPagamentos(contratos, (id) => this.nomeFornecedor(id), iniMes, fimMes),
    ];
    const totalDespesasMes = totalSaidaNoPeriodo(pMes);

    let totalDespesasPendentes = 0;
    let despesasAtrasadas = 0;
    for (const d of despesas) {
      const ef = resolverStatusDespesa(d.status, d.vencimento);
      if (ef === 'pendente') totalDespesasPendentes += 1;
      if (ef === 'atrasado') despesasAtrasadas += 1;
    }

    const hojeIso = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
    let totalContratosAtivos = 0;
    for (const c of contratos) {
      if (c.vigenciaInicio <= hojeIso && c.vigenciaFim >= hojeIso) totalContratosAtivos += 1;
    }

    const { curvaOpex12Meses, curvaCapex12Meses } = projetarCurvasOpexCapex12Meses(
      despesas,
      contratos,
      (id) => this.nomeFornecedor(id),
      agora,
    );

    const ini30 = startOfDay(agora);
    const fim30 = addDays(ini30, 30);
    const pendenteValor30 = totalSaidaNoPeriodo(
      expandirDespesasParaPagamentos(
        despesas.filter((d) => resolverStatusDespesa(d.status, d.vencimento) !== 'pago'),
        ini30,
        fim30,
      ),
    );

    const entrada30 = await this.entradaBoletosNoPeriodo(30);

    const duplicidadesKeys = new Set<string>();
    const pmf: Record<string, DespesaEntity[]> = {};
    for (const d of despesas) {
      const mk = `${mesChave(d.vencimento)}|${d.fornecedor.trim().toLowerCase()}|${d.valor}`;
      pmf[mk] = pmf[mk] ?? [];
      pmf[mk].push(d);
    }
    for (const g of Object.values(pmf)) {
      if (g.length >= 2) duplicidadesKeys.add(g.map((x) => x.id).join(','));
    }

    const risco = avaliarRiscoSaidasFinanceiras({
      totalPendenteProx30d: pendenteValor30,
      saldoProxy: this.saldoProxy(),
      entradasPrevistas30d: entrada30,
      despesasAtrasadasCount: despesasAtrasadas,
    });

    const confiabilidade = scoreConfiabilidadeFinanceira({
      totalDespesas: despesas.length,
      atrasadas: despesasAtrasadas,
      duplicidadesPotenciais: duplicidadesKeys.size,
    });

    return {
      totalDespesasMes,
      totalDespesasPendentes,
      despesasAtrasadas,
      totalContratosAtivos,
      curvaOpex12Meses,
      curvaCapex12Meses,
      riscoSaidasFinanceiras: risco,
      confiabilidadeFinanceiraSaidas: confiabilidade,
    };
  }

  async getSugestoes(): Promise<SugestaoTesourariaDto[]> {
    const despesas = this.store.listDespesas();
    const contratos = this.store.listContratos();
    const fornecedores = this.store.listFornecedores();

    const imp90 = await this.buildImpactoJanela(90);
    const estouroCaixaPotencial =
      imp90.caixaLiquidoProjetado < 0 ||
      (imp90.entradaPrevistaBoletos > 0 &&
        imp90.saidaTesourariaOpex > imp90.entradaPrevistaBoletos * 1.25);

    const raw = gerarSugestoes({
      despesas,
      contratos,
      fornecedores: fornecedores.map((f) => ({ id: f.id, nome: f.nome })),
      estouroCaixaPotencial,
    });
    return raw.map((r) => ({
      tipo: r.tipo,
      severidade: r.severidade,
      mensagem: r.mensagem,
      referencia: r.referencia,
    }));
  }
}
