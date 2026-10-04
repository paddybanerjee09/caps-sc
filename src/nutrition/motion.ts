import { Easing, ReduceMotion } from "react-native-reanimated";

export const SELECTOR_MOTION = {
  duration: 220,
  easing: Easing.out(Easing.cubic),
  reduceMotion: ReduceMotion.System,
} as const;

export const NUTRITION_TRANSITION_MS = 280;

export const NUTRITION_TRANSITION = {
  duration: NUTRITION_TRANSITION_MS,
  easing: Easing.out(Easing.cubic),
  reduceMotion: ReduceMotion.System,
} as const;
