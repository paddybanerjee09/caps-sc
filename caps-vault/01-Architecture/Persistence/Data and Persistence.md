# Data and Persistence

CAPS uses a local Expo SQLite database named `caps.db`. `src/App.tsx` mounts `SQLiteProvider` with `onInit={migrateDatabase}`. `src/data/database.ts` enables WAL and foreign keys before reading `PRAGMA user_version`. Current `main` schema version is **10**.

Read [[Timeline and Nutrition Tables]] for the shared timeline, weight, sleep, diary, and food catalog. Read [[Conditioning Tables]] for workouts, recordings, tracks, runner state, and upload checkpoints. [[Settings]] describes app-level values held in React state. [[Strength]] has archived schemas. [[Skills Training]] logs through `skill_templates`, `skill_template_activities`, `skill_sessions`, and `skill_session_activities`.

## Migration sequence on main

| Version | Implementation | History |
| --- | --- | --- |
| 1 | `timeline_entries` and its time index | `59dd4e8` created the migration, `5d1ccde` mounted the provider, and `fb6ae68` added timeline repository work. |
| 2 | `weight_logs`, keyed by timeline entry | `ea4cc2b` |
| 3 | Effective-dated `sleep_schedules` | `859b4aa` |
| 4 | `meal_logs` and FoodData Central `meal_items` with integer `fdc_id` | `241f556` |
| 5 | Provider-neutral meal item rebuild, meal linkage columns, catalog tables, nutrition receipts, and workspace | `884864f`, repaired in `ece0620` |
| 6 | `food_favourites.snapshot_json` | `dde7751` |
| 7 | Conditioning owners, templates, sessions, and recording children | `3f111e1`; retryable upload behavior in `091cc58` |
| 8 | Strength catalog, templates, sessions, exercise snapshots, and performed sets | `e0f5bb4` |
| 9 | Skill templates, sessions, and ordered activity snapshots | `80f1155` |
| 10 | Device-local Recovery owner, questionnaires/revisions, health observations/connections, snapshots, baselines and source preferences | `ec03ac1` |

### Repair path

`ece0620` addressed a database with an advanced `user_version` and missing nutrition tables. The current initializer checks for `nutrition_workspace`, `strength_sessions`, and `skill_sessions` before returning early. A current version with a missing strength table reruns the v8 DDL, which is `CREATE TABLE IF NOT EXISTS`, and then fills any missing catalog rows. A current version with a missing `skill_sessions` table reruns the v9 DDL. `applyNutritionV5` checks `meal_items.source` before rebuilding items and checks `meal_logs.operation_id` and `meal_logs.saved_meal_id` before altering that table. It ensures catalog tables exist and retries the v6 favorite snapshot addition only when the column is missing. The initializer updates `user_version` after its DDL. Preserve this recovery path and check actual tables and columns when diagnosing a stopped migration. `nutrition_workspace` is the specific recovery sentinel; the initializer does not audit every table on a current-version database.

### Divergent schemas in Git

The main and pre-revert archive lineages share `e8fc8e9`. `980ec0e` used v5 for an older conditioning baseline/template/log schema, `d20abb7` used v6 for `athlete_preferences`, and `e8b22c1` added Strength storage at v10 on the archived line. See `git show origin/backup/pre-revert-7daf5e7:src/data/database.ts` and its `strengthMigration.ts`. Those version numbers and table layouts describe that lineage. Main uses v5/v6 for Nutrition and v7 for the current Conditioning schema. The old and new DDL even share the name `conditioning_template_stations` with different layouts. Current migration checks provide no demonstrated archive-to-main migration contract. If investigating a database created by an archived build, identify its lineage and inspect `sqlite_master` and `PRAGMA table_info` before treating the version number as a schema identifier. An archive-to-main upgrade was not tested in this backfill.

## Verification entry points

- `npm run verify:nutrition` uses an in-memory Node SQLite adapter for legacy meal data, migration repair, nutrition operations, snapshots, and repository behavior. See `scripts/verify-nutrition.mjs`.
- `npm run verify:conditioning` uses an in-memory adapter for current migration and conditioning repository and domain invariants. See `scripts/verify-conditioning.mjs`.
- `npm run verify:strength` uses an in-memory adapter for the v8 migration, catalog search, template create/update/archive, snapshot isolation, rollback, retry, duration, and focus fixtures. See `scripts/verify-strength.mjs`.
- `npm run verify:skill` uses an in-memory adapter for the v9 migration, focus, the calorie fixture, template save and archive, snapshot isolation, rollback, retry, and weight cutoff. See `scripts/verify-skill.mjs`.
- Both scripts passed during the backfill on `main` at `e492e06`, with Node module and experimental-feature warnings. These checks exercise specific JavaScript/SQLite paths. Device-level storage, native background recording, and previously installed archived builds require separate verification.

Related notes: [[App Architecture]], [[Home]], [[Nutrition]], [[Conditioning]], [[Project History]], [[Feature Tree Crosswalk]]. Feature Tree: [`database.html`](../../../docs/feature-tree/database.html).

## Recovery v10 (21 November 2026)

See [[Recovery and Progress]] and docs/recovery-progress.md for the full relational key/foreign-key map, transaction lifecycle and rollback/retention consequences. The initializer adds daily_questionnaires as a repair sentinel and preserves the existing repair paths. New data is scoped to explicit device-local ownership, not authenticated accounts. No duplicate weight database or fake measured sleep is created. Native import stores sample/cursor atomically, retains provenance and supports edits/deletes; questionnaires keep saved revision history and recompute only their affected snapshot. Imported deletion retains questionnaire/weight history; downgrade/drop is not an implemented rollback. Four existing domain verifiers now expect schema10 and pass, alongside four Recovery/health/chart checks.
