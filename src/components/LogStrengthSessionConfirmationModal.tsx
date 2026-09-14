import { useSQLiteContext } from "expo-sqlite";
import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { logCompletedStrengthSession } from "../data/strengthRepository";
import { useAppTheme } from "../theme/ThemeContext";
import type { StoredStrengthTemplate } from "../types/strength";
import { strengthLogTimeForDate } from "../utils/strengthSessionDraft";
import { StrengthButton, StrengthMessage, StrengthModalFrame, strengthStyles as s } from "./StrengthFormPrimitives";
export function LogStrengthSessionConfirmationModal({ template, selectedDate, onClose, onLogged }: {
  template: StoredStrengthTemplate | null; selectedDate: Date; onClose: () => void; onLogged: () => void;
}) {
  if (!template) return null;
  return <LogStrengthSessionConfirmationContent key={`${template.id}:${selectedDate.getTime()}`} template={template} selectedDate={selectedDate} onClose={onClose} onLogged={onLogged} />;
}
function LogStrengthSessionConfirmationContent({ template, selectedDate, onClose, onLogged }: {
  template: StoredStrengthTemplate; selectedDate: Date; onClose: () => void; onLogged: () => void;
}) {
  const db = useSQLiteContext(); const { theme } = useAppTheme();
  const [busy, setBusy] = useState(false); const saving = useRef(false); const [error, setError] = useState<string | null>(null);
  function close() { if (!saving.current) onClose(); }
  async function log() {
    if (!template || saving.current) return;
    saving.current = true; setBusy(true); setError(null);
    try {
      await logCompletedStrengthSession(db, { ...template, startAt: strengthLogTimeForDate(selectedDate).getTime(), sourceTemplateId: template.id });
      onClose(); onLogged();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't log workout."); }
    finally { saving.current = false; setBusy(false); }
  }
  return <StrengthModalFrame visible onClose={close}>
    <View style={s.body}><Text style={[s.title, { color: theme.colors.text }]}>Log Strength Session?</Text>
      <StrengthMessage>{template?.title} · {selectedDate.toLocaleDateString()}</StrengthMessage>
      {error ? <StrengthMessage>{error}</StrengthMessage> : null}
    </View><View style={[s.actions, { borderTopColor: theme.colors.border }]}>
      <StrengthButton label="Cancel" disabled={busy} onPress={close} /><StrengthButton label="Log Session" disabled={busy} primary onPress={() => void log()} />
    </View>
  </StrengthModalFrame>;
}
