import { useCallback, useEffect, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSQLiteContext } from "expo-sqlite";

import { LogTimeChanger } from "../../components/LogTimeChanger";
import { PressOpacity } from "../../components/PressOpacity";
import { deviceTimeZone, formatLocalDate } from "../../conditioning/dates";
import {
  archiveSkillTemplate,
  logSkillSession,
  saveSkillTemplate,
} from "../../data/skillRepository";
import { getWeightKgAtOrBefore } from "../../data/timelineRepository";
import { activitiesForDiscipline, getSkillActivity } from "../../skill/catalog";
import {
  addCatalogActivity,
  moveActivity,
  removeActivity,
  templateButtonLabel,
  updateActivity,
} from "../../skill/drafts";
import { estimateActivities, sumEnergyKcal, weightForEstimate } from "../../skill/energy";
import { focusFromDisciplines, FOCUS_PRESENTATION } from "../../skill/focus";
import {
  activityElapsedLabel,
  activitySettingsLine,
  focusLabel,
  formatElapsed,
  formatKcal,
  formatMmSs,
  modeLabel,
  rpeLabel,
  weightBasisText,
} from "../../skill/present";
import { elapsedSeconds, sessionStartMs } from "../../skill/timing";
import type {
  RpeBand,
  SessionMode,
  SkillActivityDraft,
  SkillDiscipline,
  SkillDraft,
} from "../../skill/types";
import { MAX_SKILL_ACTIVITIES } from "../../skill/types";
import { validateSkillDraft } from "../../skill/validation";
import { useAppState } from "../../state/AppStateContext";
import { useSkillWorkspace } from "../../state/SkillWorkspaceContext";
import { useAppTheme } from "../../theme/ThemeContext";
import { readableTextColor, themes } from "../../theme/theme";
import { feedbackConfirm, feedbackStep, feedbackWarn } from "../../utils/feedback";

const tokens = themes.dark;

const disciplines: { key: SkillDiscipline; label: string }[] = [
  { key: "general", label: "General" },
  { key: "muay_thai", label: "Muay Thai/KB" },
  { key: "boxing", label: "Boxing" },
  { key: "bjj", label: "BJJ/No-Gi" },
];

const rpeBands: RpeBand[] = ["easy", "moderate", "hard"];

