# Skills Training

**Current status: logging is on the Skills tab** at `45648a2`. The second bottom tab uses route `skill` and the `boxing-glove` icon. `src/screens/Screens.tsx` resolves it to `SkillTrainingScreen` in `src/screens/SkillScreen.tsx`. Schema version is 9.

[[2026-11-16 Skill Screen Implementation Plan]] is the design that was built. Effort is stored as an RPE band (rate of perceived exertion): Easy is RPE 6 or below, Moderate is RPE 7–8, and Hard is RPE 9–10. The plan's RIR wording was not implemented.

## Logging

`src/state/SkillWorkspaceContext.tsx` keeps the draft while the builder is open. `src/screens/skill/SkillSessionBuilderScreen.tsx` is Build Skill Session and a reopened saved session. Save writes only a template. Log writes the session, activity snapshots, `skill-energy-v1`, and a `timeline_entries` row of kind `skill` in one transaction. The session id makes a retry a no-op. Failed writes leave the draft unchanged. Removing a saved session archives the template and leaves earlier logs intact.

Time is stored in epoch milliseconds and seconds. `started_at` is the chosen end minus elapsed seconds. `local_end_date` is the device-local date of that end, so a session that crosses midnight is placed on the day it finished. `timezone` is the IANA zone captured at commit. Templates store no date or time. Reopening one sets Ends at to the current time.

RPE is a required band, not a 1–10 number: `easy`, `moderate`, or `hard`. Sparring and rolling also store a separate mode. Duration uses the entered seconds as work and zero rest. Rounds use `rounds × seconds per round` as work and `(rounds − 1) × rest` as rest, so one round with a configured rest stores that rest and adds no rest seconds. Focus ignores general activities. One combat discipline sets the focus. Two or more set `mixed`.

Calories are gross kilocalories: `weightKg × ((baseMET × rpeMultiplier × workSeconds) + (1.5 × restSeconds)) / 3600`. The multipliers are 0.80, 1.00, and 1.10. The session stores the unrounded sum, the weight used, `logged` or `reference`, and `skill-energy-v1`. Reference weight is 75 kg when no `weight_logs` row has a timeline start at or before the end time. `getLatestWeightKg` is unchanged and still returns the newest log with no cutoff.

There is no skill owner table. Conditioning has a singleton owner because those sessions sync. Skill logs stay on the device, as Strength logs do.

## Planned scope

The README’s **Custom Skill Work** section describes sessions composed from independently configured activities such as shadowboxing, padwork, bag rounds, and sparring. It proposes estimating fatigue, nutrition, and recovery needs from session length and RPE, and organizing [[Strength]] and [[Conditioning]] around skill work. The Feature Tree marks this scope planned. Treat the README as product intent for a future design.

## History and constraints

- `e9ddbfb` added the Expo Router placeholder at `app/(tabs)/sport-training.tsx` under the name Sport Training. `f0f5834` switched to custom navigation, route `sportTraining`, label Sport, and a `boxing-glove` icon.
- `edd48ce` extracted `SportScreen.tsx` and `ad01bfe` centered its title. `59dd4e8` renamed the route and file to the current `skill` / `SkillScreen.tsx` and split S&C into separate Strength and Conditioning tabs.
- `0b97b10` described fixed skill activity types. `41b5c4d` shifted the README to user-built sessions of independently configured activities. Neither version is an implemented logging flow.
- `.cursor/rules/ui-style-guide.mdc` reserves implementation for an explicit Skills Training request. Keep the route key, file name, exported component, and `ScreenForRoute` mapping aligned. For authorized UI changes, use domain-owned cards and the current shared subscreen/log-time contracts; the 20 November audit removes time increments.

Verified against `src/navigation/routes.ts`, `src/screens/SkillScreen.tsx`, `src/screens/skill/`, `src/skill/`, `src/data/skillMigration.ts`, and `src/data/skillRepository.ts`. `npm run verify:skill` covers the migration, focus, calorie fixture, templates, snapshots, rollback, and retry. The screens were not exercised on a device in the implementation session. Related notes: [[App Architecture]], [[Data and Persistence]], [[Project History]], [[Feature Tree Crosswalk]]. Feature Tree: [`skill.html`](../../../docs/feature-tree/skill.html).

## Uniform UI audit (20 November 2026)

All owned subscreens now use shared safe-area headers, branch-wide X, fixed depth-aware Cancel/Back footers, and preserved domain actions. Applicable log timestamps use the header clock and shared scroll-wheel modal; weight/load fields use decimal text input without increments or presets. See [[UI and Interaction Decisions]] for the current contract and [[2026-11-20 UI Audit Review]] for screen/input coverage and verification limits.
