import { useState } from "react";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Screen } from "../components/Screen";
import { SimpleSwitch } from "../components/SimpleSwitch";
import type { RouteKey } from "../navigation/routes";
import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";

const tokens = themes.dark;

type ScreenForRouteProps = {
  route: RouteKey;
};

export function ScreenForRoute({ route }: ScreenForRouteProps) {
  switch (route) {
    case "nutrition":
      return <Screen title="Nutrition" />;
    case "sportTraining":
      return <Screen title="Sport" />;
    case "strengthConditioning":
      return <Screen title="S&C" />;
    case "progress":
      return <Screen title="Progress" />;
    case "settings":
      return <SettingsScreen />;
    case "accountInfo":
      return <Screen title="Account Info" />;
    case "athleteInfo":
      return <AthleteInfoScreen />;
    case "home":
    default:
      return <Screen title="Home" />;
  }
}

function SettingsScreen() {
  const { colorScheme, setColorScheme, theme } = useAppTheme();
  const [weightInPounds, setWeightInPounds] = useState(false);
  const [heightInInches, setHeightInInches] = useState(false);
  const [distanceInKilometers, setDistanceInKilometers] = useState(false);
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
            <SwitchScale
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
          label="Weight"
          control={
            <SwitchScale
              leftLabel="kg"
              onValueChange={setWeightInPounds}
              rightLabel="lb"
              value={weightInPounds}
            />
          }
        />
        <SettingRow
          label="Height"
          control={
            <SwitchScale
              leftLabel="cm"
              onValueChange={setHeightInInches}
              rightLabel="inches"
              value={heightInInches}
            />
          }
        />
        <SettingRow
          label="Distance"
          control={
            <SwitchScale
              leftLabel="mi"
              onValueChange={setDistanceInKilometers}
              rightLabel="km"
              value={distanceInKilometers}
            />
          }
        />
      </Section>

      <Section title="Notifications">
        <SettingRow
          label="Weigh-in reminders"
          control={
            <ThemedSwitch onValueChange={setWeighInReminders} value={weighInReminders} />
          }
        />
        <SettingRow
          label="Training reminders"
          control={
            <ThemedSwitch onValueChange={setTrainingReminders} value={trainingReminders} />
          }
        />
        <SettingRow
          label="Hydration reminders"
          control={
            <ThemedSwitch onValueChange={setHydrationReminders} value={hydrationReminders} />
          }
        />
      </Section>
      <View style={[styles.bottomLine, { backgroundColor: theme.colors.border }]} />
    </Screen>
  );
}

function AthleteInfoScreen() {
  return (
    <Screen title="Athlete Info">
      <PlaceholderField label="Height" />
      <PlaceholderField label="Bodyweight" />
    </Screen>
  );
}

function Section({ children, title }: { children: ReactNode; title: string }) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{title}</Text>
      {children}
    </View>
  );
}

function SettingRow({ control, label }: { control: ReactNode; label: string }) {
  const { theme } = useAppTheme();

  return (
    <View style={[styles.row, { borderTopColor: theme.colors.border }]}>
      <Text style={[styles.rowLabel, { color: theme.colors.text }]}>{label}</Text>
      {control}
    </View>
  );
}

function SwitchScale({
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

  return (
    <View style={styles.switchScale}>
      <Text
        style={[
          styles.switchLabel,
          { color: value ? theme.colors.textMuted : theme.colors.accent },
        ]}
      >
        {leftLabel}
      </Text>
      <ThemedSwitch onValueChange={onValueChange} value={value} />
      <Text
        style={[
          styles.switchLabel,
          { color: value ? theme.colors.accent : theme.colors.textMuted },
        ]}
      >
        {rightLabel}
      </Text>
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
  return (
    <SimpleSwitch onValueChange={onValueChange} value={value} />
  );
}

function PlaceholderField({ label }: { label: string }) {
  const { theme } = useAppTheme();

  return (
    <View style={[styles.field, { borderBottomColor: theme.colors.border }]}>
      <Text style={[styles.rowLabel, { color: theme.colors.text }]}>{label}</Text>
      <View style={[styles.placeholderLine, { backgroundColor: theme.colors.borderStrong }]} />
    </View>
  );
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
  switchScale: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.sm,
  },
  switchLabel: {
    fontSize: tokens.typography.label.fontSize,
    fontWeight: tokens.typography.label.fontWeight,
    lineHeight: tokens.typography.label.lineHeight,
    minWidth: 48,
    textAlign: "center",
  },
  field: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: tokens.spacing.lg,
  },
  placeholderLine: {
    borderRadius: tokens.radius.pill,
    height: 2,
    marginTop: tokens.spacing.md,
    width: "48%",
  },
  bottomLine: {
    height: StyleSheet.hairlineWidth,
  },
});
