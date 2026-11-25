# Compact logging refinement

- Final handoff: 2026-11-25, America/Toronto, Codex /root. Branch `Skill/Conditioning/Strength-Changes`; starting revision `900409d`, final source `4c9b2fa` (2026-11-25 00:19 -0500). Requested implementation, automated checks and scoped Android acceptance are complete. No push, merge or deployment.
- Scope: Nutrition units overlay/default portions/calorie sizing; Strength subtitle/footer; Conditioning chooser/direct parameters; Skills activity search and Reps/Rounds.
- Protocol: root AGENTS.md and applicable .cursor rules, react-native-patterns and Expo skills. Available vault entry is Index.md; pre-existing deleted 00-Index.md is preserved. Source and observed tests establish implemented/verified status.
- Canonical notes: [[Strength]], [[Conditioning]], [[Skills Training]], [[Food Picker and Providers]], [[Nutrition Data and Calculations]], [[Data and Persistence]], [[UI and Interaction Decisions]]. Prior context: [[2026-11-24 Training Session Workflow Handoff]] and [[2026-11-24 Android Biometric QA Handoff]].

## Source commits

| Commit | Scope and implementation |
| --- | --- |
| 2c15613 | Strength builder has no search input or duration card; duration is a subtitle. Extract TrainingNumberField and EstimatedFocusButton; add WorkflowFooter equalActions. |
| 6c23363 | Identical footer containers make Cancel, Save/Unsave and Log Session equal in size. |
| 24084a6 | Quantity beside overlay Serving units; no new mg choices; regular provider portions or stable 100g known-mass fallback; fit calorie values through seven digits. |
| 051511d | Conditioning Log Session modal restores Free Session/run-bike, Time Interval timer, Sprints and Circuit. Compact direct parameters and shared focus button; no numeric steppers. |
| 2ca4dbd | Skills searchable activity picker/editor, Home SegmentedSelector Reps/Rounds, persisted numeric parameters and raw drafts; transactional schema v11. All six affected verifier version assertions advance together. |
| 6c6050d | Android root navigator height avoidance keeps focused numeric fields and workflow actions above the keyboard. |
| 4c9b2fa | Display-only dedup of identical serving choices; prefer selected/default ID while preserving all canonical and historical servings. |

All owned source/scripts are committed. Root used commit --only with explicit owned paths. Nutrition and Conditioning commits retain schema 10 assertions at their own baselines; version 11 expectations land with the Skills migration. Final task documentation and Feature Tree changes are a separate scoped commit.

## Decisions and compatibility

- Shared presentation: src/components/training/{TrainingNumberField,EstimatedFocusButton}.tsx and src/components/WorkflowChrome.tsx. Numeric controls accept raw editable text, with action-time validation and no +/- or numeric preset controls. Domain validation/calculation stays outside the shared controls.
- Strength: src/screens/strength/{WorkoutBuilderScreen,ExerciseEditorScreen}.tsx. Search belongs only to Add Exercises. Existing optional/null/mixed targets and separate Save/Unsave persistence remain.
- Nutrition: src/screens/NutritionScreens/NutritionFactsScreen.tsx; src/components/MacronutrientBreakdownCard.tsx; src/components/nutrition/calorieText.ts; src/nutrition/servings.ts. Genuine explicit provider/custom defaults and household portions win. Alternate measurement-only choices such as 1oz are conversions rather than regular-serving evidence. Known mass without a real portion falls back to 100g; no density or physical size is invented. Old mg IDs remain resolvable but unavailable for new selection. Identical label/amount/unit/nutrient display choices collapse without mutating food.servings; different household labels or nutrient payloads remain distinct. No Nutrition DDL change.
- Conditioning: components/conditioning/ConditioningSessionChooser.tsx and screens/conditioning/CreateConditioningSessionScreen.tsx. The chooser is an explicitly requested native modal. Time Interval has compact Parameters and Estimated Focus, with an implicit new-record title; existing titles remain. Blank required fields fail validation; explicit zero rest is valid. Existing Time Interval validation requires target work RPE; optional RPE remains optional only in formats that already permit it. Timer/GPS/session state and canonical units remain.
- Skills: screens/skill/{AddSkillActivitiesScreen,SkillActivityEditorScreen,SkillSessionBuilderScreen,SkillSessionDetailScreen,SkillStack}.tsx; state/SkillWorkspaceContext.tsx; skill/activityForm.ts; data/{database,skillRepository,skillRepsMigration}.ts. Raw fields for both modes survive toggles/nested/tab navigation. Legacy duration activities remain supported.
- SQLite v11 rebuilds only skill_template_activities and skill_session_activities, transactionally preserving child IDs, parent foreign keys, positions, legacy inputs and stored estimates. Adds reps/sets/numeric RPE/rest with active-mode CHECK constraints; inactive fields remain null. Parents skill_templates, skill_sessions and timeline_entries remain unchanged. Startup checks both child sentinels, even at user_version 11; rollback/retry is covered. Reps estimates use the actual Strength helper (3 seconds/rep, omitted rest 90 seconds, no trailing rest). New estimates use skill-energy-v2-reps; historical estimates remain untouched. Detailed relationships, constraints and preservation contract: [[Data and Persistence]] and [[2026-11-24 Skills Reps Refinement Handoff]].

