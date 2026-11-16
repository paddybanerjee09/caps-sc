# Strength

Status at `aea27d0` · logging is on the Strength tab. The `strength` route in `src/navigation/routes.ts` opens `StrengthTrainingScreen` via `src/screens/Screens.tsx`. Bottom tabs use `barbell-outline`. The hub shows `MonthlyTimelineComponent`, then Log Workout, Create Workout, and Saved Workouts. Schema version is 8. Home still paints strength rows with `timelineCategories.strength`.

## Product intent

`README.md` describes periodization based on goals, competition dates, and recorded workload. It describes logging exercises with sets, reps, load, rest, RPE, and RIR, in support of rate of force development, relative strength, and lean mass. This is planned scope (`0b97b10`, `41b5c4d`).

The 15 Nov 2026 implementation replaced the placeholder. Preserve the `strength` route, screen-local cards, stepper and preset controls, and confirmation-only modal policy. Do not restore the archived modal stack. See [[Strength History]], [[2026-11-15 Strength Implementation Plan]], [[App Architecture]], [[Data and Persistence]], and [[Feature Tree Crosswalk]].

## Logging

`src/state/StrengthWorkspaceContext.tsx` keeps the draft while the exercise editor or focus screen is open. `src/screens/strength/WorkoutBuilderScreen.tsx` is both Create Workout and Log Workout. Create saves a template only. Log writes the session, performed sets, `strength-emphasis-v1`, a `timeline_entries` row, and any template create, update, or archive in one transaction. The session id makes a retry a no-op. Failed writes leave the draft and the original template unchanged.

Load is stored in kilograms and rest in seconds. Null rest means omitted. Zero rest is explicit. Bodyweight and assistance are load modes. External load is per implement. Unilateral reps are per side. The duration estimate is 3 seconds per entered rep, the entered rest between sets, 90 seconds when that rest was omitted, and 60 seconds between exercises. It is stored unrounded. The Strength month uses the saved local end date. Start time is end minus that duration.

The focus estimate is heuristic and may overlap. A primary quality needs a score of at least 60 and a 15-point lead. Otherwise the month marker is neutral. Colors are purple hypertrophy, red power, blue strength, and green muscular endurance, with text labels on `StrengthAdaptationsScreen`.

Since `1662f54`, `listSameLiftReferences` uses SQLite to pick one usable result per exercise ID from the latest eligible completed session strictly before the cutoff. It joins sessions to exercise snapshots and performed sets, excludes warmups and skips, and uses the first eligible set’s exercise load mode to pick the lightest positive assistance or heaviest positive external load. The template and session writers share snapshot serialization. Templates project away warmups and skipped sets before writing. Performed snapshots store both flags and preserve explicit zero rest.

The exercise catalog is a text-only pin in `src/strength/catalogSeed.ts` (`curated-2026-11-15`). Photos and instructions are excluded because upstream image provenance is unverified. Custom exercises are rows in `strength_exercises`.

`npm run verify:strength` covers the forward migration, templates, snapshots, rollback, retry, duration, and the four focus qualities. Device exercise of the screens was not run in this session.

## Main-line history

1. `e9ddbfb` added the Expo Router `S&C` tab. `f0f5834` replaced that routing setup with custom state navigation and established the `strength` key.
2. `edd48ce` extracted `StrengthConditioningScreen`. `dd88e65` renamed the tab Strength and switched to `barbell-outline`. `ad01bfe` centered the title.
3. `59dd4e8` introduced the current `StrengthTrainingScreen` file alongside the SQLite transition. The implementations on the September archive descend from the placeholder and are outside main's ancestry after `e8fc8e9`.

Tree source is `docs/feature-tree/data/strength.js`, with navigation at `docs/feature-tree/strength.html`. Use [[Strength History]] for early provider, logging, SQLite, and scoring decisions when relevant.
