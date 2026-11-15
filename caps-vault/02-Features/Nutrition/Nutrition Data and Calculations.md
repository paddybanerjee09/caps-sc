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

## History and verification

- `241f556` created the meal tables with USDA identity. `c4f7af8` established provider-neutral calculation/types. `884864f` introduced v5 storage and `ece0620` repaired incomplete migration. `dde7751` added favourite snapshots and `3ff3e8a` verified edit, custom food, and favourite persistence. `fe847c6` removed USDA fetching while preserving migrated records.
- `npm run verify:nutrition` exercises migration and legacy data preservation, provider normalizers with fixtures, quantity/totals and null handling, operation deduplication, workspace restoration, meal edits/deletes, custom food handling, and favourite snapshots. It is a Node SQLite/logic check. Native camera, device transitions, and live provider connectivity require separate evidence.
- See `nutrition:nutrition-schema` and the corresponding Database nodes in [[Feature Tree Crosswalk]].
