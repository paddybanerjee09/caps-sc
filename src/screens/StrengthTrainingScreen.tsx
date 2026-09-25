import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { CreateStrengthSessionModal } from "../components/CreateStrengthSessionModal";
import { LogStrengthSessionConfirmationModal } from "../components/LogStrengthSessionConfirmationModal";
import {
  getMonthTimelineDateKey,
  MonthTimeline,
  type MonthTimelineEvent,
} from "../components/MonthTimeline";
import { SavedStrengthWorkoutsDropdown } from "../components/SavedStrengthWorkoutsDropdown";
import { Screen } from "../components/Screen";
import { SessionActionMenu } from "../components/SessionActionMenu";
import { StrengthMessage } from "../components/StrengthFormPrimitives";
import { StrengthSessionDetailModal } from "../components/StrengthSessionDetailModal";
import { strengthAdaptations } from "../constants/strength";
import {
  getStrengthSessionsForRange,
  listStrengthTemplates,
} from "../data/strengthRepository";
import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
import type {
  StoredStrengthTemplate,
  StrengthCalendarRecord,
} from "../types/strength";
import { getStrengthMonthPresentation } from "../utils/timelinePresentation";

export function StrengthTrainingScreen() {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12),
  );
  const [revision, setRevision] = useState(0);
  const [sessions, setSessions] = useState<StrengthCalendarRecord[]>([]);
  const [templates, setTemplates] = useState<StoredStrengthTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<
    StoredStrengthTemplate | undefined
  >();
  const [confirmTemplate, setConfirmTemplate] =
    useState<StoredStrengthTemplate | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [savedModalOpen, setSavedModalOpen] = useState(false);
  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    setRevision((n) => n + 1);
  }, []);
  const { dayStart } = useMemo(() => {
    const start = new Date(selectedDate);
    start.setHours(0, 0, 0, 0);
    return { dayStart: start };
  }, [selectedDate]);
  useEffect(() => {
    let active = true;
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    start.setDate(start.getDate() - start.getDay());
    const days = new Date(
      month.getFullYear(),
      month.getMonth() + 1,
      0,
    ).getDate();
    const weeks = Math.max(
      5,
      Math.ceil(
        (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + days) /
          7,
      ),
    );
    const end = new Date(start);
    end.setDate(end.getDate() + weeks * 7);
    void Promise.all([
      getStrengthSessionsForRange(db, start.getTime(), end.getTime()),
      listStrengthTemplates(db),
    ])
      .then(([nextSessions, nextTemplates]) => {
        if (active) {
          setSessions(nextSessions);
          setTemplates(nextTemplates);
        }
      })
      .catch(() => {
        if (active) setError("Couldn't load strength workouts and timelines.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [db, month, revision]);
  const events: MonthTimelineEvent[] = sessions.map((session) => {
    const presentation = getStrengthMonthPresentation(
      session.primaryAdaptation,
    );
    const adaptationLabel =
      strengthAdaptations[session.primaryAdaptation]?.label ??
      presentation.label;
    return {
      id: String(session.timelineEntryId),
      timelineEntryId: session.timelineEntryId,
      title: session.title,
      startAt: session.startAt,
      endAt: null,
      dateKey: getMonthTimelineDateKey(new Date(session.startAt)),
      activityIcon: "weight-lifter",
      activityLabel: "Strength",
      adaptationLabel,
      color: presentation.color,
      contentColor: presentation.contentColor,
      accessibilityLabel: `${session.title}, Strength, ${adaptationLabel}`,
    };
  });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const future = dayStart.getTime() > today.getTime();
  return (
    <Screen title="Strength Training" centerTitle>
      <View style={{ gap: themes.dark.spacing.md }}>
        <MonthTimeline
          displayedMonth={month}
          selectedDate={selectedDate}
          events={events}
          loading={loading}
          error={error}
          onRetry={refresh}
          sessionKindLabel="strength"
          emptyText="No strength sessions on this date"
          onSelectedDateChange={(value) => {
            setLoading(true);
            setError(null);
            setSelectedDate(value);
          }}
          onDisplayedMonthChange={(value) => {
            setLoading(true);
            setError(null);
            setMonth(value);
            if (
              selectedDate.getMonth() !== value.getMonth() ||
              selectedDate.getFullYear() !== value.getFullYear()
            )
              setSelectedDate(value);
          }}
          onEventPress={(event) => setDetailId(event.timelineEntryId)}
        />
        <SessionActionMenu
          items={[
            {
              key: "log-workout",
              label: "Log Workout",
              icon: (
                <MaterialCommunityIcons
                  color={theme.colors.tertiaryContent}
                  name="weight-lifter"
                  size={28}
                />
              ),
              primary: true,
              disabled: future,
              onPress: () => {
                setEditTemplate(undefined);
                setCreateOpen(true);
              },
            },
            {
              key: "saved-workouts",
              label: "Saved Workouts",
              icon: (
                <MaterialCommunityIcons
                  color={theme.colors.text}
                  name="bookmark-outline"
                  size={28}
                />
              ),
              onPress: () => setSavedModalOpen(true),
            },
          ]}
        />
        {future ? (
          <StrengthMessage>
            Completed sessions can only be logged for today or an earlier date.
          </StrengthMessage>
        ) : null}
      </View>
      <CreateStrengthSessionModal
        visible={createOpen}
        selectedDate={selectedDate}
        template={editTemplate}
        onClose={() => setCreateOpen(false)}
        onSaved={refresh}
        onLogged={refresh}
      />
      <LogStrengthSessionConfirmationModal
        template={confirmTemplate}
        selectedDate={selectedDate}
        onClose={() => setConfirmTemplate(null)}
        onLogged={refresh}
      />
      <StrengthSessionDetailModal
        timelineEntryId={detailId}
        onClose={() => setDetailId(null)}
      />
      <SavedStrengthWorkoutsDropdown
        disabled={future}
        error={error}
        loading={loading}
        onEdit={(template) => {
          setSavedModalOpen(false);
          setEditTemplate(template);
          setCreateOpen(true);
        }}
        onLog={(template) => {
          setSavedModalOpen(false);
          setConfirmTemplate(template);
        }}
        onRetry={refresh}
        templates={templates}
        visible={savedModalOpen}
      />
    </Screen>
  );
}
