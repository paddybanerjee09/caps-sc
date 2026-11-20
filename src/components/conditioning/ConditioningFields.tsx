import { useRef, useState, type ReactNode } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

import { useAppTheme } from "../../theme/ThemeContext";
import { useConditioningWorkspace } from "../../state/ConditioningWorkspaceContext";
import { readableTextColor, themes } from "../../theme/theme";
import { feedbackStep } from "../../utils/feedback";
import { PressOpacity } from "../PressOpacity";
import { WorkflowFooter, WorkflowHeader } from "../WorkflowChrome";

const tokens = themes.dark;

export function FieldLabel({ children }: { children: string }) {
  const { theme } = useAppTheme();
  return (
    <Text style={[styles.label, { color: theme.colors.textMuted }]}>
      {children.toUpperCase()}
    </Text>
  );
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

/** Keep the user's decimal text intact while canonical kilograms update. */
export function WeightInput({ label, onChange, value }: {
  label: string;
  onChange: (value: number | null) => void;
  value: number | null;
}) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(value === null ? "" : String(value));
  return (
    <View style={styles.measurementBlock}>
      <FieldLabel>{label}</FieldLabel>
      <FormInput
        accessibilityLabel={label}
        keyboardType="decimal-pad"
        onBlur={() => setFocused(false)}
        onChangeText={(next) => {
          if (!/^\d*(?:[.,]\d*)?$/.test(next)) return;
          setText(next);
          onChange(next === "" || next === "." || next === "," ? null : Number(next.replace(",", ".")));
        }}
        onFocus={() => {
          setFocused(true);
          setText(value === null ? "" : String(value));
        }}
        placeholder="—"
        value={focused ? text : value === null ? "" : String(value)}
      />
    </View>
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
  presets = [50, 100, 200, 400],
  stepAmount = 10,
  unitKey,
}: {
  accessibilityLabel: string;
  canonical: number | null;
  formatValue: (value: number) => string;
  invalid?: boolean;
  label: string;
  onChangeCanonical: (value: number | null) => void;
  parseValue: (text: string) => number | null | "invalid";
  presets?: readonly number[];
  stepAmount?: number;
  unitKey: string;
}) {
  const { theme } = useAppTheme();
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(
    canonical === null ? "" : formatValue(canonical),
  );
  const unitAtFocus = useRef(unitKey);
  const parseAtFocus = useRef(parseValue);
  const formatAtFocus = useRef(formatValue);
  const activeText = readableTextColor(theme.colors.tertiary);

  function adjustByDisplayStep(delta: number) {
    feedbackStep(delta > 0 ? "up" : "down");
    const currentDisplay =
      canonical === null ? 0 : Number(formatValue(canonical)) || 0;
    const nextDisplay = Math.max(0, Math.round((currentDisplay + delta) * 10) / 10);
    if (nextDisplay <= 0) {
      onChangeCanonical(null);
      setText("");
      return;
    }
    const nextText = String(nextDisplay);
    const parsed = parseValue(nextText);
    if (parsed !== "invalid") {
      onChangeCanonical(parsed);
      setText(parsed === null ? "" : formatValue(parsed));
    }
  }

  function applyPreset(presetDisplay: number) {
    feedbackStep("up");
    const parsed = parseValue(String(presetDisplay));
    if (parsed !== "invalid") {
      onChangeCanonical(parsed);
      setText(parsed === null ? "" : formatValue(parsed));
    }
  }

  const currentDisplayNum =
    canonical === null ? null : Number(formatValue(canonical));

  return (
    <View style={styles.measurementBlock}>
      <View style={styles.measurementHeader}>
        <FieldLabel>{label}</FieldLabel>
        {canonical !== null ? (
          <PressOpacity
            accessibilityLabel={`Clear ${label}`}
            onPress={() => {
              feedbackStep("down");
              onChangeCanonical(null);
              setText("");
            }}
            silent
            style={[
              styles.clearBadge,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.clearBadgeText, { color: theme.colors.textMuted }]}>
              CLEAR
            </Text>
          </PressOpacity>
        ) : null}
      </View>

      <View style={styles.measurementStepperRow}>
        <PressOpacity
          accessibilityLabel={`Decrease ${label}`}
          onPress={() => adjustByDisplayStep(-stepAmount)}
          silent
          style={[
            styles.stepBtn,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        >
          <Text style={[styles.stepBtnText, { color: theme.colors.text }]}>
            -{stepAmount}
          </Text>
        </PressOpacity>

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
          placeholder="—"
          style={styles.measurementInput}
          value={focused ? text : canonical === null ? "" : formatValue(canonical)}
        />

        <PressOpacity
          accessibilityLabel={`Increase ${label}`}
          onPress={() => adjustByDisplayStep(stepAmount)}
          silent
          style={[
            styles.stepBtn,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        >
          <Text style={[styles.stepBtnText, { color: theme.colors.text }]}>
            +{stepAmount}
          </Text>
        </PressOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.presetStrip}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {presets.map((preset) => {
          const selected =
            currentDisplayNum !== null &&
            Math.abs(currentDisplayNum - preset) < 0.15;
          return (
            <PressOpacity
              accessibilityLabel={`${label} ${preset}`}
              key={preset}
              onPress={() => applyPreset(preset)}
              silent
              style={[
                styles.presetChip,
                {
                  backgroundColor: selected
                    ? theme.colors.tertiary
                    : theme.colors.surfaceMuted,
                  borderColor: selected
                    ? theme.colors.tertiary
                    : theme.colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.presetChipText,
                  { color: selected ? activeText : theme.colors.text },
                ]}
              >
                {preset}
              </Text>
            </PressOpacity>
          );
        })}
      </ScrollView>
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
  const activeText = readableTextColor(theme.colors.tertiary);
  return (
    <View style={styles.choices}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <PressOpacity
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            key={option.value}
            onPress={() => {
              feedbackStep("up");
              onSelect(option.value);
            }}
            silent
            style={[
              styles.choice,
              {
                backgroundColor: selected
                  ? theme.colors.tertiary
                  : theme.colors.surfaceMuted,
                borderColor: selected
                  ? theme.colors.tertiary
                  : theme.colors.borderStrong,
              },
            ]}
          >
            <Text
              style={{
                color: selected ? activeText : theme.colors.text,
                fontSize: 13,
                fontWeight: "800",
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
        ? theme.colors.surfaceMuted
        : "transparent";
  const color =
    tone === "primary"
      ? readableTextColor(theme.colors.tertiary)
      : theme.colors.text;
  return (
    <PressOpacity
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.action,
        tone === "primary" && styles.actionPrimary,
        {
          backgroundColor: background,
          borderColor:
            tone === "secondary"
              ? theme.colors.borderStrong
              : theme.colors.border,
          borderWidth: tone === "primary" ? 0 : 1,
        },
      ]}
    >
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
    </PressOpacity>
  );
}

export function ScreenHeading({
  onClose,
  right,
  title,
}: {
  onClose?: () => void;
  right?: ReactNode;
  title: string;
}) {
  const workspace = useConditioningWorkspace();
  return (
    <WorkflowHeader onClose={onClose ?? workspace.closeBranch} right={right} title={title} />
  );
}

export function ConditioningFooter({ children, disabled, onBack }: {
  children?: ReactNode;
  disabled?: boolean;
  onBack?: () => void;
}) {
  const workspace = useConditioningWorkspace();
  const depth = workspace.stack.length + (workspace.editor ? 1 : 0);
  return (
    <WorkflowFooter
      backLabel={depth > 1 ? "Back" : "Cancel"}
      disabled={disabled}
      onBack={onBack ?? workspace.pop}
    >
      {children}
    </WorkflowFooter>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  const { theme } = useAppTheme();
  if (!children) {
    return null;
  }

  return (
    <Text style={[styles.error, { color: theme.colors.tertiary }]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.7,
    marginBottom: 4,
    marginTop: tokens.spacing.xs,
  },
  input: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    fontSize: tokens.typography.body.fontSize,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
    minHeight: 48,
    paddingHorizontal: tokens.spacing.md,
  },
  measurementBlock: {
    gap: 6,
    marginTop: tokens.spacing.xs,
  },
  measurementHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  clearBadge: {
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  clearBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  measurementStepperRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  stepBtn: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    minWidth: 56,
    paddingHorizontal: tokens.spacing.sm,
  },
  stepBtnText: {
    fontSize: 13,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  measurementInput: {
    flex: 1,
    textAlign: "center",
  },
  presetStrip: {
    gap: 6,
  },
  presetChip: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 40,
    minWidth: 48,
    paddingHorizontal: tokens.spacing.sm,
  },
  presetChipText: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  choices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  choice: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: tokens.spacing.md,
  },
  action: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    flexGrow: 1,
    justifyContent: "center",
    minHeight: 48,
    minWidth: 90,
    paddingHorizontal: tokens.spacing.md,
  },
  actionPrimary: {
    minHeight: 52,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  heading: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    minHeight: 58,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 6,
  },
  headingButton: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    height: 48,
    justifyContent: "center",
    paddingHorizontal: tokens.spacing.sm,
    minWidth: 78,
  },
  headingButtonText: {
    fontSize: 13,
    fontWeight: "800",
  },
  headingIconButton: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  headingSpacer: {
    width: 78,
  },
  headingTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    paddingHorizontal: tokens.spacing.xs,
    textAlign: "center",
  },
  error: {
    fontSize: 12,
    fontWeight: "800",
    marginTop: tokens.spacing.sm,
  },
});
