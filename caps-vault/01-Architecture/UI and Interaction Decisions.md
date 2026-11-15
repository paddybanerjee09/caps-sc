# UI and interaction decisions

## Current conventions

- The always-on UI requirements are in `.cursor/rules/ui-style-guide.mdc`. `cb31dff` introduced contrast and spacing tokens in `src/theme/theme.ts`. The November screen pass uses bordered, screen-owned cards, tabular numeric readouts, readable large controls, and stepper/preset flows. Use `useAppTheme()`. `src/components/Screen.tsx` provides existing screen chrome. The style guide reserves form layout for each screen and limits overlays to the documented cases.
- `src/utils/feedback.ts` centralizes semantic cues and synthesizes tones. `5c595dd` added it and hooked up navigation chrome. `feedbackSelection`, `feedbackStep`, `feedbackToggle`, `feedbackConfirm`, `feedbackWarn`, `feedbackCountdownTick`, and `feedbackPhaseCue` serve distinct events. Settings updates separate audio and haptic flags. `PressOpacity` can be silent when the caller issues its own cue. Existing small primitives include `SimpleSwitch` and `LogTimeChanger`.
- `LogTimeChanger` grew out of the July weight/sleep/date-time work (`3232443`, `859b4aa`, `d94e5c3`). `39add05` added the compact meal-header mode and `67d99b6` moved the Home time input to steppers. Use the existing route and field conventions of [[Home]], [[Nutrition]], and [[Conditioning]].
- `c8ddb63` replaced deprecated `InteractionManager` in Home and Nutrition loads with `src/utils/scheduleIdleTask.ts`. Its cancelable idle callback has a timer fallback. Cancel outstanding loads when their key changes or a screen unmounts. `6ccb251` adjusted Nutrition dependencies to keep unrelated workspace updates from reloading the diary. `17e5a94` derives Conditioning load status from its fetch key.
- Conditioning editors, the Create Session chooser, emphasis help, and confirmation overlays have explicit exceptions defined in `.cursor/rules/navigation-and-overlays.mdc`. The saved-workout expander is the deliberate layout-pushing control. See [[Conditioning]] for entry points and state.

## Historical decisions

- The September training lineage experimented with shared adaptation displays, generic collection states, responsive tile grids, timeline presenters, and a shared modal frame (`44d4e27`, `9a39461`–`6f5d88d`, `7fac1fb`). A nested virtualized action menu was fixed before actions were switched to full-width buttons (`741e5a8`, `009aff6`, `95b4fa1`). The lineage is preserved at `origin/backup/pre-revert-7daf5e7`. [[Project History]] explains the rollback and [[Strength]] covers the archived implementation.
- The later design rules favor screen-owned card/stepper markup. The November revisions are the primary source for today’s screen patterns. Compare active components before borrowing any archived UI. Current reusable controls and domain logic have their own boundaries.

Evidence is linked in the [Architecture tree](../../docs/feature-tree/architecture.html#style-guide) under style guide, shared controls, feedback, idle tasks, and the shared-UI archive.
