import { ContainerEventType } from '@prisma/client';

/** Estado derivado do replay de eventos (FSM). */
export enum ContainerLifecycleState {
  NONE = 'NONE',
  SCHEDULED = 'SCHEDULED',
  GATE_IN_OCR_FAILED = 'GATE_IN_OCR_FAILED',
  IN_YARD = 'IN_YARD',
  YARD_ALLOCATED = 'YARD_ALLOCATED',
  REEFER_ACTIVE = 'REEFER_ACTIVE',
  REPAIR_PENDING = 'REPAIR_PENDING',
  DISPATCHED = 'DISPATCHED',
}

export type ContainerEventRow = {
  eventType: ContainerEventType;
  payload: unknown;
  createdAt: Date;
};

/** Mapa de transições permitidas: evento → estados de origem aceitos. */
export const FSM_TRANSITIONS: Record<
  ContainerEventType,
  { from: ContainerLifecycleState[]; to: ContainerLifecycleState }
> = {
  [ContainerEventType.SCHEDULED]: {
    from: [ContainerLifecycleState.NONE],
    to: ContainerLifecycleState.SCHEDULED,
  },
  [ContainerEventType.GATE_IN_OCR_FAILED]: {
    from: [ContainerLifecycleState.SCHEDULED, ContainerLifecycleState.GATE_IN_OCR_FAILED],
    to: ContainerLifecycleState.GATE_IN_OCR_FAILED,
  },
  [ContainerEventType.GATE_IN_COMPLETED]: {
    from: [ContainerLifecycleState.SCHEDULED, ContainerLifecycleState.GATE_IN_OCR_FAILED],
    to: ContainerLifecycleState.IN_YARD,
  },
  [ContainerEventType.YARD_ALLOCATED]: {
    from: [ContainerLifecycleState.IN_YARD, ContainerLifecycleState.YARD_ALLOCATED, ContainerLifecycleState.REEFER_ACTIVE],
    to: ContainerLifecycleState.YARD_ALLOCATED,
  },
  [ContainerEventType.PRE_MOUNTING_DONE]: {
    from: [ContainerLifecycleState.IN_YARD, ContainerLifecycleState.YARD_ALLOCATED],
    to: ContainerLifecycleState.YARD_ALLOCATED,
  },
  [ContainerEventType.REEFER_PLUGGED]: {
    from: [ContainerLifecycleState.IN_YARD, ContainerLifecycleState.YARD_ALLOCATED],
    to: ContainerLifecycleState.REEFER_ACTIVE,
  },
  [ContainerEventType.REEFER_TEMP_LOGGED]: {
    from: [
      ContainerLifecycleState.REEFER_ACTIVE,
      ContainerLifecycleState.YARD_ALLOCATED,
      ContainerLifecycleState.IN_YARD,
      ContainerLifecycleState.REPAIR_PENDING,
    ],
    to: ContainerLifecycleState.REEFER_ACTIVE,
  },
  [ContainerEventType.REPAIR_REQUESTED]: {
    from: [
      ContainerLifecycleState.IN_YARD,
      ContainerLifecycleState.YARD_ALLOCATED,
      ContainerLifecycleState.REEFER_ACTIVE,
    ],
    to: ContainerLifecycleState.REPAIR_PENDING,
  },
  [ContainerEventType.REPAIR_APPROVED]: {
    from: [ContainerLifecycleState.REPAIR_PENDING],
    to: ContainerLifecycleState.YARD_ALLOCATED,
  },
  [ContainerEventType.GATE_OUT_COMPLETED]: {
    from: [
      ContainerLifecycleState.IN_YARD,
      ContainerLifecycleState.YARD_ALLOCATED,
      ContainerLifecycleState.REEFER_ACTIVE,
    ],
    to: ContainerLifecycleState.DISPATCHED,
  },
};

export function deriveStateFromEvents(events: ContainerEventRow[]): ContainerLifecycleState {
  let state = ContainerLifecycleState.NONE;
  for (const ev of events) {
    const rule = FSM_TRANSITIONS[ev.eventType];
    if (!rule) continue;
    if (rule.from.includes(state)) {
      state = rule.to;
    }
  }
  return state;
}
