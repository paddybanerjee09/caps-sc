import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { PressOpacity } from "../components/PressOpacity";
import { Screen } from "../components/Screen";
import { useAppState } from "../state/AppStateContext";
import { useAppTheme } from "../theme/ThemeContext";
import { readableTextColor, themes } from "../theme/theme";
import { feedbackConfirm, feedbackStep } from "../utils/feedback";

const tokens = themes.dark;

const CALLSIGN_PRESETS = [
  "Paddy",
  "Striker",
  "Grappler",
  "NakMuay",
  "Wrestler",
  "Boxer",
  "MMA_Pro",
  "Judoka",
] as const;

const SUFFIX_STEPS = ["_01", "_99", "_HQ", "_SC", "_PRO"] as const;

export function AccountInfoScreen({ onClose, registerCloseHandler }: {
  onClose?: () => void;
  registerCloseHandler?: (handler: (() => void) | null) => void;
} = {}) {
  const { username, setUsername } = useAppState();
  const { theme } = useAppTheme();
  const [draftUsername, setDraftUsername] = useState(username);
  const [savedBanner, setSavedBanner] = useState(false);

  const trimmedDraft = draftUsername.trim();
  const hasChanges = trimmedDraft !== username;
  const primaryTextColor = readableTextColor(theme.colors.tertiary);

  function selectPreset(preset: string) {
    feedbackStep("up");
    setDraftUsername(preset.slice(0, 15));
    setSavedBanner(false);
  }

  function appendSuffix(suffix: string) {
    feedbackStep("up");
    const base = (draftUsername.trim() || "Athlete").replace(/_(01|99|HQ|SC|PRO)$/i, "");
    const combined = `${base}${suffix}`.slice(0, 15);
    setDraftUsername(combined);
    setSavedBanner(false);
  }

  function saveUsername() {
    setUsername(trimmedDraft);
    setSavedBanner(true);
    feedbackConfirm();
  }

  function resetDraft() {
    feedbackStep("down");
    setDraftUsername(username);
    setSavedBanner(false);
  }

  const requestClose = useCallback(() => {
    if (!onClose) return;
    if (hasChanges) {
      Alert.alert("Discard username changes?", "Your unsaved username will be discarded.", [
        { text: "Keep editing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: onClose },
      ]);
    } else {
      onClose();
    }
  }, [hasChanges, onClose]);

  useEffect(() => {
    registerCloseHandler?.(requestClose);
    return () => registerCloseHandler?.(null);
  }, [registerCloseHandler, requestClose]);

  return (
    <Screen
      onClose={onClose ? requestClose : undefined}
      footer={
        <>
          <PressOpacity
            accessibilityLabel="Reset username changes"
            disabled={!hasChanges}
            onPress={resetDraft}
            silent
            style={[
              styles.secondaryFlowButton,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.borderStrong,
              },
            ]}
          >
            <Text style={[styles.secondaryFlowText, { color: theme.colors.text }]}>
              Reset
            </Text>
          </PressOpacity>

          <PressOpacity
            accessibilityLabel="Save username"
            disabled={!hasChanges}
            onPress={saveUsername}
            silent
            style={[
              styles.primaryFlowButton,
              { backgroundColor: theme.colors.tertiary },
            ]}
          >
            <Ionicons color={primaryTextColor} name="checkmark-circle" size={20} />
            <Text style={[styles.primaryFlowText, { color: primaryTextColor }]}>
              {savedBanner && !hasChanges ? "Saved" : "Save Username"}
            </Text>
          </PressOpacity>
        </>
      }
      subtitle="Athlete callsign and local profile identity"
      title="Account Information"
    >
      {/* Card 1: Active Identity Telemetry */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.borderStrong,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.cardHeaderLabel, { color: theme.colors.textMuted }]}>
            ACTIVE ACCOUNT TELEMETRY
          </Text>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.badgeText, { color: theme.colors.tertiary }]}>
              LOCAL DEVICE
            </Text>
          </View>
        </View>

        <View style={styles.identityRow}>
          <View
            style={[
              styles.avatarCircle,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.tertiary,
              },
            ]}
          >
            <Ionicons
              color={theme.colors.tertiary}
              name="person"
              size={28}
            />
          </View>
          <View style={styles.identityCopy}>
            <Text style={[styles.identityCaption, { color: theme.colors.textMuted }]}>
              CURRENT HANDLE
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.identityValue, { color: theme.colors.text }]}
            >
              {username || "Not selected"}
            </Text>
          </View>
          <View
            style={[
              styles.charStatBox,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.charStatValue, { color: theme.colors.text }]}>
              {username.length}/15
            </Text>
            <Text style={[styles.charStatLabel, { color: theme.colors.textMuted }]}>
              CHARS
            </Text>
          </View>
        </View>
      </View>

      {/* Card 2: Callsign Quick-Select & Inline Editor (No Modal) */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.borderStrong,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.cardHeaderLabel, { color: theme.colors.textMuted }]}>
            USERNAME & CALLSIGN
          </Text>
          <Text style={[styles.counterText, { color: theme.colors.textMuted }]}>
            {draftUsername.length} / 15
          </Text>
        </View>

        <Text style={[styles.subLabel, { color: theme.colors.textMuted }]}>
          QUICK CALLSIGN PRESETS (SWIPE)
        </Text>
        <ScrollView
          contentContainerStyle={styles.chipStrip}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {CALLSIGN_PRESETS.map((preset) => {
            const selected = draftUsername === preset;
            return (
              <PressOpacity
                accessibilityLabel={`Select username ${preset}`}
                accessibilityState={{ selected }}
                key={preset}
                onPress={() => selectPreset(preset)}
                silent
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected
                      ? theme.colors.tertiary
                      : theme.colors.surfaceMuted,
                    borderColor: selected
                      ? theme.colors.tertiary
                      : theme.colors.borderStrong,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: selected ? primaryTextColor : theme.colors.text,
                    },
                  ]}
                >
                  {preset}
                </Text>
              </PressOpacity>
            );
          })}
        </ScrollView>

        <Text style={[styles.subLabel, { color: theme.colors.textMuted }]}>
          TAG MODIFIERS
        </Text>
        <ScrollView
          contentContainerStyle={styles.chipStrip}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {SUFFIX_STEPS.map((suffix) => (
            <PressOpacity
              accessibilityLabel={`Append ${suffix}`}
              key={suffix}
              onPress={() => appendSuffix(suffix)}
              silent
              style={[
                styles.chip,
                {
                  backgroundColor: theme.colors.surfaceMuted,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: theme.colors.text }]}>
                +{suffix}
              </Text>
            </PressOpacity>
          ))}
        </ScrollView>

        <Text style={[styles.subLabel, { color: theme.colors.textMuted }]}>
          CUSTOM HANDLE (OPTIONAL TYPING)
        </Text>
        <View style={styles.inputRow}>
          <TextInput
            accessibilityLabel="Username"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={15}
            onChangeText={(text) => {
              setDraftUsername(text);
              setSavedBanner(false);
            }}
            placeholder="Enter username"
            placeholderTextColor={theme.colors.textMuted}
            selectionColor={theme.colors.tertiary}
            style={[
              styles.usernameInput,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.borderStrong,
                color: theme.colors.text,
              },
            ]}
            value={draftUsername}
          />
          {draftUsername.length > 0 ? (
            <PressOpacity
              accessibilityLabel="Clear username"
              onPress={() => {
                feedbackStep("down");
                setDraftUsername("");
                setSavedBanner(false);
              }}
              silent
              style={[
                styles.clearButton,
                {
                  backgroundColor: theme.colors.surfaceMuted,
                  borderColor: theme.colors.borderStrong,
                },
              ]}
            >
              <Ionicons color={theme.colors.text} name="backspace-outline" size={20} />
            </PressOpacity>
          ) : null}
        </View>


      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    gap: tokens.spacing.md,
    padding: tokens.spacing.lg,
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cardHeaderLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  badge: {
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  identityRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.md,
  },
  avatarCircle: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: 2,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  identityCopy: {
    flex: 1,
    gap: 2,
  },
  identityCaption: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  identityValue: {
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 28,
  },
  charStatBox: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 52,
    minWidth: 68,
    paddingHorizontal: tokens.spacing.sm,
  },
  charStatValue: {
    fontSize: 14,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  charStatLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  counterText: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  subLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  chipStrip: {
    gap: tokens.spacing.sm,
  },
  chip: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: tokens.spacing.md,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "800",
  },
  inputRow: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
  },
  usernameInput: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    flex: 1,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "700",
    minHeight: 48,
    paddingHorizontal: tokens.spacing.md,
  },
  clearButton: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  flowButtons: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.xs,
  },
  secondaryFlowButton: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 52,
    minWidth: 90,
    paddingHorizontal: tokens.spacing.lg,
  },
  secondaryFlowText: {
    fontSize: 14,
    fontWeight: "800",
  },
  primaryFlowButton: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    flex: 1,
    flexDirection: "row",
    gap: tokens.spacing.xs,
    justifyContent: "center",
    minHeight: 52,
    minWidth: 150,
    paddingHorizontal: tokens.spacing.lg,
  },
  primaryFlowText: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
});
