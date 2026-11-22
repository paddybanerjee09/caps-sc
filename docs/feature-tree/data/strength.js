CAPS.trees.strength = {
  id: "strength",
  title: "Strength",
  summary:
    "The Strength tab for logging lifting sessions, saved workouts, and a heuristic focus estimate. Periodization around competition dates is still unbuilt. A modal-based Strength v1 existed on the reverted Aug–Sep 2026 lineage and was removed from main on 2026-10-02.",
  rules: ["ui-style-guide.mdc"],
  root: {
    id: "strength-screen",
    title: "StrengthTrainingScreen",
    kind: "screen",
    status: "active",
    tagline: "Month, log, create, and saved workouts",
    files: ["src/screens/StrengthTrainingScreen.tsx", "src/state/StrengthWorkspaceContext.tsx"],
    entry: "Bottom tab \"Strength\" (barbell-outline icon), second from the right.",
    summary:
      "Month calendar of logged sessions, then Log Workout, Create Workout, and a Saved Workouts list. The parent supplies MonthEvent rows. Marker color is the stored primary focus, or neutral when the estimate has no primary. Home still uses the Strength category color.",
    guardrails: [
      "Use shared subscreen bars, decimal weight/load inputs and the shared Log Time modal; preserve domain validation (user correction, 20 November 2026).",
      "Do not restore the reverted v1 modal stack (reverted 2026-10-02).",
      "The file is `StrengthTrainingScreen.tsx`, the component is `StrengthTrainingScreen`, and the route key is `strength`. Keep all three in sync with `Screens.tsx` and `routes.ts`.",
      "Home timeline blocks stay on `timelineCategories.strength`. Only the Strength month marker uses the session focus color."
    ],
    links: [
      "architecture:bottom-tabs",
      "architecture:routes",
      "architecture:log-time-changer",
      "conditioning:monthly-calendar",
      "database:table-strength-sessions",
    ],
    versions: [
  {
    "n": 1,
    "name": "S&C",
    "date": "2026-06-30 17:54 -0400",
    "commits": [
      "e9ddbfb"
    ],
    "changes": [
      "Added the Expo Router boilerplate tab `app/(tabs)/strength-conditioning.tsx` with a centered \"S&C\" title.",
      "Tab order was Nutrition, Sport Training, Home, S&C, Progress. The tab used the SF Symbol `dumbbell`."
    ]
  },
  {
    "n": 2,
    "name": "S&C",
    "date": "2026-07-02 00:35 -0400",
    "commits": [
      "f0f5834"
    ],
    "changes": [
      "Removed Expo Router. Custom state navigation replaced it (`routes.ts`, `AppNavigator`, `Screens.tsx`).",
      "The route key became `strength` and the label stayed \"S&C\". The screen rendered inline in `Screens.tsx` as `<Screen title=\"S&C\" />`.",
      "The tab icon became the MaterialCommunityIcons `dumbbell`."
    ]
  },
  {
    "n": 3,
    "name": "StrengthConditioningScreen",
    "date": "2026-07-18 13:55 -0400",
    "commits": [
      "edd48ce"
    ],
    "changes": [
      "Moved into its own file, `src/screens/StrengthConditioningScreen.tsx`. It was still a title-only placeholder."
    ]
  },
  {
    "n": 4,
    "name": "Strength",
    "date": "2026-07-18 15:32 -0400",
    "commits": [
      "dd88e65"
    ],
    "request": "Change the S&C tab into Strength. Keep the strength icon the same. Change the Progress tab into Conditioning with a running-man icon.",
    "changes": [
      "Renamed the tab label from \"S&C\" to \"Strength\". The Progress tab became Conditioning in the same commit.",
      "Switched the tab icon from MaterialCommunityIcons `dumbbell` to Ionicons `barbell-outline`."
    ]
  },
  {
    "n": 5,
    "name": "StrengthConditioningScreen",
    "date": "2026-07-22 02:53 -0400",
    "commits": [
      "ad01bfe"
    ],
    "changes": [
      "Centered the title (`centerTitle`) as part of the app-wide UI pass."
    ]
  },
  {
    "n": 6,
    "name": "StrengthTrainingScreen",
    "date": "2026-07-22 16:45 -0400",
    "commits": [
      "59dd4e8"
    ],
    "changes": [
      "Deleted `StrengthConditioningScreen.tsx` and replaced it with `src/screens/StrengthTrainingScreen.tsx`, which exports `StrengthTrainingScreen`.",
      "The screen stayed a centered-title placeholder. The same commit added SQLite and split the remaining combined S&C file away from Skills."
    ]
  },
  {
    "n": 7,
    "name": "Strength logging",
    "date": "2026-11-15 15:39 -0500",
    "commits": [
      "21d635f"
    ],
    "request": "Execute the 15 Nov 2026 strength implementation plan.",
    "changes": [
      "Replaced the title placeholder with the month calendar, Log Workout, Create Workout, and Saved Workouts.",
      "Logging and template creation share one builder. The draft stays in the strength workspace across the exercise editor and focus screen.",
      "Turning Save Workout off archives the source template when the log commits. Past logs keep their own snapshots."
    ]
  },
  {
    "n": 8,
    "name": "Strength logging",
    "date": "2026-11-15 15:48 -0500",
    "commits": [
      "36bac02"
    ],
    "request": "Apply the pre-build Strength UI review.",
    "changes": [
      "Month markers use status logged so completed sessions are filled.",
      "The workout table keeps the exercise name on screen and wraps Weight, Sets, Reps, RPE, Rest, and Notes.",
      "Log mode can start from a saved workout. Turning Save Workout off explains that the calendar log stays."
    ]
  },
  {
    "n": 9,
    "name": "StrengthTrainingScreen",
    "date": "2026-11-22 00:29 -0500",
    "commits": [
      "40f02f4"
    ],
    "request": "Remove filler copy throughout CAPS and compact Recovery/questionnaire/Progress.",
    "changes": [
      "Remove generic subtitle; standardized -- empty display.",
      "Presentation only; data, calculations and validation remain."
    ]
  }
],
    children: [
      {
        id: "strength-month",
        title: "MonthlyTimelineComponent",
        ref: "conditioning:monthly-calendar",
      },
      {
        id: "strength-builder",
        title: "WorkoutBuilderScreen",
        kind: "subscreen",
        status: "active",
        tagline: "Template mode and log mode",
        files: ["src/screens/strength/WorkoutBuilderScreen.tsx"],
        summary:
          "Search sits in a bounded list above the workout table and focus button. Log mode shows the date, Ends at, and estimated duration. The footer is Cancel, Save Workout, and Log Workout.",
        guardrails: [
          "Do not nest the exercise search FlatList in a vertical ScrollView.",
          "Omitted rest and explicit zero rest stay distinct (implementation plan, 15 Nov 2026).",
          "An explicit bodyweight or assistance choice satisfies the required weight. External load is per implement.",
        ],
        links: ["architecture:log-time-changer"],
        versions: [
          {
            "n": 1,
            "name": "Workout builder",
            "date": "2026-11-15 15:39 -0500",
            "commits": [
              "21d635f"
            ],
            "changes": [
              "Added template and log modes, exercise search, the set table, and the save-workout toggle."
            ]
          },
          {
            "n": 2,
            "name": "Workout builder",
            "date": "2026-11-15 15:48 -0500",
            "commits": [
              "36bac02"
            ],
            "changes": [
              "Added From saved workout inside the log, stacked exercise rows, and a full-width Log Workout button."
            ]
          },
          {
            "n": 3,
            "name": "Workout builder",
            "date": "2026-11-15 15:57 -0500",
            "commits": [
              "6bc5a4c"
            ],
            "request": "Apply the post-build Strength UI review.",
            "changes": [
              "The log scrolls between a fixed title area and a fixed footer so Log Workout stays above the tab bar.",
              "Logging that removes a saved workout asks first.",
              "Removing an exercise from the table asks first."
            ]
          },
          {
            "n": 4,
            "name": "Shared Strength snapshot persistence",
            "date": "2026-11-16 00:20 -0500",
            "commits": [
              "1662f54"
            ],
            "changes": [
              "Share exercise and set persistence across templates and sessions.",
              "Compute exercise search ranks before sorting."
            ]
          },
          {
            "n": 5,
            "name": "WorkoutBuilderScreen",
            "date": "2026-11-20 17:46 -0500",
            "request": "Audit all five tabs: simple weight input, compact scrolling log-time modal, safe consistent subscreen bars and branch navigation.",
            "changes": [
              "Header clock replaces day/time cards and increments; fixed Cancel/Back actions preserve log/template actions."
            ],
            "commits": [
              "6d94ddf"
            ]
          }
        ],
      },
      {
        id: "strength-exercise-editor",
        title: "ExerciseEditorScreen",
        kind: "subscreen",
        status: "active",
        tagline: "Weight, sets, reps, RPE, rest, notes",
        files: ["src/screens/strength/ExerciseEditorScreen.tsx"],
        summary:
          "Full-screen editor for one draft exercise. Repeat fields fill sets that still follow them. Individual sets can be customized or skipped. Saving returns to the builder without clearing search.",
        versions: [
  {
    "n": 1,
    "name": "Exercise editor",
    "date": "2026-11-15 15:39 -0500",
    "commits": [
      "21d635f"
    ],
    "changes": [
      "Added steppers for load, sets, reps, RPE, and rest, plus explosive intent."
    ]
  },
  {
    "n": 2,
    "name": "Exercise editor",
    "date": "2026-11-15 15:57 -0500",
    "commits": [
      "6bc5a4c"
    ],
    "changes": [
      "A customized set can change load, reps, RPE, and rest. Cancel restores the workout to the state from when the editor opened."
    ]
  },
  {
    "n": 3,
    "name": "Shared set editing",
    "date": "2026-11-16 00:20 -0500",
    "commits": [
      "1662f54"
    ],
    "changes": [
      "Reuse the set updater and keep set IDs when applying repeat targets."
    ]
  },
  {
    "n": 4,
    "name": "ExerciseEditorScreen",
    "date": "2026-11-20 17:46 -0500",
    "request": "Audit all five tabs: simple weight input, compact scrolling log-time modal, safe consistent subscreen bars and branch navigation.",
    "changes": [
      "Repeat/custom set load, assistance and added weight use decimal inputs with kg/lb conversion.",
      "Shared branch X and fixed Back/action bar retain exercise and parent draft guards."
    ],
    "commits": [
      "6d94ddf"
    ]
  },
  {
    "n": 5,
    "name": "ExerciseEditorScreen",
    "date": "2026-11-22 00:29 -0500",
    "commits": [
      "40f02f4"
    ],
    "request": "Remove filler copy throughout CAPS and compact Recovery/questionnaire/Progress.",
    "changes": [
      "Shorten load hints and remove repeated toggle explanations.",
      "Presentation only; data, calculations and validation remain."
    ]
  }
],
      },
      {
        id: "strength-adaptations",
        title: "StrengthAdaptationsScreen",
        kind: "subscreen",
        status: "active",
        tagline: "Four focus bars and their evidence",
        files: [
          "src/screens/strength/StrengthAdaptationsScreen.tsx",
          "src/strength/emphasis.ts",
        ],
        summary:
          "Hypertrophy is purple, power is red, strength is blue, and muscular endurance is green. Text labels sit with the colors. A logged session shows the stored estimate. The builder previews the current draft.",
        guardrails: [
          "Do not recompute a stored estimate when the heuristic changes.",
          "Do not use these colors on the Home timeline.",
        ],
        versions: [
  {
    "n": 1,
    "name": "Strength focus",
    "date": "2026-11-15 15:39 -0500",
    "commits": [
      "e0f5bb4",
      "21d635f"
    ],
    "changes": [
      "Added strength-emphasis-v1. A primary requires a score of at least 60 and a 15-point lead.",
      "The focus screen shows the four indexes and the rationale for each."
    ]
  },
  {
    "n": 2,
    "name": "Strength focus",
    "date": "2026-11-15 15:48 -0500",
    "commits": [
      "36bac02"
    ],
    "changes": [
      "A missing score reads Unavailable, and the rationale stays on the screen."
    ]
  },
  {
    "n": 3,
    "name": "Latest usable lift reference in SQLite",
    "date": "2026-11-16 00:20 -0500",
    "commits": [
      "1662f54"
    ],
    "changes": [
      "Return only the latest usable reference per lift from historical work sets."
    ]
  },
  {
    "n": 4,
    "name": "StrengthAdaptationsScreen",
    "date": "2026-11-20 17:46 -0500",
    "request": "Audit all five tabs: simple weight input, compact scrolling log-time modal, safe consistent subscreen bars and branch navigation.",
    "changes": [
      "Shared safe centered header and fixed depth-aware navigation."
    ],
    "commits": [
      "6d94ddf"
    ]
  },
  {
    "n": 5,
    "name": "StrengthAdaptationsScreen",
    "date": "2026-11-22 00:29 -0500",
    "commits": [
      "40f02f4"
    ],
    "request": "Remove filler copy throughout CAPS and compact Recovery/questionnaire/Progress.",
    "changes": [
      "Keep Estimated label and on-demand definitions; remove developer metadata and repeated rationales.",
      "Presentation only; data, calculations and validation remain."
    ]
  }
],
      },
      {
        id: "strength-session-detail",
        title: "StrengthSessionDetailScreen",
        kind: "subscreen",
        status: "active",
        tagline: "Read-only logged workout",
        files: ["src/screens/strength/StrengthSessionDetailScreen.tsx"],
        summary:
          "Opens from a month marker. Shows the saved title, end time, estimated duration, exercise snapshots, and the stored focus.",
        versions: [
          {
            "n": 1,
            "name": "Session detail",
            "date": "2026-11-15 15:39 -0500",
            "commits": [
              "21d635f"
            ],
            "changes": [
              "Added the read-only log opened from the Strength month."
            ]
          },
          {
            "n": 2,
            "name": "Direct performed-set formatting",
            "date": "2026-11-16 00:20 -0500",
            "commits": [
              "1662f54"
            ],
            "changes": [
              "Format saved sets directly for the detail summary."
            ]
          },
          {
            "n": 3,
            "name": "StrengthSessionDetailScreen",
            "date": "2026-11-20 17:46 -0500",
            "request": "Audit all five tabs: simple weight input, compact scrolling log-time modal, safe consistent subscreen bars and branch navigation.",
            "changes": [
              "Shared safe centered header and fixed depth-aware navigation."
            ],
            "commits": [
              "6d94ddf"
            ]
          }
        ],
      },
      {
        id: "strength-planned",
        title: "Planned strength work",
        kind: "group",
        status: "planned",
        tagline: "README scope, not built",
        files: ["README.md"],
        summary:
          "Periodization around goals and competition dates is still unbuilt. Exercise, set, load, rest, and RPE logging now lives on the workout builder.",
        parts: [
          {
            name: "Periodization",
            detail:
              "Strength training organized around the athlete's goals, competition dates, and recorded workload.",
          },
          {
            name: "Normalized workout schema",
            detail: "Exercises, sets, repetitions, load, rest periods, RPE, and RIR logged through one schema.",
          },
          {
            name: "Training qualities",
            detail: "Aids rate of force development, relative strength gain, and lean mass gain.",
          },
        ],
        versions: [
          {
            n: 1,
            name: "Tracking Strength Work",
            date: "2026-07-02 00:47 -0400",
            commits: ["0b97b10"],
            changes: [
              "The README listed periodization for lean mass, maximal strength, and power, plus later stretching and mobility advice.",
            ],
          },
          {
            n: 2,
            name: "Tracking Strength Training",
            date: "2026-07-28 12:26 -0400",
            commits: ["41b5c4d"],
            changes: [
              "The README rewrite retitled the section and added a normalized workout schema (exercises, sets, reps, load, rest, RPE, RIR).",
              "Periodization now keyed off goals, competition dates, and recorded workload. Qualities became RFD, relative strength, and lean mass.",
            ],
          },
          {
            n: 3,
            name: "Logging split out",
            date: "2026-11-15 15:39 -0500",
            commits: ["21d635f"],
            changes: [
              "Left this node as the unbuilt periodization scope after workout logging shipped on the Strength tab.",
            ],
          },
        ],
      },
      {
        id: "strength-v1-archive",
        title: "Reverted Strength v1 (Sep 14 - Sep 25, 2026)",
        kind: "archive",
        status: "reverted",
        tagline: "Modal-based v1, removed from main",
        files: [
          "src/screens/StrengthTrainingScreen.tsx",
          "src/data/strengthMigration.ts",
          "src/data/strengthRepository.ts",
        ],
        summary:
          "On the reverted lineage, `StrengthTrainingScreen` hosted a month timeline, saved workouts, and modal flows for creating, logging, and inspecting strength sessions. Main was reset to `e8fc8e9` on 2026-10-02; this work remains on `origin/backup/pre-revert-7daf5e7`. No reason for the reset was recorded.",
        guardrails: [
          "Do not restore the v1 modal stack (`CreateStrengthSessionModal`, `ExerciseSearchModal`, `StrengthExerciseEditorModal`, and the confirmation/detail/adaptation modals) as the product UI (ui-style-guide.mdc; reverted 2026-10-02).",
          "Do not restore shared wrappers such as `AppModalFrame`, `CollectionStateView`, and `ResponsiveTileGrid` across screens (ui-style-guide.mdc). Those lived in the architecture archive.",
        ],
        links: ["architecture:style-guide"],
        versions: [
          {
            n: 1,
            name: "Strength v1 screen",
            date: "2026-09-14 14:21 -0400",
            commits: ["179a443"],
            changes: [
              "Wired `StrengthTrainingScreen` to the month timeline, saved-workout entry points, and create/log flows.",
              "Connected strength sessions to `DayTimeline` and `timelineRepository`.",
            ],
          },
          {
            n: 2,
            name: "Strength v1 tests",
            date: "2026-09-14 17:57 -0400",
            commits: ["ac17683"],
            changes: [
              "Added `StrengthTrainingScreen` tests covering timeline integration and refresh after logs.",
            ],
          },
          {
            n: 3,
            name: "UI redesign audit",
            date: "2026-09-25 09:55 -0400",
            commits: ["6f5d88d", "7fac1fb"],
            changes: [
              "Audit pass replaced the saved-workouts dropdown with a modal, added session action tiles/menus, and restyled the Strength screen.",
              "`7fac1fb` merged `feat/ui-redesign-audit` into that lineage (empty file list).",
            ],
          },
          {
            n: 4,
            name: "Inline saved workouts",
            date: "2026-09-25 10:30 -0400",
            commits: ["278eb96", "34ec2f8", "e330adc"],
            changes: [
              "Brought saved strength workouts back inline on the screen (`278eb96`).",
              "Formatted the Strength screen (`34ec2f8`) and unified the saved-session dropdown with a shared card grid (`e330adc`).",
            ],
          },
        ],
        children: [
          {
            id: "v1-month-timeline",
            title: "MonthTimeline",
            kind: "card",
            status: "reverted",
            tagline: "Month grid of strength sessions",
            files: ["src/components/MonthTimeline.tsx"],
            summary:
              "Month calendar of strength sessions on the v1 Strength tab. Shared with Conditioning on that lineage. Strength used it as the screen's primary calendar, not a Home day strip.",
            versions: [
              {
                n: 1,
                name: "MonthTimeline",
                date: "2026-09-14 14:20 -0400",
                commits: ["44d4e27"],
                changes: [
                  "Shared the month timeline and adaptation score display between Strength and Conditioning.",
                ],
              },
            ],
            links: ["conditioning:monthly-calendar"],
          },
          {
            id: "v1-saved-workouts",
            title: "SavedStrengthWorkouts",
            kind: "component",
            status: "reverted",
            tagline: "Templates list, dropdown then modal then inline",
            files: [
              "src/components/SavedStrengthWorkoutsDropdown.tsx",
              "src/components/SavedStrengthWorkoutsModal.tsx",
            ],
            summary:
              "Entry point for logging a saved strength template. Started as a dropdown, became a modal in the UI audit, then returned inline.",
            versions: [
              {
                n: 1,
                name: "SavedStrengthWorkoutsDropdown",
                date: "2026-09-14 14:21 -0400",
                commits: ["d319861"],
                changes: [
                  "Added the saved-workout dropdown and `LogStrengthSessionConfirmationModal` logging flow.",
                ],
              },
              {
                n: 2,
                name: "SavedStrengthWorkoutsModal",
                date: "2026-09-25 09:54 -0400",
                commits: ["6f5d88d"],
                changes: [
                  "Replaced the dropdown with `SavedStrengthWorkoutsModal` during the UI redesign audit.",
                ],
              },
              {
                n: 3,
                name: "SavedStrengthWorkoutsDropdown",
                date: "2026-09-25 10:30 -0400",
                commits: ["278eb96", "e330adc"],
                changes: [
                  "Restored an inline dropdown and unified it with Conditioning via `SavedSessionCardGrid`.",
                ],
              },
            ],
            children: [
              {
                id: "v1-log-confirmation",
                title: "LogStrengthSessionConfirmationModal",
                kind: "modal",
                status: "reverted",
                tagline: "Confirm logging a saved template",
                files: ["src/components/LogStrengthSessionConfirmationModal.tsx"],
                summary:
                  "Confirmation modal before writing an immutable session log from a saved template.",
                versions: [
                  {
                    n: 1,
                    name: "LogStrengthSessionConfirmationModal",
                    date: "2026-09-14 17:54 -0400",
                    commits: ["d319861", "2933434"],
                    changes: [
                      "Added the confirmation modal, then covered the create/confirm path with tests.",
                    ],
                  },
                ],
              },
            ],
          },
          {
            id: "v1-session-actions",
            title: "SessionActionMenu",
            kind: "component",
            status: "reverted",
            tagline: "Create / log / inspect actions",
            files: [
              "src/components/SessionActionMenu.tsx",
              "src/components/SessionActionTile.tsx",
            ],
            summary:
              "Session action menu and tiles added in the UI audit. Nested virtualized lists were avoided; actions later stacked as full-width buttons.",
            guardrails: [
              "Do not nest a virtualized list inside another virtualized list for session actions (fix 741e5a8).",
            ],
            versions: [
              {
                n: 1,
                name: "SessionActionMenu",
                date: "2026-09-25 09:54 -0400",
                commits: ["6f5d88d"],
                changes: ["Added `SessionActionMenu` and `SessionActionTile` on the Strength screen."],
              },
              {
                n: 2,
                name: "SessionActionMenu",
                date: "2026-09-25 10:19 -0400",
                commits: ["741e5a8", "009aff6", "95b4fa1", "3f5a8e7"],
                changes: [
                  "Avoided a nested virtualized action menu (`741e5a8`).",
                  "Stacked session actions as full-width buttons (`009aff6`), then corrected styles (`95b4fa1`) and reduced button height (`3f5a8e7`).",
                ],
              },
            ],
          },
          {
            id: "v1-create-session",
            title: "CreateStrengthSessionModal",
            kind: "modal",
            status: "reverted",
            tagline: "Build a template or quick-log a session",
            files: ["src/components/CreateStrengthSessionModal.tsx"],
            summary:
              "Primary create/quick-log modal. Nested exercise search and the prescription editor. Later used `AppModalFrame` and aligned log-time controls.",
            versions: [
              {
                n: 1,
                name: "CreateStrengthSessionModal",
                date: "2026-09-14 17:54 -0400",
                commits: ["acea2c3", "2933434"],
                changes: [
                  "Added the workout-creation and quick-log modal, then added tests for that flow.",
                ],
              },
              {
                n: 2,
                name: "CreateStrengthSessionModal",
                date: "2026-09-16 13:06 -0400",
                commits: ["beaf2d3"],
                changes: ["Aligned log-time controls and the strength modal header with other log UIs."],
              },
              {
                n: 3,
                name: "CreateStrengthSessionModal",
                date: "2026-09-18 19:09 -0400",
                commits: ["9a39461", "a9b40d1", "59a1b23"],
                changes: [
                  "Phase 1 normalized ExerciseDB types used by the modal (`9a39461`).",
                  "Phase 4 wrapped it in the shared `AppModalFrame` and adaptation status control.",
                ],
              },
            ],
            children: [
              {
                id: "v1-exercise-search",
                title: "ExerciseSearchModal",
                kind: "modal",
                status: "reverted",
                tagline: "ExerciseDB search",
                files: [
                  "src/components/ExerciseSearchModal.tsx",
                  "src/components/CompactExerciseRow.tsx",
                ],
                summary:
                  "Search modal over the ExerciseDB adapter. Compact rows and shared collection states arrived in the UI audit.",
                versions: [
                  {
                    n: 1,
                    name: "ExerciseSearchModal",
                    date: "2026-09-14 17:53 -0400",
                    commits: ["9de04e0", "5ca254f"],
                    changes: [
                      "Added exercise search and the prescription editor primitives, then covered the flow with tests.",
                    ],
                  },
                  {
                    n: 2,
                    name: "ExerciseSearchModal",
                    date: "2026-09-18 17:58 -0400",
                    commits: ["9a39461", "c32cb6b"],
                    changes: [
                      "Phase 1 normalized ExerciseDB results. Phase 2 added `CollectionStateView` and `CompactExerciseRow`.",
                    ],
                  },
                ],
              },
              {
                id: "v1-exercise-editor",
                title: "StrengthExerciseEditorModal",
                kind: "modal",
                status: "reverted",
                tagline: "Sets, reps, load, rest, RPE",
                files: [
                  "src/components/StrengthExerciseEditorModal.tsx",
                  "src/components/StrengthFormPrimitives.tsx",
                ],
                summary:
                  "Prescription editor for one exercise. Compacted on Sep 16. Shared form primitives also fed the create modal.",
                versions: [
                  {
                    n: 1,
                    name: "StrengthExerciseEditorModal",
                    date: "2026-09-14 17:53 -0400",
                    commits: ["9de04e0", "5ca254f"],
                    changes: ["Added the editor and form primitives, then added tests."],
                  },
                  {
                    n: 2,
                    name: "StrengthExerciseEditorModal",
                    date: "2026-09-16 16:36 -0400",
                    commits: ["c6a334a", "090a944"],
                    changes: [
                      "Simplified and compacted exercise logging (`c6a334a`).",
                      "Covered compact form workflows and documented layout rules (`090a944`).",
                    ],
                  },
                ],
              },
            ],
          },
          {
            id: "v1-session-detail",
            title: "StrengthSessionDetailModal",
            kind: "modal",
            status: "reverted",
            tagline: "Read-only logged session",
            files: ["src/components/StrengthSessionDetailModal.tsx"],
            summary: "Read-only view of an immutable logged strength session.",
            versions: [
              {
                n: 1,
                name: "StrengthSessionDetailModal",
                date: "2026-09-14 17:55 -0400",
                commits: ["da78b5b", "f0c6cc0"],
                changes: [
                  "Added the read-only detail modal, then covered immutable session details with tests.",
                ],
              },
            ],
          },
          {
            id: "v1-adaptation",
            title: "StrengthAdaptationModal",
            kind: "modal",
            status: "reverted",
            tagline: "Adaptation score for the block",
            files: ["src/components/StrengthAdaptationModal.tsx"],
            summary:
              "Showed adaptation scoring and movement-profile evidence for the current strength block. Shared display pieces with Conditioning.",
            versions: [
              {
                n: 1,
                name: "StrengthAdaptationModal",
                date: "2026-09-14 14:20 -0400",
                commits: ["44d4e27"],
                changes: [
                  "Added `StrengthAdaptationModal` next to the shared `AdaptationScoreDisplay`.",
                ],
              },
            ],
          },
          {
            id: "v1-strength-engine",
            title: "Strength engine (reverted)",
            kind: "group",
            status: "reverted",
            tagline: "ExerciseDB, drafts, scoring, sqlite",
            files: [
              "src/services/exerciseDbApi.ts",
              "src/utils/strengthSessionDraft.ts",
              "src/utils/strengthScoring.ts",
              "src/data/strengthRepository.ts",
            ],
            summary:
              "v1 domain layer: ExerciseDB adapter, draft validation, adaptation scoring, movement profile, and sqlite templates plus immutable logs. Tables from this lineage are not on main.",
            versions: [
              {
                n: 1,
                name: "Drafts and scoring",
                date: "2026-09-14 14:19 -0400",
                commits: ["1154954"],
                changes: [
                  "Added strength types, draft validation, movement profile, and adaptation scoring utilities.",
                ],
              },
              {
                n: 2,
                name: "Persistence and ExerciseDB",
                date: "2026-09-14 14:20 -0400",
                commits: ["b270cdf", "e8b22c1"],
                changes: [
                  "Added the ExerciseDB service adapter (`b270cdf`).",
                  "Persisted templates and immutable session logs (`e8b22c1`).",
                ],
              },
              {
                n: 3,
                name: "Contract and storage tests",
                date: "2026-09-14 17:49 -0400",
                commits: ["018d898", "86922a9", "51e011a"],
                changes: [
                  "Matched the free ExerciseDB search and cancellation contracts (`018d898`).",
                  "Verified sqlite migration and log storage (`86922a9`) and scoring/movement evidence (`51e011a`).",
                ],
              },
            ],
            guardrails: [
              "Match the free ExerciseDB search and cancellation contracts if that adapter is ever restored (fix 018d898).",
            ],
            children: [
              {
                id: "v1-exercisedb",
                title: "exerciseDbApi",
                kind: "service",
                status: "reverted",
                tagline: "ExerciseDB REST adapter",
                files: ["src/services/exerciseDbApi.ts", "src/utils/exerciseDbFormatting.ts"],
                summary:
                  "HTTP adapter for ExerciseDB search. Phase 1 added dedicated types and formatting helpers.",
                versions: [
                  {
                    n: 1,
                    name: "exerciseDbApi",
                    date: "2026-09-14 17:38 -0400",
                    commits: ["b270cdf", "018d898"],
                    changes: [
                      "Added the adapter, then matched free-search and cancellation contracts.",
                    ],
                  },
                  {
                    n: 2,
                    name: "exerciseDbApi",
                    date: "2026-09-18 17:53 -0400",
                    commits: ["9a39461"],
                    changes: [
                      "Phase 1 foundations: `src/types/exerciseDb.ts` and `exerciseDbFormatting` normalization.",
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};
