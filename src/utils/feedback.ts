import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

type CueKind =
  | "selection"
  | "stepUp"
  | "stepDown"
  | "toggleOn"
  | "toggleOff"
  | "confirm"
  | "countdown"
  | "phaseStart"
  | "warning";

type SensoryPreferences = {
  audioCuesEnabled: boolean;
  hapticsEnabled: boolean;
};

let preferences: SensoryPreferences = {
  audioCuesEnabled: true,
  hapticsEnabled: true,
};

export function setSensoryPreferences(next: Partial<SensoryPreferences>) {
  preferences = { ...preferences, ...next };
}

const SAMPLE_RATE = 22050;

const CUE_SPECS: Record<
  CueKind,
  { freqHz: number; secondFreqHz?: number; durationMs: number; gain: number }
> = {
  selection: { durationMs: 28, freqHz: 920, gain: 0.18 },
  stepUp: { durationMs: 36, freqHz: 1120, gain: 0.22 },
  stepDown: { durationMs: 36, freqHz: 780, gain: 0.22 },
  toggleOn: { durationMs: 55, freqHz: 840, gain: 0.22, secondFreqHz: 1180 },
  toggleOff: { durationMs: 55, freqHz: 1080, gain: 0.2, secondFreqHz: 740 },
  confirm: { durationMs: 110, freqHz: 784, gain: 0.28, secondFreqHz: 1175 },
  countdown: { durationMs: 85, freqHz: 660, gain: 0.34 },
  phaseStart: { durationMs: 190, freqHz: 1046, gain: 0.42, secondFreqHz: 1568 },
  warning: { durationMs: 130, freqHz: 370, gain: 0.3, secondFreqHz: 294 },
};

const wavUriCache = new Map<CueKind, string>();
const playerCache = new Map<CueKind, AudioPlayer>();

function buildWavDataUri(kind: CueKind): string {
  const cached = wavUriCache.get(kind);
  if (cached) {
    return cached;
  }

  const spec = CUE_SPECS[kind];
  const sampleCount = Math.max(1, Math.floor((SAMPLE_RATE * spec.durationMs) / 1000));
  const dataBytes = sampleCount * 2;
  const buffer = new Uint8Array(44 + dataBytes);
  const view = new DataView(buffer.buffer);

  writeAscii(buffer, 0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(buffer, 8, "WAVE");
  writeAscii(buffer, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(buffer, 36, "data");
  view.setUint32(40, dataBytes, true);

  let phase = 0;
  const splitIndex = Math.floor(sampleCount * 0.48);
  const attackSamples = Math.max(1, Math.floor(sampleCount * 0.08));

  for (let index = 0; index < sampleCount; index += 1) {
    const progress = index / sampleCount;
    const attack = Math.min(1, index / attackSamples);
    const release = Math.pow(1 - progress, 1.35);
    const envelope = attack * release;
    const freq =
      spec.secondFreqHz && index >= splitIndex ? spec.secondFreqHz : spec.freqHz;
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    const sample = Math.sin(phase) * spec.gain * envelope;
    const pcm = Math.max(-32767, Math.min(32767, Math.round(sample * 32767)));
    view.setInt16(44 + index * 2, pcm, true);
  }

  const uri = `data:audio/wav;base64,${encodeBase64(buffer)}`;
  wavUriCache.set(kind, uri);
  return uri;
}

function writeAscii(target: Uint8Array, offset: number, text: string) {
  for (let index = 0; index < text.length; index += 1) {
    target[offset + index] = text.charCodeAt(index);
  }
}

const BASE64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function encodeBase64(bytes: Uint8Array): string {
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const b0 = bytes[index] ?? 0;
    const b1 = bytes[index + 1] ?? 0;
    const b2 = bytes[index + 2] ?? 0;
    const triplet = (b0 << 16) | (b1 << 8) | b2;
    output += BASE64_CHARS[(triplet >> 18) & 0x3f];
    output += BASE64_CHARS[(triplet >> 12) & 0x3f];
    output += index + 1 < bytes.length ? BASE64_CHARS[(triplet >> 6) & 0x3f] : "=";
    output += index + 2 < bytes.length ? BASE64_CHARS[triplet & 0x3f] : "=";
  }
  return output;
}

let audioModeReady: Promise<void> | undefined;

async function playAudioCue(kind: CueKind) {
  if (!preferences.audioCuesEnabled) {
    return;
  }

  try {
    // Configure before creating/playing any cue: Android's unconfigured mode
    // requests transient audio focus, which can interrupt another app's music.
    audioModeReady ??= setAudioModeAsync({ interruptionMode: "mixWithOthers" })
      .catch((error: unknown) => {
        audioModeReady = undefined;
        throw error;
      });
    await audioModeReady;
    if (!preferences.audioCuesEnabled) {
      return;
    }
    let player = playerCache.get(kind);
    if (!player) {
      player = createAudioPlayer({ uri: buildWavDataUri(kind) });
      playerCache.set(kind, player);
    }
    void player.seekTo(0).catch(() => undefined);
    player.play();
  } catch {
    // Ignore audio device errors on unsupported environments
  }
}

export function feedbackSelection() {
  playAudioCue("selection");
  if (!preferences.hapticsEnabled) {
    return;
  }
  void Haptics.selectionAsync().catch(() => undefined);
}

export function feedbackStep(direction: "up" | "down" = "up") {
  playAudioCue(direction === "up" ? "stepUp" : "stepDown");
  if (!preferences.hapticsEnabled) {
    return;
  }
  if (Platform.OS === "android") {
    void Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Clock_Tick).catch(
      () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
    );
    return;
  }
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

export function feedbackToggle(enabled: boolean) {
  playAudioCue(enabled ? "toggleOn" : "toggleOff");
  if (!preferences.hapticsEnabled) {
    return;
  }
  void Haptics.impactAsync(
    enabled ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
  ).catch(() => undefined);
}

export function feedbackConfirm() {
  playAudioCue("confirm");
  if (!preferences.hapticsEnabled) {
    return;
  }
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
    () => undefined,
  );
}

export function feedbackCountdownTick() {
  playAudioCue("countdown");
  if (!preferences.hapticsEnabled) {
    return;
  }
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => undefined);
}

export function feedbackPhaseCue() {
  playAudioCue("phaseStart");
  if (!preferences.hapticsEnabled) {
    return;
  }
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
    () => undefined,
  );
}

export function feedbackWarn() {
  playAudioCue("warning");
  if (!preferences.hapticsEnabled) {
    return;
  }
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
    () => undefined,
  );
}
