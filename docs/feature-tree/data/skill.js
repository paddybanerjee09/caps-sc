CAPS.trees.skill = {
  id: "skill",
  title: "Skills Training",
  summary:
    "The Skills Training tab for sport and skill work such as pads, bag, and sparring. It has only ever been a title placeholder. The planned features are described in the README and have not been built.",
  rules: ["ui-style-guide.mdc"],
  root: {
    id: "skill-screen",
    title: "SkillTrainingScreen",
    kind: "screen",
    status: "placeholder",
    tagline: "Skills Training tab: centered title only",
    files: ["src/screens/SkillScreen.tsx"],
    entry: "Bottom tab \"Skills Training\" (boxing-glove icon), second from the left.",
    summary:
      "Renders the shared `Screen` wrapper with a centered \"Skills Training\" title and nothing else. No state, data, or database tables exist for skill work yet.",
    guardrails: [
      "Do not modify this screen until it is explicitly requested (ui-style-guide.mdc, section 7).",
      "When it is built, use screen-local cards, +/- steppers, and preset strips instead of typing. Do not use data-entry modals (ui-style-guide.mdc).",
      "The file is `SkillScreen.tsx`, the component is `SkillTrainingScreen`, and the route key is `skill`. Keep all three in sync with `Screens.tsx` and `routes.ts`.",
    ],
    links: ["architecture:bottom-tabs", "architecture:screen-wrapper", "architecture:routes"],
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
    ],
    children: [
      {
        id: "skill-planned",
        title: "Planned skill work",
        kind: "group",
        status: "planned",
        tagline: "README scope, not built",
        files: ["README.md"],
        summary:
          "The README's \"Custom Skill Work\" section describes the intended feature. None of it exists in code yet.",
        parts: [
          {
            name: "Custom skill sessions",
            detail:
              "Sessions built from independently configured activities, e.g. 2x3 min shadowboxing, 3x3 min padwork, 2x5 min bag rounds.",
          },
          {
            name: "Load estimates",
            detail: "Fatigue, nutrition, and recovery needs estimated from session length and RPE.",
          },
          {
            name: "S&C scheduling",
            detail: "Strength and conditioning are organized around skill work, which stays the athlete's main priority.",
          },
        ],
        versions: [
          {
            n: 1,
            name: "Tracking Skill Work",
            date: "2026-07-02 00:47 -0400",
            commits: ["0b97b10"],
            changes: [
              "The README listed skill work types to track: shadowboxing, padwork, bagwork, light sparring, and hard sparring.",
              "It planned fatigue and recovery estimates, with S&C organized around skill work.",
            ],
          },
          {
            n: 2,
            name: "Custom Skill Work",
            date: "2026-07-28 12:26 -0400",
            commits: ["41b5c4d"],
            changes: [
              "The README rewrite replaced the fixed skill types with user-built sessions of configured activities.",
              "Fatigue, nutrition, and recovery needs would be estimated from session length and RPE.",
            ],
          },
        ],
      },
    ],
  },
};
