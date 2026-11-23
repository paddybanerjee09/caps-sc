# Athlete information, navigation and training UI refactor

23 November 2026, 12:59 EST (America/Toronto). Codex /root on main, starting revision 77c0749; final source revision 65e148a. Source implementation, automated validation, canonical memory and Feature Tree synchronization complete.

## Scope and coordination

Implement the attached CAPS UI/UX refactor directly: interactive Biometric Overview, DOB/sex/height editors, one real app-wide weight modal, settings menu/sidebar behavior, chevron date navigation, shared training calendars/saved workouts/session actions. User follow-up explicitly requires replacing the current weight screen overlay with an actual reusable modal wherever weight logging is invoked.

Rules: AGENTS.md, global .cursor/rules and applicable calendar/conditioning rules. Skills: react-native-patterns and relevant Expo workflow guidance. Canonical notes: [[Settings]], [[Home]], [[Weight and Sleep Logging]], [[Home Day Timeline]], [[App Architecture]], [[UI and Interaction Decisions]], [[Data and Persistence]], [[Conditioning]], [[Strength]], [[Skills Training]].

Biometrics, training and navigation agents completed disjoint source work and released ownership, including the final Feature Tree update. Root integrated Home, weight-history tests, canonical notes, rules and documentation. Navigation independently reviewed training and biometric integration without additional findings. No ownership remains active. All commits are local; nothing was pushed or deployed.

## Source milestones and affected files

| Commit | Changes |
| --- | --- |
| a09ebfe | Shared components/ActionButton and components/training/{SavedWorkouts,TrainingSessionActions}; all three hubs reuse common calendar layout, saved-workout expander and actions. Remove Browse button, obsolete conditioning/SavedWorkoutGrid and SavedConditioningSessionScreen, and unused saved workspace route. No domain schemas changed. |
| 8225102 | Shared MenuButton through Header/WorkflowChrome/Screen/Screens; AppNavigator and Sidebar use settings menu/exit behavior. Settings and Account pass menu props; Account guards draft exits through tabs/sidebar; Nutrition removes numeric day captions. |
| 65e148a | Interactive AthleteInfoScreen, actual shared WeightLogModal, FormModal, BiometricEditModal and ScrollPicker; profile storage/AppState, pure athleteProfile/biometrics helpers, precise unchanged weight conversion; Home DOB age + day chevrons. package.json adds verify:biometrics/weight scripts. |

Canonical vault notes, docs/conditioning-implementation.md and ui-style-guide.mdc record the resulting architecture and explicit user exceptions. The guide preserves the actual modal requirement and settings-only header exception. No new dependency or lockfile change.

## Findings and active decisions

- WeightLogModal now renders a real React Native Modal through FormModal, with its date/time picker inside the body. Home Quick Log, Home history edits and Athlete Information reuse it. Edit/delete, chosen timestamps and local-day display remain. Save locks prevent repeat submission; postcommit refresh failure cannot invite duplicate inserts. Empty/invalid/future drafts cannot save, cancellation does not persist, and unchanged rounded input preserves exact original kg for new logs and edits.
- Profile previously had only in-memory age/height/sports, screen-local sex and no DOB. New device-local profile persistence uses installed expo-sqlite/kv-store, database ExpoSQLiteStorage, storage(key TEXT PRIMARY KEY NOT NULL,value TEXT), key caps.athlete-profile.v1. Stored JSON includes firstName/lastName, legacy age, dateOfBirth, sex, heightCm and sports; weightKg is excluded in both directions. There is no caps.db migration (still v10). The detailed relational contract is in [[Data and Persistence]]: timeline_entries parent/weight_logs primary-and-foreign key with cascade, transactional add/edit, newest by logged time, stable edit ID. Serialized profile patches/hydration generations prevent overwriting unrelated edits or weight projections.
- DOB stays a local YYYY-MM-DD with valid calendar/future/year bounds; age is derived, with legacy fallback until explicit DOB save clears age. No birthday is fabricated from a stored age. Height uses cm or independent feet/inches columns. Shared scrolling picker follows current theme/time-wheel conventions without a native dependency.
- All three hubs already used MonthlyTimelineComponent. Conditioning's redundant wrapper is removed to retain Strength/Skills presentation. Shared SavedWorkouts accepts a small typed presentation interface; repositories/workspaces and full template records remain discipline-owned. Free/Create keep Strength log/template modes and Conditioning recording/format chooser. Skills already has one builder with separate Save and Log; both standardized launch buttons retain it. No invented Skills timer or session-data migration.
- Home/Nutrition day chevrons retain handlers, dates and bounds, without numeric +/-1d captions. Monthly/log-time day arrows already used chevrons. Legitimate workout counts, rounds, RPE/work-rest duration, distance/elevation parameter adjustments remain because they configure workouts, with direct input where present. Accessibility increment/decrement actions, add icons, calendar +N overflow counts and arithmetic are not inappropriate visible personal/date steppers.
- Settings headers have no global timestamp; menu opens the existing sidebar, sidebar X exits to remembered main tab, scrim/first hardware Back dismisses drawer. Account dirty guards and Athlete sports-save guards cover route exits. Native Modal blocks background settings/tab interaction while biometric saves are pending. Primary workflow X/footer contracts remain.

