import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { strengthAdaptationOrder, strengthAdaptations } from "../constants/strength";
import { getStrengthSessionByTimelineEntryId } from "../data/strengthRepository";
import { useAppState } from "../state/AppStateContext";
import { useAppTheme } from "../theme/ThemeContext";
import type { StoredStrengthSession } from "../types/strength";
import { formatWeight } from "../utils/weight";
import { StrengthAdaptationModal } from "./StrengthAdaptationModal";
import { StrengthButton, StrengthMessage, StrengthModalFrame, strengthStyles as s } from "./StrengthFormPrimitives";
export function StrengthSessionDetailModal({ timelineEntryId, onClose }: { timelineEntryId: number | null; onClose: () => void }) {
  if (timelineEntryId === null) return null;
  return <StrengthSessionDetailContent key={timelineEntryId} timelineEntryId={timelineEntryId} onClose={onClose} />;
}
function StrengthSessionDetailContent({ timelineEntryId, onClose }: { timelineEntryId: number; onClose: () => void }) {
  const db = useSQLiteContext(); const { theme } = useAppTheme(); const { unitSettings } = useAppState();
  const [session, setSession] = useState<StoredStrengthSession | null>(null); const [error, setError] = useState<string | null>(null); const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    void getStrengthSessionByTimelineEntryId(db, timelineEntryId).then(value => {
      if (active) { setSession(value); if (!value) setError("Strength session not found."); }
    }).catch(() => { if (active) setError("Couldn't load strength session."); });
    return () => { active = false; };
  }, [db, timelineEntryId, retry]);
  return <StrengthModalFrame visible onClose={onClose}>
    <ScrollView contentContainerStyle={s.body}>
      {error ? <><StrengthMessage>{error}</StrengthMessage><StrengthButton label="Retry strength session" onPress={() => { setSession(null); setError(null); setRetry(n => n + 1); }} /></> : !session ? <StrengthMessage>Loading strength session…</StrengthMessage> : <>
        <Text style={[s.title, { color: theme.colors.text }]}>{session.title}</Text>
        <StrengthMessage>{new Date(session.startAt).toLocaleString()}</StrengthMessage>
        {session.exercises.map((e, index) => {
          const score = session.score.exercises[index];
          return <View key={index} style={[s.card, { borderColor: theme.colors.border }]}>
            <Text style={{ color: theme.colors.text, fontWeight: "700" }}>{e.name}</Text>
            <StrengthMessage>{formatWeight(e.externalLoadKg, unitSettings.weight)} · {e.sets}×{e.reps} · RPE {e.rpe}</StrengthMessage>
            <StrengthMessage>Movement: {e.movementProfile.replace("_", " ")} ({e.movementProfileSource})</StrengthMessage>
            <StrengthMessage>%1RM: {score?.percent1RMUsed?.toFixed(1) ?? "Unavailable"} ({score?.intensitySource ?? "unavailable"})</StrengthMessage>
            {e.notes ? <StrengthMessage>{e.notes}</StrengthMessage> : null}
            {score ? <><StrengthMessage>{strengthAdaptationOrder.map(key => `${strengthAdaptations[key].label}: ${score.scores[key].toFixed(1)}`).join(" · ")}</StrengthMessage>
              <StrengthMessage>Hard sets: {score.hardSets.toFixed(1)} · Repetitions: {score.totalRepetitions} · External load volume: {score.volumeLoadKg.toFixed(1)} kg</StrengthMessage></> : null}
          </View>;
        })}
        <StrengthMessage>Scoring model: {session.score.modelVersion}</StrengthMessage>
        <StrengthAdaptationModal result={session.score} onBack={onClose} />
      </>}
    </ScrollView><View style={[s.actions, { borderTopColor: theme.colors.border }]}><StrengthButton label="Close" onPress={onClose} /></View>
  </StrengthModalFrame>;
}
