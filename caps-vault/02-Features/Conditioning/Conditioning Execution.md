# Conditioning Execution

Status at `e492e06` · structured timer and free-session recording implemented. Locked-phone GPS and native rendering remain unverified. See [[Conditioning]] and [[Conditioning Records]].

## Structured runner

- `src/conditioning/phases.ts` expands interval, sprint, and circuit prescriptions to versioned snapshot phases. `src/conditioning/runner.ts` drives them using deadlines. Five seconds of preparation stays outside workout totals. Pause/resume preserves the current phase and remaining milliseconds. Timed reconciliation stops at non-timed work and emits at most the current cue. A changed process token in `WorkoutRunnerScreen` restores confirmed progress and flags the interruption as uncertain.
- `src/screens/conditioning/WorkoutRunnerScreen.tsx` persists runner state, reconciles when returning to foreground, and uses `expo-keep-awake` with screen lifetime plus feedback helpers from `src/utils/feedback.ts`. End Early preserves completed work and a partial occurrence, then opens review. Background per-second countdown cues are outside this implementation. Sources `6e7f23e`, `7e20d09`, `87e259b` and `.cursor/rules/conditioning-execution.mdc`.
- `88f746f` batches completed IDs and durations at the end of timed catch-up. The loop advances each phase at its stored deadline and review builds a set of completed IDs once. `npm run verify:conditioning` covers long catch-up, resumed state, and stopping at manual work.
- A sprint snapshot can contain `gps_distance`. The current runner shows prescribed distance with measured distance unavailable and offers explicit Mark complete for non-timed work. `conditioningLocationTask.ts` selects active `free` sessions only. The Feature Tree's “GPS or manual splits” descriptions for Sprints are broader than runtime wiring.

## Free session GPS and route detail

- The free-session screen supports Run or Bike and a timer-only fallback. The registered task `src/services/conditioningLocationTask.ts` consumes free-session location batches through Expo Location and Task Manager, writes processed fixes (including their acceptance status), and merges GPS state into the saved runner document. Keep the import in `index.ts` and the permissions/plugin entries in `app.json`. It remains subject to OS permission and background-execution limits (`d08cadc`, `920f146`).
- `src/conditioning/gps.ts` (`gps-v0.1`) filters duplicates, pauses, and drift. Initial parameters are 30 m horizontal accuracy, 30 s gap, movement minimum of 3 m or half the combined accuracy, and speed caps of 12 m/s for runs and 35 m/s for rides. The gap creates a segment separation instead of adding the jump to distance. `splits.ts` builds kilometer and mile series, including partials. `elevation.ts` (`elevation-v0.1`) applies a five-sample median and 3 m reversal hysteresis inside each segment (`d06af5a`).
- `src/components/conditioning/RouteMap.tsx` and `ConditioningSessionDetailScreen.tsx` render recorded route information when available (`4123903`, `87e259b`). `docs/conditioning-implementation.md` records the native Android map-key dependency and the outstanding physical-device locked-phone test.

## Estimated Training Emphasis

`src/conditioning/emphasis.ts` (`3c97333`) produces `heuristic-v0.1` estimates, six independent low-confidence 0–100 indexes across aerobic, lactic, and alactic power/capacity or endurance. `ConditioningAdaptationsScreen.tsx` presents the target preview or actual estimate and the explanatory popover. Keep the estimates versioned, preserve saved estimates, and use category colors only inside conditioning. These values describe estimated training emphasis and have no measured-adaptation interpretation.

The estimator can use a known session RPE for bouts without work RPE. Source returns all-null `insufficient_data` when known work is unusable or required recovery is missing, and can return numeric `partial` coverage when only some bouts lack duration or RPE. The scoped rule summarizes missing inputs as `insufficient_data`, so consult the actual partial branch and `.cursor/rules/conditioning-emphasis.mdc` before changing coverage. Distance, reps, and calories alone supply no inferred work duration.

`npm run verify:conditioning` passed during the backfill. `scripts/verify-conditioning.mjs` checks programmed totals, pause/resume, foreground reconciliation, interruption, partial work, GPS gaps/duplicates/drift, kilometer/mile splits, elevation noise, and selected emphasis cases. It does not exercise real native background recording or rendering.
