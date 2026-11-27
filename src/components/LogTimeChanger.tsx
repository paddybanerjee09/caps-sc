import { formatDisplayDate } from "../utils/displayDate";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Keyboard, Modal, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "../theme/ThemeContext";
import { readableTextColor, themes } from "../theme/theme";
import { clampLogDate, formatLogDay, nextLogMinute, shiftLogDay } from "../utils/logTime";
import { PressOpacity } from "./PressOpacity";

const tokens = themes.dark;

type LogTimeChangerProps = {
  // Legacy presentation flags remain compatible; all callers get one small trigger.
  compact?: boolean;
  iconOnly?: boolean;
  inline?: boolean;
  label?: string;
  minuteInterval?: 1 | 15;
  rejectInvalidWallTime?: boolean;
  maximumDate?: Date;
  minimumDate?: Date;
  onChange: (date: Date) => void;
  timeBoundary?: "future" | "past";
  value: Date;
};

export function LogTimeChanger({ label, maximumDate, minimumDate, onChange, timeBoundary, value, minuteInterval = 1, rejectInvalidWallTime = false }: LogTimeChangerProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [boundaryTime, setBoundaryTime] = useState<number | null>(null);
  const [timeError, setTimeError] = useState<string | null>(null);
  const wheelHour = useRef<number | null>(null);
  const wheelMinute = useRef<number | null>(null);
  const primaryText = readableTextColor(theme.colors.tertiary);

  function dateBounds(now: number | null) {
    return {
      lower: timeBoundary === "future" && now !== null ? nextLogMinute(now, minuteInterval) : minimumDate,
      upper: timeBoundary === "past" && now !== null ? new Date(now) : maximumDate,
    };
  }

  function refreshDateBounds() {
    const now = Date.now();
    setBoundaryTime(now);
    return dateBounds(now);
  }

  function clampSelection(date: Date) {
    const { lower, upper } = refreshDateBounds();
    return clampLogDate(date, lower, upper);
  }

  function openPicker() {
    Keyboard.dismiss();
    setTimeError(null);
    setDraft(clampSelection(value));
    wheelHour.current = null;
    wheelMinute.current = null;
    setOpen(true);
  }

  function selectTime(hour: number, minute: number) {
    const requested = new Date(draft);
    requested.setHours(hour, minute, 0, 0);
    if (rejectInvalidWallTime && (requested.getHours() !== hour || requested.getMinutes() !== minute)) {
      wheelHour.current = hour;
      wheelMinute.current = minute;
      setTimeError("That local time does not exist on this date. Choose another time.");
      return;
    }
    setTimeError(null);
    wheelHour.current = null;
    wheelMinute.current = null;
    const { lower, upper } = refreshDateBounds();
    setDraft((current) => {
      const next = new Date(current);
      next.setHours(hour, minute, 0, 0);
      return clampLogDate(next, lower, upper);
    });
  }

  function changeDay(amount: number) {
    const hour = wheelHour.current ?? draft.getHours();
    const minute = wheelMinute.current ?? draft.getMinutes();
    const selected = new Date(draft);
    selected.setHours(hour, minute, 0, 0);
    const shifted = shiftLogDay(selected, amount);
    if (rejectInvalidWallTime && (selected.getHours() !== hour || selected.getMinutes() !== minute || shifted.getHours() !== hour || shifted.getMinutes() !== minute)) {
      setTimeError("That clock time does not exist on the selected day. Choose another time before changing day.");
      return;
    }
    wheelHour.current = null;
    wheelMinute.current = null;
    setTimeError(null);
    setDraft(clampSelection(shifted));
  }

  const { lower, upper } = dateBounds(boundaryTime);
  const previousDay = shiftLogDay(draft, -1);
  previousDay.setHours(23, 59, 59, 999);
  const nextDay = shiftLogDay(draft, 1);
  nextDay.setHours(0, 0, 0, 0);

  return (
    <>
      <PressOpacity
        accessibilityLabel={`${label ?? "Log time"}: ${formatDisplayDate(value)}, ${value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. Change log time`}
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
                  <PressOpacity accessibilityLabel="Previous log day" disabled={!!lower && previousDay < lower} onPress={() => changeDay(-1)} style={styles.dayArrow}>
                    <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
                  </PressOpacity>
                  <Text style={[styles.dayText, { color: theme.colors.text }]}>{formatLogDay(draft)}</Text>
                  <PressOpacity accessibilityLabel="Next log day" disabled={!!upper && nextDay > upper} onPress={() => changeDay(1)} style={styles.dayArrow}>
                    <Ionicons name="chevron-forward" size={22} color={theme.colors.text} />
                  </PressOpacity>
                </View>
                {label ? <Text style={[styles.contextLabel, { color: theme.colors.textMuted }]}>{label}</Text> : null}
                <View style={styles.wheels}>
                  <TimeWheel selectionRevision={draft} label="Hours" count={24} value={draft.getHours()} onPreview={(hour) => { wheelHour.current = hour; }} onChange={(hour) => selectTime(hour, wheelMinute.current ?? draft.getMinutes())} />
                  <Text style={[styles.colon, { color: theme.colors.textMuted }]}>:</Text>
                  <TimeWheel selectionRevision={draft} label="Minutes" displayMultiplier={minuteInterval} count={60 / minuteInterval} value={Math.floor(draft.getMinutes() / minuteInterval)} onPreview={(minute) => { wheelMinute.current = minute * minuteInterval; }} onChange={(minute) => selectTime(wheelHour.current ?? draft.getHours(), minute * minuteInterval)} />
                </View>
              </ScrollView>
              {timeError ? <Text accessibilityRole="alert" style={{ color: theme.colors.text, padding: 12 }}>{timeError}</Text> : null}
              <View style={[styles.actions, { borderTopColor: theme.colors.border }]}>
                <PressOpacity accessibilityLabel="Cancel log time changes" onPress={() => setOpen(false)} style={[styles.action, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.borderStrong }]}>
                  <Text style={[styles.actionText, { color: theme.colors.text }]}>Cancel</Text>
                </PressOpacity>
                <PressOpacity accessibilityLabel="Confirm log time" onPress={() => {
                  const selected = new Date(draft);
                  selected.setHours(wheelHour.current ?? draft.getHours(), wheelMinute.current ?? Math.floor(draft.getMinutes() / minuteInterval) * minuteInterval, 0, 0);
                  const requestedHour = wheelHour.current ?? draft.getHours();
                  const requestedMinute = wheelMinute.current ?? Math.floor(draft.getMinutes() / minuteInterval) * minuteInterval;
                  if (rejectInvalidWallTime && (selected.getHours() !== requestedHour || selected.getMinutes() !== requestedMinute)) {
                    setTimeError("That local time does not exist on this date. Choose another time.");
                    return;
                  }
                  onChange(clampSelection(selected));
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

function TimeWheel({ count, label, onChange, onPreview, value, selectionRevision, displayMultiplier = 1 }: { displayMultiplier?: number; count: number; label: string; onChange: (value: number) => void; onPreview: (value: number) => void; value: number; selectionRevision: Date }) {
  const { theme } = useAppTheme();
  const { fontScale } = useWindowDimensions();
  const rowHeight = Math.max(48, Math.ceil(32 * fontScale));
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [initialOffset] = useState(() => ({ x: 0, y: value * rowHeight }));
  const [preview, setPreview] = useState({ source: selectionRevision, value });
  const selectedValue = preview.source === selectionRevision ? preview.value : value;
  const currentValue = useRef(value);
  const geometry = useRef("");

  useEffect(() => {
    const nextGeometry = `${count}:${rowHeight}`;
    // Parent clamps/day changes reposition the wheel, while a value emitted by
    // this wheel preserves its native snapping and momentum.
    if (currentValue.current !== value || geometry.current !== nextGeometry) {
      currentValue.current = value;
      scroll.current?.scrollTo({ y: value * rowHeight, animated: false });
    }
    geometry.current = nextGeometry;
  }, [count, rowHeight, selectionRevision, value]);

  function previewOffset(offset: number) {
    const selected = Math.max(0, Math.min(count - 1, Math.round(offset / rowHeight)));
    currentValue.current = selected;
    setPreview({ source: selectionRevision, value: selected });
    onPreview(selected);
    return selected;
  }

  function settle(offset: number) {
    const selected = previewOffset(offset);
    onChange(selected);
  }

  return (
    <View style={styles.wheelColumn}>
      <Text style={[styles.contextLabel, { color: theme.colors.textMuted }]}>{label}</Text>
      <View style={{ height: rowHeight * 3 }}>
        <View pointerEvents="none" style={[styles.selection, { top: rowHeight, height: rowHeight, backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.borderStrong }]} />
        <ScrollView
          ref={scroll}
          nestedScrollEnabled
          bounces={false}
          contentOffset={initialOffset}
          contentContainerStyle={{ paddingVertical: rowHeight }}
          decelerationRate="fast"
          onScroll={(event) => { previewOffset(event.nativeEvent.contentOffset.y); }}
          scrollEventThrottle={16}
          onScrollEndDrag={(event) => { if (Math.abs(event.nativeEvent.velocity?.y ?? 0) < 0.1) settle(event.nativeEvent.contentOffset.y); }}
          onMomentumScrollEnd={(event) => settle(event.nativeEvent.contentOffset.y)}
          showsVerticalScrollIndicator={false}
          snapToInterval={rowHeight}
        >
          {Array.from({ length: count }, (_, index) => (
            <PressOpacity key={index} accessibilityLabel={`${label}: ${String(index * displayMultiplier).padStart(2, "0")}`} accessibilityState={{ selected: selectedValue === index }} onPress={() => {
              previewOffset(index * rowHeight);
              scroll.current?.scrollTo({ y: index * rowHeight, animated: false });
              onChange(index);
            }} style={[styles.wheelRow, { height: rowHeight }]}>
              <Text style={[styles.wheelText, { color: selectedValue === index ? theme.colors.tertiary : theme.colors.textMuted }]}>{String(index * displayMultiplier).padStart(2, "0")}</Text>
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
