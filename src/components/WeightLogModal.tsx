import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import type { TimelineEntry } from "../data/timelineRepository";
import { useAppState } from "../state/AppStateContext";
import { useAppTheme } from "../theme/ThemeContext";
import { appColorPalette, readableTextColor, themes } from "../theme/theme";
import { feedbackConfirm, feedbackStep, feedbackWarn } from "../utils/feedback";
import {
  convertKilogramsToWeight,
  convertWeightToKilograms,
} from "../utils/weight";
import { LogTimeChanger } from "./LogTimeChanger";
import { PressOpacity } from "./PressOpacity";

const tokens = themes.dark;
const METRIC_PRESETS = [55, 60, 65, 70, 75, 80, 85, 90, 95] as const;
const IMPERIAL_PRESETS = [125, 135, 145, 155, 170, 185, 205, 225] as const;

type WeightLogModalProps = {
  entryToEdit?: TimelineEntry;
  onClose: () => void;
  onDeleted?: () => Promise<void> | void;
  onSaved?: (loggedAt: number) => Promise<void> | void;
  visible: boolean;
};

export function WeightLogModal({
  entryToEdit,
  onClose,
  onDeleted,
  onSaved,
  visible,
}: WeightLogModalProps) {
  const { theme } = useAppTheme();
  const {
    athleteProfile,
    deleteWeightLog,
    logWeight,
    unitSettings,
    updateWeightLog,
  } = useAppState();
  const [draftWeight, setDraftWeight] = useState<number>(70);
  const [draftLoggedAt, setDraftLoggedAt] = useState(() => new Date());

  useEffect(() => {
    if (!visible) {
      return;
    }

    if (entryToEdit?.kind === "weight" && entryToEdit.weightKg !== null) {
      setDraftWeight(
        Math.round(
          convertKilogramsToWeight(
            entryToEdit.weightKg,
            unitSettings.weight,
          ) * 10,
        ) / 10,
      );
      setDraftLoggedAt(new Date(entryToEdit.startAt));
      return;
    }

    const baseKg = athleteProfile.weightKg ?? 70;
    setDraftWeight(
      Math.round(convertKilogramsToWeight(baseKg, unitSettings.weight) * 10) / 10,
    );
    setDraftLoggedAt(new Date());
  }, [athleteProfile.weightKg, entryToEdit, unitSettings.weight, visible]);

  if (!visible) {
    return null;
  }

  const unitLabel = unitSettings.weight === "metric" ? "kg" : "lbs";
  const presets =
    unitSettings.weight === "metric" ? METRIC_PRESETS : IMPERIAL_PRESETS;
  const primaryText = readableTextColor(theme.colors.tertiary);

  function stepWeight(delta: number) {
    feedbackStep(delta > 0 ? "up" : "down");
    setDraftWeight((current) =>
      Math.min(450, Math.max(25, Math.round((current + delta) * 10) / 10)),
    );
  }

  async function saveWeight() {
    const loggedAt = Math.min(draftLoggedAt.getTime(), Date.now());
    if (!Number.isFinite(draftWeight) || draftWeight <= 0) {
      return;
    }

    let weightKg = convertWeightToKilograms(draftWeight, unitSettings.weight);

    try {
      if (entryToEdit?.kind === "weight" && entryToEdit.weightKg !== null) {
        const originalDisplayedWeight =
          Math.round(
            convertKilogramsToWeight(
              entryToEdit.weightKg,
              unitSettings.weight,
            ) * 10,
          ) / 10;

        if (Math.abs(draftWeight - originalDisplayedWeight) < 0.01) {
          weightKg = entryToEdit.weightKg;
        }

        await updateWeightLog(entryToEdit.id, weightKg, loggedAt);
      } else {
        await logWeight(weightKg, loggedAt);
      }

      feedbackConfirm();
      await onSaved?.(loggedAt);
      onClose();
    } catch {
      Alert.alert("Couldn't save weight log", "Please try again.");
    }
  }

  async function deleteExistingWeightLog() {
    if (entryToEdit?.kind !== "weight" || entryToEdit.weightKg === null) {
      return;
    }

    try {
      await deleteWeightLog(entryToEdit.id);
      feedbackWarn();
      await onDeleted?.();
      onClose();
    } catch {
      Alert.alert("Couldn't delete weight log", "Please try again.");
    }
  }

  function confirmDeleteWeightLog() {
    feedbackWarn();
    Alert.alert("Delete weight log?", "This cannot be undone.", [
      {
        style: "cancel",
        text: "Cancel",
      },
      {
        onPress: () => {
          void deleteExistingWeightLog();
        },
        style: "destructive",
        text: "Delete",
      },
    ]);
  }

  const editingExistingWeight =
    entryToEdit?.kind === "weight" && entryToEdit.weightKg !== null;

  return (
    <View
      style={[
        styles.inlineCard,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.tertiary,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.titleRow}>
          <Ionicons color={theme.colors.tertiary} name="scale-outline" size={18} />
          <Text style={[styles.cardHeaderLabel, { color: theme.colors.text }]}>
            {editingExistingWeight ? "EDIT WEIGHT LOG" : "LOG BODYWEIGHT"}
          </Text>
        </View>
        <PressOpacity
          accessibilityLabel="Close weight logger"
          onPress={onClose}
          style={[
            styles.closeButton,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Ionicons color={theme.colors.text} name="close" size={18} />
        </PressOpacity>
      </View>

      <View style={styles.stepperRow}>
        <PressOpacity
          accessibilityLabel={`Decrease weight by 1 ${unitLabel}`}
          onPress={() => stepWeight(-1)}
          silent
          style={[
            styles.stepButton,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        >
          <Text style={[styles.stepText, { color: theme.colors.text }]}>-1.0</Text>
        </PressOpacity>
        <PressOpacity
          accessibilityLabel={`Decrease weight by 0.1 ${unitLabel}`}
          onPress={() => stepWeight(-0.1)}
          silent
          style={[
            styles.stepButton,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        >
          <Text style={[styles.stepText, { color: theme.colors.text }]}>-0.1</Text>
        </PressOpacity>

        <View
          style={[
            styles.readoutBox,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        >
          <Text style={[styles.readoutValue, { color: theme.colors.text }]}>
            {draftWeight.toFixed(1)}
          </Text>
          <Text style={[styles.readoutUnit, { color: theme.colors.textMuted }]}>
            {unitLabel.toUpperCase()}
          </Text>
        </View>

        <PressOpacity
          accessibilityLabel={`Increase weight by 0.1 ${unitLabel}`}
          onPress={() => stepWeight(0.1)}
          silent
          style={[
            styles.stepButton,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        >
          <Text style={[styles.stepText, { color: theme.colors.text }]}>+0.1</Text>
        </PressOpacity>
        <PressOpacity
          accessibilityLabel={`Increase weight by 1 ${unitLabel}`}
          onPress={() => stepWeight(1)}
          silent
          style={[
            styles.stepButton,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        >
          <Text style={[styles.stepText, { color: theme.colors.text }]}>+1.0</Text>
        </PressOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.presetStrip}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {presets.map((preset) => {
          const selected = Math.abs(draftWeight - preset) < 0.05;
          return (
            <PressOpacity
              accessibilityLabel={`Set weight ${preset} ${unitLabel}`}
              key={preset}
              onPress={() => {
                feedbackStep("up");
                setDraftWeight(preset);
              }}
              silent
              style={[
                styles.presetChip,
                {
                  backgroundColor: selected
                    ? theme.colors.tertiary
                    : theme.colors.surfaceMuted,
                  borderColor: selected
                    ? theme.colors.tertiary
                    : theme.colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.presetChipText,
                  { color: selected ? primaryText : theme.colors.text },
                ]}
              >
                {preset} {unitLabel}
              </Text>
            </PressOpacity>
          );
        })}
      </ScrollView>

      <LogTimeChanger
        label="Weigh-in time"
        maximumDate={new Date()}
        onChange={setDraftLoggedAt}
        value={draftLoggedAt}
      />

      <View style={styles.actionsRow}>
        {editingExistingWeight ? (
          <PressOpacity
            accessibilityLabel="Delete weight log"
            onPress={confirmDeleteWeightLog}
            silent
            style={[
              styles.deleteButton,
              {
                backgroundColor: "rgba(225, 29, 36, 0.14)",
                borderColor: appColorPalette.red,
              },
            ]}
          >
            <Ionicons color={appColorPalette.red} name="trash-outline" size={18} />
            <Text style={[styles.deleteText, { color: appColorPalette.red }]}>
              Delete
            </Text>
          </PressOpacity>
        ) : (
          <PressOpacity
            accessibilityLabel="Cancel weight log"
            onPress={onClose}
            style={[
              styles.cancelButton,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.borderStrong,
              },
            ]}
          >
            <Text style={[styles.cancelText, { color: theme.colors.text }]}>
              Cancel
            </Text>
          </PressOpacity>
        )}

        <PressOpacity
          accessibilityLabel="Save weight log"
          onPress={() => void saveWeight()}
          silent
          style={[
            styles.saveButton,
            { backgroundColor: theme.colors.tertiary },
          ]}
        >
          <Ionicons color={primaryText} name="checkmark-circle" size={20} />
          <Text style={[styles.saveText, { color: primaryText }]}>
            Save {draftWeight.toFixed(1)} {unitLabel}
          </Text>
        </PressOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inlineCard: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1.5,
    gap: tokens.spacing.md,
    padding: tokens.spacing.lg,
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.sm,
  },
  cardHeaderLabel: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  closeButton: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  stepperRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.xs,
  },
  stepButton: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 52,
    minWidth: 50,
    paddingHorizontal: 6,
  },
  stepText: {
    fontSize: 13,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  readoutBox: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 52,
  },
  readoutValue: {
    fontSize: 22,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
    lineHeight: 26,
  },
  readoutUnit: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  presetStrip: {
    gap: tokens.spacing.xs,
  },
  presetChip: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: tokens.spacing.md,
  },
  presetChipText: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  actionsRow: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
  },
  deleteButton: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: tokens.spacing.md,
  },
  deleteText: {
    fontSize: 14,
    fontWeight: "800",
  },
  cancelButton: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: tokens.spacing.lg,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "800",
  },
  saveButton: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    flex: 1,
    flexDirection: "row",
    gap: tokens.spacing.xs,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: tokens.spacing.md,
  },
  saveText: {
    fontSize: 15,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
});
