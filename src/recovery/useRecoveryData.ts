import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { getPreferredSources, listMeasurements, listQuestionnaires } from "../data/recoveryRepository";
import { listCompletedTraining, listSleepTargets, listTrainingDayConfirmations, listTrainingOutputTests, recentFoodLogCount, type SleepTarget } from "../data/trainingIndexRepository";
import type { ComparableOutput, CompletedTraining, TrainingDayConfirmation } from "../domain/training/fatigue";
import { getCurrentHealthState, subscribeHealthUpdates, syncHealth } from "../health/healthService";
import type { HealthMeasurement, HealthState, PreferredSources, Questionnaire } from "./types";

type Data = { localDate: string; timezone: string; questionnaire: Questionnaire | null; questionnaires: Questionnaire[]; measurements: HealthMeasurement[];
  preferred: PreferredSources; health: HealthState | null; asOf: number; sessions: CompletedTraining[]; confirmations: TrainingDayConfirmation[];
  sleepTargets: SleepTarget[]; outputs: ComparableOutput[]; foodLogCount: number };
export function useRecoveryData(localDate: string, timezone: string, revision: number) {
  const db = useSQLiteContext();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const request = useRef(0);
  const reload = useCallback(async () => {
    const id = ++request.current;
    setLoading(true); setError(null);
    try {
      const asOf = Date.now();
      const [questionnaires, measurements, preferred, health, sessions, confirmations, sleepTargets, outputs, foodLogCount] = await Promise.all([
        listQuestionnaires(db), listMeasurements(db), getPreferredSources(db), getCurrentHealthState(db), listCompletedTraining(db, asOf),
        listTrainingDayConfirmations(db), listSleepTargets(db), listTrainingOutputTests(db, asOf), recentFoodLogCount(db, localDate, timezone, asOf),
      ]);
      const questionnaire = questionnaires.find(q => q.localDate === localDate) ?? null;
      if (id === request.current) setData({ localDate, timezone, questionnaire, questionnaires, measurements, preferred, health, asOf, sessions, confirmations, sleepTargets, outputs, foodLogCount });
    } catch { if (id === request.current) setError("Couldn’t load recovery. Retry to see today’s readings and questionnaire."); }
    finally { if (id === request.current) setLoading(false); }
  }, [db, localDate, timezone]);
  useEffect(() => {
    let cancelled = false;
    const counter = request;
    void Promise.resolve().then(() => { if (!cancelled) void reload(); });
    return () => { cancelled = true; counter.current++; };
  }, [reload, revision]);
  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    let syncing = false;
    const synchronize = async () => {
      if (syncing || disposed) return;
      syncing = true;
      try { await syncHealth(db); } catch { /* Connection state holds sync failures without erasing observations. */ }
      finally { syncing = false; if (!disposed) await reload(); }
    };
    void synchronize();
    void subscribeHealthUpdates(db, () => { void synchronize(); }).then((stop) => { if (disposed) stop(); else unsubscribe = stop; }).catch(() => undefined);
    const listener = AppState.addEventListener("change", (state) => { if (state === "active") void synchronize(); });
    return () => { disposed = true; unsubscribe?.(); listener.remove(); };
  }, [db, reload, revision]);
  return { data: data?.localDate === localDate && data.timezone === timezone ? data : null, error, loading, reload };
}


