import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { PressOpacity } from "../components/PressOpacity";
import { Screen } from "../components/Screen";
import { SimpleSwitch } from "../components/SimpleSwitch";
import { useAppState } from "../state/AppStateContext";
import { useAppTheme } from "../theme/ThemeContext";
import {
  readableTextColor,
  tertiaryColorOptions,
  themes,
} from "../theme/theme";
import { feedbackConfirm, feedbackStep } from "../utils/feedback";

const tokens = themes.dark;

export function SettingsScreen() {
  const {
    colorScheme,
    setColorScheme,
    setTertiaryColor,
    tertiaryColor,
    theme,
  } = useAppTheme();
  const {
    audioCuesEnabled,
    hapticsEnabled,
    setAudioCuesEnabled,
    setDistanceUnit,
    setHapticsEnabled,
    setHeightUnit,
    setWeightUnit,
    unitSettings,
  } = useAppState();
  const [weighInReminders, setWeighInReminders] = useState(false);
  const [trainingReminders, setTrainingReminders] = useState(false);
  const [hydrationReminders, setHydrationReminders] = useState(false);

  const selectedColorOption = tertiaryColorOptions.find(
    (option) => option.key === tertiaryColor,
  )!;
  const activeRemindersCount = [
    weighInReminders,
    trainingReminders,
    hydrationReminders,
  ].filter(Boolean).length;

  return (
    <Screen
      subtitle="High-contrast display, unit standards, and sensory feedback"
      title="Settings"
    >
      {/* Card 1: Appearance & Accent */}
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
            APPEARANCE & CONTRAST
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
            <View
              style={[
                styles.badgeDot,
                { backgroundColor: selectedColorOption.hex },
              ]}
            />
            <Text style={[styles.badgeText, { color: theme.colors.text }]}>
              {colorScheme.toUpperCase()} · {selectedColorOption.label.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={[styles.row, { borderTopColor: theme.colors.border }]}>
          <View style={styles.rowTextGroup}>
            <Text style={[styles.rowLabel, { color: theme.colors.text }]}>
              Display Mode
            </Text>
            <Text style={[styles.rowHint, { color: theme.colors.textMuted }]}>
              High-contrast surface palette
            </Text>
          </View>
          <DualOptionButtons
            leftLabel="Dark"
            onValueChange={(isLight) =>
              setColorScheme(isLight ? "light" : "dark")
            }
            rightLabel="Light"
            value={colorScheme === "light"}
          />
        </View>

        <View style={[styles.blockRow, { borderTopColor: theme.colors.border }]}>
          <View style={styles.blockHeaderRow}>
            <Text style={[styles.rowLabel, { color: theme.colors.text }]}>
              Accent Colour
            </Text>
            <Text style={[styles.rowHint, { color: theme.colors.textMuted }]}>
              Swipe & tap to apply
            </Text>
          </View>

          <ScrollView
            contentContainerStyle={styles.colorStrip}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {tertiaryColorOptions.map((option) => {
              const isSelected = option.key === tertiaryColor;
              const activeTextColor = readableTextColor(option.hex);

              return (
                <PressOpacity
                  accessibilityLabel={`Use ${option.label}`}
                  accessibilityState={{ selected: isSelected }}
                  key={option.key}
                  onPress={() => {
                    feedbackStep("up");
                    setTertiaryColor(option.key);
                  }}
                  silent
                  style={[
                    styles.colorPill,
                    {
                      backgroundColor: isSelected
                        ? option.hex
                        : theme.colors.surfaceMuted,
                      borderColor: isSelected
                        ? option.hex
                        : theme.colors.borderStrong,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.colorSwatch,
                      {
                        backgroundColor: option.hex,
                        borderColor: isSelected
                          ? activeTextColor
                          : "rgba(255,255,255,0.28)",
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.colorPillText,
                      {
                        color: isSelected ? activeTextColor : theme.colors.text,
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                  {isSelected ? (
                    <Ionicons
                      color={activeTextColor}
                      name="checkmark-circle"
                      size={18}
                    />
                  ) : null}
                </PressOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* Card 2: Measurement Units */}
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
            MEASUREMENT UNITS
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
            <Text style={[styles.badgeText, { color: theme.colors.text }]}>
              {unitSettings.distance === "metric" ? "KM" : "MI"} ·{" "}
              {unitSettings.weight === "metric" ? "KG" : "LB"} ·{" "}
              {unitSettings.height === "metric" ? "CM" : "IN"}
            </Text>
          </View>
        </View>

        <View style={[styles.row, { borderTopColor: theme.colors.border }]}>
          <View style={styles.rowTextGroup}>
            <Text style={[styles.rowLabel, { color: theme.colors.text }]}>
              Distance
            </Text>
            <Text style={[styles.rowHint, { color: theme.colors.textMuted }]}>
              Roadwork, sprints & GPS splits
            </Text>
          </View>
          <DualOptionButtons
            leftLabel="km"
            onValueChange={(isImperial) =>
              setDistanceUnit(isImperial ? "imperial" : "metric")
            }
            rightLabel="mi"
            value={unitSettings.distance === "imperial"}
          />
        </View>

        <View style={[styles.row, { borderTopColor: theme.colors.border }]}>
          <View style={styles.rowTextGroup}>
            <Text style={[styles.rowLabel, { color: theme.colors.text }]}>
              Weight & Load
            </Text>
            <Text style={[styles.rowHint, { color: theme.colors.textMuted }]}>
              Bodyweight & external resistance
            </Text>
          </View>
          <DualOptionButtons
            leftLabel="kg"
            onValueChange={(isImperial) =>
              setWeightUnit(isImperial ? "imperial" : "metric")
            }
            rightLabel="lb"
            value={unitSettings.weight === "imperial"}
          />
        </View>

        <View style={[styles.row, { borderTopColor: theme.colors.border }]}>
          <View style={styles.rowTextGroup}>
            <Text style={[styles.rowLabel, { color: theme.colors.text }]}>
              Height & Elevation
            </Text>
            <Text style={[styles.rowHint, { color: theme.colors.textMuted }]}>
              Stature & vertical gain
            </Text>
          </View>
          <DualOptionButtons
            leftLabel="cm"
            onValueChange={(isImperial) =>
              setHeightUnit(isImperial ? "imperial" : "metric")
            }
            rightLabel="inches"
            value={unitSettings.height === "imperial"}
          />
        </View>
      </View>

      {/* Card 3: Sensory & Audio Cues */}
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
            AUDIO CUES & HAPTIC FEEDBACK
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
            <Text style={[styles.badgeText, { color: theme.colors.text }]}>
              {audioCuesEnabled && hapticsEnabled
                ? "FULL CUES"
                : audioCuesEnabled
                  ? "AUDIO ONLY"
                  : hapticsEnabled
                    ? "HAPTIC ONLY"
                    : "MUTED"}
            </Text>
          </View>
        </View>

        <View style={[styles.row, { borderTopColor: theme.colors.border }]}>
          <View style={styles.rowTextGroup}>
            <Text style={[styles.rowLabel, { color: theme.colors.text }]}>
              Audio Cues
            </Text>
            <Text style={[styles.rowHint, { color: theme.colors.textMuted }]}>
              Timer horns, countdown beeps & stepper clicks
            </Text>
          </View>
          <SimpleSwitch
            onValueChange={setAudioCuesEnabled}
            value={audioCuesEnabled}
          />
        </View>

        <View style={[styles.row, { borderTopColor: theme.colors.border }]}>
          <View style={styles.rowTextGroup}>
            <Text style={[styles.rowLabel, { color: theme.colors.text }]}>
              Haptic Feedback
            </Text>
            <Text style={[styles.rowHint, { color: theme.colors.textMuted }]}>
              Tactile pulses on increments & transitions
            </Text>
          </View>
          <SimpleSwitch
            onValueChange={setHapticsEnabled}
            value={hapticsEnabled}
          />
        </View>

        <PressOpacity
          accessibilityLabel="Test audio and haptic cue"
          onPress={feedbackConfirm}
          silent
          style={[
            styles.testCueButton,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        >
          <Ionicons
            color={theme.colors.tertiary}
            name="volume-high-outline"
            size={20}
          />
          <Text style={[styles.testCueText, { color: theme.colors.text }]}>
            Test Audio & Haptic Cue
          </Text>
        </PressOpacity>
      </View>

      {/* Card 4: Notifications */}
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
            NOTIFICATIONS & REMINDERS
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
            <Text style={[styles.badgeText, { color: theme.colors.text }]}>
              {activeRemindersCount} / 3 ACTIVE
            </Text>
          </View>
        </View>

        <View style={[styles.row, { borderTopColor: theme.colors.border }]}>
          <View style={styles.rowTextGroup}>
            <Text style={[styles.rowLabel, { color: theme.colors.text }]}>
              Weigh-in reminders
            </Text>
            <Text style={[styles.rowHint, { color: theme.colors.textMuted }]}>
              Morning scale check-in prompt
            </Text>
          </View>
          <SimpleSwitch
            onValueChange={setWeighInReminders}
            value={weighInReminders}
          />
        </View>

        <View style={[styles.row, { borderTopColor: theme.colors.border }]}>
          <View style={styles.rowTextGroup}>
            <Text style={[styles.rowLabel, { color: theme.colors.text }]}>
              Training reminders
            </Text>
            <Text style={[styles.rowHint, { color: theme.colors.textMuted }]}>
              Scheduled conditioning & session alerts
            </Text>
          </View>
          <SimpleSwitch
            onValueChange={setTrainingReminders}
            value={trainingReminders}
          />
        </View>

        <View style={[styles.row, { borderTopColor: theme.colors.border }]}>
          <View style={styles.rowTextGroup}>
            <Text style={[styles.rowLabel, { color: theme.colors.text }]}>
              Hydration reminders
            </Text>
            <Text style={[styles.rowHint, { color: theme.colors.textMuted }]}>
              Daily fluid & electrolyte pacing
            </Text>
          </View>
          <SimpleSwitch
            onValueChange={setHydrationReminders}
            value={hydrationReminders}
          />
        </View>
      </View>
    </Screen>
  );
}

function DualOptionButtons({
  leftLabel,
  onValueChange,
  rightLabel,
  value,
}: {
  leftLabel: string;
  onValueChange: (value: boolean) => void;
  rightLabel: string;
  value: boolean;
}) {
  const { theme } = useAppTheme();
  const activeColor = readableTextColor(theme.colors.tertiary);
  const options = [
    { label: leftLabel, value: false },
    { label: rightLabel, value: true },
  ];

  return (
    <View
      style={[
        styles.optionSelector,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderColor: theme.colors.borderStrong,
        },
      ]}
    >
      {options.map((option) => {
        const isSelected = option.value === value;

        return (
          <PressOpacity
            accessibilityLabel={option.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            key={option.label}
            onPress={() => {
              feedbackStep(option.value ? "up" : "down");
              onValueChange(option.value);
            }}
            silent
            style={[
              styles.option,
              option.value && {
                borderLeftColor: theme.colors.borderStrong,
                borderLeftWidth: 1,
              },
              isSelected && { backgroundColor: theme.colors.tertiary },
            ]}
          >
            <Text
              style={[
                styles.optionText,
                { color: isSelected ? activeColor : theme.colors.textMuted },
              ]}
            >
              {option.label}
            </Text>
          </PressOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    gap: tokens.spacing.xs,
    padding: tokens.spacing.lg,
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: tokens.spacing.xs,
  },
  cardHeaderLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  badge: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 4,
  },
  badgeDot: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  badgeText: {
    fontSize: 10,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  row: {
    alignItems: "center",
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 68,
    paddingVertical: tokens.spacing.sm,
  },
  blockRow: {
    borderTopWidth: 1,
    gap: tokens.spacing.sm,
    paddingTop: tokens.spacing.md,
  },
  blockHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  rowTextGroup: {
    flex: 1,
    gap: 2,
    paddingRight: tokens.spacing.md,
  },
  rowLabel: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "700",
    lineHeight: tokens.typography.body.lineHeight,
  },
  rowHint: {
    fontSize: 12,
    lineHeight: 16,
  },
  optionSelector: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
    width: 172,
  },
  option: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: tokens.spacing.sm,
  },
  optionText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
    lineHeight: 16,
    textAlign: "center",
    textTransform: "uppercase",
  },
  colorStrip: {
    gap: tokens.spacing.sm,
    paddingVertical: 2,
  },
  colorPill: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.spacing.sm,
    minHeight: 48,
    paddingHorizontal: tokens.spacing.md,
  },
  colorSwatch: {
    borderRadius: 999,
    borderWidth: 1.5,
    height: 16,
    width: 16,
  },
  colorPillText: {
    fontSize: 13,
    fontWeight: "800",
  },
  testCueButton: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.spacing.sm,
    justifyContent: "center",
    marginTop: tokens.spacing.xs,
    minHeight: 48,
    paddingHorizontal: tokens.spacing.md,
  },
  testCueText: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
});
