import type { ReactNode } from "react";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { PressOpacity } from "../components/PressOpacity";
import { Screen } from "../components/Screen";
import { SimpleSwitch } from "../components/SimpleSwitch";
import { useAppState } from "../state/AppStateContext";
import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";

const tokens = themes.dark;

export function SettingsScreen() {
  const { colorScheme, setColorScheme, theme } = useAppTheme();
  const { setHeightUnit, setWeightUnit, unitSettings } = useAppState();
  const [distanceInMiles, setDistanceInMiles] = useState(false);
  const [weighInReminders, setWeighInReminders] = useState(false);
  const [trainingReminders, setTrainingReminders] = useState(false);
  const [hydrationReminders, setHydrationReminders] = useState(false);

  const setThemeFromSwitch = (isLight: boolean) => {
    setColorScheme(isLight ? "light" : "dark");
  };

  return (
    <Screen title="Settings">
      <Section title="Appearance">
        <SettingRow
          label="Theme"
          control={
            <OptionSelector
              leftLabel="Dark"
              onValueChange={setThemeFromSwitch}
              rightLabel="Light"
              value={colorScheme === "light"}
            />
          }
        />
      </Section>

      <Section title="Units">
        <SettingRow
          label="Distance"
          control={
            <OptionSelector
              leftLabel="km"
              onValueChange={setDistanceInMiles}
              rightLabel="mi"
              value={distanceInMiles}
            />
          }
        />
        <SettingRow
          label="Weight"
          control={
            <OptionSelector
              leftLabel="kg"
              onValueChange={(isImperial) =>
                setWeightUnit(isImperial ? "imperial" : "metric")
              }
              rightLabel="lb"
              value={unitSettings.weight === "imperial"}
            />
          }
        />
        <SettingRow
          label="Height"
          control={
            <OptionSelector
              leftLabel="cm"
              onValueChange={(isImperial) =>
                setHeightUnit(isImperial ? "imperial" : "metric")
              }
              rightLabel="inches"
              value={unitSettings.height === "imperial"}
            />
          }
        />
      </Section>

      <Section title="Notifications">
        <SettingRow
          label="Weigh-in reminders"
          control={
            <ThemedSwitch
              onValueChange={setWeighInReminders}
              value={weighInReminders}
            />
          }
        />
        <SettingRow
          label="Training reminders"
          control={
            <ThemedSwitch
              onValueChange={setTrainingReminders}
              value={trainingReminders}
            />
          }
        />
        <SettingRow
          label="Hydration reminders"
          control={
            <ThemedSwitch
              onValueChange={setHydrationReminders}
              value={hydrationReminders}
            />
          }
        />
      </Section>
      <View
        style={[styles.bottomLine, { backgroundColor: theme.colors.border }]}
      />
    </Screen>
  );
}

function Section({ children, title }: { children: ReactNode; title: string }) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function SettingRow({ control, label }: { control: ReactNode; label: string }) {
  const { theme } = useAppTheme();

  return (
    <View style={[styles.row, { borderTopColor: theme.colors.border }]}>
      <Text style={[styles.rowLabel, { color: theme.colors.text }]}>
        {label}
      </Text>
      {control}
    </View>
  );
}

function OptionSelector({
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
  const options = [
    { label: leftLabel, value: false },
    { label: rightLabel, value: true },
  ];

  return (
    <View
      style={[
        styles.optionSelector,
        {
          backgroundColor: theme.colors.surface,
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
            key={option.label}
            onPress={() => onValueChange(option.value)}
            style={[
              styles.option,
              option.value && {
                borderLeftColor: theme.colors.borderStrong,
                borderLeftWidth: StyleSheet.hairlineWidth,
              },
              isSelected && { backgroundColor: theme.colors.tertiary },
            ]}
          >
            <Text
              style={[
                styles.optionText,
                { color: isSelected ? "#FFFFFF" : theme.colors.textMuted },
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

function ThemedSwitch({
  onValueChange,
  value,
}: {
  onValueChange: (value: boolean) => void;
  value: boolean;
}) {
  return <SimpleSwitch onValueChange={onValueChange} value={value} />;
}

const styles = StyleSheet.create({
  section: {
    marginBottom: tokens.spacing.xxl,
  },
  sectionTitle: {
    fontSize: tokens.typography.sectionTitle.fontSize,
    fontWeight: tokens.typography.sectionTitle.fontWeight,
    letterSpacing: 0,
    lineHeight: tokens.typography.sectionTitle.lineHeight,
    marginBottom: tokens.spacing.sm,
    textTransform: "uppercase",
  },
  row: {
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 62,
    paddingVertical: tokens.spacing.md,
  },
  rowLabel: {
    flex: 1,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: tokens.typography.body.fontWeight,
    lineHeight: tokens.typography.body.lineHeight,
    paddingRight: tokens.spacing.lg,
  },
  optionSelector: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
    width: 166,
  },
  option: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: tokens.spacing.sm,
  },
  optionText: {
    fontSize: tokens.typography.label.fontSize,
    fontWeight: tokens.typography.label.fontWeight,
    lineHeight: tokens.typography.label.lineHeight,
    textAlign: "center",
  },
  bottomLine: {
    height: StyleSheet.hairlineWidth,
  },
});
