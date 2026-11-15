# Skills Training

**Current status: title-only placeholder.** The second bottom tab uses route `skill` and the `boxing-glove` icon. `src/screens/Screens.tsx` resolves it to `SkillTrainingScreen` in `src/screens/SkillScreen.tsx`, which renders `<Screen centerTitle title="Skills Training" />`. The current path has no skill workspace, repository, or SQLite tables.

## Planned scope

The README’s **Custom Skill Work** section describes sessions composed from independently configured activities such as shadowboxing, padwork, bag rounds, and sparring. It proposes estimating fatigue, nutrition, and recovery needs from session length and RPE, and organizing [[Strength]] and [[Conditioning]] around skill work. The Feature Tree marks this scope planned. Treat the README as product intent for a future design.

## History and constraints

- `e9ddbfb` added the Expo Router placeholder at `app/(tabs)/sport-training.tsx` under the name Sport Training. `f0f5834` switched to custom navigation, route `sportTraining`, label Sport, and a `boxing-glove` icon.
- `edd48ce` extracted `SportScreen.tsx` and `ad01bfe` centered its title. `59dd4e8` renamed the route and file to the current `skill` / `SkillScreen.tsx` and split S&C into separate Strength and Conditioning tabs.
- `0b97b10` described fixed skill activity types. `41b5c4d` shifted the README to user-built sessions of independently configured activities. Neither version is an implemented logging flow.
- `.cursor/rules/ui-style-guide.mdc` reserves implementation for an explicit Skills Training request. Keep the route key, file name, exported component, and `ScreenForRoute` mapping aligned. For an authorized UI implementation, use screen-local cards, steppers, and presets per that rule.

Current status verified against `src/navigation/routes.ts`, `src/components/BottomTabs.tsx`, `src/screens/Screens.tsx`, `src/screens/SkillScreen.tsx`, and current migrations. Related notes: [[App Architecture]], [[Data and Persistence]], [[Project History]], [[Feature Tree Crosswalk]]. Feature Tree: [`skill.html`](../../../docs/feature-tree/skill.html).
