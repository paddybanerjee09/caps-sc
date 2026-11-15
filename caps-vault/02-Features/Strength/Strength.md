# Strength

Status at `e492e06` · title-only placeholder on main. The `strength` route in `src/navigation/routes.ts` opens `StrengthTrainingScreen` via `src/screens/Screens.tsx`. Bottom tabs use `barbell-outline`. `src/screens/StrengthTrainingScreen.tsx` renders `<Screen centerTitle title="Strength Training" />`. The `strength` timeline category/type exists as scaffolding, and the active database has no strength session tables.

## Product intent

`README.md` describes periodization based on goals, competition dates, and recorded workload. It describes logging exercises with sets, reps, load, rest, RPE, and RIR, in support of rate of force development, relative strength, and lean mass. This is planned scope (`0b97b10`, `41b5c4d`).

`.cursor/rules/ui-style-guide.mdc` requires an explicit feature request before editing the placeholder. For a future implementation preserve the `strength` route and follow the current card-by-card layout, stepper and preset controls, and confirmation-only modal policy. The earlier modal stack provides historical evidence. See [[Strength History]], [[App Architecture]], [[Data and Persistence]], and [[Feature Tree Crosswalk]].

## Main-line history

1. `e9ddbfb` added the Expo Router `S&C` tab. `f0f5834` replaced that routing setup with custom state navigation and established the `strength` key.
2. `edd48ce` extracted `StrengthConditioningScreen`. `dd88e65` renamed the tab Strength and switched to `barbell-outline`. `ad01bfe` centered the title.
3. `59dd4e8` introduced the current `StrengthTrainingScreen` file alongside the SQLite transition. The implementations on the September archive descend from the placeholder and are outside main's ancestry after `e8fc8e9`.

Tree source is `docs/feature-tree/data/strength.js`, with navigation at `docs/feature-tree/strength.html`. Use [[Strength History]] for early provider, logging, SQLite, and scoring decisions when relevant.
