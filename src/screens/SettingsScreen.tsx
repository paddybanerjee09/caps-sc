import Ionicons from "@expo/vector-icons/Ionicons";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { PressOpacity } from "../components/PressOpacity";
import { Screen } from "../components/Screen";
import { SimpleSwitch } from "../components/SimpleSwitch";
import { useAppState } from "../state/AppStateContext";
import { useAppTheme } from "../theme/ThemeContext";
import {
  tertiaryColorOptions,
  themes,
  type TertiaryColor,
} from "../theme/theme";

const tokens = themes.dark;

export function SettingsScreen() {
  const {
    colorScheme,
    setColorScheme,
    setTertiaryColor,
    tertiaryColor,
    theme,
  } = useAppTheme();
  const { setHeightUnit, setWeightUnit, unitSettings } = useAppState();
  const [distanceInMiles, setDistanceInMiles] = useState(false);
  const [weighInReminders, setWeighInReminders] = useState(false);
  const [trainingReminders, setTrainingReminders] = useState(false);
  const [hydrationReminders, setHydrationReminders] = useState(false);
  const [colorMenuOpen, setColorMenuOpen] = useState(false);

  const setThemeFromSwitch = (isLight: boolean) => {
    setColorScheme(isLight ? "light" : "dark");
  };

  return (
    <Screen title="Settings">
      <Section style={styles.appearanceSection} title="Appearance">
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
        <View style={styles.colorMenu}>
          <SettingRow
            label="Colour"
            control={
              <ColorSelector
                color={tertiaryColor}
                onPress={() => setColorMenuOpen((isOpen) => !isOpen)}
              />
            }
          />
          {colorMenuOpen ? (
            <ColorDropdown
              selectedColor={tertiaryColor}
              onSelect={(color) => {
                setTertiaryColor(color);
                setColorMenuOpen(false);
              }}
            />
          ) : null}
        </View>
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

function Section({
  children,
  style,
  title,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  title: string;
}) {
  const { theme } = useAppTheme();

  return (
    <View style={[styles.section, style]}>
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

function ColorSelector({
  color,
  onPress,
}: {
  color: TertiaryColor;
  onPress: () => void;
}) {
  const { theme } = useAppTheme();
  const selectedColor = tertiaryColorOptions.find(
    (option) => option.key === color,
  )!;

  return (
    <PressOpacity
      accessibilityLabel={`Colour, ${selectedColor.label}`}
      onPress={onPress}
      style={[
        styles.colorSelector,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.borderStrong,
        },
      ]}
    >
      <View
        style={[styles.colorCircle, { backgroundColor: selectedColor.hex }]}
      />
      <Text
        style={[styles.colorSelectorText, { color: theme.colors.text }]}
      >
        {selectedColor.label}
      </Text>
      <Ionicons
        color={theme.colors.textMuted}
        name="chevron-down"
        size={16}
      />
    </PressOpacity>
  );
}

function ColorDropdown({
  onSelect,
  selectedColor,
}: {
  onSelect: (color: TertiaryColor) => void;
  selectedColor: TertiaryColor;
}) {
  const { theme } = useAppTheme();

  return (
    <View
      style={[
        styles.colorDropdown,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.borderStrong,
        },
      ]}
    >
      {tertiaryColorOptions.map((option, index) => {
        const isSelected = option.key === selectedColor;

        return (
          <PressOpacity
            accessibilityLabel={`Use ${option.label}`}
            key={option.key}
            onPress={() => onSelect(option.key)}
            style={[
              styles.colorOption,
              index > 0 && {
                borderTopColor: theme.colors.border,
                borderTopWidth: StyleSheet.hairlineWidth,
              },
            ]}
          >
            <View style={styles.colorOptionLabel}>
              <View
                style={[styles.colorCircle, { backgroundColor: option.hex }]}
              />
              <Text
                style={[styles.colorOptionText, { color: theme.colors.text }]}
              >
                {option.label}
              </Text>
            </View>

            {isSelected ? (
              <Ionicons
                color={theme.colors.tertiary}
                name="checkmark"
                size={20}
              />
            ) : (
              <View style={styles.checkmarkSpace} />
            )}
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
  appearanceSection: {
    zIndex: 1,
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
  colorSelector: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.spacing.sm,
    minHeight: 34,
    minWidth: 132,
    paddingHorizontal: tokens.spacing.md,
  },
  colorCircle: {
    borderRadius: tokens.radius.pill,
    height: 14,
    width: 14,
  },
  colorSelectorText: {
    flex: 1,
    fontSize: tokens.typography.label.fontSize,
    fontWeight: tokens.typography.label.fontWeight,
    lineHeight: tokens.typography.label.lineHeight,
  },
  colorMenu: {
    position: "relative",
  },
  colorDropdown: {
    alignSelf: "flex-end",
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    elevation: 4,
    overflow: "hidden",
    position: "absolute",
    right: 0,
    top: "100%",
    width: 166,
    zIndex: 1,
  },
  colorOption: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 42,
    paddingHorizontal: tokens.spacing.md,
  },
  colorOptionLabel: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.sm,
  },
  colorOptionText: {
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
  },
  checkmarkSpace: {
    width: 20,
  },
  bottomLine: {
    height: StyleSheet.hairlineWidth,
  },
});
