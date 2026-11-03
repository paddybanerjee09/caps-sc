CAPS.trees.settings = {
  id: "settings",
  title: "Settings",
  summary:
    "The three sidebar screens: Settings (appearance, units, audio/haptics, reminder placeholders), Account Information (local username/callsign), and Athlete Information (sex, age, height, weight, sports). All three were renovated on 2026-11-02 to card-by-card steppers and presets with no data-entry modals.",
  rules: ["ui-style-guide.mdc", "conditioning-data-and-units.mdc"],
  root: {
    id: "settings-root",
    title: "Sidebar screens",
    kind: "group",
    tagline: "Hamburger menu: Settings, Account, Athlete",
    files: ["src/navigation/routes.ts"],
    entry: "Header hamburger opens `Sidebar`. Rows: Settings, Account Information, Athlete Information.",
    summary:
      "Sidebar routes are not tabs. `AppNavigator` swaps `ScreenForRoute` to `settings`, `accountInfo`, or `athleteInfo`. Shared profile and unit state lives in `AppStateContext`.",
    links: ["architecture:sidebar", "architecture:app-state", "architecture:routes"],
    versions: [
      {
        n: 1,
        name: "Inline settings",
        date: "2026-07-02 00:35 -0400",
        commits: ["f0f5834"],
        changes: [
          "Settings, Account, and Athlete fields lived inline in `Screens.tsx` with a theme switch, unit switches, notification toggles, and placeholder athlete fields.",
        ],
      },
      {
        n: 2,
        name: "Sidebar screens",
        date: "2026-07-18 13:59 -0400",
        commits: ["edd48ce", "7f48393"],
        changes: [
          "Split into `SettingsScreen`, `AccountInfoScreen`, and `AthleteInfoScreen`, plus `AppStateContext` (`edd48ce`).",
          "`7f48393` was the \"What the hell is going on\" merge during the 07-18 history tangle.",
        ],
      },
    ],
    children: [
      {
        id: "settings-screen",
        title: "SettingsScreen",
        kind: "screen",
        tagline: "Appearance, units, cues, reminder placeholders",
        files: ["src/screens/SettingsScreen.tsx"],
        entry: "Sidebar > Settings.",
        summary:
          "Four cards: appearance and accent, measurement units, audio/haptic cues, and local-only notification toggles that are not persisted. Units are stored in `AppStateContext` and convert display only.",
        modes: [
          { name: "Dark / light", detail: "`colorScheme` on `AppThemeProvider`." },
          { name: "Accent", detail: "One of `tertiaryColorOptions` (red, blue, green, purple, turquoise, yellow, orange, pink)." },
        ],
        guardrails: [
          "Do not rewrite stored conditioning or weight values when the unit setting changes; convert at the edges (0772f4e; conditioning-data-and-units.mdc).",
          "Do not use data-entry modals on this screen (ui-style-guide.mdc).",
        ],
        links: ["architecture:theme", "architecture:simple-switch", "architecture:feedback-engine", "architecture:app-state"],
        versions: [
          {
            n: 1,
            name: "SettingsScreen",
            date: "2026-07-18 13:55 -0400",
            commits: ["edd48ce"],
            changes: ["Extracted from `Screens.tsx` into `src/screens/SettingsScreen.tsx`."],
          },
          {
            n: 2,
            name: "SettingsScreen",
            date: "2026-07-21 01:06 -0400",
            commits: ["101ec87", "3d09c81"],
            changes: [
              "Athlete Information settings work (`101ec87`) and the Profile screen pass (`3d09c81`) also touched Settings.",
            ],
          },
          {
            n: 3,
            name: "SettingsScreen",
            date: "2026-07-22 02:58 -0400",
            commits: ["ad01bfe", "2900198"],
            changes: [
              "UI pass added per-accent CAPS icons (`ad01bfe`). `2900198` was Settings-only follow-up UI.",
            ],
          },
          {
            n: 4,
            name: "SettingsScreen",
            date: "2026-10-11 21:40 -0400",
            commits: ["0772f4e"],
            changes: ["Added the shared distance unit setting used by conditioning."],
          },
          {
            n: 5,
            name: "SettingsScreen",
            date: "2026-11-02 22:29 -0500",
            commits: ["6b9fc9a"],
            request: "Don't forget to also renovate the settings screens accordingly.",
            changes: [
              "Card-by-card renovation: appearance, units, audio/haptics, and reminder placeholders with large switches and 48px targets.",
            ],
          },
        ],
        children: [
          {
            id: "appearance-card",
            title: "Appearance & contrast",
            kind: "card",
            tagline: "Dark/light + accent color",
            files: ["src/screens/SettingsScreen.tsx"],
            summary: "Color-scheme toggle and a horizontal strip of tertiary accent swatches.",
            versions: [
              {
                n: 1,
                name: "Appearance",
                date: "2026-07-02 00:35 -0400",
                commits: ["f0f5834"],
                changes: ["Theme switch lived in the inline settings screen."],
              },
              {
                n: 2,
                name: "Appearance & contrast",
                date: "2026-11-02 22:29 -0500",
                commits: ["6b9fc9a"],
                changes: ["Restyled as the APPEARANCE & CONTRAST card with accent swatches."],
              },
            ],
            links: ["architecture:theme"],
          },
          {
            id: "units-card",
            title: "Measurement units",
            kind: "card",
            tagline: "km/mi, kg/lb, cm/in",
            files: ["src/screens/SettingsScreen.tsx"],
            summary:
              "Three unit toggles. Distance is shared with conditioning. Weight and height are shared with Home and Athlete Information. Stored records stay in canonical units (s, m, kg, cm).",
            modes: [
              { name: "Metric", detail: "km, kg, cm." },
              { name: "Imperial", detail: "mi, lb, in/ft." },
            ],
            guardrails: [
              "Do not rewrite stored values when the unit setting changes (conditioning-data-and-units.mdc).",
            ],
            versions: [
              {
                n: 1,
                name: "Units",
                date: "2026-07-02 00:35 -0400",
                commits: ["f0f5834"],
                changes: ["Unit switches were part of the original inline settings."],
              },
              {
                n: 2,
                name: "Distance unit",
                date: "2026-10-11 21:40 -0400",
                commits: ["0772f4e"],
                changes: ["Shared distance unit with conditioning."],
              },
              {
                n: 3,
                name: "Measurement units",
                date: "2026-11-02 22:29 -0500",
                commits: ["6b9fc9a"],
                changes: ["Restyled as MEASUREMENT UNITS with a km/kg/cm badge."],
              },
            ],
          },
          {
            id: "feedback-card",
            title: "Audio cues & haptics",
            kind: "card",
            tagline: "Independent audio and haptic toggles",
            files: ["src/screens/SettingsScreen.tsx"],
            summary: "Persisted `audioCuesEnabled` and `hapticsEnabled` flags consumed by `src/utils/feedback.ts`.",
            links: ["architecture:feedback-engine", "architecture:simple-switch"],
            versions: [
              {
                n: 1,
                name: "Audio cues & haptic feedback",
                date: "2026-11-02 22:29 -0500",
                commits: ["6b9fc9a"],
                changes: ["Added the sensory-feedback card during the settings renovation."],
              },
            ],
          },
          {
            id: "reminders-card",
            title: "Notifications & reminders",
            kind: "card",
            status: "placeholder",
            tagline: "Local toggles, not persisted",
            files: ["src/screens/SettingsScreen.tsx"],
            summary:
              "Weigh-in, training, and hydration reminder switches. State is `useState` only; nothing is scheduled or stored.",
            versions: [
              {
                n: 1,
                name: "Notifications",
                date: "2026-07-02 00:35 -0400",
                commits: ["f0f5834"],
                changes: ["Notification toggles existed on the original inline settings screen."],
              },
              {
                n: 2,
                name: "Notifications & reminders",
                date: "2026-11-02 22:29 -0500",
                commits: ["6b9fc9a"],
                changes: ["Restyled as a card. Still local component state only."],
              },
            ],
          },
        ],
      },
      {
        id: "account-info-screen",
        title: "AccountInfoScreen",
        kind: "screen",
        tagline: "Local username / callsign, 15 chars",
        files: ["src/screens/AccountInfoScreen.tsx"],
        entry: "Sidebar > Account Information.",
        summary:
          "Local device identity. Username is stored in `AppStateContext` (15-character cap). Preset callsigns and suffix chips avoid typing; a `TextInput` remains as a secondary readout.",
        guardrails: [
          "Do not open a modal for username (ui-style-guide.mdc, section 2).",
        ],
        links: ["architecture:app-state", "home:home-screen"],
        versions: [
          {
            n: 1,
            name: "AccountInfoScreen",
            date: "2026-07-18 13:55 -0400",
            commits: ["edd48ce"],
            changes: ["Created as a separate sidebar screen."],
          },
          {
            n: 2,
            name: "AccountInfoScreen",
            date: "2026-07-21 01:06 -0400",
            commits: ["3d09c81"],
            changes: ["Started the Profile/Account identity fields."],
          },
          {
            n: 3,
            name: "AccountInfoScreen",
            date: "2026-11-02 22:29 -0500",
            commits: ["6b9fc9a"],
            changes: [
              "Renovated to ACTIVE ACCOUNT TELEMETRY plus USERNAME & CALLSIGN with preset chips and suffix steps.",
            ],
          },
        ],
        children: [
          {
            id: "account-telemetry",
            title: "Active account telemetry",
            kind: "card",
            tagline: "Current handle, local device",
            files: ["src/screens/AccountInfoScreen.tsx"],
            summary: "Readout of the saved username and a 15-character counter.",
            versions: [
              {
                n: 1,
                name: "Active account telemetry",
                date: "2026-11-02 22:29 -0500",
                commits: ["6b9fc9a"],
                changes: ["Added the telemetry header card."],
              },
            ],
          },
          {
            id: "callsign-card",
            title: "Username & callsign",
            kind: "card",
            tagline: "Presets, suffixes, optional typing",
            files: ["src/screens/AccountInfoScreen.tsx"],
            summary: "Horizontal preset callsigns, suffix chips, a 15-char field, Save and Reset.",
            versions: [
              {
                n: 1,
                name: "Username & callsign",
                date: "2026-11-02 22:29 -0500",
                commits: ["6b9fc9a"],
                changes: ["Replaced free-form-only editing with presets and suffixes."],
              },
            ],
          },
        ],
      },
      {
        id: "athlete-info-screen",
        title: "AthleteInfoScreen",
        kind: "screen",
        tagline: "Sex, age, weight, height, sports",
        files: ["src/screens/AthleteInfoScreen.tsx"],
        entry: "Sidebar > Athlete Information.",
        summary:
          "Biometric and sport profile. Age, height, and weight use +/- steppers and preset strips. Weight writes canonical `weightKg` (and can log a timeline weight). Sports are a multi-select chip strip.",
        modes: [
          { name: "Metric height/weight", detail: "cm and kg presets." },
          { name: "Imperial height/weight", detail: "ft/in presets and lb presets." },
        ],
        guardrails: [
          "Do not open data-entry modals for age, sex, height, weight, or sports (ui-style-guide.mdc, section 2).",
          "Store `weightKg` once; Home weight logs and this screen share that value (fix 5833c71).",
          "On 2026-07-18 the user asked to revert athlete info after a git history tangle; the screen was kept and later rebuilt (chat 054b107f).",
        ],
        links: ["architecture:app-state", "home:weight-log", "database:table-weight-logs"],
        versions: [
          {
            n: 1,
            name: "AthleteInfoScreen",
            date: "2026-07-18 13:55 -0400",
            commits: ["edd48ce"],
            request:
              "Later the same day: \"I dont WANT to keep my athlete info screen, i want to revert to what i had before it all.\" The screen remained; history was tangled by a GitHub README commit vs local work.",
            changes: ["Created the Athlete Information sidebar screen."],
          },
          {
            n: 2,
            name: "AthleteInfoScreen",
            date: "2026-07-20 22:58 -0400",
            commits: ["37c812d", "101ec87"],
            changes: [
              "`37c812d` was Boilerplate #3 during the 07-18/20 reset sequence.",
              "`101ec87` created the Athlete Information settings fields.",
            ],
          },
          {
            n: 3,
            name: "AthleteInfoScreen",
            date: "2026-07-24 22:09 -0400",
            commits: ["3d09c81", "5904f45", "5833c71"],
            changes: [
              "Profile work (`3d09c81`) and Quick Log (`5904f45`) also touched this screen.",
              "Unified `weightKg` with Home (`5833c71`).",
            ],
          },
          {
            n: 4,
            name: "AthleteInfoScreen",
            date: "2026-11-02 22:31 -0500",
            commits: ["ce8f0d6"],
            request: "Renovated with the rest of the settings screens: card-by-card steppers and scroll presets.",
            changes: [
              "Rebuilt as BIOMETRIC OVERVIEW plus sex, age, bodyweight, stature, and sports cards with steppers and presets.",
            ],
          },
        ],
        children: [
          {
            id: "biometric-overview",
            title: "Biometric overview",
            kind: "card",
            tagline: "Age, sex, weight, height readout",
            files: ["src/screens/AthleteInfoScreen.tsx"],
            summary: "Summary tiles for the current profile.",
            versions: [
              {
                n: 1,
                name: "Biometric overview",
                date: "2026-11-02 22:31 -0500",
                commits: ["ce8f0d6"],
                changes: ["Added the overview card."],
              },
            ],
          },
          {
            id: "athlete-fields",
            title: "Athlete fields",
            kind: "group",
            tagline: "Sex, age, weight, height, sports",
            files: ["src/screens/AthleteInfoScreen.tsx"],
            summary:
              "One card per field. Age/height/weight use 48px steppers and a horizontal preset `ScrollView`. Sex and sports are chips.",
            parts: [
              { name: "Biological sex", detail: "Male / Female chips." },
              { name: "Athlete age", detail: "+/- years and age presets." },
              { name: "Bodyweight", detail: "Canonical kg; display follows the Settings unit. Saving can log weight." },
              { name: "Stature / height", detail: "Canonical cm; imperial uses feet+inches steppers." },
              { name: "Combat sports", detail: "Multi-select chip strip." },
            ],
            versions: [
              {
                n: 1,
                name: "Athlete fields",
                date: "2026-07-20 22:58 -0400",
                commits: ["101ec87"],
                changes: ["First dedicated Athlete Information fields."],
              },
              {
                n: 2,
                name: "Athlete fields",
                date: "2026-11-02 22:31 -0500",
                commits: ["ce8f0d6"],
                changes: ["Split into stepper/preset cards with no data-entry modals."],
              },
            ],
          },
        ],
      },
    ],
  },
};
