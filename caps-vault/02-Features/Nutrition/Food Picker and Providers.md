---
aliases:
  - MealItemScreen
  - NutritionFactsScreen
  - BarcodeScanScreen
  - CreateCustomFoodScreen
---

# Food Picker and Providers

`src/screens/NutritionScreens/MealItemScreen.tsx` exposes All, Favourites, and Custom scopes. All uses typed FatSecret search with local food context. Favourites preserves exact serving configurations. Custom is the local catalog with create, edit, and delete actions. Sort belongs in an overlay. Selecting a result opens nutrition facts so the user can set servings and confirm the item in the [[Meal Composer and Saved Meals|meal composer]].

- `NutritionFactsScreen.tsx` shows calories for the default selection on entry and recalculates when amount or serving changes. A favourite identity combines provider/item, serving, quantity, and unit using `favouriteConfigKey` in `src/nutrition/calculations.ts`. Where the provider allows storage, a stored catalog snapshot lets a favourite reopen. FatSecret reference records need current details.
- `BarcodeScanScreen.tsx` supports camera scanning and manual entry. Normalize as text to retain leading zeros. Requests go through `src/services/openFoodFactsApi.ts` and `openFoodFactsNormalize.ts`. The Close action returns to the diary.
- `CreateCustomFoodScreen.tsx` supports a user food with macros and optional micronutrients. The calorie cross-check is advisory. Each create starts a fresh form with a new operation ID. Edits retain the original custom food identity. The Close action returns to the diary.
- `src/services/foodCatalog.ts` resolves normalized `FoodRef` records into `CatalogFood`. Typed FatSecret uses `src/services/fatsecretApi.ts` and `fatsecretNormalize.ts`. The application receives only `EXPO_PUBLIC_FATSECRET_PROXY_URL`. `proxy/fatsecret-proxy.mjs` owns server-side OAuth credentials and permits `foods.search` and `food.get.v5`. Documented setup and provider access constraints live in `docs/nutrition-providers.md`.
- FatSecret Basic rows use references and resolve nutrients when connected, while local and Open Food Facts entries can use stored snapshots. Open Food Facts facts include product-data attribution. The USDA FoodData Central client was removed in `fe847c6`. Preserve migrated USDA diary snapshots as historical records.
- Since `a556a7a`, the availability of usage-based sorting comes from the same grouped meal-item query that supplies the ranking. It counts diary items through `meal_logs` and `timeline_entries` at or before the query time. FatSecret resolves the preferred raw serving ID once and falls back to the first valid normalized serving if that ID is absent.

## Picker and portions (24 November 2026)

- Picker results share one bordered scrollable FlatList surface with thin row separators. Search, tab scroll offsets, sort overlay and custom edit/delete controls remain. All/Favourites/Custom use the shared selector's optional compact single-line labels; other selector callers keep their existing appearance. Sort labels are Recent and Frequent. Scan Barcode includes a barcode icon through `NutritionActionBar`'s optional icon prop.
- Fresh search, known-food, custom and barcode selections leave the serving ID unspecified. The catalog now prefers an available regular provider portion (or the custom food's explicit base); a mass-based food without one falls back to 100g. A generic normalized gram option is not a provider preference. Favourites and meal-item edits retain explicit serving IDs and quantities. `src/nutrition/servings.ts` adds deterministic derived units while preserving provider portions; see [[Nutrition Data and Calculations]].
- Facts has one calorie editor in the macro ring, with a centered input and kcal caption. Its font fits the displayed value through seven digits, including grouped display numbers and the system font scale. The duplicate Calorie-driven portion card is removed. Editing calories still derives the quantity and scales macros and micronutrients. Compatible unit switches preserve the physical portion; unknown household portions do not acquire invented equivalences.
- Provider metadata supplies a genuine mass or volume basis. FatSecret household portions retain metric equivalents; Open Food Facts uses explicit quantity units and product/serving data to distinguish gram and millilitre nutrition. Grams and millilitres are never equated merely to offer more choices.

Verification and remaining device acceptance: [[2026-11-24 Nutrition Screen Handoff]].

## History

- `8a1f6a3` added FatSecret and Open Food Facts. `8731d05` added search, `4890a26` scanning, `12b6b40` custom foods, `12171e9` exact-serving facts/favourites, and `1d8b456` proxy documentation and verification.
- `c4e6bcb` and `02ea54a` fixed initial calories and moved serving choices to a dropdown. `1041599`, `e8925f8`, and `14c1595` refined custom form density, corrected create/edit state reuse, and adjusted the custom-food label.
- `dde7751` addressed favourites reopening, `f8de697` overlaid sort and added editing/deleting custom foods, `4d8f785` clarified barcode entry, `64d6eb3` made Close return to Nutrition, and `fabae46` surfaced create custom food. `9917cee` renovated the screens.
- Tree IDs `nutrition:meal-item-screen`, `nutrition:barcode-scan-screen`, `nutrition:create-custom-food-screen`, `nutrition:nutrition-facts-screen`, `nutrition:nutrition-services`, and `nutrition:usda-client` are in [[Feature Tree Crosswalk]]. See [[Nutrition Data and Calculations]] for storage and nutrient math.

## Uniform UI audit (20 November 2026)

All owned subscreens now use shared safe-area headers, branch-wide X, fixed depth-aware Cancel/Back footers, and preserved domain actions. Applicable log timestamps use the header clock and shared scroll-wheel modal; weight/load fields use decimal text input without increments or presets. See [[UI and Interaction Decisions]] for the current contract and [[2026-11-20 UI Audit Review]] for screen/input coverage and verification limits.

## Serving control refinement (24 November 2026)

The Facts serving control is **Serving units**, an anchored overlay dropdown beside direct decimal **Quantity**. Choices scroll over the page rather than push content down; outside tap or system Back closes it. Native View anchors are measured relative to the page; page-width changes close stale positioning. Milligrams are excluded from new choices, while old `caps:unit:mg` references still resolve their exact historical favourite/item portion. No stored identity or snapshot is rewritten.

Regular portions come from original catalog entries, respecting the provider preference when available. Plain 1g/100g nutrient-reference bases do not displace a supplied household portion. Alternate measurement-only choices such as 1oz, 1kg or 1L are conversions, not evidence of a regular serving; they cannot replace the fallback. With no regular mass portion, deterministic `caps:unit:100g` supplies the 100g fallback; a provider's explicitly preferred 30g portion and a custom food's chosen base remain real portions. No food-name/size guessing, density inference, or mass fallback for volume-only food is introduced.

Verification: `verify:nutrition`, final integrated TypeScript and targeted ESLint passed. Android verified the anchored overlay, compatible unit conversion, Back dismissal, seven-digit calories with the keyboard open, and one identical 100g choice after display dedup (`4c9b2fa`). Native enlarged font, iOS, live providers and meal logging remain unrun. See [[2026-11-24 Compact Logging Android QA]] and [[2026-11-24 Compact Logging Refinement Handoff]].
