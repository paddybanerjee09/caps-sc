import { useEffect, useState } from "react";
import { ActivityIndicator, Image, ScrollView, Text, View } from "react-native";
import { getExerciseDbDetail } from "../services/exerciseDbApi";
import { useAppState } from "../state/AppStateContext";
import { useAppTheme } from "../theme/ThemeContext";
import type { ExerciseDbExercise, StrengthExercise } from "../types/strength";
import { getStrengthMovementProfile } from "../utils/strengthMovementProfile";
import { validateStrengthExercise } from "../utils/strengthSessionDraft";
import { convertKilogramsToWeight, convertWeightToKilograms } from "../utils/weight";
import { StrengthButton, StrengthField, StrengthMessage, strengthStyles as s } from "./StrengthFormPrimitives";

export function StrengthExerciseEditorModal({ exercise, initial, onCancel, onLog }: {
  exercise?: ExerciseDbExercise; initial?: StrengthExercise; onCancel: () => void; onLog: (exercise: StrengthExercise) => void;
}) {
  const { theme } = useAppTheme(); const { unitSettings } = useAppState();
  const [unit] = useState(unitSettings.weight);
  const [detail, setDetail] = useState(exercise ?? null); const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(!exercise); const [detailError, setDetailError] = useState<string | null>(null);
  const [label, setLabel] = useState(initial?.name ?? exercise?.name ?? "");
  const [confirmed, setConfirmed] = useState(initial?.labelConfirmed ?? false);
  const [weight, setWeight] = useState(initial ? String(Number(convertKilogramsToWeight(initial.externalLoadKg, unit).toFixed(4))) : "0");
  const [sets, setSets] = useState(initial ? String(initial.sets) : "");
  const [reps, setReps] = useState(initial ? String(initial.reps) : "");
  const [rpe, setRpe] = useState(initial ? String(initial.rpe) : "");
  const [percent, setPercent] = useState(initial?.percent1RM != null ? String(initial.percent1RM) : "");
  const [notes, setNotes] = useState(initial?.notes ?? ""); const [error, setError] = useState<string | null>(null);
  const [mediaFailed, setMediaFailed] = useState(false);
  const id = initial?.exerciseId ?? exercise?.exerciseId ?? "";
  useEffect(() => {
    if (exercise) return;
    const controller = new AbortController(); setLoading(true); setDetailError(null);
    void getExerciseDbDetail(id, controller.signal).then(value => { if (!controller.signal.aborted) setDetail(value); })
      .catch(e => { if (!controller.signal.aborted) setDetailError(e instanceof Error ? e.message : "Exercise details unavailable."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [exercise, id, retry]);
  function log() {
    try {
      const numeric = (value: string) => value.trim() && /^\d+(\.\d+)?$/.test(value.trim()) ? Number(value) : NaN;
      const value: StrengthExercise = { exerciseId: id, name: label.trim(), labelConfirmed: confirmed,
        ...getStrengthMovementProfile(id, label), externalLoadKg: convertWeightToKilograms(numeric(weight), unit),
        sets: numeric(sets), reps: numeric(reps), rpe: numeric(rpe), percent1RM: percent.trim() ? numeric(percent) : null, notes: notes.trim() || null };
      validateStrengthExercise(value); onLog(value);
    } catch (e) { setError(e instanceof Error ? e.message : "Check exercise inputs."); }
  }
  return <>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.body}>
      <Text style={[s.title, { color: theme.colors.text }]}>{detail?.name ?? initial?.name}</Text>
      {loading ? <ActivityIndicator accessibilityLabel="Loading exercise details" color={theme.colors.tertiary} /> : null}
      {detailError ? <><StrengthMessage>{detailError} Your saved prescription remains available.</StrengthMessage><StrengthButton label="Retry exercise details" onPress={() => setRetry(n => n + 1)} /></> : null}
      {detail?.gifUrl && !mediaFailed ? <Image accessibilityLabel={`${detail.name} demonstration`} source={{ uri: detail.gifUrl, cache: "reload", headers: { "Cache-Control": "no-store" } }} resizeMode="contain" style={{ height: 180, width: "100%" }} onError={() => setMediaFailed(true)} /> : <StrengthMessage>Exercise image unavailable.</StrengthMessage>}
      {detail ? <>
        <StrengthMessage>Body parts: {detail.bodyParts.join(", ") || "Unavailable"}</StrengthMessage>
        <StrengthMessage>Primary muscles: {detail.targetMuscles.join(", ") || "Unavailable"}</StrengthMessage>
        <StrengthMessage>Secondary muscles: {detail.secondaryMuscles.join(", ") || "Unavailable"}</StrengthMessage>
        <StrengthMessage>Equipment: {detail.equipments.join(", ") || "Unavailable"}</StrengthMessage>
        {detail.instructions.map((instruction, index) => <StrengthMessage key={index}>{instruction}</StrengthMessage>)}
      </> : null}
      <StrengthField label="Workout label" value={label} maxLength={120} onChangeText={value => { setLabel(value); setConfirmed(false); }} />
      <StrengthMessage>Only your confirmed label and training inputs are saved. Exercise details are fetched when opened.</StrengthMessage>
      <StrengthButton label={confirmed ? "Workout label confirmed" : "Confirm workout label"} onPress={() => setConfirmed(true)} />
      <StrengthField label={`External weight (${unit === "metric" ? "kg" : "lbs"})`} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
      <StrengthField label="Sets" value={sets} onChangeText={setSets} keyboardType="number-pad" />
      <StrengthField label="Reps" value={reps} onChangeText={setReps} keyboardType="number-pad" />
      <StrengthField label="RPE (1–10)" value={rpe} onChangeText={setRpe} keyboardType="decimal-pad" />
      <StrengthField label="%1RM override (optional)" value={percent} onChangeText={setPercent} keyboardType="decimal-pad" />
      <StrengthField label="Notes (optional)" value={notes} onChangeText={setNotes} multiline maxLength={2000} />
      {error ? <StrengthMessage>{error}</StrengthMessage> : null}
    </ScrollView>
    <View style={[s.actions, { borderTopColor: theme.colors.border }]}><StrengthButton label="Cancel" onPress={onCancel} /><StrengthButton label="Log Exercise" primary onPress={log} /></View>
  </>;
}
