import Ionicons from "@expo/vector-icons/Ionicons";
import { useRef, useState, type ComponentRef } from "react";
import { Keyboard, Modal, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "../theme/ThemeContext";
import { readableTextColor, themes } from "../theme/theme";
import { clampLogDate, formatLogDay, shiftLogDay } from "../utils/logTime";
import { PressOpacity } from "./PressOpacity";

const tokens = themes.dark;

type LogTimeChangerProps = {
  // Legacy presentation flags remain compatible; all callers get one small trigger.
  compact?: boolean;
  iconOnly?: boolean;
  inline?: boolean;
  label?: string;
  maximumDate?: Date;
  minimumDate?: Date;
  onChange: (date: Date) => void;
  value: Date;
};

export function LogTimeChanger({ label, maximumDate, minimumDate, onChange, value }: LogTimeChangerProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const wheelHour = useRef<number | null>(null);
  const wheelMinute = useRef<number | null>(null);
  const primaryText = readableTextColor(theme.colors.tertiary);

  function openPicker() {
    Keyboard.dismiss();
    setDraft(clampLogDate(value, minimumDate, maximumDate));
    wheelHour.current = null;
    wheelMinute.current = null;
    setOpen(true);
  }

  function selectTime(hour: number, minute: number) {
    wheelHour.current = null;
    wheelMinute.current = null;
    setDraft((current) => {
      const next = new Date(current);
      next.setHours(hour, minute, 0, 0);
      return clampLogDate(next, minimumDate, maximumDate);
    });
  }

  function changeDay(amount: number) {
    wheelHour.current = null;
    wheelMinute.current = null;
    setDraft((current) => clampLogDate(shiftLogDay(current, amount), minimumDate, maximumDate));
  }

  const previousDay = shiftLogDay(draft, -1);
  previousDay.setHours(23, 59, 59, 999);
  const nextDay = shiftLogDay(draft, 1);
  nextDay.setHours(0, 0, 0, 0);

  return (
    <>
      <PressOpacity
        accessibilityLabel={`${label ?? "Log time"}: ${value.toLocaleString()}. Change log time`}
        accessibilityState={{ expanded: open }}
        onPress={openPicker}
        style={[styles.trigger, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.borderStrong }]}
      >
        <Ionicons color={theme.colors.tertiary} name="time-outline" size={17} />
        <Text numberOfLines={1} style={[styles.triggerText, { color: theme.colors.text }]}>
          {value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}
        </Text>
      </PressOpacity>
      {open ? (
        <Modal animationType="none" onRequestClose={() => setOpen(false)} transparent visible>
          <View style={[styles.backdrop, { backgroundColor: theme.colors.overlay, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
            <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong }]}>
              <ScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.dialogContent}>
                <Text accessibilityRole="header" style={[styles.title, { color: theme.colors.text }]}>Log Time</Text>
                <View style={styles.dayBar}>
                  <PressOpacity accessibilityLabel="Previous log day" disabled={!!minimumDate && previousDay < minimumDate} onPress={() => changeDay(-1)} style={styles.dayArrow}>
                    <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
                  </PressOpacity>
                  <Text style={[styles.dayText, { color: theme.colors.text }]}>{formatLogDay(draft)}</Text>
                  <PressOpacity accessibilityLabel="Next log day" disabled={!!maximumDate && nextDay > maximumDate} onPress={() => changeDay(1)} style={styles.dayArrow}>
                    <Ionicons name="chevron-forward" size={22} color={theme.colors.text} />
                  </PressOpacity>
                </View>
                {label ? <Text style={[styles.contextLabel, { color: theme.colors.textMuted }]}>{label}</Text> : null}
                <View style={styles.wheels}>
                  <TimeWheel label="Hours" count={24} value={draft.getHours()} onPreview={(hour) => { wheelHour.current = hour; }} onChange={(hour) => selectTime(hour, wheelMinute.current ?? draft.getMinutes())} />
                  <Text style={[styles.colon, { color: theme.colors.textMuted }]}>:</Text>
                  <TimeWheel label="Minutes" count={60} value={draft.getMinutes()} onPreview={(minute) => { wheelMinute.current = minute; }} onChange={(minute) => selectTime(wheelHour.current ?? draft.getHours(), minute)} />
                </View>
              </ScrollView>
              <View style={[styles.actions, { borderTopColor: theme.colors.border }]}>
                <PressOpacity accessibilityLabel="Cancel log time changes" onPress={() => setOpen(false)} style={[styles.action, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.borderStrong }]}>
                  <Text style={[styles.actionText, { color: theme.colors.text }]}>Cancel</Text>
                </PressOpacity>
                <PressOpacity accessibilityLabel="Confirm log time" onPress={() => {
                  const selected = new Date(draft);
                  selected.setHours(wheelHour.current ?? draft.getHours(), wheelMinute.current ?? draft.getMinutes(), 0, 0);
                  onChange(clampLogDate(selected, minimumDate, maximumDate));
                  setOpen(false);
                }} style={[styles.action, { backgroundColor: theme.colors.tertiary, borderColor: theme.colors.tertiary }]}>
                  <Text style={[styles.actionText, { color: primaryText }]}>Done</Text>
                </PressOpacity>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

function TimeWheel({ count, label, onChange, onPreview, value }: { count: number; label: string; onChange: (value: number) => void; onPreview: (value: number) => void; value: number }) {
  const { theme } = useAppTheme();
  const { fontScale } = useWindowDimensions();
  const rowHeight = Math.max(48, Math.ceil(32 * fontScale));
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const dragging = useRef(false);

  function settle(offset: number) {
    dragging.current = false;
    const selected = Math.max(0, Math.min(count - 1, Math.round(offset / rowHeight)));
    onChange(selected);
    scroll.current?.scrollTo({ y: selected * rowHeight, animated: false });
  }

  return (
    <View style={styles.wheelColumn}>
      <Text style={[styles.contextLabel, { color: theme.colors.textMuted }]}>{label}</Text>
      <View style={{ height: rowHeight * 3 }}>
        <View pointerEvents="none" style={[styles.selection, { top: rowHeight, height: rowHeight, backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.borderStrong }]} />
        <ScrollView
          key={`${rowHeight}-${value}`}
          ref={scroll}
          nestedScrollEnabled
          bounces={false}
          contentOffset={{ x: 0, y: value * rowHeight }}
          contentContainerStyle={{ paddingVertical: rowHeight }}
          decelerationRate="fast"
          onScroll={(event) => onPreview(Math.max(0, Math.min(count - 1, Math.round(event.nativeEvent.contentOffset.y / rowHeight))))}
          scrollEventThrottle={16}
          onScrollBeginDrag={() => { dragging.current = true; }}
          onScrollEndDrag={(event) => { if (Math.abs(event.nativeEvent.velocity?.y ?? 0) < 0.1) settle(event.nativeEvent.contentOffset.y); }}
          onMomentumScrollEnd={(event) => { if (dragging.current) settle(event.nativeEvent.contentOffset.y); }}
          showsVerticalScrollIndicator={false}
          snapToInterval={rowHeight}
        >
          {Array.from({ length: count }, (_, index) => (
            <PressOpacity key={index} accessibilityLabel={`${label}: ${String(index).padStart(2, "0")}`} accessibilityState={{ selected: value === index }} onPress={() => onChange(index)} style={[styles.wheelRow, { height: rowHeight }]}>
              <Text style={[styles.wheelText, { color: value === index ? theme.colors.tertiary : theme.colors.textMuted }]}>{String(index).padStart(2, "0")}</Text>
            </PressOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: { alignItems: "center", borderRadius: tokens.radius.md, borderWidth: 1, flexDirection: "row", gap: 5, justifyContent: "center", minHeight: 48, minWidth: 80, paddingHorizontal: 8 },
  triggerText: { fontSize: 13, fontVariant: ["tabular-nums"], fontWeight: "700" },
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  dialog: { borderRadius: tokens.radius.lg, borderWidth: 1, maxHeight: "100%", maxWidth: 400, width: "100%", overflow: "hidden" },
  dialogContent: { gap: tokens.spacing.md, padding: tokens.spacing.lg },
  title: { textAlign: "center", fontSize: 20, fontWeight: "800" },
  contextLabel: { textAlign: "center", fontSize: 12, fontWeight: "700" },
  dayBar: { flexDirection: "row", alignItems: "center" },
  dayArrow: { minHeight: 48, minWidth: 48, alignItems: "center", justifyContent: "center" },
  dayText: { flex: 1, textAlign: "center", fontSize: 14, fontWeight: "700" },
  wheels: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: tokens.spacing.sm },
  wheelColumn: { flex: 1, gap: tokens.spacing.sm },
  wheelRow: { alignItems: "center", justifyContent: "center" },
  wheelText: { fontSize: 24, fontVariant: ["tabular-nums"], fontWeight: "700" },
  selection: { position: "absolute", left: 0, right: 0, borderRadius: tokens.radius.md, borderWidth: 1 },
  colon: { fontSize: 24, fontWeight: "700" },
  actions: { flexDirection: "row", gap: tokens.spacing.sm, borderTopWidth: 1, padding: tokens.spacing.md },
  action: { flex: 1, minHeight: 48, borderRadius: tokens.radius.md, borderWidth: 1, alignItems: "center", justifyContent: "center", padding: tokens.spacing.sm },
  actionText: { fontSize: 14, fontWeight: "700" },
});
