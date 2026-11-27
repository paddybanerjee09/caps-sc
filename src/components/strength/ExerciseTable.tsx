import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef, useState, type ComponentRef, type RefObject } from "react";
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, type TextInputProps } from "react-native";
import Animated, { Easing, LinearTransition, ReduceMotion } from "react-native-reanimated";

import { getStrengthTarget, MAX_EXERCISES, MAX_NOTES, MAX_REST_SECONDS, MAX_SETS, setStrengthTarget, updateSet } from "../../strength/drafts";
import { STRENGTH_REP_RANGES, type CatalogExercise, type ExerciseDraft, type SetDraft, type StrengthExerciseTarget, type StrengthRepRange, type StrengthSessionMode } from "../../strength/types";
import { formatRir, formatRpe } from "../../strength/units";
import { useAppTheme } from "../../theme/ThemeContext";
import { themes } from "../../theme/theme";
import { feedbackSelection } from "../../utils/feedback";
import { PressOpacity } from "../PressOpacity";
import { InlineScrollPicker } from "../ScrollPicker";
import { ExerciseSearchResults, useExerciseCatalog, useExerciseFavouriteColor } from "./ExerciseSearchResults";

const tokens = themes.dark;
export const exerciseTableColumnGap = 3;
export const exerciseTableColumns = [66, 32, 40, 30, 30, 43, 53] as const;
export const exerciseTableLabels = ["Exercise", "Sets", "Range", "RPE", "RIR", "Rest (s)", "Notes"] as const;
const targetAccessibilityLabels = ["Exercise", "Sets", "Rep range", "Targeted RPE", "Targeted RIR", "Rest between sets in seconds", "Notes"];
const editorColumnWidths = [260, 68, 108, 104, 104, 94, 220];
const editorColumnGap = 12;
const MENU_GAP = tokens.spacing.xs;
const MENU_INSET = tokens.spacing.sm;
const rowTransition = LinearTransition.duration(220).easing(Easing.out(Easing.cubic)).reduceMotion(ReduceMotion.System);
const setOptions = Array.from({ length: MAX_SETS }, (_, index) => ({ value: index + 1, label: String(index + 1) }));
const rangeOptions = STRENGTH_REP_RANGES.map((label, value) => ({ label, value }));
const unsetEffort = { value: -1, label: "—" };
const rpeOptions = [...Array.from({ length: 10 }, (_, index) => ({ value: 10 - index, label: String(10 - index) })), unsetEffort];
const rirOptions = [...Array.from({ length: 11 }, (_, value) => ({ value, label: value === 10 ? "10+" : String(value) })), unsetEffort];
type ChangeExercise = (id: string, update: (exercise: ExerciseDraft) => ExerciseDraft) => void;
type AnchorRef = RefObject<ComponentRef<typeof View> | null>;
type TextInputFocusCallbacks = {
  onTextInputFocus?: () => void;
  onTextInputBlur?: () => void;
};
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
  onAddExercise, onChangeExercise, onRemoveExercise, onTextInputFocus, onTextInputBlur,
}: TextInputFocusCallbacks & {
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
  const source = useExerciseCatalog(!prescriptionReadOnly);
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

  const widths = [...editorColumnWidths];
  for (const exercise of exercises) {
    widths[0] = Math.max(widths[0], Array.from(exercise.name).length * 14 + 24);
    widths[6] = Math.max(widths[6], Array.from(inlineNotes(exercise.notes)).length * 14 + 12);
  }
  if (!prescriptionReadOnly) widths.push(48);
  const columns = widths.map((width) => Math.ceil(width * Math.max(1, fontScale)));
  const minWidth = columns.reduce((sum, width) => sum + width, 0) + editorColumnGap * (columns.length - 1);
  const extraWidth = Math.max(0, tableWidth - minWidth);
  columns[0] += Math.floor(extraWidth / 2);
  columns[6] += Math.ceil(extraWidth / 2);

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
              onBlur={() => {
                onTextInputBlur?.();
                setPopover((current) => current?.type === "search" ? null : current);
              }}
              onChangeText={(value) => { setQuery(value); openSearch(Boolean(value.trim()) || favouritesOnly); }}
              onFocus={() => {
                onTextInputFocus?.();
                openSearch(Boolean(query.trim()) || favouritesOnly);
              }}
              placeholder="Search Exercises"
              placeholderTextColor={theme.colors.textMuted}
              ref={searchInput}
              returnKeyType="done"
              style={[styles.searchInput, { color: theme.colors.text }]}
              submitBehavior="blurAndSubmit"
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
          <View style={[styles.tableContent, { width: Math.max(tableWidth, minWidth) }]}>
            <TableHeadings columns={columns} labels={["Exercise", "Sets", "Rep Range", "Target RPE", "Target RIR", "Rest (s)", "Notes"]} accessibilityLabels={targetAccessibilityLabels} />
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
                onTextInputBlur={onTextInputBlur}
                onTextInputFocus={onTextInputFocus}
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

function TableHeadings({ columns, labels, accessibilityLabels = labels }: {
  columns: number[];
  labels: readonly string[];
  accessibilityLabels?: readonly string[];
}) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.row}>
      {labels.map((label, index) => (
        <Text
          key={index}
          accessibilityLabel={accessibilityLabels[index]}
          numberOfLines={1}
          style={[styles.heading, { color: theme.colors.textMuted, width: columns[index] }, index > 0 && index < 6 && styles.center]}
        >
          {label}
        </Text>
      ))}
    </View>
  );
}

