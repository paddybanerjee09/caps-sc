# Planned and completed Strength

- Updated 2026-11-26 22:08 -05:00 (America/Toronto), Codex `/root` with delegated entry, table and adaptation work.
- Branch `Skill/Conditioning/Strength-Changes`, initially at `0c2abfa`. Model and migration at `0fc99cb`, integrated UI at `e97c731`, stale-set regression at `68a3ca4`, and table layout refinement at `c5a6c61`. See [[Strength]], [[Data and Persistence]] and [[Recovery and Progress]].
- The original worktree already had separate user changes in the vault, `.cursor/` and `work/`. Those are outside this task. `caps-vault/00-Index.md` was already deleted. Used the working `caps-vault/Index.md`.
- Applied root AGENTS.md, global vault and Feature Tree rules, and the UI guide's shared workflow, modal and touch-target conventions. The current user explicitly requested inline scroll controls and a chooser in Strength.

## Scope and implementation

- `src/screens/StrengthTrainingScreen.tsx` and the shared chooser offer planned start or current/completed end for both new and saved workouts. `src/components/LogTimeChanger.tsx` uses interaction-time limits and minutes. Calendar dates and status come from the strength repository; the marker stays planned even after its date passes.
- `WorkoutBuilderScreen`, Strength workspace and `src/components/strength/` own same-screen search, favourites, target controls, actual set entry, duration and focus. Use the exercise name to expand the completed row and horizontally scroll the table for Notes on narrow screens. Template Save/Unsave stays independent. Stale picker/editor/image routes and components were removed.
- `src/data/database.ts` adds v12 fields and the calendar index transactionally. Strength's timeline row owns status. Exercise targets and performed set snapshots remain distinct. `src/strength/{drafts,duration,emphasis}.ts` validates input and calculates from mode-appropriate evidence. RPE/RIR can be omitted and are never populated from targets when entering actual sets. 10+ is represented by integer 10. Legacy v1 estimates and snapshots remain readable.
- Source selection and heuristic limitations are recorded in [[Strength]]. Future recovery should use planned targets for forecasts and performed sets for recorded recovery. Recovery calculation changes are a separate task.

## Verification

- `npm run typecheck` and targeted ESLint for all changed Strength/shared source passed. Strength, Skill, Conditioning, Nutrition, Recovery, Weight and display-date verification commands passed.
- Strength regression covers legacy v11 migration and rollback, v1 estimate retrieval, overnight planned start placement, exclusion of stale sets from plans, separate target and performed set inputs, plan and completed snapshot persistence, and exact retry.
- Isolated Android Expo Go 58.0.6 QA used a disposable Pixel 7 emulator and a separate SQLite file. It exercised the new and saved-workout chooser, future start and past-or-current end limits, search with the keyboard visible, direct Sets scrolling, all eight rep-range options, template Save, planned persistence and calendar display. Completed verification covered missing-reps feedback, two expandable set rows, recording actual reps/RPE/RIR, and a calendar showing both session statuses. Reopened completed detail displayed set 1 with 8 reps, RPE 8 and RIR 2, and set 2 with 7 reps. Both calendar records persisted across an Expo Go process restart. Final visual checks confirmed gold search stars and readable table headings. Captures are in `work/strength-session-qa/`. iOS coverage is pending.
- Feature Tree synchronized at `docs/feature-tree/strength.html` with Strength, Database and Architecture version nodes. `npm run feature-tree` regenerated the commit index and the independent check validated all eight trees with zero errors and 27 historical or documentation-only mapping warnings.
