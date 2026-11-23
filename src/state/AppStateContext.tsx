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
  addWeightLog,
  deleteWeightLog as deleteStoredWeightLog,
  getLatestWeightKg,
  updateWeightLog as updateStoredWeightLog,
} from "../data/timelineRepository";
import { setSensoryPreferences } from "../utils/feedback";
import { loadAthleteProfile, storeAthleteProfile, type AthleteProfilePatch } from "../data/athleteProfileStorage";
import { isValidBirthDate } from "../utils/biometrics";

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
  dateOfBirth: string | null;
  sex: "Male" | "Female" | null;
  heightCm: number | null;
  weightKg: number | null;
  sports: CombatSport[];
};

export type UnitSystem = "metric" | "imperial";

type UnitSettings = {
  distance: UnitSystem;
  height: UnitSystem;
  weight: UnitSystem;
};

type AppStateContextValue = {
  athleteProfile: AthleteProfile;
  audioCuesEnabled: boolean;
  setAudioCuesEnabled: (enabled: boolean) => void;
  hapticsEnabled: boolean;
  setHapticsEnabled: (enabled: boolean) => void;
  deleteWeightLog: (timelineEntryId: number) => Promise<void>;
  logWeight: (weightKg: number, loggedAt?: number) => Promise<void>;
  updateAthleteProfile: (patch: AthleteProfilePatch) => Promise<void>;
  profileLoading: boolean;
  profileError: string | null;
  reloadAthleteProfile: () => Promise<void>;
  username: string;
  setUsername: (username: string) => void;
  unitSettings: UnitSettings;
  setDistanceUnit: (unit: UnitSystem) => void;
  setHeightUnit: (unit: UnitSystem) => void;
  setWeightUnit: (unit: UnitSystem) => void;
  timelineRevision: number;
  bumpTimeline: () => void;
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
  dateOfBirth: null,
  sex: "Male",
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
  const profileRef = useRef(defaultAthleteProfile);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const profileReady = useRef(false);
  const mounted = useRef(true);
  const profileLoadSequence = useRef(0);
  const weightReadSequence = useRef(0);
  const profileWrites = useRef<Promise<void>>(Promise.resolve());
  const [username, setUsername] = useState("Paddy");
  const [audioCuesEnabled, setAudioCuesEnabledState] = useState(true);
  const [hapticsEnabled, setHapticsEnabledState] = useState(true);
  const [unitSettings, setUnitSettings] = useState<UnitSettings>({
    distance: "metric",
    height: "metric",
    weight: "metric",
  });
  const [timelineRevision, setTimelineRevision] = useState(0);

  const applyProfilePatch = useCallback((patch: Partial<AthleteProfile>) => {
    if (!mounted.current) return;
    profileRef.current = { ...profileRef.current, ...patch };
    setAthleteProfile(profileRef.current);
  }, []);

  const reloadAthleteProfile = useCallback(async () => {
    const sequence = ++profileLoadSequence.current;
    profileReady.current = false;
    setProfileLoading(true);
    setProfileError(null);
    try {
      await profileWrites.current;
      const stored = await loadAthleteProfile();
      if (!mounted.current || sequence !== profileLoadSequence.current) return;
      if (stored) applyProfilePatch(stored);
      profileReady.current = true;
    } catch {
      if (mounted.current && sequence === profileLoadSequence.current) setProfileError("Couldn't load athlete information.");
    } finally { if (mounted.current && sequence === profileLoadSequence.current) setProfileLoading(false); }
  }, [applyProfilePatch]);

  useEffect(() => {
    mounted.current = true;
    void Promise.resolve().then(() => { if (mounted.current) return reloadAthleteProfile(); });
    return () => { mounted.current = false; profileReady.current = false; profileLoadSequence.current += 1; weightReadSequence.current += 1; };
  }, [reloadAthleteProfile]);

  const updateAthleteProfile = useCallback((patch: AthleteProfilePatch) => {
    if (!profileReady.current) return Promise.reject(new Error("Athlete information is still loading"));
    const operation = profileWrites.current.then(async () => {
      if (patch.dateOfBirth != null && !isValidBirthDate(patch.dateOfBirth)) throw new Error("Invalid date of birth");
      if (patch.heightCm != null && (!Number.isFinite(patch.heightCm) || patch.heightCm < 60 || patch.heightCm > 275)) throw new Error("Invalid height");
      const next = { ...profileRef.current, ...patch };
      await storeAthleteProfile(next);
      // A weight read can finish while storage is pending; apply only the edited
      // fields so it cannot be replaced by an older full-profile snapshot.
      applyProfilePatch(patch);
    });
    profileWrites.current = operation.catch(() => {});
    return operation;
  }, [applyProfilePatch]);

  const setAudioCuesEnabled = useCallback((enabled: boolean) => {
    setSensoryPreferences({ audioCuesEnabled: enabled });
    setAudioCuesEnabledState(enabled);
  }, []);

  const setHapticsEnabled = useCallback((enabled: boolean) => {
    setSensoryPreferences({ hapticsEnabled: enabled });
    setHapticsEnabledState(enabled);
  }, []);

  const refreshLatestWeight = useCallback(async () => {
    const sequence = ++weightReadSequence.current;
    const latestWeightKg = await getLatestWeightKg(db);
    if (sequence === weightReadSequence.current) applyProfilePatch({ weightKg: latestWeightKg });
  }, [applyProfilePatch, db]);

  useEffect(() => {
    let cancelled = false;
    const sequence = ++weightReadSequence.current;

    void getLatestWeightKg(db).then((latestWeightKg) => {
      if (!cancelled && sequence === weightReadSequence.current) {
        applyProfilePatch({ weightKg: latestWeightKg });
      }
    }).catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [applyProfilePatch, db, timelineRevision]);

  const logWeight = useCallback(
    async (weightKg: number, loggedAt = Date.now()) => {
      await addWeightLog(db, weightKg, loggedAt);
      // A refresh failure after a successful insert must not invite a second
      // insert. The revision effect also retries the projection read.
      await refreshLatestWeight().catch(() => {});
      setTimelineRevision((current) => current + 1);
    },
    [db, refreshLatestWeight],
  );

  const updateWeightLog = useCallback(
    async (timelineEntryId: number, weightKg: number, loggedAt: number) => {
      await updateStoredWeightLog(db, timelineEntryId, weightKg, loggedAt);
      await refreshLatestWeight().catch(() => {});
      setTimelineRevision((current) => current + 1);
    },
    [db, refreshLatestWeight],
  );

  const deleteWeightLog = useCallback(
    async (timelineEntryId: number) => {
      await deleteStoredWeightLog(db, timelineEntryId);
      await refreshLatestWeight().catch(() => {});
      setTimelineRevision((current) => current + 1);
    },
    [db, refreshLatestWeight],
  );

  const value = useMemo(
    () => ({
      athleteProfile,
      audioCuesEnabled,
      setAudioCuesEnabled,
      hapticsEnabled,
      setHapticsEnabled,
      deleteWeightLog,
      logWeight,
      updateAthleteProfile,
      profileLoading,
      profileError,
      reloadAthleteProfile,
      username,
      setUsername,
      unitSettings,
      setDistanceUnit: (unit: UnitSystem) =>
        setUnitSettings((current) => ({ ...current, distance: unit })),
      setHeightUnit: (unit: UnitSystem) =>
        setUnitSettings((current) => ({ ...current, height: unit })),
      setWeightUnit: (unit: UnitSystem) =>
        setUnitSettings((current) => ({ ...current, weight: unit })),
      timelineRevision,
      bumpTimeline: () => setTimelineRevision((current) => current + 1),
      updateWeightLog,
    }),
    [
      athleteProfile,
      audioCuesEnabled,
      setAudioCuesEnabled,
      hapticsEnabled,
      setHapticsEnabled,
      updateAthleteProfile,
      profileLoading,
      profileError,
      reloadAthleteProfile,
      deleteWeightLog,
      logWeight,
      timelineRevision,
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
