# Data and Persistence

CAPS uses a local Expo SQLite database named `caps.db`. `src/App.tsx` mounts `SQLiteProvider` with `onInit={migrateDatabase}`. `src/data/database.ts` enables WAL and foreign keys before reading `PRAGMA user_version`. Current schema version is **12** for Strength session modes and RIR.

Read [[Timeline and Nutrition Tables]] for the shared timeline, weight, sleep, diary, and food catalog. Read [[Conditioning Tables]] for workouts, recordings, tracks, runner state, and upload checkpoints. [[Settings]] describes app-level values held in React state. [[Strength]] describes planned and performed snapshots. [[Skills Training]] logs through `skill_templates`, `skill_template_activities`, `skill_sessions`, and `skill_session_activities`.

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
| 11 | Rebuild Skill template/session activity children to support reps, sets, numeric RPE and rest-between-sets, preserving legacy records | Compact logging refinement; see below |
| 12 | Add Strength scheduling dates, exercise targets, and set RIR | `0fc99cb` |

### Repair path

`ece0620` addressed a database with an advanced `user_version` and missing nutrition tables. The current initializer checks for `nutrition_workspace`, `strength_sessions`, and `skill_sessions` before returning early. A current version with a missing strength table reruns the v8 DDL, which is `CREATE TABLE IF NOT EXISTS`, and then fills any missing catalog rows. A current version with a missing `skill_sessions` table reruns the v9 DDL. v11 readiness also requires the new sets column in both Skill activity child tables; a current user_version with a missing child capability reapplies the transactional reps migration. `applyNutritionV5` checks `meal_items.source` before rebuilding items and checks `meal_logs.operation_id` and `meal_logs.saved_meal_id` before altering that table. It ensures catalog tables exist and retries the v6 favorite snapshot addition only when the column is missing. The initializer updates `user_version` after its DDL. Preserve this recovery path and check actual tables and columns when diagnosing a stopped migration. `nutrition_workspace` is the specific recovery sentinel; the initializer does not audit every table on a current-version database.

### Divergent schemas in Git

The main and pre-revert archive lineages share `e8fc8e9`. `980ec0e` used v5 for an older conditioning baseline/template/log schema, `d20abb7` used v6 for `athlete_preferences`, and `e8b22c1` added Strength storage at v10 on the archived line. See `git show origin/backup/pre-revert-7daf5e7:src/data/database.ts` and its `strengthMigration.ts`. Those version numbers and table layouts describe that lineage. Main uses v5/v6 for Nutrition and v7 for the current Conditioning schema. The old and new DDL even share the name `conditioning_template_stations` with different layouts. Current migration checks provide no demonstrated archive-to-main migration contract. If investigating a database created by an archived build, identify its lineage and inspect `sqlite_master` and `PRAGMA table_info` before treating the version number as a schema identifier. An archive-to-main upgrade was not tested in this backfill.

## Verification entry points

- `npm run verify:nutrition` uses an in-memory Node SQLite adapter for legacy meal data, migration repair, nutrition operations, snapshots, and repository behavior. See `scripts/verify-nutrition.mjs`.
- `npm run verify:conditioning` uses an in-memory adapter for current migration and conditioning repository and domain invariants. See `scripts/verify-conditioning.mjs`.
- `npm run verify:strength` uses an in-memory adapter for the v8 migration, catalog search, template create/update/archive, snapshot isolation, rollback, retry, duration, and focus fixtures. See `scripts/verify-strength.mjs`.
- `npm run verify:skill` uses an in-memory adapter for the v9 migration, focus, the calorie fixture, template save and archive, snapshot isolation, rollback, retry, and weight cutoff. See `scripts/verify-skill.mjs`.
- Both scripts passed during the backfill on `main` at `e492e06`, with Node module and experimental-feature warnings. These checks exercise specific JavaScript/SQLite paths. Device-level storage, native background recording, and previously installed archived builds require separate verification.

Related notes: [[App Architecture]], [[Home]], [[Nutrition]], [[Conditioning]], [[Project History]], [[Feature Tree Crosswalk]]. Feature Tree: [`database.html`](../../../docs/feature-tree/database.html).

## Athlete profile and weight ownership (23 November 2026)