function inlineNotes(notes: string) {
  return notes.replace(/\s*\r?\n\s*/g, " ");
}

function ExerciseRow({
  columns, disabled, exercise, expandInitially, mode, onChange, onOpenRange, onRemove,
  prescriptionReadOnly, rangeExpanded, onTextInputFocus, onTextInputBlur,
}: TextInputFocusCallbacks & {
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
  const restInput = exercise.restSecondsInput ?? (target.restSeconds == null ? "" : String(target.restSeconds));
  const displayedNotes = inlineNotes(exercise.notes);
  const focusCallbacks = { onBlur: onTextInputBlur, onFocus: onTextInputFocus };

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
      <View style={[styles.row, styles.valueRow]}>
        {hasActualSets ? (
          <PressOpacity
            accessibilityLabel={`${exercise.name}, actual sets`}
            accessibilityState={{ expanded, disabled }}
            disabled={disabled}
            onPress={() => setExpanded((open) => !open)}
            style={[styles.exerciseName, { width: columns[0] }]}
          >
            <Text numberOfLines={1} style={[styles.name, { color: theme.colors.text }]}>{exercise.name}</Text>
            <Ionicons color={theme.colors.tertiary} name={expanded ? "chevron-up" : "chevron-down"} size={9} />
          </PressOpacity>
        ) : (
          <View style={[styles.exerciseName, { width: columns[0] }]}>
            <Text accessibilityLabel={exercise.name} numberOfLines={1} style={[styles.name, { color: theme.colors.text }]}>{exercise.name}</Text>
          </View>
        )}
        {prescriptionReadOnly ? ([
          ["Sets", String(target.sets)],
          ["Rep range", target.repRange],
          ["Target RPE", formatRpe(target.rpe)],
          ["Target RIR", formatRir(target.rir)],
          ["Rest between sets in seconds", String(target.restSeconds ?? "—")],
          ["Notes", displayedNotes || "—"],
        ].map(([label, value], index) => (
          <Text
            accessibilityLabel={`${exercise.name}, ${label}: ${value}`}
            key={label}
            numberOfLines={1}
            style={[styles.prescriptionValue, index < 5 && styles.center, { width: columns[index + 1], color: theme.colors.text }]}
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
            <CompactInput
              {...focusCallbacks}
              accessibilityLabel={`${exercise.name}, rest between sets in seconds`}
              editable={!disabled}
              maxLength={5}
              numeric
              onChangeText={changeRest}
              value={restInput}
              width={columns[5]}
            />
            <CompactInput
              {...focusCallbacks}
              accessibilityLabel={`${exercise.name}, notes`}
              editable={!disabled}
              maxLength={MAX_NOTES}
              onChangeText={(notes) => onChange((current) => ({ ...current, notes }))}
              value={displayedNotes}
              width={columns[6]}
            />
            <PressOpacity accessibilityLabel={`Remove ${exercise.name}`} disabled={disabled} onPress={onRemove} style={[styles.remove, { width: columns[7] }]}>
              <Ionicons color={theme.colors.textMuted} name="trash-outline" size={15} />
            </PressOpacity>
          </>
        )}
      </View>
      {hasActualSets && expanded ? (
        <View style={[styles.actualSets, { borderColor: theme.colors.border }]}>
          <TableHeadings columns={columns} labels={["Actual sets", "Set #", "Reps", "RPE", "RIR"]} />
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
                  onTextInputBlur={onTextInputBlur}
                  onTextInputFocus={onTextInputFocus}
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
  disabled, field, label, onChange, raw, width, onTextInputFocus, onTextInputBlur,
}: TextInputFocusCallbacks & {
  disabled: boolean;
  field: keyof NonNullable<SetDraft["actual"]>;
  label: string;
  onChange: (raw: string) => void;
  raw: string;
  width: number;
}) {
  const [focused, setFocused] = useState(false);
  const value = field === "rir" && Number(raw.replace(/\+$/, "")) === 10
    ? focused ? raw.replace(/\+$/, "") : "10+"
    : raw;

  return (
    <CompactInput
      accessibilityLabel={label}
      editable={!disabled}
      maxLength={field === "reps" ? 5 : 4}
      numeric
      onBlur={() => {
        setFocused(false);
        onTextInputBlur?.();
      }}
      onChangeText={onChange}
      onFocus={() => {
        setFocused(true);
        onTextInputFocus?.();
      }}
      value={value}
      width={width}
    />
  );
}

function CompactInput({ numeric = false, width, ...props }: Pick<
  TextInputProps,
  "accessibilityLabel" | "editable" | "maxLength" | "onBlur" | "onChangeText" | "onFocus" | "value"
> & { numeric?: boolean; width: number }) {
  const { theme } = useAppTheme();
  return (
    <TextInput
      {...props}
      keyboardType={numeric ? "number-pad" : "default"}
      placeholder="—"
      placeholderTextColor={theme.colors.textMuted}
      returnKeyType="done"
      style={[
        styles.input,
        numeric && styles.numericInput,
        { width, backgroundColor: theme.colors.surfaceMuted, color: theme.colors.text, borderColor: theme.colors.borderStrong },
      ]}
      submitBehavior="blurAndSubmit"
    />
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: tokens.radius.lg, paddingHorizontal: 6, paddingVertical: tokens.spacing.sm, gap: tokens.spacing.xs },
  kicker: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  hint: { fontSize: 13 },
  search: { alignItems: "center", flexDirection: "row" },
  searchField: { flex: 1, justifyContent: "center" },
  searchWell: { alignItems: "center", borderRadius: tokens.radius.sm, borderWidth: 1, flexDirection: "row", left: 0, paddingHorizontal: tokens.spacing.sm, position: "absolute", right: 0 },
  searchInput: { fontSize: 14, minHeight: 48, paddingLeft: 30, paddingRight: tokens.spacing.sm, paddingVertical: tokens.spacing.sm },
  favouritesFilter: { minWidth: 48, minHeight: 48, justifyContent: "center", alignItems: "center" },
  tableContent: { flexShrink: 0 },
  row: { alignItems: "center", flexDirection: "row", flexWrap: "nowrap", gap: editorColumnGap },
  valueRow: { minHeight: 40 },
  heading: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  center: { textAlign: "center" },
  exercise: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 1 },
  exerciseName: { flexDirection: "row", flexShrink: 0, alignItems: "center", minHeight: 40, gap: 6 },
  name: { flexShrink: 0, fontSize: 12, fontWeight: "700" },
  prescriptionValue: { fontSize: 12, fontVariant: ["tabular-nums"] },
  input: { minHeight: 34, borderWidth: 1, borderRadius: tokens.radius.sm, fontSize: 12, paddingHorizontal: 4, paddingVertical: 2 },
  numericInput: { fontVariant: ["tabular-nums"], paddingHorizontal: 2, textAlign: "center" },
  remove: { justifyContent: "center", alignItems: "center", minHeight: 40 },
  actualSets: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 2, gap: 2 },
  setNumber: { fontVariant: ["tabular-nums"], fontSize: 12, fontWeight: "700", textAlign: "center" },
  overlay: { ...StyleSheet.absoluteFill, zIndex: 10 },
  backdrop: { position: "absolute" },
  menu: { position: "absolute", borderRadius: tokens.radius.md, borderWidth: 1, overflow: "hidden", boxShadow: "0px 6px 16px rgba(0, 0, 0, 0.24)" },
  rangeChoice: { minHeight: 48, alignItems: "center", justifyContent: "space-between", flexDirection: "row", gap: tokens.spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: tokens.spacing.md },
  wheelText: { fontVariant: ["tabular-nums"], fontSize: 14, fontWeight: "700" },
});
