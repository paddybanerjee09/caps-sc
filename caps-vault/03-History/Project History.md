# CAPS project history

Baseline `e492e06` on `main`. [[Git Commit Index]] enumerates 196 commits reachable from the local refs at the time of the backfill. It includes 118 ancestors of this baseline, 76 commits exclusive to the archived training lineage, and two commits on the separate boilerplate lineage. Git history was locally available and non-shallow. The extra Codex snapshot refs introduced no unique reachable commits.

## June and July · bootstrap, profile, and daily logging

- `c88eab6` and `e9ddbfb` established the original Expo Router project and five routes. `f0f5834` replaced that setup on main with explicit routes, themed chrome, and an Expo entry point. The separate `910fe50` → `d005295` lineage under `master` and `recreated-boilerplate` preserves related exploratory work. Both histories have roots and the recreation on main has its own commit.
- Early July revisions moved screens and settings out of the initial boilerplate. Athlete/profile state, dedicated sidebar destinations, Quick Log, and home sections landed across `edd48ce`, `101ec87`, `3d09c81`, `5904f45`, and `2d78f4c`. `efc880c` records an early Quick Log layout correction. See [[Settings]], [[Home]], and [[App Architecture]].
- `59dd4e8`, `5d1ccde`, and `fb6ae68` established local SQLite and timeline storage. The first weight log synced the profile weight, then added backdating and deletion. `859b4aa` added manual sleep and a nightly default. See [[Data and Persistence]] and [[Home]].
- The July nutrition flow added macros, time selection, a meal modal, USDA search, manual calorie editing, and planned/completed logging. `e8fc8e9` is the last shared ancestor of main and the archived training work. See [[Nutrition]] for which July models and screens were replaced.

## August and September · archived training branch

- Conditioning v1 added a domain model, schema, repository, calendar, templates, details, and Home integration (`3277f49`–`e2c3e86`). The August follow-up added preferences and log editing, consolidated interval inputs, and iterated on compact fields and hill-sprint protocol (`a86e226`–`656a078`). See [[Conditioning]].
- Strength v1 added validation, adaptation estimates, an ExerciseDB adapter, immutable workout logs and templates, editors, and timeline integration. Its September checks covered mapping, cancellation, migration, scoring, search/editor flows, creation, details, and timeline refresh. See [[Strength]].
- The UI audit branch added shared collection state, layout wrappers, and contextual timeline presentation. `6f5d88d` is the merged audit tip and the second parent of `7fac1fb`. Subsequent commits moved action buttons and saved workouts inline, tightened spacing, and unified grid/dropdown behavior. `7daf5e7` is the last archived revision in `origin/backup/pre-revert-7daf5e7`.
- Main resumes from `e8fc8e9` at `9fc0f73`. Git parentage shows a history rollback, with SDK 57 and UI repairs applied to the July baseline. Archived schema versions, ExerciseDB, strength services, audit wrappers, and legacy Conditioning v1 implementation are historical evidence. The source baseline has a fresh Conditioning implementation and a Strength placeholder. See [[UI and Interaction Decisions]] and [[Data and Persistence]] before consulting old implementations.

## October · nutrition and conditioning rebuilds

- `c4f7af8`–`1d8b456` introduced nutrition’s provider-neutral model, versioned schema, always-mounted workspace, full-screen composer, saved meals, food picker, barcode scanning, custom food, and favourites. FatSecret search uses the project proxy, and Open Food Facts provides barcode lookup. `fe847c6` removed the USDA client. Follow-up commits recovered an incomplete migration, stabilized loads, preserved serving snapshots, and finished saved meal editing. See [[Nutrition]] and `docs/nutrition-providers.md`.
- `ccc63a6` fixed Home slider re-layout. `2c0cfb4` fixed the initial weight load effect. `c8ddb63` introduced cancellable idle work for Home and Nutrition. See [[Home]] and [[UI and Interaction Decisions]].
- `3f111e1`–`3c97333` replaced the old conditioning line with explicit statuses, calendar and editor flows, template/record separation, timed and manual execution, free-session location capture, route details, upload primitives, and provisional emphasis estimates. `e677232` recorded implementation and scoped rules. See [[Conditioning]] and `docs/conditioning-implementation.md` for coverage and current gaps.

## November · app-wide styling and shared memory

- `3587129`, `cb31dff`, and `5c595dd` added a React Native patterns skill, a card-driven high-contrast style guide, and sensory feedback. `6b9fc9a` through `9917cee` carried the card and stepper treatment across account/athlete settings, Home, Conditioning, and Nutrition. `17e5a94` and `75dd681` record the Conditioning fetch-key approach, with `75dd681` preserving it after the screen renovation.
- `75dd681` added the eight-tree HTML site, tree rules, and checker. The bundled commit data represents the pre-site snapshot of 190 commits. The four later main commits and two separate boilerplate commits are covered in [[Git Commit Index]]. The tree site's own architecture version still carries its original `uncommitted` flag.
- `af9550c` introduced the rules/vault/Feature Tree workflow. `09346ce` changed the launcher asset, documented in [[2026-11-10 App Logo Handoff]]. `e492e06` specified nested note retrieval under root `caps-vault/` and reuse of context on follow-ups for the same task. The initial backfill starts at [[00-Index]].

## Interpreting historical claims

- The repository README describes intended product scope alongside early implementation. Its SDK 54 and USDA references are stale at this baseline. Strava OAuth activity import, Apple HealthKit, Android Health Connect, skill logging, and the Recovery and Progress dashboards are roadmap items in the inspected sources.
- The Feature Tree documents design intent, implementation history, and reversals. See [[Feature Tree Crosswalk]] for node anchors. Canonical notes record source discrepancies. Device behavior and provider deployments need their own verification.
