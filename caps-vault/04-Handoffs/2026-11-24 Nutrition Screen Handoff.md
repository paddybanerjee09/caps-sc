# Nutrition screen changes

November 24, 2026 at 18:13 EST (America/Toronto). Codex /root. Source, automated verification, canonical Nutrition notes and local Feature Tree synchronization complete. Native visual/interaction acceptance remains unrun.

## Scope and revision context

Implement the requested MealLogScreen, MealItemScreen and NutritionFactsScreen changes. Started on `main`, integration base `1dddd6d`; final Nutrition source revision `41499ce` on `Skill/Conditioning/Strength-Changes` after cross-chat Git coordination. All commits are local; nothing pushed or deployed.

Applicable instructions: `AGENTS.md`, global `.cursor/rules/*.mdc`, UI style guide, relevant Expo and react-native-patterns guidance. Canonical notes: [[Nutrition]], [[Meal Composer and Saved Meals]], [[Food Picker and Providers]], [[Nutrition Data and Calculations]], [[Timeline and Nutrition Tables]]. `00-Index.md` was already deleted; available `Index.md` was read and preserved.

## Owned source commits

| Commit | Change |
| --- | --- |
| `80e28c7` | Single bordered FlatList picker with thin separators; compact single-line tabs, Recent/Frequent labels and barcode icon. Shared optional action icon/navigation-disabled props and selector compact option retain existing defaults. |
| `35ceb0d` | Base-unit/compatible serving helper, provider metric metadata and central normalization; original portions and stable reference IDs retained. Facts uses one compact ring calorie input. Preserve fractional quantities, repeat-normalization values and small decimal conversions; harden saved-template receipt replay. Expanded nutrition verifier. |
| `41499ce` | Plain meal title above embedded compact totals; reusable LoggedFoodComponent with readable serving/calories/macros and separate left X. Exact item/portion editing; footer Save/Unsave, real template removal, stale-link reconciliation and pending navigation guards. Saved template browser moved to Meal Items header. |

Source paths include `src/screens/NutritionScreens/{MealLogScreen,MealItemScreen,NutritionFactsScreen,BarcodeScanScreen,CreateCustomFoodScreen}.tsx`, `src/components/nutrition/{LoggedFoodComponent,NutritionChrome,SegmentedSelector}.tsx`, `src/components/MacronutrientBreakdownCard.tsx`, `src/nutrition/{servings,calculations,drafts}.ts`, provider normalizers/catalog, `src/data/nutritionCatalogRepository.ts`, and `scripts/verify-nutrition.mjs`. No dependency, lockfile or schema migration change.

## Decisions and data contract

- Summary uses content-sized embedded compact layout; no fixed large height. Meal Identity, title presets, inline Save/Discard and separate lower totals card removed. Diary log-time and Log/Save Changes behavior remain. Full diary kcal caption styling is preserved.
- Logged rows retain the selected serving label and exact quantity, display scaled known nutrients, and replace the existing draft item when edited. Remove and details are independent targets. Reference hydration requires the exact serving ID; missing provider portions remain unresolved.
- Fresh search/known/custom/barcode selections default to 1g or 1mL when a physical basis exists. Existing favourite and logged-item selections keep their explicit portions. Original provider options remain alongside compatible mass or volume units. No assumed density or fabricated household equivalence.
- Deterministic `caps:unit:*` IDs regenerate at catalog/Facts boundaries. Repeated normalization reuses existing derived values and fills missing options, avoiding duplicate entries and floating-point drift. Unit changes preserve compatible physical amounts. Ungrouped decimal formatting retains small positive values; diary draft reopening no longer rounds to three decimals.
- Saved state compares canonical composition with the actual template in storage. Edited composition becomes Save Meal until updated. Failed saved-state checks offer Retry. Immediate mutation refs and disabled header/hardware/footer navigation prevent overlapping save/log/delete actions.
- `saved_meals.id` owns ordered `saved_meal_items.saved_meal_id` with cascade deletion. Unsave deletes that template and its children and clears matching workspace saved IDs/signatures/pending operation IDs. Diary `timeline_entries` -> `meal_logs` -> `meal_items` are separate and survive; `meal_logs.saved_meal_id` is nullable provenance without a SQL foreign key.
- `nutrition_operations` retains create receipts. Ordinary re-save after Unsave uses a fresh operation ID. A replayed committed receipt must resolve to an existing saved row before returning success, including error recovery. If the old result was deleted, an actual new row is created; failed insertion cannot falsely return the deleted ID. Existing transaction boundaries are retained.

