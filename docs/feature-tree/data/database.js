CAPS.trees.database = {
  id: "database",
  title: "Database",
  summary:
    "Local Expo SQLite caps.db schema v10 stores training, nutrition, timeline, weight and Recovery data. Non-weight athlete profile settings additionally use expo-sqlite/kv-store’s separate ExpoSQLiteStorage database; no caps.db schema migration or weight-history duplication accompanies biometric editing.",
  rules: ["conditioning-data-and-units.mdc"],
  root: {
    id: "caps-db",
    title: "caps.db",
    kind: "data",
    tagline: "Expo SQLite, WAL, foreign keys on",
    files: ["src/data/database.ts"],
    summary:
      "`migrateDatabase` enables WAL and foreign keys, then applies versioned DDL. A special case reapplies nutrition v5 if `nutrition_workspace` is missing even when `user_version` is already current.",
    guardrails: [
      "If a migration creates tables after setting `user_version`, a later launch will skip them. Guard with table/column existence checks (`ece0620`).",
    ],
    versions: [
      {
        "n": 1,
        "name": "caps.db",
        "date": "2026-07-22 16:49 -0400",
        "commits": [
          "59dd4e8",
          "5d1ccde"
        ],
        "changes": [
          "`59dd4e8` added `src/data/database.ts`. `5d1ccde` actually wired `SQLiteProvider`."
        ]
      },
      {
        "n": 2,
        "name": "caps.db",
        "date": "2026-10-11 21:40 -0400",
        "commits": [
          "3f111e1"
        ],
        "changes": [
          "DATABASE_VERSION 7: conditioning schema."
        ]
      },
      {
        "n": 3,
        "name": "caps.db",
        "date": "2026-11-15 15:38 -0500",
        "commits": [
          "e0f5bb4"
        ],
        "changes": [
          "DATABASE_VERSION 8: strength catalog, templates, sessions, and set snapshots."
        ]
      },
      {
        "n": 4,
        "name": "caps.db",
        "date": "2026-11-16 11:01 -0500",
        "commits": [
          "80f1155"
        ],
        "changes": [
          "DATABASE_VERSION 9: skill templates, sessions, and activity snapshots."
        ]
      },
      {
        "n": 5,
        "name": "caps.db",
        "date": "2026-11-21 21:31 -0500",
        "commits": [
          "ec03ac1"
        ],
        "request": "Execute the supplied CAPS Recovery and Progress implementation plan.",
        "changes": [
          "Add idempotent v10 Recovery storage without duplicating weight logs.",
          "Preserve repair paths and add Recovery sentinel."
        ]
      }
    ],
    children: [
      {
        id: "migrations",
        title: "migrateDatabase",
        kind: "logic",
        tagline: "PRAGMA user_version 1..10",
        files: [
          "src/data/database.ts",
          "src/data/nutritionMigration.ts",
          "src/data/conditioningMigration.ts",
          "src/data/strengthMigration.ts",
          "src/data/skillMigration.ts",
          "src/data/recoveryMigration.ts"
        ],
        summary:
          "v1 `timeline_entries`, v2 `weight_logs`, v3 `sleep_schedules`, v4 `meal_logs`/`meal_items`, v5 nutrition rebuild + catalog tables, v6 favourite `snapshot_json`, v7 conditioning, v8 strength, v9 skill. v10 adds Recovery local ownership, questionnaires/revisions, native samples/connections and derived caches.",
        versions: [
          {
            "n": 1,
            "name": "v1 timeline",
            "date": "2026-07-24 00:10 -0400",
            "commits": [
              "59dd4e8",
              "5d1ccde",
              "fb6ae68"
            ],
            "changes": [
              "Timeline table and `timelineRepository`."
            ]
          },
          {
            "n": 2,
            "name": "v2–v4 logs",
            "date": "2026-07-28 19:39 -0400",
            "commits": [
              "ea4cc2b",
              "859b4aa",
              "241f556"
            ],
            "changes": [
              "Weight logs, sleep schedules, meal logs."
            ]
          },
          {
            "n": 3,
            "name": "v5 nutrition rebuild",
            "date": "2026-10-03 22:47 -0400",
            "commits": [
              "884864f",
              "ece0620"
            ],
            "changes": [
              "Catalog schema (`884864f`). Finished a migration that stopped before its tables existed (`ece0620`)."
            ]
          },
          {
            "n": 4,
            "name": "v6–v7",
            "date": "2026-10-11 21:40 -0400",
            "commits": [
              "dde7751",
              "3f111e1"
            ],
            "changes": [
              "Favourite snapshots (`dde7751` / v6). Conditioning DDL (`3f111e1` / v7)."
            ]
          },
          {
            "n": 5,
            "name": "v8 strength",
            "date": "2026-11-15 15:38 -0500",
            "commits": [
              "e0f5bb4"
            ],
            "changes": [
              "Forward migration adds the strength catalog, templates, sessions, and set rows, then pins the text-only exercise seed."
            ]
          },
          {
            "n": 6,
            "name": "v9 skill",
            "date": "2026-11-16 11:01 -0500",
            "commits": [
              "80f1155"
            ],
            "changes": [
              "Forward migration adds skill templates, sessions, and ordered activity snapshots."
            ]
          },
          {
            "n": 7,
            "name": "migrateDatabase",
            "date": "2026-11-21 21:31 -0500",
            "commits": [
              "ec03ac1"
            ],
            "request": "Execute the supplied CAPS Recovery and Progress implementation plan.",
            "changes": [
              "Migrate existing v9 without dropping weights or training history.",
              "Retain active-day uniqueness and revision audit history."
            ]
          }
        ],
      },
      {
        id: "table-timeline-entries",
        title: "timeline_entries",
        kind: "table",
        tagline: "kind, title, start_at, status",
        files: ["src/data/database.ts", "src/data/timelineRepository.ts"],
        summary: "Hub row for home timeline items. Category tables FK here.",
        versions: [
          {
            n: 1,
            name: "timeline_entries",
            date: "2026-07-24 00:10 -0400",
            commits: ["fb6ae68"],
            changes: ["Created the table and repository."],
          },
        ],
      },
      {
        id: "table-weight-logs",
        title: "weight_logs",
        kind: "table",
        tagline: "weight_kg on a timeline row",
        files: ["src/data/database.ts", "src/data/timelineRepository.ts"],
        summary:
          "1:1 with `timeline_entries`. Canonical kilograms. `getWeightKgAtOrBefore` reads the newest weight whose timeline start is at or before a chosen instant. `getLatestWeightKg` is unchanged.",
        versions: [
          {
            n: 1,
            name: "weight_logs",
            date: "2026-07-24 21:59 -0400",
            commits: ["ea4cc2b"],
            changes: ["Added the table."],
          },
          {
            n: 2,
            name: "Weight at a cutoff",
            date: "2026-11-16 11:01 -0500",
            commits: ["80f1155"],
            changes: [
              "Added a cutoff query so a backdated skill estimate uses the latest weight at or before its end time.",
            ],
          },
        ],
      },
      {
        id: "table-sleep-schedules",
        title: "sleep_schedules",
        kind: "table",
        tagline: "Nightly default windows",
        files: ["src/data/database.ts", "src/data/timelineRepository.ts"],
        summary: "Effective-dated start/end minutes for the sleep default toggle.",
        versions: [
          {
            n: 1,
            name: "sleep_schedules",
            date: "2026-07-26 15:56 -0400",
            commits: ["859b4aa"],
            changes: ["Added sleep schedules."],
          },
        ],
      },
      {
        id: "table-meal-logs",
        title: "meal_logs",
        kind: "table",
        tagline: "Meal header on a timeline row",
        files: ["src/data/database.ts", "src/data/nutritionRepository.ts"],
        summary: "v5 added `operation_id` and `saved_meal_id`.",
        versions: [
          {
            n: 1,
            name: "meal_logs",
            date: "2026-07-28 19:39 -0400",
            commits: ["241f556"],
            changes: ["Added meal logs."],
          },
          {
            n: 2,
            name: "meal_logs",
            date: "2026-10-03 22:31 -0400",
            commits: ["884864f"],
            changes: ["operation_id and saved_meal_id."],
          },
        ],
      },
      {
        id: "table-meal-items",
        title: "meal_items",
        kind: "table",
        tagline: "Food rows on a meal",
        files: ["src/data/nutritionMigration.ts", "src/data/nutritionRepository.ts"],
        summary: "Rebuilt in v5: source, external_id, snapshot vs reference, extra_nutrients_json. USDA `fdc_id` is gone.",
        versions: [
          {
            n: 1,
            name: "meal_items",
            date: "2026-07-28 19:39 -0400",
            commits: ["241f556"],
            changes: ["USDA `fdc_id` items."],
          },
          {
            n: 2,
            name: "meal_items",
            date: "2026-10-03 22:31 -0400",
            commits: ["884864f"],
            changes: ["v5 rebuild for multi-provider items."],
          },
        ],
      },
      {
        id: "table-nutrition-operations",
        title: "nutrition_operations",
        kind: "table",
        tagline: "Idempotent write receipts",
        files: ["src/data/nutritionMigration.ts"],
        summary: "operation_id / kind / pending|committed.",
        versions: [
          {
            n: 1,
            name: "nutrition_operations",
            date: "2026-10-03 22:31 -0400",
            commits: ["884864f"],
            changes: ["Added with v5."],
          },
        ],
      },
      {
        id: "table-custom-foods",
        title: "custom_foods",
        kind: "table",
        tagline: "User-created foods",
        files: ["src/data/nutritionMigration.ts", "src/data/nutritionCatalogRepository.ts"],
        summary: "Named foods with serving and macros.",
        versions: [
          {
            n: 1,
            name: "custom_foods",
            date: "2026-10-03 22:31 -0400",
            commits: ["884864f"],
            changes: ["Added with v5."],
          },
        ],
      },
      {
        id: "table-food-favourites",
        title: "food_favourites",
        kind: "table",
        tagline: "Starred exact servings",
        files: ["src/data/nutritionMigration.ts", "src/data/nutritionCatalogRepository.ts"],
        summary: "v6 adds `snapshot_json` so starred foods can open without the provider.",
        versions: [
          {
            n: 1,
            name: "food_favourites",
            date: "2026-10-03 22:31 -0400",
            commits: ["884864f"],
            changes: ["Added with v5."],
          },
          {
            n: 2,
            name: "food_favourites",
            date: "2026-10-04 23:27 -0400",
            commits: ["dde7751"],
            changes: ["snapshot_json so starred foods reopen."],
          },
        ],
      },
      {
        id: "table-saved-meals",
        title: "saved_meals",
        kind: "table",
        tagline: "Reusable meal templates",
        files: ["src/data/nutritionMigration.ts", "src/data/nutritionRepository.ts"],
        summary: "Header for saved templates, not diary logs.",
        versions: [
          {
            n: 1,
            name: "saved_meals",
            date: "2026-10-03 22:31 -0400",
            commits: ["884864f"],
            changes: ["Added with v5."],
          },
        ],
      },
      {
        id: "table-saved-meal-items",
        title: "saved_meal_items",
        kind: "table",
        tagline: "Items on a saved meal",
        files: ["src/data/nutritionMigration.ts"],
        summary: "Same snapshot/reference shape as `meal_items`.",
        versions: [
          {
            n: 1,
            name: "saved_meal_items",
            date: "2026-10-03 22:31 -0400",
            commits: ["884864f"],
            changes: ["Added with v5."],
          },
        ],
      },
      {
        id: "table-nutrition-workspace",
        title: "nutrition_workspace",
        kind: "table",
        tagline: "Singleton draft payload",
        files: ["src/data/nutritionMigration.ts"],
        summary: "Persists the in-progress nutrition workspace JSON.",
        versions: [
          {
            n: 1,
            name: "nutrition_workspace",
            date: "2026-10-03 22:31 -0400",
            commits: ["884864f"],
            changes: ["Added with v5."],
          },
        ],
      },
      {
        id: "table-conditioning-owner",
        title: "conditioning_owner",
        kind: "table",
        tagline: "Local singleton owner id",
        files: ["src/data/conditioningMigration.ts"],
        summary: "One-row owner key for templates and sessions.",
        versions: [
          {
            n: 1,
            name: "conditioning_owner",
            date: "2026-10-11 21:40 -0400",
            commits: ["3f111e1"],
            changes: ["Added with v7."],
          },
        ],
      },
      {
        id: "table-conditioning-templates",
        title: "conditioning_templates",
        kind: "table",
        tagline: "Saved workouts",
        files: ["src/data/conditioningMigration.ts", "src/data/conditioningRepository.ts"],
        summary: "time_interval / sprint / circuit templates with `config_json` snapshots.",
        versions: [
          {
            n: 1,
            name: "conditioning_templates",
            date: "2026-10-11 21:40 -0400",
            commits: ["3f111e1"],
            changes: ["Added with v7."],
          },
        ],
      },
      {
        id: "table-conditioning-template-stations",
        title: "conditioning_template_stations",
        kind: "table",
        tagline: "Circuit stations on a template",
        files: ["src/data/conditioningMigration.ts"],
        summary: "Ordered stations with completion type and recovery.",
        versions: [
          {
            n: 1,
            name: "conditioning_template_stations",
            date: "2026-10-11 21:40 -0400",
            commits: ["3f111e1"],
            changes: ["Added with v7."],
          },
        ],
      },
      {
        id: "table-conditioning-sessions",
        title: "conditioning_sessions",
        kind: "table",
        tagline: "Plans, live runs, manual logs",
        files: ["src/data/conditioningMigration.ts", "src/data/conditioningRepository.ts"],
        summary:
          "Status is explicit (planned / in_progress / finished_draft / completed / ended_early / cancelled). Canonical units: seconds, meters, kilograms. `snapshot_json` is immutable for logs.",
        guardrails: [
          "Do not rewrite stored distances when the unit setting changes (conditioning-data-and-units.mdc).",
          "Omitted RPE is null, not a default (conditioning-data-and-units.mdc).",
          "Planned stays planned until the user logs or runs it (calendar-session-state.mdc).",
        ],
        versions: [
          {
            n: 1,
            name: "conditioning_sessions",
            date: "2026-10-11 21:40 -0400",
            commits: ["3f111e1"],
            changes: ["Added with v7."],
          },
        ],
      },
      {
        id: "table-conditioning-segments",
        title: "conditioning_segments",
        kind: "table",
        tagline: "Pause/resume slices",
        files: ["src/data/conditioningMigration.ts"],
        summary: "Elapsed slices of a live session.",
        versions: [
          {
            n: 1,
            name: "conditioning_segments",
            date: "2026-10-11 21:40 -0400",
            commits: ["3f111e1"],
            changes: ["Added with v7."],
          },
        ],
      },
      {
        id: "table-conditioning-location-points",
        title: "conditioning_location_points",
        kind: "table",
        tagline: "GPS breadcrumb, accepted or rejected",
        files: ["src/data/conditioningMigration.ts", "src/data/conditioningSync.ts"],
        summary: "Filtered GPS points. Upload jobs acknowledge sequences.",
        versions: [
          {
            n: 1,
            name: "conditioning_location_points",
            date: "2026-10-11 21:40 -0400",
            commits: ["3f111e1"],
            changes: ["Added with v7."],
          },
        ],
      },
      {
        id: "table-conditioning-occurrences",
        title: "conditioning_occurrences",
        kind: "table",
        tagline: "Work/rest/station occurrences",
        files: ["src/data/conditioningMigration.ts"],
        summary: "Runner-produced work units with target and actual JSON.",
        versions: [
          {
            n: 1,
            name: "conditioning_occurrences",
            date: "2026-10-11 21:40 -0400",
            commits: ["3f111e1"],
            changes: ["Added with v7."],
          },
        ],
      },
      {
        id: "table-conditioning-splits",
        title: "conditioning_splits",
        kind: "table",
        tagline: "km and mile splits",
        files: ["src/data/conditioningMigration.ts", "src/conditioning/splits.ts"],
        summary: "Stores both kilometer and mile split rows.",
        versions: [
          {
            n: 1,
            name: "conditioning_splits",
            date: "2026-10-11 21:40 -0400",
            commits: ["3f111e1"],
            changes: ["Added with v7."],
          },
        ],
      },
      {
        id: "table-conditioning-upload-jobs",
        title: "conditioning_upload_jobs",
        kind: "table",
        tagline: "Retryable sync receipts",
        files: ["src/data/conditioningMigration.ts", "src/data/conditioningSync.ts"],
        summary: "Acknowledged point/occurrence/split counts so retries reuse batches.",
        versions: [
          {
            n: 1,
            name: "conditioning_upload_jobs",
            date: "2026-10-11 21:43 -0400",
            commits: ["3f111e1", "091cc58"],
            changes: ["Schema in v7; retryable upload (`091cc58`)."],
          },
        ],
      },
      {
        id: "table-conditioning-runner-state",
        title: "conditioning_runner_state",
        kind: "table",
        tagline: "Persisted timer state",
        files: ["src/data/conditioningMigration.ts", "src/conditioning/runner.ts"],
        summary: "JSON blob so an in-progress runner survives process death.",
        versions: [
          {
            n: 1,
            name: "conditioning_runner_state",
            date: "2026-10-11 21:40 -0400",
            commits: ["3f111e1"],
            changes: ["Added with v7."],
          },
        ],
      },
      {
        id: "table-strength-exercises",
        title: "strength_exercises",
        kind: "table",
        tagline: "Pinned catalog plus custom exercises",
        files: ["src/data/strengthMigration.ts", "src/strength/catalogSeed.ts"],
        summary:
          "Text-only Free Exercise DB pin (`curated-2026-11-15`) plus user-defined rows. Stable CAPS ids, upstream ids, equipment, muscles, and aliases. Photos are not stored.",
        versions: [
          {
            n: 1,
            name: "strength_exercises",
            date: "2026-11-15 15:38 -0500",
            commits: ["e0f5bb4"],
            changes: ["Seeded the curated catalog and allowed custom exercises."],
          },
        ],
      },
      {
        id: "table-strength-templates",
        title: "strength_templates",
        kind: "table",
        tagline: "Reusable workouts, archive instead of delete",
        files: ["src/data/strengthMigration.ts", "src/data/strengthRepository.ts"],
        summary:
          "Header plus `strength_template_exercises` and `strength_template_sets`. Archiving hides a template from Saved Workouts. Logs do not cascade.",
        versions: [
          {
            n: 1,
            name: "strength_templates",
            date: "2026-11-15 15:38 -0500",
            commits: ["e0f5bb4"],
            changes: ["Added template headers, ordered exercises, and target sets."],
          },
        ],
      },
      {
        id: "table-strength-sessions",
        title: "strength_sessions",
        kind: "table",
        tagline: "Logged title, times, focus, timeline row",
        files: ["src/data/strengthMigration.ts", "src/data/strengthRepository.ts"],
        summary:
          "One row per committed log. Stores start and end timestamps, the local end date, timezone, optional source template id, unrounded duration, and the versioned focus JSON. Child snapshots are `strength_session_exercises` and `strength_session_sets`. Load is kilograms. Null rest is omitted; zero rest is explicit. The same session id makes a retry a no-op.",
        guardrails: [
          "Do not drop a log when its template is archived or its catalog row is renamed.",
          "Write the session, sets, focus estimate, timeline row, and template create/update/archive in one transaction.",
        ],
        links: ["database:table-timeline-entries"],
        versions: [
          {
            n: 1,
            name: "strength_sessions",
            date: "2026-11-15 15:38 -0500",
            commits: ["e0f5bb4"],
            changes: [
              "Added session headers, exercise snapshots, and performed sets, including skipped sets.",
            ],
          },
        ],
      },
      {
        id: "table-skill-templates",
        title: "skill_templates",
        kind: "table",
        tagline: "Reusable skill sessions, archive instead of delete",
        files: ["src/data/skillMigration.ts", "src/data/skillRepository.ts"],
        summary:
          "Header plus ordered `skill_template_activities`. No date, weight, or calorie columns. Archiving hides a template from Saved Sessions. Logs do not cascade.",
        versions: [
          {
            n: 1,
            name: "skill_templates",
            date: "2026-11-16 11:01 -0500",
            commits: ["80f1155"],
            changes: ["Added template headers and ordered activity settings."],
          },
        ],
      },
      {
        id: "table-skill-sessions",
        title: "skill_sessions",
        kind: "table",
        tagline: "Logged title, end date, focus, calorie snapshot",
        files: ["src/data/skillMigration.ts", "src/data/skillRepository.ts"],
        summary:
          "One row per committed log. Stores start and end timestamps, the local end date, timezone, optional source template id, elapsed seconds, focus, unrounded kcal, weight basis, and estimator version. Child snapshots are `skill_session_activities`. The same session id makes a retry a no-op. The timeline row is kind `skill`.",
        guardrails: [
          "Do not drop or rewrite a log when its template is edited, archived, or when a later weight is recorded.",
          "Write the timeline row, session, and activity snapshots in one transaction. Template saves stay in their own transaction.",
        ],
        links: ["database:table-timeline-entries", "database:table-weight-logs"],
        versions: [
          {
            n: 1,
            name: "skill_sessions",
            date: "2026-11-16 11:01 -0500",
            commits: ["80f1155"],
            changes: [
              "Added session headers and activity snapshots, including the MET and RPE multiplier used for each estimate.",
            ],
          },
        ],
      },

{
  "id": "recovery-storage",
  "title": "Recovery storage",
  "kind": "group",
  "tagline": "Device-local identity, audit history and atomic native imports",
  "summary": "Eight additive v10 tables. No authenticated account/backend or database encryption is introduced. See docs/recovery-progress.md for full relational/rollback/deletion consequences.",
  "files": [
    "src/data/recoveryMigration.ts",
    "src/data/recoveryRepository.ts"
  ],
  "links": [
    "home:recovery-panel",
    "home:progress-panel",
    "architecture:health-adapters"
  ],
  "children": [
    {
      "id": "table-recovery-owner",
      "title": "recovery_owner",
      "kind": "table",
      "tagline": "One explicit device-local parent, not authenticated identity.",
      "summary": "One explicit device-local parent, not authenticated identity.",
      "files": [
        "src/data/recoveryMigration.ts",
        "src/data/recoveryRepository.ts"
      ],
      "versions": [
        {
          "n": 1,
          "name": "recovery_owner",
          "date": "2026-11-21 21:31 -0500",
          "commits": [
            "ec03ac1"
          ],
          "changes": [
            "One explicit device-local parent, not authenticated identity."
          ]
        }
      ]
    },
    {
      "id": "table-daily-questionnaires",
      "title": "daily_questionnaires",
      "kind": "table",
      "tagline": "PK(owner_id,local_date), active response/timezone/status/revision and original JSON.",
      "summary": "PK(owner_id,local_date), owner FK, active response/timezone/status/revision and response_json. Optional sriVersion/awakeningsAtLeast JSON fields preserve original v1 versus weighted v2 and 10+ lower bounds; no DDL change (schema 10).",
      "files": [
        "src/data/recoveryMigration.ts",
        "src/data/recoveryRepository.ts"
      ],
      "versions": [
  {
    "n": 1,
    "name": "daily_questionnaires",
    "date": "2026-11-21 21:31 -0500",
    "commits": [
      "ec03ac1"
    ],
    "changes": [
      "PK(owner_id,local_date), active response/timezone/status/revision and original JSON."
    ]
  },
  {
    "n": 2,
    "name": "daily_questionnaires",
    "date": "2026-11-22 11:32 -0500",
    "commits": [
      "cb32262"
    ],
    "request": "Revise questionnaire controls/history/SRI, readable dates and Progress overlay/navigation/legend/axes.",
    "changes": [
      "Save/edit candidates use sri_v2; legacy missing-version/v1 stays original until saved.",
      "Store censored 10+ marker alongside numeric lower bound without truncating exact legacy values."
    ]
  }
]
    },
    {
      "id": "table-questionnaire-revisions",
      "title": "questionnaire_revisions",
      "kind": "table",
      "tagline": "PK(owner_id,local_date,revision), composite questionnaire FK with cascade on explicit parent deletion.",
      "summary": "PK(owner_id,local_date,revision), composite active-questionnaire FK with ON DELETE CASCADE. Transactional append retains each save and its model/lower-bound fields in JSON; existing revisions remain intact.",
      "files": [
        "src/data/recoveryMigration.ts",
        "src/data/recoveryRepository.ts"
      ],
      "versions": [
  {
    "n": 1,
    "name": "questionnaire_revisions",
    "date": "2026-11-21 21:31 -0500",
    "commits": [
      "ec03ac1"
    ],
    "changes": [
      "PK(owner_id,local_date,revision), composite questionnaire FK with cascade on explicit parent deletion."
    ]
  },
  {
    "n": 2,
    "name": "questionnaire_revisions",
    "date": "2026-11-22 11:32 -0500",
    "commits": [
      "cb32262"
    ],
    "request": "Revise questionnaire controls/history/SRI, readable dates and Progress overlay/navigation/legend/axes.",
    "changes": [
      "Append versioned response revisions transactionally with active save; no table migration."
    ]
  }
]
    },
    {
      "id": "table-health-measurements",
      "title": "health_measurements",
      "kind": "table",
      "tagline": "PK(owner,platform,external_id,metric), normalized provenance JSON and indexed acquisition/day.",
      "summary": "PK(owner,platform,external_id,metric), normalized provenance JSON and indexed acquisition/day.",
      "files": [
        "src/data/recoveryMigration.ts",
        "src/data/recoveryRepository.ts"
      ],
      "versions": [
        {
          "n": 1,
          "name": "health_measurements",
          "date": "2026-11-21 21:31 -0500",
          "commits": [
            "ec03ac1"
          ],
          "changes": [
            "PK(owner,platform,external_id,metric), normalized provenance JSON and indexed acquisition/day."
          ]
        }
      ]
    },
    {
      "id": "table-recovery-snapshots",
      "title": "recovery_snapshots",
      "kind": "table",
      "tagline": "PK(owner,date), reproducible SRI/version/objective coverage and nullable ORI.",
      "summary": "PK(owner_id,local_date), owner FK independent of questionnaire. Derived JSON preserves SRI original/weighted model identity and CAPS ORI model/provenance separately. Health recomputation retains legacy SRI meaning; schema remains 10.",
      "files": [
        "src/data/recoveryMigration.ts",
        "src/data/recoveryRepository.ts"
      ],
      "versions": [
  {
    "n": 1,
    "name": "recovery_snapshots",
    "date": "2026-11-21 21:31 -0500",
    "commits": [
      "ec03ac1"
    ],
    "changes": [
      "PK(owner,date), reproducible SRI/version/objective coverage and nullable ORI."
    ]
  },
  {
    "n": 2,
    "name": "recovery_snapshots",
    "date": "2026-11-22 00:06 -0500",
    "commits": [
      "1a2e0fb"
    ],
    "changes": [
      "User explicitly requests CAPS-owned biometric ORI instead of vendor scores.",
      "Implement caps_ori_v1 with explicit weights/transforms, source-specific baselines, contributor coverage and no manual inputs.",
      "Persist numeric scores/provenance and partition historical chart source/model identities; experimental, not independently validated."
    ]
  },
  {
    "n": 3,
    "name": "recovery_snapshots",
    "date": "2026-11-22 11:32 -0500",
    "commits": [
      "cb32262"
    ],
    "request": "Revise questionnaire controls/history/SRI, readable dates and Progress overlay/navigation/legend/axes.",
    "changes": [
      "Derive SRI version from response (missing defaults v1); distinguish original and weighted Progress series."
    ]
  }
]
    },
    {
      "id": "table-metric-baselines",
      "title": "metric_baselines",
      "kind": "table",
      "tagline": "PK(owner,date,comparable_key), prior-window mean/SD/count/Z/CV.",
      "summary": "PK(owner,date,comparable_key), prior-window mean/SD/count/Z/CV.",
      "files": [
        "src/data/recoveryMigration.ts",
        "src/data/recoveryRepository.ts"
      ],
      "versions": [
        {
          "n": 1,
          "name": "metric_baselines",
          "date": "2026-11-21 21:31 -0500",
          "commits": [
            "ec03ac1"
          ],
          "changes": [
            "PK(owner,date,comparable_key), prior-window mean/SD/count/Z/CV."
          ]
        }
      ]
    },
    {
      "id": "table-health-connections",
      "title": "health_connections",
      "kind": "table",
      "tagline": "PK(owner,platform), read capability/sync state and atomic native cursor/sleep cache.",
      "summary": "PK(owner,platform), read capability/sync state and atomic native cursor/sleep cache.",
      "files": [
        "src/data/recoveryMigration.ts",
        "src/data/recoveryRepository.ts"
      ],
      "versions": [
        {
          "n": 1,
          "name": "health_connections",
          "date": "2026-11-21 21:31 -0500",
          "commits": [
            "ec03ac1"
          ],
          "changes": [
            "PK(owner,platform), read capability/sync state and atomic native cursor/sleep cache."
          ]
        }
      ]
    },
    {
      "id": "table-recovery-preferences",
      "title": "recovery_preferences",
      "kind": "table",
      "tagline": "One owner row storing per-metric source preference.",
      "summary": "One owner row storing per-metric source preference.",
      "files": [
        "src/data/recoveryMigration.ts",
        "src/data/recoveryRepository.ts"
      ],
      "versions": [
        {
          "n": 1,
          "name": "recovery_preferences",
          "date": "2026-11-21 21:31 -0500",
          "commits": [
            "ec03ac1"
          ],
          "changes": [
            "One owner row storing per-metric source preference."
          ]
        }
      ]
    }
  ]
},
      {
        "id": "athlete-profile-kv",
        "title": "Athlete profile KV storage",
        "kind": "data",
        "status": "active",
        "tagline": "Separate ExpoSQLiteStorage settings, not a caps.db table",
        "files": [
          "src/data/athleteProfileStorage.ts",
          "src/utils/athleteProfile.ts",
          "src/state/AppStateContext.tsx"
        ],
        "summary": "The bundled expo-sqlite/kv-store persists JSON under key caps.athlete-profile.v1 in its separate ExpoSQLiteStorage database/storage table. Payload contains names, legacy age, dateOfBirth, sex, heightCm and sports; validated hydration ignores malformed fields. Bodyweight is explicitly excluded and remains in caps.db weight_logs joined to timeline_entries. Serialized partial profile writes preserve unrelated fields; failed writes retain the previous committed profile. caps.db user_version remains 10 with no migration.",
        "links": [
          "architecture:app-state",
          "settings:athlete-info-screen",
          "database:table-weight-logs"
        ],
        "guardrails": [
          "Do not describe ExpoSQLiteStorage/storage as a caps.db relational table or persist weight in the profile payload.",
          "Keep DOB as the canonical date field; a legacy age must not silently invent a saved birthday."
        ],
        "versions": [
          {
            "n": 1,
            "name": "Athlete profile KV storage",
            "date": "2026-11-23 12:48 -0500",
            "commits": [
              "65e148a"
            ],
            "request": "Centralize biometric editing in modals, use intuitive date/settings navigation, and share training hub components.",
            "changes": [
              "Persist existing non-weight profile fields through the bundled SQLite KV store without introducing dependencies or relational migrations.",
              "Exclude weight from profile JSON and keep all weight history/timestamps in existing tables."
            ]
          }
        ]
      },
],
  },
};
