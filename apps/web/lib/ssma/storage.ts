import type { ActionPlanRow, ChecklistItem, IncidentRecord, Investigation5w2h, IshikawaBranches, PtwRecord, TimelineStep } from "./types";

const K = {
  incidents: "rl_ssma_incidents_v1",
  investigation5w2h: "rl_ssma_inv_5w2h_v1",
  ishikawa: "rl_ssma_ishikawa_v1",
  timeline: "rl_ssma_timeline_v1",
  ptw: "rl_ssma_ptw_v1",
  checklist: "rl_ssma_checklist_v1",
  rca: "rl_ssma_rca_v1",
  maturity: "rl_ssma_maturity_v1",
  actions: "rl_ssma_actions_v1",
  epi: "rl_ssma_epi_v1",
  nrMock: "rl_ssma_nr_mock_v1",
} as const;

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export const ssmaStorage = {
  incidents: {
    list: (): IncidentRecord[] => read(K.incidents, []),
    saveAll: (rows: IncidentRecord[]) => write(K.incidents, rows),
    add: (row: IncidentRecord) => {
      const all = read<IncidentRecord[]>(K.incidents, []);
      all.unshift(row);
      write(K.incidents, all);
    },
  },
  investigation: {
    get5w2h: (): Investigation5w2h =>
      read(K.investigation5w2h, { what: "", who: "", where: "", when: "", why: "", how: "", howMuch: "" }),
    set5w2h: (v: Investigation5w2h) => write(K.investigation5w2h, v),
    getIshikawa: (): IshikawaBranches =>
      read(K.ishikawa, {
        metodo: "",
        maquina: "",
        material: "",
        maoObra: "",
        meioAmbiente: "",
        medicao: "",
      }),
    setIshikawa: (v: IshikawaBranches) => write(K.ishikawa, v),
    getTimeline: (): TimelineStep[] => read(K.timeline, []),
    setTimeline: (v: TimelineStep[]) => write(K.timeline, v),
  },
  ptw: {
    list: (): PtwRecord[] => read(K.ptw, []),
    saveAll: (rows: PtwRecord[]) => write(K.ptw, rows),
  },
  checklist: {
    get: (): ChecklistItem[] => read(K.checklist, []),
    set: (v: ChecklistItem[]) => write(K.checklist, v),
  },
  rca: {
    getFiveWhys: (): string[] => read(K.rca, ["", "", "", "", ""]),
    setFiveWhys: (v: string[]) => write(K.rca, v),
  },
  maturity: {
    getScores: (): Record<string, number> =>
      read(K.maturity, {
        disciplina: 3,
        procedimentos: 3,
        reportabilidade: 3,
        proatividade: 3,
        consistencia: 3,
      }),
    setScores: (v: Record<string, number>) => write(K.maturity, v),
  },
  actions: {
    list: (): ActionPlanRow[] => read(K.actions, []),
    set: (v: ActionPlanRow[]) => write(K.actions, v),
  },
  epi: {
    get: (): unknown => read(K.epi, null),
    set: (v: unknown) => write(K.epi, v),
  },
  nrMock: {
    get: (): unknown => read(K.nrMock, null),
    set: (v: unknown) => write(K.nrMock, v),
  },
};
