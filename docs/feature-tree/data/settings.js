CAPS.trees.settings = {
  id: "settings",
  title: "Settings",
  summary:
    "Three sidebar screens retain the CAPS design system. Settings controls appearance/units/feedback; Account edits local account fields; Athlete Information centralizes age/DOB, sex, weight and height editing in its interactive Biometric Overview. Settings headers open the existing sidebar and omit global log-time selectors.",
  rules: ["ui-style-guide.mdc", "conditioning-data-and-units.mdc"],
  root: {
    id: "settings-root",
    title: "Sidebar screens",
    kind: "group",
    tagline: "Hamburger menu: Settings, Account, Athlete",
    files: ["src/navigation/routes.ts"],
    entry: "Header hamburger opens `Sidebar`. Rows: Settings, Account Information, Athlete Information.",
    summary:
      "Sidebar routes remain inside the existing custom navigator. Every settings header uses MenuButton to open the existing drawer. Drawer X exits settings to the remembered main tab through existing draft guards. There is no global settings log timestamp; weight time selection lives inside the shared weight dialog.",
    links: [
      "architecture:sidebar",
      "architecture:app-state",
      "architecture:routes",
      "architecture:menu-button"
    ],
    versions: [
  {
    "n": 1,
    "name": "Inline settings",
    "date": "2026-07-02 00:35 -0400",
    "commits": [
      "f0f5834"
    ],
    "changes": [
      "Settings, Account, and Athlete fields lived inline in `Screens.tsx` with a theme switch, unit switches, notification toggles, and placeholder athlete fields."
    ]
  },
  {
    "n": 2,
    "name": "Sidebar screens",
    "date": "2026-07-18 13:59 -0400",
    "commits": [
      "edd48ce",
      "7f48393"
    ],
    "changes": [
      "Split into `SettingsScreen`, `AccountInfoScreen`, and `AthleteInfoScreen`, plus `AppStateContext` (`edd48ce`).",
      "`7f48393` was the \"What the hell is going on\" merge during the 07-18 history tangle."
    ]
  },
  {
    "n": 3,
    "name": "Sidebar screens",
    "date": "2026-11-22 00:29 -0500",
    "commits": [
      "40f02f4"
    ],
    "request": "Remove filler copy throughout CAPS and compact Recovery/questionnaire/Progress.",
    "changes": [
      "Remove generic Settings/Account/Athlete subtitles and retain actual controls.",
      "Presentation only; data, calculations and validation remain."
    ]
  },
      {
        "n": 4,
        "name": "Sidebar screens",
        "date": "2026-11-23 12:47 -0500",
        "commits": [
          "8225102"
        ],
        "request": "Centralize biometric editing in modals, use intuitive date/settings navigation, and share training hub components.",
        "changes": [
          "Use the existing menu icon on settings headers and drawer X for guarded exit to the remembered main tab.",
          "Remove global log-time selectors from settings pages."
        ]
      }
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
        links: [
          "architecture:theme",
          "architecture:simple-switch",
          "architecture:feedback-engine",
          "architecture:app-state",
          "architecture:menu-button"
        ],
        versions: [
  {
    "n": 1,
    "name": "SettingsScreen",
    "date": "2026-07-18 13:55 -0400",
    "commits": [
      "edd48ce"
    ],
    "changes": [
      "Extracted from `Screens.tsx` into `src/screens/SettingsScreen.tsx`."
    ]
  },
  {
    "n": 2,
    "name": "SettingsScreen",
    "date": "2026-07-21 01:06 -0400",
    "commits": [
      "101ec87",
      "3d09c81"
    ],
    "changes": [
      "Athlete Information settings work (`101ec87`) and the Profile screen pass (`3d09c81`) also touched Settings."
    ]
  },
  {
    "n": 3,
    "name": "SettingsScreen",
    "date": "2026-07-22 02:58 -0400",
    "commits": [
      "ad01bfe",
      "2900198"
    ],
    "changes": [
      "UI pass added per-accent CAPS icons (`ad01bfe`). `2900198` was Settings-only follow-up UI."
    ]
  },
  {
    "n": 4,
    "name": "SettingsScreen",
    "date": "2026-10-11 21:40 -0400",
    "commits": [
      "0772f4e"
    ],
    "changes": [
      "Added the shared distance unit setting used by conditioning."
    ]
  },
  {
    "n": 5,
    "name": "SettingsScreen",
    "date": "2026-11-02 22:29 -0500",
    "commits": [
      "6b9fc9a"
    ],
    "request": "Don't forget to also renovate the settings screens accordingly.",
    "changes": [
      "Card-by-card renovation: appearance, units, audio/haptics, and reminder placeholders with large switches and 48px targets."
    ]
  },
  {
    "n": 6,
    "name": "SettingsScreen",
    "date": "2026-11-20 17:46 -0500",
    "request": "Audit all five tabs: simple weight input, compact scrolling log-time modal, safe consistent subscreen bars and branch navigation.",
    "changes": [
      "Shared fixed header/footer return to previous main tab; autosave settings preserved."
    ],
    "commits": [
      "b971c0d"
    ]
  },
  {
    "n": 7,
    "name": "SettingsScreen",
    "date": "2026-11-22 00:29 -0500",
    "commits": [
      "40f02f4"
    ],
    "request": "Remove filler copy throughout CAPS and compact Recovery/questionnaire/Progress.",
    "changes": [
      "Remove redundant subtitle.",
      "Presentation only; data, calculations and validation remain."
    ]
  },
          {
            "n": 8,
            "name": "SettingsScreen",
            "date": "2026-11-23 12:47 -0500",
            "commits": [
              "8225102"
            ],
            "request": "Centralize biometric editing in modals, use intuitive date/settings navigation, and share training hub components.",
            "changes": [
              "Open the existing sidebar from the settings header; retain normal data controls and existing close/draft guards.",
              "Omit global logging time controls from the settings context."
            ]
          }
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
        links: [
          "architecture:app-state",
          "home:home-screen",
          "architecture:menu-button"
        ],
        versions: [
  {
    "n": 1,
    "name": "AccountInfoScreen",
    "date": "2026-07-18 13:55 -0400",
    "commits": [
      "edd48ce"
    ],
    "changes": [
      "Created as a separate sidebar screen."
    ]
  },
  {
    "n": 2,
    "name": "AccountInfoScreen",
    "date": "2026-07-21 01:06 -0400",
    "commits": [
      "3d09c81"
    ],
    "changes": [
      "Started the Profile/Account identity fields."
    ]
  },
  {
    "n": 3,
    "name": "AccountInfoScreen",
    "date": "2026-11-02 22:29 -0500",
    "commits": [
      "6b9fc9a"
    ],
    "changes": [
      "Renovated to ACTIVE ACCOUNT TELEMETRY plus USERNAME & CALLSIGN with preset chips and suffix steps."
    ]
  },
  {
    "n": 4,
    "name": "AccountInfoScreen",
    "date": "2026-11-20 17:46 -0500",
    "request": "Audit all five tabs: simple weight input, compact scrolling log-time modal, safe consistent subscreen bars and branch navigation.",
    "changes": [
      "Shared safe header and fixed Cancel/Reset/Save footer with unsaved username guards."
    ],
    "commits": [
      "b971c0d"
    ]
  },
  {
    "n": 5,
    "name": "AccountInfoScreen",
    "date": "2026-11-22 00:29 -0500",
    "commits": [
      "40f02f4"
    ],
    "request": "Remove filler copy throughout CAPS and compact Recovery/questionnaire/Progress.",
    "changes": [
      "Remove redundant subtitle.",
      "Presentation only; data, calculations and validation remain."
    ]
  },
          {
            "n": 6,
            "name": "AccountInfoScreen",
            "date": "2026-11-23 12:47 -0500",
            "commits": [
              "8225102"
            ],
            "request": "Centralize biometric editing in modals, use intuitive date/settings navigation, and share training hub components.",
            "changes": [
              "Open the existing sidebar from the settings header; retain normal data controls and existing close/draft guards.",
              "Omit global logging time controls from the settings context."
            ]
          }
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
        tagline: "Interactive biometric overview and combat sports",
        files: [
          "src/screens/AthleteInfoScreen.tsx",
          "src/components/BiometricEditModal.tsx",
          "src/data/athleteProfileStorage.ts",
          "src/utils/athleteProfile.ts",
          "src/utils/biometrics.ts"
        ],
        entry: "Sidebar > Athlete Information.",
        summary:
          "One Biometric Overview shows current age, sex, bodyweight and height. Each tile opens its specialized shared-foundation dialog; there are no duplicate standalone biometric editors. DOB, sex, height and sports persist as non-weight profile settings. Bodyweight opens the exact canonical Home weight modal and remains owned by weight history. The only separate profile section is combat sports. Header uses the existing sidebar menu with no log timestamp.",
        modes: [
          {
            "name": "Metric",
            "detail": "Weight input kg; vertical height picker in cm, stored as canonical cm."
          },
          {
            "name": "Imperial",
            "detail": "Weight input lb; independent side-by-side feet/inches wheels with inches 0–11; canonical cm retained."
          }
        ],
        guardrails: [
          "Centralize biometric editing in the interactive overview and explicitly requested dialogs; do not restore duplicate standalone cards or age/height steppers (user request, 23 November 2026).",
          "Store DOB and derive age; do not fabricate an exact birth date from a legacy age.",
          "Keep weight history-owned: profile changes must not create weight logs or rewrite older events.",
          "Preserve existing profile drafts and guard navigation while persistence is pending."
        ],
        links: [
          "architecture:app-state",
          "home:weight-log",
          "database:table-weight-logs",
          "database:athlete-profile-kv",
          "architecture:form-modal"
        ],
        versions: [
  {
    "n": 1,
    "name": "AthleteInfoScreen",
    "date": "2026-07-18 13:55 -0400",
    "commits": [
      "edd48ce"
    ],
    "request": "Later the same day: \"I dont WANT to keep my athlete info screen, i want to revert to what i had before it all.\" The screen remained; history was tangled by a GitHub README commit vs local work.",
    "changes": [
      "Created the Athlete Information sidebar screen."
    ]
  },
  {
    "n": 2,
    "name": "AthleteInfoScreen",
    "date": "2026-07-20 22:58 -0400",
    "commits": [
      "37c812d",
      "101ec87"
    ],
    "changes": [
      "`37c812d` was Boilerplate #3 during the 07-18/20 reset sequence.",
      "`101ec87` created the Athlete Information settings fields."
    ]
  },
  {
    "n": 3,
    "name": "AthleteInfoScreen",
    "date": "2026-07-24 22:09 -0400",
    "commits": [
      "3d09c81",
      "5904f45",
      "5833c71"
    ],
    "changes": [
      "Profile work (`3d09c81`) and Quick Log (`5904f45`) also touched this screen.",
      "Unified `weightKg` with Home (`5833c71`)."
    ]
  },
  {
    "n": 4,
    "name": "AthleteInfoScreen",
    "date": "2026-11-02 22:31 -0500",
    "commits": [
      "ce8f0d6"
    ],
    "request": "Renovated with the rest of the settings screens: card-by-card steppers and scroll presets.",
    "changes": [
      "Rebuilt as BIOMETRIC OVERVIEW plus sex, age, bodyweight, stature, and sports cards with steppers and presets."
    ]
  },
  {
    "n": 5,
    "name": "Shared height formatting",
    "date": "2026-11-16 00:18 -0500",
    "commits": [
      "24a301f"
    ],
    "changes": [
      "Share Home and Athlete Information formatting and use one conversion for imperial edits."
    ]
  },
  {
    "n": 6,
    "name": "AthleteInfoScreen",
    "date": "2026-11-20 17:46 -0500",
    "request": "Audit all five tabs: simple weight input, compact scrolling log-time modal, safe consistent subscreen bars and branch navigation.",
    "changes": [
      "Direct decimal bodyweight field replaces weight increments/presets.",
      "Header clock sets performed time; fixed Cancel/Log footer and unlogged-weight close guard."
    ],
    "commits": [
      "b971c0d"
    ]
  },
  {
    "n": 7,
    "name": "AthleteInfoScreen",
    "date": "2026-11-22 00:29 -0500",
    "commits": [
      "40f02f4"
    ],
    "request": "Remove filler copy throughout CAPS and compact Recovery/questionnaire/Progress.",
    "changes": [
      "Remove redundant subtitle and use -- for missing age.",
      "Presentation only; data, calculations and validation remain."
    ]
  },
          {
            "n": 8,
            "name": "AthleteInfoScreen",
            "date": "2026-11-23 12:48 -0500",
            "commits": [
              "65e148a"
            ],
            "request": "Centralize biometric editing in modals, use intuitive date/settings navigation, and share training hub components.",
            "changes": [
              "Make all four overview tiles interactive and remove redundant standalone biometric editors.",
              "Persist non-weight profile fields with validated partial updates; share the canonical weight dialog with Home."
            ]
          }
],
        children: [
          {
            id: "biometric-overview",
            title: "Biometric overview",
            kind: "card",
            tagline: "Press age, sex, bodyweight or height to edit",
            files: ["src/screens/AthleteInfoScreen.tsx"],
            summary: "Individually pressable tiles show the saved profile values with normal press feedback. Age is calculated from DOB using the current local date; legacy age is preserved until DOB is explicitly chosen. Successful saves immediately update shared state.",
            links: [
              "architecture:form-modal"
            ],
            children: [
              {
                "id": "date-of-birth-modal",
                "title": "Date of Birth modal",
                "kind": "modal",
                "status": "active",
                "tagline": "Scrollable day, month and year",
                "files": [
                  "src/components/BiometricEditModal.tsx",
                  "src/components/FormModal.tsx"
                ],
                "summary": "The Age tile opens three independently scrollable date columns initialized from the stored DOB. Allowed years span the current year minus 120 through today; month/day choices clamp to real dates and exclude the future. Save persists dateOfBirth and derives age; Cancel leaves the profile unchanged. A legacy age only seeds an unsaved draft, never an invented persisted birthday.",
                "links": [
                  "architecture:form-modal",
                  "architecture:scroll-picker",
                  "database:athlete-profile-kv"
                ],
                "versions": [
                  {
                    "n": 1,
                    "name": "Date of Birth modal",
                    "date": "2026-11-23 12:48 -0500",
                    "commits": [
                      "65e148a"
                    ],
                    "request": "Centralize biometric editing in modals, use intuitive date/settings navigation, and share training hub components.",
                    "changes": [
                      "Store and edit DOB rather than directly incrementing age; validate actual dates and future bounds."
                    ]
                  }
                ]
              },
              {
                "id": "sex-selection-modal",
                "title": "Sex selection modal",
                "kind": "modal",
                "status": "active",
                "tagline": "Minimal Male / Female choice",
                "files": [
                  "src/components/BiometricEditModal.tsx",
                  "src/components/FormModal.tsx"
                ],
                "summary": "The Sex tile opens Male/Female options with the current value selected. Save persists the existing sex field; Cancel discards the local draft. Shared pending/error handling keeps the dialog open on persistence failure.",
                "links": [
                  "architecture:form-modal",
                  "architecture:scroll-picker",
                  "database:athlete-profile-kv"
                ],
                "versions": [
                  {
                    "n": 1,
                    "name": "Sex selection modal",
                    "date": "2026-11-23 12:48 -0500",
                    "commits": [
                      "65e148a"
                    ],
                    "request": "Centralize biometric editing in modals, use intuitive date/settings navigation, and share training hub components.",
                    "changes": [
                      "Replace the standalone sex card with a minimal modal reached from the overview tile."
                    ]
                  }
                ]
              },
              {
                "id": "bodyweight-modal",
                "title": "WeightLogModal",
                "ref": "home:weight-log",
                "note": "Same canonical actual Modal as Home Quick Log and timeline editing."
              },
              {
                "id": "height-selection-modal",
                "title": "Height selection modal",
                "kind": "modal",
                "status": "active",
                "tagline": "cm or independent feet/inches wheels",
                "files": [
                  "src/components/BiometricEditModal.tsx",
                  "src/components/FormModal.tsx"
                ],
                "summary": "Metric height scrolls through 60–275 cm. Imperial uses independent side-by-side feet (2–9) and inches (0–11) columns. The shared helper rounds total inches before splitting: 60 cm displays as 2 ft 0 in. Saved height initializes both wheels, and an unchanged Save preserves exact original centimetres rather than rewriting the rounded display conversion.",
                "guardrails": ["Execute the shared conversion helper before changing picker bounds; 60 cm rounds to 2 ft 0 in and does not require a 1 ft option (Android QA audit correction, 24 November 2026)."],
                "links": [
                  "architecture:form-modal",
                  "architecture:scroll-picker",
                  "database:athlete-profile-kv"
                ],
                "versions": [
                  {
                    "n": 1,
                    "name": "Height selection modal",
                    "date": "2026-11-23 12:48 -0500",
                    "commits": [
                      "65e148a"
                    ],
                    "request": "Centralize biometric editing in modals, use intuitive date/settings navigation, and share training hub components.",
                    "changes": [
                      "Use scrollable measurements without step buttons; validate converted height and preserve unchanged canonical precision."
                    ]
                  },
                  {
                    "n": 2,
                    "name": "Height selection modal",
                    "date": "2026-11-24 18:00 -0500",
                    "commits": ["080eb08"],
                    "request": "Test the biometric pickers on Android and fix boundary or persistence issues.",
                    "changes": [
                      "Temporarily added a 1 ft option and altered validation after an incorrect audit assumption about 60 cm conversion.",
                      "The actual helper rounds 60 cm to 2 ft 0 in; the unnecessary change was restored in the next QA iteration."
                    ]
                  },
                  {
                    "n": 3,
                    "name": "Height selection modal",
                    "date": "2026-11-24 18:25 -0500",
                    "commits": ["760688b"],
                    "request": "Test the biometric pickers on Android and retain correct height conversion and persistence.",
                    "changes": [
                      "Restore the existing 2–9 ft picker and validation after executing the actual conversion helper.",
                      "Add a regression fixture confirming that 60 cm rounds to 2 ft 0 in.",
                      "Android QA confirmed metric 60 cm Save, imperial 2 ft 0 in initialization and unchanged Save."
                    ]
                  }
                ]
              }
            ],
            versions: [
              {
                n: 1,
                name: "Biometric overview",
                date: "2026-11-02 22:31 -0500",
                commits: ["ce8f0d6"],
                changes: ["Added the overview card."],
              },
              {
                "n": 2,
                "name": "Biometric overview",
                "date": "2026-11-23 12:48 -0500",
                "commits": [
                  "65e148a"
                ],
                "request": "Centralize biometric editing in modals, use intuitive date/settings navigation, and share training hub components.",
                "changes": [
                  "Turn the existing readout into the only biometric editing entrypoint on Athlete Information.",
                  "Show current values immediately after successful saves and preserve them on Cancel."
                ]
              },
            ],
          },
          {
            id: "athlete-fields",
            title: "Combat sports",
            kind: "group",
            tagline: "Multi-select sport chips",
            files: ["src/screens/AthleteInfoScreen.tsx"],
            summary:
              "The remaining standalone profile section selects combat sports. Biometric fields moved into the interactive overview dialogs; those old standalone cards are removed.",
            parts: [
              {
                "name": "Combat sports",
                "detail": "Multi-select chips persist through the non-weight profile update path."
              }
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
              {
                "n": 3,
                "name": "Combat sports",
                "date": "2026-11-23 12:48 -0500",
                "commits": [
                  "65e148a"
                ],
                "request": "Centralize biometric editing in modals, use intuitive date/settings navigation, and share training hub components.",
                "changes": [
                  "Remove standalone Sex, Age, Bodyweight and Height cards; retain combat sports only."
                ]
              },
            ],
          },
        ],
      },
    ],
  },
};
