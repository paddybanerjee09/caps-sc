# Minimal UI and health connection handoff

2026-11-22 00:30 EST (America/Toronto). Codex /root on main; starting revision 1bd1642. User asks app-wide minimal copy, concise Recovery metric definitions/requirements, -- missing values, no unavailable/status paragraphs, questionnaire cleanup, compact Progress with graph dropdown/value-only tooltips, and health connection explanation.

## Completed source work and ownership

| Commit | Scope |
| --- | --- |
| 76e2ec9 | Recovery metric cards get only values + short definitions/requirements; no diagnostic/history/baseline paragraphs. History folded into check-in; sources/disconnect/delete under health Manage. Questionnaire drops instruction/scoring/helper paragraphs and slider prompts, keeps dates/anchors/errors/guards. |
| e3c0c6a | Choose graph dropdown has exact five requested categories, closes after choice/Android Back. Existing timeframe selection, legend/source distinctions and cursor retained. Period jump/refresh compacted; tooltips show values/units, date retained accessibly without repeated visual rows. Empty graphs no longer allocate full chart height. |
| 40f02f4 | Remove generic subtitles across all main/settings/account/athlete screens, prevent empty subtitle row, shorten repeated training/meal hints and estimate metadata. Missing display values use -- across screens/helpers. Update existing Strength expected empty-value string. Style guide section9 persists user's minimal-copy preference. |

Root integrated shared updates. Agents compact_questionnaire, compact_progress and health_setup_audit worked on disjoint paths and released ownership. No source/data/model/native dependency changes pending from agents. This documentation commit contains canonical note/Feature Tree updates and native connection instructions.

## Unchanged data contracts

No database migration, repository/calculation/ORI algorithm, native health adapter or permissions change. Null is still missing; -- is presentation only. SRI/ORI scores and originals, source/subtype/protocol/model identities, timing, coverage and revision history remain stored. Removing diagnostic prose does not combine unlike sources or invent readings. All controls remain >=48px. Actual validation, retry, deletion/discard and draft-save/navigation protections remain.

## Verification and limits

- Integrated TypeScript passed; full ESLint passed (zero diagnostics), plus owners' targeted checks and diff checks.
- All 9 existing commands pass: verify:nutrition, conditioning, strength, skill, recovery, recovery-input, progress, ori, health. Strength's old em-dash expectation initially failed and was updated to the newly requested -- display contract; rerun passes.
- Local Android Metro/Hermes export passed in work/recovery-compact-export (1359 modules). Native iOS build, phone visual/large-font/screen-reader/keyboard/gesture exercise and real sensor permission testing remain unrun.
- Local Feature Tree synchronization and validation passed: Home Recovery/questionnaire/Progress and graph dropdown, shared screen/style conventions and affected main/estimate/editor nodes. All three new source commits are mapped; 19 historical unmapped-commit warnings remain, no errors. No separate publication endpoint is documented.

## Health import answer

The read-only native bridge packages and plugin/permission configuration exist. Repo still lacks actual ios.bundleIdentifier/android.package, EAS project/development build profile and Android product privacy/rationale destination. Expo Go cannot load the health modules. Configure real identifiers and build/install a CAPS development client (local Android toolchain, macOS/Xcode for local iOS, or EAS signing/cloud build). Have wearable/source app share HRV, resting HR and measured asleep data with Apple Health or Health Connect. Then Home > Recovery > Connect health data > allow read permissions > Refresh. Android 14+ includes Health Connect; 9–13 requires its app. No vendor API key/score import needed. ORI requires 14 comparable prior days for all three inputs, and the 28-day backfill can supply existing history. docs/recovery-native-setup.md now begins with concise steps and official links.

## Preserved work and next steps

Pre-existing user changes remain untouched: .cursor/caps-obsidian deletions, .cursor/rules/general-rules.mdc, caps-vault/00-Index.md deletion, untracked Index.md/.obsidian and modified Project History/15 November Vault Backfill Handoff. Do not stage/reset them. Scratch export output is ignored under work/.

Next: finish actual native build identifiers/setup if requested; then phone QA of compact layouts/dropdown/menu Back/keyboard/large text and real health permissions/data. Follow documented native acceptance procedure. Keep internal scoring/provenance explanations in engineering documentation rather than reintroducing UI paragraphs. Canonical notes: [[UI and Interaction Decisions]], [[Recovery and Progress]], [[Home]].
