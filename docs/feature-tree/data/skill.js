CAPS.trees.skill = {
  id: "skill",
  title: "Skills Training",
  summary:
    "The Skills Training tab logs sessions built from timed activities. Each log stores a focus and a versioned calorie estimate. Fatigue, nutrition timing, and scheduling the other tabs around skill work are still unbuilt.",
  rules: ["ui-style-guide.mdc"],
  root: {
    id: "skill-screen",
    title: "SkillTrainingScreen",
    kind: "screen",
    status: "active",
    tagline: "Month, builder, saved sessions, and detail",
    files: ["src/screens/SkillScreen.tsx", "src/state/SkillWorkspaceContext.tsx"],
    entry: "Bottom tab \"Skills Training\" (boxing-glove icon), second from the left.",
    summary:
      "The month calendar is the first card. The parent supplies MonthEvent rows. Marker colour is the stored focus, and each row shows the focus name and end time. A legend lists the five focus colours. Build Skill Session opens the builder. Saved Sessions expands inline under its button.",
    guardrails: [
      "Use screen-local cards, +/- steppers, and preset strips. Do not open a modal to enter an activity (ui-style-guide.mdc).",
      "The file is `SkillScreen.tsx`, the component is `SkillTrainingScreen`, and the route key is `skill`. Keep all three in sync with `Screens.tsx` and `routes.ts`.",
      "Home timeline blocks stay on `timelineCategories.skill`. Only the Skill month marker uses the session focus colour.",
      "Saving a template, removing a template, and logging a session are separate writes. Logging does not change the template.",
    ],
    links: [
      "architecture:bottom-tabs",
      "architecture:routes",
      "architecture:log-time-changer",
      "conditioning:monthly-calendar",
      "database:table-skill-sessions",
      "database:table-skill-templates",
    ],
    versions: [
      {
        n: 1,
        name: "Sport Training",
        date: "2026-06-30 17:54 -0400",
        commits: ["e9ddbfb"],
        changes: [
          "Added the Expo Router boilerplate tab `app/(tabs)/sport-training.tsx` with a centered \"Sport Training\" title.",
          "Tab order was Nutrition, Sport Training, Home, S&C, Progress. The tab used the SF Symbol `figure.boxing`.",
        ],
      },
      {
        n: 2,
        name: "Sport",
        date: "2026-07-02 00:35 -0400",
        commits: ["f0f5834"],
        changes: [
          "Removed Expo Router. Custom state navigation replaced it (`routes.ts`, `AppNavigator`, `Screens.tsx`).",
          "The route key became `sportTraining` and the label was shortened to \"Sport\". The screen rendered inline in `Screens.tsx` as `<Screen title=\"Sport\" />`.",
          "The tab icon became the MaterialCommunityIcons `boxing-glove`.",
        ],
      },
      {
        n: 3,
        name: "SportScreen",
        date: "2026-07-18 13:55 -0400",
        commits: ["edd48ce"],
        changes: ["Moved into its own file, `src/screens/SportScreen.tsx`. It was still a title-only placeholder."],
      },
      {
        n: 4,
        name: "SportScreen",
        date: "2026-07-22 02:53 -0400",
        commits: ["ad01bfe"],
        changes: ["Centered the title (`centerTitle`) as part of the app-wide UI pass."],
      },
      {
        n: 5,
        name: "SkillTrainingScreen",
        date: "2026-07-22 16:45 -0400",
        commits: ["59dd4e8"],
        changes: [
          "Deleted `SportScreen.tsx` and replaced it with `src/screens/SkillScreen.tsx`, which exports `SkillTrainingScreen`.",
          "Changed the route key from `sportTraining` to `skill` and the tab label to \"Skills Training\".",
          "The same commit split the S&C tab into Strength and Conditioning.",
        ],
      },
      {
        n: 6,
        name: "Skill logging",
        date: "2026-11-16 11:02 -0500",
        commits: ["80f1155", "45648a2"],
        request: "Build the Skills Training tab from the approved plan, using RPE instead of RIR.",
        changes: [
          "The hub shows the month, a focus legend, Build Skill Session, and an inline Saved Sessions list.",
          "Logged rows open detail by session id and keep the selected day when you go back.",
          "Schema version 9 stores templates, session snapshots, and a skill timeline row.",
        ],
      },
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
        tagline: "Title, end time, activities, save, and log",
        files: ["src/screens/skill/SkillSessionBuilderScreen.tsx"],
        summary:
          "A scrolling form with the title, Ends at, a live summary, and activity cards. Duration or rounds, one RPE band, and a sparring or rolling mode when the activity has one. The footer is Cancel, Save/Saved/Unsaved, and Log.",
        guardrails: [
          "Start time is the chosen end time minus elapsed seconds. The calendar day is the local end date, including when the session starts the day before.",
          "Reject a future end time again when logging. The time control's maximum is not the only check.",
          "A failed log stays on the builder and retries with the same session id.",
        ],
        links: ["architecture:log-time-changer"],
        versions: [
          {
            n: 1,
            name: "Skill session builder",
            date: "2026-11-16 11:02 -0500",
            commits: ["45648a2"],
            request: "Build the Skills Training tab from the approved plan, using RPE instead of RIR.",
            changes: [
              "Added inline activity cards with steppers, presets, and up/down reordering.",
              "Save writes a template immediately. Saved asks before removing it. Log does not change the template.",
            ],
          },
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
            n: 1,
            name: "Skill session detail",
            date: "2026-11-16 11:02 -0500",
            commits: ["45648a2"],
            changes: ["Added the read-only session screen opened from a calendar row."],
          },
        ],
      },
      {
        id: "skill-energy",
        title: "Skill calorie model",
        kind: "logic",
        status: "active",
        tagline: "skill-energy-v1",
        files: [
          "src/skill/catalog.ts",
          "src/skill/energy.ts",
          "src/skill/focus.ts",
          "src/skill/timing.ts",
        ],
        summary:
          "Fifteen activities. General work does not change a combat focus. Two combat disciplines make a mixed focus. Calories use the activity MET, an RPE multiplier, 1.5 MET for rest between rounds, and the latest weight at or before the end time, or 75 kg.",
        guardrails: [
          "Easy is RPE 6 or below (0.80), Moderate is RPE 7–8 (1.00), and Hard is RPE 9–10 (1.10).",
          "Store the unrounded kcal, weight basis, and estimator version on the log. Do not rewrite them when the catalog or a later weigh-in changes.",
        ],
        versions: [
          {
            n: 1,
            name: "skill-energy-v1",
            date: "2026-11-16 11:01 -0500",
            commits: ["80f1155"],
            request: "Build the Skills Training tab from the approved plan, using RPE instead of RIR.",
            changes: [
              "Added the activity catalog, focus colours, and the gross-kcal estimator.",
              "The five-round medium boxing sparring fixture is 153.75 kcal, shown as 154 kcal.",
            ],
          },
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
    ],
  },
};
