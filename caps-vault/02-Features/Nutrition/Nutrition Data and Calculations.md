---
aliases:
  - Nutrition schema
  - Nutrient math
---

# Nutrition Data and Calculations

`src/types/nutrition.ts` defines the provider-neutral food identities, servings, and nutrient snapshots. `src/data/nutritionRepository.ts` reads and writes the diary. `src/data/nutritionCatalogRepository.ts` owns custom foods, favourites, templates, workspace snapshots, and committed operation lookups. See [[Data and Persistence]] for migration orchestration and the shared tables.

| Records | Durability contract |
| --- | --- |
| `timeline_entries`, `meal_logs`, `meal_items` | Diary writes link to a timeline identity. Edit updates the intended log and its children. Deletion removes the corresponding owned diary records with the timeline entry. |
| `saved_meals`, `saved_meal_items` | Reusable compositions with their own IDs and repository operations. Saving a template does not create a diary event. |
| `custom_foods`, `food_favourites` | Custom foods have stable IDs. Favourite keys describe exact serving configurations. Eligible catalog snapshots support reopening. |
| `nutrition_workspace`, `nutrition_operations` | Persist resumable workspace JSON and durable operation identity. Creation operations can be retried without duplicating a successful write. |

- `src/data/nutritionMigration.ts` contains the v5 item rebuild, sequence restoration, and catalog/workspace tables, followed by the v6 favourite snapshot column. Keep v5 migration repair behavior in mind for older installs that advanced a version without creating required tables. The shared database schema advanced again for Conditioning.
- Snapshot records retain historical nutrient/serving data when the provider permits it. For FatSecret references, keep the item and serving identifiers and rehydrate as connectivity permits. Provider/storage details are in [[Food Picker and Providers]].
- `src/nutrition/calculations.ts` sums known contributions and separately preserves incomplete or partial flags for missing values. Unit conversion requires compatible dimensions. The registry in `src/nutrition/nutrients.ts` covers micronutrients and other extra values. Preserve nutrient units and scale with selected servings. A custom calorie estimate uses the macro cross-check as an advisory warning.
- In this domain `getMealStatus` uses logged time to distinguish planned from completed. Conditioning's explicit status model rules have separate semantics.

## Base-unit serving options (24 November 2026)

`src/nutrition/servings.ts` derives nutrient and micronutrient amounts per gram or millilitre from a known physical serving. A 120g portion is divided by 120 for the 1g option. Available compatible mass/volume conversions and original provider portions appear together; unknown dimensions remain provider portions. Fresh selections now prefer a real original portion and otherwise use a 100g fallback for known mass. Unmeasured household portions stay unchanged; volume-only foods are never assigned grams. `withServingUnits` runs at catalog resolution/cache and Facts snapshot boundaries so deterministic `caps:unit:*` serving IDs can resolve again after reference-only workspace/diary restoration. Compatible unit switches scale the entered quantity to retain the physical amount.

Derived choices store their physical amount in the existing `g`/`ml` unit fields and retain their visible label and stable serving ID. No SQL enum or table change is needed. Snapshot sources retain nutrient facts; reference-only provider records still persist identifiers rather than copied catalog facts. Missing exact reference servings stay unresolved. Diary drafts retain full stored quantity precision on reopen instead of rounding to three decimal places.

Repeated normalization retains existing derived servings to avoid floating-point drift while filling missing compatible choices. Derived quantities use ungrouped decimal output with 15 significant digits, preserving small positive converted amounts that the former eight-decimal formatter rounded to zero.

Save/Unsave reuses the template tables: `saved_meals.id` owns `saved_meal_items.saved_meal_id` with cascade deletion. Diary rows own separate item snapshots/references beneath their timeline parent; removing a template never deletes those diary rows. Operation receipts remain durable; the next save after unsaving normally uses a fresh create operation ID. `createSavedMeal` now verifies that a committed receipt still points to an existing template before returning success, including error recovery. Replaying an old receipt after deletion creates an actual new row; an insert failure cannot be mistaken for success from the deleted row's receipt. This also covers process death between deletion and workspace persistence. See [[Timeline and Nutrition Tables]] and [[Meal Composer and Saved Meals]].

Regression evidence and current QA limits are recorded in [[2026-11-24 Nutrition Screen Handoff]].

## History and verification

- `241f556` created the meal tables with USDA identity. `c4f7af8` established provider-neutral calculation/types. `884864f` introduced v5 storage and `ece0620` repaired incomplete migration. `dde7751` added favourite snapshots and `3ff3e8a` verified edit, custom food, and favourite persistence. `fe847c6` removed USDA fetching while preserving migrated records.
- `npm run verify:nutrition` exercises migration and legacy data preservation, provider normalizers with fixtures, quantity/totals and null handling, operation deduplication, workspace restoration, meal edits/deletes, custom food handling, and favourite snapshots. It is a Node SQLite/logic check. Native camera, device transitions, and live provider connectivity require separate evidence.
- See `nutrition:nutrition-schema` and the corresponding Database nodes in [[Feature Tree Crosswalk]].

## Regular portions and fitting calorie values (24 November 2026)

`withServingUnits` preserves regular source portions rather than always switching to 1g/1mL. Its deterministic 100g option scales the same known mass nutrient basis as other conversions. Repeated normalization of old catalogs with a generic gram default recovers a meaningful original portion when present; otherwise it retains the 100g fallback without duplicate options or numeric drift. Alternate plain metric/imperial unit labels are excluded from household-portion recovery, including fractional quantities, decimal commas and optional metric parentheses; an explicitly preferred provider/custom portion remains valid.

`servingUnitOptions` excludes the retired milligram choice while internal legacy IDs remain resolvable. Existing favourite configuration keys, snapshot/reference storage, quantity conversion and meal-item identity are preserved. This Nutrition change adds no SQL column, table or migration. The shared database is v11 due to the separate Skill Reps/Rounds change; the Nutrition verifier expects that shared version.

`src/components/nutrition/calorieText.ts` fits ring values and inputs using displayed digits/punctuation, available width and system font scale. It changes presentation only: no abbreviations, truncated numeric strings or changes to calories/quantity/macros. Header and full progress values retain single-line native fitting. Regression checks cover one through seven digits, grouped values, increased font scale, original/default/fallback portions, exact retired-unit references and repeated normalization.

Final Android follow-up (`4c9b2fa`, 25 November): `servingUnitOptions(food, preferredId)` collapses display-identical choices using normalized label, amount, unit, nutrients and extras. Selected ID wins, otherwise the default ID; canonical `food.servings` and all historical lookup IDs remain untouched. Distinct household labels and differing nutrient payloads remain separate. Tests cover these distinctions and no mutation; Android verified a single 100g row while retaining selected 1kg, quantity 1000 and 1,000,000 calories after reload. See [[2026-11-24 Compact Logging Android QA]] for actual native coverage and limits.
