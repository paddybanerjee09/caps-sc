import { StyleSheet, Text, View } from "react-native";
import { PressOpacity } from "../../components/PressOpacity";
import { alternateSleepInstant } from "../sleepInput";
import { LogTimeChanger } from "../../components/LogTimeChanger";
import { useAppTheme } from "../../theme/ThemeContext";
import { formatDisplayDate } from "../../utils/displayDate";

type Props = { localDate: string; onset: string | null; wake: string | null; disabled?: boolean; onChange: (field: "sleepOnset" | "wakeTime", value: string) => void };
function pickerDate(day: string, value: string | null, bed: boolean) {
  if (value) return new Date(value);
  const date = new Date(`${day}T12:00:00`);
  if (bed) date.setDate(date.getDate() - 1);
  date.setHours(bed ? 23 : 7, 0, 0, 0);
  return date;
}

/** Keep full-date minute-resolution clocks, including explicit repeated DST hours. */
export function SleepTimeRangeSlider({ localDate, onset, wake, onChange, disabled }: Props) {
  const { theme } = useAppTheme();
  const latestMinute = new Date();
  latestMinute.setSeconds(0, 0);
  return <View style={styles.row}>
    {(["sleepOnset", "wakeTime"] as const).map(field => {
      const isBed = field === "sleepOnset", value = isBed ? onset : wake;
      const alternative = value ? alternateSleepInstant(new Date(value)) : null;
      return <View key={field} style={styles.time}>
        <Text style={{ color: theme.colors.text, fontWeight: "700" }}>{isBed ? "Sleep onset" : "Wake time"}</Text>
        <Text selectable style={{ color: theme.colors.textMuted, fontSize: 12 }}>{value ? formatDisplayDate(new Date(value)) : "--"}</Text>
        {value && alternative ? <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZoneName: "shortOffset" })}</Text> : null}
        <View pointerEvents={disabled ? "none" : "auto"}><LogTimeChanger label={isBed ? "Sleep onset" : "Wake time"} rejectInvalidWallTime value={pickerDate(localDate, value, isBed)} maximumDate={latestMinute} onChange={date => onChange(field, date.toISOString())} /></View>
        {alternative ? <PressOpacity disabled={disabled} onPress={() => onChange(field, alternative.toISOString())} style={styles.alternative} accessibilityLabel={`Choose other occurrence of ${isBed ? "onset" : "wake"} time`}><Text style={{ color: theme.colors.text }}>Use {alternative.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZoneName: "shortOffset" })}</Text></PressOpacity> : null}
      </View>;
    })}
  </View>;
}
const styles = StyleSheet.create({ row: { flexDirection: "row", justifyContent: "space-between", gap: 12 }, time: { flex: 1, gap: 4 }, alternative: { minHeight: 48, minWidth: 48, justifyContent: "center" } });
