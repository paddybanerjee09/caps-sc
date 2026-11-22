import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../../theme/ThemeContext";
import { feedbackSelection } from "../../utils/feedback";

export type RatingSliderProps = {
  label: string; value: number | null; onChange: (value: number) => void;
  min?: number; max?: number; step?: number; minLabel?: string; maxLabel?: string; maxValueLabel?: string; disabled?: boolean;
};

/** Controlled number line; the questionnaire owns its initial/default answer. */
export function RatingSlider({ label, value, onChange, min = 0, max = 10, step = 1, minLabel, maxLabel, maxValueLabel, disabled = false }: RatingSliderProps) {
  const { theme } = useAppTheme();
  const [width, setWidth] = useState(1);
  const displayed = value === null ? null : Math.min(max, Math.max(min, value));
  const valueText = value === null ? "--" : maxValueLabel && value >= max ? maxValueLabel : String(value);
  const ticks = Array.from({ length: Math.round((max - min) / step) + 1 }, (_, index) => min + index * step);
  function change(next: number) {
    const snapped = Math.min(max, Math.max(min, min + Math.round((next - min) / step) * step));
    if (!disabled && snapped !== value) { onChange(snapped); feedbackSelection(); }
  }
  const position = (number: number) => `${((number - min) / (max - min)) * 100}%` as `${number}%`;
  return <View style={[styles.field, disabled && styles.disabled]}>
    <View style={styles.row}><Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text><Text style={[styles.value, { color: theme.colors.tertiary }]}>{valueText}</Text></View>
    <View accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min, max, ...(displayed === null ? { text: "Unanswered" } : { now: displayed, text: value !== null && value > max ? `${maxValueLabel ?? max}; ${value} recorded` : valueText }) }} accessibilityActions={[{ name: "increment" }, { name: "decrement" }]} onAccessibilityAction={({ nativeEvent }) => change((displayed ?? min) + (nativeEvent.actionName === "increment" ? step : -step))} accessibilityState={{ disabled }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)} onStartShouldSetResponder={() => !disabled}
      onResponderGrant={(event) => change(min + (event.nativeEvent.locationX / width) * (max - min))}
      onResponderMove={(event) => change(min + (event.nativeEvent.locationX / width) * (max - min))}
      onResponderTerminationRequest={() => false} style={styles.numberLine}>
      <View pointerEvents="none" style={[styles.track, { backgroundColor: theme.colors.borderStrong }]} />
      {displayed !== null ? <View pointerEvents="none" style={[styles.trackFill, { backgroundColor: theme.colors.tertiary, width: position(displayed) }]} /> : null}
      {ticks.map(tick => <View pointerEvents="none" key={tick} style={[styles.tickGroup, { left: position(tick) }]}>
        <View style={[styles.notch, { backgroundColor: tick === displayed ? theme.colors.tertiary : theme.colors.textMuted }]} />
        <Text maxFontSizeMultiplier={1.3} style={[styles.tickNumber, { color: tick === displayed ? theme.colors.tertiary : theme.colors.textMuted, fontWeight: tick === displayed ? "800" : "500" }]}>{tick === max && maxValueLabel ? maxValueLabel : tick}</Text>
      </View>)}
      {displayed !== null ? <View pointerEvents="none" style={[styles.thumb, { backgroundColor: theme.colors.tertiary, left: position(displayed) }]} /> : null}
    </View>
    {minLabel || maxLabel ? <View style={styles.row}><Text style={[styles.anchor, { color: theme.colors.textMuted }]}>{minLabel}</Text><Text style={[styles.anchor, { color: theme.colors.textMuted, textAlign: "right" }]}>{maxLabel}</Text></View> : null}
  </View>;
}
const styles = StyleSheet.create({
  field: { gap: 2 }, row: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "space-between" }, disabled: { opacity: 0.5 },
  label: { fontSize: 14, fontWeight: "700", flex: 1 }, value: { fontSize: 20, fontWeight: "800", fontVariant: ["tabular-nums"] },
  numberLine: { height: 66, marginHorizontal: 14 }, track: { height: 3, borderRadius: 2, position: "absolute", left: 0, right: 0, top: 24 },
  trackFill: { height: 3, borderRadius: 2, position: "absolute", left: 0, top: 24 },
  tickGroup: { position: "absolute", top: 18, width: 28, marginLeft: -14, alignItems: "center", gap: 12 }, notch: { width: 1, height: 15 },
  tickNumber: { fontSize: 11, textAlign: "center", fontVariant: ["tabular-nums"] },
  thumb: { width: 22, height: 22, borderRadius: 11, position: "absolute", top: 14, marginLeft: -11 }, anchor: { flex: 1, fontSize: 12 },
});
