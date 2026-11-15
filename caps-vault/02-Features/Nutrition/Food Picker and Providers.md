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

## History

- `8a1f6a3` added FatSecret and Open Food Facts. `8731d05` added search, `4890a26` scanning, `12b6b40` custom foods, `12171e9` exact-serving facts/favourites, and `1d8b456` proxy documentation and verification.
- `c4e6bcb` and `02ea54a` fixed initial calories and moved serving choices to a dropdown. `1041599`, `e8925f8`, and `14c1595` refined custom form density, corrected create/edit state reuse, and adjusted the custom-food label.
- `dde7751` addressed favourites reopening, `f8de697` overlaid sort and added editing/deleting custom foods, `4d8f785` clarified barcode entry, `64d6eb3` made Close return to Nutrition, and `fabae46` surfaced create custom food. `9917cee` renovated the screens.
- Tree IDs `nutrition:meal-item-screen`, `nutrition:barcode-scan-screen`, `nutrition:create-custom-food-screen`, `nutrition:nutrition-facts-screen`, `nutrition:nutrition-services`, and `nutrition:usda-client` are in [[Feature Tree Crosswalk]]. See [[Nutrition Data and Calculations]] for storage and nutrient math.
