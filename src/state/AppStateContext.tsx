import {
  useCallback,
  createContext,
  useEffect,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSQLiteContext } from "expo-sqlite";

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

type UnitSettings = {
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
    height: "metric",
    weight: "metric",
  });

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
      unitSettings,
      updateWeightLog,
      username,
    ],
  );

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
