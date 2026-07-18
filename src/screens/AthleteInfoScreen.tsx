import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from "react-native";

import { PressOpacity } from "../components/PressOpacity";
import { Screen } from "../components/Screen";
import { type CombatSport, useAppState } from "../state/AppStateContext";
import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";

const tokens = themes.dark;
const combatSports: CombatSport[] = [
  "Muay Thai",
  "Kickboxing",
  "Boxing",
  "BJJ (Gi)",
  "BJJ (No-Gi)",
  "Judo",
  "Wrestling",
  "Karate",
];

const poundsPerKilogram = 2.2046226218;
const centimetersPerInch = 2.54;

function numberOrNull(value: string) {
  const numberValue = Number(value);

  return value && Number.isFinite(numberValue) ? numberValue : null;
}

function hasOneDecimalPlaceOrLess(value: string) {
  return /^\d*\.?\d?$/.test(value);
}

export function AthleteInfoScreen() {
  const { athleteProfile, setAthleteProfile, unitSettings } = useAppState();
  const { theme } = useAppTheme();
  const selectedSportsText = athleteProfile.sports.join(", ");
  const heightIsImperial = unitSettings.height === "imperial";
  const weightIsImperial = unitSettings.weight === "imperial";
  const heightInches = athleteProfile.heightCm === null
    ? null
    : athleteProfile.heightCm / centimetersPerInch;
  const heightFeet = heightInches === null ? null : Math.floor(heightInches / 12);
  const leftoverInches =
    heightInches === null || heightFeet === null
      ? null
      : Math.round(heightInches - heightFeet * 12);
  const weightPounds = athleteProfile.weightKg
    ? Math.round(athleteProfile.weightKg * poundsPerKilogram * 10) / 10
    : null;

  const updateProfile = (change: Partial<typeof athleteProfile>) => {
    setAthleteProfile({ ...athleteProfile, ...change });
  };

  const setAge = (value: string) => {
    updateProfile({ age: numberOrNull(value) });
  };

  const setMetricHeight = (value: string) => {
    updateProfile({ heightCm: numberOrNull(value) });
  };

  const setImperialHeight = (feetText: string, inchesText: string) => {
    const feet = numberOrNull(feetText) ?? 0;
    const inches = numberOrNull(inchesText) ?? 0;
    const totalInches = feet * 12 + inches;

    updateProfile({
      heightCm: totalInches > 0 ? Math.round(totalInches * centimetersPerInch * 10) / 10 : null,
    });
  };

  const setMetricWeight = (value: string) => {
    if (!hasOneDecimalPlaceOrLess(value)) {
      return;
    }

    updateProfile({ weightKg: numberOrNull(value) });
  };

  const setImperialWeight = (value: string) => {
    if (!hasOneDecimalPlaceOrLess(value)) {
      return;
    }

    const pounds = numberOrNull(value);

    updateProfile({
      weightKg: pounds ? Math.round((pounds / poundsPerKilogram) * 10) / 10 : null,
    });
  };

  const toggleSport = (sport: CombatSport) => {
    const sports = athleteProfile.sports.includes(sport)
      ? athleteProfile.sports.filter((selectedSport) => selectedSport !== sport)
      : [...athleteProfile.sports, sport];

    updateProfile({ sports });
  };

  return (
    <Screen title="Athlete Information">
      <ProfileField
        label="First Name"
        onChangeText={(firstName) => updateProfile({ firstName })}
        value={athleteProfile.firstName}
      />
      <ProfileField
        label="Last Name"
        onChangeText={(lastName) => updateProfile({ lastName })}
        value={athleteProfile.lastName}
      />
      <ProfileField
        keyboardType="numeric"
        label="Age"
        onChangeText={setAge}
        value={athleteProfile.age?.toString() ?? ""}
      />

      {heightIsImperial ? (
        <View style={[styles.field, { borderBottomColor: theme.colors.border }]}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Height</Text>
          <View style={styles.splitInputs}>
            <ProfileInput
              compact
              keyboardType="numeric"
              onChangeText={(feet) =>
                setImperialHeight(feet, leftoverInches?.toString() ?? "")
              }
              placeholder="ft"
              value={heightFeet?.toString() ?? ""}
            />
            <ProfileInput
              compact
              keyboardType="numeric"
              onChangeText={(inches) =>
                setImperialHeight(heightFeet?.toString() ?? "", inches)
              }
              placeholder="in"
              value={leftoverInches?.toString() ?? ""}
            />
          </View>
        </View>
      ) : (
        <ProfileField
          keyboardType="numeric"
          label="Height (cm)"
          onChangeText={setMetricHeight}
          value={athleteProfile.heightCm?.toString() ?? ""}
        />
      )}

      <ProfileField
        keyboardType="decimal-pad"
        label={weightIsImperial ? "Weight (lb)" : "Weight (kg)"}
        onChangeText={weightIsImperial ? setImperialWeight : setMetricWeight}
        value={
          weightIsImperial
            ? weightPounds?.toString() ?? ""
            : athleteProfile.weightKg?.toString() ?? ""
        }
      />

      <View style={styles.sportsSection}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Combat Sports
        </Text>
        <Text style={[styles.selectedSports, { color: theme.colors.textMuted }]}>
          {selectedSportsText || "None selected"}
        </Text>
        <View style={styles.sportGrid}>
          {combatSports.map((sport) => (
            <SportOption
              key={sport}
              label={sport}
              onPress={() => toggleSport(sport)}
              selected={athleteProfile.sports.includes(sport)}
            />
          ))}
        </View>
      </View>
    </Screen>
  );
}

