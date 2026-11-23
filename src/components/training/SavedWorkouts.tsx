import { useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { useAppTheme } from "../../theme/ThemeContext";
import { themes } from "../../theme/theme";
import { feedbackToggle } from "../../utils/feedback";
import { PressOpacity } from "../PressOpacity";

const tokens = themes.dark;
const PANEL_HEIGHT = 248;

/** Presentation only: each discipline retains its own template schema and actions. */
export type SavedWorkoutEntry = {
  id: string;
  title: string;
  badge?: string;
  summary?: string;
};

type SavedWorkoutCardsProps = {
  emptyLabel?: string;
  entries: SavedWorkoutEntry[];
  error?: string | null;
  loading?: boolean;
  onSelect: (id: string) => void;
  onRetry?: () => void;
};

function savedWorkoutColumnCount(fontScale: number) {
  return fontScale >= 1.6 ? 1 : fontScale >= 1.3 ? 2 : 3;
}

/** Conditioning's inline expander, shared by all training hubs. */
export function SavedWorkouts(props: SavedWorkoutCardsProps) {
  const { theme } = useAppTheme();
  const [open, setOpen] = useState(false);
  const panel = useSharedValue(0);
  const panelStyle = useAnimatedStyle(() => ({
    height: panel.get() * PANEL_HEIGHT,
    opacity: panel.get(),
  }));

  function toggle() {
    const next = !open;
    feedbackToggle(next);
    setOpen(next);
    panel.set(withTiming(next ? 1 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    }));
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong }]}>
      <PressOpacity
        accessibilityLabel={`Saved workouts, ${props.entries.length}`}
        accessibilityState={{ expanded: open }}
        onPress={toggle}
        silent
        style={[styles.expander, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.borderStrong }]}
      >
        <View style={styles.expanderLeft}>
          <Ionicons color={theme.colors.tertiary} name="bookmarks-outline" size={18} />
          <Text style={[styles.expanderTitle, { color: theme.colors.text }]}>Saved Workouts ({props.entries.length})</Text>
        </View>
        <View style={styles.expanderRight}>
          <Text style={[styles.expanderState, { color: theme.colors.textMuted }]}>{open ? "HIDE" : "SHOW"}</Text>
          <Ionicons color={theme.colors.textMuted} name={open ? "chevron-up" : "chevron-down"} size={18} />
        </View>
      </PressOpacity>
      <Animated.View
        accessibilityElementsHidden={!open}
        importantForAccessibility={open ? "auto" : "no-hide-descendants"}
        pointerEvents={open ? "auto" : "none"}
        style={[styles.panel, panelStyle]}
      >
        <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <SavedWorkoutCards {...props} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function SavedWorkoutCards({
  emptyLabel = "No saved workouts yet",
  entries,
  error = null,
  loading = false,
  onSelect,
  onRetry,
}: SavedWorkoutCardsProps) {
  const { theme } = useAppTheme();
  const { fontScale } = useWindowDimensions();
  const [gridWidth, setGridWidth] = useState(0);
  const columns = savedWorkoutColumnCount(fontScale);

  if (loading || error || entries.length === 0) {
    return (
      <View style={[styles.stateCard, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
        <Text style={[styles.stateLabel, { color: error ? theme.colors.text : theme.colors.textMuted }]}>
          {loading ? "Loading workouts…" : error || emptyLabel}
        </Text>
        {!loading && error && onRetry ? (
          <PressOpacity accessibilityLabel="Retry loading workouts" onPress={onRetry} style={[styles.retry, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong }]}>
            <Text style={[styles.stateLabel, { color: theme.colors.tertiary }]}>Retry</Text>
          </PressOpacity>
        ) : null}
      </View>
    );
  }

  const cardWidth = gridWidth > 0
    ? Math.max(1, Math.floor((gridWidth - tokens.spacing.sm * (columns - 1)) / columns))
    : "100%";
  function renderEntry(entry: SavedWorkoutEntry) {
    return (
      <PressOpacity
        accessibilityLabel={[entry.title, entry.badge, entry.summary].filter(Boolean).join(", ")}
        key={entry.id}
        onPress={() => onSelect(entry.id)}
        style={[styles.card, {
          backgroundColor: theme.colors.surfaceMuted,
          borderColor: theme.colors.borderStrong,
          width: cardWidth,
        }]}
      >
        {entry.badge ? (
          <View style={[styles.badge, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.badgeLabel, { color: theme.colors.tertiary }]}>{entry.badge.toUpperCase()}</Text>
          </View>
        ) : null}
        <Text numberOfLines={2} style={[styles.title, { color: theme.colors.text }]}>{entry.title}</Text>
        {entry.summary ? <Text style={[styles.summary, { color: theme.colors.textMuted }]}>{entry.summary}</Text> : null}
      </PressOpacity>
    );
  }

  return (
    <View onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)} style={styles.grid}>
      {entries.map(renderEntry)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: tokens.radius.lg, borderWidth: 1, gap: tokens.spacing.md, padding: tokens.spacing.lg },
  expander: { alignItems: "center", borderRadius: tokens.radius.md, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 52, paddingHorizontal: tokens.spacing.md, paddingVertical: tokens.spacing.sm },
  expanderLeft: { alignItems: "center", flex: 1, flexDirection: "row", gap: tokens.spacing.sm },
  expanderTitle: { flexShrink: 1, fontSize: 14, fontVariant: ["tabular-nums"], fontWeight: "800" },
  expanderRight: { alignItems: "center", flexDirection: "row", gap: 4 },
  expanderState: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  panel: { overflow: "hidden" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.sm, justifyContent: "space-between" },
  card: { borderRadius: tokens.radius.md, borderWidth: 1, gap: 6, minHeight: 112, padding: tokens.spacing.md },
  badge: { alignSelf: "flex-start", borderRadius: tokens.radius.pill, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  badgeLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 0.6 },
  title: { fontSize: 14, fontWeight: "800", lineHeight: 18 },
  summary: { fontSize: 11, fontVariant: ["tabular-nums"], fontWeight: "600", lineHeight: 15 },
  stateCard: { alignItems: "center", borderRadius: tokens.radius.md, borderWidth: 1, gap: tokens.spacing.sm, justifyContent: "center", minHeight: 68, padding: tokens.spacing.md },
  stateLabel: { fontWeight: "700" },
  retry: { alignItems: "center", borderRadius: tokens.radius.sm, borderWidth: 1, justifyContent: "center", minHeight: 48, minWidth: 96, paddingHorizontal: tokens.spacing.md },
});
