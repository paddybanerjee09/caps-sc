# Strength implementation

- Date: 2026-11-15 15:39 -05:00 (America/Toronto). Agent: Cursor Grok. Branch: `main`.
- Commits: `e0f5bb4` domain and schema, `21d635f` screens, `aea27d0` saved-workout virtualization.
- Plan: [[2026-11-15 Strength Implementation Plan]]. Unrelated vault and `.cursor` edits were already in the working tree and were not included.

## What shipped

The Strength tab lists the month, Log Workout, Create Workout, and Saved Workouts. Create and log share `WorkoutBuilderScreen`. The draft stays in `StrengthWorkspaceContext` while the exercise editor or focus screen is open. A successful log writes the session, set snapshots, `strength-emphasis-v1`, the Home timeline row, and any template create, update, or archive in one transaction. The draft session id makes a retry a no-op.

Schema version is 8. Tables: `strength_exercises`, `strength_templates`, `strength_template_exercises`, `strength_template_sets`, `strength_sessions`, `strength_session_exercises`, `strength_session_sets`. Load is kilograms. Null rest is omitted and zero rest is stored. Bodyweight and assistance are explicit load modes. External load is per implement. Unilateral reps are per side and the duration model counts the entered reps once.

Duration assumptions live in `src/strength/duration.ts`: 3 seconds per rep, entered rest between sets, 90 seconds when that rest is missing, 60 seconds between exercises. Skipped sets and rest after the last work set are excluded. The Strength month uses the stored local end date. Home keeps `timelineCategories.strength`.

Focus colors: purple hypertrophy, red power, blue strength, green muscular endurance. A primary requires a score of at least 60 and a 15-point lead. Otherwise the marker is neutral (`#9EA4B0`). The catalog is the text-only pin `curated-2026-11-15` in `src/strength/catalogSeed.ts`. Photos and instructions are excluded.

## List audit

- Strength search, saved workouts, and session detail use `FlatList`.
- `SavedConditioningSessionScreen` now scrolls `SavedWorkoutGrid` as a `FlatList`.
- The conditioning hub expander stays a 248px bounded scroller. Putting a `FlatList` there would nest it in the hub `ScrollView`.
- `DayTimeline` was not converted. It measures lanes and scrolls programmatically with a `ScrollView` ref.
- Bounded forms and horizontal preset strips were left as they are. Nutrition search was already a `FlatList`.

## Verification

`npm run verify:strength`, `npm run verify:conditioning`, `npm run verify:nutrition`, and `npm run typecheck` passed. `npm run lint` still fails on pre-existing issues (`CAPS` in feature-tree data, `SimpleSwitch` ref access, `Date.now` purity, and set-state-in-effect on screens this task did not introduce). Strength files lint clean.

No device pass was run. Still needed: Create, save, log, edit the end time, cancel an unsave, commit an unsave, reopen the log, confirm only the Strength month uses the focus color, and check imperial units, bodyweight, empty search, and the keyboard against the footer.

## UI review follow-up

The pre-build UI review asked for filled month markers (`status: "logged"`), evidence on the focus screen instead of a modal, a narrow exercise row that keeps the name on screen, From Saved inside the log, and this archive sentence: “Logging with this off removes the saved workout from your list, and the session you log still stays on your calendar.” Those are in the builder and hub. A missing focus score reads Unavailable. The results list shrinks while Ends at is open.

The post-build source review found the log footer could sit below the tab bar because the column did not scroll. The builder is now one scrolling list with the footer fixed underneath. Logging that archives a saved workout asks first. Cancelling a new exercise removes it. A customized set can change load, reps, RPE, and rest.

## Next

1. Run the device pass above and fix what it shows.
2. Apply the UI review findings when [[Strength UI recheck]] returns.
3. Periodization around competition dates is still unbuilt.
