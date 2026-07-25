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
  getLatestWeightKg,
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
  logWeight: (weightKg: number) => Promise<void>;
  setAthleteProfile: (profile: AthleteProfile) => void;
  username: string;
  setUsername: (username: string) => void;
  unitSettings: UnitSettings;
  setHeightUnit: (unit: UnitSystem) => void;
  setWeightUnit: (unit: UnitSystem) => void;
};

const defaultAthleteProfile: AthleteProfile = {
  firstName: "",
  lastName: "",
  age: 17,
  heightCm: 175,
  weightKg: 75,
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

  useEffect(() => {
    async function loadLatestWeight() {
      const latestWeightKg = await getLatestWeightKg(db);

      if (latestWeightKg !== null) {
        setAthleteProfile((current) => ({
          ...current,
          weightKg: latestWeightKg,
        }));
      }
    }

    void loadLatestWeight();
  }, [db]);

  const logWeight = useCallback(
    async (weightKg: number) => {
      await addWeightLog(db, weightKg);
      setAthleteProfile((current) => ({ ...current, weightKg }));
    },
    [db],
  );

  const value = useMemo(
    () => ({
      athleteProfile,
      logWeight,
      setAthleteProfile,
      username,
      setUsername,
      unitSettings,
      setHeightUnit: (unit: UnitSystem) =>
        setUnitSettings((current) => ({ ...current, height: unit })),
      setWeightUnit: (unit: UnitSystem) =>
        setUnitSettings((current) => ({ ...current, weight: unit })),
    }),
    [athleteProfile, logWeight, unitSettings, username],
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
