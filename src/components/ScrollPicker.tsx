import { useEffect, useRef, useState, type ComponentRef } from "react";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
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

const styles = StyleSheet.create({
  column: { flex: 1, minWidth: 0, gap: themes.dark.spacing.sm },
  label: { fontSize: 12, fontWeight: "700", textAlign: "center" },
  selection: { position: "absolute", left: 0, right: 0, borderRadius: themes.dark.radius.md, borderWidth: 1 },
  value: { fontSize: 19, fontVariant: ["tabular-nums"], fontWeight: "700" },
});
