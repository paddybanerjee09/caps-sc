import type { SQLiteDatabase } from "expo-sqlite";
import { conditioningStimulus } from "../conditioning/stimulus";
import { FATIGUE_V1, type CompletedTraining } from "../domain/training/fatigue";
import { shiftDate } from "../recovery/dates";
import { strengthMuscleExposure } from "../strength/stimulus";
import { getConditioningSession, listConditioningOccurrences } from "./conditioningRepository";
import { getStrengthSession } from "./strengthRepository";

type Observation = { id: string; label: string; value: number; unit: string; count: number };

export async function recentTrainingExposure(db: SQLiteDatabase, day: string, asOf: number, sessions: readonly CompletedTraining[]): Promise<Observation[]> {
  const start = shiftDate(day, -FATIGUE_V1.windowDays);
  const results = new Map<string, Observation>();
  const seen = new Set<string>();
  function observe(id: string, label: string, value: number, unit: string) {
    if (!Number.isFinite(value)) return;
    const current = results.get(id) ?? { id, label, unit, value: 0, count: 0 };
    current.value += value;
    current.count++;
    results.set(id, current);
  }
  for (const summary of sessions) {
    if (summary.localDate < start || summary.localDate >= day || summary.endAt > asOf || !summary.sourceId || seen.has(summary.id)) continue;
    seen.add(summary.id);
    if (summary.modality === "strength") {
      const session = await getStrengthSession(db, summary.sourceId);
      if (session?.status !== "completed") continue;
      for (const exposure of strengthMuscleExposure(session.exercises)) if (exposure.rirLogged) {
        observe(`muscle:${exposure.muscle}`, `${exposure.muscle} · hard work sets (RIR ≤2)`, exposure.hardSets, "sets");
      }
    }
    if (summary.modality === "conditioning" && summary.sourceOwnerId) {
      const session = await getConditioningSession(db, summary.sourceOwnerId, summary.sourceId);
      if (!session || (session.status !== "completed" && session.status !== "ended_early")) continue;
      const occurrences = await listConditioningOccurrences(db, summary.sourceOwnerId, summary.sourceId);
      const result = conditioningStimulus({ ...session, sessionSeconds: summary.minutes === null ? null : summary.minutes * 60,
        continuous: session.format === "free", expectedWorkBouts: session.snapshot.phases.filter(phase => phase.type === "work").length,
        sprintProtocol: session.format === "sprint", observations: session.snapshot.conditioningObservations, occurrences, now: asOf });
      const protocol = result.protocol;
      if (protocol?.mode === "run") {
        const fastBouts = result.bouts.filter(bout => bout.effort === "sprint" || bout.effort === "sustained_hard" || bout.effort === "repeated_effort");
        const distances = fastBouts.flatMap(bout => bout.distance === null ? [] : [bout.distance]);
        if (distances.length) observe("running:logged-hard-distance", "Running distance · logged hard bouts", distances.reduce((sum, value) => sum + value, 0), "m");
      }
      if (protocol?.mode === "cycling" || protocol?.mode === "assault_bike") {
        const joules = result.bouts.flatMap(bout => bout.seconds === null || bout.watts === null ? [] : [bout.seconds * bout.watts]);
        const machineMatches = protocol.machine && protocol.source && (protocol.mode === "cycling" || protocol.technique);
        const identity = JSON.stringify(["measured-work", protocol.mode, machineMatches ? [protocol.machine, protocol.source, protocol.technique] : summary.id]);
        const label = [protocol.mode === "cycling" ? "Recorded cycling work" : "Recorded Assault Bike work", protocol.machine, protocol.technique, machineMatches ? protocol.source : summary.title].filter(Boolean).join(" · ");
        if (joules.length) observe(identity, label, joules.reduce((sum, value) => sum + value, 0) / 1000, "kJ");
      }
      const reference = protocol?.mode === "run" ? result.references?.criticalSpeed : result.references?.criticalPower;
      if (reference && result.above.value !== null) {
        const { mode, test, machine, technique, source, distanceMeters } = reference.protocol;
        const identity = JSON.stringify([mode, test, machine, technique, source, distanceMeters, reference.value, reference.testDate]);
        const label = [mode === "run" ? "Running distance above critical speed" : mode === "assault_bike" ? "Assault Bike work above critical power" : "Cycling work above critical power", machine, technique, test, source].filter(Boolean).join(" · ");
        observe(identity, label, result.above.value, result.above.unit);
      }
    }
  }
  return [...results.values()].sort((a, b) => a.label.localeCompare(b.label));
}
