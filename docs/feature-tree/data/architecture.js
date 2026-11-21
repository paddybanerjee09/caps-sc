CAPS.trees.architecture = {
  id: "architecture",
  title: "Architecture",
  summary:
    "App shell, custom state navigation (no Expo Router), providers, shared chrome, theme, feedback, and the feature-tree site. Domain stacks (nutrition, conditioning) hang off `AppNavigator` but are owned by those trees.",
  rules: ["ui-style-guide.mdc", "general-rules.mdc"],
  root: {
    id: "app-root",
    title: "App",
    kind: "app",
    tagline: "index.ts + provider stack",
    files: ["index.ts", "src/App.tsx", "package.json", "app.json"],
    summary:
      "`index.ts` imports `conditioningLocationTask` first so the GPS background task is registered, then `registerRootComponent(App)`. `App` nests SafeAreaProvider → SQLiteProvider(`caps.db`, `migrateDatabase`) → AppThemeProvider → AppStateProvider → NutritionWorkspaceProvider → ConditioningWorkspaceProvider → AppNavigator.",
    guardrails: [
      "Keep `src/services/conditioningLocationTask` imported from `index.ts` so the GPS task stays registered (conditioning-execution.mdc).",
      "Do not put Expo Router back; navigation is custom state in `routes.ts` / `AppNavigator` / `Screens.tsx` (f0f5834).",
    ],
    links: ["database:caps-db", "nutrition:nutrition-workspace", "conditioning:conditioning-workspace"],
    versions: [
      {
        n: 1,
        name: "Expo Router app",
        date: "2026-06-30 17:54 -0400",
        commits: ["c88eab6", "e9ddbfb"],
        changes: [
          "Initial Expo Router tab app (`c88eab6`), then the five-tab boilerplate (`e9ddbfb`).",
        ],
      },
      {
        n: 2,
        name: "Custom-nav App",
        date: "2026-07-02 00:35 -0400",
        commits: ["f0f5834"],
        changes: [
          "Removed Expo Router. Added `src/App.tsx`, `index.ts`, and the custom navigator.",
        ],
      },
      {
        n: 3,
        name: "App",
        date: "2026-07-22 16:49 -0400",
        commits: ["edd48ce", "59dd4e8", "5d1ccde"],
        changes: [
          "Added `AppStateProvider` (`edd48ce`) and `SQLiteProvider` (`5d1ccde`, after `59dd4e8` first added `database.ts`).",
        ],
      },
      {
        n: 4,
        name: "App",
        date: "2026-10-11 21:40 -0400",
        commits: ["ce2ba31", "7e20d09"],
        changes: [
          "Mounted `NutritionWorkspaceProvider` above the tabs (`ce2ba31`) and `ConditioningWorkspaceProvider` (`7e20d09`).",
        ],
      },
    ],
    children: [
      {
        id: "expo-sdk",
        title: "Expo SDK dependencies",
        kind: "config",
        status: "active",
        tagline: "SDK 58 / React 19.3 / React Native 0.88",
        files: ["package.json", "package-lock.json", "app.json", "src/components/DayTimeline.tsx", "src/navigation/AppNavigator.tsx", "src/screens/SkillScreen.tsx", "src/screens/StrengthTrainingScreen.tsx"],
        summary: "Expo-compatible versions are selected with expo install. The SDK 58 upgrade regenerated the stale lockfile, aligned React types and ESLint config, declared native asset/font peers, and migrated removed config and strict React Native types. Native device verification remains separate from type and bundling checks.",
        guardrails: ["Keep peer dependency checks enabled; the picker does not require react-native-windows for Android/iOS (SDK 58 upgrade)."],
        versions: [
          {
            n: 1,
            name: "SDK 58 dependency alignment",
            date: "2026-11-19 23:39 -0500",
            commits: ["9826e16"],
            request: "Resolve ERESOLVE when aligning dependencies after upgrading to Expo SDK 58.",
            changes: [
              "Regenerated the stale SDK 57 lockfile and installed the SDK 58 dependency set without force or legacy peer resolution.",
              "Aligned React types and Expo ESLint config; declared expo-font and expo-asset as direct dependencies.",
              "Migrated ScrollView instance refs and empty-list props; removed obsolete status-bar and edge-to-edge settings.",
            ],
          },
        ],
      },
      {
        id: "app-navigator",
        title: "AppNavigator",
        kind: "component",
        tagline: "Header, screen, stacks, tabs, sidebar",
        files: ["src/navigation/AppNavigator.tsx"],
        summary:
          "Owns `activeRoute` and `sidebarOpen`. Renders Header, `ScreenForRoute`, then `NutritionStack` when the nutrition tab is active and `ConditioningStack` when the conditioning tab is active, then BottomTabs and Sidebar. Hardware back closes the sidebar, then the active workspace, then exits.",
        versions: [
          {
            "n": 1,
            "name": "AppNavigator",
            "date": "2026-07-02 00:35 -0400",
            "commits": [
              "f0f5834"
            ],
            "changes": [
              "Added the custom navigator shell."
            ]
          },
          {
            "n": 2,
            "name": "AppNavigator",
            "date": "2026-10-11 21:40 -0400",
            "commits": [
              "1d7f792",
              "7e20d09"
            ],
            "changes": [
              "Hosted the nutrition stack overlay (`1d7f792`) and the conditioning stack (`7e20d09`)."
            ]
          },
          {
            "n": 3,
            "name": "AppNavigator",
            "date": "2026-11-02 22:26 -0500",
            "commits": [
              "5c595dd"
            ],
            "changes": [
              "Chrome renovation: header, tabs, and sidebar wired through the feedback engine."
            ]
          },
          {
            "n": 4,
            "name": "Shared route selection",
            "date": "2026-11-16 00:18 -0500",
            "commits": [
              "2073f65"
            ],
            "changes": [
              "Use the same callback for bottom tabs, sidebar destinations, and Home’s request to open Nutrition."
            ]
          },
          {
            "n": 5,
            "name": "AppNavigator",
            "date": "2026-11-20 17:46 -0500",
            "request": "Audit all five tabs: simple weight input, compact scrolling log-time modal, safe consistent subscreen bars and branch navigation.",
            "changes": [
              "Sidebar branches return to the last main tab and own their safe-area header.",
              "Hardware Back respects profile draft guards."
            ],
            "commits": [
              "b971c0d"
            ]
          }
        ],
        children: [
          {
            id: "header",
            title: "Header",
            kind: "component",
            tagline: "CAPS mark + hamburger",
            files: ["src/components/Header.tsx"],
            summary: "Top bar. Hamburger opens the sidebar. Accent-colored CAPS icon follows `tertiaryColor`.",
            versions: [
              {
                n: 1,
                name: "Header",
                date: "2026-07-02 00:35 -0400",
                commits: ["f0f5834"],
                changes: ["Added the header."],
              },
              {
                n: 2,
                name: "Header",
                date: "2026-07-22 02:53 -0400",
                commits: ["ad01bfe"],
                changes: ["Per-accent CAPS icons."],
              },
              {
                n: 3,
                name: "Header",
                date: "2026-11-02 22:26 -0500",
                commits: ["9fc0f73", "5c595dd"],
                changes: ["SDK 57 repairs (`9fc0f73`) and the chrome renovation (`5c595dd`)."],
              },
            ],
          },
          {
            id: "screen-wrapper",
            title: "Screen",
            kind: "component",
            tagline: "Shared screen chrome",
            files: ["src/components/Screen.tsx", "src/components/ScreenTitleCard.tsx"],
            summary: "Uniform left-aligned ScreenTitleCard and a padded ScrollView. The same title card is used directly by Skill, Strength and Conditioning. Screens must not be extracted into a generic Card wrapper.",
            guardrails: [
              "Do not extract a global `<Card />` across screens; each screen owns its card markup (ui-style-guide.mdc).",
            ],
            versions: [
              {
                "n": 1,
                "name": "Screen",
                "date": "2026-07-02 00:35 -0400",
                "commits": [
                  "f0f5834"
                ],
                "changes": [
                  "Added the shared screen wrapper."
                ]
              },
              {
                "n": 2,
                "name": "Screen",
                "date": "2026-07-22 02:53 -0400",
                "commits": [
                  "edd48ce",
                  "ad01bfe"
                ],
                "changes": [
                  "Added `centerTitle` in the UI pass."
                ]
              },
              {
                "n": 3,
                "name": "Screen",
                "date": "2026-11-02 22:26 -0500",
                "commits": [
                  "5c595dd"
                ],
                "changes": [
                  "High-contrast chrome renovation."
                ]
              },
              {
                "n": 4,
                "name": "Screen",
                "date": "2026-11-20 16:53 -0500",
                "commits": [
                  "43eab3a"
                ],
                "request": "Uniform Strength-style title cards and balanced Home information and Quick Log layout.",
                "changes": [
                  "ScreenTitleCard owns the Strength-style accent bar, left-aligned title and subtitle across Home, Nutrition, Skill, Strength and Conditioning.",
                  "Screen delegates its header and removes centered title variants."
                ]
              },
              {
                "n": 5,
                "name": "Screen",
                "date": "2026-11-20 17:46 -0500",
                "request": "Audit all five tabs: simple weight input, compact scrolling log-time modal, safe consistent subscreen bars and branch navigation.",
                "changes": [
                  "Screen optionally composes fixed WorkflowHeader/WorkflowFooter around scrolling sidebar content."
                ],
                "commits": [
                  "b971c0d"
                ]
              }
            ],
          },
          {
            id: "bottom-tabs",
            title: "BottomTabs",
            kind: "component",
            tagline: "Five tabs",
            files: ["src/components/BottomTabs.tsx"],
            summary:
              "Nutrition, Skills Training, Home, Strength, Conditioning. Home is the initial route. Uses `feedbackSelection` on change.",
            links: ["architecture:routes"],
            versions: [
              {
                n: 1,
                name: "BottomTabs",
                date: "2026-07-02 00:35 -0400",
                commits: ["f0f5834"],
                changes: ["Custom tab bar replaced Expo Router tabs."],
              },
              {
                n: 2,
                name: "BottomTabs",
                date: "2026-07-22 16:45 -0400",
                commits: ["d0c1116", "dd88e65", "59dd4e8"],
                changes: [
                  "Early icon tweak (`d0c1116`). Strength / Conditioning labels (`dd88e65`). Skills Training rename (`59dd4e8`).",
                ],
              },
              {
                n: 3,
                name: "BottomTabs",
                date: "2026-11-02 22:26 -0500",
                commits: ["5c595dd"],
                changes: ["Feedback ticks on tab changes."],
              },
              {
                n: 4,
                name: "BottomTabs",
                date: "2026-11-20 16:58 -0500",
                commits: ["52d6ba2"],
                request: "Reduce all five tab labels equally until Conditioning fits on one line.",
                changes: ["Reduce the shared label font from 10px to 9px and line height from 12px to 11px.", "Desktop Arial bold measurement at 360px width favors 9px over the marginal 9.5px; native device confirmation remains outstanding."],
              },
            ],
          },
          {
            id: "sidebar",
            title: "Sidebar",
            kind: "component",
            tagline: "Settings, Account, Athlete",
            files: ["src/components/Sidebar.tsx"],
            summary: "Hamburger drawer listing `sidebarItems` from `routes.ts`.",
            links: ["settings:settings-root"],
            versions: [
              {
                n: 1,
                name: "Sidebar",
                date: "2026-07-02 00:35 -0400",
                commits: ["f0f5834"],
                changes: ["Added the sidebar."],
              },
              {
                n: 2,
                name: "Sidebar",
                date: "2026-07-20 22:58 -0400",
                commits: ["101ec87"],
                changes: ["Athlete Information row wiring."],
              },
              {
                n: 3,
                name: "Sidebar",
                date: "2026-11-02 22:26 -0500",
                commits: ["9fc0f73", "5c595dd"],
                changes: ["SDK repairs and chrome renovation."],
              },
            ],
          },
          {
            id: "nav-nutrition-stack",
            ref: "nutrition:nutrition-stack",
            note: "Overlay when the Nutrition tab is active",
          },
          {
            id: "nav-conditioning-stack",
            ref: "conditioning:conditioning-stack",
            note: "Overlay when the Conditioning tab is active",
          },
        ],
      },
      {
        id: "routes",
        title: "routes.ts + Screens.tsx",
        kind: "config",
        tagline: "Tab and sidebar route table",
        files: ["src/navigation/routes.ts", "src/screens/Screens.tsx"],
        summary:
          "`tabs` and `sidebarItems` are the only route catalogs. `ScreenForRoute` switches on `RouteKey`. `initialRoute` is `home`.",
        versions: [
          {
            n: 1,
            name: "routes",
            date: "2026-07-02 00:35 -0400",
            commits: ["f0f5834"],
            changes: ["Introduced `routes.ts` and `Screens.tsx`."],
          },
          {
            n: 2,
            name: "routes",
            date: "2026-07-22 16:45 -0400",
            commits: ["edd48ce", "dd88e65", "59dd4e8"],
            changes: [
              "Split files per screen (`edd48ce`), Strength/Conditioning labels (`dd88e65`), skill route (`59dd4e8`).",
            ],
          },
        ],
      },
      {
        id: "shared-controls",
        title: "Shared controls",
        kind: "group",
        tagline: "Shared press, toggle, time and workflow controls",
        files: [
          "src/components/PressOpacity.tsx",
          "src/components/SimpleSwitch.tsx",
          "src/components/LogTimeChanger.tsx",
        ],
        summary:
          "Shared interaction primitives enforce uniform press feedback, toggles, logging time and subscreen bars across the five tabs.",
        children: [
          {
            id: "press-opacity",
            title: "PressOpacity",
            kind: "component",
            tagline: "Press opacity 0.62 + optional feedback",
            files: ["src/components/PressOpacity.tsx"],
            summary: "Touchable wrapper. Immediate opacity change (`pressedOpacity = 0.62`) and optional silent mode.",
            versions: [
              {
                n: 1,
                name: "PressOpacity",
                date: "2026-07-02 00:35 -0400",
                commits: ["f0f5834"],
                changes: ["Added the press wrapper."],
              },
              {
                n: 2,
                name: "PressOpacity",
                date: "2026-11-02 22:26 -0500",
                commits: ["ce2ba31", "50427a5", "5c595dd"],
                changes: ["Workspace/calendar tweaks, then feedback-aware chrome renovation."],
              },
            ],
          },
          {
            id: "simple-switch",
            title: "SimpleSwitch",
            kind: "component",
            tagline: "Themed boolean switch",
            files: ["src/components/SimpleSwitch.tsx"],
            summary: "Used by Settings for scheme, units, and cue toggles.",
            versions: [
              {
                n: 1,
                name: "SimpleSwitch",
                date: "2026-07-02 00:35 -0400",
                commits: ["f0f5834"],
                changes: ["Added the switch."],
              },
              {
                n: 2,
                name: "SimpleSwitch",
                date: "2026-11-02 22:26 -0500",
                commits: ["5c595dd"],
                changes: ["High-contrast restyle with feedback."],
              },
            ],
          },
          {
            id: "log-time-changer",
            title: "LogTimeChanger",
            kind: "component",
            tagline: "Compact header clock and scroll-wheel modal",
            files: ["src/components/LogTimeChanger.tsx"],
            summary:
              "Shared compact clock/time trigger for every logging flow. Opens Log Time with local-day arrows, hour/minute wheels and Cancel/Done; caller bounds and duration calculations remain owned by each flow.",
            modes: [
              {
                "name": "Header button",
                "detail": "Clock icon and selected 24-hour time; no inline/card/increment variant."
              },
              {
                "name": "Log Time modal",
                "detail": "Scrollable hours/minutes with local-day navigation, cancellation and bounded confirmation."
              }
            ],
            guardrails: [
              "Never restore weight/time increments, presets or body log-time cards (user correction, 20 November 2026).",
              "Put the shared trigger in the header right and preserve caller date bounds (ui-style-guide.mdc section 8)."
            ],
            versions: [
              {
                "n": 1,
                "name": "LogTimeChanger",
                "date": "2026-07-28 23:28 -0400",
                "commits": [
                  "3232443",
                  "859b4aa",
                  "d94e5c3"
                ],
                "changes": [
                  "Extracted from the weight picker (`3232443`), reused for sleep (`859b4aa`), then as a separate time control (`d94e5c3`)."
                ]
              },
              {
                "n": 2,
                "name": "LogTimeChanger",
                "date": "2026-10-05 22:38 -0400",
                "commits": [
                  "9fc0f73",
                  "ce2ba31",
                  "39add05"
                ],
                "changes": [
                  "SDK repairs, workspace mount tweaks, and the compact meal-header pill (`39add05`)."
                ]
              },
              {
                "n": 3,
                "name": "LogTimeChanger",
                "date": "2026-11-02 22:36 -0500",
                "commits": [
                  "e8fc8e9",
                  "67d99b6"
                ],
                "changes": [
                  "Stepper time controls in the Home renovation."
                ]
              },
              {
                "n": 4,
                "name": "LogTimeChanger",
                "date": "2026-11-20 17:46 -0500",
                "request": "Audit all five tabs: simple weight input, compact scrolling log-time modal, safe consistent subscreen bars and branch navigation.",
                "changes": [
                  "Replaced all time cards, increments and presets with a compact header clock/time button.",
                  "Log Time modal has local-day arrows, independent hour/minute wheels, Cancel and Done with caller date bounds."
                ],
                "commits": [
                  "2a8f16d"
                ]
              }
            ],
          },

            {
              "id": "workflow-chrome",
              "title": "WorkflowHeader and WorkflowFooter",
              "kind": "component",
              "status": "active",
              "tagline": "Safe fixed bars and branch navigation",
              "files": [
                "src/components/WorkflowChrome.tsx"
              ],
              "summary": "One header/footer contract across all subscreens. Centered title, safe top inset, branch-wide X, optional right-hand clock. Fixed footer uses Cancel at first depth and Back deeper, next to existing actions.",
              "guardrails": [
                "Apply top safe inset exactly once; Home overlays use their already-inset parent.",
                "X exits the entire branch with existing guards; footer Back pops one level and preserves parent drafts."
              ],
              "versions": [
                {
                  "n": 1,
                  "name": "Shared subscreen chrome",
                  "date": "2026-11-20 17:41 -0500",
                  "uncommitted": true,
                  "changes": [
                    "Standardized subscreen headers and footers across five tabs and sidebar branches."
                  ]
                }
              ]
            }
          ],
      },
      {
        id: "app-state",
        title: "AppStateContext",
        kind: "state",
        tagline: "Profile, units, cues, weight logs",
        files: ["src/state/AppStateContext.tsx"],
        summary:
          "Username, athlete profile, unit settings, audio/haptic flags, and weight-log helpers. Nutrition and conditioning have their own workspace contexts.",
        guardrails: [
          "The line-98 `AppStateContext` bug (`2c0cfb4`) was a stale closure / update error. Do not reintroduce it.",
        ],
        versions: [
          {
            n: 1,
            name: "AppStateContext",
            date: "2026-07-18 13:55 -0400",
            commits: ["edd48ce"],
            changes: ["Added the app-wide state context."],
          },
          {
            n: 2,
            name: "AppStateContext",
            date: "2026-07-25 23:23 -0400",
            commits: ["3d09c81", "5904f45", "5833c71", "3232443"],
            changes: ["Profile, Quick Log, unified `weightKg`, and log deletion helpers."],
          },
          {
            n: 3,
            name: "AppStateContext",
            date: "2026-10-11 21:40 -0400",
            commits: ["2c0cfb4", "0772f4e"],
            changes: [
              "Bug fix (`2c0cfb4`). Shared distance unit (`0772f4e`).",
            ],
          },
          {
            n: 4,
            name: "AppStateContext",
            date: "2026-11-02 22:26 -0500",
            commits: ["5c595dd"],
            changes: ["Audio and haptic flags for the feedback engine."],
          },
        ],
      },
      {
        id: "theme",
        title: "Theme",
        kind: "config",
        tagline: "Tokens + AppThemeProvider",
        files: ["src/theme/theme.ts", "src/theme/ThemeContext.tsx"],
        summary:
          "Dark/light palettes and tertiary accents. `useAppTheme()` is how screens read tokens. High-contrast carbon surfaces from the 11-02 style guide.",
        versions: [
          {
            n: 1,
            name: "Theme",
            date: "2026-07-02 00:35 -0400",
            commits: ["f0f5834"],
            changes: ["Added theme tokens and `ThemeContext`."],
          },
          {
            n: 2,
            name: "Theme",
            date: "2026-07-22 02:53 -0400",
            commits: ["ad01bfe"],
            changes: ["Accent palette and per-color CAPS icons."],
          },
          {
            n: 3,
            name: "Theme",
            date: "2026-11-02 22:20 -0500",
            commits: ["cb31dff"],
            changes: ["High-contrast tokens matching `ui-style-guide.mdc`."],
          },
        ],
      },
      {
        id: "feedback-engine",
        title: "feedback.ts",
        kind: "service",
        tagline: "Haptics + synthesized audio cues",
        files: ["src/utils/feedback.ts"],
        summary:
          "All interaction feedback routes here: `feedbackSelection` / `feedbackStep`, `feedbackConfirm`, `feedbackPhaseCue` / `feedbackCountdownTick`, `feedbackWarn`. Honors Settings audio and haptic flags.",
        guardrails: ["Configure mixWithOthers and await success before playing any cue; never duck or interrupt other apps' audio (20 November 2026 user correction)."],
        versions: [
          {
            n: 1,
            name: "feedback.ts",
            date: "2026-11-02 22:26 -0500",
            commits: ["5c595dd"],
            changes: ["Added the synthesized audio cue and haptic engine and renovated chrome to use it."],
          },
          {
            n: 2,
            name: "Simpler cue generation",
            date: "2026-11-16 00:18 -0500",
            commits: ["2073f65"],
            changes: [
              "Calculate the attack sample count once per cue and remove an unused preferences getter.",
            ],
          },
          {
            n: 3,
            name: "Non-interrupting feedback audio",
            date: "2026-11-20 22:29 -0500",
            commits: ["29c5ad2"],
            request: "Keep feedback sounds from dimming Spotify or interrupting background activity.",
            changes: [
              "Await shared mixWithOthers audio configuration before creating or playing cues on both platforms.",
              "Keep haptics immediate; skip sound on configuration failure, allow retry, and recheck the audio preference after initialization.",
            ],
          },
        ],
      },
      {
        id: "schedule-idle-task",
        title: "scheduleIdleTask",
        kind: "logic",
        tagline: "requestIdleCallback wrapper",
        files: ["src/utils/scheduleIdleTask.ts"],
        summary: "Defers Home and Nutrition loads. Replaced deprecated `InteractionManager`.",
        guardrails: [
          "Do not use `InteractionManager` for deferred loads; use `scheduleIdleTask` (chat e3caa8ec; c8ddb63).",
        ],
        versions: [
          {
            n: 1,
            name: "scheduleIdleTask",
            date: "2026-10-11 00:14 -0400",
            commits: ["c8ddb63"],
            request: "InteractionManager is deprecated; use requestIdleCallback.",
            changes: ["Added `scheduleIdleTask` and switched Home and Nutrition loads to it."],
          },
        ],
      },
      {
        id: "project-readme",
        title: "README.md",
        kind: "config",
        tagline: "Product scope write-ups",
        files: ["README.md"],
        summary:
          "The README is the source for planned-feature groups on the Skills, Strength, Conditioning, and Nutrition trees. Several follow-up README commits only touch this file.",
        versions: [
          {
            n: 1,
            name: "README",
            date: "2026-07-28 12:29 -0400",
            commits: ["39af34b", "9d3b799", "a105192"],
            changes: [
              "Short README fixups (`39af34b`, `9d3b799`) then a 51-line expansion (`a105192`) after the 41b5c4d rewrite.",
            ],
          },
        ],
      },
      {
        id: "style-guide",
        title: "UI style guide",
        kind: "config",
        tagline: "ui-style-guide.mdc",
        files: [".cursor/rules/ui-style-guide.mdc"],
        summary:
          "Theme-based minimalist forms, decimal weight/load fields, shared safe-area headers/footers, compact clock buttons and the explicit Log Time modal exception. Branch X exits all levels; fixed Cancel/Back depends on depth.",
        versions: [
          {
            "n": 1,
            "name": "react-native-patterns skill",
            "date": "2026-11-02 22:19 -0500",
            "commits": [
              "3587129"
            ],
            "request": "Install the spencerpauly react-native-patterns skill.",
            "changes": [
              "Added `.agents/skills/react-native-patterns/SKILL.md`."
            ]
          },
          {
            "n": 2,
            "name": "UI style guide",
            "date": "2026-11-02 22:20 -0500",
            "commits": [
              "cb31dff"
            ],
            "request": "Renovate the app to a card-by-card, stepper-driven, high-contrast architecture.",
            "changes": [
              "Added `.cursor/rules/ui-style-guide.mdc` and the high-contrast theme tokens."
            ]
          },
          {
            "n": 3,
            "name": "UI style guide",
            "date": "2026-11-20 17:46 -0500",
            "request": "Audit all five tabs: simple weight input, compact scrolling log-time modal, safe consistent subscreen bars and branch navigation.",
            "changes": [
              "Replaced mandatory weight steppers with decimal text boxes and documented the requested time-modal exception.",
              "Defined safe centered subscreen bars, branch-wide X and depth-aware fixed Cancel/Back footers."
            ],
            "commits": [
              "2a8f16d"
            ]
          }
        ],
      },
      {
        id: "feature-tree-site",
        title: "Feature tree site",
        kind: "config",
        tagline: "docs/feature-tree working tree",
        files: [
          "docs/feature-tree/",
          "scripts/feature-tree.mjs",
          ".cursor/rules/feature-tree.mdc",
        ],
        summary:
          "Static HTML org-chart of every screen, component, table, and architectural piece, versioned from git. Future feature work must consult and update it.",
        versions: [
          {
            "n": 1,
            "name": "Feature tree site",
            "date": "2026-11-03 02:15 -0500",
            "uncommitted": true,
            "request": "Create a minimalist HTML website as a working tree for every feature/screen/functionality, timestamped from git, with a tree per main screen plus database and architecture.",
            "changes": [
              "Added `docs/feature-tree/` pages and renderer, `scripts/feature-tree.mjs`, and `.cursor/rules/feature-tree.mdc`."
            ]
          },
          {
            "n": 2,
            "name": "Cached search matches",
            "date": "2026-11-16 00:18 -0500",
            "commits": [
              "a7e0fd4"
            ],
            "changes": [
              "Tokenize each query once and reuse the matching node IDs across renders."
            ]
          }
        ],
      },
      {
        id: "arch-v1-archive",
        title: "Reverted shared UI (Sep 14 - Sep 25, 2026)",
        kind: "archive",
        status: "reverted",
        tagline: "AppModalFrame and shared collection UI",
        files: [
          "src/components/AppModalFrame.tsx",
          "src/components/CollectionStateView.tsx",
          "src/components/ResponsiveTileGrid.tsx",
        ],
        summary:
          "Shared wrappers from the reverted Strength/Conditioning v1 and the Sep 18 UI audit. Removed from main on 2026-10-02. The current style guide forbids restoring them as cross-screen abstractions.",
        guardrails: [
          "Do not restore `AppModalFrame`, `CollectionStateView`, or other shared UI wrappers across screens (ui-style-guide.mdc; reverted 2026-10-02).",
        ],
        versions: [
          {
            n: 1,
            name: "Shared adaptation UI",
            date: "2026-09-14 14:20 -0400",
            commits: ["44d4e27"],
            changes: ["Shared adaptation score display and month timeline between Strength and Conditioning."],
          },
          {
            n: 2,
            name: "Log time alignment",
            date: "2026-09-16 13:06 -0400",
            commits: ["beaf2d3"],
            changes: ["Aligned log-time controls across meal and strength modals."],
          },
          {
            n: 3,
            name: "UI redesign audit primitives",
            date: "2026-09-25 09:55 -0400",
            commits: ["9a39461", "c32cb6b", "ba0759f", "a9b40d1", "59a1b23", "6f5d88d", "7fac1fb"],
            changes: [
              "Phase 1–4: ExerciseDB normalization, collection states, timeline presentation resolvers, `AppModalFrame`.",
              "Audit completion (`6f5d88d`) and merge (`7fac1fb`).",
            ],
          },
          {
            n: 4,
            name: "Action menu fixes",
            date: "2026-09-25 10:11 -0400",
            commits: ["741e5a8", "009aff6", "95b4fa1"],
            changes: [
              "Avoided nested virtualized lists (`741e5a8`) and stacked full-width action buttons.",
            ],
          },
        ],
      },
    ],
  },
};
