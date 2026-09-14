import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { strengthAdaptations } from "../constants/strength";
import { createStrengthTemplate, logCompletedStrengthSession, updateStrengthTemplate } from "../data/strengthRepository";
import { useAppTheme } from "../theme/ThemeContext";
import type { ExerciseDbExercise, StrengthExercise, StrengthSessionDraft, StoredStrengthTemplate } from "../types/strength";
import { scoreStrengthSession } from "../utils/strengthScoring";
import { strengthLogTimeForDate, validateStrengthSession } from "../utils/strengthSessionDraft";
import { ExerciseSearchModal } from "./ExerciseSearchModal";
import { LogTimeChanger } from "./LogTimeChanger";
import { StrengthAdaptationModal } from "./StrengthAdaptationModal";
import { StrengthExerciseEditorModal } from "./StrengthExerciseEditorModal";
import { StrengthButton, StrengthField, StrengthMessage, StrengthModalFrame, strengthStyles as s } from "./StrengthFormPrimitives";

export type CreateStrengthSessionModalProps = {
  visible: boolean; selectedDate: Date; template?: StoredStrengthTemplate;
  onClose: () => void; onSaved?: () => void; onLogged: () => void;
};
type Editor = { index?: number; exercise?: ExerciseDbExercise; initial?: StrengthExercise };
export function CreateStrengthSessionModal({ visible, selectedDate, template, onClose, onSaved, onLogged }: CreateStrengthSessionModalProps) {
  const db = useSQLiteContext(); const { theme } = useAppTheme();
  const [draft, setDraft] = useState<StrengthSessionDraft>({ title: "", exercises: [] });
  const [templateId, setTemplateId] = useState<number | undefined>();
  const [time, setTime] = useState(new Date()); const [view, setView] = useState<"session" | "search" | "editor" | "adaptations">("session");
  const [editor, setEditor] = useState<Editor>({}); const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const saving = useRef(false);
  useEffect(() => {
    if (!visible) return;
    setDraft(template ? { title: template.title, exercises: template.exercises.map(e => ({ ...e })) } : { title: "", exercises: [] });
    setTemplateId(template?.id); setView("session"); setEditor({}); setMessage(null);
    try { setTime(strengthLogTimeForDate(selectedDate)); } catch { setTime(new Date(selectedDate)); }
  }, [visible, selectedDate, template]);
  const score = scoreStrengthSession(draft.exercises);
  function close() { if (!saving.current) onClose(); }
  function back() { setEditor({}); setView("session"); }
  async function save(log: boolean) {
    if (saving.current) return;
    setMessage(null);
    try { validateStrengthSession(draft); } catch (e) { setMessage(e instanceof Error ? e.message : "Check workout inputs."); return; }
    saving.current = true; setBusy(true);
    try {
      if (log) {
        await logCompletedStrengthSession(db, { ...draft, startAt: time.getTime(), sourceTemplateId: templateId });
        onClose(); onLogged();
      } else {
        if (templateId !== undefined) await updateStrengthTemplate(db, templateId, draft);
        else { const result = await createStrengthTemplate(db, draft); setTemplateId(result.id); }
        setMessage("Workout saved."); onSaved?.();
      }
    } catch (e) { setMessage(e instanceof Error ? e.message : "Couldn't save workout. Please retry."); }
    finally { saving.current = false; setBusy(false); }
  }
  return <StrengthModalFrame visible={visible} onClose={view === "session" ? close : back}>
    {view === "search" ? <ExerciseSearchModal onCancel={back} onSelect={exercise => { setEditor({ exercise }); setView("editor"); }} /> :
      view === "editor" ? <StrengthExerciseEditorModal {...editor} onCancel={back} onLog={exercise => {
        setDraft(current => ({ ...current, exercises: editor.index === undefined ? [...current.exercises, exercise] : current.exercises.map((e, i) => i === editor.index ? exercise : e) }));
        setMessage(null); back();
      }} /> : view === "adaptations" ? <ScrollView><StrengthAdaptationModal result={score} onBack={back} /></ScrollView> : <>
        <View style={s.header}><View style={[s.row, { justifyContent: "space-between" }]}>
          <Text style={[s.title, { color: theme.colors.text }]}>Log Strength Session</Text>
          <StrengthButton disabled={busy} label={score.status === "insufficient" ? "Adaptation pending" : strengthAdaptations[score.primaryAdaptation].label} onPress={() => setView("adaptations")} />
        </View><View style={s.row}><View style={{ flex: 1, minWidth: 140 }}>
          <StrengthField label="Session title" value={draft.title} maxLength={80} editable={!busy} onChangeText={title => { setDraft(current => ({ ...current, title })); setMessage(null); }} />
        </View><LogTimeChanger inline maximumDate={new Date()} value={time} onChange={date => { if (!saving.current) setTime(date); }} /></View></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.body}>
          {draft.exercises.map((exercise, index) => <View key={index} style={[s.card, { borderColor: theme.colors.border }]}>
            <Text style={{ color: theme.colors.text, fontWeight: "700" }}>{exercise.name}</Text>
            <StrengthMessage>{exercise.sets}×{exercise.reps} · RPE {exercise.rpe}</StrengthMessage>
            <View style={s.row}><StrengthButton disabled={busy} label="Edit" accessibilityLabel={`Edit exercise ${index + 1}, ${exercise.name}`} onPress={() => { setEditor({ initial: exercise, index }); setView("editor"); }} />
              <StrengthButton disabled={busy} label="Remove" accessibilityLabel={`Remove exercise ${index + 1}, ${exercise.name}`} onPress={() => { setDraft(current => ({ ...current, exercises: current.exercises.filter((_, i) => i !== index) })); setMessage(null); }} /></View>
          </View>)}
          <StrengthButton disabled={busy} label="Add exercise" onPress={() => setView("search")} />
          {message ? <StrengthMessage>{message}</StrengthMessage> : null}
        </ScrollView>
        <View style={[s.actions, { borderTopColor: theme.colors.border }]}>
          <StrengthButton label="Cancel" disabled={busy} onPress={close} />
          <StrengthButton label="Save" disabled={busy} onPress={() => void save(false)} />
          <StrengthButton label="Quick Log" primary disabled={busy || time.getTime() > Date.now()} onPress={() => void save(true)} />
        </View>
      </>}
  </StrengthModalFrame>;
}
