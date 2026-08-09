import {
  useCallback,
  createContext,
  useEffect,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSQLiteContext } from "expo-sqlite";

import {
  getDistanceUnit,
  saveDistanceUnit,
} from "../data/athletePreferencesRepository";
import {
  addWeightLog,
  deleteWeightLog as deleteStoredWeightLog,
  getLatestWeightKg,
  updateWeightLog as updateStoredWeightLog,
} from "../data/timelineRepository";

export type CombatSport =
  | "Muay Thai"
  | "Kickboxing"
  | "Boxing"
  | "MMA"
  | "BJJ (Gi)"
  | "BJJ (No-Gi)"
  | "Judo"
  | "Wrestling"
  | "Jiu-Jitsu"
  | "Karate";

export type AthleteProfile = {
  firstName: string;
  lastName: string;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  sports: CombatSport[];
};

export type UnitSystem = "metric" | "imperial";

export type UnitSettings = {
  distance: UnitSystem;
  height: UnitSystem;
  weight: UnitSystem;
};

type AppStateContextValue = {
  athleteProfile: AthleteProfile;
  deleteWeightLog: (timelineEntryId: number) => Promise<void>;
  logWeight: (weightKg: number, loggedAt?: number) => Promise<void>;
  setAthleteProfile: (profile: AthleteProfile) => void;
  username: string;
  setUsername: (username: string) => void;
  unitSettings: UnitSettings;
  setDistanceUnit: (unit: UnitSystem) => Promise<void>;
  setHeightUnit: (unit: UnitSystem) => void;
  setWeightUnit: (unit: UnitSystem) => void;
  updateWeightLog: (
    timelineEntryId: number,
    weightKg: number,
    loggedAt: number,
  ) => Promise<void>;
};

const defaultAthleteProfile: AthleteProfile = {
  firstName: "",
  lastName: "",
  age: 17,
  heightCm: 175,
  weightKg: null,
  sports: ["Muay Thai"],
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

type AppStateProviderProps = {
  children: ReactNode;
};

export function AppStateProvider({ children }: AppStateProviderProps) {
  const db = useSQLiteContext();
  const [athleteProfile, setAthleteProfile] = useState(defaultAthleteProfile);
  const [username, setUsername] = useState("Paddy");
  const [unitSettings, setUnitSettings] = useState<UnitSettings>({
    distance: "metric",
    height: "metric",
    weight: "metric",
  });
  const [distanceUnitHydrated, setDistanceUnitHydrated] = useState(false);
  const distanceUnitWriteQueue = useRef<Promise<void>>(Promise.resolve());
  const distanceUnitWriteRequestId = useRef(0);

  const refreshLatestWeight = useCallback(async () => {
    const latestWeightKg = await getLatestWeightKg(db);

    setAthleteProfile((current) => ({
      ...current,
      weightKg: latestWeightKg,
    }));
  }, [db]);

  useEffect(() => {
    void refreshLatestWeight();
  }, [refreshLatestWeight]);

  useEffect(() => {
    let isActive = true;
    setDistanceUnitHydrated(false);

    void getDistanceUnit(db)
      .then((distance) => {
        if (isActive) {
          setUnitSettings((current) => ({ ...current, distance }));
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (isActive) {
          setDistanceUnitHydrated(true);
        }
      });

    return () => {
      isActive = false;
    };
  }, [db]);

  const setDistanceUnit = useCallback(
    async (unit: UnitSystem) => {
      const requestId = distanceUnitWriteRequestId.current + 1;
      distanceUnitWriteRequestId.current = requestId;
      const write = distanceUnitWriteQueue.current.then(() =>
        saveDistanceUnit(db, unit),
      );
      distanceUnitWriteQueue.current = write.catch(() => undefined);
      await write;

      if (distanceUnitWriteRequestId.current === requestId) {
        setUnitSettings((current) => ({ ...current, distance: unit }));
      }
    },
    [db],
  );

  const logWeight = useCallback(
    async (weightKg: number, loggedAt = Date.now()) => {
      await addWeightLog(db, weightKg, loggedAt);
      await refreshLatestWeight();
    },
    [db, refreshLatestWeight],
  );

  const updateWeightLog = useCallback(
    async (timelineEntryId: number, weightKg: number, loggedAt: number) => {
      await updateStoredWeightLog(db, timelineEntryId, weightKg, loggedAt);
      await refreshLatestWeight();
    },
    [db, refreshLatestWeight],
  );

  const deleteWeightLog = useCallback(
    async (timelineEntryId: number) => {
      await deleteStoredWeightLog(db, timelineEntryId);
      await refreshLatestWeight();
    },
    [db, refreshLatestWeight],
  );

  const value = useMemo(
    () => ({
      athleteProfile,
      deleteWeightLog,
      logWeight,
      setAthleteProfile,
      username,
      setUsername,
      unitSettings,
      setDistanceUnit,
      setHeightUnit: (unit: UnitSystem) =>
        setUnitSettings((current) => ({ ...current, height: unit })),
      setWeightUnit: (unit: UnitSystem) =>
        setUnitSettings((current) => ({ ...current, weight: unit })),
      updateWeightLog,
    }),
    [
      athleteProfile,
      deleteWeightLog,
      logWeight,
      setDistanceUnit,
      unitSettings,
      updateWeightLog,
      username,
    ],
  );

  if (!distanceUnitHydrated) {
    return null;
  }

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const value = useContext(AppStateContext);

  if (!value) {
    throw new Error("useAppState must be used inside AppStateProvider");
  }

  return value;
}
