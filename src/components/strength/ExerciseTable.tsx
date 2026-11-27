import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef, useState, type ComponentRef, type RefObject } from "react";
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import Animated, { Easing, LinearTransition, ReduceMotion } from "react-native-reanimated";

import { getStrengthTarget, MAX_EXERCISES, MAX_NOTES, MAX_REST_SECONDS, MAX_SETS, setStrengthTarget, updateSet } from "../../strength/drafts";
import { STRENGTH_REP_RANGES, type CatalogExercise, type ExerciseDraft, type SetDraft, type StrengthExerciseTarget, type StrengthRepRange, type StrengthSessionMode } from "../../strength/types";
import { formatRestSeconds, formatRir, formatRpe } from "../../strength/units";
import { useAppTheme } from "../../theme/ThemeContext";
import { themes } from "../../theme/theme";
import { feedbackSelection } from "../../utils/feedback";
import { PressOpacity } from "../PressOpacity";
import { InlineScrollPicker } from "../ScrollPicker";
import { TrainingNumberField } from "../training/TrainingNumberField";
import { ExerciseSearchResults, useExerciseCatalog, useExerciseFavouriteColor } from "./ExerciseSearchResults";

const tokens = themes.dark;
const COLUMN_GAP = tokens.spacing.xs;
const MENU_GAP = tokens.spacing.xs;
const MENU_INSET = tokens.spacing.sm;
const targetHeadings = ["Exercise", "Sets", "Rep\nRanges", "Target\nRPE", "Target\nRIR", "Notes"];
const rowTransition = LinearTransition.duration(220).easing(Easing.out(Easing.cubic)).reduceMotion(ReduceMotion.System);
const setOptions = Array.from({ length: MAX_SETS }, (_, index) => ({ value: index + 1, label: String(index + 1) }));
const rangeOptions = STRENGTH_REP_RANGES.map((label, value) => ({ label, value }));
const rpeOptions = [{ value: -1, label: "—" }, ...Array.from({ length: 10 }, (_, index) => ({ value: index + 1, label: String(index + 1) }))];
const rirOptions = [{ value: -1, label: "—" }, ...Array.from({ length: 11 }, (_, value) => ({ value, label: value === 10 ? "10+" : String(value) }))];
type ChangeExercise = (id: string, update: (exercise: ExerciseDraft) => ExerciseDraft) => void;
type AnchorRef = RefObject<ComponentRef<typeof View> | null>;
type OpenPopover =
  | { type: "search"; anchor: AnchorRef }
  | { type: "range"; anchor: AnchorRef; exerciseId: string };

type PopoverFrame = {
  anchor: { x: number; y: number; width: number; height: number };
  menu: { left: number; width: number; maxHeight: number; top?: number; bottom?: number };
};