There is no new main-database migration: caps.db remains schema 10, with the same IDs, foreign keys and history semantics. The previously in-memory profile now uses installed expo-sqlite/kv-store. Its separate default SQLite file is named ExpoSQLiteStorage; the package creates storage(key TEXT PRIMARY KEY NOT NULL, value TEXT). src/data/athleteProfileStorage.ts owns one key, caps.athlete-profile.v1, with JSON firstName/lastName, legacy age, dateOfBirth, sex, heightCm and sports. This is device-local profile storage with no owner foreign key or relation to authenticated accounts. Existing appearances/units/feedback/username persistence is not expanded by this change. No legacy DOB is fabricated; age remains a compatibility fallback until a real DOB is saved.

Profile writes serialize and merge patches after successful storage, preserving unrelated fields. Hydration exposes loading/error/retry rather than silently overwriting a saved profile after a failed read. weightKg is explicitly excluded on serialization/deserialization, so a sex/DOB/height/sport update cannot insert, change or duplicate weight history.

The relational source of truth for weight remains **timeline_entries → weight_logs**. timeline_entries.id is an INTEGER primary key and carries kind='weight', completed status, start_at epoch milliseconds, and created_at/updated_at. weight_logs.timeline_entry_id is both its primary key and a foreign key to timeline_entries.id with ON DELETE CASCADE; weight_kg is a positive REAL. Thus each measurement has one timeline parent and one detail row. Add and edit write both inside the existing transaction. Edit keeps the ID and updates only its timestamp/detail; delete removes the parent and cascades its detail. Latest profile weight is selected by start_at descending (ID breaks ties), so adding a backdated row does not replace a newer measurement. No profile JSON value overrides this projection.

The one WeightLogModal performs display/input conversion and timestamp validation for Home and Athlete Information. Boundary conversion retains the existing kg/lb factor; unchanged rounded input preserves original kg precision. Every successful weight mutation refreshes latest weight and invalidates timelineRevision for Home and Progress. UI save locks prevent repeat submissions, and post-commit consumer-refresh errors cannot re-enable insertion. scripts/verify-weight.mjs checks timestamp/precision/backdating/edit/delete/cascade and rollback with real in-memory SQLite; native persistence/modal acceptance remains separate. See [[Settings]], [[Weight and Sleep Logging]], [[2026-11-23 UI Refactor Handoff]].

## Recovery v10 (21 November 2026)

See [[Recovery and Progress]] and docs/recovery-progress.md for the full relational key/foreign-key map, transaction lifecycle and rollback/retention consequences. The initializer adds daily_questionnaires as a repair sentinel and preserves the existing repair paths. New data is scoped to explicit device-local ownership, not authenticated accounts. No duplicate weight database or fake measured sleep is created. Native import stores sample/cursor atomically, retains provenance and supports edits/deletes; questionnaires keep saved revision history and recompute only their affected snapshot. Imported deletion retains questionnaire/weight history; downgrade/drop is not an implemented rollback. Four existing domain verifiers now expect schema 10 and pass, alongside four Recovery/health/chart checks.

## SRI v2 JSON compatibility (22 November 2026)

No new SQL migration: v10 keys/FKs remain. Active response/revision JSON adds optional sriVersion and awakeningsAtLeast. Saved/edited questionnaires use weighted sri_v2; old missing-version/v1 responses keep original SRI during health recalculation. Snapshot JSON retains the chosen SRI version; unlike versions stay separate in Progress. 10+ records are lower bounds and aggregate as bounds. See docs/questionnaire-sri-v2.md for the full transaction, relation and rollback explanation and [[2026-11-22 Questionnaire and Chart Controls Handoff]] for evidence.

## Skills reps v11 (24 November 2026)

The requested Reps/Rounds activity editor adds a real persisted reps mode. `src/data/skillRepsMigration.ts` upgrades from v10 by rebuilding only `skill_template_activities` and `skill_session_activities` in one transaction. Parent headers, timeline entries, existing row IDs, positions, ownership, durations, effort bands, MET factors, calories, and old estimator versions are copied unchanged. No historical estimates are recalculated.

The relational hierarchy remains:

