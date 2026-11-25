# Skills Reps/Rounds refinement

24 November 2026, America/Toronto. Codex /root/skills_refinement, branch `Skill/Conditioning/Strength-Changes`; delegated source/docs work is uncommitted and ready for root integration. Root owns all Git/index writes and the final overall handoff.

Scope: compact Skills composer with small estimated-time subtitle; remove Summary and inline Add Activity; add searchable activity picker and Reps/Rounds configuration using the actual Home SegmentedSelector plus shared TrainingNumberField. Direct text inputs only. Rules/context: root AGENTS.md, global .cursor rules and UI guide; [[Skills Training]], [[2026-11-24 Training Session Workflow Handoff]]. Available vault entry is Index.md; deleted 00-Index.md remains preserved.

Completed source:
- src/screens/skill/SkillSessionBuilderScreen.tsx rewritten as compact composer with selected Activities card, separate picker, retained Save/Unsave and log safeguards.
- New AddSkillActivitiesScreen.tsx and SkillActivityEditorScreen.tsx; SkillStack routes; SkillWorkspaceContext holds nested stack/search/raw fields and save lock. Back/X, category switching and tab changes preserve parent/raw drafts.
- src/skill/activityForm.ts validates direct reps/round parameters; domain types/drafts/timing/energy/present/validation support real reps, optional numeric RPE and optional rest. Reps uses the actual Strength helper (3s/rep, omitted rest90s, zero explicit, no trailing rest). New logs use skill-energy-v2-reps.
- src/data/skillRepsMigration.ts transactionally rebuilds only the two activity-child tables at v11, preserving old IDs, FKs, unique positions and stored estimates. database.ts owns v11 and both column sentinels, including current-version repair. skillRepository round-trips real rep fields, numeric RPE and snapshots; old duration/round records remain readable.
- SkillSessionDetailScreen shows stored work+rest timing rather than recalculating rep estimates later.
- verify-skill regressions cover fresh11, legacy10 survival, interrupted migration rollback/retry, advanced-version repair, reps save/reopen/log, optional/zero rest, numeric-band mapping, raw mode-switch retention, immutable log snapshots and idempotent retry.

Canonical [[Skills Training]] and docs/feature-tree/data/skill.js updated. Six new tree versions (screen,builder,picker,editor,detail,energy) use uncommitted:true pending root's source hash/date. Feature Tree --check passes all8trees with24 historical/docs mapping warnings. Scoped diff-check passes. Full owned-source ESLint passed; final detail/migration/tree lint also passed (exit0). verify:skill passed again after final migration mapping cleanup. Last integrated TypeScript snapshot had no Skills errors but concurrent Nutrition/Conditioning errors; root owns final integrated checks. No native/device pass.

Persistence details and estimate rationale are in [[Skills Training]]. No parent-table/header or historical-estimate rewrite. Numeric RPE maps to established bands only for estimates; exact raw numeric target is stored. Untouched legacy Duration remains unchanged; explicit editor apply can represent it as one round with identical work time. Inactive timing columns store null; raw alternative-category inputs survive within the editor draft until apply/discard.

Next:
1. Root observes remaining targeted lint, runs final integrated checks when other agents finish.
2. Root commits owned source/domain/schema and replaces six tree versions with exact hash/date.
3. Root synchronizes global Data and Persistence/database tree and commits scoped Skill docs plus this handoff.
No subagent Git/index writes occurred. Shared generic fields are root-owned; other domains belong to their agents. Skill ownership released after source handoff.
