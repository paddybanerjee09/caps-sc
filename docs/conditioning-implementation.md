# Conditioning implementation

CAPS stores conditioning on the device in the existing `caps.db` SQLite database. There is no remote conditioning API in this repository. Uploads stay pending until `EXPO_PUBLIC_CONDITIONING_API_URL` is set. Map tiles on Android also need a Google Maps key in the native build. Locked-phone GPS was not verified on a physical device.

## Screen flow

The Conditioning tab shows a monthly calendar, the selected day's sessions, Free Session, Create Session, and a Saved Workouts expander. Create Session opens an overlay for Time Interval, Sprints, or Circuit, then a large editor. Saved workouts use the same grid in the expander and in `SavedConditioningSessionScreen`. Free sessions record now and do not use the log-time control. Planned and logged sessions use `LogTimeChanger` for the clock time.

Planned rows stay `planned` until Start or Log. Opening or saving a template does not create a completed session. Start records now, even if another calendar day is selected. Discarding a recording restores the original plan.

## Data model

Migration 7 adds owner, templates, template stations, sessions, segments, location points, work occurrences, splits, upload jobs, and runner state. Sessions store an immutable snapshot. Template edits do not rewrite plans or history. Scheduled dates are `YYYY-MM-DD` plus an IANA timezone. Performed placement uses the local date captured at save time, so a later timezone change does not move that calendar day. The home timeline still uses its existing absolute timestamps and the yellow conditioning color.

Canonical units are seconds, meters, and kilograms. Display units come from the in-memory unit settings. One mile is 1609.344 m, one yard is 0.9144 m, one foot is 0.3048 m, and one pound is 0.45359237 kg.

## Recording and execution

`src/conditioning/runner.ts` is the shared timer. Preparation is five seconds and is excluded from workout totals. Remaining time comes from deadlines. Pause and resume keep that remainder. Foreground return reconciles timer phases and stops at manual or GPS confirmation. A new process restores the last saved state, marks the interruption, and does not invent the missing work. `expo-keep-awake` only applies while the timer screen is visible. Background second-by-second cues are not implemented.

Free recording uses `expo-location` and `expo-task-manager`. The task is defined in `src/services/conditioningLocationTask.ts` and imported from `index.ts`. GPS filtering is `gps-v0.1`: 30 m accuracy ceiling, 30 s gap, 3 m or half the combined accuracy before movement counts, 12 m/s for runs, and 35 m/s for rides. Splits are generated separately for kilometers and miles. Elevation is `elevation-v0.1`: a five-sample median and 3 m reversal hysteresis inside each segment. These are initial filters, not device guarantees.

## Synchronization and emphasis

`syncConditioningBundle` uploads the session, then points in batches of 250, then occurrences and splits, and finalizes only after those counts are acknowledged. Retries continue from the acknowledged point sequence. Without an API URL the job remains local.

Training emphasis is `heuristic-v0.1` in `src/conditioning/emphasis.ts`. Scores are independent 0–100 indexes, low confidence, and are not rewritten when the algorithm changes. Missing durations or RPE produce `insufficient_data` and null scores.

## Verification

`npm run verify:conditioning` covers phase totals, pause and resume, foreground reconciliation, process interruption, GPS duplicates and gaps, splits, elevation noise, database constraints, and idempotent upload. `npx tsc --noEmit` passed for the TypeScript project. A browser or simulator cannot prove locked-phone GPS. That check needs a development build on a device.
