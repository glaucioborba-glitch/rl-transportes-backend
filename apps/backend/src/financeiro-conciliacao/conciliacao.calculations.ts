import type { ExtratoLinhaNormalizada } from './extrato-parser';

export interface BoletoConciliacaoInput {
  id: string;
  faturamentoId: string;
  numeroBoleto: string;
  valorBoleto: number;
  statusPagamento: string;
  dataVencimento: Date;
}

export interface MatchConciliacao {
  extratoLinhaId: string;
  boletoId?: string;
  faturamentoId?: string;
  motivo: string;
  score: number;
}

export interface ResultadoConciliacaoAutomatica {
  conciliados: MatchConciliacao[];
  pendentes: ExtratoLinhaNormalizada[];
  suspeitos: Array<{ linha: ExtratoLinhaNormalizada; candidatos: BoletoConciliacaoInput[]; motivo: string }>;
  divergentes: Array<{ linha: ExtratoLinhaNormalizada; boleto: BoletoConciliacaoInput; motivo: string }>;
}

const TOLERANCIA_VALOR = 0.05;

function normTxt(s: string): string {
  return s.replace(/\D/g, '');
}

function extrairDigitosHistorico(historico: string): string[] {
  const out: string[] = [];
  const re = /\d{11,47}/g;
  let m: RegExpExecArray | null;
  const h = historico;
  while ((m = re.exec(h)) !== null) {
    out.push(m[0]);
  }
  return out;
}

export function motorConciliacaoAutomatica(
  linhasExtrato: ExtratoLinhaNormalizada[],
  boletos: BoletoConciliacaoInput[],
  manualPorLinha: Map<string, { boletoId: string; faturamentoId: string }>,
): ResultadoConciliacaoAutomatica {
  const conciliados: MatchConciliacao[] = [];
  const pendentes: ExtratoLinhaNormalizada[] = [];
  const suspeitos: ResultadoConciliacaoAutomatica['suspeitos'] = [];
  const divergentes: ResultadoConciliacaoAutomatica['divergentes'] = [];

  const boletosPagos = boletos.filter((b) => b.statusPagamento.toUpperCase() === 'PAGO');
  const todosBoletos = boletos;

  const usados = new Set<string>();

  for (const linha of linhasExtrato) {
    if (linha.tipo !== 'CREDITO') {
      pendentes.push(linha);
      continue;
    }

    const manual = manualPorLinha.get(linha.idLinha);
    if (manual) {
      const b = boletos.find((x) => x.id === manual.boletoId);
      if (b) {
        const diff = Math.abs(linha.valor - b.valorBoleto);
        usados.add(b.id);
        if (diff <= TOLERANCIA_VALOR) {
          conciliados.push({
            extratoLinhaId: linha.idLinha,
            boletoId: b.id,
            faturamentoId: b.faturamentoId,
            motivo: 'Vínculo manual assistido',
            score: 100,
          });
        } else {
          divergentes.push({
            linha,
            boleto: b,
            motivo: `Valor extrato (${linha.valor}) vs boleto (${b.valorBoleto}) após vínculo manual.`,
          });
        }
      }
      continue;
    }

    const porNumero: BoletoConciliacaoInput[] = [];
    const numsHist = extrairDigitosHistorico(linha.historico);
    for (const n of numsHist) {
      for (const b of boletosPagos) {
        if (usados.has(b.id)) continue;
        const nb = normTxt(b.numeroBoleto);
        if (nb && (n.includes(nb) || nb.includes(n.slice(-Math.min(14, n.length))))) {
          porNumero.push(b);
        }
      }
    }

    const uniqPorNumero = [...new Map(porNumero.map((x) => [x.id, x])).values()];
    if (uniqPorNumero.length === 1) {
      const b = uniqPorNumero[0]!;
      const diff = Math.abs(linha.valor - b.valorBoleto);
      usados.add(b.id);
      if (diff <= TOLERANCIA_VALOR) {
        conciliados.push({
          extratoLinhaId: linha.idLinha,
          boletoId: b.id,
          faturamentoId: b.faturamentoId,
          motivo: 'Match por referência numérica no histórico + valor compatível',
          score: 92,
        });
      } else {
        divergentes.push({ linha, boleto: b, motivo: 'Referência encontrada mas valor fora da tolerância.' });
      }
      continue;
    }
    if (uniqPorNumero.length > 1) {
      suspeitos.push({
        linha,
        candidatos: uniqPorNumero,
        motivo: 'Múltiplos boletos pagos com número compatível no histórico.',
      });
      continue;
    }

    const exatos = boletosPagos.filter(
      (b) => !usados.has(b.id) && Math.abs(linha.valor - b.valorBoleto) < 1e-6,
    );
    if (exatos.length === 1) {
      const b = exatos[0]!;
      usados.add(b.id);
      conciliados.push({
        extratoLinhaId: linha.idLinha,
        boletoId: b.id,
        faturamentoId: b.faturamentoId,
        motivo: 'Match por valor exato (boleto PAGO)',
        score: 88,
      });
      continue;
    }
    if (exatos.length > 1) {
      suspeitos.push({
        linha,
        candidatos: exatos,
        motivo: 'Vários boletos pagos com mesmo valor.',
      });
      continue;
    }

    const aprox = boletosPagos.filter(
      (b) => !usados.has(b.id) && Math.abs(linha.valor - b.valorBoleto) <= TOLERANCIA_VALOR,
    );
    if (aprox.length === 1) {
      const b = aprox[0]!;
      usados.add(b.id);
      conciliados.push({
        extratoLinhaId: linha.idLinha,
        boletoId: b.id,
        faturamentoId: b.faturamentoId,
        motivo: 'Match por valor aproximado (± R$ 0,05) — possível tarifa',
        score: 72,
      });
      continue;
    }
    if (aprox.length > 1) {
      suspeitos.push({
        linha,
        candidatos: aprox,
        motivo: 'Vários candidatos na faixa de tolerância.',
      });
      continue;
    }

    const fallbackDoc = todosBoletos.filter(
      (b) =>
        !usados.has(b.id) &&
        linha.documento &&
        normTxt(linha.documento).length > 5 &&
        normTxt(b.numeroBoleto).includes(normTxt(linha.documento).slice(-12)),
    );
    if (fallbackDoc.length === 1) {
      const b = fallbackDoc[0]!;
      usados.add(b.id);
      conciliados.push({
        extratoLinhaId: linha.idLinha,
        boletoId: b.id,
        faturamentoId: b.faturamentoId,
        motivo: 'Match por documento / nosso número parcial',
        score: 65,
      });
      continue;
    }

    pendentes.push(linha);
  }

  return { conciliados, pendentes, suspeitos, divergentes };
}
