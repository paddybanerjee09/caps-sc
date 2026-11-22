import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { PressOpacity } from "../../components/PressOpacity";
import { useAppTheme } from "../../theme/ThemeContext";
import { feedbackSelection } from "../../utils/feedback";

export type RatingSliderProps = {
  label: string; value: number | null; onChange: (value: number) => void;
  min?: number; max?: number; step?: number; minLabel?: string; maxLabel?: string; disabled?: boolean;
};

/** Controlled: an unanswered question stays null until the athlete acts. */
export function RatingSlider({ label, value, onChange, min = 0, max = 10, step = 1, minLabel, maxLabel, disabled = false }: RatingSliderProps) {
  const { theme } = useAppTheme();
  const [width, setWidth] = useState(1);
  const change = (next: number) => {
    const snapped = Math.min(max, Math.max(min, min + Math.round((next - min) / step) * step));
    if (!disabled && snapped !== value) { onChange(snapped); feedbackSelection(); }
  };
  return <View style={styles.field}>
    <View style={styles.row}><Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text><Text style={[styles.value, { color: theme.colors.tertiary }]}>{value ?? "--"}</Text></View>
    <View style={styles.row}>
      <PressOpacity accessibilityLabel={`Decrease ${label}`} disabled={disabled || value === min} onPress={() => change(value === null ? min : value - step)} style={[styles.step, { borderColor: theme.colors.borderStrong }]}><Text style={{ color: theme.colors.text }}>−</Text></PressOpacity>
      <View accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min, max, ...(value === null ? { text: "Unanswered" } : { now: value }) }} accessibilityActions={[{ name: "increment" }, { name: "decrement" }]} onAccessibilityAction={({ nativeEvent }) => change(value === null ? min : value + (nativeEvent.actionName === "increment" ? step : -step))} accessibilityState={{ disabled }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)} onStartShouldSetResponder={() => !disabled}
        onResponderGrant={(event) => change(min + (event.nativeEvent.locationX / width) * (max - min))}
        onResponderMove={(event) => change(min + (event.nativeEvent.locationX / width) * (max - min))}
        onResponderTerminationRequest={() => false} style={styles.trackTouch}>
        <View pointerEvents="none" style={[styles.track, { backgroundColor: theme.colors.borderStrong }]} />
        {value !== null ? <View pointerEvents="none" style={[styles.thumb, { backgroundColor: theme.colors.tertiary, left: `${((value - min) / (max - min)) * 100}%` }]} /> : null}
      </View>
      <PressOpacity accessibilityLabel={`Increase ${label}`} disabled={disabled || value === max} onPress={() => change(value === null ? min : value + step)} style={[styles.step, { borderColor: theme.colors.borderStrong }]}><Text style={{ color: theme.colors.text }}>+</Text></PressOpacity>
    </View>
    <View style={styles.row}><Text style={[styles.anchor, { color: theme.colors.textMuted }]}>{min}: {minLabel}</Text><Text style={[styles.anchor, { color: theme.colors.textMuted, textAlign: "right" }]}>{max}: {maxLabel}</Text></View>
  </View>;
}
const styles = StyleSheet.create({
  field: { gap: 4 }, row: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "space-between" },
  label: { fontSize: 14, fontWeight: "700", flex: 1 }, value: { fontSize: 20, fontWeight: "800", fontVariant: ["tabular-nums"] },
  step: { minWidth: 48, minHeight: 48, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  trackTouch: { flex: 1, height: 48, justifyContent: "center", marginHorizontal: 8 }, track: { height: 4, borderRadius: 2 },
  thumb: { width: 24, height: 24, borderRadius: 12, position: "absolute", marginLeft: -12 }, anchor: { flex: 1, fontSize: 12 },
});
