import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

import { useAppTheme } from "../../theme/ThemeContext";
import { themes } from "../../theme/theme";
import { PressOpacity } from "../PressOpacity";

const tokens = themes.dark;

export function FieldLabel({ children }: { children: string }) {
  const { theme } = useAppTheme();
  return <Text style={[styles.label, { color: theme.colors.textMuted }]}>{children}</Text>;
}

export function FormInput({
  invalid = false,
  style,
  ...props
}: TextInputProps & { invalid?: boolean }) {
  const { theme } = useAppTheme();
  return (
    <TextInput
      placeholderTextColor={theme.colors.textMuted}
      selectionColor={theme.colors.tertiary}
      {...props}
      style={[
        styles.input,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderColor: invalid ? theme.colors.tertiary : theme.colors.borderStrong,
          color: theme.colors.text,
        },
        style,
      ]}
    />
  );
}

export function MeasurementInput({
  accessibilityLabel,
  canonical,
  formatValue,
  invalid = false,
  label,
  onChangeCanonical,
  parseValue,
  unitKey,
}: {
  accessibilityLabel: string;
  canonical: number | null;
  formatValue: (value: number) => string;
  invalid?: boolean;
  label: string;
  onChangeCanonical: (value: number | null) => void;
  parseValue: (text: string) => number | null | "invalid";
  unitKey: string;
}) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(canonical === null ? "" : formatValue(canonical));
  const unitAtFocus = useRef(unitKey);
  const parseAtFocus = useRef(parseValue);
  const formatAtFocus = useRef(formatValue);

  useEffect(() => {
    if (!focused) {
      setText(canonical === null ? "" : formatValue(canonical));
    }
  }, [canonical, focused, formatValue, unitKey]);

  return (
    <View>
      <FieldLabel>{label}</FieldLabel>
      <FormInput
        accessibilityLabel={accessibilityLabel}
        invalid={invalid}
        keyboardType="decimal-pad"
        onBlur={() => {
          setFocused(false);
          const parsed = parseAtFocus.current(text);
          onChangeCanonical(parsed === "invalid" ? canonical : parsed);
          setText(
            parsed === "invalid" || parsed === null
              ? parsed === null
                ? ""
                : text
              : formatAtFocus.current(parsed),
          );
        }}
        onChangeText={setText}
        onFocus={() => {
          unitAtFocus.current = unitKey;
          parseAtFocus.current = parseValue;
          formatAtFocus.current = formatValue;
          setFocused(true);
          setText(canonical === null ? "" : formatValue(canonical));
        }}
        value={focused ? text : canonical === null ? "" : formatValue(canonical)}
      />
    </View>
  );
}

export function ChoiceRow({
  onSelect,
  options,
  value,
}: {
  onSelect: (value: string) => void;
  options: { label: string; value: string }[];
  value: string;
}) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.choices}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <PressOpacity
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            key={option.value}
            onPress={() => onSelect(option.value)}
            style={[
              styles.choice,
              {
                backgroundColor: selected ? theme.colors.tertiary : theme.colors.surfaceMuted,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text
              style={{
                color: selected ? theme.colors.background : theme.colors.text,
                fontSize: 13,
                fontWeight: "700",
              }}
            >
              {option.label}
            </Text>
          </PressOpacity>
        );
      })}
    </View>
  );
}

export function ActionButton({
  disabled = false,
  label,
  onPress,
  tone = "primary",
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  tone?: "primary" | "secondary" | "quiet";
}) {
  const { theme } = useAppTheme();
  const background =
    tone === "primary"
      ? theme.colors.tertiary
      : tone === "secondary"
        ? theme.colors.surface
        : "transparent";
  const color = tone === "primary" ? theme.colors.background : theme.colors.text;
  return (
    <PressOpacity
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.action,
        {
          backgroundColor: background,
          borderColor: theme.colors.border,
          borderWidth: tone === "primary" ? 0 : 1,
        },
      ]}
    >
      <Text style={{ color, fontWeight: "700" }}>{label}</Text>
    </PressOpacity>
  );
}

export function ScreenHeading({
  onBack,
  onClose,
  title,
}: {
  onBack?: () => void;
  onClose?: () => void;
  title: string;
}) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.heading}>
      {onBack ? (
        <PressOpacity accessibilityLabel="Back" onPress={onBack} style={styles.headingButton}>
          <Text style={{ color: theme.colors.text, fontWeight: "700" }}>Back</Text>
        </PressOpacity>
      ) : (
        <View style={styles.headingButton} />
      )}
      <Text style={[styles.headingTitle, { color: theme.colors.text }]}>{title}</Text>
      {onClose ? (
        <PressOpacity accessibilityLabel="Close" onPress={onClose} style={styles.headingButton}>
          <Text style={{ color: theme.colors.text, fontSize: 20, fontWeight: "700" }}>×</Text>
        </PressOpacity>
      ) : (
        <View style={styles.headingButton} />
      )}
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  const { theme } = useAppTheme();
  if (!children) {
    return null;
  }

  return <Text style={[styles.error, { color: theme.colors.tertiary }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  label: {
    fontSize: tokens.typography.label.fontSize,
    fontWeight: "700",
    marginBottom: 4,
    marginTop: tokens.spacing.sm,
  },
  input: {
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    fontSize: tokens.typography.body.fontSize,
    minHeight: 44,
    paddingHorizontal: tokens.spacing.md,
  },
  choices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  choice: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: tokens.spacing.md,
  },
  action: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: tokens.spacing.md,
  },
  heading: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 48,
  },
  headingButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 64,
  },
  headingTitle: {
    flex: 1,
    fontSize: tokens.typography.sectionTitle.fontSize,
    fontWeight: "700",
    textAlign: "center",
  },
  error: {
    fontSize: tokens.typography.label.fontSize,
    marginTop: tokens.spacing.sm,
  },
});