export function SkillSessionBuilderScreen() {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const { bumpTimeline } = useAppState();
  const workspace = useSkillWorkspace();
  const draft = workspace.draft;
  const [timeOpen, setTimeOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [discipline, setDiscipline] = useState<SkillDiscipline>("general");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loggedWeight, setLoggedWeight] = useState<number | null>(null);
  const primaryText = readableTextColor(theme.colors.tertiary);

  const endedAt = draft?.endedAt;
  const draftRef = useRef(draft);
  const baselineRef = useRef(workspace.discardBaseline);
  useEffect(() => {
    draftRef.current = draft;
    baselineRef.current = workspace.discardBaseline;
  }, [draft, workspace.discardBaseline]);

  const closeDraft = useCallback(() => {
    const current = draftRef.current;
    if (!current) {
      return;
    }
    if (JSON.stringify(current) !== baselineRef.current) {
      workspace.requestConfirm({
        confirmLabel: "Discard",
        message:
          "The session draft will be discarded. A template you already saved stays in Saved Sessions.",
        onConfirm: () => workspace.resetWorkspace(),
        title: "Discard this session?",
      });
      return;
    }
    workspace.resetWorkspace();
  }, [workspace]);

  useEffect(() => {
    if (endedAt == null) {
      return;
    }
    let cancelled = false;
    void getWeightKgAtOrBefore(db, endedAt)
      .then((kg) => {
        if (!cancelled) {
          setLoggedWeight(kg);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoggedWeight(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [db, endedAt]);

  useEffect(() => {
    workspace.registerBackHandler(() => {
      closeDraft();
      return true;
    });
    return () => workspace.registerBackHandler(null);
  }, [closeDraft, workspace]);

  if (!draft) {
    return null;
  }

  const weight = weightForEstimate(loggedWeight);
  const estimates = estimateActivities(draft.activities, weight.kg);
  const elapsed = elapsedSeconds(draft.activities);
  const focus = focusFromDisciplines(draft.activities.map((activity) => activity.discipline));
  const label = templateButtonLabel(draft, workspace.templateBaseline);
  const startedAt = elapsed == null ? null : sessionStartMs(draft.endedAt, elapsed);
  const crossesMidnight =
    startedAt != null &&
    formatLocalDate(new Date(startedAt)) !== formatLocalDate(new Date(draft.endedAt));

  function update(next: SkillDraft) {
    setFormError(null);
    workspace.updateDraft(next);
  }

  async function persistTemplate(now: number) {
    if (!draft || saving) {
      return;
    }
    if (label === "Saved" && draft.sourceTemplateId) {
      const templateId = draft.sourceTemplateId;
      workspace.requestConfirm({
        confirmLabel: "Remove",
        message:
          "This removes the template from Saved Sessions. The activities stay here so you can log or save them again.",
        onConfirm: () => {
          void removeTemplate(templateId);
        },
        title: "Remove saved session?",
      });
      return;
    }
    const error = validateSkillDraft(draft, "template", now);
    if (error) {
      feedbackWarn();
      setFormError(error);
      return;
    }
    setSaving(true);
    try {
      const id = await saveSkillTemplate(db, draft);
      workspace.markTemplateSaved({
        ...draft,
        sourceTemplateId: id,
        templateLink: "linked",
      });
      workspace.bumpRevision();
      feedbackConfirm();
    } catch (error) {
      feedbackWarn();
      setFormError(error instanceof Error ? error.message : "Couldn’t save.");
    } finally {
      setSaving(false);
    }
  }

  async function removeTemplate(templateId: string) {
    if (!draft) {
      return;
    }
    setSaving(true);
    try {
      await archiveSkillTemplate(db, templateId);
      workspace.markTemplateUnsaved({
        ...draft,
        sourceTemplateId: null,
        templateLink: "detached",
      });
      workspace.bumpRevision();
      feedbackConfirm();
    } catch (error) {
      feedbackWarn();
      setFormError(error instanceof Error ? error.message : "Couldn’t remove that saved session.");
    } finally {
      setSaving(false);
    }
  }

  async function logSession(now: number) {
    if (!draft || saving) {
      return;
    }
    const error = validateSkillDraft(draft, "log", now, deviceTimeZone());
    if (error) {
      feedbackWarn();
      setFormError(error);
      return;
    }
    setSaving(true);
    try {
      const result = await logSkillSession(db, draft, { now });
      feedbackConfirm();
      bumpTimeline();
      workspace.completeLog(result.localEndDate);
    } catch (error) {
      feedbackWarn();
      setFormError(error instanceof Error ? error.message : "Couldn’t log.");
      setSaving(false);
    }
  }

  function shiftDay(daysAgo: number) {
    const now = new Date();
    const target = new Date(now);
    target.setDate(now.getDate() - daysAgo);
    const next = new Date(draft!.endedAt);
    next.setFullYear(target.getFullYear(), target.getMonth(), target.getDate());
    update({ ...draft!, endedAt: Math.min(next.getTime(), Date.now()) });
  }

  return (
    <View style={[styles.page, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.scroller}
      >
        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <Text style={[styles.kicker, { color: theme.colors.textMuted }]}>TITLE</Text>
          <TextInput
            accessibilityLabel="Session title"
            maxLength={80}
            onChangeText={(title) => update({ ...draft, title })}
            placeholder="Session title"
            placeholderTextColor={theme.colors.textMuted}
            style={[
              styles.input,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.borderStrong,
                color: theme.colors.text,
              },
            ]}
            value={draft.title}
          />
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <Text style={[styles.kicker, { color: theme.colors.textMuted }]}>DATE</Text>
          <Text style={[styles.dateReadout, { color: theme.colors.text }]}>
            {formatDay(new Date(draft.endedAt))}
          </Text>
          <View style={styles.presetRow}>
            <Chip label="-1 day" onPress={() => shiftDay(daysFromToday(draft.endedAt) + 1)} />
            <Chip label="Today" onPress={() => shiftDay(0)} />
            <Chip label="Yesterday" onPress={() => shiftDay(1)} />
            <Chip label="7 days" onPress={() => shiftDay(7)} />
          </View>
          <PressOpacity
            accessibilityLabel={`Ends at ${formatClock(new Date(draft.endedAt))}`}
            onPress={() => setTimeOpen((open) => !open)}
            style={[
              styles.secondary,
              {
                backgroundColor: timeOpen ? theme.colors.tertiary : theme.colors.surfaceMuted,
                borderColor: theme.colors.borderStrong,
              },
            ]}
          >
            <Text
              style={[
                styles.secondaryText,
                { color: timeOpen ? primaryText : theme.colors.text },
              ]}
            >
              Ends at {formatClock(new Date(draft.endedAt))}
            </Text>
          </PressOpacity>
          {timeOpen ? (
            <LogTimeChanger
              label="Ends at"
              maximumDate={new Date()}
              onChange={(date) => update({ ...draft, endedAt: date.getTime() })}
              value={new Date(draft.endedAt)}
            />
          ) : null}
          <Text style={[styles.body, { color: theme.colors.text }]}>
            Estimated time {formatElapsed(elapsed)}
          </Text>
          <Text style={[styles.hint, { color: theme.colors.textMuted }]}>
            Starts {startedAt == null ? "—" : formatClock(new Date(startedAt))}
            {crossesMidnight ? " the day before" : ""}
          </Text>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <View style={styles.summaryHeader}>
            <Text style={[styles.kicker, { color: theme.colors.textMuted }]}>SUMMARY</Text>
            {focus ? (
              <View style={styles.focusBadge}>
                <View
                  style={[styles.swatch, { backgroundColor: FOCUS_PRESENTATION[focus].color }]}
                />
                <Text style={[styles.badgeText, { color: theme.colors.text }]}>
                  {focusLabel(focus)}
                </Text>
              </View>
            ) : (
              <Text style={[styles.badgeText, { color: theme.colors.textMuted }]}>—</Text>
            )}
          </View>
          <Text style={[styles.kicker, { color: theme.colors.textMuted }]}>FOCUS</Text>
          <Text style={[styles.metric, { color: theme.colors.text }]}>
            {focus ? focusLabel(focus) : "—"}
          </Text>
          <Text style={[styles.kicker, { color: theme.colors.textMuted }]}>ESTIMATED TIME</Text>
          <Text style={[styles.metric, { color: theme.colors.text }]}>{formatElapsed(elapsed)}</Text>
          <Text style={[styles.kicker, { color: theme.colors.textMuted }]}>
            ESTIMATED CALORIES
          </Text>
          <Text style={[styles.metric, { color: theme.colors.text }]}>
            {draft.activities.length === 0 ? "—" : formatKcal(sumEnergyKcal(estimates))}
          </Text>
          <Text style={[styles.hint, { color: theme.colors.textMuted }]}>
            {weightBasisText(weight.basis, weight.kg)}. RPE is the rate of perceived exertion for
            the work.
          </Text>
        </View>

        {draft.activities.map((activity, index) => (
          <ActivityCard
            activity={activity}
            estimateKcal={estimates.find((item) => item.id === activity.id)?.energyKcal ?? null}
            expanded={expandedId === activity.id}
            index={index}
            key={activity.id}
            onMove={(direction) => update(moveActivity(draft, activity.id, direction))}
            onRemove={() => update(removeActivity(draft, activity.id))}
            onToggle={() => setExpandedId((current) => (current === activity.id ? null : activity.id))}
            onUpdate={(patch) => update(updateActivity(draft, activity.id, patch))}
            total={draft.activities.length}
          />
        ))}

        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <Text style={[styles.kicker, { color: theme.colors.textMuted }]}>ADD ACTIVITY</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.presetRow}>
              {disciplines.map((item) => (
                <Chip
                  key={item.key}
                  label={item.label}
                  onPress={() => setDiscipline(item.key)}
                  selected={discipline === item.key}
                />
              ))}
            </View>
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.presetRow}>
              {activitiesForDiscipline(discipline).map((item) => (
                <Chip
                  key={item.key}
                  label={item.name}
                  onPress={() => {
                    if (draft.activities.length >= MAX_SKILL_ACTIVITIES) {
                      feedbackWarn();
                      setFormError("This session already has 24 activities.");
                      return;
                    }
                    const next = addCatalogActivity(draft, item.key);
                    update(next);
                    const created = next.activities.at(-1);
                    if (created) {
                      setExpandedId(created.id);
                    }
                  }}
                />
              ))}
            </View>
          </ScrollView>
        </View>
      </ScrollView>

      {formError ? (
        <Text style={[styles.error, { color: theme.colors.tertiary }]}>{formError}</Text>
      ) : null}
      <View
        style={[
          styles.footer,
          { backgroundColor: theme.colors.background, borderTopColor: theme.colors.border },
        ]}
      >
        <PressOpacity
          accessibilityLabel="Cancel"
          disabled={saving}
          onPress={closeDraft}
          style={[
            styles.footerButton,
            { backgroundColor: "transparent", borderColor: theme.colors.borderStrong },
          ]}
        >
          <Text style={[styles.secondaryText, { color: theme.colors.text }]}>Cancel</Text>
        </PressOpacity>
        <PressOpacity
          accessibilityLabel={
            label === "Saved"
              ? "Saved session template"
              : label === "Unsaved"
                ? "Unsaved session template"
                : "Save session template"
          }
          disabled={saving}
          onPress={() => {
            void persistTemplate(Date.now());
          }}
          style={[
            styles.footerButton,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        >
          <Text style={[styles.secondaryText, { color: theme.colors.text }]}>{label}</Text>
        </PressOpacity>
        <PressOpacity
          accessibilityLabel="Log skill session"
          disabled={saving}
          onPress={() => {
            void logSession(Date.now());
          }}
          style={[styles.logButton, { backgroundColor: theme.colors.tertiary }]}
        >
          <Text style={[styles.primaryText, { color: primaryText }]}>Log</Text>
        </PressOpacity>
      </View>
    </View>
  );
}

function ActivityCard({
  activity,
  estimateKcal,
  expanded,
  index,
  onMove,
  onRemove,
  onToggle,
  onUpdate,
  total,
}: {
  activity: SkillActivityDraft;
  estimateKcal: number | null;
  expanded: boolean;
  index: number;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  onToggle: () => void;
  onUpdate: (patch: Partial<SkillActivityDraft>) => void;
  total: number;
}) {
  const { theme } = useAppTheme();
  const modes = getSkillActivity(activity.activityKey)?.modes ?? null;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}
    >
      <View style={styles.activityHeader}>
        <PressOpacity
          accessibilityLabel={`${expanded ? "Collapse" : "Edit"} ${activity.name}`}
          onPress={onToggle}
          style={styles.activityTitle}
        >
          <Text style={[styles.kicker, { color: theme.colors.textMuted }]}>
            ACTIVITY {index + 1}
          </Text>
          <Text style={[styles.body, { color: theme.colors.text }]}>{activity.name}</Text>
        </PressOpacity>
        <PressOpacity
          accessibilityLabel={`Move ${activity.name} up`}
          disabled={index === 0}
          onPress={() => onMove(-1)}
          style={[
            styles.iconButton,
            { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.borderStrong },
          ]}
        >
          <Text style={[styles.secondaryText, { color: theme.colors.text }]}>Up</Text>
        </PressOpacity>
        <PressOpacity
          accessibilityLabel={`Move ${activity.name} down`}
          disabled={index === total - 1}
          onPress={() => onMove(1)}
          style={[
            styles.iconButton,
            { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.borderStrong },
          ]}
        >
          <Text style={[styles.secondaryText, { color: theme.colors.text }]}>Down</Text>
        </PressOpacity>
      </View>
      <Text style={[styles.metric, { color: theme.colors.text }]}>
        {activityElapsedLabel(activity)}
      </Text>
      <Text style={[styles.hint, { color: theme.colors.textMuted }]}>
        {activitySettingsLine(activity)}
      </Text>
      <Text style={[styles.body, { color: theme.colors.text }]}>
        {estimateKcal == null ? "—" : formatKcal(estimateKcal)}
      </Text>
      {expanded ? (
        <View style={styles.editor}>
          <View style={styles.presetRow}>
            <Chip
              label="Duration"
              onPress={() => onUpdate({ timingMode: "duration" })}
              selected={activity.timingMode === "duration"}
            />
            <Chip
              label="Rounds"
              onPress={() => onUpdate({ timingMode: "rounds" })}
              selected={activity.timingMode === "rounds"}
            />
          </View>
          {activity.timingMode === "duration" ? (
            <NumberField
              label="Duration"
              onChange={(durationSeconds) => onUpdate({ durationSeconds })}
              presets={[
                { label: "1 min", value: 60 },
                { label: "3 min", value: 180 },
                { label: "5 min", value: 300 },
                { label: "10 min", value: 600 },
              ]}
              step={15}
              minimum={15}
              value={activity.durationSeconds}
              valueLabel={formatMmSs(activity.durationSeconds)}
            />
          ) : (
            <>
              <NumberField
                label="Rounds"
                minimum={1}
                onChange={(rounds) => onUpdate({ rounds })}
                presets={[
                  { label: "1", value: 1 },
                  { label: "3", value: 3 },
                  { label: "5", value: 5 },
                  { label: "10", value: 10 },
                ]}
                step={1}
                value={activity.rounds}
                valueLabel={String(activity.rounds)}
              />
              <NumberField
                label="Work"
                minimum={15}
                onChange={(secondsPerRound) => onUpdate({ secondsPerRound })}
                presets={[
                  { label: "1 min", value: 60 },
                  { label: "3 min", value: 180 },
                  { label: "5 min", value: 300 },
                  { label: "10 min", value: 600 },
                ]}
                step={15}
                value={activity.secondsPerRound}
                valueLabel={formatMmSs(activity.secondsPerRound)}
              />
              <NumberField
                label="Rest"
                minimum={0}
                onChange={(restBetweenRoundsSeconds) => onUpdate({ restBetweenRoundsSeconds })}
                presets={[
                  { label: "0", value: 0 },
                  { label: "30s", value: 30 },
                  { label: "1 min", value: 60 },
                  { label: "90s", value: 90 },
                ]}
                step={15}
                value={activity.restBetweenRoundsSeconds}
                valueLabel={formatMmSs(activity.restBetweenRoundsSeconds)}
              />
            </>
          )}
          {modes ? (
            <View style={styles.field}>
              <Text style={[styles.kicker, { color: theme.colors.textMuted }]}>MODE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.presetRow}>
                  {modes.map((mode) => (
                    <Chip
                      key={mode.mode}
                      label={modeLabel(mode.mode)}
                      onPress={() => onUpdate({ sessionMode: mode.mode as SessionMode })}
                      selected={activity.sessionMode === mode.mode}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>
          ) : null}
          <View style={styles.field}>
            <Text style={[styles.kicker, { color: theme.colors.textMuted }]}>
              RATE OF PERCEIVED EXERTION
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.presetRow}>
                {rpeBands.map((band) => (
                  <Chip
                    key={band}
                    label={rpeLabel(band)}
                    onPress={() => onUpdate({ rpeBand: band })}
                    selected={activity.rpeBand === band}
                  />
                ))}
              </View>
            </ScrollView>
          </View>
          <PressOpacity
            accessibilityLabel={`Remove ${activity.name}`}
            onPress={onRemove}
            style={[
              styles.secondary,
              { backgroundColor: "rgba(211, 21, 22, 0.14)", borderColor: theme.colors.borderStrong },
            ]}
          >
            <Text style={[styles.secondaryText, { color: theme.colors.text }]}>Remove</Text>
          </PressOpacity>
        </View>
      ) : null}
    </View>
  );
}

function NumberField({
  label,
  minimum,
  onChange,
  presets,
  step,
  value,
  valueLabel,
}: {
  label: string;
  minimum: number;
  onChange: (value: number) => void;
  presets: { label: string; value: number }[];
  step: number;
  value: number;
  valueLabel: string;
}) {
  const { theme } = useAppTheme();
  function change(next: number, cue: boolean) {
    const clamped = Math.max(minimum, next);
    if (clamped === value) {
      return;
    }
    if (cue) {
      feedbackStep(clamped > value ? "up" : "down");
    }
    onChange(clamped);
  }
  return (
    <View style={styles.field}>
      <Text style={[styles.kicker, { color: theme.colors.textMuted }]}>{label.toUpperCase()}</Text>
      <View style={styles.stepper}>
        <PressOpacity
          accessibilityLabel={`Decrease ${label}`}
          onPress={() => change(value - step, true)}
          silent
          style={[
            styles.stepButton,
            { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.borderStrong },
          ]}
        >
          <Text style={[styles.stepText, { color: theme.colors.text }]}>-</Text>
        </PressOpacity>
        <Text style={[styles.stepValue, { color: theme.colors.text }]}>{valueLabel}</Text>
        <PressOpacity
          accessibilityLabel={`Increase ${label}`}
          onPress={() => change(value + step, true)}
          silent
          style={[
            styles.stepButton,
            { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.borderStrong },
          ]}
        >
          <Text style={[styles.stepText, { color: theme.colors.text }]}>+</Text>
        </PressOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.presetRow}>
          {presets.map((preset) => (
            <Chip
              key={preset.label}
              label={preset.label}
              onPress={() => change(preset.value, false)}
              selected={value === preset.value}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function Chip({
  label,
  onPress,
  selected = false,
}: {
  label: string;
  onPress: () => void;
  selected?: boolean;
}) {
  const { theme } = useAppTheme();
  const selectedText = readableTextColor(theme.colors.tertiary);
  return (
    <PressOpacity
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? theme.colors.tertiary : theme.colors.surfaceMuted,
          borderColor: selected ? theme.colors.tertiary : theme.colors.borderStrong,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: selected ? selectedText : theme.colors.text }]}>
        {label}
      </Text>
    </PressOpacity>
  );
}

function formatClock(date: Date) {
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatDay(date: Date) {
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    weekday: "short",
  });
}

function daysFromToday(endedAt: number) {
  const end = new Date(endedAt);
  const today = new Date();
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((todayDay - endDay) / 86_400_000);
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  scroller: { flex: 1 },
  content: { gap: tokens.spacing.md, padding: tokens.spacing.md, paddingBottom: tokens.spacing.lg },
  card: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    gap: tokens.spacing.md,
    padding: tokens.spacing.lg,
  },
  kicker: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  body: { fontSize: 16, fontWeight: "700" },
  hint: { fontSize: 13, lineHeight: 18 },
  metric: { fontSize: 22, fontVariant: ["tabular-nums"], fontWeight: "800" },
  dateReadout: { fontSize: 18, fontVariant: ["tabular-nums"], fontWeight: "800" },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    fontWeight: "700",
    minHeight: 52,
    paddingHorizontal: tokens.spacing.md,
  },
  presetRow: { flexDirection: "row", gap: tokens.spacing.sm },
  secondary: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: tokens.spacing.md,
  },
  secondaryText: { fontSize: 15, fontWeight: "700" },
  summaryHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  focusBadge: { alignItems: "center", flexDirection: "row", gap: tokens.spacing.sm },
  swatch: { borderRadius: 6, height: 12, width: 12 },
  badgeText: { fontSize: 13, fontWeight: "700" },
  activityHeader: { alignItems: "center", flexDirection: "row", gap: tokens.spacing.sm },
  activityTitle: { flex: 1, justifyContent: "center", minHeight: 48 },
  iconButton: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    minWidth: 48,
  },
  editor: { gap: tokens.spacing.md },
  field: { gap: tokens.spacing.sm },
  stepper: { alignItems: "center", flexDirection: "row", gap: tokens.spacing.sm },
  stepButton: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    minWidth: 48,
  },
  stepText: { fontSize: 22, fontWeight: "700" },
  stepValue: {
    flex: 1,
    fontSize: 20,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
    textAlign: "center",
  },
  chip: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: tokens.spacing.md,
  },
  chipText: { fontSize: 14, fontWeight: "700" },
  error: { fontSize: 14, fontWeight: "700", paddingHorizontal: tokens.spacing.md },
  footer: {
    borderTopWidth: 1,
    flexDirection: "row",
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
  },
  footerButton: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: tokens.spacing.sm,
  },
  logButton: {
    alignItems: "center",
    borderRadius: 12,
    flex: 1.15,
    justifyContent: "center",
    minHeight: 52,
  },
  primaryText: { fontSize: 16, fontWeight: "700" },
});
