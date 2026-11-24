---
aliases:
  - MealLogScreen
  - SavedMealsScreen
  - NutritionWorkspaceContext
  - NutritionStack
---

# Meal Composer and Saved Meals

| Entry | Workspace call | Purpose |
| --- | --- | --- |
| Diary Add Meal | `openNewMeal(diaryDate)` | Create a draft for the selected local day |
| Diary meal action | `openEditMeal(meal)` | Load the logged row by timeline entry identity |
| Home Quick Log Meal | `openNewMeal(homeDate)` | Open the composer for Home's selected day and switch to the Nutrition tab |
| Composer Meal Items header: Saved Meals | Saved Meals route | Browse reusable templates, edit or delete templates, or bring a template into the composer |

`src/screens/NutritionScreens/MealLogScreen.tsx` holds the title, clock controls, items, compact meal totals, and save/template actions. “Add meal item” opens [[Food Picker and Providers|the food picker]]. The screen calls `createMealLog` or `updateMealLog` for diary writes. `src/screens/NutritionScreens/SavedMealsScreen.tsx` handles the list. Template repository writes target `saved_meals` and `saved_meal_items` separately from the diary. Opening a template through `openEditSavedMeal` loads its own draft. Details of durable storage are in [[Nutrition Data and Calculations]].

## Compact composer and saved state (24 November 2026)

- A plain meal-title field sits above the embedded compact `MacronutrientBreakdownCard` inside one content-sized summary card. The separate Meal Identity, title presets, inline Save/Discard controls and bottom totals card are removed. The existing header clock and diary Log/Save Changes actions remain.
- `src/components/nutrition/LoggedFoodComponent.tsx` shows each food's name, total serving size, calories and P/C/F. Its separate left X has an inset 48px target with no competing inner border. Tapping the details opens Facts with the exact item ID, serving ID and quantity; Update Item replaces that draft item. Portion changes happen in Facts.
- The footer's template action is Save Meal for an unsaved composition and Unsave Meal for the matching saved composition. Title/item changes make the composition unsaved until Save Meal updates its existing template. Template existence and canonical composition are reconciled from `listSavedMeals`; a deleted template ID is cleared instead of treated as saved. Failed checks have a Retry action.
- Unsave calls `deleteSavedMeal`, clearing matching workspace drafts' saved IDs, signatures and pending create operation IDs. A later save uses a fresh operation ID. The deletion cascades through `saved_meal_items`; independent diary `meal_logs`/`meal_items` and timeline entries remain. `meal_logs.saved_meal_id` is nullable provenance without a SQL foreign key, so historical diary IDs can outlive a deleted template and must be reconciled when reopened.
- Template and diary mutations have immediate ref locks, pending action states, guarded header/hardware exits and disabled footer navigation. Failed writes retain the draft. Existing repository transactions and operation receipts are reused; there is no schema migration.
- Reference-backed items resolve only their exact serving ID. If a provider no longer returns it, leave details unresolved rather than silently replacing the logged portion. Persisted diary quantities reopen without the former three-decimal rounding, preserving small converted portions.

Implementation and verification details: [[2026-11-24 Nutrition Screen Handoff]].

## Navigation and restoration

- `a556a7a` made editing and inserting a saved template use `savedTemplateItemToDraft`. Both preserve serving fields and quantity precision. Snapshot items keep their stored facts and provider-reference items resolve through the provider. `SavedMealsScreen` reloads once per revision and ignores obsolete results after a newer refresh or unmount.
- `NutritionWorkspaceProvider` is mounted above the tab content. `AppNavigator` mounts `NutritionStack` only on the active Nutrition tab and delegates hardware Back to the workspace. Closing a deep screen may pop a layer or return to the diary, depending on the screen action.
- `src/screens/NutritionScreens/NutritionStack.tsx` renders entering/leaving layers. `src/nutrition/motion.ts` controls transitions with system reduced-motion support.
- `src/state/NutritionWorkspaceContext.tsx` owns navigation, dates, and draft/session state. `src/nutrition/drafts.ts` restores distinguishable new-day, existing-log, and saved-template drafts. Workspace snapshots use a debounced local write with a flush path on backgrounding. On restoration, recorded operation IDs and available meal IDs help reject stale or already-committed activity.
- Keep the full-screen composer for data entry. Keep the Add Meal Item action prominent and the meal actions on the composer itself. `MealLogModal` describes the pre-October flow.

## History

- July meal modal iterations span `241f556`, `e845b49`, `d94e5c3`, `bfdcb3a`, `298f627`, and `3225bb5`. This was the USDA and serving-editor era.
- `ce2ba31` persisted the workspace above the tabs, `4b6db09` added the full-screen editor, `60aa964` animated entering/exiting layers, and `1d7f792` migrated the Home and diary entry points.
- `4c6b3f1` separated reusable saved meals from the diary. `9b8f6e2`, `3b34380`, `7c98213`, `6397e58`, and `a553465` added template repository updates, template draft identity, opening in the composer, and edit/delete controls. `0deafb1`, `0627d77`, `1daf75d`, and `39add05` document composer affordance and density decisions.
- Tree IDs `nutrition:meal-log-screen`, `nutrition:saved-meals-screen`, `nutrition:nutrition-stack`, and `nutrition:nutrition-workspace` lead to the rest of the version evidence in [[Feature Tree Crosswalk]]. See [[App Architecture]] for provider ownership.

## Uniform UI audit (20 November 2026)

All owned subscreens now use shared safe-area headers, branch-wide X, fixed depth-aware Cancel/Back footers, and preserved domain actions. Applicable log timestamps use the header clock and shared scroll-wheel modal; weight/load fields use decimal text input without increments or presets. See [[UI and Interaction Decisions]] for the current contract and [[2026-11-20 UI Audit Review]] for screen/input coverage and verification limits.
