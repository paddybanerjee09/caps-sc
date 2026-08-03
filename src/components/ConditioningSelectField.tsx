import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";

const tokens = themes.dark;

export type ConditioningSelectOption<Value extends string> = {
  key: Value;
  label: string;
};

type ConditioningSelectFieldProps<Value extends string> = {
  accessibilityHint?: string;
  disabled?: boolean;
  label: string;
  onChange: (value: Value) => void;
  options: readonly ConditioningSelectOption<Value>[];
  value: Value;
};

export function ConditioningSelectField<Value extends string>({
  accessibilityHint,
  disabled = false,
  label,
  onChange,
  options,
  value,
}: ConditioningSelectFieldProps<Value>) {
  const { theme } = useAppTheme();
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => option.key === value);

  function selectOption(nextValue: Value) {
    onChange(nextValue);
    setOpen(false);
  }

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>

      <View
        style={[
          styles.selector,
          {
            borderColor: theme.colors.borderStrong,
            opacity: disabled ? tokens.opacity.disabled : 1,
          },
        ]}
      >
        <Pressable
          accessibilityHint={accessibilityHint}
          accessibilityLabel={`${label}, ${selectedOption?.label ?? "not selected"}`}
          accessibilityRole="button"
          accessibilityState={{ disabled, expanded: open }}
          disabled={disabled}
          onPress={() => setOpen((currentValue) => !currentValue)}
          style={({ pressed }) => [
            styles.selectorButton,
            { backgroundColor: theme.colors.surfaceMuted },
            pressed && !disabled && { opacity: tokens.opacity.pressed },
          ]}
        >
          <Text
            numberOfLines={2}
            style={[styles.selectedLabel, { color: theme.colors.text }]}
          >
            {selectedOption?.label ?? "Choose an option"}
          </Text>

          <Ionicons
            accessible={false}
            color={theme.colors.textMuted}
            name={open ? "chevron-up" : "chevron-down"}
            size={20}
          />
        </Pressable>

        {open && !disabled ? (
          <View
            style={[
              styles.options,
              { borderTopColor: theme.colors.border },
            ]}
          >
            {options.map((option, index) => {
              const selected = option.key === value;

              return (
                <Pressable
                  accessibilityLabel={option.label}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  key={option.key}
                  onPress={() => selectOption(option.key)}
                  style={({ pressed }) => [
                    styles.option,
                    index > 0 && {
                      borderTopColor: theme.colors.border,
                      borderTopWidth: StyleSheet.hairlineWidth,
                    },
                    pressed && { backgroundColor: theme.colors.surfaceMuted },
                  ]}
                >
                  <Text
                    style={[
                      styles.optionLabel,
                      {
                        color: selected
                          ? theme.colors.tertiary
                          : theme.colors.text,
                      },
                    ]}
                  >
                    {option.label}
                  </Text>

                  {selected ? (
                    <Ionicons
                      accessible={false}
                      color={theme.colors.tertiary}
                      name="checkmark"
                      size={20}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: tokens.spacing.sm,
  },
  label: {
    fontSize: tokens.typography.label.fontSize,
    fontWeight: tokens.typography.label.fontWeight,
    lineHeight: tokens.typography.label.lineHeight,
  },
  selector: {
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    overflow: "hidden",
  },
  selectorButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.sm,
    justifyContent: "space-between",
    minHeight: 44,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  selectedLabel: {
    flex: 1,
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
  },
  options: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  option: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.sm,
    justifyContent: "space-between",
    minHeight: 44,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  optionLabel: {
    flex: 1,
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
  },
});
