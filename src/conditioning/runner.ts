import { PREPARATION_SECONDS } from "./phases";
import type { OccurrenceInput, PhaseDefinition, PhaseType } from "./types";

export type RunnerStatus =
  | "ready"
  | "preparing"
  | "running"
  | "paused"
  | "finished"
  | "ended_early";

export type RunnerTotals = {
  pausedMs: number;
  preparationMs: number;
  prescribedRecoveryMs: number;
  workMs: number;
};

export type RunnerState = {
  completedOccurrenceIds: string[];
  lastPersistedAt: number;
  occurrenceWorkMs: Record<string, number>;
  partialOccurrenceId: string | null;
  partialWorkMs: number;
  pauseStartedAt: number | null;
  phaseAccumulatedMs: number;
  phaseDeadlineAt: number | null;
  phaseIndex: number;
  phaseRunningStartedAt: number | null;
  phaseStartedAt: number | null;
  phases: PhaseDefinition[];
  processToken: string | null;
  remainingMs: number | null;
  status: RunnerStatus;
  totals: RunnerTotals;
  uncertainInterruption: boolean;
  version: 1;
};

const emptyTotals = (): RunnerTotals => ({
  pausedMs: 0,
  preparationMs: 0,
  prescribedRecoveryMs: 0,
  workMs: 0,
});

export function createReadyRunner(phases: PhaseDefinition[], now: number): RunnerState {
  return {
    completedOccurrenceIds: [],
    lastPersistedAt: now,
    occurrenceWorkMs: {},
    partialOccurrenceId: null,
    partialWorkMs: 0,
    pauseStartedAt: null,
    phaseAccumulatedMs: 0,
    phaseDeadlineAt: null,
    phaseIndex: 0,
    phaseRunningStartedAt: null,
    phaseStartedAt: null,
    phases,
    processToken: null,
    remainingMs: null,
    status: "ready",
    totals: emptyTotals(),
    uncertainInterruption: false,
    version: 1,
  };
}

export function startRunner(state: RunnerState, now: number, processToken: string | null = null) {
  if (state.status !== "ready") {
    throw new Error("This workout has already started");
  }

  const phases = [preparationPhase(), ...state.phases.filter((phase) => phase.type !== "preparation")];
  return beginPhase(
    {
      ...state,
      completedOccurrenceIds: [],
      occurrenceWorkMs: {},
      partialOccurrenceId: null,
      partialWorkMs: 0,
      phases,
      processToken,
      totals: emptyTotals(),
      uncertainInterruption: false,
    },
    0,
    now,
  );
}

export function pauseRunner(state: RunnerState, now: number) {
  if (state.status !== "running" && state.status !== "preparing") {
    throw new Error("Only a running workout can be paused");
  }

  const phase = currentPhase(state);
  const remainingMs = phase && isTimerPhase(phase) && state.phaseDeadlineAt != null
    ? Math.max(0, state.phaseDeadlineAt - now)
    : state.remainingMs;

  return {
    ...accumulateRunning(state, now),
    pauseStartedAt: now,
    phaseDeadlineAt: null,
    phaseRunningStartedAt: null,
    remainingMs,
    status: "paused" as const,
    lastPersistedAt: now,
  };
}

export function resumeRunner(state: RunnerState, now: number) {
  if (state.status !== "paused") {
    throw new Error("The workout is not paused");
  }

  const phase = currentPhase(state);
  const pausedMs =
    state.totals.pausedMs +
    (state.pauseStartedAt == null ? 0 : Math.max(0, now - state.pauseStartedAt));
  const next: RunnerState = {
    ...state,
    lastPersistedAt: now,
    pauseStartedAt: null,
    phaseRunningStartedAt: now,
    status: phase?.type === "preparation" ? "preparing" : "running",
    totals: { ...state.totals, pausedMs },
  };

  if (phase && isTimerPhase(phase)) {
    next.phaseDeadlineAt = now + (state.remainingMs ?? 0);
    next.remainingMs = state.remainingMs;
  }

  return reconcileRunner(next, now).state;
}

export function reconcileRunner(state: RunnerState, now: number) {
  if (
    state.status === "paused" ||
    state.status === "ready" ||
    state.status === "finished" ||
    state.status === "ended_early"
  ) {
    return { cuePhaseId: null as string | null, state };
  }

  let current = state;
  let cuePhaseId: string | null = null;

  while (true) {
    const phase = currentPhase(current);
    if (!phase || !isTimerPhase(phase) || current.phaseDeadlineAt == null) {
      break;
    }
    if (now < current.phaseDeadlineAt) {
      break;
    }

    const completedAt = current.phaseDeadlineAt;
    current = finishTimerPhase(current, completedAt);
    cuePhaseId = currentPhase(current)?.id ?? current.phases.at(-1)?.id ?? phase.id;
    if (current.status === "finished") {
      break;
    }
    if (!isTimerPhase(currentPhase(current))) {
      break;
    }
  }

  if (cuePhaseId === null) {
    return { cuePhaseId, state };
  }

  return {
    cuePhaseId,
    state: { ...current, lastPersistedAt: now },
  };
}

