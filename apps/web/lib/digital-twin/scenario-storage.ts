const K = "rl_twin_whatif_scenarios_v1";

export type SavedWhatIfScenario = {
  id: string;
  name: string;
  at: string;
  params: {
    aumentoDemandaPercentual?: number;
    reducaoTurnoHoras?: number;
    aumentoTurnoHoras?: number;
    expansaoQuadras?: number;
    novoClienteVolumeEstimado?: number;
    quadrasAdicionais?: number;
    slotsPorQuadraEstimado?: number;
  };
  cenario: Record<string, unknown> | null;
  expansao: Record<string, unknown> | null;
  turnos: Record<string, unknown> | null;
};

function read<T>(fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const r = localStorage.getItem(K);
    if (!r) return fallback;
    return JSON.parse(r) as T;
  } catch {
    return fallback;
  }
}

function write(v: SavedWhatIfScenario[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(K, JSON.stringify(v));
}

export function twinScenarioList(): SavedWhatIfScenario[] {
  return read<SavedWhatIfScenario[]>([]);
}

export function twinScenarioSave(row: SavedWhatIfScenario) {
  const cur = twinScenarioList().filter((x) => x.id !== row.id);
  cur.unshift(row);
  write(cur.slice(0, 12));
}

export function twinScenarioDelete(id: string) {
  write(twinScenarioList().filter((x) => x.id !== id));
}
