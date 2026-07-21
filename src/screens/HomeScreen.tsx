import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";

import { Screen } from "../components/Screen";
import { useAppState, type UnitSystem } from "../state/AppStateContext";
import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";

const tokens = themes.dark;

export function HomeScreen() {
  const { theme } = useAppTheme();
  const { athleteProfile, unitSettings, username } = useAppState();
  const ageText =
    athleteProfile.age === null
      ? "Not selected"
      : `${athleteProfile.age} years old`;
  const heightText = formatHeight(
    athleteProfile.heightCm,
    unitSettings.height,
  );
  const weightText = formatWeight(
    athleteProfile.weightKg,
    unitSettings.weight,
  );
  const sportsText = formatSports(athleteProfile.sports);

  return (
    <Screen title="Home">
      <View
        style={[
          styles.profile,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Text
          style={[styles.subtitle, { color: theme.colors.text }]}
        >
          Profile
        </Text>

        <View style={styles.profileContent}>
          <View
            style={[
              styles.profileImage,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.borderStrong,
              },
            ]}
          >
            <Ionicons
              color={theme.colors.textMuted}
              name="person"
              size={40}
            />
          </View>

          <View style={styles.profileDetails}>
            <View style={styles.summaryRow}>
              <Text
                numberOfLines={1}
                style={[
                  styles.infoText,
                  styles.username,
                  { color: theme.colors.text },
                ]}
              >
                {username || "Not selected"}
              </Text>

              <Text
                style={[styles.infoText, { color: theme.colors.text }]}
              >
                {weightText}
              </Text>
            </View>

            <Text
              style={[styles.infoText, { color: theme.colors.text }]}
            >
              {ageText}
            </Text>

            <Text
              style={[styles.infoText, { color: theme.colors.text }]}
            >
              {heightText}
            </Text>

            <Text
              numberOfLines={1}
              style={[styles.infoText, { color: theme.colors.text }]}
            >
              {sportsText}
            </Text>
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    padding: tokens.spacing.lg,
  },
  profileContent: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.lg,
    paddingTop: tokens.spacing.md,
  },
  profileImage: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    height: 76,
    justifyContent: "center",
    width: 76,
  },
  profileDetails: {
    flex: 1,
    gap: tokens.spacing.xs,
    minWidth: 0,
  },
  summaryRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: tokens.spacing.md,
    justifyContent: "space-between",
  },
  infoText: {
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
  },
  username: {
    fontWeight: "700",
    flexShrink: 1,
  },
  subtitle: {
    fontSize: tokens.typography.sectionTitle.fontSize,
    fontWeight: tokens.typography.sectionTitle.fontWeight,
    lineHeight: tokens.typography.sectionTitle.lineHeight,
  },
});

function formatHeight(heightCm: number | null, unit: UnitSystem) {
  if (heightCm === null) {
    return "Not selected";
  }

  if (unit === "metric") {
    return `${heightCm}cm`;
  }

  const totalInches = Math.round(heightCm / 2.54);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet}'${inches}\"`;
}

function formatWeight(weightKg: number | null, unit: UnitSystem) {
  if (weightKg === null) {
    return "Not selected";
  }

  return unit === "metric"
    ? `${weightKg.toFixed(1)}kg`
    : `${(weightKg * 2.20462).toFixed(1)}lbs`;
}

function formatSports(sports: string[]) {
  if (sports.length === 0) {
    return "Not selected";
  }

  const displayedSports = sports.slice(0, 3).join(", ");
  return sports.length > 3 ? `${displayedSports}, ...` : displayedSports;
}