export function completeCurrentWork(state: RunnerState, now: number) {
  const phase = currentPhase(state);
  if (!phase || phase.type !== "work" || isTimerPhase(phase)) {
    throw new Error("This phase does not wait for confirmation");
  }
  if (state.status !== "running") {
    throw new Error("Resume the workout before completing the phase");
  }

  const running = accumulateRunning(state, now);
  const workMs = running.phaseAccumulatedMs;
  const occurrenceId = phase.occurrenceId;
  const withWork: RunnerState = {
    ...running,
    completedOccurrenceIds: occurrenceId
      ? [...running.completedOccurrenceIds, occurrenceId]
      : running.completedOccurrenceIds,
    occurrenceWorkMs: occurrenceId
      ? { ...running.occurrenceWorkMs, [occurrenceId]: workMs }
      : running.occurrenceWorkMs,
    totals: { ...running.totals, workMs: running.totals.workMs + workMs },
  };
  return advance(withWork, now);
}

export function endRunnerEarly(state: RunnerState, now: number) {
  if (state.status === "finished" || state.status === "ended_early" || state.status === "ready") {
    throw new Error("This workout is not running");
  }

  const resumed = state.status === "paused" ? resumeRunner(state, now) : state;
  const phase = currentPhase(resumed);
  const running = accumulateRunning(resumed, now);
  let totals = { ...running.totals };
  let partialOccurrenceId = running.partialOccurrenceId;
  let partialWorkMs = running.partialWorkMs;
  const occurrenceWorkMs = { ...running.occurrenceWorkMs };

  if (phase?.type === "work" && phase.occurrenceId && !running.completedOccurrenceIds.includes(phase.occurrenceId)) {
    partialOccurrenceId = phase.occurrenceId;
    partialWorkMs = running.phaseAccumulatedMs;
    occurrenceWorkMs[phase.occurrenceId] = partialWorkMs;
    totals = { ...totals, workMs: totals.workMs + partialWorkMs };
  } else if (phase?.type === "preparation") {
    totals = { ...totals, preparationMs: totals.preparationMs + running.phaseAccumulatedMs };
  }

  return {
    ...running,
    lastPersistedAt: now,
    occurrenceWorkMs,
    partialOccurrenceId,
    partialWorkMs,
    phaseDeadlineAt: null,
    phaseRunningStartedAt: null,
    status: "ended_early" as const,
    totals,
  };
}

export function restoreAfterProcessTermination(state: RunnerState): RunnerState {
  if (
    state.status === "ready" ||
    state.status === "finished" ||
    state.status === "ended_early"
  ) {
    return state;
  }

  const phase = currentPhase(state);
  let pausedMs = state.totals.pausedMs;
  if (state.status === "paused" && state.pauseStartedAt != null) {
    pausedMs += Math.max(0, state.lastPersistedAt - state.pauseStartedAt);
  }

  const remainingMs =
    phase && isTimerPhase(phase)
      ? state.status === "paused"
        ? state.remainingMs
        : Math.max(0, (state.phaseDeadlineAt ?? state.lastPersistedAt) - state.lastPersistedAt)
      : state.remainingMs;

  return {
    ...state,
    pauseStartedAt: null,
    phaseDeadlineAt: null,
    phaseRunningStartedAt: null,
    remainingMs,
    status: "paused",
    totals: { ...state.totals, pausedMs },
    uncertainInterruption: true,
  };
}

export function remainingWholeSeconds(state: RunnerState, now: number) {
  const phase = currentPhase(state);
  if (!phase || !isTimerPhase(phase)) {
    return null;
  }

  const ms =
    state.status === "paused"
      ? (state.remainingMs ?? 0)
      : state.phaseDeadlineAt == null
        ? 0
        : state.phaseDeadlineAt - now;
  if (ms <= 0) {
    return 0;
  }

  return Math.ceil(ms / 1000);
}

