# Nutrition portion refinement

- Date/time: 2026-11-24 22:56 -0500 (America/Toronto). Codex /root/nutrition_refinement, branch Skill/Conditioning/Strength-Changes. Root owns Git/index and final integration; no Git mutation from this subagent.
- Objective: side-by-side Quantity and overlay Serving units; no mg choices; regular portion or 100g known-mass fallback; calorie digits fit through seven digits.
- Instructions/context: root AGENTS.md, global UI/memory/tree rules, React Native/Expo UI skills; [[Nutrition]], [[Food Picker and Providers]], [[Nutrition Data and Calculations]], [[2026-11-24 Nutrition Screen Handoff]]. Available Index.md read; deleted 00-Index.md and unrelated pre-existing vault/rule edits preserved.

## Completed

Source paths: src/screens/NutritionScreens/NutritionFactsScreen.tsx; src/nutrition/servings.ts; src/components/MacronutrientBreakdownCard.tsx; new src/components/nutrition/calorieText.ts; scripts/verify-nutrition.mjs.

The dropdown overlays the page, has scrollable 48px choices, dismisses on outside/system Back and uses known physical unit conversion. Native View anchors are measured relative to the page and page-width changes dismiss stale positioning. Provider/custom regular portions retain preference. Generic 1g/100g reference bases do not displace a household portion; mass fallback is a deterministic 100g option. Existing quantity/serving identity is retained when explicitly reopening a food. Milligrams are hidden from new choices, but historical caps:unit:mg references remain resolvable; no stored record rewrite.

Calorie text sizing changes presentation only, accounts for displayed grouping/markers and font scale, and does not shorten/change the energy value or calorie-driven quantity calculation. No new native dependency or Nutrition schema change. The verifier's user_version assertion advances to 11 solely because the concurrent Skills migration owns that shared version.

## Verification

- npm run verify:nutrition passed, including provider/legacy fixtures and new regular/default/100g, old generic-gram catalogs, repeated normalization, historical mg lookup, one-through-seven digit/grouped/font-scale fitting coverage.
- Final targeted ESLint passed on all five source/test files after native-ref correction. Integrated TypeScript snapshot has no Nutrition diagnostics; its only two errors were the then-in-progress Conditioning sprint union, which that owner subsequently corrected. Root will run the final integrated check.
- Native overlay positioning, larger text/keyboard/footer and actual seven-digit glyph rendering unrun. No emulator/provider/network behavior claimed.
- Canonical three Nutrition notes updated; nutrition.js has three new uncommitted histories. The read-only all-tree check passed with24 historical/documentation warnings and no errors; diff --check passed. Root must attach exact source hash/date after source commit, regenerate commits.js and run final all-tree validation. No other Feature Tree files modified here.

## Coordination/next

Source and Nutrition documentation ownership release to root after report. Root integrates full TypeScript and cross-domain checks, source/docs commits, all-tree validation and final handoff. Preserve other agents' training source, shared components and database migration ownership. No global index/Handoffs.md changes made.

## Review correction: measurement-only alternatives

The first default-selection implementation recognized only 1g/100g/mL reference bases. A per100g default with a secondary 1oz conversion incorrectly selected the ounce as a regular portion. src/nutrition/servings.ts now classifies alternate plain metric/imperial measurement labels before recovering a household portion. It handles common fractional typography, decimal commas and optional metric parenthetical equivalents without guessing food names. Explicit preferred provider/custom portions remain valid; actual piece/cup portions still win when present; volume-only foods never gain grams.

Added regressions for the exact 100g+1oz fixture, kg/lb/mg/gram variants, fractions, volume conversions, household piece/cup recovery, old generic-gram defaults and custom-base recovery. verify:nutrition, final two-file targeted ESLint and owned diff whitespace checks all passed after the correction. No SQL, provider-fetch, native control or Git changes from this correction.
