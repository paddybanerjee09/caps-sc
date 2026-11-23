# Settings

The header hamburger opens the sidebar destinations `settings`, `accountInfo`, and `athleteInfo`. They are separate from the bottom tabs and resolve through `src/navigation/routes.ts`, `src/navigation/AppNavigator.tsx`, and `src/screens/Screens.tsx`. Read [[App Architecture]] for provider and navigation ownership.

## Settings screen

| Card | Behavior in `src/screens/SettingsScreen.tsx` | State owner |
| --- | --- | --- |
| Appearance & contrast | Switch light and dark or select a tertiary accent swatch | `src/theme/ThemeContext.tsx` (`AppThemeProvider`) |
| Measurement units | Independently switch distance km/mi, weight kg/lb, and height cm/ft+in | `src/state/AppStateContext.tsx` (`unitSettings`) |
| Audio cues & haptics | Independently enable synthesized cues and haptics | `AppStateContext` updates the module-level preferences consumed by `src/utils/feedback.ts` |
| Notifications & reminders | Weigh-in, training, and hydration switches are placeholders | Screen-local `useState`. There is no scheduler or storage path for these switches. |

The current providers keep appearance, unit, and feedback preferences in memory; the Athlete profile itself is durable as of 23 November. Unit switches change input and display conversions. Preserve kilograms for weight records, centimeters for profile height, and seconds/meters/kilograms in [[Conditioning]]. `src/utils/height.ts` serves Home and Athlete Information. Imperial height uses feet/inches wheels and existing conversion, preserving the original cm if its rounded selection was unchanged. See also `src/utils/weight.ts` and `src/conditioning/units.ts`.

## Account Information

`src/screens/AccountInfoScreen.tsx` shows Active Account Telemetry with the current handle and a 15-character counter. Username & Callsign has presets, suffix chips, optional typing, a draft reset, and Save. Save trims the draft and sets `AppStateContext.username`. This is a device-local display handle in the running app, with no authentication or persistence in this path.

## Athlete Information

`src/screens/AthleteInfoScreen.tsx` has one interactive Biometric Overview with Age, Sex, Bodyweight and Height tiles, plus the existing multi-select sports card. There are no duplicate biometric input cards. `BiometricEditModal` specializes shared FormModal/ScrollPicker primitives for DOB, sex and height; weight uses the app-wide WeightLogModal shared with Home.

Age is calculated from a YYYY-MM-DD DOB and the current local calendar date. DOB wheels independently select day/month/year within the last 120 calendar years, clamping leap/month lengths and excluding future dates. A legacy age is only a fallback until DOB is saved; no exact birthday is inferred or persisted from age. Sex is Male/Female. Height uses cm or side-by-side feet/inches (0–11 inches), with canonical cm retained.

`updateAthleteProfile(patch)` persists only profile-owned JSON via src/data/athleteProfileStorage.ts and merges only edited fields after success. expo-sqlite/kv-store uses database ExpoSQLiteStorage, storage(key TEXT PRIMARY KEY NOT NULL,value TEXT), key caps.athlete-profile.v1. Fields are firstName, lastName, legacy age, dateOfBirth, sex, heightCm and sports. weightKg is excluded from reads/writes. Profile hydration, loading/retry and save errors are explicit. See [[Data and Persistence]].

Bodyweight remains the shared projection of the newest timeline/weight_logs record. Modal save converts input at the boundary, uses the selected local timestamp, and invalidates consumers centrally. Backdating cannot incorrectly replace the current measurement; profile edits create no weight logs. See [[Weight and Sleep Logging]] and [[Timeline and Nutrition Tables]].

## History and guardrails

- `f0f5834` started with inline settings. `edd48ce` split the screens and introduced shared app state. The Feature Tree records a July 18 revert request during the `7f48393` history tangle. Current Athlete Information descends from the later rebuild around `37c812d` and `101ec87`. `3d09c81` added profile work, and `ad01bfe` / `2900198` revised the appearance UI.
- `5833c71` unified Home and Athlete Information weight. `2c0cfb4` guarded the async initial weight read against provider cleanup. Preserve newest-by-log-time semantics when backdating or editing a measurement.
- `d20abb7` persisted a conditioning distance preference through an `athlete_preferences` table on the archived lineage. `0772f4e` introduced the current shared distance setting through `AppStateContext`. Check [[Data and Persistence]] before using archived preference or schema patterns.
- `5c595dd` introduced the feedback engine. `6b9fc9a` renovated Settings and Account Information. `ce8f0d6` introduced the historical standalone cards/steppers. The 23 November user request supersedes that biometric layout and adds explicit shared modal exceptions in `.cursor/rules/ui-style-guide.mdc`.

Source and history reviewed on `main`. Persistence observations are code-derived. Device UI and restart behavior were outside this review.

Related notes: [[Home]], [[Conditioning]], [[Data and Persistence]], [[Project History]], [[Feature Tree Crosswalk]]. Feature Tree: [`settings.html`](../../../docs/feature-tree/settings.html).

## Uniform UI audit (20 November 2026)

All owned subscreens now use shared safe-area headers, branch-wide X, fixed depth-aware Cancel/Back footers, and preserved domain actions. Applicable log timestamps use the header clock and shared scroll-wheel modal; weight/load fields use decimal text input without increments or presets. See [[UI and Interaction Decisions]] for the current contract and [[2026-11-20 UI Audit Review]] for screen/input coverage and verification limits.

## Settings navigation exception (23 November 2026)

All three settings destinations have the shared MenuButton in the header and no global log timestamp. It opens the existing Sidebar; sidebar X exits settings to the remembered main tab, while scrim/hardware Back first dismiss the drawer. Existing guarded account edits and primary workflow header behavior remain. See [[2026-11-23 UI Refactor Handoff]].
