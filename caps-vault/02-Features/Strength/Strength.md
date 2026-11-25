# Strength

Logging is on the Strength tab. The `strength` route in `src/navigation/routes.ts` opens `StrengthTrainingScreen` via `src/screens/Screens.tsx`. Bottom tabs use `barbell-outline`. Since 24 November the hub shows MonthlyTimelineComponent, one shared Log Session action and the SavedWorkouts dropdown. Create Session is removed. Saved entries still open the log draft by their stored template ID. Strength tables arrived at schema version 8; current database version is 11 after the Skills reps migration. Home still paints strength rows with `timelineCategories.strength`.

## Product intent

`README.md` describes periodization based on goals, competition dates, and recorded workload. It describes logging exercises with sets, reps, load, rest, RPE, and RIR, in support of rate of force development, relative strength, and lean mass. This is planned scope (`0b97b10`, `41b5c4d`).

The 15 Nov 2026 implementation replaced the placeholder. Preserve the `strength` route, domain-owned cards, shared subscreen bars, and the explicit Log Time modal exception. The compact editor intentionally omits load entry; unknown loads remain null. Do not restore the archived modal stack. See [[Strength History]], [[2026-11-15 Strength Implementation Plan]], [[App Architecture]], [[Data and Persistence]], and [[Feature Tree Crosswalk]].

## Logging

`src/state/StrengthWorkspaceContext.tsx` keeps the draft while the exercise editor or focus screen is open. `src/screens/strength/WorkoutBuilderScreen.tsx` is the Log Session destination. Save/Unsave immediately creates or updates/archives the reusable template without logging a session. An edited saved workout shows Save; saving updates the same template ID. Timestamp-only changes do not change template state. The footer always exposes Save/Unsave separately from Log Session. Log Session writes the session, performed sets, `strength-emphasis-v1` and a `timeline_entries` row in one transaction. The screen passes `persistTemplate: false` so logging never silently saves, updates or archives a template; Save/Unsave own those operations. The repository retains its previous atomic template behavior by default for existing callers. The session id makes a retry a no-op. Failed writes leave the draft and the original template unchanged.

Load is stored in kilograms and rest in seconds. Null rest means omitted. Zero rest is explicit. Bodyweight and assistance are load modes. External load is per implement. Unilateral reps are per side. The duration estimate is 3 seconds per entered rep, the entered rest between sets, 90 seconds when that rest was omitted, and 60 seconds between exercises. It is stored unrounded. The Strength month uses the saved local end date. Start time is end minus that duration.

The focus estimate is heuristic and may overlap. A primary quality needs a score of at least 60 and a 15-point lead. Otherwise the month marker is neutral. Colors are purple hypertrophy, red power, blue strength, and green muscular endurance, with text labels on `StrengthAdaptationsScreen`.

Since `1662f54`, `listSameLiftReferences` uses SQLite to pick one usable result per exercise ID from the latest eligible completed session strictly before the cutoff. It joins sessions to exercise snapshots and performed sets, excludes warmups and skips, and uses the first eligible set’s exercise load mode to pick the lightest positive assistance or heaviest positive external load. The template and session writers share snapshot serialization. Templates project away warmups and skipped sets before writing. Performed snapshots store both flags and preserve explicit zero rest.

