import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  calcularLinhaColaborador,
  colaboradorAtivoNoMes,
  custoPorTurno,
  diasUteisAproximados,
  type LinhaColaboradorCalculo,
} from './folha-rh.calculations';
import { FolhaRhStoreService } from './folha-rh-store.service';
import type {
  BeneficioRhRespostaDto,
  CalculoFolhaRespostaDto,
  ColaboradorRhRespostaDto,
  CustosTurnoRespostaDto,
  DashboardFolhaRhDto,
  LinhaColaboradorCalculoDto,
  MesValorRhDto,
  PresencaRhRespostaDto,
  ProjecaoAnualRhRespostaDto,
} from './dto/folha-rh-response.dto';
import type {
  CreateBeneficioRhDto,
  CreateColaboradorRhDto,
  CreatePresencaRhDto,
} from './dto/folha-rh.dto';

function mesAtualIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function addMeses(mesIso: string, delta: number): string {
  const [y, m] = mesIso.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

@Injectable()
export class FolhaRhService {
  constructor(
    private readonly store: FolhaRhStoreService,
    private readonly config: ConfigService,
  ) {}

  private feriadosMes(): number {
    const v = parseFloat(this.config.get<string>('FOLHA_FERIADOS_NACIONAIS_MES') ?? '1');
    return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 1;
  }

  private encargosPatronaisPct(): number {
    const v = parseFloat(this.config.get<string>('FOLHA_ENCARGOS_PATRONAIS_PCT') ?? '0.28');
    return Number.isFinite(v) && v >= 0 ? v : 0.28;
  }

  private inssTeto(): number | undefined {
    const v = parseFloat(this.config.get<string>('FOLHA_INSS_TETO') ?? '');
    return Number.isFinite(v) ? v : undefined;
  }

  private previsaoAdmissoesAno(): number {
    const v = parseFloat(this.config.get<string>('FOLHA_PREVISAO_ADMISSOES_ANO') ?? '0');
    return Number.isFinite(v) && v >= 0 ? v : 0;
  }

  private turnoverProxyPct(): number {
    const v = parseFloat(this.config.get<string>('FOLHA_TURNOVER_PROXY_PCT') ?? '15');
    return Number.isFinite(v) && v >= 0 ? v : 15;
  }

  private saldoCaixaProxy(): number {
    const v = parseFloat(this.config.get<string>('FINANCEIRO_SALDO_CONTA_PROXY') ?? '0');
    return Number.isFinite(v) ? v : 0;
  }

  private operacoesSimuladorCount(): number {
    const v = parseInt(this.config.get<string>('FOLHA_SIMULADOR_OPERACOES_COUNT') ?? '4', 10);
    return Number.isFinite(v) && v >= 1 ? v : 4;
  }

  private linhasMes(mes: string): LinhaColaboradorCalculo[] {
    const fer = this.feriadosMes();
    const catalogo = this.store.listBeneficios();
    const opts = {
      feriadosMes: fer,
      encargosPatronaisPct: this.encargosPatronaisPct(),
      inssTeto: this.inssTeto(),
    };

    const linhas: LinhaColaboradorCalculo[] = [];
    for (const c of this.store.listColaboradores()) {
      if (!colaboradorAtivoNoMes(c, mes)) continue;
      const pres = this.store.presencasDoMes(c.id, mes);
      linhas.push(calcularLinhaColaborador(c, mes, pres, catalogo, opts));
    }
    return linhas;
  }

  createColaborador(dto: CreateColaboradorRhDto): ColaboradorRhRespostaDto {
    const e = this.store.createColaborador({
      nome: dto.nome.trim(),
      cpf: dto.cpf.replace(/\D/g, ''),
      cargo: dto.cargo.trim(),
      turno: dto.turno,
      salarioBase: dto.salarioBase,
      tipoContratacao: dto.tipoContratacao,
      dataAdmissao: dto.dataAdmissao,
      dataDemissao: dto.dataDemissao,
      beneficiosAtivos: dto.beneficiosAtivos ?? [],
    });
    return { ...e };
  }

  listColaboradores(): ColaboradorRhRespostaDto[] {
    return this.store.listColaboradores().map((c) => ({ ...c }));
  }

  createBeneficio(dto: CreateBeneficioRhDto): BeneficioRhRespostaDto {
    const e = this.store.createBeneficio({
      nomeBeneficio: dto.nomeBeneficio.trim(),
      valorMensal: dto.valorMensal,
      tipoBeneficio: dto.tipoBeneficio,
    });
    return { ...e };
  }

  listBeneficios(): BeneficioRhRespostaDto[] {
    return this.store.listBeneficios().map((b) => ({ ...b }));
  }

  createPresenca(dto: CreatePresencaRhDto): PresencaRhRespostaDto {
    const c = this.store.getColaborador(dto.colaboradorId);
    if (!c) throw new BadRequestException('colaboradorId não encontrado.');
    const e = this.store.createPresenca({
      colaboradorId: dto.colaboradorId,
      data: dto.data.slice(0, 10),
      horasTrabalhadas: dto.horasTrabalhadas,
      horasExtras: dto.horasExtras,
      adicionalNoturnoHoras: dto.adicionalNoturnoHoras,
      falta: dto.falta,
    });
    return { ...e };
  }

  listPresencas(): PresencaRhRespostaDto[] {
    return this.store.listPresencas().map((p) => ({ ...p }));
  }

  getCalculo(mes: string): CalculoFolhaRespostaDto {
    const linhas = this.linhasMes(mes);
    let salarioLiquidoTotal = 0;
    let custoTotalEmpresa = 0;
    let encargosTotal = 0;
    let beneficiosEmpresaTotal = 0;
    let provisoesTotal = 0;

    const porColaborador: LinhaColaboradorCalculoDto[] = linhas.map((l) => {
      salarioLiquidoTotal += l.salarioLiquido;
      custoTotalEmpresa += l.custoTotalEmpresa;
      encargosTotal += l.fgtsPatronal + l.encargosPatronaisValor;
      beneficiosEmpresaTotal += l.beneficiosEmpresa;
      provisoesTotal += l.provisaoFerias + l.provisaoDecimoTerceiro;
      return { ...l };
    });

    const round = (n: number) => Math.round(n * 100) / 100;

    return {
      mes,
      salarioLiquidoTotal: round(salarioLiquidoTotal),
      custoTotalEmpresa: round(custoTotalEmpresa),
      encargosTotal: round(encargosTotal),
      beneficiosEmpresaTotal: round(beneficiosEmpresaTotal),
      provisoesTotal: round(provisoesTotal),
      porColaborador,
    };
  }

  getCustosTurno(mes: string): CustosTurnoRespostaDto {
    const linhas = this.linhasMes(mes);
    const porTurnoBruto = custoPorTurno(linhas);
    const custoTotalTurno: CustosTurnoRespostaDto['custoTotalTurno'] = {};
    for (const [k, v] of Object.entries(porTurnoBruto)) {
      custoTotalTurno[k] = {
        custoTotal: v.custoTotal,
        headcount: v.headcount,
        custoMedio: v.custoMedio,
      };
    }

    const nOp = this.operacoesSimuladorCount();
    const custoPorOperacao: Record<string, number> = {};
    const impactoProdutividade: Record<string, number> = {};

    let somaMedios = 0;
    let ct = 0;
    for (const v of Object.values(porTurnoBruto)) {
      somaMedios += v.custoMedio * v.headcount;
      ct += v.headcount;
    }
    const mediaGlobal = ct > 0 ? somaMedios / ct : 0;

    for (const [turno, v] of Object.entries(porTurnoBruto)) {
      const parcela = v.headcount > 0 ? v.custoTotal / nOp : 0;
      for (let i = 1; i <= nOp; i++) {
        custoPorOperacao[`${turno}_OP${i}`] = Math.round(parcela * 100) / 100;
      }
      const ratio = mediaGlobal > 0 ? mediaGlobal / (v.custoMedio || mediaGlobal || 1) : 1;
      impactoProdutividade[turno] = Math.round(Math.min(100, Math.max(0, ratio * 50)) * 100) / 100;
    }

    return {
      mes,
      custoTotalTurno,
      custoPorOperacao,
      impactoProdutividade,
    };
  }

  getProjecaoAnual(): ProjecaoAnualRhRespostaDto {
    const inicio = mesAtualIso();
    const custoFolha12Meses: MesValorRhDto[] = [];
    const custoBeneficios12Meses: MesValorRhDto[] = [];
    const custoProvisoes12Meses: MesValorRhDto[] = [];

    let somaAnual = 0;
    for (let i = 0; i < 12; i++) {
      const mes = addMeses(inicio, i);
      const calc = this.getCalculo(mes);
      custoFolha12Meses.push({ mes, valor: calc.custoTotalEmpresa });
      custoBeneficios12Meses.push({ mes, valor: calc.beneficiosEmpresaTotal });
      custoProvisoes12Meses.push({ mes, valor: calc.provisoesTotal });
      somaAnual += calc.custoTotalEmpresa;
    }

    const prevCont = this.previsaoAdmissoesAno();
    const calcRef = this.getCalculo(inicio);
    const hc = calcRef.porColaborador.length || 1;
    const custoMedio = calcRef.custoTotalEmpresa / hc;
    const extraAnualPorContratacao = prevCont * custoMedio;

    const impactoFuturoCaixaEstimado =
      Math.round((this.saldoCaixaProxy() - somaAnual - extraAnualPorContratacao) * 100) / 100;

    return {
      custoFolha12Meses,
      custoBeneficios12Meses,
      custoProvisoes12Meses,
      previsaoContratacoes: prevCont,
      impactoFuturoCaixaEstimado,
    };
  }

  headcountAtivo(): number {
    const mes = mesAtualIso();
    return this.store.listColaboradores().filter((c) => colaboradorAtivoNoMes(c, mes)).length;
  }

  getDashboard(): DashboardFolhaRhDto {
    const mes = mesAtualIso();
    const calc = this.getCalculo(mes);
    const hc = this.headcountAtivo();
    const custoMedioPorColaborador =
      hc > 0 ? Math.round((calc.custoTotalEmpresa / hc) * 100) / 100 : 0;

    const fer = this.feriadosMes();
    const du = diasUteisAproximados(mes, fer) * Math.max(1, hc);
    let faltas = 0;
    for (const c of this.store.listColaboradores()) {
      if (!colaboradorAtivoNoMes(c, mes)) continue;
      for (const p of this.store.presencasDoMes(c.id, mes)) {
        if (p.falta) faltas += 1;
      }
    }
    const absentismoPct = du > 0 ? Math.round((faltas / du) * 10000) / 100 : 0;

    const linhas = this.linhasMes(mes);
    const ctMap = custoPorTurno(linhas);
    let somaMed = 0;
    let cnt = 0;
    for (const v of Object.values(ctMap)) {
      somaMed += v.custoMedio * v.headcount;
      cnt += v.headcount;
    }
    const med = cnt > 0 ? somaMed / cnt : 0;
    const eficienciaPorTurno: Record<string, number> = {};
    for (const [t, v] of Object.entries(ctMap)) {
      const eff =
        med > 0 ? Math.min(100, Math.round((med / (v.custoMedio || med)) * 50 * 100) / 100) : 50;
      eficienciaPorTurno[t] = eff;
    }

    return {
      headcountAtivo: hc,
      custoMedioPorColaborador,
      totalFolhaMes: calc.custoTotalEmpresa,
      totalEncargos: calc.encargosTotal,
      absentismoPct,
      turnoverProxyPct: this.turnoverProxyPct(),
      eficienciaPorTurno,
    };
  }
}
