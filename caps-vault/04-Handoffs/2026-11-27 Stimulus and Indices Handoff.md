# Training stimulus and indices

- 2026-11-27 17:50 EST (America/Toronto). Codex `/root` with Conditioning, Strength and Recovery model agents. Started at `9bad7ef` on `main`. Existing `.obsidian/graph.json`, `.obsidian/workspace.json` and `work/` contents belong to the user and remain intact.
- Scope is the attached CAPS implementation prompt. Canonical notes are [[Conditioning]], [[Strength]], [[Recovery and Progress]], and [[Data and Persistence]]. Engineering methods, limits and evidence are in `docs/training-stimulus-and-indices-v1.md`.

## Implementation

- Conditioning uses actual completed occurrences and optional manual observations in `src/conditioning/stimulus.ts`. Completed detail reaches `ConditioningAdaptationsScreen`. The existing runner and structured/free logging paths keep actual observations separate from scheduled targets. Existing snapshot and occurrence JSON accept this data without rewriting historical estimates.
- Strength uses actual completed sets in `src/strength/stimulus.ts`, with display in `StrengthAdaptationsScreen`, `WorkoutBuilderScreen` and `StrengthSessionDetailScreen`. Optional set details are additive and the user can keep logging without them. Existing legacy estimates retain their old contract.
- Home Recovery uses `src/domain/training/fatigue.ts`, `src/recovery/recoveryIndex.ts` and the raw adapters. `IndexInputs.tsx` supports manual day confirmation, session-load overrides, sleep targets and matched test observations. `MorningQuestionnaire` stores explicit readiness and observed hours asleep as optional JSON. `ProgressPanel` plots only newly derived index values. `TrainingMetricValue` is shared for unavailable explanations and partial coverage.
- The v13 migration is additive. Local date owns training coverage and sleep target changes. A timeline foreign key owns the optional session-load override. Reference test observations use timestamp, test identity and direction. Legacy derived snapshots stay under their existing versioned contract.

## Source and verification

- Local source commits are `bfa459c` (Conditioning stimulus and schema groundwork), `c1053e0` (shared session load), `c588903` (Strength stimulus), `2b6f405` (Fatigue Index and Recovery Index), and `5d9c768` (remaining v13 fixture assertions).

- The Fatigue acceptance fixture passed on SQLite and in the pure model. It checks 319.7056 sRPE units, missing versus rest, explicit zero, tie ranking, earlier snapshots, local dates across DST, completed versus planned records and retry without duplication. Recovery and Progress fixtures produced manual Recovery Index 65 and no new composite for check-in-only or legacy-score-only input.
- Full ESLint and TypeScript passed. All 14 existing and new project verifiers passed after updating the expected schema version for Nutrition, Skills and Weight. The targeted Conditioning and Strength suites also exercised persisted optional actual measurements and compatible references.
- Expo export passed for Android and iOS in separate single-worker JavaScript runs with `--no-minify --no-bytecode` after the initial multi-worker export exhausted host memory. The exports compiled the app entry point and are under ignored `dist/caps-training-v1-android` and `dist/caps-training-v1-ios`.
- Android Pixel_7 startup blocked before CAPS opened because Windows had insufficient available commit memory for the AVD's 4096 MB RAM requirement. A nominal 1024 MB launch was increased back to 4096 MB by the emulator. A final post-export check found 2,538 MiB of available Windows commit headroom, below the AVD requirement. On-device touch, keyboard and navigation acceptance remain open.
- Feature Tree data changes cover Conditioning, Strength, Home Recovery and Progress, and database migration. The eight trees validated with 34 pre-existing unmapped historical commits.
- Autonomic baseline inputs need an explicit compatible source, device and protocol. Existing native imports lack RHR/RMSSD acquisition-window identity. Manual recovery and eligible wearable sleep are usable independently. Live sensor verification and outcome validation remain open.

The device follow-up starts by loading CAPS in an isolated Android or iOS runtime and opening completed Conditioning, completed Strength, Home → Recovery and the Progress graph selector. Exercise manual-only saving, the missing-value disclosure with touch and hardware keyboard, and the 65-point Recovery chart on a fresh database. Native measurements need compatible device/protocol observations before baseline testing.
