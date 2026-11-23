import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { BiometricEditModal, type BiometricField } from "../components/BiometricEditModal";
import { PressOpacity } from "../components/PressOpacity";
import { Screen } from "../components/Screen";
import { WeightLogModal } from "../components/WeightLogModal";
import { useAppState, type CombatSport } from "../state/AppStateContext";
import { useAppTheme } from "../theme/ThemeContext";
import { readableTextColor, themes } from "../theme/theme";
import { calculateAge } from "../utils/biometrics";
import { combatSports } from "../utils/athleteProfile";
import { formatHeight } from "../utils/height";
import { formatWeight } from "../utils/weight";

const tokens = themes.dark;

export function AthleteInfoScreen({ onClose, onMenu, registerCloseHandler, registerExitGuard }: { onClose?: () => void; onMenu?: () => void; registerCloseHandler?: (handler: (() => void) | null) => void; registerExitGuard?: (guard: ((proceed: () => void) => void) | null) => void }) {
  const { theme } = useAppTheme();
  const { athleteProfile, profileLoading, profileError, reloadAthleteProfile, updateAthleteProfile, unitSettings } = useAppState();
  const [editing, setEditing] = useState<BiometricField | "weight" | null>(null);
  const [savingSports, setSavingSports] = useState(false);
  const sportsSaving = useRef(false);
  const [sportsError, setSportsError] = useState<string | null>(null);
  const closeProfile = useCallback(() => { if (!sportsSaving.current) onClose?.(); }, [onClose]);
  useEffect(() => {
    registerCloseHandler?.(closeProfile);
    return () => registerCloseHandler?.(null);
  }, [closeProfile, registerCloseHandler]);
  useEffect(() => {
    registerExitGuard?.((proceed) => { if (!sportsSaving.current) proceed(); });
    return () => registerExitGuard?.(null);
  }, [registerExitGuard]);
  const age = calculateAge(athleteProfile.dateOfBirth) ?? athleteProfile.age;
  const primaryText = readableTextColor(theme.colors.tertiary);

  async function toggleSport(sport: CombatSport) {
    if (sportsSaving.current) return;
    sportsSaving.current = true;
    setSavingSports(true);
    setSportsError(null);
    const sports = athleteProfile.sports.includes(sport)
      ? athleteProfile.sports.filter((value) => value !== sport) : [...athleteProfile.sports, sport];
    try { await updateAthleteProfile({ sports }); }
    catch { setSportsError("Couldn't save sports. Try again."); }
    finally { sportsSaving.current = false; setSavingSports(false); }
  }

  return (
    <>
      <Screen title="Athlete Information" onClose={onClose ? closeProfile : undefined} onMenu={onMenu ? () => { if (!sportsSaving.current) onMenu(); } : undefined}>
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardHeaderLabel, { color: theme.colors.textMuted }]}>BIOMETRIC OVERVIEW</Text>
            <Text style={[styles.badgeText, { color: theme.colors.tertiary }]}>{athleteProfile.sports.length} DISCIPLINE{athleteProfile.sports.length === 1 ? "" : "S"}</Text>
          </View>
          {profileLoading ? <Text style={{ color: theme.colors.textMuted }}>Loading…</Text> : null}
          {profileError ? <PressOpacity accessibilityLabel="Retry loading athlete information" onPress={() => void reloadAthleteProfile()} style={styles.retry}><Text style={{ color: theme.colors.text }}>{profileError} Retry</Text></PressOpacity> : null}
          <View style={styles.telemetryGrid}>
            <TelemetryTile label="AGE" value={age === null ? "--" : `${age} yrs`} disabled={profileLoading || !!profileError} onPress={() => setEditing("dateOfBirth")} />
            <TelemetryTile label="SEX" value={athleteProfile.sex ?? "--"} disabled={profileLoading || !!profileError} onPress={() => setEditing("sex")} />
            <TelemetryTile label="BODYWEIGHT" value={formatWeight(athleteProfile.weightKg, unitSettings.weight)} onPress={() => setEditing("weight")} />
            <TelemetryTile label="HEIGHT" value={formatHeight(athleteProfile.heightCm, unitSettings.height)} disabled={profileLoading || !!profileError} onPress={() => setEditing("heightCm")} />
          </View>
        </View>
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardHeaderLabel, { color: theme.colors.textMuted }]}>COMBAT SPORTS & DISCIPLINES</Text>
            <Text style={[styles.badgeText, { color: theme.colors.text }]}>{athleteProfile.sports.length} SELECTED</Text>
          </View>
          <View style={styles.sportsGrid}>
            {combatSports.map((sport) => {
              const selected = athleteProfile.sports.includes(sport);
              return (
                <PressOpacity key={sport} accessibilityLabel={`${sport}, ${selected ? "selected" : "not selected"}`} accessibilityState={{ selected }} disabled={savingSports || profileLoading || !!profileError} onPress={() => void toggleSport(sport)} style={[styles.sportTile, { backgroundColor: selected ? theme.colors.tertiary : theme.colors.surfaceMuted, borderColor: selected ? theme.colors.tertiary : theme.colors.borderStrong }]}>
                  <Text numberOfLines={1} style={[styles.sportText, { color: selected ? primaryText : theme.colors.text }]}>{sport}</Text>
                  <Ionicons color={selected ? primaryText : theme.colors.textMuted} name={selected ? "checkmark-circle" : "add-circle-outline"} size={20} />
                </PressOpacity>
              );
            })}
          </View>
          {sportsError ? <Text accessibilityRole="alert" style={{ color: theme.colors.text }}>{sportsError}</Text> : null}
        </View>
      </Screen>
      {editing && editing !== "weight" ? <BiometricEditModal field={editing} onClose={() => setEditing(null)} /> : null}
      <WeightLogModal visible={editing === "weight"} onClose={() => setEditing(null)} />
    </>
  );
}

function TelemetryTile({ label, value, onPress, disabled }: { label: string; value: string; onPress: () => void; disabled?: boolean }) {
  const { theme } = useAppTheme();
  return (
    <PressOpacity accessibilityLabel={`Edit ${label.toLowerCase()}, ${value}`} disabled={disabled} onPress={onPress} style={[styles.telemetryTile, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
      <Text style={[styles.telemetryLabel, { color: theme.colors.textMuted }]}>{label}</Text>
      <Text adjustsFontSizeToFit minimumFontScale={0.75} numberOfLines={1} style={[styles.telemetryValue, { color: theme.colors.text }]}>{value}</Text>
    </PressOpacity>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: tokens.radius.lg, borderWidth: 1, padding: tokens.spacing.lg, gap: tokens.spacing.md },
  cardHeader: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: tokens.spacing.sm },
  cardHeaderLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  badgeText: { fontSize: 10, fontWeight: "800", fontVariant: ["tabular-nums"] },
  telemetryGrid: { flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.sm },
  telemetryTile: { borderRadius: tokens.radius.md, borderWidth: 1, gap: 4, justifyContent: "center", minHeight: 72, padding: tokens.spacing.md, width: "48%" },
  telemetryLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },
  telemetryValue: { fontSize: 21, fontWeight: "800", fontVariant: ["tabular-nums"] },
  sportsGrid: { flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.sm },
  sportTile: { alignItems: "center", borderRadius: tokens.radius.md, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 52, paddingHorizontal: tokens.spacing.md, width: "48%" },
  sportText: { flex: 1, fontSize: 13, fontWeight: "800", paddingRight: 4 },
  retry: { minHeight: 48, justifyContent: "center" },
});
