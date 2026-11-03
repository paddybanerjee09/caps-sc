CAPS.trees.home = {
  id: "home",
  title: "Home",
  summary:
    "The Home tab is the athlete dashboard: a telemetry card, Quick Log, inline weight and sleep cards, and a Today / Recovery / Progress section strip. Today holds the day stepper and `DayTimeline`. Recovery and Progress are placeholders. Meal Quick Log opens the nutrition composer.",
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
      "Renders athlete telemetry from `AppStateContext`, a Quick Log expander, inline `WeightLogModal` / `SleepLogModal` cards, and a `SegmentedSelector` for Today / Recovery / Progress. Today loads `timeline_entries` for the selected local day through `scheduleIdleTask`. The selected day is `homeDate` in `NutritionWorkspaceContext` so meal logging and the diary share it.",
    modes: [
      {
        name: "Today",
        detail: "Date stepper and `DayTimeline` for the selected local day.",
      },
      {
        name: "Recovery",
        detail: "Placeholder copy only. Do not build until requested.",
      },
      {
        name: "Progress",
        detail: "Placeholder copy only. Do not build until requested.",
      },
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
        n: 1,
        name: "Home",
        date: "2026-06-30 17:54 -0400",
        commits: ["e9ddbfb"],
        changes: [
          "Added the Expo Router boilerplate tab `app/(tabs)/index.tsx` as the Home tab with a centered title.",
        ],
      },
      {
        n: 2,
        name: "Home",
        date: "2026-07-02 00:35 -0400",
        commits: ["f0f5834"],
        changes: [
          "Custom state navigation replaced Expo Router. Home rendered inline in `Screens.tsx` as `<Screen title=\"Home\" />` and became `initialRoute`.",
        ],
      },
      {
        n: 3,
        name: "HomeScreen",
        date: "2026-07-18 13:55 -0400",
        commits: ["edd48ce"],
        changes: ["Moved into `src/screens/HomeScreen.tsx`. Still a title-only placeholder."],
      },
      {
        n: 4,
        name: "HomeScreen",
        date: "2026-07-21 01:06 -0400",
        commits: ["3d09c81"],
        changes: ["Started the profile-style Home layout while Account Information was being built."],
      },
      {
        n: 5,
        name: "HomeScreen",
        date: "2026-07-22 16:45 -0400",
        commits: ["2d78f4c", "ad01bfe", "59dd4e8"],
        changes: [
          "Added the Home dashboard sections (`2d78f4c`) and centered the title in the UI pass (`ad01bfe`).",
          "`59dd4e8` kept Home wired while SQLite landed.",
        ],
      },
      {
        n: 6,
        name: "HomeScreen",
        date: "2026-10-02 20:27 -0400",
        commits: ["e8fc8e9", "9fc0f73"],
        changes: [
          "`e8fc8e9` was the last Home touch before the 2026-10-02 reset. `9fc0f73` repaired Expo SDK 57 errors on the restored main.",
        ],
      },
      {
        n: 7,
        name: "HomeScreen",
        date: "2026-11-02 22:36 -0500",
        commits: ["67d99b6"],
        request:
          "Renovate Home to the card-by-card style guide: steppers, preset strips, no data-entry modals, high contrast.",
        changes: [
          "Rebuilt Home as telemetry, Quick Log, and section cards. Weight and sleep logging became inline cards. Date stepping uses -1d / +1d targets.",
        ],
      },
    ],
    children: [
      {
        id: "athlete-telemetry",
        title: "Athlete telemetry",
        kind: "card",
        tagline: "Username, sports, age, stature, weight",
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
        ],
      },
      {
        id: "quick-log",
        title: "Quick Log",
        kind: "card",
        tagline: "Expander: strength, conditioning, skill, meal, weight, sleep",
        files: ["src/screens/HomeScreen.tsx"],
        summary:
          "Animated expander (220ms) with a 2x3 grid of kinds. Weight and sleep open inline cards on Home. Meal calls `openNewMeal(selectedDate)`. Strength, conditioning, and skill tiles have no destination yet.",
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
        ],
        children: [
          {
            id: "weight-log",
            title: "WeightLogModal",
            kind: "card",
            tagline: "Inline weight log / edit / delete",
            files: ["src/components/WeightLogModal.tsx", "src/utils/weight.ts"],
            entry: "Quick Log > Weight, or a weight marker on `DayTimeline`.",
            summary:
              "Despite the filename, this is an inline card (no `Modal`) shown when `visible`. Create, edit, or delete a `weight_logs` row linked to `timeline_entries`. Stores kilograms; converts with `unitSettings.weight`. Logging also updates `athleteProfile.weightKg`.",
            modes: [
              { name: "Create", detail: "New log at a chosen time, not after now." },
              { name: "Edit", detail: "Opened from a timeline weight marker; can delete." },
            ],
            parts: [
              {
                name: "Steppers and presets",
                detail: "+/- weight steps and a horizontal preset strip (kg or lb).",
              },
            ],
            guardrails: [
              "Keep a single canonical `weightKg` shared with Athlete Information. Convert only for display (fix 5833c71).",
              "Do not open a data-entry modal for weight (ui-style-guide.mdc; inline since 67d99b6).",
            ],
            links: [
              "architecture:log-time-changer",
              "architecture:app-state",
              "database:table-weight-logs",
              "database:table-timeline-entries",
              "settings:athlete-info-screen",
            ],
            versions: [
              {
                n: 1,
                name: "Weight logging",
                date: "2026-07-24 21:59 -0400",
                commits: ["ea4cc2b"],
                changes: ["Started weight logging against `timeline_entries` / `weight_logs`."],
              },
              {
                n: 2,
                name: "WeightLogModal",
                date: "2026-07-24 22:09 -0400",
                commits: ["5833c71"],
                changes: [
                  "Extracted `WeightLogModal` and unified `weightKg` across Athlete Info and Home.",
                ],
              },
              {
                n: 3,
                name: "WeightLogModal",
                date: "2026-07-25 23:23 -0400",
                commits: ["d09b356", "3232443"],
                changes: [
                  "Added retroactive logging (`d09b356`).",
                  "Added log deletion and a refined date-time picker (`3232443`).",
                ],
              },
              {
                n: 4,
                name: "WeightLogModal",
                date: "2026-07-30 14:10 -0400",
                commits: ["ea999da"],
                changes: ["UI pass on the weight log form."],
              },
              {
                n: 5,
                name: "Weight log card",
                date: "2026-11-02 22:36 -0500",
                commits: ["67d99b6"],
                changes: [
                  "Rendered inline with +/- steppers and presets instead of a data-entry modal. Filename stayed `WeightLogModal`.",
                ],
              },
            ],
            children: [{ id: "weight-log-time", ref: "architecture:log-time-changer", note: "logged-at stepper" }],
          },
          {
            id: "sleep-log",
            title: "SleepLogModal",
            kind: "card",
            tagline: "Inline sleep window + optional nightly default",
            files: ["src/components/SleepLogModal.tsx"],
            entry: "Quick Log > Sleep.",
            summary:
              "Inline card (no `Modal`) for a sleep window on the selected wake date. Can also write a `sleep_schedules` nightly default. Times use `LogTimeChanger`.",
            modes: [
              { name: "One night", detail: "Logs a single sleep window for the selected wake date." },
              { name: "Every night", detail: "Also writes/replaces the schedule from that wake date." },
            ],
            guardrails: [
              "Do not open a data-entry modal for sleep (ui-style-guide.mdc; inline since 67d99b6).",
            ],
            links: [
              "architecture:log-time-changer",
              "database:table-sleep-schedules",
              "database:table-timeline-entries",
            ],
            versions: [
              {
                n: 1,
                name: "SleepLogModal",
                date: "2026-07-26 15:56 -0400",
                commits: ["859b4aa"],
                changes: ["Added sleep logging and the nightly default toggle."],
              },
              {
                n: 2,
                name: "Sleep log card",
                date: "2026-11-02 22:36 -0500",
                commits: ["67d99b6"],
                changes: ["Rendered inline with stepper time controls. Filename stayed `SleepLogModal`."],
              },
            ],
            children: [{ id: "sleep-log-time", ref: "architecture:log-time-changer", note: "start/end steppers" }],
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
          "Uses nutrition's `SegmentedSelector` and `SlidingPanels` for three Home sections. Only Today is built.",
        guardrails: [
          "Do not drive the section slider with per-frame React state that retriggers layout forever (fix ccc63a6).",
        ],
        links: ["nutrition:segmented-selector"],
        versions: [
          {
            n: 1,
            name: "Home sections",
            date: "2026-07-22 02:01 -0400",
            commits: ["2d78f4c"],
            changes: ["Added the Home section layout that later became Today / Recovery / Progress."],
          },
          {
            n: 2,
            name: "Home sections",
            date: "2026-10-03 23:32 -0400",
            commits: ["ccc63a6"],
            changes: [
              "Stopped the Home section slider from retriggering layout forever by fixing `SegmentedSelector` transforms.",
            ],
          },
        ],
        children: [
          {
            id: "day-timeline",
            title: "DayTimeline",
            kind: "component",
            tagline: "24-hour strip for the selected day",
            files: ["src/components/DayTimeline.tsx", "src/constants/timelineCategories.ts"],
            summary:
              "Horizontal 24-hour timeline of `TimelineEntry` rows for the selected local day. Weight markers reopen the weight card. Loads via `getTimelineEntriesForDay` after `scheduleIdleTask`.",
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
            ],
          },
          {
            id: "recovery-panel",
            title: "Recovery",
            kind: "card",
            status: "placeholder",
            tagline: "\"Recovery information will go here\"",
            files: ["src/screens/HomeScreen.tsx"],
            summary: "Placeholder panel. No recovery data or UI yet.",
            guardrails: [
              "Do not modify this panel until it is explicitly requested (ui-style-guide.mdc, section 7).",
            ],
            versions: [
              {
                n: 1,
                name: "Recovery",
                date: "2026-07-22 02:01 -0400",
                commits: ["2d78f4c"],
                changes: ["Placeholder Recovery section on Home."],
              },
            ],
          },
          {
            id: "progress-panel",
            title: "Progress",
            kind: "card",
            status: "placeholder",
            tagline: "\"Progress charts will go here\"",
            files: ["src/screens/HomeScreen.tsx"],
            summary: "Placeholder panel. No charts yet. Unrelated to the old Progress tab, which became Conditioning.",
            guardrails: [
              "Do not modify this panel until it is explicitly requested (ui-style-guide.mdc, section 7).",
            ],
            versions: [
              {
                n: 1,
                name: "Progress",
                date: "2026-07-22 02:01 -0400",
                commits: ["2d78f4c"],
                changes: ["Placeholder Progress section on Home."],
              },
            ],
          },
        ],
      },
    ],
  },
};
