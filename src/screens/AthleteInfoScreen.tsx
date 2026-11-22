import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { parseDecimalInput } from "../utils/numericInput";
import { PressOpacity } from "../components/PressOpacity";
import { Screen } from "../components/Screen";
import { LogTimeChanger } from "../components/LogTimeChanger";
import { useAppState, type CombatSport } from "../state/AppStateContext";
import { useAppTheme } from "../theme/ThemeContext";
import { readableTextColor, themes } from "../theme/theme";
import { feedbackConfirm, feedbackStep } from "../utils/feedback";
import {
  centimetersToImperial,
  formatHeight,
  inchesToHeightCm,
} from "../utils/height";
import {
  convertKilogramsToWeight,
  convertWeightToKilograms,
  formatWeight,
} from "../utils/weight";

const tokens = themes.dark;
type Sex = "Male" | "Female";
const sexOptions: Sex[] = ["Male", "Female"];

const AGE_PRESETS = [15, 17, 19, 21, 24, 27, 30, 35, 40] as const;
const METRIC_HEIGHT_PRESETS = [160, 165, 170, 175, 180, 185, 190, 195] as const;
const IMPERIAL_HEIGHT_PRESETS = [
  { feet: 5, inches: 4, label: "5'4\"" },
  { feet: 5, inches: 6, label: "5'6\"" },
  { feet: 5, inches: 8, label: "5'8\"" },
  { feet: 5, inches: 10, label: "5'10\"" },
  { feet: 6, inches: 0, label: "6'0\"" },
  { feet: 6, inches: 2, label: "6'2\"" },
  { feet: 6, inches: 4, label: "6'4\"" },
] as const;

const sportOptions: CombatSport[] = [
  "Muay Thai",
  "Kickboxing",
  "Boxing",
  "MMA",
  "BJJ (Gi)",
  "BJJ (No-Gi)",
  "Wrestling",
  "Judo",
  "Jiu-Jitsu",
  "Karate",
];

