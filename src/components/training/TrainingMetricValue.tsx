import { useEffect, useRef, useState, type ComponentRef } from "react";
import { AccessibilityInfo, findNodeHandle, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MetricResult } from "../../domain/training/metric";
import { useAppTheme } from "../../theme/ThemeContext";
import { feedbackSelection } from "../../utils/feedback";

type Props = { label: string; metric: MetricResult; explanation: string; onAction?: () => void; actionLabel?: string };

export function TrainingMetricValue({ label, metric, explanation, onAction, actionLabel }: Props) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const trigger = useRef<ComponentRef<typeof Pressable>>(null);
  const closeButton = useRef<ComponentRef<typeof Pressable>>(null);
  const returnFocus = useRef(false);

  function focus(target: ComponentRef<typeof Pressable> | null) {
    target?.focus();
    const handle = target && Platform.OS !== "web" ? findNodeHandle(target) : null;
    if (typeof handle === "number") AccessibilityInfo.setAccessibilityFocus(handle);
  }
  function dismiss() { returnFocus.current = true; setOpen(false); }
  useEffect(() => {
    if (open && Platform.OS === "web") {
      const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); dismiss(); } };
      globalThis.addEventListener("keydown", onKey);
      return () => globalThis.removeEventListener("keydown", onKey);
    }
    if (!open && returnFocus.current) {
      const frame = requestAnimationFrame(() => { returnFocus.current = false; focus(trigger.current); });
      return () => cancelAnimationFrame(frame);
    }
  }, [open]);

  const color = { color: theme.colors.text };
  const muted = { color: theme.colors.textMuted };
  if (metric.value !== null) return <View style={styles.copy}>
    <Text style={[styles.value, color]}>{new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(metric.value)}{metric.unit ? ` ${metric.unit}` : ""}</Text>
    {metric.status === "partial" ? <Text style={[styles.detail, muted]}>{metric.method}{metric.coverage.total > 0 ? ` · ${metric.coverage.valid}/${metric.coverage.total} covered` : ""}</Text> : null}
  </View>;

  const accessibilityLabel = `Why is ${label} unavailable?`;
  const buttonStyle = ({ focused, pressed }: { focused?: boolean; pressed: boolean }) => [styles.action, {
    borderColor: focused ? theme.colors.tertiary : theme.colors.borderStrong,
    backgroundColor: theme.colors.surfaceMuted,
    opacity: pressed ? theme.opacity.pressed : 1,
  }];
  return <>
    <Pressable ref={trigger} accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ expanded: open }}
      onPress={() => { feedbackSelection(); setOpen(true); }} style={buttonStyle}>
      <Text style={[styles.value, color]}>--</Text>
    </Pressable>
    {open ? <Modal transparent animationType="none" visible onRequestClose={dismiss}
      onShow={() => focus(closeButton.current)} onDismiss={() => focus(trigger.current)}>
      <View style={[styles.backdrop, { backgroundColor: theme.colors.overlay, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <View accessibilityViewIsModal onAccessibilityEscape={dismiss} style={[styles.dialog, { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surface }]}>
          <ScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.contents}>
            <Text accessibilityRole="header" style={[styles.title, color]}>{accessibilityLabel}</Text>
            <Text style={[styles.detail, color]}>{explanation}</Text>
          </ScrollView>
          <View style={styles.actions}>
            {onAction && actionLabel ? <Pressable accessibilityRole="button" onPress={() => { setOpen(false); onAction(); }} style={buttonStyle}><Text style={color}>{actionLabel}</Text></Pressable> : null}
            <Pressable ref={closeButton} accessibilityRole="button" onPress={dismiss} style={buttonStyle}><Text style={color}>Close</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal> : null}
  </>;
}

const styles = StyleSheet.create({
  copy: { gap: 4 }, value: { fontSize: 20, fontWeight: "800", fontVariant: ["tabular-nums"] }, detail: { fontSize: 13, lineHeight: 19 },
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  dialog: { borderWidth: 1, borderRadius: 16, width: "100%", maxWidth: 420, maxHeight: "100%", padding: 12 },
  contents: { padding: 4, gap: 8 }, title: { fontSize: 16, fontWeight: "700" },
  actions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 8, paddingTop: 8 },
  action: { alignSelf: "flex-start", minHeight: 48, minWidth: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: 10, borderRadius: 10, borderWidth: 2 },
});
