import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { CreateStrengthSessionModal } from "../components/CreateStrengthSessionModal";
import { DayTimeline } from "../components/DayTimeline";
import { LogStrengthSessionConfirmationModal } from "../components/LogStrengthSessionConfirmationModal";
import { getMonthTimelineDateKey, MonthTimeline, type MonthTimelineEvent } from "../components/MonthTimeline";
import { SavedStrengthWorkoutsDropdown } from "../components/SavedStrengthWorkoutsDropdown";
import { Screen } from "../components/Screen";
import { StrengthButton, StrengthMessage } from "../components/StrengthFormPrimitives";
import { StrengthSessionDetailModal } from "../components/StrengthSessionDetailModal";
import { strengthAdaptations } from "../constants/strength";
import { getStrengthMonthPresentation } from "../utils/timelinePresentation";
import { getStrengthSessionsForRange, listStrengthTemplates } from "../data/strengthRepository";
import { getTimelineEntriesForDay, type TimelineDisplayEntry } from "../data/timelineRepository";
import { themes } from "../theme/theme";
import type { StrengthCalendarRecord, StoredStrengthTemplate } from "../types/strength";

export function StrengthTrainingScreen() {
  const db = useSQLiteContext();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12));
  const [revision, setRevision] = useState(0); const [sessions, setSessions] = useState<StrengthCalendarRecord[]>([]);
  const [entries, setEntries] = useState<TimelineDisplayEntry[]>([]); const [templates, setTemplates] = useState<StoredStrengthTemplate[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false); const [editTemplate, setEditTemplate] = useState<StoredStrengthTemplate | undefined>();
  const [confirmTemplate, setConfirmTemplate] = useState<StoredStrengthTemplate | null>(null); const [detailId, setDetailId] = useState<number | null>(null);
  const refresh = useCallback(() => { setLoading(true); setError(null); setRevision(n => n + 1); }, []);
  const { dayStart, dayEnd } = useMemo(() => {
    const start = new Date(selectedDate); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1); return { dayStart: start, dayEnd: end };
  }, [selectedDate]);
  useEffect(() => {
    let active = true;
    const start = new Date(month.getFullYear(), month.getMonth(), 1); start.setDate(start.getDate() - start.getDay());
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const weeks = Math.max(5, Math.ceil((new Date(month.getFullYear(), month.getMonth(), 1).getDay() + days) / 7));
    const end = new Date(start); end.setDate(end.getDate() + weeks * 7);
    void Promise.all([getStrengthSessionsForRange(db, start.getTime(), end.getTime()), getTimelineEntriesForDay(db, dayStart.getTime(), dayEnd.getTime()), listStrengthTemplates(db)])
      .then(([nextSessions, nextEntries, nextTemplates]) => { if (active) { setSessions(nextSessions); setEntries(nextEntries); setTemplates(nextTemplates); } })
      .catch(() => { if (active) setError("Couldn't load strength workouts and timelines."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [db, dayEnd, dayStart, month, revision]);
  const events: MonthTimelineEvent[] = sessions.map(session => {
    const presentation = getStrengthMonthPresentation(session.primaryAdaptation);
    const adaptationLabel = strengthAdaptations[session.primaryAdaptation]?.label ?? presentation.label;
    return {
      id: String(session.timelineEntryId), timelineEntryId: session.timelineEntryId, title: session.title,
      startAt: session.startAt, endAt: null, dateKey: getMonthTimelineDateKey(new Date(session.startAt)),
      activityIcon: "weight-lifter", activityLabel: "Strength", adaptationLabel,
      color: presentation.color, contentColor: presentation.contentColor,
      accessibilityLabel: `${session.title}, Strength, ${adaptationLabel}`,
    };
  });
  const today = new Date(); today.setHours(0, 0, 0, 0); const future = dayStart.getTime() > today.getTime();
  return <Screen title="Strength Training" centerTitle>
    <View style={{ gap: themes.dark.spacing.lg }}>
      <MonthTimeline displayedMonth={month} selectedDate={selectedDate} events={events} loading={loading} error={error} onRetry={refresh}
        sessionKindLabel="strength" emptyText="No strength sessions on this date" onSelectedDateChange={value => { setLoading(true); setError(null); setSelectedDate(value); }}
        onDisplayedMonthChange={value => { setLoading(true); setError(null); setMonth(value); if (selectedDate.getMonth() !== value.getMonth() || selectedDate.getFullYear() !== value.getFullYear()) setSelectedDate(value); }}
        onEventPress={event => setDetailId(event.timelineEntryId)} />
      <DayTimeline dayStart={dayStart} dayEnd={dayEnd} entries={entries} loading={loading} error={error} onRetry={refresh}
        isEntryPressable={entry => entry.kind === "strength"} onEntryPress={entry => { if (entry.kind === "strength") setDetailId(entry.id); }} />
      <StrengthButton label="Log Workout" primary disabled={future} onPress={() => { setEditTemplate(undefined); setCreateOpen(true); }} />
      {future ? <StrengthMessage>Completed sessions can only be logged for today or an earlier date.</StrengthMessage> : null}
      <SavedStrengthWorkoutsDropdown templates={templates} loading={loading} error={error} onRetry={refresh} disabled={future}
        onEdit={template => { setEditTemplate(template); setCreateOpen(true); }} onLog={setConfirmTemplate} />
    </View>
    <CreateStrengthSessionModal visible={createOpen} selectedDate={selectedDate} template={editTemplate} onClose={() => setCreateOpen(false)} onSaved={refresh} onLogged={refresh} />
    <LogStrengthSessionConfirmationModal template={confirmTemplate} selectedDate={selectedDate} onClose={() => setConfirmTemplate(null)} onLogged={refresh} />
    <StrengthSessionDetailModal timelineEntryId={detailId} onClose={() => setDetailId(null)} />
  </Screen>;
}
