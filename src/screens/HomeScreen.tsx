import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRef, useState, type ComponentProps } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { PressOpacity } from "../components/PressOpacity";

import { Screen } from "../components/Screen";
import { useAppState, type UnitSystem } from "../state/AppStateContext";
import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";

const tokens = themes.dark;

type HomeSection = "today" | "recovery" | "progress";

const homeSections: { key: HomeSection; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "recovery", label: "Recovery" },
  { key: "progress", label: "Progress" },
];

export function HomeScreen() {
  const { theme } = useAppTheme();
  const { athleteProfile, unitSettings, username } = useAppState();

  const ageText =
    athleteProfile.age === null
      ? "Not selected"
      : `${athleteProfile.age} years old`;

  const heightText = formatHeight(athleteProfile.heightCm, unitSettings.height);
  const weightText = formatWeight(athleteProfile.weightKg, unitSettings.weight);
  const sportsText = formatSports(athleteProfile.sports);

  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const quickLogAnimation = useRef(new Animated.Value(0)).current;

  const [selectedHomeSection, setSelectedHomeSection] =
    useState<HomeSection>("today");

  function toggleQuickLogMenu() {
    const willOpen = !quickLogOpen;

    setQuickLogOpen(willOpen);

    Animated.timing(quickLogAnimation, {
      toValue: willOpen ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }

  return (
    <Screen centerTitle title="Home">
      <View
        style={[
          styles.profile,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Text style={[styles.subtitle, { color: theme.colors.text }]}>
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
            <Ionicons color={theme.colors.textMuted} name="person" size={40} />
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

              <Text style={[styles.infoText, { color: theme.colors.text }]}>
                {weightText}
              </Text>
            </View>

            <Text style={[styles.infoText, { color: theme.colors.text }]}>
              {ageText}
            </Text>

            <Text style={[styles.infoText, { color: theme.colors.text }]}>
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

      <PressOpacity
        accessibilityLabel="Quick Log"
        style={[
          styles.quickLogButton,
          { backgroundColor: theme.colors.tertiary },
        ]}
        onPress={toggleQuickLogMenu}
      >
        <Text style={styles.quickLogButtonText}>Quick Log</Text>
      </PressOpacity>

      <Animated.View
        style={[
          styles.quickLogMenuWrapper,
          {
            height: quickLogAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 188],
            }),
            opacity: quickLogAnimation,
            transform: [
              {
                translateY: quickLogAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View
          style={[
            styles.quickLogMenu,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <View style={styles.quickLogGrid}>
            <QuickLogOption icon="barbell-outline" label="Strength Workout" />

            <QuickLogOption
              icon="run-fast"
              iconSet="materialCommunity"
              label="Conditioning"
            />

            <QuickLogOption
              icon="boxing-glove"
              iconSet="materialCommunity"
              label="Skills Training"
            />

            <QuickLogOption icon="restaurant-outline" label="Meal" />

            <QuickLogOption icon="scale-outline" label="Weight" />

            <QuickLogOption icon="moon-outline" label="Sleep" />
          </View>
        </View>
      </Animated.View>

      <View
        style={[
          styles.homeSelector,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        {homeSections.map((section) => {
          const isSelected = selectedHomeSection === section.key;

          return (
            <PressOpacity
              accessibilityLabel={`Show ${section.label}`}
              accessibilityRole="tab"
              key={section.key}
              onPress={() => setSelectedHomeSection(section.key)}
              style={[
                styles.homeSelectorOption,
                isSelected && {
                  backgroundColor: theme.colors.surfaceMuted,
                },
              ]}
            >
              <Text
                style={[
                  styles.homeSelectorText,
                  {
                    color: isSelected
                      ? theme.colors.tertiary
                      : theme.colors.textMuted,
                  },
                ]}
              >
                {section.label}
              </Text>
            </PressOpacity>
          );
        })}
      </View>

      <View
        style={[
          styles.homeSectionContent,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        {selectedHomeSection === "today" && (
          <Text style={[styles.homeSectionText, { color: theme.colors.text }]}>
            Today’s timeline will go here
          </Text>
        )}

        {selectedHomeSection === "recovery" && (
          <Text style={[styles.homeSectionText, { color: theme.colors.text }]}>
            Recovery information will go here
          </Text>
        )}

        {selectedHomeSection === "progress" && (
          <Text style={[styles.homeSectionText, { color: theme.colors.text }]}>
            Progress charts will go here
          </Text>
        )}
      </View>
    </Screen>
  );
}

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

type QuickLogOptionProps = {
  label: string;
  onPress?: () => void;
} & (
  | {
      icon: ComponentProps<typeof Ionicons>["name"];
      iconSet?: "ionicons";
    }
  | {
      icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
      iconSet: "materialCommunity";
    }
);

function QuickLogOption(props: QuickLogOptionProps) {
  const { theme } = useAppTheme();
  const { label, onPress } = props;

  return (
    <PressOpacity
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.quickLogOption,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <View style={styles.quickLogOptionIcon}>
        {props.iconSet === "materialCommunity" ? (
          <MaterialCommunityIcons
            color={theme.colors.tertiary}
            name={props.icon}
            size={28}
          />
        ) : (
          <Ionicons color={theme.colors.tertiary} name={props.icon} size={28} />
        )}
      </View>

      <Text
        numberOfLines={2}
        style={[styles.quickLogOptionText, { color: theme.colors.text }]}
      >
        {label}
      </Text>
    </PressOpacity>
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
  quickLogButton: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    justifyContent: "center",
    marginTop: tokens.spacing.lg,
    minHeight: 25,
    width: "100%",
  },
  quickLogButtonText: {
    color: "#FFFFFF",
    fontSize: tokens.typography.label.fontSize,
    fontWeight: "600",
    lineHeight: tokens.typography.body.lineHeight,
  },
  quickLogMenuWrapper: {
    overflow: "hidden",
  },
  quickLogMenu: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
  },
  quickLogOption: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    height: 76,
    padding: tokens.spacing.xs,
    width: "31%",
  },
  quickLogOptionIcon: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  quickLogOptionText: {
    fontSize: 8,
    fontWeight: "700",
    lineHeight: 12,
    minHeight: 16,
    textAlign: "center",
  },
  quickLogGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
    justifyContent: "space-between",
  },
  homeSelector: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    marginTop: tokens.spacing.lg,
    overflow: "hidden",
    width: "100%",
  },
  homeSelectorOption: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 25,
  },
  homeSelectorText: {
    fontSize: tokens.typography.label.fontSize,
    fontWeight: "700",
    lineHeight: tokens.typography.label.lineHeight,
  },
  homeSectionContent: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    marginTop: tokens.spacing.lg,
    minHeight: 160,
    padding: tokens.spacing.lg,
  },
  homeSectionText: {
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
  },
});
