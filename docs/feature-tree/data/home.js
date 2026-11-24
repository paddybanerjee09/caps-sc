CAPS.trees.home = {
  id: "home",
  title: "Home",
  summary:
    "Home integrates daily Recovery questionnaires and real-source health markers with five Progress chart groups through the existing Today / Recovery / Progress selector. Native/device acceptance remains open.",
  rules: ["ui-style-guide.mdc", "conditioning-emphasis.mdc"],
  root: {
    id: "home-screen",
    title: "HomeScreen",
    kind: "screen",
    status: "active",
    tagline: "Dashboard: telemetry, Quick Log, timeline",
    files: ["src/screens/HomeScreen.tsx"],
    entry: "Bottom tab \"Home\" (house icon), center tab. Initial route.",
    summary:
      "Athlete Information, Quick Log, readable dates, current-day Recovery and Progress. Questionnaire history is a separate workflow screen; historical edits return there on Back/save and branch X returns Home. Native health still requires a configured development build.",
    modes: [
      {
        "name": "Today",
        "detail": "Selected-day chevrons and existing DayTimeline."
      },
      {
        "name": "Recovery",
        "detail": "Daily biometric values/missing states, morning questionnaire and separate history, versioned SRI and read-only native health connection. CAPS ORI computes when eligible biometric history is present."
      },
      {
        "name": "Progress",
        "detail": "Five source-aware graph groups, shared calendar controls, gaps/coverage and synchronized date inspection."
      }
    ],
    guardrails: [
      "Do not modify the Recovery or Progress placeholder panels until explicitly requested (ui-style-guide.mdc, section 7).",
      "Defer Home timeline loads with `scheduleIdleTask`, not `InteractionManager` (fix c8ddb63; chat e3caa8ec).",
      "Keep the conditioning category color on the Home timeline; do not restyle it from emphasis colors (conditioning-emphasis.mdc).",
    ],
    links: [
      "architecture:bottom-tabs",
      "architecture:screen-wrapper",
      "architecture:schedule-idle-task",
      "architecture:app-state",
      "nutrition:nutrition-workspace",
      "database:table-timeline-entries",
    ],
    versions: [
  {
    "n": 1,
    "name": "Home",
    "date": "2026-06-30 17:54 -0400",
    "commits": [
      "e9ddbfb"
    ],
    "changes": [
      "Added the Expo Router boilerplate tab `app/(tabs)/index.tsx` as the Home tab with a centered title."
    ]
  },
  {
    "n": 2,
    "name": "Home",
    "date": "2026-07-02 00:35 -0400",
    "commits": [
      "f0f5834"
    ],
    "changes": [
      "Custom state navigation replaced Expo Router. Home rendered inline in `Screens.tsx` as `<Screen title=\"Home\" />` and became `initialRoute`."
    ]
  },
  {
    "n": 3,
    "name": "HomeScreen",
    "date": "2026-07-18 13:55 -0400",
    "commits": [
      "edd48ce"
    ],
    "changes": [
      "Moved into `src/screens/HomeScreen.tsx`. Still a title-only placeholder."
    ]
  },
  {
    "n": 4,
    "name": "HomeScreen",
    "date": "2026-07-21 01:06 -0400",
    "commits": [
      "3d09c81"
    ],
    "changes": [
      "Started the profile-style Home layout while Account Information was being built."
    ]
  },
  {
    "n": 5,
    "name": "HomeScreen",
    "date": "2026-07-22 16:45 -0400",
    "commits": [
      "2d78f4c",
      "ad01bfe",
      "59dd4e8"
    ],
    "changes": [
      "Added the Home dashboard sections (`2d78f4c`) and centered the title in the UI pass (`ad01bfe`).",
      "`59dd4e8` kept Home wired while SQLite landed."
    ]
  },
  {
    "n": 6,
    "name": "HomeScreen",
    "date": "2026-10-02 20:27 -0400",
    "commits": [
      "e8fc8e9",
      "9fc0f73"
    ],
    "changes": [
      "`e8fc8e9` was the last Home touch before the 2026-10-02 reset. `9fc0f73` repaired Expo SDK 57 errors on the restored main."
    ]
  },
  {
    "n": 7,
    "name": "HomeScreen",
    "date": "2026-11-02 22:36 -0500",
    "commits": [
      "67d99b6"
    ],
    "request": "Renovate Home to the card-by-card style guide: steppers, preset strips, no data-entry modals, high contrast.",
    "changes": [
      "Rebuilt Home as telemetry, Quick Log, and section cards. Weight and sleep logging became inline cards. Date stepping uses -1d / +1d targets."
    ]
  },
  {
    "n": 8,
    "name": "HomeScreen",
    "date": "2026-11-20 17:46 -0500",
    "request": "Audit all five tabs: simple weight input, compact scrolling log-time modal, safe consistent subscreen bars and branch navigation.",
    "changes": [
      "Weight and sleep now open screen overlays outside dashboard scroll content."
    ],
    "commits": [
      "b971c0d"
    ]
  },
  {
    "n": 9,
    "name": "HomeScreen",
    "date": "2026-11-21 21:40 -0500",
    "commits": [
      "a97bb78"
    ],
    "request": "Execute the supplied CAPS Recovery and Progress implementation plan.",
    "changes": [
      "Replace authorized Recovery placeholder with daily collection using existing Home navigation.",
      "Retain prior-day questionnaire revisions and protect drafts on route exits."
    ]
  },
  {
    "n": 10,
    "name": "HomeScreen",
    "date": "2026-11-22 00:29 -0500",
    "commits": [
      "40f02f4"
    ],
    "request": "Remove filler copy throughout CAPS and compact Recovery/questionnaire/Progress.",
    "changes": [
      "Title-only Home and consistent -- empty values.",
      "Presentation only; data, calculations and validation remain."
    ]
  },
  {
    "n": 11,
    "name": "HomeScreen",
    "date": "2026-11-22 11:32 -0500",
    "commits": [
      "75c7dd4",
      "cb32262"
    ],
    "request": "Revise questionnaire controls/history/SRI, readable dates and Progress overlay/navigation/legend/axes.",
    "changes": [
      "Format full date captions with the shared formatter; retain ISO keys.",
      "Open dedicated questionnaire history and preserve editor branch/draft guards."
    ]
  },
      {
        "n": 12,
        "name": "HomeScreen",
        "date": "2026-11-23 12:48 -0500",
        "commits": [
          "65e148a"
        ],
        "request": "Centralize biometric editing in modals, use intuitive date/settings navigation, and share training hub components.",
        "changes": [
          "Use the canonical weight modal shared with Athlete Information and retain current biometric displays.",
          "Keep existing Sleep, Recovery, Progress and training Quick Log behavior."
        ]
      }
],
    children: [
      {
        id: "athlete-telemetry",
        title: "Athlete Information",
        kind: "card",
        tagline: "Username, sports, age, height, weight",
        files: ["src/screens/HomeScreen.tsx"],
        summary:
          "Top card on Home. Reads `username` and `athleteProfile` from `AppStateContext` and shows a \"logged today\" count from the loaded timeline.",
        links: ["architecture:app-state", "settings:athlete-info-screen"],
        versions: [
          {
            n: 1,
            name: "Profile header",
            date: "2026-07-21 01:06 -0400",
            commits: ["3d09c81"],
            changes: ["Started showing athlete identity on Home."],
          },
          {
            n: 2,
            name: "Athlete telemetry",
            date: "2026-11-02 22:36 -0500",
            commits: ["67d99b6"],
            changes: ["Restyled as the ATHLETE TELEMETRY card with a weight hero pill and a three-cell stat grid."],
          },
          { n: 3, name: "Athlete Information", date: "2026-11-20 16:53 -0500", commits: ["548bbe5"], request: "Uniform Strength-style title cards and balanced Home information and Quick Log layout.", changes: ["Rename Athlete Telemetry to Athlete Information and Stature to Height.","Remove the discipline count; Age and Height share the row equally."] },
        ],
      },
      {
        id: "quick-log",
        title: "Quick Log",
        kind: "card",
        tagline: "Expander: strength, conditioning, skill, meal, weight, sleep",
        files: ["src/screens/HomeScreen.tsx"],
        summary:
          "Animated 220ms expander with a 2x3 grid. Weight opens the app-wide actual WeightLogModal; Sleep retains its existing logging screen. Meal calls openNewMeal(selectedDate). Existing training tiles retain their current entry behavior.",
        parts: [
          {
            name: "Overlay animation",
            detail:
              "The menu animates height and opacity. It must not push the cards below it down the page.",
          },
        ],
        modes: [
          { name: "Collapsed", detail: "Only the Quick Log button is visible." },
          { name: "Expanded", detail: "Six kind tiles. Opening a destination closes the menu for meal." },
        ],
        guardrails: [
          "The Quick Log menu must overlay, not push content below it (fix efc880c).",
        ],
        versions: [
          {
            n: 1,
            name: "Quick Log",
            date: "2026-07-21 17:00 -0400",
            commits: ["5904f45"],
            changes: ["Added the Quick Log button and option tiles on Home."],
          },
          {
            n: 2,
            name: "Quick Log",
            date: "2026-07-22 02:05 -0400",
            commits: ["efc880c"],
            changes: [
              "Fixed the bug where opening Quick Log shoved everything below it. The menu overlays instead.",
            ],
          },
          {
            n: 3,
            name: "Quick Log",
            date: "2026-10-03 22:33 -0400",
            commits: ["1d7f792"],
            request: "Open the meal composer from Nutrition and Home instead of a meal modal.",
            changes: [
              "Meal Quick Log now opens the full-screen nutrition composer for Home's selected day. `MealLogModal` was removed.",
            ],
          },
          { n: 4, name: "Quick Log", date: "2026-11-20 16:53 -0500", commits: ["548bbe5"], request: "Uniform Strength-style title cards and balanced Home information and Quick Log layout.", changes: ["Remove the collapsed layout gap so the button is centered vertically.","Use a 12px grid top gap and exact two-row expanded height to match the 12px bottom padding."] },
          {
            "n": 5,
            "name": "Quick Log",
            "date": "2026-11-23 12:48 -0500",
            "commits": [
              "65e148a"
            ],
            "request": "Centralize biometric editing in modals, use intuitive date/settings navigation, and share training hub components.",
            "changes": [
              "Open the exact same canonical weight modal used by Athlete Information; preserve other Quick Log flows."
            ]
          },
        ],
        children: [
          {
            id: "weight-log",
            title: "WeightLogModal",
            kind: "modal",
            tagline: "One app-wide weight create / edit / delete dialog",
            files: [
              "src/components/WeightLogModal.tsx",
              "src/components/FormModal.tsx",
              "src/utils/weight.ts"
            ],
            entry: "Home Quick Log > Weight, Athlete Information > Bodyweight tile, or a weight marker on DayTimeline.",
            summary:
              "One app-wide actual React Native Modal, using FormModal at every entrypoint. Decimal input follows the selected kg/lb unit; canonical storage stays kilograms. Date/time selection lives inside the weight dialog and defaults new entries to the current local instant. Create, existing-entry edit and delete share AppState weight helpers, refreshing current weight and timeline/history consumers. Unchanged prefilled weights preserve exact canonical kilograms for both new logs and edits.",
            modes: [
              {
                "name": "Create",
                "detail": "New log defaults to the current local date/time; chosen timestamps cannot be future."
              },
              {
                "name": "Edit",
                "detail": "Timeline marker supplies the existing entry ID and timestamp; update or delete only that record."
              },
              {
                "name": "Units",
                "detail": "Use preferred kg/lb only at input/display boundaries; no separate business logic or persistence schema."
              }
            ],
            parts: [
              {
                "name": "Weight",
                "detail": "One labeled decimal field in kg/lb; no increments or presets."
              },
              {
                "name": "Log time",
                "detail": "The existing bounded LogTimeChanger is inside the dialog, never a global settings clock."
              },
              {
                "name": "Actions",
                "detail": "Cancel/Save and existing-entry Delete use the shared fixed modal action area; errors preserve drafts."
              }
            ],
            guardrails: [
              "Use this one canonical actual Modal from Home, Athlete Information and timeline editing; do not duplicate weight UI or writers (user request, 23 November 2026; supersedes earlier inline/no-modal design).",
              "Preserve canonical kg precision for unchanged prefilled new logs and edits; keep timestamp/record identity when editing.",
              "Profile-only updates never create weight events; backdated logs must not overwrite the latest bodyweight display."
            ],
            links: [
              "architecture:log-time-changer",
              "architecture:app-state",
              "database:table-weight-logs",
              "database:table-timeline-entries",
              "settings:athlete-info-screen",
              "architecture:form-modal"
            ],
            versions: [
              {
                "n": 1,
                "name": "Weight logging",
                "date": "2026-07-24 21:59 -0400",
                "commits": [
                  "ea4cc2b"
                ],
                "changes": [
                  "Started weight logging against `timeline_entries` / `weight_logs`."
                ]
              },
              {
                "n": 2,
                "name": "WeightLogModal",
                "date": "2026-07-24 22:09 -0400",
                "commits": [
                  "5833c71"
                ],
                "changes": [
                  "Extracted `WeightLogModal` and unified `weightKg` across Athlete Info and Home."
                ]
              },
              {
                "n": 3,
                "name": "WeightLogModal",
                "date": "2026-07-25 23:23 -0400",
                "commits": [
                  "d09b356",
                  "3232443"
                ],
                "changes": [
                  "Added retroactive logging (`d09b356`).",
                  "Added log deletion and a refined date-time picker (`3232443`)."
                ]
              },
              {
                "n": 4,
                "name": "WeightLogModal",
                "date": "2026-07-30 14:10 -0400",
                "commits": [
                  "ea999da"
                ],
                "changes": [
                  "UI pass on the weight log form."
                ]
              },
              {
                "n": 5,
                "name": "Weight log card",
                "date": "2026-11-02 22:36 -0500",
                "commits": [
                  "67d99b6"
                ],
                "changes": [
                  "Rendered inline with +/- steppers and presets instead of a data-entry modal. Filename stayed `WeightLogModal`."
                ]
              },
              {
                "n": 6,
                "name": "WeightLogModal",
                "date": "2026-11-20 17:46 -0500",
                "request": "Audit all five tabs: simple weight input, compact scrolling log-time modal, safe consistent subscreen bars and branch navigation.",
                "changes": [
                  "One decimal bodyweight field replaces weight increments and presets.",
                  "Fixed shared header with clock and X; Cancel/Save/Delete footer preserves edit and conversion logic."
                ],
                "commits": [
                  "b971c0d"
                ]
              },
              {
                "n": 7,
                "name": "WeightLogModal",
                "date": "2026-11-23 12:48 -0500",
                "commits": [
                  "65e148a"
                ],
                "request": "Centralize biometric editing in modals, use intuitive date/settings navigation, and share training hub components.",
                "changes": [
                  "Render one actual modal at all three entrypoints with internal date/time selection and shared persistence.",
                  "Preserve kg precision, existing record identity, backdated history and latest-weight consumers."
                ]
              },
              {
                "n": 8,
                "name": "WeightLogModal",
                "date": "2026-11-24 18:00 -0500",
                "commits": ["1dddd6d", "ef645a0"],
                "request": "Run Android and exercise weight logging from Home and Athlete Information, keyboard, timestamp pickers, persistence and Back.",
                "changes": [
                  "Keep the weight form and actions visible above the Android numeric keyboard through the shared modal fix.",
                  "Synchronize timestamp-wheel center, highlight and confirmed selection, including future bounds and day changes.",
                  "Live QA confirmed Home weight save/restart persistence and Athlete Information backdated logging."
                ]
              }
            ],
            children: [{ id: "weight-log-time", ref: "architecture:log-time-changer", note: "Timestamp selection lives inside the canonical weight dialog." }],
          },
          {
            id: "sleep-log",
            title: "SleepLogModal",
            kind: "subscreen",
            tagline: "Sleep window and optional nightly default",
            files: ["src/components/SleepLogModal.tsx"],
            entry: "Quick Log > Sleep.",
            summary:
              "Dedicated screen overlay with shared fixed bars. Bed and Wake clock triggers occupy the header right. Local-day selection follows the chosen wake date; one-night logging and nightly schedule replacement remain separate writes.",
            modes: [
              { name: "One night", detail: "Logs a single sleep window for the selected wake date." },
              { name: "Every night", detail: "Also writes/replaces the schedule from that wake date." },
            ],
            guardrails: [
              "Keep full sleep form on a screen; only clock selection opens Log Time (user correction, 20 November 2026).",
              "Preserve overnight local-minute and effective schedule-date semantics."
            ],
            links: [
              "architecture:log-time-changer",
              "database:table-sleep-schedules",
              "database:table-timeline-entries",
            ],
            versions: [
  {
    "n": 1,
    "name": "SleepLogModal",
    "date": "2026-07-26 15:56 -0400",
    "commits": [
      "859b4aa"
    ],
    "changes": [
      "Added sleep logging and the nightly default toggle."
    ]
  },
  {
    "n": 2,
    "name": "Sleep log card",
    "date": "2026-11-02 22:36 -0500",
    "commits": [
      "67d99b6"
    ],
    "changes": [
      "Rendered inline with stepper time controls. Filename stayed `SleepLogModal`."
    ]
  },
  {
    "n": 3,
    "name": "Shared sleep bounds",
    "date": "2026-11-16 00:18 -0500",
    "commits": [
      "24a301f"
    ],
    "changes": [
      "Share wake-date and overnight calculations between logs and defaults.",
      "Reuse the transactional range-closing SQL when replacing or disabling defaults."
    ]
  },
  {
    "n": 4,
    "name": "SleepLogModal",
    "date": "2026-11-20 17:48 -0500",
    "request": "Audit all five tabs: simple weight input, compact scrolling log-time modal, safe consistent subscreen bars and branch navigation.",
    "changes": [
      "Fixed shared screen bars with labeled Bed/Wake clocks in header right.",
      "Selected local day follows picker changes while nightly/default persistence stays separate.",
      "Schedule-load state updates remain in async callbacks; integrated ESLint passes."
    ],
    "commits": [
      "b971c0d",
      "d41c5c8"
    ]
  },
  {
    "n": 5,
    "name": "SleepLogModal",
    "date": "2026-11-22 11:32 -0500",
    "commits": [
      "75c7dd4"
    ],
    "request": "Revise questionnaire controls/history/SRI, readable dates and Progress overlay/navigation/legend/axes.",
    "changes": [
      "Format sleep day labels using 22 Nov, 2026; timestamp storage unchanged."
    ]
  }
],
            children: [{ id: "sleep-log-time", ref: "architecture:log-time-changer", note: "Bed/Wake header clocks open Log Time modal" }],
          },
          {
            id: "quick-log-meal",
            ref: "nutrition:meal-log-screen",
            note: "Quick Log > Meal opens the nutrition composer for Home's selected day",
          },
        ],
      },
      {
        id: "home-sections",
        title: "Today / Recovery / Progress",
        kind: "component",
        tagline: "Segmented selector + sliding panels",
        files: ["src/screens/HomeScreen.tsx"],
        summary:
          "Existing SegmentedSelector and SlidingPanels host Today, Recovery and Progress; inactive feature content does not impose an offscreen form/chart height.",
        guardrails: [
          "Do not drive the section slider with per-frame React state that retriggers layout forever (fix ccc63a6).",
        ],
        links: ["nutrition:segmented-selector"],
        versions: [
          {
            "n": 1,
            "name": "Home sections",
            "date": "2026-07-22 02:01 -0400",
            "commits": [
              "2d78f4c"
            ],
            "changes": [
              "Added the Home section layout that later became Today / Recovery / Progress."
            ]
          },
          {
            "n": 2,
            "name": "Home sections",
            "date": "2026-10-03 23:32 -0400",
            "commits": [
              "ccc63a6"
            ],
            "changes": [
              "Stopped the Home section slider from retriggering layout forever by fixing `SegmentedSelector` transforms."
            ]
          },
          {
            "n": 3,
            "name": "Today / Recovery / Progress",
            "date": "2026-11-21 21:40 -0500",
            "commits": [
              "9634b61"
            ],
            "request": "Execute the supplied CAPS Recovery and Progress implementation plan.",
            "changes": [
              "Integrate Recovery and Progress without another navigation system.",
              "Retain chart legend/timeframe state while Home remains mounted."
            ]
          }
        ],
        children: [
          {
            id: "day-timeline",
            title: "DayTimeline",
            kind: "component",
            tagline: "24-hour strip for the selected day",
            files: ["src/screens/HomeScreen.tsx", "src/components/DayTimeline.tsx", "src/constants/timelineCategories.ts"],
            summary:
              "Horizontal 24-hour timeline of TimelineEntry rows for the selected local day. Home’s day navigation uses accessible left/right chevrons around the selected day instead of visible -1/+1 controls; navigation/data loading and date constraints remain unchanged. Weight markers reopen the canonical weight modal.",
            links: [
              "database:table-timeline-entries",
              "architecture:schedule-idle-task",
              "nutrition:nutrition-diary",
            ],
            versions: [
              {
                n: 1,
                name: "DayTimeline",
                date: "2026-07-25 18:20 -0400",
                commits: ["fb6ae68", "ed60738"],
                changes: [
                  "Added `timelineRepository` (`fb6ae68`) and the rudimentary `DayTimeline` (`ed60738`).",
                ],
              },
              {
                n: 2,
                name: "DayTimeline",
                date: "2026-07-28 19:39 -0400",
                commits: ["3232443", "241f556"],
                changes: [
                  "Deletion and a refined date-time picker (`3232443`). Meals started appearing on the timeline (`241f556`).",
                ],
              },
              {
                n: 3,
                name: "DayTimeline",
                date: "2026-10-11 21:40 -0400",
                commits: ["c8ddb63", "0772f4e"],
                changes: [
                  "Deferred the day load with `scheduleIdleTask` (`c8ddb63`).",
                  "Refresh after conditioning saves (`0772f4e`).",
                ],
              },
              {
                n: 4,
                name: "DayTimeline",
                date: "2026-11-02 22:36 -0500",
                commits: ["67d99b6"],
                changes: ["Restyled to match the card-by-card Home dashboard."],
              },
              {
                "n": 5,
                "name": "DayTimeline",
                "date": "2026-11-23 12:48 -0500",
                "commits": [
                  "65e148a"
                ],
                "request": "Centralize biometric editing in modals, use intuitive date/settings navigation, and share training hub components.",
                "changes": [
                  "Replace visible numeric previous/next-day increments with established icon-library chevrons.",
                  "Preserve selected-date updates and all timeline data behavior."
                ]
              },
            ],
          },
          {
            id: "recovery-panel",
            title: "Recovery",
            kind: "group",
            status: "active",
            tagline: "Daily questionnaire, provenance and experimental index boundaries",
            files: [
              "src/recovery/components/RecoveryPanel.tsx",
              "src/recovery/useRecoveryData.ts",
              "src/recovery/useRecoveryDay.ts"
            ],
            summary: "Concise metric grid with -- missing values. Questionnaire history opens a separate screen. Weighted SRI identifies the saved model; experimental ORI remains CAPS-owned and independently versioned.",
            guardrails: [
              "Do not modify this panel until it is explicitly requested (ui-style-guide.mdc, section 7).",
            ],
            versions: [
  {
    "n": 1,
    "name": "Recovery",
    "date": "2026-07-22 02:01 -0400",
    "commits": [
      "2d78f4c"
    ],
    "changes": [
      "Placeholder Recovery section on Home."
    ]
  },
  {
    "n": 2,
    "name": "Recovery",
    "date": "2026-11-21 21:40 -0500",
    "commits": [
      "a97bb78"
    ],
    "request": "Execute the supplied CAPS Recovery and Progress implementation plan.",
    "changes": [
      "Controlled unanswered ratings and 15-minute full-date/dual-clock inputs.",
      "Draft/submit/edit/history with timezone/DST handling, save failure retention and route-exit guards.",
      "No faux physiological values or unapproved ORI."
    ]
  },
  {
    "n": 3,
    "name": "Recovery",
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
    "n": 4,
    "name": "Recovery",
    "date": "2026-11-22 00:28 -0500",
    "commits": [
      "76e2ec9"
    ],
    "request": "Remove filler copy throughout CAPS and compact Recovery/questionnaire/Progress.",
    "changes": [
      "Metric values plus one short definition or requirement; no state/baseline/provenance paragraphs. Health management remains expandable.",
      "Presentation only; data, calculations and validation remain."
    ]
  },
  {
    "n": 5,
    "name": "Recovery",
    "date": "2026-11-22 11:32 -0500",
    "commits": [
      "cb32262"
    ],
    "request": "Revise questionnaire controls/history/SRI, readable dates and Progress overlay/navigation/legend/axes.",
    "changes": [
      "Replace inline history rows with dedicated history screen entry."
    ]
  }
],

children: [
  {
    "id": "morning-questionnaire",
    "title": "Morning questionnaire",
    "kind": "subscreen",
    "status": "active",
    "tagline": "Offline draft, completion and revisions",
    "files": [
      "src/recovery/components/MorningQuestionnaire.tsx",
      "src/recovery/components/RatingSlider.tsx",
      "src/recovery/components/SleepTimeRangeSlider.tsx"
    ],
    "summary": "Two minute-resolution sleep clocks, calculated interval/estimated total, numbered full-width sliders (ratings 5, awakenings 0–10+ starting 0), no timeline or visible +/- controls. Versioned weighted SRI, required mood, existing answers and draft guards retained. Native usability QA pending.",
    "versions": [
  {
    "n": 1,
    "name": "Morning questionnaire",
    "date": "2026-11-21 21:40 -0500",
    "commits": [
      "a97bb78"
    ],
    "changes": [
      "Implement controlled manual collection, draft protection and versioned submission."
    ]
  },
  {
    "n": 2,
    "name": "Morning questionnaire",
    "date": "2026-11-22 00:28 -0500",
    "commits": [
      "76e2ec9"
    ],
    "request": "Remove filler copy throughout CAPS and compact Recovery/questionnaire/Progress.",
    "changes": [
      "Remove navigation/scoring/helper paragraphs; compact unanswered controls preserve dates, anchors and validation/guards.",
      "Presentation only; data, calculations and validation remain."
    ]
  },
  {
    "n": 3,
    "name": "Morning questionnaire",
    "date": "2026-11-22 11:32 -0500",
    "commits": [
      "cb32262"
    ],
    "request": "Revise questionnaire controls/history/SRI, readable dates and Progress overlay/navigation/legend/axes.",
    "changes": [
      "Use regular minute clocks and calculated sleep total instead of timeline.",
      "Default six ratings to 5 and awakenings to 0; mark 10+ as a lower bound and preserve exact historical counts.",
      "History editor Back/save returns to history; X exits branch with guards."
    ]
  }
],
    "links": [
      "database:table-daily-questionnaires",
      "architecture:log-time-changer"
    ]
  ,
children: [
  {
    "id": "subjective-recovery",
    "title": "Weighted SRI",
    "kind": "logic",
    "status": "active",
    "tagline": "Versioned subjective recovery composite",
    "summary": "sri_v2 weights sleep quality 30%, fatigue 25%, soreness 20%, stress 10%, motivation 5%, mood 5%, awakenings 5% (cap 10). New/edited saves use v2; original responses retain v1 until saved. Experimental app weights, not clinically calibrated.",
    "files": [
      "src/recovery/calculations.ts",
      "src/recovery/types.ts",
      "docs/questionnaire-sri-v2.md"
    ],
    "links": [
      "database:table-daily-questionnaires",
      "database:table-recovery-snapshots"
    ],
    "versions": [
      {
        "n": 1,
        "name": "Weighted SRI",
        "date": "2026-11-22 11:32 -0500",
        "commits": [
          "cb32262"
        ],
        "request": "Revise questionnaire controls/history/SRI, readable dates and Progress overlay/navigation/legend/axes.",
        "changes": [
          "Prioritize sleep quality/fatigue/soreness while preserving historical formula identity.",
          "Neutral new defaults produce 53; retain original scores/revisions and separate chart model versions."
        ]
      }
    ]
  }
]
,
guardrails: [
  "Preserve raw ratings, DST/date bounds, draft guards and the 10+ lower-bound flag; never silently truncate legacy counts (user request, 22 November 2026)."
]
},
  {
    "id": "objective-recovery",
    "title": "CAPS Objective Recovery Index",
    "kind": "logic",
    "status": "active",
    "tagline": "caps_ori_v1 · HRV40/RHR30/sleep30",
    "summary": "Pure CAPS biometric model: prior28/min14 source/subtype-specific baselines, explicit noise-floor transforms, all-input eligibility, source/model provenance and experimental label. No vendor scores or questionnaire inputs. See docs/caps-ori-v1.md.",
    "files": [
      "src/recovery/objectiveRecovery.ts",
      "docs/caps-ori-v1.md"
    ],
    "links": [
      "database:table-recovery-snapshots"
    ],
    "versions": [
      {
        "n": 1,
        "name": "CAPS ORI v1",
        "date": "2026-11-22 00:06 -0500",
        "commits": [
          "1a2e0fb"
        ],
        "changes": [
          "Implement own versioned biometric model and deterministic/reference/invalidation tests."
        ]
      }
    ]
  }
,
{
  "id": "questionnaire-history",
  "title": "Questionnaire history",
  "kind": "subscreen",
  "status": "active",
  "tagline": "Browse and edit saved questionnaires",
  "summary": "Dedicated virtualized reverse-date screen opened from Recovery. Select a saved date to edit; editor Back/save returns to history, branch X exits. Loading/errors/retry and inactive-overlay accessibility/Back handling retained.",
  "files": [
    "src/recovery/components/QuestionnaireHistoryScreen.tsx"
  ],
  "links": [
    "home:morning-questionnaire",
    "database:table-daily-questionnaires"
  ],
  "versions": [
    {
      "n": 1,
      "name": "Questionnaire history",
      "date": "2026-11-22 11:32 -0500",
      "commits": [
        "cb32262"
      ],
      "request": "Revise questionnaire controls/history/SRI, readable dates and Progress overlay/navigation/legend/axes.",
      "changes": [
        "Move history out of Recovery inline content into a separate editable-history screen."
      ]
    }
  ]
}
],

links: [
  "database:recovery-storage",
  "architecture:health-adapters"
],
},
          {
            id: "progress-panel",
            title: "Progress",
            kind: "group",
            status: "active",
            tagline: "Five calendar/source-aware chart categories",
            files: [
              "src/progress/ProgressPanel.tsx",
              "src/progress/ProgressCharts.tsx",
              "src/progress/progressSeries.ts",
              "src/progress/chartAggregation.ts"
            ],
            summary: "Five categories in an anchored overlay menu. Current-period timeframe selection, only period arrows, synchronized chart inspection and below-plot value toggles. Higher-is-better wellness, detailed zero-based axes and responsive X labels; source/model gaps preserved.",
            guardrails: [
  "Do not modify this panel until it is explicitly requested (ui-style-guide.mdc, section 7).",
  "Keep hidden series values tappable, raw wellness inputs unchanged and actual values above 16h visible; no datapoint arrow row (user correction, 22 November 2026)."
],
            versions: [
  {
    "n": 1,
    "name": "Progress",
    "date": "2026-07-22 02:01 -0400",
    "commits": [
      "2d78f4c"
    ],
    "changes": [
      "Placeholder Progress section on Home."
    ]
  },
  {
    "n": 2,
    "name": "Progress",
    "date": "2026-11-21 21:40 -0500",
    "commits": [
      "9634b61"
    ],
    "request": "Execute the supplied CAPS Recovery and Progress implementation plan.",
    "changes": [
      "Reuse existing SVG and segmented controls.",
      "Keep incompatible units/sources/subtypes/protocols/formulas separate.",
      "Use trailing calendar weight averages, partial coverage and explicit missing gaps."
    ]
  },
  {
    "n": 3,
    "name": "Progress",
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
    "n": 4,
    "name": "Progress",
    "date": "2026-11-22 00:28 -0500",
    "commits": [
      "e3c0c6a"
    ],
    "request": "Remove filler copy throughout CAPS and compact Recovery/questionnaire/Progress.",
    "changes": [
      "Choose graph dropdown, compact period/refresh and empty states, value-only inspection with accessible date.",
      "Presentation only; data, calculations and validation remain."
    ]
  },
  {
    "n": 5,
    "name": "Progress",
    "date": "2026-11-22 11:32 -0500",
    "commits": [
      "5544ea6"
    ],
    "request": "Revise questionnaire controls/history/SRI, readable dates and Progress overlay/navigation/legend/axes.",
    "changes": [
      "Overlay Choose graph; reset timeframe to current local period and remove redundant datapoint arrows.",
      "Use below-chart values as toggle legend, retaining hidden rows for re-enable.",
      "Invert fatigue/soreness/stress only for display; label higher-is-better.",
      "Set 0–10 step 2 / 0–100 step 10, awakening zero minimum and sleep minimum extent 0–16h.",
      "Adapt X font sizes/tick density and keep SRI versions distinct."
    ]
  },
  {
    "n": 6,
    "name": "Progress",
    "date": "2026-11-22 11:38 -0500",
    "commits": [
      "c1193f1"
    ],
    "request": "Revise questionnaire controls/history/SRI, readable dates and Progress overlay/navigation/legend/axes.",
    "changes": [
      "Use a shared maximum Y-label inset across related plots so synchronized date cursors align at large font scales."
    ]
  }
],

links: [
  "database:table-weight-logs",
  "database:recovery-storage"
],

children: [
  {
    "id": "progress-graph-chooser",
    "title": "Choose graph",
    "kind": "component",
    "status": "active",
    "tagline": "Inline graph dropdown",
    "summary": "Anchored transparent Modal overlays the viewport without shifting graphs. Five requested categories; measured/clamped position, scrollable options and outside/selection/Android Back dismissal. No new dependency.",
    "files": [
      "src/progress/ProgressPanel.tsx"
    ],
    "versions": [
  {
    "n": 1,
    "name": "Choose graph",
    "date": "2026-11-22 00:28 -0500",
    "commits": [
      "e3c0c6a"
    ],
    "changes": [
      "Replace chart-category button strip with compact dropdown."
    ]
  },
  {
    "n": 2,
    "name": "Choose graph",
    "date": "2026-11-22 11:32 -0500",
    "commits": [
      "5544ea6"
    ],
    "request": "Revise questionnaire controls/history/SRI, readable dates and Progress overlay/navigation/legend/axes.",
    "changes": [
      "Replace inline expansion with screen overlay, explicitly requested by user."
    ]
  }
]
  }
],
},
        ],
      },
    ],
  },
};
