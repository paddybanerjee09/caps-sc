import { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { PressOpacity } from "../../components/PressOpacity";
import { alternateSleepInstant, sleepClockInstant } from "../sleepInput";
import { LogTimeChanger } from "../../components/LogTimeChanger";
import { useAppTheme } from "../../theme/ThemeContext";
import { feedbackSelection } from "../../utils/feedback";

type Props = { localDate: string; onset: string | null; wake: string | null; disabled?: boolean; onChange: (field: "sleepOnset" | "wakeTime", value: string) => void };
const minutes = (value: string | null) => { const date = value ? new Date(value) : null; return date ? date.getHours() * 60 + date.getMinutes() : null; };
function pickerDate(day: string, value: string | null, bed: boolean) {
  if (value) return new Date(value);
  const date = new Date(`${day}T12:00:00`);
  if (bed) date.setDate(date.getDate() - 1);
  date.setHours(bed ? 23 : 7, 0, 0, 0);
  return date;
}

/** Both clock thumbs are independently selectable; full-date fallback resolves midnight/DST. */
export function SleepTimeRangeSlider({ localDate, onset, wake, onChange, disabled }: Props) {
  const { theme } = useAppTheme();
  const latestQuarter = new Date();
  latestQuarter.setMinutes(Math.floor(latestQuarter.getMinutes() / 15) * 15, 0, 0);
  const [width, setWidth] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const selected = useRef<"sleepOnset" | "wakeTime">("sleepOnset");
  function assign(x: number) {
    const snapped = Math.min(1425, Math.max(0, Math.round(x / width * 96) * 15));
    const field = selected.current;
    const base = pickerDate(localDate, field === "sleepOnset" ? onset : wake, field === "sleepOnset");
    const date = sleepClockInstant(base, snapped);
    if (!date) { setError("That clock time does not exist on this date because of daylight saving. Choose another time."); return; }
    setError(null);
    onChange(field, date.toISOString());
  }
  return <View style={styles.block}>
    <Text style={[styles.heading, { color: theme.colors.text }]}>Sleep onset and waking</Text>
    <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>24-hour clock · 15-minute steps. Use the clocks below to set each calendar date, including daytime sleep or repeated DST hours.</Text>
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} onStartShouldSetResponder={() => !disabled}
      onResponderGrant={(event) => {
        const at = event.nativeEvent.locationX / width * 1440;
        const bed = minutes(onset), up = minutes(wake);
        selected.current = bed === null ? "sleepOnset" : up === null ? "wakeTime" : Math.abs(at - bed) <= Math.abs(at - up) ? "sleepOnset" : "wakeTime";
        feedbackSelection(); assign(event.nativeEvent.locationX);
      }}
      onResponderMove={(event) => assign(event.nativeEvent.locationX)}
      onResponderTerminationRequest={() => false} accessible={false} style={styles.trackTouch}>
      <View pointerEvents="none" style={[styles.track, { backgroundColor: theme.colors.borderStrong }]} />
      {([onset, wake] as const).map((time, index) => time ? <View pointerEvents="none" key={index} style={[styles.thumb, { left: `${(minutes(time)! / 1440) * 100}%`, backgroundColor: index ? theme.colors.text : theme.colors.tertiary }]}><Text style={{ color: theme.colors.background, fontSize: 9 }}>{index ? "W" : "B"}</Text></View> : null)}
    </View>
    <View style={styles.row}><Text style={{ color: theme.colors.textMuted }}>00:00</Text><Text style={{ color: theme.colors.textMuted }}>12:00</Text><Text style={{ color: theme.colors.textMuted }}>24:00</Text></View>
    <View style={styles.row}>
      {(["sleepOnset", "wakeTime"] as const).map((field) => {
        const isBed = field === "sleepOnset", value = isBed ? onset : wake;
        const alternative = value ? alternateSleepInstant(new Date(value)) : null;
        return <View key={field} style={styles.time}>
          <Text style={{ color: theme.colors.text, fontWeight: "700" }}>{isBed ? "Sleep onset" : "Wake time"}</Text>
          <Text selectable style={{ color: theme.colors.textMuted, fontSize: 12 }}>{value ? new Date(value).toLocaleDateString() : "— Unanswered"}</Text>
          {value ? <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{new Date(value).toLocaleTimeString([], { timeZoneName: "shortOffset" })}</Text> : null}
          <View pointerEvents={disabled ? "none" : "auto"}><LogTimeChanger label={isBed ? "Sleep onset" : "Wake time"} minuteInterval={15} rejectInvalidWallTime value={pickerDate(localDate, value, isBed)} maximumDate={latestQuarter} onChange={(date) => { setError(null); onChange(field, date.toISOString()); }} /></View>
          {alternative ? <PressOpacity disabled={disabled} onPress={() => onChange(field, alternative.toISOString())} style={{ minHeight: 48, minWidth: 48, justifyContent: "center" }} accessibilityLabel={`Choose other occurrence of ${isBed ? "onset" : "wake"} time`}><Text style={{ color: theme.colors.text }}>Use {alternative.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZoneName: "shortOffset" })}</Text></PressOpacity> : null}
        </View>;
      })}
    </View>
    {error ? <Text accessibilityRole="alert" style={{ color: theme.colors.text }}>{error}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
  block: { gap: 8 }, heading: { fontSize: 15, fontWeight: "700" }, row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  trackTouch: { height: 52, marginHorizontal: 12, justifyContent: "center" }, track: { height: 4, borderRadius: 2 },
  thumb: { position: "absolute", height: 28, width: 28, marginLeft: -14, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  time: { flex: 1, gap: 6 },
});