## Automated verification

- Final integrated node node_modules/typescript/bin/tsc --noEmit passed after 4c9b2fa.
- Targeted ESLint passed across changed source/scripts, with follow-up navigation and serving dedup checks after their fixes. Whitespace diff check passed.
- verify:nutrition, verify:conditioning, verify:skill, verify:strength, verify:recovery and verify:weight passed at shared schema 11. Nutrition passed again after the final display-dedup correction. Existing Node experimental/module warnings only.
- Skills coverage includes fresh v11, v10 row/ID/header/estimate preservation, mode constraints, foreign_key_check, injected migration rollback/retry, current-version repair, rep save/log/reopen, snapshots and idempotent retry.
- Nutrition coverage includes original/provider/custom portions, per100+1oz fallback, household recovery, metric/imperial dimensions, repeated normalization, legacy mg resolution, selected/default display dedup without canonical mutation, differing nutrient payloads, and 1–7 digit/grouped/font-scale-2 sizing.
- Read-only review findings (alternate-unit fallback and footer asymmetry) were fixed and checked. No additional material source issue remains from that review.

## Android acceptance and cleanup

[[2026-11-24 Compact Logging Android QA]] records exact environment, screenshots/XML bounds and limits. Runtime UI matched 4c9b2fa through frozen archive 2ca4dbd plus exact committed navigation and two serving/UI file copies. A temp-only manifest and explicit unique SQLiteProvider database filename isolated synthetic Nutrition writes; production App.tsx/caps.db were unchanged. A unique Expo slug alone did not isolate the default database, so the explicit fixture was applied before synthetic Nutrition editing; read-only AVD protected original data.

Observed: compact Strength subtitle/no search and footer widths 217/216/217px with common 91px height; all four Conditioning choices and Free/Time Interval navigation, direct parameters, required interval-RPE validation and focus update; focused input/actions above Android IME and full viewport restored on tab transition; Skills picker/search/Reps/Rounds/guarded return and added 1 set × 5 reps estimating 15 seconds; Nutrition anchored overlay/no mg, full 1,000,000-calorie display with IME open, compatible 100g→1kg quantity conversion, Back dismissal, and exactly one 100g choice after final dedup/reload.

Native font-scale enlargement, iOS, live provider search, GPS/timer execution, persisted training templates/logs and meal log persistence were not run. Pure sizing tests cover font scale 2; repository suites cover persistence/migration but do not replace those native checks.

Cleanup verified 2026-11-25 00:20 EST: original 1080×2400/density420/font1.0 restored; task emulator-5556 and Metro8085 stopped; task PIDs absent; user Metro8081 PID21792 still listening; exact temp node_modules junction unlinked before verified temp project removal; shared dependencies intact. Evidence remains under work/compact-logging-qa/20261124-2ca4dbd (not committed).

## Memory, Feature Tree and ownership

Canonical notes and applicable UI/navigation rules reflect the implemented behavior, SQLite v11 and verified keyboard scope. Local Feature Tree workflow: node scripts/feature-tree.mjs regenerates data/commits.js and validates all eight trees; --check is read-only. All eight trees validated after generation: 272 commits through the final source revision, 25 historical/documentation mapping warnings, zero errors. Data-file ESLint and diff whitespace checks passed. Source mappings include final serving dedup, shared controls, Skills child tables and Android navigator fix. Local HTML data synchronization is complete; no separate external publication endpoint or browser visual audit is claimed.

Root owns final Git/index and docs integration. All source/review/QA agents released ownership; no device/process work remains. Preserve original unrelated .cursor/caps-obsidian deletions, general-rules.mdc edits, deleted 00-Index.md, untracked Index.md/.obsidian/work, Project History and older vault handoff changes. No branch switch or push.

Related scoped implementation checkpoints: [[2026-11-24 Nutrition Portion Refinement Handoff]], [[2026-11-24 Conditioning Refinement Checkpoint]], [[2026-11-24 Skills Reps Refinement Handoff]]. This final handoff and Android QA supersede their earlier pending integration/device statements. No required implementation work remains; unrun native coverage is listed above.
