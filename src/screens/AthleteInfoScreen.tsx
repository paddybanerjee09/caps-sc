import Ionicons from "@expo/vector-icons/Ionicons";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { PressOpacity } from "../components/PressOpacity";
import { Screen } from "../components/Screen";
import { WeightLogModal } from "../components/WeightLogModal";
import {
  useAppState,
  type CombatSport,
  type UnitSystem,
} from "../state/AppStateContext";
import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
import { formatWeight } from "../utils/weight";

import DateTimePicker from "@react-native-community/datetimepicker";
import { useState } from "react";

const tokens = themes.dark;
const centimetersPerInch = 2.54;
const defaultDateOfBirth = new Date(2009, 2, 4);
type Sex = "Male" | "Female";
const sexOptions: Sex[] = ["Male", "Female"];

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

export function AthleteInfoScreen() {
  const { colorScheme, theme } = useAppTheme();
  const { athleteProfile, setAthleteProfile, unitSettings } = useAppState();

  const [dateOfBirth, setDateOfBirth] =
    useState<Date | null>(defaultDateOfBirth);
  const [draftDate, setDraftDate] = useState<Date>(defaultDateOfBirth);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const [sex, setSex] = useState<Sex | null>(null);
  const [sexPickerOpen, setSexPickerOpen] = useState(false);

  const [heightPickerOpen, setHeightPickerOpen] = useState(false);
  const [draftMetricHeight, setDraftMetricHeight] = useState("");
  const [draftFeet, setDraftFeet] = useState("");
  const [draftInches, setDraftInches] = useState("");

  const [sportsPickerOpen, setSportsPickerOpen] = useState(false);
  const [sportSearch, setSportSearch] = useState("");
  const [weightModalOpen, setWeightModalOpen] = useState(false);

  function openDatePicker() {
    setDraftDate(dateOfBirth ?? new Date());
    setDatePickerOpen(true);
  }

  function saveDateOfBirth() {
    setDateOfBirth(draftDate);
    setAthleteProfile({
      ...athleteProfile,
      age: calculateAge(draftDate),
    });
    setDatePickerOpen(false);
  }

  function openHeightPicker() {
    const savedHeight = athleteProfile.heightCm;

    if (savedHeight === null) {
      setDraftMetricHeight("");
      setDraftFeet("");
      setDraftInches("");
    } else if (unitSettings.height === "metric") {
      setDraftMetricHeight(String(savedHeight));
    } else {
      const imperialHeight = centimetersToImperial(savedHeight);
      setDraftFeet(String(imperialHeight.feet));
      setDraftInches(String(imperialHeight.inches));
    }

    setHeightPickerOpen(true);
  }

  function saveHeight() {
    let heightCm: number | null = null;

    if (unitSettings.height === "metric") {
      const metricHeight = Number(draftMetricHeight);
      heightCm = metricHeight > 0 ? metricHeight : null;
    } else {
      const totalInches =
        Number(draftFeet || 0) * 12 + Number(draftInches || 0);
      heightCm =
        totalInches > 0
          ? Math.round(totalInches * centimetersPerInch * 10) / 10
          : null;
    }

    setAthleteProfile({ ...athleteProfile, heightCm });
    setHeightPickerOpen(false);
  }

  function openSportsPicker() {
    setSportSearch("");
    setSportsPickerOpen(true);
  }

  function toggleSport(sport: CombatSport) {
    const sports = athleteProfile.sports.includes(sport)
      ? athleteProfile.sports.filter((currentSport) => currentSport !== sport)
      : [...athleteProfile.sports, sport];

    setAthleteProfile({ ...athleteProfile, sports });
  }

  const ageText =
    athleteProfile.age === null
      ? "Not selected"
      : `${athleteProfile.age} years old`;
  const weightText = formatWeight(
    athleteProfile.weightKg,
    unitSettings.weight,
  );
  const heightText = formatHeight(athleteProfile.heightCm, unitSettings.height);
  const sportsText = formatSports(athleteProfile.sports);
  const filteredSportOptions = sportOptions.filter((sport) =>
    sport.toLowerCase().includes(sportSearch.trim().toLowerCase()),
  );

  return (
    <Screen title="Athlete Information">
      <InfoRow label="Age" value={ageText} onPress={openDatePicker} />

      <InfoRow
        label="Sex"
        value={sex ?? "Not selected"}
        onPress={() => setSexPickerOpen(true)}
      />

      <InfoRow
        label="Weight"
        value={weightText}
        onPress={() => setWeightModalOpen(true)}
      />

      <InfoRow label="Height" value={heightText} onPress={openHeightPicker} />

      <InfoRow label="Sports" value={sportsText} onPress={openSportsPicker} />

      <Modal
        animationType="fade"
        transparent
        visible={datePickerOpen}
        onRequestClose={() => setDatePickerOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modal, { backgroundColor: theme.colors.surface }]}
          >
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Date of birth
            </Text>
            <View style={styles.modalContainer}>
              <DateTimePicker
                display="spinner"
                maximumDate={new Date()}
                mode="date"
                onChange={(_, selectedDate) => {
                  if (selectedDate) {
                    setDraftDate(selectedDate);
                  }
                }}
                style={styles.datePicker}
                textColor={theme.colors.text}
                themeVariant={colorScheme}
                value={draftDate}
              />
            </View>
            <View style={styles.modalActions}>
              <PressOpacity onPress={() => setDatePickerOpen(false)}>
                <Text style={{ color: theme.colors.textMuted }}>Cancel</Text>
              </PressOpacity>
              <PressOpacity onPress={saveDateOfBirth}>
                <Text style={{ color: theme.colors.tertiary }}>Save</Text>
              </PressOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setSexPickerOpen(false)}
        transparent
        visible={sexPickerOpen}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modal, { backgroundColor: theme.colors.surface }]}
          >
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Sex
            </Text>

            <View style={styles.sexOptions}>
              {sexOptions.map((option) => {
                const isSelected = sex === option;

                return (
                  <PressOpacity
                    accessibilityLabel={`Select ${option}`}
                    key={option}
                    onPress={() => {
                      setSex(option);
                      setSexPickerOpen(false);
                    }}
                    style={[
                      styles.sexOption,
                      {
                        backgroundColor: isSelected
                          ? theme.colors.tertiary
                          : theme.colors.surfaceMuted,
                        borderColor: theme.colors.borderStrong,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.sexOptionText,
                        {
                          color: isSelected ? "#FFFFFF" : theme.colors.text,
                        },
                      ]}
                    >
                      {option}
                    </Text>
                  </PressOpacity>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <PressOpacity onPress={() => setSexPickerOpen(false)}>
                <Text style={{ color: theme.colors.textMuted }}>Cancel</Text>
              </PressOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setHeightPickerOpen(false)}
        transparent
        visible={heightPickerOpen}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modal, { backgroundColor: theme.colors.surface }]}
          >
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Height
            </Text>

            <View style={styles.heightInputs}>
              {unitSettings.height === "metric" ? (
                <View style={styles.heightInputGroup}>
                  <TextInput
                    accessibilityLabel="Height in centimeters"
                    keyboardType="number-pad"
                    maxLength={3}
                    onChangeText={(value) => {
                      if (isWholeNumberAtMost(value, 400)) {
                        setDraftMetricHeight(value);
                      }
                    }}
                    selectionColor={theme.colors.tertiary}
                    style={[
                      styles.heightInput,
                      {
                        borderColor: theme.colors.borderStrong,
                        color: theme.colors.text,
                      },
                    ]}
                    value={draftMetricHeight}
                  />
                  <Text
                    style={[styles.heightUnit, { color: theme.colors.text }]}
                  >
                    cm
                  </Text>
                </View>
              ) : (
                <View style={styles.heightInputsImperial}>
                  <View style={styles.heightInputGroup}>
                    <TextInput
                      accessibilityLabel="Height in feet"
                      keyboardType="number-pad"
                      maxLength={1}
                      onChangeText={(value) => {
                        if (isWholeNumberAtMost(value, 9)) {
                          setDraftFeet(value);
                        }
                      }}
                      selectionColor={theme.colors.tertiary}
                      style={[
                        styles.heightInput,
                        {
                          borderColor: theme.colors.borderStrong,
                          color: theme.colors.text,
                        },
                      ]}
                      value={draftFeet}
                    />
                    <Text
                      style={[styles.heightUnit, { color: theme.colors.text }]}
                    >
                      ft
                    </Text>
                  </View>

                  <View style={styles.heightInputGroup}>
                    <TextInput
                      accessibilityLabel="Height in inches"
                      keyboardType="number-pad"
                      maxLength={2}
                      onChangeText={(value) => {
                        if (isWholeNumberAtMost(value, 12)) {
                          setDraftInches(value);
                        }
                      }}
                      selectionColor={theme.colors.tertiary}
                      style={[
                        styles.heightInput,
                        {
                          borderColor: theme.colors.borderStrong,
                          color: theme.colors.text,
                        },
                      ]}
                      value={draftInches}
                    />
                    <Text
                      style={[styles.heightUnit, { color: theme.colors.text }]}
                    >
                      in
                    </Text>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.modalActions}>
              <PressOpacity onPress={() => setHeightPickerOpen(false)}>
                <Text style={{ color: theme.colors.textMuted }}>Cancel</Text>
              </PressOpacity>
              <PressOpacity onPress={saveHeight}>
                <Text style={{ color: theme.colors.tertiary }}>Save</Text>
              </PressOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setSportsPickerOpen(false)}
        transparent
        visible={sportsPickerOpen}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modal, { backgroundColor: theme.colors.surface }]}
          >
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Add Sport
            </Text>

            <View
              style={[
                styles.sportsDropdown,
                { borderColor: theme.colors.borderStrong },
              ]}
            >
              <TextInput
                accessibilityLabel="Search sports"
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setSportSearch}
                placeholder="Search sports"
                placeholderTextColor={theme.colors.textMuted}
                returnKeyType="search"
                selectionColor={theme.colors.tertiary}
                style={[
                  styles.sportSearch,
                  {
                    borderBottomColor: theme.colors.borderStrong,
                    color: theme.colors.text,
                  },
                ]}
                value={sportSearch}
              />

              <ScrollView
                keyboardShouldPersistTaps="handled"
                style={styles.sportsList}
              >
                {filteredSportOptions.map((sport) => {
                  const isSelected = athleteProfile.sports.includes(sport);

                  return (
                    <PressOpacity
                      accessibilityLabel={`${sport}, ${
                        isSelected ? "selected" : "not selected"
                      }`}
                      key={sport}
                      onPress={() => toggleSport(sport)}
                      style={[
                        styles.sportOption,
                        { borderBottomColor: theme.colors.border },
                      ]}
                    >
                      <Text
                        style={[
                          styles.sportOptionText,
                          { color: theme.colors.text },
                        ]}
                      >
                        {sport}
                      </Text>
                      {isSelected ? (
                        <Ionicons
                          color={theme.colors.tertiary}
                          name="checkmark"
                          size={20}
                        />
                      ) : null}
                    </PressOpacity>
                  );
                })}

                {filteredSportOptions.length === 0 ? (
                  <Text
                    style={[
                      styles.noSportsText,
                      { color: theme.colors.textMuted },
                    ]}
                  >
                    No sports found
                  </Text>
                ) : null}
              </ScrollView>
            </View>

            <View style={styles.modalActions}>
              <PressOpacity onPress={() => setSportsPickerOpen(false)}>
                <Text style={{ color: theme.colors.tertiary }}>Done</Text>
              </PressOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <WeightLogModal
        onClose={() => setWeightModalOpen(false)}
        visible={weightModalOpen}
      />
    </Screen>
  );
}

