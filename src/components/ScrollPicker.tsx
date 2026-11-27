import { useEffect, useRef, useState, type ComponentRef } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
import { feedbackSelection } from "../utils/feedback";
import { PressOpacity } from "./PressOpacity";

type PickerOption = { value: number; label: string };
type ScrollPickerProps = { label: string; options: readonly PickerOption[]; value: number; onChange: (value: number) => void };

/** Theme-matched, snapping selection column, following the existing Log Time wheels. */
export function ScrollPicker({ label, options, value, onChange }: ScrollPickerProps) {
  const { theme } = useAppTheme();
  const { fontScale } = useWindowDimensions();
  const rowHeight = Math.max(48, Math.ceil(32 * fontScale));
  const list = useRef<ComponentRef<typeof ScrollView>>(null);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const [initialOffset] = useState(() => ({ x: 0, y: selectedIndex * rowHeight }));
  const lastIndex = useRef(selectedIndex);
  const geometry = useRef("");
  // Option ranges change for month lengths and future-date restrictions.
  useEffect(() => {
    const nextGeometry = `${options.length}:${rowHeight}`;
    // A parent clamp/tap needs repositioning; a value produced by this list's
    // onScroll must keep its native momentum instead of jumping every row.
    if (lastIndex.current !== selectedIndex || geometry.current !== nextGeometry) {
      lastIndex.current = selectedIndex;
      list.current?.scrollTo({ y: selectedIndex * rowHeight, animated: false });
    }
    geometry.current = nextGeometry;
  }, [options.length, rowHeight, selectedIndex]);

  return (
    <View style={styles.column}>
      <Text style={[styles.label, { color: theme.colors.textMuted }]}>{label}</Text>
      <View style={{ height: rowHeight * 3 }}>
        <View pointerEvents="none" style={[styles.selection, { top: rowHeight, height: rowHeight, backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.borderStrong }]} />
        <ScrollView
          ref={list}
          contentOffset={initialOffset}
          nestedScrollEnabled
          bounces={false}
          contentContainerStyle={{ paddingVertical: rowHeight }}
          decelerationRate="fast"
          onScroll={(event) => {
            const index = Math.max(0, Math.min(options.length - 1, Math.round(event.nativeEvent.contentOffset.y / rowHeight)));
            if (index !== lastIndex.current) { lastIndex.current = index; onChange(options[index].value); }
          }}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          snapToInterval={rowHeight}
        >
          {options.map((item, index) => (
            <PressOpacity key={item.value} accessibilityLabel={`${label}: ${item.label}`} accessibilityState={{ selected: value === item.value }} onPress={() => {
              lastIndex.current = index;
              onChange(item.value);
              list.current?.scrollTo({ y: index * rowHeight, animated: false });
            }} style={{ alignItems: "center", height: rowHeight, justifyContent: "center" }}>
              <Text adjustsFontSizeToFit minimumFontScale={0.7} numberOfLines={1} style={[styles.value, { color: value === item.value ? theme.colors.tertiary : theme.colors.textMuted }]}>{item.label}</Text>
            </PressOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

/** A one-row wheel for dense forms. Commit only the settled value. */
export function InlineScrollPicker({
  label, options, value, onChange, disabled = false, expanded, onOpen,
}: ScrollPickerProps & { disabled?: boolean; expanded?: boolean; onOpen?: () => void }) {
  const { theme } = useAppTheme();
  const { fontScale } = useWindowDimensions();
  const rowHeight = Math.max(34, Math.ceil(24 * fontScale));
  const list = useRef<ComponentRef<typeof ScrollView>>(null);
  const index = Math.max(0, options.findIndex((option) => option.value === value));
  const incrementDirection = options[0].value > (options[1]?.value ?? options[0].value) ? -1 : 1;
  const [initialOffset] = useState(() => ({ x: 0, y: index * rowHeight }));
  const offset = useRef(initialOffset.y);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSelection = useRef(initialOffset.y);

  function cancelSettle() {
    if (settleTimer.current !== null) clearTimeout(settleTimer.current);
    settleTimer.current = null;
  }

  useEffect(() => cancelSettle, []);
  useEffect(() => {
    const y = index * rowHeight;
    if (disabled || lastSelection.current !== y) {
      cancelSettle();
      lastSelection.current = y;
      offset.current = y;
      list.current?.scrollTo({ y, animated: false });
    }
  }, [disabled, index, rowHeight]);

  function choose(nextIndex: number) {
    const bounded = Math.max(0, Math.min(options.length - 1, nextIndex));
    const y = bounded * rowHeight;
    if (disabled || lastSelection.current === y) return;
    const next = options[bounded];
    lastSelection.current = y;
    if (next.value !== value) {
      feedbackSelection();
      onChange(next.value);
    }
  }

  return (
    <View
      accessible
      accessibilityActions={[
        { name: "increment" },
        { name: "decrement" },
        ...(onOpen ? [{ name: "activate" as const, label: "Open rep ranges" }] : []),
      ]}
      accessibilityHint={onOpen ? "Swipe to adjust, or open the rep range list." : "Swipe to adjust."}
      accessibilityLabel={label}
      accessibilityRole="adjustable"
      accessibilityState={{ disabled, expanded }}
      accessibilityValue={{ text: options[index].label }}
      onAccessibilityAction={(event) => {
        if (disabled) return;
        const action = event.nativeEvent.actionName;
        if (action === "activate") {
          onOpen?.();
        } else if (action === "increment" || action === "decrement") {
          cancelSettle();
          const next = index + (action === "increment" ? incrementDirection : -incrementDirection);
          choose(next);
          list.current?.scrollTo({ y: lastSelection.current, animated: false });
        }
      }}
      style={[styles.inlineWheel, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.borderStrong, height: rowHeight + 2 }]}
    >
      <ScrollView
        ref={list}
        bounces={false}
        contentOffset={initialOffset}
        decelerationRate="fast"
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        onMomentumScrollBegin={cancelSettle}
        onMomentumScrollEnd={(event) => {
          cancelSettle();
          choose(Math.round(event.nativeEvent.contentOffset.y / rowHeight));
        }}
        onScroll={(event) => { offset.current = event.nativeEvent.contentOffset.y; }}
        onScrollBeginDrag={cancelSettle}
        onScrollEndDrag={(event) => {
          offset.current = event.nativeEvent.contentOffset.y;
          cancelSettle();
          settleTimer.current = setTimeout(() => {
            settleTimer.current = null;
            choose(Math.round(offset.current / rowHeight));
          }, 120);
        }}
        scrollEnabled={!disabled}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        snapToInterval={rowHeight}
      >
        {options.map((item) => (
          <Pressable
            accessible={false}
            disabled={disabled || !onOpen}
            importantForAccessibility="no-hide-descendants"
            key={item.value}
            onPress={onOpen}
            style={({ pressed }) => [styles.inlineRow, { height: rowHeight }, pressed && { opacity: themes.dark.opacity.pressed }]}
          >
            <Text adjustsFontSizeToFit minimumFontScale={0.75} numberOfLines={1} style={[styles.inlineValue, { color: theme.colors.text }]}>{item.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View pointerEvents="none" style={styles.inlineIndicator}>
        <Ionicons color={theme.colors.textMuted} name={onOpen ? "chevron-down" : "swap-vertical"} size={8} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { flex: 1, minWidth: 0, gap: themes.dark.spacing.sm },
  label: { fontSize: 12, fontWeight: "700", textAlign: "center" },
  selection: { position: "absolute", left: 0, right: 0, borderRadius: themes.dark.radius.md, borderWidth: 1 },
  value: { fontSize: 19, fontVariant: ["tabular-nums"], fontWeight: "700" },
  inlineWheel: { borderWidth: 1, borderRadius: themes.dark.radius.sm, overflow: "hidden" },
  inlineRow: { alignItems: "center", justifyContent: "center", paddingRight: 8 },
  inlineValue: { fontSize: 11, fontVariant: ["tabular-nums"], fontWeight: "700", maxWidth: "100%" },
  inlineIndicator: { position: "absolute", right: 1, top: 0, bottom: 0, justifyContent: "center" },
});