export function AthleteInfoScreen({ onClose, registerCloseHandler }: { onClose?: () => void; registerCloseHandler?: (handler: (() => void) | null) => void }) {
  const { theme } = useAppTheme();
  const {
    athleteProfile,
    bumpTimeline,
    logWeight,
    setAthleteProfile,
    unitSettings,
  } = useAppState();

  const [sex, setSex] = useState<Sex>("Male");
  const weightSource = `${unitSettings.weight}:${athleteProfile.weightKg}`;
  const initialWeight = String(Math.round(convertKilogramsToWeight(athleteProfile.weightKg ?? 70, unitSettings.weight) * 10) / 10);
  const [weightDraft, setWeightDraft] = useState<{ source: string; value: string } | null>(null);
  const draftWeightDisplay = weightDraft?.source === weightSource ? weightDraft.value : initialWeight;
  function setDraftWeightDisplay(value: string) { setWeightDraft({ source: weightSource, value }); }
  const [weightSavedFlash, setWeightSavedFlash] = useState(false);
  const [savingWeight, setSavingWeight] = useState(false);
  const [weightLoggedAt, setWeightLoggedAt] = useState(() => new Date());
  const closeProfile = useCallback(() => {
    if (savingWeight) return;
    if (draftWeightDisplay.trim() !== initialWeight && !weightSavedFlash) {
      Alert.alert("Discard weight changes?", "Your unlogged weight will be discarded.", [
        { text: "Keep editing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: onClose },
      ]);
    } else onClose?.();
  }, [draftWeightDisplay, initialWeight, onClose, savingWeight, weightSavedFlash]);
  useEffect(() => {
    registerCloseHandler?.(closeProfile);
    return () => registerCloseHandler?.(null);
  }, [closeProfile, registerCloseHandler]);
  const currentAge = athleteProfile.age ?? 18;
  const currentHeightCm = athleteProfile.heightCm ?? 175;
  const imperialHeight = centimetersToImperial(currentHeightCm);
  const weightUnitLabel = unitSettings.weight === "metric" ? "kg" : "lbs";
  const primaryTextColor = readableTextColor(theme.colors.tertiary);

  function stepAge(delta: number) {
    feedbackStep(delta > 0 ? "up" : "down");
    const nextAge = clamp(currentAge + delta, 10, 99);
    setAthleteProfile({ ...athleteProfile, age: nextAge });
  }

  function selectAgePreset(age: number) {
    feedbackStep("up");
    setAthleteProfile({ ...athleteProfile, age });
  }

  function stepHeightMetric(deltaCm: number) {
    feedbackStep(deltaCm > 0 ? "up" : "down");
    const nextCm = clamp(Math.round(currentHeightCm + deltaCm), 100, 240);
    setAthleteProfile({ ...athleteProfile, heightCm: nextCm });
  }

  function stepHeightImperial(deltaInches: number) {
    feedbackStep(deltaInches > 0 ? "up" : "down");
    const currentTotalInches = imperialHeight.feet * 12 + imperialHeight.inches;
    const nextTotalInches = clamp(currentTotalInches + deltaInches, 48, 90);
    const nextCm = inchesToHeightCm(nextTotalInches);
    setAthleteProfile({ ...athleteProfile, heightCm: nextCm });
  }


  async function commitWeightLog() {
    const parsedWeight = parseDecimalInput(draftWeightDisplay);
    if (savingWeight || parsedWeight === null || parsedWeight <= 0) return;
    const weightKg = convertWeightToKilograms(
      parsedWeight,
      unitSettings.weight,
    );
    setSavingWeight(true);
    try {
      await logWeight(weightKg, Math.min(weightLoggedAt.getTime(), Date.now()));
      bumpTimeline();
      setWeightSavedFlash(true);
      feedbackConfirm();
    } catch {
      Alert.alert("Couldn't save weight log", "Please try again.");
    } finally { setSavingWeight(false); }
  }

  function toggleSport(sport: CombatSport) {
    const exists = athleteProfile.sports.includes(sport);
    feedbackStep(exists ? "down" : "up");
    const sports = exists
      ? athleteProfile.sports.filter((currentSport) => currentSport !== sport)
      : [...athleteProfile.sports, sport];

    setAthleteProfile({ ...athleteProfile, sports });
  }

  const ageText =
    athleteProfile.age === null ? "--" : `${athleteProfile.age} yrs`;
  const weightText = formatWeight(
    athleteProfile.weightKg,
    unitSettings.weight,
  );
  const heightText = formatHeight(
    athleteProfile.heightCm,
    unitSettings.height,
  );

  const weightAction = (
        <PressOpacity
          accessibilityLabel="Log weight"
          disabled={savingWeight || parseDecimalInput(draftWeightDisplay) === null || Number(draftWeightDisplay.replace(",", ".")) <= 0}
          onPress={() => void commitWeightLog()}
          silent
          style={[
            styles.primaryFlowButton,
            { backgroundColor: theme.colors.tertiary },
          ]}
        >
          <Ionicons color={primaryTextColor} name="scale-outline" size={20} />
          <Text style={[styles.primaryFlowText, { color: primaryTextColor }]}>
            {weightSavedFlash
              ? `Logged ${draftWeightDisplay} ${weightUnitLabel}`
              : `Log ${draftWeightDisplay} ${weightUnitLabel}`}
          </Text>
        </PressOpacity>
  );

  return (
    <Screen
      title="Athlete Information"
      onClose={onClose ? closeProfile : undefined}
      footer={weightAction}
      right={<LogTimeChanger label="Weigh-in time" maximumDate={new Date()} value={weightLoggedAt} onChange={(date) => { setWeightSavedFlash(false); setWeightLoggedAt(date); }} />}
    >
      {/* Card 1: Biometric Summary Strip */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.borderStrong,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.cardHeaderLabel, { color: theme.colors.textMuted }]}>
            BIOMETRIC OVERVIEW
          </Text>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.badgeText, { color: theme.colors.tertiary }]}>
              {athleteProfile.sports.length} DISCIPLINE
              {athleteProfile.sports.length === 1 ? "" : "S"}
            </Text>
          </View>
        </View>

        <View style={styles.telemetryGrid}>
          <TelemetryTile label="AGE" value={ageText} />
          <TelemetryTile label="SEX" value={sex} />
          <TelemetryTile label="WEIGHT" value={weightText} />
          <TelemetryTile label="HEIGHT" value={heightText} />
        </View>
      </View>

      {/* Card 2: Biological Sex */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.borderStrong,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.cardHeaderLabel, { color: theme.colors.textMuted }]}>
            BIOLOGICAL SEX
          </Text>
          <Text style={[styles.cardValueBadge, { color: theme.colors.text }]}>
            {sex}
          </Text>
        </View>

        <View style={styles.sexRow}>
          {sexOptions.map((option) => {
            const isSelected = sex === option;
            return (
              <PressOpacity
                accessibilityLabel={`Select ${option}`}
                accessibilityState={{ selected: isSelected }}
                key={option}
                onPress={() => {
                  feedbackStep("up");
                  setSex(option);
                }}
                silent
                style={[
                  styles.sexButton,
                  {
                    backgroundColor: isSelected
                      ? theme.colors.tertiary
                      : theme.colors.surfaceMuted,
                    borderColor: isSelected
                      ? theme.colors.tertiary
                      : theme.colors.borderStrong,
                  },
                ]}
              >
                <Ionicons
                  color={isSelected ? primaryTextColor : theme.colors.textMuted}
                  name={option === "Male" ? "male" : "female"}
                  size={20}
                />
                <Text
                  style={[
                    styles.sexButtonText,
                    { color: isSelected ? primaryTextColor : theme.colors.text },
                  ]}
                >
                  {option}
                </Text>
              </PressOpacity>
            );
          })}
        </View>
      </View>

      {/* Card 3: Age Stepper & Scroll Presets */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.borderStrong,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.cardHeaderLabel, { color: theme.colors.textMuted }]}>
            ATHLETE AGE
          </Text>
          <Text style={[styles.cardValueBadge, { color: theme.colors.text }]}>
            {currentAge} YEARS OLD
          </Text>
        </View>

        <View style={styles.stepperRow}>
          <StepButton label="-5" onPress={() => stepAge(-5)} />
          <StepButton label="-1" onPress={() => stepAge(-1)} />
          <View
            style={[
              styles.readoutBox,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.borderStrong,
              },
            ]}
          >
            <Text style={[styles.readoutValue, { color: theme.colors.text }]}>
              {currentAge}
            </Text>
            <Text style={[styles.readoutUnit, { color: theme.colors.textMuted }]}>
              YEARS
            </Text>
          </View>
          <StepButton label="+1" onPress={() => stepAge(1)} />
          <StepButton label="+5" onPress={() => stepAge(5)} />
        </View>

        <ScrollView
          contentContainerStyle={styles.presetStrip}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {AGE_PRESETS.map((preset) => {
            const selected = currentAge === preset;
            return (
              <PressOpacity
                accessibilityLabel={`Set age ${preset}`}
                accessibilityState={{ selected }}
                key={preset}
                onPress={() => selectAgePreset(preset)}
                silent
                style={[
                  styles.presetChip,
                  {
                    backgroundColor: selected
                      ? theme.colors.tertiary
                      : theme.colors.surfaceMuted,
                    borderColor: selected
                      ? theme.colors.tertiary
                      : theme.colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.presetChipText,
                    { color: selected ? primaryTextColor : theme.colors.text },
                  ]}
                >
                  {preset}y
                </Text>
              </PressOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Card 4: Bodyweight input and quick log */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.borderStrong,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.cardHeaderLabel, { color: theme.colors.textMuted }]}>
            BODYWEIGHT ({weightUnitLabel.toUpperCase()})
          </Text>
          <Text style={[styles.cardValueBadge, { color: theme.colors.text }]}>
            LATEST: {weightText}
          </Text>
        </View>

        <TextInput
          accessibilityLabel={`Bodyweight in ${weightUnitLabel}`}
          inputMode="decimal"
          keyboardType="decimal-pad"
          onChangeText={(text) => { setWeightSavedFlash(false); setDraftWeightDisplay(text); }}
          placeholder="Enter weight"
          placeholderTextColor={theme.colors.textMuted}
          selectTextOnFocus
          style={[styles.readoutBox, { color: theme.colors.text, borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surfaceMuted, fontSize: 22, fontVariant: ["tabular-nums"], paddingHorizontal: 12 }]}
          value={draftWeightDisplay}
        />

      </View>

      {/* Card 5: Height Stepper & Scroll Presets */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.borderStrong,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.cardHeaderLabel, { color: theme.colors.textMuted }]}>
            STATURE / HEIGHT
          </Text>
          <Text style={[styles.cardValueBadge, { color: theme.colors.text }]}>
            {heightText}
          </Text>
        </View>

        {unitSettings.height === "metric" ? (
          <>
            <View style={styles.stepperRow}>
              <StepButton label="-5" onPress={() => stepHeightMetric(-5)} />
              <StepButton label="-1" onPress={() => stepHeightMetric(-1)} />
              <View
                style={[
                  styles.readoutBox,
                  {
                    backgroundColor: theme.colors.surfaceMuted,
                    borderColor: theme.colors.borderStrong,
                  },
                ]}
              >
                <Text style={[styles.readoutValue, { color: theme.colors.text }]}>
                  {Math.round(currentHeightCm)}
                </Text>
                <Text style={[styles.readoutUnit, { color: theme.colors.textMuted }]}>
                  CM
                </Text>
              </View>
              <StepButton label="+1" onPress={() => stepHeightMetric(1)} />
              <StepButton label="+5" onPress={() => stepHeightMetric(5)} />
            </View>

            <ScrollView
              contentContainerStyle={styles.presetStrip}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {METRIC_HEIGHT_PRESETS.map((preset) => {
                const selected = Math.round(currentHeightCm) === preset;
                return (
                  <PressOpacity
                    accessibilityLabel={`Set height ${preset} centimeters`}
                    accessibilityState={{ selected }}
                    key={preset}
                    onPress={() => {
                      feedbackStep("up");
                      setAthleteProfile({ ...athleteProfile, heightCm: preset });
                    }}
                    silent
                    style={[
                      styles.presetChip,
                      {
                        backgroundColor: selected
                          ? theme.colors.tertiary
                          : theme.colors.surfaceMuted,
                        borderColor: selected
                          ? theme.colors.tertiary
                          : theme.colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        { color: selected ? primaryTextColor : theme.colors.text },
                      ]}
                    >
                      {preset} cm
                    </Text>
                  </PressOpacity>
                );
              })}
            </ScrollView>
          </>
        ) : (
          <>
            <View style={styles.stepperRow}>
              <StepButton label="-1 ft" onPress={() => stepHeightImperial(-12)} />
              <StepButton label="-1 in" onPress={() => stepHeightImperial(-1)} />
              <View
                style={[
                  styles.readoutBox,
                  {
                    backgroundColor: theme.colors.surfaceMuted,
                    borderColor: theme.colors.borderStrong,
                  },
                ]}
              >
                <Text style={[styles.readoutValue, { color: theme.colors.text }]}>
                  {formatHeight(currentHeightCm, "imperial")}
                </Text>
                <Text style={[styles.readoutUnit, { color: theme.colors.textMuted }]}>
                  FT · IN
                </Text>
              </View>
              <StepButton label="+1 in" onPress={() => stepHeightImperial(1)} />
              <StepButton label="+1 ft" onPress={() => stepHeightImperial(12)} />
            </View>

            <ScrollView
              contentContainerStyle={styles.presetStrip}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {IMPERIAL_HEIGHT_PRESETS.map((preset) => {
                const selected =
                  imperialHeight.feet === preset.feet &&
                  imperialHeight.inches === preset.inches;
                return (
                  <PressOpacity
                    accessibilityLabel={`Set height ${preset.label}`}
                    accessibilityState={{ selected }}
                    key={preset.label}
                    onPress={() => {
                      feedbackStep("up");
                      const totalInches = preset.feet * 12 + preset.inches;
                      setAthleteProfile({
                        ...athleteProfile,
                        heightCm: inchesToHeightCm(totalInches),
                      });
                    }}
                    silent
                    style={[
                      styles.presetChip,
                      {
                        backgroundColor: selected
                          ? theme.colors.tertiary
                          : theme.colors.surfaceMuted,
                        borderColor: selected
                          ? theme.colors.tertiary
                          : theme.colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        { color: selected ? primaryTextColor : theme.colors.text },
                      ]}
                    >
                      {preset.label}
                    </Text>
                  </PressOpacity>
                );
              })}
            </ScrollView>
          </>
        )}
      </View>

      {/* Card 6: Combat Sports Multi-Select Grid */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.borderStrong,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.cardHeaderLabel, { color: theme.colors.textMuted }]}>
            COMBAT SPORTS & DISCIPLINES
          </Text>
          <Text style={[styles.cardValueBadge, { color: theme.colors.text }]}>
            {athleteProfile.sports.length} SELECTED
          </Text>
        </View>

        <View style={styles.sportsGrid}>
          {sportOptions.map((sport) => {
            const isSelected = athleteProfile.sports.includes(sport);

            return (
              <PressOpacity
                accessibilityLabel={`${sport}, ${
                  isSelected ? "selected" : "not selected"
                }`}
                accessibilityState={{ selected: isSelected }}
                key={sport}
                onPress={() => toggleSport(sport)}
                silent
                style={[
                  styles.sportTile,
                  {
                    backgroundColor: isSelected
                      ? theme.colors.tertiary
                      : theme.colors.surfaceMuted,
                    borderColor: isSelected
                      ? theme.colors.tertiary
                      : theme.colors.borderStrong,
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.sportTileText,
                    { color: isSelected ? primaryTextColor : theme.colors.text },
                  ]}
                >
                  {sport}
                </Text>
                <Ionicons
                  color={isSelected ? primaryTextColor : theme.colors.textMuted}
                  name={isSelected ? "checkmark-circle" : "add-circle-outline"}
                  size={20}
                />
              </PressOpacity>
            );
          })}
        </View>
      </View>
    </Screen>
  );
}

function TelemetryTile({ label, value }: { label: string; value: string }) {
  const { theme } = useAppTheme();
  return (
    <View
      style={[
        styles.telemetryTile,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <Text style={[styles.telemetryLabel, { color: theme.colors.textMuted }]}>
        {label}
      </Text>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        numberOfLines={1}
        style={[styles.telemetryValue, { color: theme.colors.text }]}
      >
        {value}
      </Text>
    </View>
  );
}

function StepButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const { theme } = useAppTheme();
  return (
    <PressOpacity
      accessibilityLabel={`Step ${label}`}
      onPress={onPress}
      silent
      style={[
        styles.stepButton,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderColor: theme.colors.borderStrong,
        },
      ]}
    >
      <Text style={[styles.stepButtonText, { color: theme.colors.text }]}>
        {label}
      </Text>
    </PressOpacity>
  );
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

const styles = StyleSheet.create({
  card: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    gap: tokens.spacing.md,
    padding: tokens.spacing.lg,
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cardHeaderLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  cardValueBadge: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  badge: {
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 10,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  telemetryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  telemetryTile: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    minWidth: "46%",
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  telemetryLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  telemetryValue: {
    fontSize: 18,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  sexRow: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
  },
  sexButton: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: tokens.spacing.sm,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: tokens.spacing.md,
  },
  sexButtonText: {
    fontSize: 15,
    fontWeight: "800",
  },
  stepperRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.xs,
  },
  stepButton: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 52,
    minWidth: 52,
    paddingHorizontal: tokens.spacing.sm,
  },
  stepButtonText: {
    fontSize: 13,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  readoutBox: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: tokens.spacing.xs,
  },
  readoutValue: {
    fontSize: 20,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
    lineHeight: 24,
  },
  readoutUnit: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  presetStrip: {
    gap: tokens.spacing.xs,
  },
  presetChip: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: tokens.spacing.md,
  },
  presetChipText: {
    fontSize: 13,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  primaryFlowButton: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    flexDirection: "row",
    gap: tokens.spacing.xs,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: tokens.spacing.lg,
  },
  primaryFlowText: {
    fontSize: 15,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  sportsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  sportTile: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 52,
    paddingHorizontal: tokens.spacing.md,
    width: "48%",
  },
  sportTileText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    paddingRight: 4,
  },
});
