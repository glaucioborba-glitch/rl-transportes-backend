import type { SdtStrategicBundle } from "@/lib/sdt/use-sdt-strategic";
import { buildCenarioQuery } from "@/lib/digital-twin/cenario-qs";

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function answerDirectorQuestion(
  q: string,
  bundle: SdtStrategicBundle | null,
  lastCenario: Record<string, unknown> | null,
): { headline: string; body: string; qsHint: string } {
  const t = norm(q);
  const cap = bundle?.cap as { fatorSaturacaoPct?: number } | undefined;
  const sat = Number(cap?.fatorSaturacaoPct ?? 0);
  const ce = lastCenario as { saturacaoPrevistaPct?: number } | undefined;
  const ex = bundle?.expansao as { slotsAdicionaisEstimados?: number; paybackMesesProxy?: number; roiPercentualProxy?: number } | undefined;
  const fin = bundle?.fin?.rentabilidade as { proxyMargemOperacional?: number | null } | undefined;
  const rawM = Number(fin?.proxyMargemOperacional ?? NaN);
  const margem = Number.isFinite(rawM) ? (rawM <= 1 && rawM > 0 ? rawM * 100 : rawM) : null;

  let headline = "Leitura integrada";
  let body = `Pátio hoje ~${sat.toFixed(0)}%. `;
  let qsHint = buildCenarioQuery({ aumentoDemandaPercentual: 10 });

  if (/30%|trinta|demanda/.test(t)) {
    headline = "Cenário: demanda +30%";
    body = `Com saturação atual ${sat.toFixed(0)}%, um choque de demanda exige validar expansão e turnos. Payback expansão (proxy): ${ex?.paybackMesesProxy ?? "n/d"} meses.`;
    qsHint = buildCenarioQuery({ aumentoDemandaPercentual: 30 });
  } else if (/gate\s*2|fechar.*gate/.test(t)) {
    headline = "E se fechar um gate?";
    body = "Simulação local: reduz capacidade efetiva — priorize cenário com aumento de turno ou desvio de fluxo antes de fechar doca.";
    qsHint = buildCenarioQuery({ reducaoTurnoHoras: 2 });
  } else if (/expand|quadra/.test(t)) {
    headline = "Expansão física";
    body = `Slots adicionais estimados (API): ${ex?.slotsAdicionaisEstimados ?? "n/d"}. ROI proxy: ${ex?.roiPercentualProxy != null ? `${Number(ex.roiPercentualProxy).toFixed(1)}%` : "n/d"}.`;
    qsHint = buildCenarioQuery({ expansaoQuadras: 1 });
  } else if (/noturno|turno.*noite|reduz.*turno/.test(t)) {
    headline = "Turno noturno";
    body = "Reduzir turno noturno comprime throughput — combine com projeção de saturação no simulador de cenário.";
    qsHint = buildCenarioQuery({ reducaoTurnoHoras: 3 });
  }

  if (ce?.saturacaoPrevistaPct != null) {
    body += ` Última projeção carregada: ~${ce.saturacaoPrevistaPct.toFixed(0)}% sat.`;
  }
  if (margem != null) {
    body += ` Margem proxy financeira ~${margem.toFixed(1)}%.`;
  }

  return { headline, body, qsHint };
}

export type ScenarioProfile = { label: string; demanda: number; expansao: number; turnoExtra: number };

export const SDT_ABC_SCENARIOS: ScenarioProfile[] = [
  { label: "A · Conservador", demanda: 5, expansao: 0, turnoExtra: 0 },
  { label: "B · Moderado", demanda: 15, expansao: 1, turnoExtra: 1 },
  { label: "C · Agressivo", demanda: 28, expansao: 2, turnoExtra: 2 },
];

export function buildScenarioQueryForProfile(p: ScenarioProfile): string {
  return buildCenarioQuery({
    aumentoDemandaPercentual: p.demanda,
    expansaoQuadras: p.expansao,
    aumentoTurnoHoras: p.turnoExtra,
  });
}