type InfoRowProps = {
  label: string;
  value: string;
  onPress?: () => void;
};

function InfoRow({ label, value, onPress }: InfoRowProps) {
  const { theme } = useAppTheme();

  return (
    <PressOpacity
      accessibilityLabel={`${label}, ${value}`}
      onPress={onPress}
      style={[styles.row, { borderColor: theme.colors.border }]}
    >
      <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>

      <View style={styles.value}>
        <Text style={[styles.valueText, { color: theme.colors.textMuted }]}>
          {value}
        </Text>

        <Ionicons
          color={theme.colors.textMuted}
          name="chevron-forward"
          size={18}
        />
      </View>
    </PressOpacity>
  );
}

function calculateAge(dateOfBirth: Date) {
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();

  const birthdayHasHappened =
    today.getMonth() > dateOfBirth.getMonth() ||
    (today.getMonth() === dateOfBirth.getMonth() &&
      today.getDate() >= dateOfBirth.getDate());

  if (!birthdayHasHappened) {
    age -= 1;
  }

  return age;
}

function centimetersToImperial(heightCm: number) {
  const totalInches = Math.round(heightCm / centimetersPerInch);

  return {
    feet: Math.floor(totalInches / 12),
    inches: totalInches % 12,
  };
}

function formatHeight(heightCm: number | null, unit: UnitSystem) {
  if (heightCm === null) {
    return "Not selected";
  }

  if (unit === "metric") {
    return `${heightCm} cm`;
  }

  const imperialHeight = centimetersToImperial(heightCm);
  return `${imperialHeight.feet}'${imperialHeight.inches}"`;
}

