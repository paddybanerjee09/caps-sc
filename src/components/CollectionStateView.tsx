import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../theme/ThemeContext";
import { PressOpacity } from "./PressOpacity";

export type CollectionStateVariant = "loading" | "empty" | "noMatch" | "error" | "paginationError";

type CollectionStateViewProps = {
  variant: CollectionStateVariant;
  label: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
  accessory?: ReactNode;
};

export function CollectionStateView({
  variant,
  label,
  actionLabel,
  onAction,
  compact = false,
  accessory,
}: CollectionStateViewProps) {
  const { theme } = useAppTheme();

  return (
    <View style={[styles.container, compact ? styles.compact : null]}>
      {variant === "loading" ? (
        <ActivityIndicator accessibilityLabel={label} color={theme.colors.tertiary} />
      ) : null}
      <Text
        accessibilityLiveRegion={variant === "error" || variant === "paginationError" ? "polite" : undefined}
        style={[theme.typography.body, { color: theme.colors.textMuted, textAlign: "center" }]}
      >
        {label}
      </Text>
      {accessory}
      {actionLabel && onAction ? (
        <PressOpacity
          accessibilityLabel={actionLabel}
          onPress={onAction}
          style={[styles.action, { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surfaceMuted }]}
        >
          <Text style={{ color: theme.colors.text, fontWeight: "700" }}>{actionLabel}</Text>
        </PressOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  compact: {
    paddingVertical: 12,
  },
  action: {
    minHeight: 44,
    minWidth: 44,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