function ProfileField({
  keyboardType = "default",
  label,
  onChangeText,
  value,
}: {
  keyboardType?: KeyboardTypeOptions;
  label: string;
  onChangeText: (value: string) => void;
  value: string;
}) {
  const { theme } = useAppTheme();
  const compact = keyboardType === "numeric";

  return (
    <View style={[styles.field, { borderBottomColor: theme.colors.border }]}>
      <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
      <ProfileInput
        compact={compact}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        value={value}
      />
    </View>
  );
}

function ProfileInput({
  compact = false,
  keyboardType = "default",
  onChangeText,
  placeholder,
  value,
}: {
  compact?: boolean;
  keyboardType?: KeyboardTypeOptions;
  onChangeText: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  const { theme } = useAppTheme();

  return (
    <TextInput
      keyboardType={keyboardType}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.colors.textMuted}
      style={[
        styles.input,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.borderStrong,
          color: theme.colors.text,
        },
        compact && styles.compactInput,
      ]}
      value={value}
    />
  );
}

function SportOption({
  label,
  onPress,
  selected,
}: {
  label: CombatSport;
  onPress: () => void;
  selected: boolean;
}) {
  const { theme } = useAppTheme();

  return (
    <PressOpacity
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.sportOption,
        {
          backgroundColor: selected ? theme.colors.tertiary : theme.colors.surface,
          borderColor: selected ? theme.colors.tertiary : theme.colors.borderStrong,
        },
      ]}
    >
      <Text
        style={[
          styles.sportText,
          { color: selected ? "#FFFFFF" : theme.colors.text },
        ]}
      >
        {label}
      </Text>
    </PressOpacity>
  );
}

const styles = StyleSheet.create({
  field: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: tokens.spacing.lg,
  },
  label: {
    flex: 1,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: tokens.typography.body.fontWeight,
    lineHeight: tokens.typography.body.lineHeight,
    paddingRight: tokens.spacing.lg,
  },
  input: {
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    fontSize: tokens.typography.body.fontSize,
    minHeight: 44,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    width: 190,
  },
  compactInput: {
    textAlign: "center",
    width: 82,
  },
  splitInputs: {
    flexDirection: "row",
    gap: tokens.spacing.md,
  },
  sportsSection: {
    paddingTop: tokens.spacing.xl,
  },
  sectionTitle: {
    fontSize: tokens.typography.sectionTitle.fontSize,
    fontWeight: tokens.typography.sectionTitle.fontWeight,
    letterSpacing: 0,
    lineHeight: tokens.typography.sectionTitle.lineHeight,
    marginBottom: tokens.spacing.sm,
    textTransform: "uppercase",
  },
  selectedSports: {
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
    marginBottom: tokens.spacing.md,
  },
  sportGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  sportOption: {
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  sportText: {
    fontSize: tokens.typography.label.fontSize,
    fontWeight: tokens.typography.label.fontWeight,
    lineHeight: tokens.typography.label.lineHeight,
  },
});
