# Training session workflow

- Completion: 24 November 2026, 18:23 EST (America/Toronto); Codex /root and delegated training/data reviewers. Source revision 6cb81e2, following shared-controls revision 6dfbf84; this handoff is in the subsequent scoped documentation commit.
- Branch: `Skill/Conditioning/Strength-Changes`. Git forbids spaces, so this is the Git-safe form of the requested “Skill/Conditioning/Strength Changes”.
- Scope: remove Create Session on Strength, Skill and Conditioning hubs; Strength/Skill use Log Session and immediate Save/Unsave. User explicitly clarified Conditioning keeps Free Session and existing saving behavior. Rebuild Strength composition, catalog picker and compact exercise editor.
- Rules read: root AGENTS.md; global .cursor/rules and relevant UI/conditioning rules. Available vault entry is Index.md; 00-Index.md was already deleted before the task and is preserved. Relevant context: [[Strength]], [[Skills Training]], [[Conditioning]], [[App Architecture]], [[Data and Persistence]], [[2026-11-23 UI Refactor Handoff]], [[2026-11-15 Strength Implementation Handoff]]. Skills: react-native-patterns, Expo overview/native-ui/UI; existing shared chrome/theme has priority over generic skill patterns.

## Completed source

- Shared TrainingSessionActions is one launch, default Log Session; Conditioning overrides Free Session. Removed Conditioning chooser-only code; existing saved structured workouts still open/edit/start. No replacement Create entry added.
- Skill builder exposes persistent Save/Unsave with rapid-submission lock, pending edit/exit guards, and preserved drafts on failure. No Skill schema change.
- Strength builder uses title, estimated duration without Starts, search within selected workout exercises, Exercises card and Add Exercises. Removed inline default catalog results, From saved workout and save toggle. Save/Unsave persist immediately; edited saved templates retain their header ID on save. Timestamp-only changes do not change template state. Logging uses persistTemplate:false so Save owns template mutations.
- New AddExercisesScreen: separate virtualized catalog, All/Favourites, persistent stars, missing/failed media fallback and Back-only footer. Existing custom rows can appear under All, but no Custom tab/creation action exists.
- Replaced ExerciseEditorScreen: direct Sets/Reps/RPE/rest-seconds/notes text boxes, local validation, compact layout and optional image. Add Exercise returns to workout; Back and X retain draft guards. Preserve existing mixed targets, loads and performed flags unless explicitly changed.
- No schema migration: caps.db remains v10. Omitted loads remain null and produce no invented relative-load evidence. Existing explicit invalid load values are rejected. Template writes now own fresh exercise/set snapshot primary keys, fixing Save → Unsave → Save → Log/update collisions. Existing session identities and retry semantics remain.
- Persistent favourites use existing ExpoSQLiteStorage storage(key,value), key caps.strength.exercise-favourites.v1, serialized updates. See [[Strength]] for detailed relational and KV contracts.
- Image metadata is optional and supported, but current catalog has no usable licensed image URLs. Do not invent upstream image mappings. No downloaded/generated image assets or dependencies added.

Affected source: src/components/training/TrainingSessionActions.tsx; src/components/strength/ExerciseImage.tsx; src/screens/{StrengthTrainingScreen,SkillScreen,ConditioningScreen}.tsx; src/screens/strength/{WorkoutBuilderScreen,AddExercisesScreen,ExerciseEditorScreen,StrengthStack}.tsx; src/screens/skill/SkillSessionBuilderScreen.tsx; src/state/StrengthWorkspaceContext.tsx; src/data/{strengthRepository,strengthExerciseFavourites}.ts; src/strength/{drafts,types,media,exerciseForm}.ts; scripts/verify-strength.mjs.

## Verification at this checkpoint

- verify:strength passed including mixed-field preservation, omitted loads/null emphasis, exact save-toggle/log/update roundtrip, template replacement rollback/retry, independent snapshots and persistTemplate:false.
- verify:skill and verify:conditioning passed; their changed UI files targeted ESLint passed.
- Integrated TypeScript passed after correcting picker ListFooterComponent null to undefined.
- Targeted Strength ESLint passed across changed screens/components/workspace/domain/repository/test files. A few earlier parallel lint attempts timed out without diagnostics; a later direct ESLint process exited 0.
- Native export attempted with node node_modules/expo/bin/cli export --platform all --no-bytecode --max-workers 2 --output-dir work/training-session-export. It stalled after Metro startup/worker color warnings without module output for about seven minutes; stopped with Ctrl-C (exit 1). No bundle success or native device verification claimed. No configuration changed to work around it.
- Feature Tree synchronization complete in the established local HTML data workflow: strength.js, skill.js and conditioning.js use exact source hashes/dates; commits.js regenerated without losing Nutrition history. QA integrated the reserved architecture training-session-actions node with 6dfbf84; root read and verified it. Generator and independent --check both pass all eight trees, with 23 historical/documentation unmapped-commit warnings and no errors. No separate publication endpoint is documented or claimed; browser visual verification was not run.
- No new training device pass. Remaining native acceptance: keyboard/footer and large text, Add/back/X from deepest route, favourites across restart, save/unsave failure recovery and optional-image rendering.

## Git and concurrent ownership

Other chats are active in the shared checkout. Existing Nutrition changes and biometric QA files were not this task's work. Android QA repaired an accidentally mixed tip commit with the actual Nutrition owner's approval. Nutrition completed its commits at e4b1ffd and explicitly released an empty index; QA then granted Strength an exclusive Git/index/commits.js window. Root used explicit commit --only paths, preserving unrelated changes.

Android QA owns shared architecture.js/home.js/settings.js and QA memory; Nutrition owns its source/notes/tree and global Handoffs.md. Training owns strength.js/skill.js/conditioning.js and canonical training notes plus this handoff. QA updated the shared architecture training-session-actions node with the supplied source hash/date; its file and remaining QA documentation stay QA-owned. All subagents released source ownership. No external push/deploy or shared-file reset performed here. The Git window returns to QA immediately after the scoped training docs commit; no additional training mutation is planned.

## Source commits and completion

- `6dfbf84` — simplify shared training launch controls, remove Create on all hubs, retain Conditioning's name/save exemption, and implement Skill Save/Unsave.
- `6cb81e2` — Strength session composer, All/Favourites picker, compact editor, preserved raw drafts, immediate template state and persistence regressions.
- This scoped docs commit updates the three canonical training notes, three training trees, regenerated commits.js and this handoff. Global Handoffs.md and all unrelated vault/rule edits are preserved.

No requested source or training-memory work remains. Local Feature Tree synchronization is complete and validated; QA owns committing its already-verified shared architecture node with its own docs. Device acceptance remains unrun: keyboard/footer and large text, deepest Add/Back/X flow, favourites after restart, save/unsave failure recovery, and supplied-media rendering. Current catalog has no usable image URLs, so rows show the neutral fallback. Native export did not complete as described above.
