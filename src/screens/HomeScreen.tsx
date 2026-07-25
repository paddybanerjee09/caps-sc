import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
} from "react"; // React imports
import {
  Animated,
  Easing,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import Ionicons from "@expo/vector-icons/Ionicons"; // Style Imports
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { PressOpacity } from "../components/PressOpacity";

import { useSQLiteContext } from "expo-sqlite"; // Database imports

import {
  addWeightLog,
  getTimelineEntriesForDay,
  type TimelineEntry,
} from "../data/timelineRepository";

import { Screen } from "../components/Screen"; // File imports
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

  const db = useSQLiteContext();

  const [timelineEntries, setTimelineEntries] = useState<TimelineEntry[]>([]);
  const [weightModalOpen, setWeightModalOpen] = useState(false);
  const [draftWeight, setDraftWeight] = useState("");

  const loadTodayEntries = useCallback(async () => {
    const { dayStart, dayEnd } = getTodayBounds();

    const entries = await getTimelineEntriesForDay(db, dayStart, dayEnd);

    setTimelineEntries(entries);
  }, [db]);

  useEffect(() => {
    void loadTodayEntries();
  }, [loadTodayEntries]);

  function openWeightLog() {
    setDraftWeight("");
    setWeightModalOpen(true);
  }

  async function saveWeightLog() {
    const enteredWeight = Number(draftWeight);

    if (!Number.isFinite(enteredWeight) || enteredWeight <= 0) {
      return;
    }

    const weightKg =
      unitSettings.weight === "metric"
        ? enteredWeight
        : enteredWeight / 2.20462;

    await addWeightLog(db, weightKg);
    await loadTodayEntries();

    setWeightModalOpen(false);
    setDraftWeight("");
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
            <QuickLogOption icon="barbell-outline" label="Strength Training" />

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

            <QuickLogOption
              icon="scale-outline"
              label="Weight"
              onPress={openWeightLog}
            />

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
        {selectedHomeSection === "today" &&
          (timelineEntries.length === 0 ? (
            <Text
              style={[styles.homeSectionText, { color: theme.colors.text }]}
            >
              No entries today
            </Text>
          ) : (
            <View>
              {timelineEntries.map((entry) => (
                <Text
                  key={entry.id}
                  style={[styles.homeSectionText, { color: theme.colors.text }]}
                >
                  {formatTime(entry.startAt)} —{" "}
                  {entry.kind === "weight" && entry.weightKg !== null
                    ? formatWeight(entry.weightKg, unitSettings.weight)
                    : entry.title}
                </Text>
              ))}
            </View>
          ))}

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

      <Modal
        animationType="fade"
        onRequestClose={() => setWeightModalOpen(false)}
        transparent
        visible={weightModalOpen}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modal, { backgroundColor: theme.colors.surface }]}
          >
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Weight
            </Text>

            <View style={styles.weightInputRow}>
              <TextInput
                accessibilityLabel={`Weight in ${
                  unitSettings.weight === "metric" ? "kilograms" : "pounds"
                }`}
                keyboardType="decimal-pad"
                onChangeText={(value) => {
                  if (/^\d*\.?\d*$/.test(value)) {
                    setDraftWeight(value);
                  }
                }}
                placeholder="0.0"
                placeholderTextColor={theme.colors.textMuted}
                selectionColor={theme.colors.tertiary}
                style={[
                  styles.weightInput,
                  {
                    borderColor: theme.colors.borderStrong,
                    color: theme.colors.text,
                  },
                ]}
                value={draftWeight}
              />

              <Text style={[styles.weightUnit, { color: theme.colors.text }]}>
                {unitSettings.weight === "metric" ? "kg" : "lbs"}
              </Text>
            </View>

            <View style={styles.modalActions}>
              <PressOpacity onPress={() => setWeightModalOpen(false)}>
                <Text style={{ color: theme.colors.textMuted }}>Cancel</Text>
              </PressOpacity>

              <PressOpacity onPress={saveWeightLog}>
                <Text style={{ color: theme.colors.tertiary }}>Save</Text>
              </PressOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function getTodayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    dayStart: start.getTime(),
    dayEnd: end.getTime(),
  };
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
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
  modalOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.58)",
    flex: 1,
    justifyContent: "center",
    padding: tokens.spacing.xl,
  },
  modal: {
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.xl,
    width: "100%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  weightInputRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.sm,
    justifyContent: "center",
    paddingTop: tokens.spacing.xl,
  },
  weightInput: {
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    fontSize: tokens.typography.body.fontSize,
    minHeight: 44,
    paddingHorizontal: tokens.spacing.md,
    textAlign: "center",
    width: 100,
  },
  weightUnit: {
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
  },
  modalActions: {
    flexDirection: "row",
    gap: tokens.spacing.xl,
    justifyContent: "flex-end",
    paddingTop: tokens.spacing.lg,
  },
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
