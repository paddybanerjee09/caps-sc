# Questionnaire and chart controls handoff

22 November 2026, 11:47 EST (America/Toronto). Codex /root on main, starting revision 0a24b85. Latest request: minute sleep clocks, defaulted numbered sliders, editable history screen, readable app dates, weighted SRI and Progress overlay/navigation/legend/axis changes.

## Source milestones and coordination

| Commit | Completed scope |
| --- | --- |
| 75c7dd4 | Shared displayDate formatter and regression fixtures; readable full dates in clocks, calendar selected dates/accessibility, Home/Recovery, diary and training details. ISO keys/timestamps unchanged. |
| cb32262 | Two minute-resolution sleep clocks, no timeline; calculated interval/estimated total; full-width numbered/notched sliders without visible +/-; awakenings default 0, 10+ lower bound, other ratings default 5. Separate history screen with edit/Back/save/X guards. Weighted SRI v2 and legacy version retention, transactional revision/cache tests. |
| 5544ea6 | Anchored overlay graph menu, current-period reset on timeframe selection, remove datapoint arrow bar, below-plot values as toggle legend, responsive X labels, higher-is-better wellness, requested axis ticks/bounds and lower-bound values. |
| c1193f1 | Shared maximum Y-label gutter aligns synchronized chart plots/cursors at large font sizes; pure regression fixtures. |

Root integrated repository/model/Home/history and documentation. questionnaire_controls, progress_controls and display_dates used disjoint ownership and have released it. Independent questionnaire/history integration review found no concrete issues; final date audit found no material user-visible full ISO dates. The chart review found and fixed the shared-gutter issue. No agent source edits remain pending. This handoff and associated canonical notes/Feature Tree contain the documentation milestone; these source commits are local, not pushed or deployed.

## Durable decisions and compatibility

Canonical notes: [[Recovery and Progress]], [[Home]], [[UI and Interaction Decisions]], [[Data and Persistence]]. Detailed formula, interaction and relational contract: docs/questionnaire-sri-v2.md. Rules: AGENTS.md, globally applicable .cursor/rules, ui-style-guide sections 8–10 and relevant scoped calendar/navigation rules. Existing React Native/Expo patterns were followed; no new dependency.

- SRI v2: quality 30%, inverse fatigue 25%, inverse soreness 20%, inverse stress 10%, motivation 5%, mood 5%, inverse awakenings 5% with cap 10. All ratings normalize by 10, result rounds to 0–100. New defaults produce 53; these app weights are not empirically calibrated. ORI and native health scoring/import unchanged.
- Old responses with absent version or sri_v1 keep original scores on health recomputation. New/edited saves record sri_v2, including required mood; original responses remain in append-only revisions. Progress separates original/weighted versions.
- SQLite user_version remains 10: no DDL. daily_questionnaires PK(owner_id,local_date) retains owner FK and JSON response. questionnaire_revisions PK(owner_id,local_date,revision) retains composite active-response FK with ON DELETE CASCADE. recovery_snapshots PK(owner_id,local_date) retains independent owner FK, allowing health-only days. Existing JSON adds sriVersion/awakeningsAtLeast; save active/audit writes are transactional, followed by affected-day recomputation. Downgrading unaware code is not supported automatic rollback; never drop tables to revert this change.
- Awakenings 10+ is a lower bound, propagated to period means/tooltips, not a fabricated exact count. Existing exact counts >10 are retained. Moving slider away clears its bound marker. Sleep interval is not falsely stored as measured asleep time.
- History stays a separate Home workflow branch, with editors returning to it on Back/save, X exiting to Recovery and dirty/pending-save guards retained. Raw wellness answers remain unchanged; chart display alone inverts fatigue/soreness/stress.
- Full date presentation is 22 Nov, 2026. Date keys preserve written calendar date; instants use local timezone. Month/year ticks remain concise. No ISO storage/query changes.

## Verification and limits

- npm run typecheck and full npm run lint passed.
- All ten verification suites passed: verify:nutrition, conditioning, strength, skill, recovery, recovery-input, progress, ori, health, display-dates.
- Recovery coverage includes neutral defaults (53), original example (73), weighted example (70), best/worst boundaries, priority weights, minute input, censored count, legacy recalculation and transactional save/revision upgrades. Progress covers shared insets at large scale, axes, X density/fonts, inversions, version separation and lower-bound means. Date fixtures cover local keys, instants, timezones, leap/DST and invalid values.
- Final npx expo export --platform all --output-dir work/recovery-controls-export passed AFTER c1193f1: Android 1361 modules and iOS 1438 modules, Hermes bundles produced. These are bundle checks, not native signed builds or phone acceptance.
- npm run feature-tree regenerated commits.js and validated all 8 trees. Added history, weighted SRI and shared date nodes; updated affected Home, architecture, database and domain date nodes. All four new source commits mapped; 20 historical unmapped documentation/setup commits remain as warnings, no errors. Established local HTML Feature Tree synchronization complete; no separate publication endpoint is documented.
- Physical-device visual/gesture/large-font/keyboard/screen-reader/history-navigation acceptance remains unrun. Real HealthKit/Health Connect permission/data acceptance remains the existing native setup follow-up; no claim of live sensor verification.

## Preserved user changes and next actions

Do not stage/reset unrelated pre-existing changes: deletions under .cursor/caps-obsidian, modified .cursor/rules/general-rules.mdc, deleted caps-vault/00-Index.md, untracked caps-vault/Index.md and .obsidian, modified Project History and 2026-11-15 Vault Backfill Handoff. Index.md was used as the available entry point; the missing former path is a user change. Ignored scratch export output remains under work/.

Next: run physical-device acceptance for both platforms, particularly overlay menu at screen edges, large text/plot alignment, slider gesture/a11y, DST sleep selection, history edit Back/save/X and discard behavior. Native import still needs actual bundle/package identifiers, build/signing configuration and an installed development client as documented in docs/recovery-native-setup.md. Future weight calibration is a model-version change, not part of this request. No implementation or Feature Tree update is otherwise pending for this task.