## Verification

- Final `npm run verify:nutrition` passed after the frozen source changes. Covers original migrations/provider fixtures plus g/mL nutrient and micronutrient scaling, compatible conversions, unknown dimensions, repeated/partial normalization, small decimal quantities, fractional draft precision, reference IDs, saved-item cascade deletion, diary survival, fresh re-save, stale receipt replay and injected insert failure.
- Full `npm run typecheck` and `npm run lint` passed during integration; final `npx tsc --noEmit` passed after the concurrent Strength owner corrected its null-footer typing error. All targeted Nutrition source lint passed. Initial idempotence test exposed regenerated floating-point values; corrected by retaining existing derived options. Final suite passes.
- Android and iOS Hermes exports passed with `npx expo export --platform all --max-workers 1 --output-dir .expo/nutrition-screen-export` after the initial sandbox compiler denial was rerun with approved escalation. This was bundle validation, with the then-existing QA app config, not signed builds or on-device acceptance. Output remains ignored in `.expo/`.
- `npm run feature-tree` regenerated `docs/feature-tree/data/commits.js` (259 commits) and validated all eight trees. Nutrition has 17 nodes / 65 versions, with ten new histories mapped to exact source hashes/timestamps. There are 22 historical documentation/unmapped warnings and no validation errors. No Nutrition source commit is unmapped.
- Local HTML data synchronization is complete using the established `docs/feature-tree/` workflow. In-app browser preview timed out/reset; no browser visual verification or separate publication is claimed. No data synchronization write remains pending.

## Coordination, preserved work and remaining acceptance

Root and subagents used non-overlapping ownership: picker/shared chrome; facts/servings/providers/macro/verifier; read-only review; root integration, composer, persistence recovery and memory/tree. All subagent source ownership is released. No Nutrition source work remains active.

Concurrent Android QA briefly created mixed tip `cef687a` containing its height change and staged new Nutrition files. The user's explicit repair/coordination approval was verified in the QA chat. QA acted as sole Git writer for an agreed soft-reset/owned-height recommit, preserving every file; final QA commits `080eb08`/`ef645a0` precede Nutrition's source commits. `80e28c7` remains an ancestor. Root then held an exclusive Git window for scoped Nutrition commits. After this documentation commit, root releases Git ownership to QA for transfer to Strength. Do not change shared branches or stage broadly without coordinating these chats.

Preserved user/other-agent work includes old `.cursor/caps-obsidian` deletions, global rule edits, deleted vault `00-Index.md`, untracked `Index.md`/`.obsidian`, history/backfill notes, QA canonical notes/tree/handoff, and all concurrent Strength/Conditioning/Skills source and documentation. They are excluded from Nutrition commits. Shared Handoffs.md includes the agreed Nutrition and Android QA links. Root did not edit QA-owned source or reserved architecture/home/settings tree files.

Next device acceptance: inspect common/narrow phone widths and large text; title/keyboard/footer access; add/remove and tap-to-edit exact servings; unit switching and calorie-driven quantities; offline reference errors/retry; Save -> Unsave -> Save, failures and restart; favourites and custom/barcode entry points. The summary's approximate one-third height is content-sized and has not been measured on device. No camera/live-provider or native visual QA is claimed for this task.
