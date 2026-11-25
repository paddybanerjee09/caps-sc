CAPS.trees.skill = {
  id: "skill",
  title: "Skills Training",
  summary:
    "The Skills Training tab logs sessions built from rep or timed activities. Each log stores a focus and a versioned calorie estimate. Fatigue, nutrition timing, and scheduling the other tabs around skill work are still unbuilt.",
  rules: ["ui-style-guide.mdc"],
  root: {
    id: "skill-screen",
    title: "SkillTrainingScreen",
    kind: "screen",
    status: "active",
    tagline: "Shared month, Log Session and Saved Workouts",
    files: ["src/screens/SkillScreen.tsx", "src/state/SkillWorkspaceContext.tsx"],
    entry: "Bottom tab \"Skills Training\" (boxing-glove icon), second from the left.",
    summary:
      "Month calendar, focus legend, Log Session and SavedWorkouts. The compact composer opens a searchable activity picker and a Reps/Rounds editor. Independent saved templates and session snapshots retain calendar/focus behavior; schema v11 preserves legacy timed activities and adds real reps.",
    guardrails: [
      "Use shared subscreen bars, decimal weight/load inputs and the shared Log Time modal; preserve domain validation (user correction, 20 November 2026).",
      "The file is `SkillScreen.tsx`, the component is `SkillTrainingScreen`, and the route key is `skill`. Keep all three in sync with `Screens.tsx` and `routes.ts`.",
      "Home timeline blocks stay on `timelineCategories.skill`. Only the Skill month marker uses the session focus colour.",
      "Saving a template, removing a template, and logging a session are separate writes. Logging does not change the template."
    ],
    links: [
      "architecture:bottom-tabs",
      "architecture:routes",
      "architecture:log-time-changer",
      "conditioning:monthly-calendar",
      "database:table-skill-sessions",
      "database:table-skill-templates",
      "conditioning:saved-workouts",
      "architecture:training-session-actions"
    ],
    versions: [
          {
            "n": 1,
            "name": "Sport Training",
            "date": "2026-06-30 17:54 -0400",
            "commits": [
              "e9ddbfb"
            ],
            "changes": [
              "Added the Expo Router boilerplate tab `app/(tabs)/sport-training.tsx` with a centered \"Sport Training\" title.",
              "Tab order was Nutrition, Sport Training, Home, S&C, Progress. The tab used the SF Symbol `figure.boxing`."
            ]
          },
          {
            "n": 2,
            "name": "Sport",
            "date": "2026-07-02 00:35 -0400",
            "commits": [
              "f0f5834"
            ],
            "changes": [
              "Removed Expo Router. Custom state navigation replaced it (`routes.ts`, `AppNavigator`, `Screens.tsx`).",
              "The route key became `sportTraining` and the label was shortened to \"Sport\". The screen rendered inline in `Screens.tsx` as `<Screen title=\"Sport\" />`.",
              "The tab icon became the MaterialCommunityIcons `boxing-glove`."
            ]
          },
          {
            "n": 3,
            "name": "SportScreen",
            "date": "2026-07-18 13:55 -0400",
            "commits": [
              "edd48ce"
            ],
            "changes": [
              "Moved into its own file, `src/screens/SportScreen.tsx`. It was still a title-only placeholder."
            ]
          },
          {
            "n": 4,
            "name": "SportScreen",
            "date": "2026-07-22 02:53 -0400",
            "commits": [
              "ad01bfe"
            ],
            "changes": [
              "Centered the title (`centerTitle`) as part of the app-wide UI pass."
            ]
          },
          {
            "n": 5,
            "name": "SkillTrainingScreen",
            "date": "2026-07-22 16:45 -0400",
            "commits": [
              "59dd4e8"
            ],
            "changes": [
              "Deleted `SportScreen.tsx` and replaced it with `src/screens/SkillScreen.tsx`, which exports `SkillTrainingScreen`.",
              "Changed the route key from `sportTraining` to `skill` and the tab label to \"Skills Training\".",
              "The same commit split the S&C tab into Strength and Conditioning."
            ]
          },
          {
            "n": 6,
            "name": "Skill logging",
            "date": "2026-11-16 11:02 -0500",
            "commits": [
              "80f1155",
              "45648a2"
            ],
            "request": "Build the Skills Training tab from the approved plan, using RPE instead of RIR.",
            "changes": [
              "The hub shows the month, a focus legend, Build Skill Session, and an inline Saved Sessions list.",
              "Logged rows open detail by session id and keep the selected day when you go back.",
              "Schema version 9 stores templates, session snapshots, and a skill timeline row."
            ]
          },
          {
            "n": 7,
            "name": "SkillTrainingScreen",
            "date": "2026-11-22 00:29 -0500",
            "commits": [
              "40f02f4"
            ],
            "request": "Remove filler copy throughout CAPS and compact Recovery/questionnaire/Progress.",
            "changes": [
              "Remove generic subtitle and standardize -- empty values.",
              "Presentation only; data, calculations and validation remain."
            ]
          },
          {
            "n": 8,
            "name": "SkillTrainingScreen",
            "date": "2026-11-23 12:39 -0500",
            "commits": [
              "a09ebfe"
            ],
            "request": "Centralize biometric editing in modals, use intuitive date/settings navigation, and share training hub components.",
            "changes": [
              "Use the shared saved-workout expander/cards and uniform Free Session/Create Session labels and controls.",
              "Keep the existing Skill builder for both launches; retain its independent Save/Log actions and saved-template workflow."
            ]
          },
          {
            "n": 9,
            "name": "SkillTrainingScreen",
            "date": "2026-11-24 18:20 -0500",
            "commits": [
              "6dfbf84"
            ],
            "request": "Simplify all training hub actions and expose Save/Unsave state in Skill and Strength logging.",
            "changes": [
              "Remove Create Session and rename Free Session to Log Session using the shared single-action component.",
              "Preserve saved-workout IDs and the existing builder, calendar and focus behavior."
            ]
          },
          {
            "n": 10,
            "name": "Skill activity composition",
            "date": "2026-11-24 23:06 -0500",
            "request": "Compact Skills logging with a separate activity search and direct Reps/Rounds parameters using shared controls.",
            "changes": [
              "Replace inline activity configuration with a composer, separate search and compact Reps/Rounds editor.",
              "Preserve saved-template state, raw drafts, history and local end-date placement."
            ],
            "commits": [
              "2ca4dbd"
            ]
          }
        ],
    children: [
      {
        id: "skill-month",
        title: "MonthlyTimelineComponent",
        ref: "conditioning:monthly-calendar",
      },
      {
        id: "skill-builder",
        title: "SkillSessionBuilderScreen",
        kind: "subscreen",
        status: "active",
        tagline: "Compact composer and selected activities",
        files: ["src/screens/skill/SkillSessionBuilderScreen.tsx"],
        summary:
          "Session title with a small estimated-time subtitle, an Activities card with Add Activities and selected rows, and fixed Cancel/Save-Unsave/Log footer. Summary and inline Add Activity cards are removed. Save/Unsave, failure recovery and draft guards remain independent from logging.",
        guardrails: [
          "Start time is the chosen end time minus elapsed seconds. The calendar day is the local end date, including when the session starts the day before.",
          "Reject a future end time again when logging. The time control's maximum is not the only check.",
          "A failed log stays on the builder and retries with the same session id.",
          "Display only Save or Unsave for template state, and keep pending/failure guards; archiving must preserve logged snapshots (user request, 24 November 2026).",
          "Use direct numeric text fields; never restore parameter steppers or presets (user correction, 24 November 2026).",
          "Keep raw activity inputs and parent drafts across picker/editor/tab navigation; apply only validated active parameters."
        ],
        links: ["architecture:log-time-changer"],
        versions: [
          {
            "n": 1,
            "name": "Skill session builder",
            "date": "2026-11-16 11:02 -0500",
            "commits": [
              "45648a2"
            ],
            "request": "Build the Skills Training tab from the approved plan, using RPE instead of RIR.",
            "changes": [
              "Added inline activity cards with steppers, presets, and up/down reordering.",
              "Save writes a template immediately. Saved asks before removing it. Log does not change the template."
            ]
          },
          {
            "n": 2,
            "name": "SkillSessionBuilderScreen",
            "date": "2026-11-20 17:46 -0500",
            "request": "Audit all five tabs: simple weight input, compact scrolling log-time modal, safe consistent subscreen bars and branch navigation.",
            "changes": [
              "Header-only clock modal replaces time card/day increments.",
              "Shared safe branch-close header and fixed footer preserve template/log actions and discard guard."
            ],
            "commits": [
              "d56e731"
            ]
          },
          {
            "n": 3,
            "name": "SkillSessionBuilderScreen",
            "date": "2026-11-22 00:29 -0500",
            "commits": [
              "40f02f4"
            ],
            "request": "Remove filler copy throughout CAPS and compact Recovery/questionnaire/Progress.",
            "changes": [
              "Remove repeated RPE definition; retain actual weight basis and units.",
              "Presentation only; data, calculations and validation remain."
            ]
          },
          {
            "n": 4,
            "name": "SkillSessionBuilderScreen",
            "date": "2026-11-24 18:20 -0500",
            "commits": [
              "6dfbf84"
            ],
            "request": "Show a persistent Save/Unsave action that changes the reusable workout state.",
            "changes": [
              "Show Save or Unsave in the fixed footer and immediately persist/archive templates on press.",
              "Keep fingerprint-based edited state, detach on archive, and preserve historical log snapshots.",
              "Guard rapid actions, draft edits and exits while saving; preserve state and errors for retry."
            ]
          },
          {
            "n": 5,
            "name": "Compact activity composer",
            "date": "2026-11-24 23:06 -0500",
            "request": "Compact Skills logging with a separate activity search and direct Reps/Rounds parameters using shared controls.",
            "changes": [
              "Move estimated time below the title input and remove Summary.",
              "Add searchable activity selection and compact nested configuration.",
              "Keep Save/Unsave locks, guarded exits and retry drafts."
            ],
            "commits": [
              "2ca4dbd"
            ]
          }
        ],

        children: [
          {
            "id": "skill-add-activities",
            "title": "AddSkillActivitiesScreen",
            "kind": "subscreen",
            "status": "active",
            "tagline": "Search the loggable activity catalog",
            "files": [
              "src/screens/skill/AddSkillActivitiesScreen.tsx"
            ],
            "summary": "Search all fifteen existing catalog activity types. Selection opens configuration; Back preserves the session/search and X exits through branch guards.",
            "versions": [
          {
            "n": 1,
            "name": "Add Activities",
            "date": "2026-11-24 23:06 -0500",
            "request": "Add activities using a separate searchable screen, following Strength composition.",
            "changes": [
              "Replace inline Add Activity chips with virtualized search.",
              "Configure a chosen activity before adding it to the session."
            ],
            "commits": [
              "2ca4dbd"
            ]
          }
        ],
            "children": [
              {
                "id": "skill-activity-editor",
                "title": "SkillActivityEditorScreen",
                "kind": "subscreen",
                "status": "active",
                "tagline": "Direct Reps / Rounds parameters",
                "files": [
                  "src/screens/skill/SkillActivityEditorScreen.tsx",
                  "src/skill/activityForm.ts"
                ],
                "summary": "Reuse Home’s SegmentedSelector for Reps/Rounds and the shared TrainingNumberField. Reps has Sets/Reps/RPE/optional rest; Rounds has work/rest seconds, rounds and optional RPE. Sparring/rolling keep intensity modes. Raw category values survive switching, invalid text stays editable, Add returns to the composer and Back/X use discard guards.",
                "guardrails": [
                  "Do not add increment/decrement controls (user correction, 24 November 2026).",
                  "Do not silently convert untouched legacy duration records; explicit editor completion may represent them as one round of the original work time."
                ],
                "versions": [
          {
            "n": 1,
            "name": "Reps and Rounds activity editor",
            "date": "2026-11-24 23:06 -0500",
            "request": "Reuse Strength-style reps parameters and Conditioning-style rounds with the Home selector.",
            "changes": [
              "Add compact direct input fields and reuse the existing Home segmented control.",
              "Keep raw input drafts across navigation and preserve legacy values until explicit apply."
            ],
            "commits": [
              "2ca4dbd"
            ]
          }
        ]
              ,
        links: [
          "architecture:training-number-field",
          "nutrition:segmented-selector"
        ],
      }
            ]
          }
        ],
      },
      {
        id: "skill-detail",
        title: "SkillSessionDetailScreen",
        kind: "subscreen",
        status: "active",
        tagline: "Read-only logged snapshot",
        files: ["src/screens/skill/SkillSessionDetailScreen.tsx"],
        summary:
          "Shows the stored title, start, end, focus, elapsed time, estimated calories, weight basis, and ordered activities. It does not recompute the estimate.",
        versions: [
          {
            "n": 1,
            "name": "Skill session detail",
            "date": "2026-11-16 11:02 -0500",
            "commits": [
              "45648a2"
            ],
            "changes": [
              "Added the read-only session screen opened from a calendar row."
            ]
          },
          {
            "n": 2,
            "name": "SkillSessionDetailScreen",
            "date": "2026-11-20 17:46 -0500",
            "request": "Audit all five tabs: simple weight input, compact scrolling log-time modal, safe consistent subscreen bars and branch navigation.",
            "changes": [
              "Shared safe centered header and fixed depth-aware footer."
            ],
            "commits": [
              "d56e731"
            ]
          },
          {
            "n": 3,
            "name": "SkillSessionDetailScreen",
            "date": "2026-11-22 11:32 -0500",
            "commits": [
              "75c7dd4"
            ],
            "request": "Revise questionnaire controls/history/SRI, readable dates and Progress overlay/navigation/legend/axes.",
            "changes": [
              "Format saved session start/end with shared readable date helper."
            ]
          },
          {
            "n": 4,
            "name": "Stored Skill snapshot display",
            "date": "2026-11-24 23:06 -0500",
            "request": "Compact Skills logging with a separate activity search and direct Reps/Rounds parameters using shared controls.",
            "changes": [
              "Display stored work/rest time for each activity, including rep estimates.",
              "Show configured sets/reps and numeric RPE without recomputing historical estimates."
            ],
            "commits": [
              "2ca4dbd"
            ]
          }
        ],
      },
      {
        id: "skill-energy",
        title: "Skill calorie model",
        kind: "logic",
        status: "active",
        tagline: "skill-energy-v2-reps; stored v1 preserved",
        files: [
          "src/skill/catalog.ts",
          "src/skill/energy.ts",
          "src/skill/focus.ts",
          "src/skill/timing.ts",
          "src/data/skillRepsMigration.ts"
        ],
        summary:
          "Fifteen activities retain their MET/focus rules. New rep activities reuse Strength’s three-second rep and omitted-rest assumptions for estimated time; numeric RPE maps to the existing bands. New snapshots store skill-energy-v2-reps; old headers and activity estimates are copied unchanged by v11 migration and never recalculated.",
        guardrails: [
          "Easy is RPE 6 or below (0.80), Moderate is RPE 7–8 (1.00), and Hard is RPE 9–10 (1.10).",
          "Store the unrounded kcal, weight basis, and estimator version on the log. Do not rewrite them when the catalog or a later weigh-in changes.",
        ],
        versions: [
          {
            "n": 1,
            "name": "skill-energy-v1",
            "date": "2026-11-16 11:01 -0500",
            "commits": [
              "80f1155"
            ],
            "request": "Build the Skills Training tab from the approved plan, using RPE instead of RIR.",
            "changes": [
              "Added the activity catalog, focus colours, and the gross-kcal estimator.",
              "The five-round medium boxing sparring fixture is 153.75 kcal, shown as 154 kcal."
            ]
          },
          {
            "n": 2,
            "name": "Versioned rep estimates and v11 snapshots",
            "date": "2026-11-24 23:06 -0500",
            "request": "Compact Skills logging with a separate activity search and direct Reps/Rounds parameters using shared controls.",
            "changes": [
              "Add real reps timing mode, sets/reps/numeric RPE and optional between-set rest to template/session activity tables.",
              "Reuse Strength duration assumptions and record the new estimator version without changing historical estimates.",
              "Migrate legacy child rows transactionally with stable keys, foreign-key checks, rollback/retry and current-version repair coverage."
            ],
            "commits": [
              "2ca4dbd"
            ]
          }
        ],
      },
      {
        id: "skill-planned",
        title: "Unbuilt skill planning",
        kind: "group",
        status: "planned",
        tagline: "Fatigue and S&C scheduling",
        files: ["README.md"],
        summary:
          "The README still describes fatigue, nutrition timing, and recovery estimates, and organizing Strength and Conditioning around skill work. This release does not do that.",
        versions: [
          {
            n: 1,
            name: "Tracking Skill Work",
            date: "2026-07-02 00:47 -0400",
            commits: ["0b97b10"],
            changes: [
              "The README listed skill work types to track and planned fatigue and recovery estimates.",
            ],
          },
          {
            n: 2,
            name: "Custom Skill Work",
            date: "2026-07-28 12:26 -0400",
            commits: ["41b5c4d"],
            changes: [
              "The README replaced fixed skill types with user-built sessions of configured activities.",
            ],
          },
        ],
      },
      {
        "id": "skill-saved-workouts",
        "title": "SavedWorkouts",
        "ref": "conditioning:saved-workouts"
      },
      {
        "id": "skill-session-actions",
        "title": "TrainingSessionActions",
        "ref": "architecture:training-session-actions"
      },
    ],
  },
};
