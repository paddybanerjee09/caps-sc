import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { getPreferredSources, getQuestionnaire, listMeasurements } from "../data/recoveryRepository";
import { getCurrentHealthState, subscribeHealthUpdates, syncHealth } from "../health/healthService";
import type { HealthMeasurement, HealthState, PreferredSources, Questionnaire } from "./types";

type Data = { localDate: string; timezone: string; questionnaire: Questionnaire | null; measurements: HealthMeasurement[]; preferred: PreferredSources; health: HealthState | null };
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
      const [questionnaire, measurements, preferred, health] = await Promise.all([getQuestionnaire(db, localDate), listMeasurements(db), getPreferredSources(db), getCurrentHealthState(db)]);
      if (id === request.current) setData({ localDate, timezone, questionnaire, measurements, preferred, health });
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