## Verification and remaining work

All ten pre-existing domain commands passed during implementation: verify:nutrition, conditioning, strength, skill, recovery, recovery-input, health, progress, ori and display-dates. Training's three domain verifiers passed again after integration; Conditioning passed after unused route removal. Both new commands passed: verify:biometrics (DOB birthday/leap/future/year bounds, profile serialization/filtering/excluded weight and conversion precision) and verify:weight (real in-memory SQLite local timestamps, precision, backdating/latest, stable edit IDs, cascade deletion and injected insert/edit rollback). An initial new-test adapter varargs mismatch was fixed before the passing run; it was a test harness error, not a repository change.

- Integrated npm run typecheck and full npm run lint passed; final frozen-source typecheck and impacted biometric lint passed. All owned-file targeted lint and diff checks passed.
- Final npx expo export --platform all --output-dir work/recovery-ui-refactor-export passed for Android (1371 modules) and iOS (1448), producing Hermes bundles. Initial sandbox run could not execute installed hermesc.exe; the permitted rerun passed. This is bundle validation, not a signed native build or device test.
- Native modal/nested time picker, keyboard, wheel momentum, large fonts, VoiceOver/TalkBack, app restart hydration and Android/iOS settings/back navigation acceptance remain unrun. These are the next device-QA steps; no known source blocker remains. Existing in-memory units/appearance/audio/username and unwired Home training Quick Log buttons remain outside this refactor.
- npm run feature-tree regenerated commits.js and validated all eight trees; root independently reran npm run feature-tree -- --check successfully. All three new source commits are mapped with exact commit dates. There are 21 historical unmapped-commit warnings, no errors. Updated-data ESLint and diff checks passed.

## Preserved changes and Feature Tree

Pre-existing user work remains unstaged: .cursor/caps-obsidian deletions, modified .cursor/rules/general-rules.mdc, deleted caps-vault/00-Index.md, untracked Index.md/.obsidian, modified Project History and 15 November Vault Backfill Handoff. Use caps-vault/Index.md as available entry point; do not restore or stage those changes.

Established Feature Tree is docs/feature-tree with data/*.js and npm run feature-tree. Local HTML data synchronization is complete: affected Home/settings/navigation/biometric/training nodes have current summaries/guardrails/history, canonical modal/picker/menu/session-action/KV nodes and shared references, and the obsolete library is marked removed with history preserved. Source guardrails/history were read and all eight trees validated. Browser access to its file URL was blocked by the browser protocol policy (http/https only); no workaround was attempted. Visual browser verification remains unavailable through that file URL; no separate publication endpoint is documented or claimed. No Feature Tree write is pending.

Ignored bundle output remains under work/recovery-ui-refactor-export. Next work is the device acceptance listed above; there are no unfinished requested source, memory or visualization changes.
