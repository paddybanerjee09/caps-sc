---
aliases:
  - NutritionScreen
---

# Nutrition

Nutrition is a local-day diary and a stack of meal and food workflows. Start with [[Meal Composer and Saved Meals]] for creation, edits, templates, or navigation, [[Food Picker and Providers]] for search, scanning, custom foods, serving facts, or favourites, and [[Nutrition Data and Calculations]] for SQLite, migration, and nutrient totals.

- `src/screens/NutritionScreen.tsx` uses the workspace's `diaryDate`, expandable meal state, and `dataRevision`. The day stepper selects a local day. Expanded rows show the logged items and an Edit Meal action. Add Meal opens a new composer.
- Load diary rows through `scheduleIdleTask` from `getMealLogsForDay`. Bind database loading to the database, local-day bounds, and data revision. Request IDs invalidate stale results. Reference-backed items resolve catalog facts separately. Dependency on unrelated workspace state regresses `6ccb251`.
- `src/components/MacronutrientBreakdownCard.tsx` has full and compact layouts. The full diary card compares macro totals with daily targets and can expand its micronutrient list. Nested composer and facts views use compact P/C/F totals in the card header. Historical card work includes `a269579`, `bfdcb3a`, `f20a3b3`, `13b3d68`, `e5cf05f`, and `59c7ef6`.
- Since the 24 November nutrition screen update, the composer combines its title and compact totals using the card's optional `embedded` presentation, and Facts uses a smaller centered calorie input. The diary retains its full layout; calorie digits now fit the available ring width as their length changes. Current composer, picker, saved-state and base-unit behavior is detailed in the three canonical feature notes above and [[2026-11-24 Nutrition Screen Handoff]] and [[2026-11-24 Nutrition Portion Refinement Handoff]].
- `SegmentedSelector` is also used by [[Home]], where the `ccc63a6` fix eliminated a React layout feedback loop. Keep the animation transform/opacity based when changing the shared selector.

## History

- `e9ddbfb` and `f0f5834` established the tab and changed the navigation system. `edd48ce` and `ad01bfe` extracted the screen and aligned its title.
- `241f556` and `a269579` added the diary and macro card in July. `e8fc8e9` added collapsible meal sections in the legacy USDA/modal era.
- The October rewrite shipped the provider-neutral model, versioned catalog tables, persistent workspace, full-screen composer, saved meals, food picker, scanner, custom forms, and facts. `1d7f792` switched Home and the diary to the composer, `015743c` exposed logged-meal editing, and `c8ddb63` deferred diary reads.
- `9917cee` restyled the diary, composer, facts, custom form, picker, and saved meals with cards and steppers.

Tree entries are `nutrition:nutrition-screen`, `nutrition:nutrition-diary`, `nutrition:macro-card`, and `nutrition:segmented-selector` in [[Feature Tree Crosswalk]]. For the full lineage see [[Project History]].
