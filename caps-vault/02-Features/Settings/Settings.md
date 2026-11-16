# Settings

The header hamburger opens the sidebar destinations `settings`, `accountInfo`, and `athleteInfo`. They are separate from the bottom tabs and resolve through `src/navigation/routes.ts`, `src/navigation/AppNavigator.tsx`, and `src/screens/Screens.tsx`. Read [[App Architecture]] for provider and navigation ownership.

## Settings screen

| Card | Behavior in `src/screens/SettingsScreen.tsx` | State owner |
| --- | --- | --- |
| Appearance & contrast | Switch light and dark or select a tertiary accent swatch | `src/theme/ThemeContext.tsx` (`AppThemeProvider`) |
| Measurement units | Independently switch distance km/mi, weight kg/lb, and height cm/ft+in | `src/state/AppStateContext.tsx` (`unitSettings`) |
| Audio cues & haptics | Independently enable synthesized cues and haptics | `AppStateContext` updates the module-level preferences consumed by `src/utils/feedback.ts` |
| Notifications & reminders | Weigh-in, training, and hydration switches are placeholders | Screen-local `useState`. There is no scheduler or storage path for these switches. |

The current providers keep appearance, unit, and feedback preferences in memory. The source review found a discrepancy with the Feature Tree's description of persisted feedback flags. Unit switches change input and display conversions. Preserve kilograms for weight records, centimeters for profile height, and seconds/meters/kilograms in [[Conditioning]]. `src/utils/height.ts` serves Home and Athlete Information. The imperial controls save centimeters to one decimal place and display the nearest whole inch. See also `src/utils/weight.ts` and `src/conditioning/units.ts`.

## Account Information

`src/screens/AccountInfoScreen.tsx` shows Active Account Telemetry with the current handle and a 15-character counter. Username & Callsign has presets, suffix chips, optional typing, a draft reset, and Save. Save trims the draft and sets `AppStateContext.username`. This is a device-local display handle in the running app, with no authentication or persistence in this path.

## Athlete Information

`src/screens/AthleteInfoScreen.tsx` has a biometric overview and individual cards for sex, age, bodyweight, height, and sports. Age and height use steppers and preset strips. Sports is a multi-select chip strip. The sex selection is screen-local. Age, height, and sports update the in-memory `athleteProfile` in `AppStateContext`.

Bodyweight is the durable exception. Save converts the draft from the selected UI unit to kilograms, calls `logWeight(weightKg, Date.now())`, and bumps the [[Home]] timeline revision. `AppStateProvider` loads the most recent stored measurement and refreshes it after weight add, edit, or deletion, so the profile displays the latest row. Keep `weightKg` as that shared projection. See [[Timeline and Nutrition Tables]] for the timeline and weight join.

## History and guardrails

- `f0f5834` started with inline settings. `edd48ce` split the screens and introduced shared app state. The Feature Tree records a July 18 revert request during the `7f48393` history tangle. Current Athlete Information descends from the later rebuild around `37c812d` and `101ec87`. `3d09c81` added profile work, and `ad01bfe` / `2900198` revised the appearance UI.
- `5833c71` unified Home and Athlete Information weight. `2c0cfb4` guarded the async initial weight read against provider cleanup. Preserve newest-by-log-time semantics when backdating or editing a measurement.
- `d20abb7` persisted a conditioning distance preference through an `athlete_preferences` table on the archived lineage. `0772f4e` introduced the current shared distance setting through `AppStateContext`. Check [[Data and Persistence]] before using archived preference or schema patterns.
- `5c595dd` introduced the feedback engine. `6b9fc9a` renovated Settings and Account Information. `ce8f0d6` renovated Athlete Information with screen-local cards, steppers, and presets. `.cursor/rules/ui-style-guide.mdc` calls for inline choices and reserves overlays for the documented exceptions. Keep profile fields and settings out of data-entry modals.

Source and history reviewed on `main`. Persistence observations are code-derived. Device UI and restart behavior were outside this review.

Related notes: [[Home]], [[Conditioning]], [[Data and Persistence]], [[Project History]], [[Feature Tree Crosswalk]]. Feature Tree: [`settings.html`](../../../docs/feature-tree/settings.html).