- `skill_templates.id` owns ordered `skill_template_activities` via its non-null `template_id` foreign key. `UNIQUE(template_id, position)` preserves order; deleting a template cascades to its activity children. Saving/updating a template is separate from logging; archiving hides it without deleting independent session history.
- `skill_sessions.id` owns ordered `skill_session_activities` through its non-null `session_id` foreign key and `UNIQUE(session_id, position)`. Those children cascade on header deletion. Each committed session still references its unique `timeline_entry_id`; source-template provenance does not make logged snapshots depend on a live template.
- Both child tables now admit `timing_mode='reps'` and add nullable `sets`, `reps`, `rpe`, and `rest_between_sets_seconds`. Reps mode requires sets/reps within Strength's existing ranges (1–20 and 1–100), with inactive duration/round fields null. Duration and rounds retain explicit required-field constraints and null inactive rep fields. Numeric RPE is optional 1–10; optional between-set rest is null or 0–600 seconds. App validation requires whole counts and seconds before any write.
- The in-memory editor retains raw strings for both Reps and Rounds while toggling and across nested/tab navigation. Persisted rows store only the active mode's parameters. Existing duration records stay readable; opening/closing an untouched activity does not migrate its recorded session.
- Reps estimates call Strength's existing duration helper: 3 seconds per rep, rest only between sets, omitted rest 90 seconds, explicit rest 0 retained. These are estimates, not measured execution. New logs use `skill-energy-v2-reps`; stored v1 headers/activity estimate snapshots retain their original values and are displayed from stored work/rest fields.
- Explicit numeric RPE maps to the existing estimate bands only: 1–6 easy, 7–8 moderate, 9–10 hard. The numeric value is stored separately; omitted numeric RPE stays null and does not invent a measured effort.
- The migration creates replacement children, copies legacy columns, drops each old child and renames its replacement inside the transaction. It advances `PRAGMA user_version` only after successful migration. Failure rolls back table changes and permits retry; startup checks both new-column sentinels even when the version is already 11. Foreign keys remain enabled.

Verification: `verify:skill` passed fresh v11, v10 legacy record/ID/header estimate/version survival, injected migration rollback/retry, current-version repair, foreign_key_check, reps template/log/reopen, immutable snapshots and idempotent retry. Nutrition, Conditioning, Strength, Recovery and Weight migration-version assertions are now11; their appropriate checks pass in this task. Detailed results/native limits are in [[2026-11-24 Compact Logging Refinement Handoff]] and [[2026-11-24 Skills Reps Refinement Handoff]].

## Android Expo Go QA database isolation (25 November 2026)

In this SDK58/Expo Go58.0.6 environment, a unique manifest slug did not isolate the default SQLite file: a prior Nutrition workspace appeared in the read-only QA emulator despite the new experience scope. The original AVD was protected by read-only/no-snapshot-save mode. Before synthetic Nutrition writes, the isolated temp project changed only its SQLiteProvider databaseName to caps-compact-qa-20261124.db and reloaded; the new workspace was empty/current. Root production databaseName remains caps.db. Use an explicit QA database namespace plus read-only AVD isolation, and avoid shared ExpoSQLiteStorage profile/favourite writes unless separately namespaced. This is an observed QA-environment constraint, not a production schema change. See [[2026-11-24 Compact Logging Refinement Handoff]] for evidence and cleanup.

## Strength session modes (v12)

Strength uses the existing one-to-one link from `strength_sessions.timeline_entry_id` to `timeline_entries.id`. The timeline owns status. Plans add `strength_sessions.scheduled_local_date` and use their selected start timestamp. Completed rows retain end-date placement. A date crossing or passing midnight does not change status. The expression index on the scheduled date with local end date fallback supports the month range query.

Both Strength exercise snapshot tables gain nullable `target_json`. A new target-based template or planned session stores the exercise prescription there without set child rows. Completed sessions attach performed set snapshots under each exercise. Both old set tables gain nullable `rir` constrained to 0–10, with 10 representing 10+. Existing parent IDs, cascade relationships, persisted estimates and snapshot values are preserved. Version 12 advances after the transactional schema update. Startup checks required columns and can repair a missing column without rewriting rows. See [[Strength]].
