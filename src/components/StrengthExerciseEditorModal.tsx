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
  const label = initial?.name ?? exercise?.name ?? "";
  const [weight, setWeight] = useState(initial ? String(Number(convertKilogramsToWeight(initial.externalLoadKg, unit).toFixed(4))) : "0");
  const [sets, setSets] = useState(initial ? String(initial.sets) : "");
  const [reps, setReps] = useState(initial ? String(initial.reps) : "");
  const [rpe, setRpe] = useState(initial ? String(initial.rpe) : "");
  const [notes, setNotes] = useState(initial?.notes ?? ""); const [error, setError] = useState<string | null>(null);
  const [mediaFailed, setMediaFailed] = useState(false);
  const id = initial?.exerciseId ?? exercise?.exerciseId ?? "";
  useEffect(() => {
    if (exercise) return;
    const controller = new AbortController();
    void getExerciseDbDetail(id, controller.signal).then(value => { if (!controller.signal.aborted) setDetail(value); })
      .catch(e => { if (!controller.signal.aborted) setDetailError(e instanceof Error ? e.message : "Exercise details unavailable."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [exercise, id, retry]);
  function log() {
    try {
      const numeric = (value: string) => value.trim() && /^\d+(\.\d+)?$/.test(value.trim()) ? Number(value) : NaN;
      const value: StrengthExercise = { exerciseId: id, name: label.trim(),
        ...getStrengthMovementProfile(id, label), externalLoadKg: convertWeightToKilograms(numeric(weight), unit),
        sets: numeric(sets), reps: numeric(reps), rpe: numeric(rpe), percent1RM: null, notes: notes.trim() || null };
      validateStrengthExercise(value); onLog(value);
    } catch (e) { setError(e instanceof Error ? e.message : "Check exercise inputs."); }
  }
  return <>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.body}>
      <Text style={[s.title, { color: theme.colors.text }]}>{detail?.name ?? initial?.name}</Text>
      {loading ? <ActivityIndicator accessibilityLabel="Loading exercise details" color={theme.colors.tertiary} /> : null}
      {detailError ? <><StrengthMessage>{detailError} Your saved prescription remains available.</StrengthMessage><StrengthButton label="Retry exercise details" onPress={() => { setLoading(true); setDetailError(null); setRetry(n => n + 1); }} /></> : null}
      {detail?.gifUrl && !mediaFailed ? <Image accessibilityLabel={`${detail.name} demonstration`} source={{ uri: detail.gifUrl, cache: "reload", headers: { "Cache-Control": "no-store" } }} resizeMode="contain" style={{ height: 140, width: "100%" }} onError={() => setMediaFailed(true)} /> : <StrengthMessage>Exercise image unavailable.</StrengthMessage>}
      {detail ? <>
        <StrengthMessage>Muscles: {detail.targetMuscles.join(", ") || "Unavailable"}</StrengthMessage>
        <StrengthMessage>Equipment: {detail.equipments.join(", ") || "Unavailable"}</StrengthMessage>
      </> : null}
      <View style={s.row}>
        <StrengthField fieldWidth={80} label="Sets" value={sets} onChangeText={setSets} keyboardType="number-pad" maxLength={2} />
        <StrengthField fieldWidth={80} label="Reps" value={reps} onChangeText={setReps} keyboardType="number-pad" maxLength={3} />
      </View>
      <View style={s.row}>
        <StrengthField fieldWidth={124} label={`Weight (${unit === "metric" ? "kg" : "lbs"})`} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
        <StrengthField fieldWidth={104} label="RPE (1–10)" value={rpe} onChangeText={setRpe} keyboardType="decimal-pad" maxLength={4} />
      </View>
      <StrengthField label="Notes (optional)" value={notes} onChangeText={setNotes} multiline maxLength={2000} />
      {error ? <StrengthMessage>{error}</StrengthMessage> : null}
    </ScrollView>
    <View style={[s.actions, { borderTopColor: theme.colors.border }]}><StrengthButton label="Cancel" onPress={onCancel} /><StrengthButton label="Log Exercise" primary onPress={log} /></View>
  </>;
}
