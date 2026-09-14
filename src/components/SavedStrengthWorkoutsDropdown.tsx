import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Text, View } from "react-native";
import { useAppTheme } from "../theme/ThemeContext";
import type { StoredStrengthTemplate } from "../types/strength";
import { PressOpacity } from "./PressOpacity";
import { StrengthButton, StrengthMessage, strengthStyles as s } from "./StrengthFormPrimitives";
export function SavedStrengthWorkoutsDropdown({ templates, onEdit, onLog, disabled, loading, error, onRetry }: {
  templates: StoredStrengthTemplate[]; onEdit: (template: StoredStrengthTemplate) => void;
  onLog: (template: StoredStrengthTemplate) => void; disabled: boolean; loading: boolean; error: string | null; onRetry: () => void;
}) {
  const [expanded, setExpanded] = useState(false); const { theme } = useAppTheme();
  return <View style={{ gap: 12 }}>
    <PressOpacity accessibilityLabel="Saved Workouts" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={[s.card, s.row, { borderColor: theme.colors.border, justifyContent: "space-between" }]}>
      <Text style={[s.title, { color: theme.colors.text }]}>Saved Workouts</Text><Ionicons name={expanded ? "chevron-up" : "chevron-down"} color={theme.colors.text} size={20} />
    </PressOpacity>
    {expanded ? <>
      {loading ? <StrengthMessage>Loading saved workouts…</StrengthMessage> : error ? <><StrengthMessage>{error}</StrengthMessage><StrengthButton label="Retry saved workouts" onPress={onRetry} /></> : templates.length === 0 ? <StrengthMessage>No saved workouts yet. Save a workout from Log Workout.</StrengthMessage> : templates.map(template =>
        <View key={template.id} style={[s.card, { borderColor: theme.colors.border }]}>
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <PressOpacity disabled={disabled} accessibilityLabel={`Log saved workout ${template.title}`} onPress={() => onLog(template)} style={{ flex: 1, minHeight: 60, gap: 8 }}>
              <Text style={{ color: theme.colors.text, fontWeight: "700" }}>{template.title}</Text>
              <Text style={{ color: theme.colors.textMuted }}>{template.exercises.map(e => `${e.name} · ${e.sets}×${e.reps}`).join(", ")}</Text>
            </PressOpacity>
            <PressOpacity accessibilityLabel={`Edit saved workout ${template.title}`} onPress={() => onEdit(template)} style={{ minHeight: 44, minWidth: 44, alignItems: "center" }}>
              <Ionicons name="ellipsis-horizontal" size={22} color={theme.colors.text} />
            </PressOpacity>
          </View>
        </View>)}
    </> : null}
  </View>;
}
