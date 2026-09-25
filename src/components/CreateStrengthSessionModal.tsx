import Ionicons from "@expo/vector-icons/Ionicons";
import { useSQLiteContext } from "expo-sqlite";
import { useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { PressOpacity } from "./PressOpacity";
import { strengthAdaptations } from "../constants/strength";
import { createStrengthTemplate, logCompletedStrengthSession, updateStrengthTemplate } from "../data/strengthRepository";
import { useAppTheme } from "../theme/ThemeContext";
import type { ExerciseDbExercise } from "../types/exerciseDb";
import type { StrengthExercise, StrengthSessionDraft, StoredStrengthTemplate } from "../types/strength";
import { scoreStrengthSession } from "../utils/strengthScoring";
import { strengthLogTimeForDate, validateStrengthSession } from "../utils/strengthSessionDraft";
import { ExerciseSearchModal } from "./ExerciseSearchModal";
import { LogTimeChanger } from "./LogTimeChanger";
import { StrengthAdaptationModal } from "./StrengthAdaptationModal";
import { StrengthExerciseEditorModal } from "./StrengthExerciseEditorModal";
import { AdaptationStatusButton } from "./AdaptationStatusButton";
import { StrengthButton, StrengthField, StrengthMessage, StrengthModalFrame, strengthStyles as s } from "./StrengthFormPrimitives";

export type CreateStrengthSessionModalProps = {
  visible: boolean; selectedDate: Date; template?: StoredStrengthTemplate;
  onClose: () => void; onSaved?: () => void; onLogged: () => void;
};
type Editor = { index?: number; exercise?: ExerciseDbExercise; initial?: StrengthExercise };
export function CreateStrengthSessionModal(props: CreateStrengthSessionModalProps) {
  if (!props.visible) return null;
  return <CreateStrengthSessionModalContent key={`${props.template?.id ?? "new"}:${props.selectedDate.getTime()}`} {...props} />;
}
function CreateStrengthSessionModalContent({ selectedDate, template, onClose, onSaved, onLogged }: CreateStrengthSessionModalProps) {
  const db = useSQLiteContext(); const { theme } = useAppTheme();
  const [draft, setDraft] = useState<StrengthSessionDraft>(() => template ? { title: template.title, exercises: template.exercises.map(e => ({ ...e })) } : { title: "", exercises: [] });
  const [templateId, setTemplateId] = useState<number | undefined>(template?.id);
  const [maximumLogTime] = useState(() => new Date());
  const [time, setTime] = useState(() => { try { return strengthLogTimeForDate(selectedDate, maximumLogTime); } catch { return new Date(selectedDate); } });
  const [view, setView] = useState<"session" | "search" | "editor" | "adaptations">("session");
  const [editor, setEditor] = useState<Editor>({}); const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const saving = useRef(false);
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
        onSaved?.();
        onClose();
      }
    } catch (e) { setMessage(e instanceof Error ? e.message : "Couldn't save workout. Please retry."); }
    finally { saving.current = false; setBusy(false); }
  }
  const adaptationLabel = score.status === "insufficient" ? "Adaptation pending" : strengthAdaptations[score.primaryAdaptation].label;
  return <StrengthModalFrame dismissDisabled={busy} visible onClose={view === "session" ? close : back}>
    {view === "search" ? <ExerciseSearchModal onCancel={back} onSelect={exercise => { setEditor({ exercise }); setView("editor"); }} /> :
      view === "editor" ? <StrengthExerciseEditorModal {...editor} onCancel={back} onLog={exercise => {
        setDraft(current => ({ ...current, exercises: editor.index === undefined ? [...current.exercises, exercise] : current.exercises.map((e, i) => i === editor.index ? exercise : e) }));
        setMessage(null); back();
      }} /> : view === "adaptations" ? <ScrollView><StrengthAdaptationModal result={score} onBack={back} /></ScrollView> : <>
        <View style={s.header}><View style={[s.headerRow, { justifyContent: "space-between", flexWrap: "wrap" }]}>
          <Text style={[s.title, { color: theme.colors.text, flex: 1, minWidth: 120 }]}>Log Strength Session</Text>
          <AdaptationStatusButton
            accessibilityLabel={`Primary adaptation, ${adaptationLabel}`}
            disabled={busy}
            label={adaptationLabel}
            onPress={() => setView("adaptations")}
          />
        </View>
          <StrengthField label="Session title" value={draft.title} maxLength={80} editable={!busy} onChangeText={title => { setDraft(current => ({ ...current, title })); setMessage(null); }}
            accessory={<LogTimeChanger inline maximumDate={maximumLogTime} value={time} onChange={date => { if (!saving.current) setTime(date); }} />} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.body}>
          {draft.exercises.map((exercise, index) => <View key={index} style={[s.card, { borderColor: theme.colors.border }]}>
            <View style={[s.row, { alignItems: "flex-start", justifyContent: "space-between" }]}>
              <View style={{ flex: 1, gap: theme.spacing.xs, minWidth: 0 }}>
                <Text style={{ color: theme.colors.text, fontWeight: "700" }}>{exercise.name}</Text>
                <StrengthMessage>{exercise.sets}×{exercise.reps} · RPE {exercise.rpe}</StrengthMessage>
              </View>
              <PressOpacity accessibilityLabel={`Edit exercise ${index + 1}, ${exercise.name}`} disabled={busy} onPress={() => { setEditor({ initial: exercise, index }); setView("editor"); }} style={{ alignItems: "center", height: 44, justifyContent: "center", width: 44 }}>
                <Ionicons color={theme.colors.text} name="create-outline" size={22} />
              </PressOpacity>
              <PressOpacity accessibilityLabel={`Remove exercise ${index + 1}, ${exercise.name}`} disabled={busy} onPress={() => { setDraft(current => ({ ...current, exercises: current.exercises.filter((_, i) => i !== index) })); setMessage(null); }} style={{ alignItems: "center", height: 44, justifyContent: "center", width: 44 }}>
                <Ionicons color={theme.colors.text} name="trash-outline" size={22} />
              </PressOpacity>
            </View>
          </View>)}
          <StrengthButton disabled={busy} label="Add exercise" onPress={() => setView("search")} />
          {message ? <StrengthMessage>{message}</StrengthMessage> : null}
        </ScrollView>
        <View style={[s.actions, { borderTopColor: theme.colors.border, justifyContent: "flex-end" }]}>
          <StrengthButton label="Cancel" disabled={busy} onPress={close} />
          <StrengthButton label="Save" disabled={busy} onPress={() => void save(false)} />
          <StrengthButton label="Log" primary disabled={busy || time.getTime() > maximumLogTime.getTime()} onPress={() => void save(true)} />
        </View>
      </>}
  </StrengthModalFrame>;
}