The exercise catalog is the existing curated pin in `src/strength/catalogSeed.ts` (`curated-2026-11-15`), read from `strength_exercises`. Add Exercises offers All/Favourites with database-backed search and no Custom tab or creation action. Existing custom catalog rows can still appear under All. Optional imageUrl metadata is supported, with a neutral thumbnail on absent/failed media. Current seeds have no licensed image URLs; do not infer photo rights from upstream IDs ([upstream issue #2](https://github.com/yuhonas/free-exercise-db/issues/2)).

`npm run verify:strength` covers the forward migration, templates, snapshots, rollback, retry, duration, focus, compact-form validation and mixed-target preservation, omitted loads, and Save → Unsave → Save → Log/update. Device exercise of the screens was not run in this session.

## Main-line history

1. `e9ddbfb` added the Expo Router `S&C` tab. `f0f5834` replaced that routing setup with custom state navigation and established the `strength` key.
2. `edd48ce` extracted `StrengthConditioningScreen`. `dd88e65` renamed the tab Strength and switched to `barbell-outline`. `ad01bfe` centered the title.
3. `59dd4e8` introduced the current `StrengthTrainingScreen` file alongside the SQLite transition. The implementations on the September archive descend from the placeholder and are outside main's ancestry after `e8fc8e9`.

Tree source is `docs/feature-tree/data/strength.js`, with navigation at `docs/feature-tree/strength.html`. Use [[Strength History]] for early provider, logging, SQLite, and scoring decisions when relevant.

## Uniform UI audit (20 November 2026)

All owned subscreens now use shared safe-area headers, branch-wide X, fixed depth-aware Cancel/Back footers, and preserved domain actions. Applicable log timestamps use the header clock and shared scroll-wheel modal; weight/load fields use decimal text input without increments or presets. See [[UI and Interaction Decisions]] for the current contract and [[2026-11-20 UI Audit Review]] for screen/input coverage and verification limits.

## Compact workout composition (24 November 2026)

The builder shows the workout title and a compact estimated-duration subtitle, followed by the **Exercises** card and its **Add Exercises** button. The builder search bar has been removed; search belongs only to Add Exercises. No catalog exercises are inserted or shown in the workout by default. The separate `AddExercisesScreen.tsx` virtualizes catalog results, offers All/Favourites and a Back-only footer, and opens `ExerciseEditorScreen.tsx` to configure a selected exercise. Add Exercise returns directly to the workout. Editor Back removes a new selection or discards local edits through confirmation; picker Back preserves the parent draft/search; X exits the branch through draft guards. Raw exercise input strings live in StrengthWorkspaceContext so switching tabs preserves unfinished or invalid input. The shared AppNavigator owns keyboard avoidance; these screens do not add a second keyboard-padding layer.

The editor has direct text boxes for Sets, Reps, optional RPE, optional rest seconds, and notes. `src/strength/exerciseForm.ts` preserves existing mixed set targets unless changed explicitly, plus existing loads and performed flags. Blank RPE/rest remain null; explicit zero rest stays zero. New external/assisted exercises may have unknown load. Explicit invalid numeric loads remain rejected; omitted load is never replaced with zero or a bodyweight choice and does not fabricate relative-load emphasis. Old steppers, per-set UI, load-mode controls, move buttons, From saved workout, Starts text and Save workout toggle are removed from this flow. Estimated duration and focus remain.

### Persistence contract

Strength introduces no table changes. Current caps.db is v11 for Skills reps; the Strength schema remains the v8 hierarchy. See [[Data and Persistence]].

- `strength_exercises.id` identifies catalog entries. Template/session exercise snapshots retain that identifier in `exercise_id`, alongside their own copied name, equipment, load mode and muscle-group values. That catalog link is a logical reference rather than a foreign key.
- `strength_templates.id` owns ordered `strength_template_exercises` rows via `template_id`; each exercise owns ordered `strength_template_sets` via `template_exercise_id`. Both parent-child foreign keys cascade on deletion. Save writes this hierarchy transactionally; updates retain the template header ID and replace its children.
- Every template write allocates fresh snapshot exercise/set primary keys, independent of UI draft and session keys. Archived templates keep their child rows, so reusing draft keys previously caused a uniqueness collision on Save → Unsave → Save. Fresh snapshot keys fix that sequence and subsequent log/update operations.
- Unsave sets `strength_templates.archived_at` and detaches the current draft. It does not delete a log. `strength_sessions` keeps its independent `strength_session_exercises` → `strength_session_sets` hierarchy; those foreign keys also cascade. `source_template_id` is provenance, not a foreign key that could erase a session when its template is archived.
- Each session has one unique `timeline_entry_id` foreign key to `timeline_entries`. Logging writes the timeline, session snapshots and focus estimate in one transaction. The Log Session screen opts out of template mutations with `persistTemplate: false` while retaining source-template provenance; the API default still supports legacy atomic template updates. Retrying the same session ID remains idempotent. Failed writes preserve the draft and rollback stored changes.
- Load and assistance columns already allow null; values remain kilograms, rest seconds. The compact form changes validation, not the relational schema.
- Favourites are device-local catalog ID arrays in existing `expo-sqlite/kv-store`: database `ExpoSQLiteStorage`, table `storage(key TEXT PRIMARY KEY NOT NULL, value TEXT)`, key `caps.strength.exercise-favourites.v1`. `src/data/strengthExerciseFavourites.ts` serializes read-modify-write operations so rapid favourites on separate rows do not replace one another. This store is separate from relational workout/session snapshots.

Verification: strength regression suite passed after the snapshot-key repair. Skill and Conditioning domain checks passed. Final integrated type/lint/tree results and device limits are recorded in [[2026-11-24 Training Session Workflow Handoff]].

## Compact layout refinement (24 November 2026)

The Log Session builder has no Search Exercises input or estimated-duration card. Duration is a small subtitle directly below the workout title. The shared WorkflowFooter equalActions mode gives Cancel, Save/Unsave and Log Session identical outer flex containers, equal widths and stretched heights. TrainingNumberField is extracted from the exercise editor and reused by Skills and Conditioning; EstimatedFocusButton is the canonical shared presentation for domain-owned Strength and Conditioning focus values. Direct text boxes retain raw drafts, optional/null validation and current touch targets; no numeric increment/decrement controls are introduced. Validation and native acceptance details are in [[2026-11-24 Compact Logging Refinement Handoff]].

Native Android refinement: AppNavigator now owns height-based screen keyboard avoidance (6c6050d), with existing iOS padding unchanged. Isolated Android QA reproduced hidden workflow actions before the fix and verified focused Target RPE plus every action above the IME afterward. Native Modal forms retain their own separately verified padding; do not nest another avoidance layer in normal training screens. See [[2026-11-24 Compact Logging Refinement Handoff]].

Android acceptance on 25 November verified the subtitle, absent builder search and equal footer geometry (217/216/217px wide, 91px high; one-pixel rounding). Shared Android keyboard avoidance keeps normal-screen fields/actions above IME. This does not establish native template/log persistence or iOS coverage; see [[2026-11-24 Compact Logging Android QA]].
