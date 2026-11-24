import { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { AthleteProfilePatch } from "../data/athleteProfileStorage";
import { useAppState } from "../state/AppStateContext";
import { useAppTheme } from "../theme/ThemeContext";
import { readableTextColor, themes } from "../theme/theme";
import { birthDateParts, formatBirthDate, isValidBirthDate } from "../utils/biometrics";
import { feedbackConfirm } from "../utils/feedback";
import { centimetersToImperial, inchesToHeightCm } from "../utils/height";
import { FormModal } from "./FormModal";
import { PressOpacity } from "./PressOpacity";
import { ScrollPicker } from "./ScrollPicker";

export type BiometricField = "dateOfBirth" | "sex" | "heightCm";
const titles: Record<BiometricField, string> = { dateOfBirth: "Date of Birth", sex: "Sex", heightCm: "Height" };
const range = (start: number, end: number) => Array.from({ length: end - start + 1 }, (_, index) => ({ value: start + index, label: String(start + index) }));

export function BiometricEditModal({ field, onClose }: { field: BiometricField; onClose: () => void }) {
  const { theme } = useAppTheme();
  const { athleteProfile, unitSettings, updateAthleteProfile } = useAppState();
  const today = new Date();
  // An age alone cannot establish an exact birthday. This seed is an unsaved
  // draft until the athlete explicitly confirms their date of birth.
  const initialBirth = birthDateParts(athleteProfile.dateOfBirth) ?? { year: today.getFullYear() - (athleteProfile.age ?? 18), month: 1, day: 1 };
  const [year, setYear] = useState(initialBirth.year);
  const [month, setMonth] = useState(initialBirth.month);
  const [day, setDay] = useState(initialBirth.day);
  const [sex, setSex] = useState(athleteProfile.sex ?? "Male");
  const originalHeight = athleteProfile.heightCm;
  const initialHeight = Math.max(60, Math.min(275, originalHeight ?? 175));
  const [cm, setCm] = useState(Math.round(initialHeight));
  const initialImperial = centimetersToImperial(initialHeight);
  const [feet, setFeet] = useState(initialImperial.feet);
  const [inches, setInches] = useState(initialImperial.inches);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const maxMonth = year === today.getFullYear() ? today.getMonth() + 1 : 12;
  const selectedMonth = Math.min(month, maxMonth);
  const maxDay = Math.min(new Date(year, selectedMonth, 0).getDate(), year === today.getFullYear() && selectedMonth === today.getMonth() + 1 ? today.getDate() : 31);
  const selectedDay = Math.min(day, maxDay);
  const dateOfBirth = formatBirthDate(year, selectedMonth, selectedDay);
  const selectedHeight = unitSettings.height === "metric" ? cm : inchesToHeightCm(feet * 12 + inches);
  const unchangedHeight = unitSettings.height === "metric" ? cm === Math.round(initialHeight) : feet === initialImperial.feet && inches === initialImperial.inches;
  const heightToSave = unchangedHeight && originalHeight !== null ? originalHeight : selectedHeight;
  const valid = field === "dateOfBirth" ? isValidBirthDate(dateOfBirth) : field === "heightCm" ? heightToSave >= 60 && heightToSave <= 275 : true;

  async function save() {
    if (savingRef.current || !valid) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    let patch: AthleteProfilePatch;
    if (field === "dateOfBirth") patch = { dateOfBirth, age: null };
    else if (field === "sex") patch = { sex };
    else patch = { heightCm: heightToSave };
    try {
      await updateAthleteProfile(patch);
      feedbackConfirm();
      onClose();
    } catch { setError("Couldn't save. Please try again."); }
    finally { savingRef.current = false; setSaving(false); }
  }

  return (
    <FormModal title={titles[field]} onClose={onClose} onSave={() => void save()} saving={saving} saveDisabled={!valid} error={error}>
      <View pointerEvents={saving ? "none" : "auto"}>
        {field === "dateOfBirth" ? (
          <View style={styles.row}>
            <ScrollPicker label="Day" options={range(1, maxDay)} value={selectedDay} onChange={setDay} />
            <ScrollPicker label="Month" options={range(1, maxMonth).map((option) => ({ ...option, label: new Date(2000, option.value - 1, 1).toLocaleDateString(undefined, { month: "short" }) }))} value={selectedMonth} onChange={(value) => { setMonth(value); setDay(Math.min(selectedDay, new Date(year, value, 0).getDate())); }} />
            <ScrollPicker label="Year" options={range(today.getFullYear() - 120, today.getFullYear())} value={year} onChange={(value) => { setYear(value); setMonth(selectedMonth); setDay(selectedDay); }} />
          </View>
        ) : null}
        {field === "sex" ? (
          <View style={styles.row}>
            {(["Male", "Female"] as const).map((option) => {
              const selected = sex === option;
              return <PressOpacity key={option} accessibilityLabel={option} accessibilityState={{ selected }} disabled={saving} onPress={() => setSex(option)} style={[styles.option, { backgroundColor: selected ? theme.colors.tertiary : theme.colors.surfaceMuted, borderColor: selected ? theme.colors.tertiary : theme.colors.borderStrong }]}><Text style={[styles.optionText, { color: selected ? readableTextColor(theme.colors.tertiary) : theme.colors.text }]}>{option}</Text></PressOpacity>;
            })}
          </View>
        ) : null}
        {field === "heightCm" ? (
          unitSettings.height === "metric" ? <View style={styles.row}><ScrollPicker label="Centimetres (cm)" options={range(60, 275)} value={cm} onChange={setCm} /></View> : <View style={styles.row}><ScrollPicker label="Feet (ft)" options={range(1, 9)} value={feet} onChange={setFeet} /><ScrollPicker label="Inches (in)" options={range(0, 11)} value={inches} onChange={setInches} /></View>
        ) : null}
      </View>
      {!valid ? <Text accessibilityRole="alert" style={{ color: theme.colors.text }}>Select a valid {field === "dateOfBirth" ? "date of birth" : "height"}.</Text> : null}
    </FormModal>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: themes.dark.spacing.sm },
  option: { alignItems: "center", borderRadius: themes.dark.radius.md, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 52 },
  optionText: { fontSize: 15, fontWeight: "700" },
});