/** Page-level overlays avoid clipping inside either axis of the exercise table. */
export function useExerciseTable({
  pageRef, exercises, mode, disabled, prescriptionReadOnly = false,
  onAddExercise, onChangeExercise, onRemoveExercise,
}: {
  pageRef: AnchorRef;
  exercises: readonly ExerciseDraft[];
  mode: StrengthSessionMode;
  disabled: boolean;
  prescriptionReadOnly?: boolean;
  onAddExercise: (exercise: CatalogExercise) => void;
  onChangeExercise: ChangeExercise;
  onRemoveExercise: (id: string) => void;
}) {
  const { theme } = useAppTheme();
  const favouriteColor = useExerciseFavouriteColor();
  const { fontScale } = useWindowDimensions();
  const source = useExerciseCatalog();
  const searchAnchor = useRef<ComponentRef<typeof View>>(null);
  const searchInput = useRef<ComponentRef<typeof TextInput>>(null);
  const [query, setQuery] = useState("");
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [tableWidth, setTableWidth] = useState(0);
  const [popover, setPopover] = useState<OpenPopover | null>(null);
  const [layoutRevision, setLayoutRevision] = useState(0);
  const [position, setPosition] = useState<{ frame: PopoverFrame; target: OpenPopover } | null>(null);
  const searchDisabled = disabled || exercises.length >= MAX_EXERCISES;

  useEffect(() => {
    if (!popover || disabled) return;
    let active = true;
    pageRef.current?.measureInWindow((pageX, pageY, pageWidth, pageHeight) => {
      popover.anchor.current?.measureInWindow((x, y, width, height) => {
        if (!active || !width || !height || pageWidth <= MENU_INSET * 2) return;
        const anchor = { x: x - pageX, y: y - pageY, width, height };
        const menuWidth = Math.min(pageWidth - MENU_INSET * 2, popover.type === "search" ? width : Math.max(120, width));
        const below = pageHeight - anchor.y - height - MENU_INSET - MENU_GAP;
        const above = anchor.y - MENU_INSET - MENU_GAP;
        const opensBelow = below >= Math.min(above, 240);
        const menu = {
          width: menuWidth,
          left: Math.min(Math.max(MENU_INSET, anchor.x), pageWidth - menuWidth - MENU_INSET),
          maxHeight: Math.min(288, Math.max(48, opensBelow ? below : above)),
          ...(opensBelow ? { top: anchor.y + height + MENU_GAP } : { bottom: pageHeight - anchor.y + MENU_GAP }),
        };
        setPosition({ frame: { anchor, menu }, target: popover });
      });
    });
    return () => { active = false; };
  }, [disabled, layoutRevision, pageRef, popover]);

  function dismissExerciseOverlay() {
    if (popover === null) return false;
    if (popover.type === "search") searchInput.current?.blur();
    setPopover(null);
    return true;
  }

  function onExerciseOverlayLayout() {
    if (popover !== null) setLayoutRevision((version) => version + 1);
  }

  function openSearch(shouldOpen: boolean) {
    setPopover((current) => {
      if (shouldOpen && !searchDisabled) {
        return current?.type === "search" ? current : { type: "search", anchor: searchAnchor };
      }
      return current?.type === "search" ? null : current;
    });
  }

  function addExercise(exercise: CatalogExercise) {
    if (searchDisabled) return;
    dismissExerciseOverlay();
    setQuery("");
    onAddExercise(exercise);
  }

  function openRange(exerciseId: string, anchor: AnchorRef) {
    if (disabled) return;
    Keyboard.dismiss();
    feedbackSelection();
    setPopover({ type: "range", exerciseId, anchor });
  }

  function selectRepRange(exerciseId: string, repRange: StrengthRepRange) {
    dismissExerciseOverlay();
    onChangeExercise(exerciseId, (exercise) => setStrengthTarget(exercise, { repRange }, mode));
  }

  const columns = [90, 48, 58, 48, 48, 104].map((width) => Math.ceil(width * Math.max(1, fontScale)));
  const minWidth = columns.reduce((sum, width) => sum + width, 0) + COLUMN_GAP * (columns.length - 1);
  const extraWidth = Math.max(0, tableWidth - minWidth);
  columns[0] += Math.floor(extraWidth / 2);
  columns[5] += Math.ceil(extraWidth / 2);

  const exerciseTable = (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <Text accessibilityRole="header" style={[styles.kicker, { color: theme.colors.textMuted }]}>EXERCISE TABLE</Text>
      {!prescriptionReadOnly ? (
        <View ref={searchAnchor} collapsable={false} style={styles.search}>
          <View style={styles.searchField}>
            <View pointerEvents="none" style={[styles.searchWell, { borderColor: theme.colors.tertiary, backgroundColor: theme.colors.surfaceMuted, minHeight: Math.max(36, Math.ceil(21 * fontScale)) }]}>
              <Ionicons color={theme.colors.tertiary} name="search" size={15} />
            </View>
            <TextInput
              accessibilityLabel="Search Exercises"
              autoCorrect={false}
              editable={!searchDisabled}
              onBlur={() => setPopover((current) => current?.type === "search" ? null : current)}
              onChangeText={(value) => { setQuery(value); openSearch(Boolean(value.trim()) || favouritesOnly); }}
              onFocus={() => openSearch(Boolean(query.trim()) || favouritesOnly)}
              placeholder="Search Exercises"
              placeholderTextColor={theme.colors.textMuted}
              ref={searchInput}
              style={[styles.searchInput, { color: theme.colors.text }]}
              value={query}
            />
          </View>
          <PressOpacity
            accessibilityLabel="Show favourite exercises"
            accessibilityState={{ selected: favouritesOnly, disabled: searchDisabled }}
            disabled={searchDisabled}
            onPress={() => {
              const next = !favouritesOnly;
              setFavouritesOnly(next);
              openSearch(next || Boolean(query.trim()));
            }}
            style={styles.favouritesFilter}
          >
            <Ionicons color={favouritesOnly ? favouriteColor : theme.colors.textMuted} name={favouritesOnly ? "star" : "star-outline"} size={21} />
          </PressOpacity>
        </View>
      ) : null}
      {exercises.length === 0 ? (
        <Text style={[styles.hint, { color: theme.colors.textMuted }]}>No exercises.</Text>
      ) : (
        <ScrollView
          horizontal
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          onLayout={(event) => setTableWidth(event.nativeEvent.layout.width)}
          persistentScrollbar
        >
          <View style={{ width: Math.max(tableWidth, minWidth) }}>
            <TableHeadings columns={columns} labels={targetHeadings} />
            {exercises.map((exercise, index) => (
              <ExerciseRow
                columns={columns}
                disabled={disabled}
                exercise={exercise}
                expandInitially={prescriptionReadOnly && index === 0}
                key={exercise.id}
                mode={mode}
                onChange={(update) => onChangeExercise(exercise.id, update)}
                onOpenRange={(anchor) => openRange(exercise.id, anchor)}
                onRemove={() => onRemoveExercise(exercise.id)}
                prescriptionReadOnly={prescriptionReadOnly}
                rangeExpanded={popover?.type === "range" && popover.exerciseId === exercise.id}
              />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );

  const frame = position?.target === popover && !disabled ? position?.frame : undefined;
  const rangeExercise = popover?.type === "range" ? exercises.find((exercise) => exercise.id === popover.exerciseId) : undefined;
  const exerciseOverlay = frame && popover && (popover.type === "search" || rangeExercise) ? (
    <View accessibilityViewIsModal={popover.type === "range"} pointerEvents="box-none" style={styles.overlay}>
      <PopoverBackdrop
        onDismiss={dismissExerciseOverlay}
        passThrough={popover.type === "search" ? frame.anchor : undefined}
      />
      <View style={[styles.menu, frame.menu, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong }]}>
        {popover.type === "search" ? (
          <ExerciseSearchResults favouritesOnly={favouritesOnly} maxHeight={frame.menu.maxHeight} onSelect={addExercise} query={query} source={source} />
        ) : rangeExercise ? (
          <ScrollView keyboardShouldPersistTaps="handled">
            {STRENGTH_REP_RANGES.map((range) => {
              const selected = range === getStrengthTarget(rangeExercise).repRange;
              return (
                <PressOpacity
                  accessibilityLabel={range}
                  accessibilityState={{ selected }}
                  key={range}
                  onPress={() => selectRepRange(rangeExercise.id, range)}
                  style={[styles.rangeChoice, { borderBottomColor: theme.colors.border }]}
                >
                  <Text style={[styles.wheelText, { color: theme.colors.text }]}>{range}</Text>
                  {selected ? <Ionicons color={theme.colors.tertiary} name="checkmark" size={15} /> : null}
                </PressOpacity>
              );
            })}
          </ScrollView>
        ) : null}
      </View>
    </View>
  ) : null;

  return { dismissExerciseOverlay, exerciseOverlay, exerciseTable, onExerciseOverlayLayout };
}

function PopoverBackdrop({ onDismiss, passThrough }: { onDismiss: () => void; passThrough?: PopoverFrame["anchor"] }) {
  if (!passThrough) {
    return <Pressable accessibilityLabel="Dismiss rep ranges" accessibilityRole="button" onPress={onDismiss} style={StyleSheet.absoluteFill} />;
  }
  const { x, y, width, height } = passThrough;
  return (
    <>
      <Pressable accessibilityLabel="Dismiss exercise results" accessibilityRole="button" onPress={onDismiss} style={[styles.backdrop, { top: 0, left: 0, right: 0, height: Math.max(0, y) }]} />
      <Pressable accessible={false} onPress={onDismiss} style={[styles.backdrop, { top: y + height, left: 0, right: 0, bottom: 0 }]} />
      <Pressable accessible={false} onPress={onDismiss} style={[styles.backdrop, { top: y, left: 0, width: Math.max(0, x), height }]} />
      <Pressable accessible={false} onPress={onDismiss} style={[styles.backdrop, { top: y, left: x + width, right: 0, height }]} />
    </>
  );
}

function TableHeadings({ columns, labels }: { columns: number[]; labels: readonly string[] }) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.row}>
      {labels.map((label, index) => (
        <Text
          key={index}
          accessibilityLabel={label.replace("\n", " ")}
          style={[styles.heading, { color: theme.colors.textMuted, width: columns[index] }, index > 0 && index < 5 && styles.center]}
        >
          {label}
        </Text>
      ))}
    </View>
  );
}

function ExerciseRow({
  columns, disabled, exercise, expandInitially, mode, onChange, onOpenRange, onRemove,
  prescriptionReadOnly, rangeExpanded,
}: {
  columns: number[];
  disabled: boolean;
  exercise: ExerciseDraft;
  expandInitially: boolean;
  mode: StrengthSessionMode;
  onChange: (update: (exercise: ExerciseDraft) => ExerciseDraft) => void;
  onOpenRange: (anchor: AnchorRef) => void;
  onRemove: () => void;
  prescriptionReadOnly: boolean;
  rangeExpanded: boolean;
}) {
  const { theme } = useAppTheme();
  const [expanded, setExpanded] = useState(expandInitially);
  const rangeAnchor = useRef<ComponentRef<typeof View>>(null);
  const target = getStrengthTarget(exercise);
  const hasActualSets = mode === "completed";
  const fieldTheme = { backgroundColor: theme.colors.surfaceMuted, color: theme.colors.text, borderColor: theme.colors.borderStrong };
  const restInput = exercise.restSecondsInput ?? (target.restSeconds == null ? "" : String(target.restSeconds));

  function changeTarget(patch: Partial<StrengthExerciseTarget>) {
    onChange((current) => setStrengthTarget(current, patch, mode));
  }

  function changeRest(input: string) {
    const seconds = Number(input);
    const restSeconds = /^\d+$/.test(input.trim()) && seconds <= MAX_REST_SECONDS ? seconds : null;
    onChange((current) => ({ ...setStrengthTarget(current, { restSeconds }, mode), restSecondsInput: input }));
  }

  function changeActual(setId: string, field: keyof NonNullable<SetDraft["actual"]>, raw: string) {
    if (!/^\d*$/.test(raw) && !(field === "rir" && raw === "10+")) return;
    onChange((current) => updateSet(current, setId, (set) => ({
      ...set,
      actual: { reps: "", rpe: "", rir: "", ...set.actual, [field]: raw },
    })));
  }

  return (
    <Animated.View layout={rowTransition} style={[styles.exercise, { borderColor: theme.colors.border }]}>
      <View style={styles.row}>
        {hasActualSets ? (
          <PressOpacity
            accessibilityLabel={`${exercise.name}, actual sets`}
            accessibilityState={{ expanded, disabled }}
            disabled={disabled}
            onPress={() => setExpanded((open) => !open)}
            style={[styles.exerciseName, { width: columns[0] }]}
          >
            <Text style={[styles.name, { color: theme.colors.text }]}>{exercise.name}</Text>
            <Ionicons color={theme.colors.tertiary} name={expanded ? "chevron-up" : "chevron-down"} size={13} />
          </PressOpacity>
        ) : (
          <View style={[styles.exerciseName, { width: columns[0] }]}><Text style={[styles.name, { color: theme.colors.text }]}>{exercise.name}</Text></View>
        )}
        {prescriptionReadOnly ? ([
          ["Sets", String(target.sets)],
          ["Rep range", target.repRange],
          ["Target RPE", formatRpe(target.rpe)],
          ["Target RIR", formatRir(target.rir)],
          ["Notes", exercise.notes || "—"],
        ].map(([label, value], index) => (
          <Text
            accessibilityLabel={`${exercise.name}, ${label}: ${value}`}
            key={label}
            numberOfLines={index === 4 ? 4 : undefined}
            style={[styles.prescriptionValue, index < 4 && styles.center, { width: columns[index + 1], color: theme.colors.text }]}
          >
            {value}
          </Text>
        ))) : (
          <>
            <View style={{ width: columns[1] }}>
              <InlineScrollPicker disabled={disabled} label={`${exercise.name}, sets`} onChange={(sets) => changeTarget({ sets })} options={setOptions} value={target.sets} />
            </View>
            <View ref={rangeAnchor} collapsable={false} style={{ width: columns[2] }}>
              <InlineScrollPicker
                disabled={disabled}
                expanded={rangeExpanded}
                label={`${exercise.name}, rep range`}
                onChange={(index) => changeTarget({ repRange: STRENGTH_REP_RANGES[index] })}
                onOpen={() => onOpenRange(rangeAnchor)}
                options={rangeOptions}
                value={STRENGTH_REP_RANGES.indexOf(target.repRange)}
              />
            </View>
            <View style={{ width: columns[3] }}>
              <InlineScrollPicker disabled={disabled} label={`${exercise.name}, targeted RPE`} onChange={(rpe) => changeTarget({ rpe: rpe >= 0 ? rpe : null })} options={rpeOptions} value={target.rpe ?? -1} />
            </View>
            <View style={{ width: columns[4] }}>
              <InlineScrollPicker disabled={disabled} label={`${exercise.name}, targeted RIR`} onChange={(rir) => changeTarget({ rir: rir >= 0 ? rir : null })} options={rirOptions} value={target.rir ?? -1} />
            </View>
            <TextInput
              accessibilityLabel={`${exercise.name}, notes`}
              editable={!disabled}
              maxLength={MAX_NOTES}
              multiline
              onChangeText={(notes) => onChange((current) => ({ ...current, notes }))}
              placeholder="Optional"
              placeholderTextColor={theme.colors.textMuted}
              style={[styles.input, fieldTheme, styles.notes, { width: columns[5] }]}
              value={exercise.notes}
            />
          </>
        )}
      </View>
      <View style={styles.row}>
        <View style={{ width: columns[0] + columns[1] + columns[2] + COLUMN_GAP * 2 }}>
          {!prescriptionReadOnly ? (
            <PressOpacity accessibilityLabel={`Remove ${exercise.name}`} disabled={disabled} onPress={onRemove} style={styles.remove}>
              <Ionicons color={theme.colors.textMuted} name="trash-outline" size={16} />
              <Text style={[styles.hint, { color: theme.colors.textMuted }]}>Remove</Text>
            </PressOpacity>
          ) : null}
        </View>
        <View style={{ width: columns[3] + columns[4] + COLUMN_GAP }}>
          {prescriptionReadOnly ? (
            <Text style={[styles.prescriptionValue, { color: theme.colors.textMuted }]}>Rest between sets · {formatRestSeconds(target.restSeconds)}</Text>
          ) : (
            <TrainingNumberField editable={!disabled} label="Rest between sets (s)" maxLength={5} onChangeText={changeRest} placeholder="Optional" value={restInput} />
          )}
        </View>
      </View>
      {hasActualSets && expanded ? (
        <View style={[styles.actualSets, { borderColor: theme.colors.border }]}>
          <TableHeadings columns={columns} labels={["Actual sets", "Set #", "Reps", "RPE", "RIR", ""]} />
          {exercise.sets.map((set, index) => (
            <View key={set.id} style={styles.row}>
              <View style={{ width: columns[0] }} />
              <Text style={[styles.setNumber, { color: theme.colors.textMuted, width: columns[1] }]}>{index + 1}</Text>
              {(["reps", "rpe", "rir"] as const).map((field, metricIndex) => (
                <ActualSetInput
                  disabled={disabled}
                  field={field}
                  key={field}
                  label={`${exercise.name}, set ${index + 1}, ${field === "reps" ? "reps" : field.toUpperCase()}`}
                  onChange={(raw) => changeActual(set.id, field, raw)}
                  raw={set.actual?.[field] ?? ""}
                  width={columns[metricIndex + 2]}
                />
              ))}
            </View>
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}

function ActualSetInput({
  disabled, field, label, onChange, raw, width,
}: {
  disabled: boolean;
  field: keyof NonNullable<SetDraft["actual"]>;
  label: string;
  onChange: (raw: string) => void;
  raw: string;
  width: number;
}) {
  const { theme } = useAppTheme();
  const [focused, setFocused] = useState(false);
  const value = field === "rir" && Number(raw.replace(/\+$/, "")) === 10
    ? focused ? raw.replace(/\+$/, "") : "10+"
    : raw;

  return (
    <TextInput
      accessibilityLabel={label}
      editable={!disabled}
      keyboardType="number-pad"
      maxLength={field === "reps" ? 5 : 4}
      onBlur={() => setFocused(false)}
      onChangeText={onChange}
      onFocus={() => setFocused(true)}
      placeholder="—"
      placeholderTextColor={theme.colors.textMuted}
      style={[styles.input, styles.actualInput, { width, backgroundColor: theme.colors.surfaceMuted, color: theme.colors.text, borderColor: theme.colors.borderStrong }]}
      value={value}
    />
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: tokens.radius.lg, padding: tokens.spacing.lg, gap: tokens.spacing.sm },
  kicker: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  hint: { fontSize: 13 },
  search: { alignItems: "center", flexDirection: "row" },
  searchField: { flex: 1, justifyContent: "center" },
  searchWell: { alignItems: "center", borderRadius: tokens.radius.sm, borderWidth: 1, flexDirection: "row", left: 0, paddingHorizontal: tokens.spacing.sm, position: "absolute", right: 0 },
  searchInput: { fontSize: 14, minHeight: 48, paddingLeft: 30, paddingRight: tokens.spacing.sm, paddingVertical: tokens.spacing.sm },
  favouritesFilter: { minWidth: 48, minHeight: 48, justifyContent: "center", alignItems: "center" },
  row: { alignItems: "center", flexDirection: "row", gap: COLUMN_GAP },
  heading: { fontSize: 10, letterSpacing: 0.25, fontWeight: "700", textTransform: "uppercase" },
  center: { textAlign: "center" },
  exercise: { borderTopWidth: 1, gap: tokens.spacing.xs, paddingVertical: tokens.spacing.sm },
  exerciseName: { alignItems: "flex-start", justifyContent: "center", minHeight: 48, paddingRight: 2, gap: 3 },
  name: { fontSize: 13, fontWeight: "700" },
  prescriptionValue: { fontSize: 13, fontVariant: ["tabular-nums"] },
  input: { minHeight: 48, borderWidth: 1, borderRadius: tokens.radius.sm, fontSize: 14 },
  notes: { fontSize: 13, maxHeight: 88, paddingHorizontal: 6, paddingVertical: 8 },
  remove: { flexDirection: "row", gap: tokens.spacing.xs, alignSelf: "flex-start", justifyContent: "center", alignItems: "center", minWidth: 48, minHeight: 48 },
  actualSets: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: tokens.spacing.sm, gap: tokens.spacing.xs },
  actualInput: { fontVariant: ["tabular-nums"], paddingHorizontal: 2, textAlign: "center" },
  setNumber: { fontVariant: ["tabular-nums"], fontSize: 13, fontWeight: "700", textAlign: "center" },
  overlay: { ...StyleSheet.absoluteFill, zIndex: 10 },
  backdrop: { position: "absolute" },
  menu: { position: "absolute", borderRadius: tokens.radius.md, borderWidth: 1, overflow: "hidden", boxShadow: "0px 6px 16px rgba(0, 0, 0, 0.24)" },
  rangeChoice: { minHeight: 48, alignItems: "center", justifyContent: "space-between", flexDirection: "row", gap: tokens.spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: tokens.spacing.md },
  wheelText: { fontVariant: ["tabular-nums"], fontSize: 14, fontWeight: "700" },
});