export function projectedTotals(state: RunnerState, now: number): RunnerTotals {
  if (
    state.status !== "running" &&
    state.status !== "preparing" &&
    state.status !== "paused"
  ) {
    return state.totals;
  }

  const phase = currentPhase(state);
  if (!phase) {
    return state.totals;
  }

  const totals = { ...state.totals };
  if (isTimerPhase(phase)) {
    const prescribed = phase.durationSeconds * 1000;
    const remaining =
      state.status === "paused"
        ? (state.remainingMs ?? prescribed)
        : state.phaseDeadlineAt == null
          ? 0
          : Math.max(0, state.phaseDeadlineAt - now);
    addBucket(totals, phase.type, Math.max(0, prescribed - remaining));
    return totals;
  }

  if (phase.type === "work") {
    totals.workMs += currentRunningMs(state, now);
  }

  return totals;
}

export function occurrencesFromRunner(state: RunnerState): OccurrenceInput[] {
  return state.phases
    .filter((phase) => phase.type === "work" && phase.occurrenceId)
    .map((phase, index) => {
      const id = phase.occurrenceId ?? phase.id;
      const completed = state.completedOccurrenceIds.includes(id);
      const partial = state.partialOccurrenceId === id;
      return {
        actual: null,
        completionMethod: phase.completion,
        completionStatus: completed ? "completed" : partial ? "partial" : "pending",
        endedAt: null,
        id,
        phaseType: "work",
        position: index,
        roundIndex: phase.roundIndex,
        setIndex: phase.setIndex,
        startedAt: null,
        stationId: phase.stationId,
        target: phase.target,
        workSeconds:
          state.occurrenceWorkMs[id] == null ? null : state.occurrenceWorkMs[id] / 1000,
      };
    });
}

export function currentPhase(state: RunnerState) {
  return state.phases[state.phaseIndex] ?? null;
}

export function isTimerPhase(phase: PhaseDefinition | null) {
  return phase?.completion === "timer";
}

function preparationPhase(): PhaseDefinition {
  return {
    completion: "timer",
    durationSeconds: PREPARATION_SECONDS,
    id: "preparation",
    intervalIndex: null,
    label: "Preparation",
    occurrenceId: null,
    roundIndex: null,
    setIndex: null,
    stationId: null,
    target: null,
    type: "preparation",
  };
}

function beginPhase(state: RunnerState, index: number, at: number): RunnerState {
  const phase = state.phases[index];
  if (!phase) {
    return {
      ...state,
      lastPersistedAt: at,
      phaseDeadlineAt: null,
      phaseIndex: index,
      phaseRunningStartedAt: null,
      status: "finished",
    };
  }

  const timer = isTimerPhase(phase);
  return {
    ...state,
    lastPersistedAt: at,
    phaseAccumulatedMs: 0,
    phaseDeadlineAt: timer ? at + phase.durationSeconds * 1000 : null,
    phaseIndex: index,
    phaseRunningStartedAt: at,
    phaseStartedAt: at,
    remainingMs: timer ? phase.durationSeconds * 1000 : null,
    status: phase.type === "preparation" ? "preparing" : "running",
  };
}

function finishTimerPhase(state: RunnerState, at: number) {
  const phase = currentPhase(state);
  if (!phase) {
    return state;
  }

  const durationMs = phase.durationSeconds * 1000;
  const totals = { ...state.totals };
  addBucket(totals, phase.type, durationMs);
  const occurrenceId = phase.type === "work" ? phase.occurrenceId : null;
  const next: RunnerState = {
    ...state,
    completedOccurrenceIds: occurrenceId
      ? [...state.completedOccurrenceIds, occurrenceId]
      : state.completedOccurrenceIds,
    occurrenceWorkMs: occurrenceId
      ? { ...state.occurrenceWorkMs, [occurrenceId]: durationMs }
      : state.occurrenceWorkMs,
    phaseAccumulatedMs: 0,
    totals,
  };
  return advance(next, at);
}

function advance(state: RunnerState, at: number) {
  return beginPhase(state, state.phaseIndex + 1, at);
}

function accumulateRunning(state: RunnerState, now: number): RunnerState {
  if (state.phaseRunningStartedAt == null) {
    return state;
  }

  return {
    ...state,
    phaseAccumulatedMs: state.phaseAccumulatedMs + Math.max(0, now - state.phaseRunningStartedAt),
    phaseRunningStartedAt: null,
  };
}

function currentRunningMs(state: RunnerState, now: number) {
  const live =
    state.phaseRunningStartedAt == null
      ? 0
      : Math.max(0, now - state.phaseRunningStartedAt);
  return state.phaseAccumulatedMs + live;
}

function addBucket(totals: RunnerTotals, type: PhaseType, ms: number) {
  if (type === "preparation") {
    totals.preparationMs += ms;
  } else if (type === "work") {
    totals.workMs += ms;
  } else {
    totals.prescribedRecoveryMs += ms;
  }
}
