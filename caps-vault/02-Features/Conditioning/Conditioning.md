# Conditioning

Status at `e492e06` · implemented on main, with free-session GPS device verification outstanding. See [[Conditioning Execution]], [[Conditioning Records]], and [[Project History]].

## Start with the flow you are changing

| Area | Entry and behavior | Source |
| --- | --- | --- |
| Hub and selected day | The Conditioning tab loads the month, selected-day sessions, saved workouts, and any active/review recording. Session rows open detail. Derive displayed loading state from the current fetch key so stale responses and effects cannot reset current state. | `src/screens/ConditioningScreen.tsx` (`f2b5a37`, `17e5a94`, `e9d18be`) |
| Calendar | The hub supplies events to `MonthlyTimelineComponent`, whose `monthGrid` builds a locale-aware grid. Monday is the default. Today uses the tertiary token and selection uses a separate border. Logged markers fill, planned markers outline, and the grid caps markers at three plus `+N`. The selected-day list includes all returned sessions. | `src/components/MonthlyTimelineComponent.tsx`, `src/components/monthGrid.ts`, `src/conditioning/dates.ts` (`50427a5`, `e9d18be`) |
| Create and plan | Create Session opens the format chooser for Time Interval, Sprints, or Circuit. The editor can create/update a saved workout, plan/edit a calendar session, log it manually, or start a live run. Start uses the current time. Circuit stations have their own editor and use typed completion targets. | `src/screens/conditioning/CreateConditioningSessionScreen.tsx`, `StationEditorScreen.tsx` in the same directory, `src/conditioning/drafts.ts`, `validation.ts` (`64bc57b`, `001e7f3`, `002c288`, `45e2f29`) |
| Saved workouts | The inline expander opens `SavedWorkoutGrid`. The selected template opens a dedicated screen with start, plan, and manual-log actions. Opening or saving a template leaves training history unchanged. | `src/components/conditioning/SavedWorkoutGrid.tsx`, `src/screens/conditioning/SavedConditioningSessionScreen.tsx` (`001e7f3`, `f2b5a37`, `e9d18be`) |
| Manual log and detail | Manual log uses `LogTimeChanger` and an explicit performed date. Start and finish equal the single chosen instant. Keep actual occurrence inputs separate from targets. Detail reads a snapshot and offers actions based on status, a route when present, and estimated emphasis. | `src/screens/conditioning/LogConditioningSessionScreen.tsx`, `ConditioningSessionDetailScreen.tsx` in the same directory (`002c288`, `4123903`, `45e2f29`, `87e259b`) |
| Execution | Free Session starts an open-ended run or ride now. A structured plan or template starts a phase runner. Finishing either creates a review draft and saving creates the completed or ended-early log. | [[Conditioning Execution]] |

## Navigation and maintenance

- The `ConditioningWorkspaceProvider` is above the tabs. It owns the workspace stack, one editor, log request, and confirmation state. `AppNavigator` mounts `ConditioningStack` while this tab is active. Station, log, and emphasis screens cover the editor when present. Drafts stay in the workspace across those visits. `ConfirmDialog` is mounted inside the stack. `4539314` and `7e20d09` are the introduction points. See [[App Architecture]].
- Use dedicated screens for destinations. The scoped navigation rule allows the format chooser, one editor, the emphasis explanation, and discard/end confirmations as overlays. The Saved Workouts expander is the hub control allowed to reflow layout. Editors share a single unsaved-change guard for Back, Cancel, X, and system Back. Read `.cursor/rules/navigation-and-overlays.mdc` for layout and `.cursor/rules/ui-style-guide.mdc` for form styling.
- Active implementation starts with the October 11 rebuild (`3f111e1` through `e677232`). November moved to card layouts, stepper inputs, and shared feedback cues (`e9d18be`, `45e2f29`, `87e259b`). Feature Tree entries and versions are searchable through [[Feature Tree Crosswalk]], with authored detail at `docs/feature-tree/conditioning.html` and `data/conditioning.js` in the same directory.
- Planned product integrations in the README include Strava OAuth/import and heart rate from HealthKit or Health Connect (`0b97b10`, `41b5c4d`). No implementation for either was found in main. GPS tracking in a free session is a separate implemented device feature.

## Historical Conditioning v1

The Progress placeholder became Conditioning across `dd88e65`, `37c812d`, and `ad01bfe`. On the archived branch, August 2 introduced another conditioning implementation with its own model, database, baseline settings, templates, detail, month view, and Home integration (`3277f49`, `980ec0e`, `edd841a`, `f9783fa`, `3893a83`, `8efe318`, `4ffc761`, `6b42cd1`, `a53b7cc`, `05a83fe`, `d1240b6`, `bd5c21f`, `e2c3e86`). August 9 added tests, persistent distance preferences in that version, merged interval protocols, mutable log edits, alignment fixes, minute/second inputs, and hill-sprint fields (`a86e226` through `656a078`).

September shared `MonthTimeline` and adaptation presentation with [[Strength History]] (`44d4e27`), addressed effect-driven state cascades (`f7108bd`), and experimented with modal frames, inline saved cards, save-from-log, and end-time semantics from the UI audit to `7daf5e7`. Inspect `git show 7daf5e7:src/screens/ConditioningScreen.tsx` for that hub. The archived modal workflow and duration-derived manual-log timestamps differ from the current workspace and single-instant logging. The archived branch and main have merge base `e8fc8e9`, the parent of the October 2 `9fc0f73` commit. The reset rationale is unrecorded in the Feature Tree.

## Uniform UI audit (20 November 2026)

All owned subscreens now use shared safe-area headers, branch-wide X, fixed depth-aware Cancel/Back footers, and preserved domain actions. Applicable log timestamps use the header clock and shared scroll-wheel modal; weight/load fields use decimal text input without increments or presets. See [[UI and Interaction Decisions]] for the current contract and [[2026-11-20 UI Audit Review]] for screen/input coverage and verification limits.
