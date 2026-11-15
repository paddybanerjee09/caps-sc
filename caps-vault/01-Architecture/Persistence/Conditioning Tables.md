# Conditioning Tables

The current conditioning schema was added at v7 in `3f111e1`. `src/data/conditioningMigration.ts` owns DDL. `src/data/conditioningRepository.ts` enforces local-owner scope, serializes conditioning writes, and owns transactional session state and timeline updates. See [[Conditioning]] for behavior and [[Data and Persistence]] for older branch schemas.

| Table | Relationship and ownership |
| --- | --- |
| `conditioning_owner` | Singleton owner ID used by both templates and sessions. Repository derives/validates device ownership through this row. |
| `conditioning_templates` | Owner-scoped saved `time_interval`, `sprint`, or `circuit` workout with versioned `config_json`, archival timestamp, and last-used metadata. |
| `conditioning_template_stations` | Ordered station children, unique by template and position, cascading on template deletion. Stores completion mode, target, recovery, optional target RPE, and notes. |
| `conditioning_sessions` | Owner-scoped plan, recording, or log, including free run/bike sessions. Nullable links to the source template and timeline projection use `ON DELETE SET NULL`. Workouts store a versioned `snapshot_json` so template edits cannot rewrite their planned or completed workout details. |
| `conditioning_segments` | Child recording slices with unique sequence per session, start/end and break reason. |
| `conditioning_location_points` | GPS samples keyed by session and sequence. Stores an optional segment identifier, coordinates, accuracy, acceptance/rejection, and distance delta. The location table links to the session; `segment_id` is not a SQL foreign key. |
| `conditioning_occurrences` | Work/rest/station rows unique by session and position, with phase, target/actual JSON, completion method and pending/completed/partial status. |
| `conditioning_splits` | Both kilometer and mile split rows keyed by session, unit, and ordinal. Distances remain in meters. |
| `conditioning_upload_jobs` | One retry job per session and status, retry count, expected counts, acknowledged point sequence and occurrence/split counts. Implemented retry in `091cc58`; `src/data/conditioningSync.ts` resumes from the stored acknowledgement. |
| `conditioning_runner_state` | One saved state JSON record per session. Used for restoring the last persisted structured-runner position. |

Segments, points, occurrences, splits, upload jobs, and runner state are session children with `ON DELETE CASCADE`. Training status (`planned`, `in_progress`, `finished_draft`, `completed`, `ended_early`, `cancelled`) and sync status (`local_only`, `pending`, `uploading`, `synced`, `failed`) are separate. `timeline_entries.status` is a coarser display projection; the conditioning repository remains authoritative for lifecycle. Keep planned and performed date fields explicit, preserve seconds/meters/kilograms, and leave omitted session RPE null. See `.cursor/rules/calendar-session-state.mdc` and `.cursor/rules/conditioning-data-and-units.mdc`.

Evidence: `src/data/conditioningMigration.ts`, `src/data/conditioningRepository.ts`, `src/data/conditioningSync.ts`, `src/conditioning/runner.ts`, and checks listed in [[Data and Persistence]]. Feature Tree: [`database.html`](../../../docs/feature-tree/database.html).
