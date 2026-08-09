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
  compact?: boolean;
  disabled?: boolean;
  inline?: boolean;
  label: string;
  onChange: (value: Value) => void;
  options: readonly ConditioningSelectOption<Value>[];
  placeholder?: string;
  value: Value | null;
};

export function ConditioningSelectField<Value extends string>({
  accessibilityHint,
  compact = false,
  disabled = false,
  inline = false,
  label,
  onChange,
  options,
  placeholder = "Choose an option",
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
    <View
      style={[
        styles.field,
        compact && styles.compactField,
        inline && styles.inlineField,
      ]}
    >
      <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>

      <View
        style={[
          styles.selector,
          inline && styles.inlineSelector,
          inline && open && styles.openInlineSelector,
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
          hitSlop={inline ? 10 : undefined}
          onPress={() => setOpen((currentValue) => !currentValue)}
          style={({ pressed }) => [
            styles.selectorButton,
            inline && styles.inlineSelectorButton,
            { backgroundColor: theme.colors.surfaceMuted },
            pressed && !disabled && { opacity: tokens.opacity.pressed },
          ]}
        >
          <Text
            numberOfLines={inline ? 1 : 2}
            style={[
              styles.selectedLabel,
              inline && styles.inlineSelectedLabel,
              { color: theme.colors.text },
            ]}
          >
            {selectedOption?.label ?? placeholder}
          </Text>

          <Ionicons
            accessible={false}
            color={theme.colors.textMuted}
            name={open ? "chevron-up" : "chevron-down"}
            size={inline ? 14 : 20}
          />
        </Pressable>

        {open && !disabled ? (
          <View
            style={[
              styles.options,
              inline && styles.inlineOptions,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.borderStrong,
                borderTopColor: theme.colors.border,
              },
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
                    inline && styles.inlineOption,
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
                      inline && styles.inlineOptionLabel,
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
                      size={inline ? 14 : 20}
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
  compactField: {
    gap: tokens.spacing.xs,
  },
  inlineField: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.xs,
  },
  inlineSelector: {
    flexBasis: 88,
    flexShrink: 1,
    minWidth: 80,
    overflow: "visible",
    zIndex: 2,
  },
  openInlineSelector: {
    zIndex: 20,
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
  inlineSelectorButton: {
    borderRadius: tokens.radius.sm,
    gap: 2,
    minHeight: tokens.typography.label.lineHeight - 2,
    paddingHorizontal: tokens.spacing.xs,
    paddingVertical: 0,
  },
  selectedLabel: {
    flex: 1,
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
  },
  inlineSelectedLabel: {
    fontSize: tokens.typography.label.fontSize,
    lineHeight: tokens.typography.label.lineHeight - 2,
  },
  options: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inlineOptions: {
    borderRadius: tokens.radius.sm,
    borderTopWidth: 1,
    borderWidth: 1,
    left: 0,
    overflow: "hidden",
    position: "absolute",
    right: 0,
    top: "100%",
    zIndex: 20,
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
  inlineOption: {
    gap: 2,
    minHeight: 30,
    paddingHorizontal: tokens.spacing.xs,
    paddingVertical: 0,
  },
  optionLabel: {
    flex: 1,
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
  },
  inlineOptionLabel: {
    fontSize: tokens.typography.label.fontSize,
    lineHeight: tokens.typography.label.lineHeight - 2,
  },
});
