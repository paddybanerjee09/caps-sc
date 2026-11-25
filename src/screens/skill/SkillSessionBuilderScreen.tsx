import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";

import { ActionButton } from "../../components/ActionButton";
import { WorkflowHeader, WorkflowFooter } from "../../components/WorkflowChrome";
import { LogTimeChanger } from "../../components/LogTimeChanger";
import { createId } from "../../conditioning/ids";
import { deviceTimeZone } from "../../conditioning/dates";
import { archiveSkillTemplate, logSkillSession, saveSkillTemplate } from "../../data/skillRepository";
import { removeActivity, templateButtonLabel } from "../../skill/drafts";
import { activitySettingsLine, formatElapsed } from "../../skill/present";
import { elapsedSeconds } from "../../skill/timing";
import { validateSkillDraft } from "../../skill/validation";
import { useAppState } from "../../state/AppStateContext";
import { useSkillWorkspace } from "../../state/SkillWorkspaceContext";
import { useAppTheme } from "../../theme/ThemeContext";
import { themes } from "../../theme/theme";
import { feedbackConfirm, feedbackWarn } from "../../utils/feedback";

const tokens = themes.dark;

export function SkillSessionBuilderScreen() {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const { bumpTimeline } = useAppState();
  const workspace = useSkillWorkspace();
  const { draft, saving } = workspace;
  const [error, setError] = useState<string | null>(null);
  const mutationPending = useRef(false);

  useEffect(() => {
    if (workspace.stack.at(-1)?.name !== "builder") return;
    workspace.registerBackHandler(() => { workspace.closeBranch(); return true; });
    return () => workspace.registerBackHandler(null);
  }, [workspace]);

  if (!draft) return null;
  const label = templateButtonLabel(draft, workspace.templateBaseline);

  async function toggleSaved() {
    if (!draft || mutationPending.current || workspace.saving) return;
    mutationPending.current = true;
    workspace.setSaving(true);
    setError(null);
    try {
      if (label === "Saved" && draft.sourceTemplateId) {
        await archiveSkillTemplate(db, draft.sourceTemplateId);
        workspace.markTemplateUnsaved({ ...draft, sourceTemplateId: null, templateLink: "detached" });
      } else {
        const id = await saveSkillTemplate(db, draft);
        workspace.markTemplateSaved({ ...draft, sourceTemplateId: id, templateLink: "linked" });
      }
      workspace.bumpRevision();
      feedbackConfirm();
    } catch (cause) {
      feedbackWarn();
      setError(cause instanceof Error ? cause.message : "Couldn’t save. Try again.");
    } finally {
      mutationPending.current = false;
      workspace.setSaving(false);
    }
  }

  async function log() {
    if (!draft || mutationPending.current || workspace.saving) return;
    const now = Date.now();
    const validation = validateSkillDraft(draft, "log", now, deviceTimeZone());
    if (validation) { feedbackWarn(); setError(validation); return; }
    mutationPending.current = true;
    workspace.setSaving(true);
    setError(null);
    try {
      const result = await logSkillSession(db, draft, { now });
      bumpTimeline();
      feedbackConfirm();
      workspace.setSaving(false);
      workspace.completeLog(result.localEndDate);
    } catch (cause) {
      feedbackWarn();
      setError(cause instanceof Error ? cause.message : "Couldn’t log. Try again.");
    } finally {
      mutationPending.current = false;
      workspace.setSaving(false);
    }
  }

  return (
    <View style={[styles.page, { backgroundColor: theme.colors.background }]}>
      <WorkflowHeader title="Log Session" onClose={workspace.closeBranch} right={<View pointerEvents={saving ? "none" : "auto"}><LogTimeChanger maximumDate={new Date()} onChange={(date) => { if (!saving) workspace.updateDraft({ ...draft, endedAt: date.getTime() }); }} value={new Date(draft.endedAt)} /></View>} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" style={styles.scroller}>
        <View style={styles.titleBlock}>
          <TextInput accessibilityLabel="Session title" editable={!saving} maxLength={80} onChangeText={(title) => { setError(null); workspace.updateDraft({ ...draft, title }); }} placeholder="Session title" placeholderTextColor={theme.colors.textMuted} style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong, color: theme.colors.text }]} value={draft.title} />
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>Estimated time · {formatElapsed(elapsedSeconds(draft.activities))}</Text>
        </View>
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text accessibilityRole="header" style={[styles.kicker, { color: theme.colors.textMuted }]}>ACTIVITIES</Text>
          <ActionButton disabled={saving || draft.activities.length >= 24} label="Add Activities" onPress={() => { workspace.setSearchQuery(""); workspace.push({ key: createId(), name: "picker" }); }} tone="secondary" />
          {draft.activities.length === 0 ? <Text style={{ color: theme.colors.textMuted }}>No activities.</Text> : draft.activities.map((activity) => (
            <View key={activity.id} style={[styles.activity, { borderColor: theme.colors.border }]}>
              <Text style={[styles.name, { color: theme.colors.text }]}>{activity.name}</Text>
              <Text style={[styles.settings, { color: theme.colors.textMuted }]}>{activitySettingsLine(activity)}</Text>
              <View style={styles.row}>
                <ActionButton disabled={saving} label="Edit" onPress={() => workspace.push({ key: createId(), name: "editor", activityId: activity.id, baseline: JSON.stringify(draft), fresh: false })} tone="secondary" style={styles.action} />
                <ActionButton disabled={saving} label="Remove" onPress={() => workspace.requestConfirm({ confirmLabel: "Remove", title: "Remove activity?", message: activity.name + " will leave this session.", onConfirm: () => workspace.updateDraft(removeActivity(draft, activity.id)) })} tone="quiet" style={styles.action} />
              </View>
            </View>
          ))}
        </View>
        {error ? <Text accessibilityRole="alert" selectable style={{ color: theme.colors.tertiary }}>{error}</Text> : null}
      </ScrollView>
      <WorkflowFooter disabled={saving} onBack={workspace.closeBranch}>
        <ActionButton disabled={saving} label={label === "Saved" ? "Unsave" : "Save"} onPress={() => { void toggleSaved(); }} tone="secondary" style={styles.action} />
        <ActionButton disabled={saving} label="Log" onPress={() => { void log(); }} style={styles.action} />
      </WorkflowFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  scroller: { flex: 1 },
  content: { padding: tokens.spacing.md, gap: tokens.spacing.md },
  titleBlock: { gap: 6 },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 16 },
  subtitle: { paddingHorizontal: 4, fontSize: 12, fontVariant: ["tabular-nums"] },
  card: { padding: tokens.spacing.lg, gap: tokens.spacing.md, borderWidth: 1, borderRadius: tokens.radius.lg },
  kicker: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  activity: { borderTopWidth: 1, paddingTop: 12, gap: 8 },
  name: { fontSize: 16, fontWeight: "700" },
  settings: { fontSize: 13, lineHeight: 19, fontVariant: ["tabular-nums"] },
  row: { flexDirection: "row", gap: 8 },
  action: { flex: 1, minWidth: 0 },
});
