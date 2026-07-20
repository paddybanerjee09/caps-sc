import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type CombatSport =
  | "Muay Thai"
  | "Kickboxing"
  | "Boxing"
  | "BJJ (Gi)"
  | "BJJ (No-Gi)"
  | "Judo"
  | "Wrestling"
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
  setAthleteProfile: (profile: AthleteProfile) => void;
  unitSettings: UnitSettings;
  setHeightUnit: (unit: UnitSystem) => void;
  setWeightUnit: (unit: UnitSystem) => void;
};

const defaultAthleteProfile: AthleteProfile = {
  firstName: "",
  lastName: "",
  age: null,
  heightCm: null,
  weightKg: null,
  sports: [],
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

type AppStateProviderProps = {
  children: ReactNode;
};

export function AppStateProvider({ children }: AppStateProviderProps) {
  const [athleteProfile, setAthleteProfile] = useState(defaultAthleteProfile);
  const [unitSettings, setUnitSettings] = useState<UnitSettings>({
    height: "metric",
    weight: "metric",
  });

  const value = useMemo(
    () => ({
      athleteProfile,
      setAthleteProfile,
      unitSettings,
      setHeightUnit: (unit: UnitSystem) =>
        setUnitSettings((current) => ({ ...current, height: unit })),
      setWeightUnit: (unit: UnitSystem) =>
        setUnitSettings((current) => ({ ...current, weight: unit })),
    }),
    [athleteProfile, unitSettings],
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