function isWholeNumberAtMost(value: string, maximum: number) {
  return /^\d*$/.test(value) && (value === "" || Number(value) <= maximum);
}

function formatSports(athleteSports: CombatSport[]) {
  if (athleteSports.length === 0) {
    return "Not selected";
  }

  const displayedSports = athleteSports.slice(0, 3).join(", ");
  return athleteSports.length > 3 ? `${displayedSports}, ...` : displayedSports;
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 56,
    paddingVertical: tokens.spacing.md,
  },
  value: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.xs,
  },
  valueText: {
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
  },
  label: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "700",
    lineHeight: tokens.typography.body.lineHeight,
  },
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
  modalActions: {
    flexDirection: "row",
    gap: tokens.spacing.xl,
    justifyContent: "flex-end",
    paddingTop: tokens.spacing.lg,
  },
  modalContainer: {
    alignItems: "center",
    width: "100%",
  },
  datePicker: {
    alignSelf: "center",
    maxWidth: 320,
    width: "100%",
  },
  sexOptions: {
    gap: tokens.spacing.md,
    paddingTop: tokens.spacing.xl,
  },
  sexOption: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: tokens.spacing.lg,
  },
  sexOptionText: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "700",
    lineHeight: tokens.typography.body.lineHeight,
  },
  heightInputs: {
    alignItems: "center",
    paddingTop: tokens.spacing.xl,
  },
  heightInputsImperial: {
    flexDirection: "row",
    gap: tokens.spacing.xl,
  },
  heightInputGroup: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.sm,
  },
  heightInput: {
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    fontSize: tokens.typography.body.fontSize,
    minHeight: 44,
    paddingHorizontal: tokens.spacing.md,
    textAlign: "center",
    width: 72,
  },
  heightUnit: {
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
  },
  sportsDropdown: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    marginTop: tokens.spacing.xl,
    overflow: "hidden",
  },
  sportSearch: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    fontSize: tokens.typography.body.fontSize,
    minHeight: 48,
    paddingHorizontal: tokens.spacing.md,
  },
  sportsList: {
    maxHeight: 280,
  },
  sportOption: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: tokens.spacing.md,
  },
  sportOptionText: {
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
  },
  noSportsText: {
    fontSize: tokens.typography.body.fontSize,
    padding: tokens.spacing.lg,
    textAlign: "center",
  },
});
