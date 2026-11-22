# Recovery and Progress implementation handoff

2026-11-21 21:47 EST (America/Toronto). Integration owner Codex /root; contributors /root/find_caps_repository (domain/persistence), /root/native_health, /root/inspect_charts. Branch main; starting HEAD a98f25a. Source implementation is committed locally; native production acceptance is unfinished.

## Objective, rules and context

Execute the supplied Recovery/Progress plan inside the existing CAPS app. Followed AGENTS.md, globally applicable Cursor rules, existing Home/data/UI notes and latest navigation/SDK handoffs; used Expo overview/UI/native guidance and repository React Native patterns. Root owned Home, navigation guard, shared clock, vault and Feature Tree; delegated files were disjoint. All agents have released ownership.

Original request/spec is preserved at docs/recovery-progress-spec.md. Durable reference is [[Recovery and Progress]] and docs/recovery-progress.md; native setup/device procedure and bridge source links are in docs/recovery-native-setup.md. The companion mathematics document was not available; no claim of having read it. caps-vault/Index.md was used because the user's in-progress vault migration removed 00-Index.md.

## Local commits

| Commit | Result |
| --- | --- |
| ec03ac1 | SQLite v10 local-owner/questionnaire revisions/health records/cursors/snapshots/baselines/source preferences; validated SRI and objective mathematics; existing weight queries and migration regression expectations. |
| c9e7f88 | Installed/read-only native health bridges, platform lazy import, native configuration, 28-day authorized history, incremental changes, source sleep normalization, edits/deletes/disconnect; native setup notes and fixture verifier. |
| a97bb78 | Integrated Recovery into existing Home selector; due notice, questionnaire overlay/drafts/history, full-date quarter-hour controls, missing/provenance cards, current-day/foreground lifecycle, saved timezone and unsaved route guards. |
| 9634b61 | Five Progress groups, Week/Month/Year/Lifetime, calendar navigation, coverage/version-aware means, discontinuous SVG lines, top toggles and synchronized date inspection. Shared conversion helper and verification commands. |
| 80b09ff | Correct travel-day assignment from source wake zones/native UTC offsets, preserve explicit sleep wake boundaries and label displayed timestamps as device time; regression fixtures. |

Documentation/Feature Tree changes are in the commit containing this handoff. See git log for its hash; do not infer that new docs prove device acceptance.

## Verification evidence and limits

- TypeScript and full ESLint pass. The final run after the shared-clock DST day-change fix passed. The source-timezone follow-up also passed full TypeScript, targeted lint and Recovery/health fixtures.
- All four existing domain verifiers pass after updating only their expected schema version to10: nutrition, conditioning, strength, skill.
- New npm commands verify:recovery, verify:recovery-input, verify:health and verify:progress pass. They cover null/zero, SRI73, overnight/DST durations and repeated-hour controls, revision conflicts/history, real rollback of sample+cursor on simulated disk failure, native anchor/change/deletion/backfill races, source/subtype/protocol separation, no inferred efficiency, baselines/no current-day leakage, calendar boundaries/gaps/means/rolling-weight coverage and no model ORI.
- Expo dependency compatibility and native configuration introspection pass: HealthKit entitlement/read purpose, no write or background health delivery, exactly needed Android health reads. Existing location/camera/audio settings remain.
- Android and iOS JS/Hermes exports pass (1358/1435 modules). The first sandbox export was blocked executing hermesc.exe; a permitted local retry passed. The final export after the last DST validation change passed on both platforms. These are not signed native builds.
- Feature Tree local synchronization is complete and validated via npm run feature-tree: Home Recovery/Progress versions, new questionnaire child, Database v10/8 table nodes and Architecture native health service. All five new source commits are mapped; 17 historical unmapped-commit warnings remain, no schema/link errors. No separate publication endpoint is documented or claimed.
- No physical iOS/Android client, real permission prompt, actual sensor data, screen-reader, touch/keyboard/large-font exercise, years-of-history device profiling or scientific scoring validation was performed.

## Decisions and retained restrictions

SRI is sri_v1, not Hooper; equal contributions and awakening cap5 are app-defined scoring choices. Awake count input itself has no arbitrary maximum10. Mood is optional/chart-only. ORI remains null/em dash without transforms/weights. Baselines use previous28 calendar days, minimum14 comparable valid days, sample SD and zero-variance suppression; RMSSD uses lnRMSSD and never SDNN. Native HRR60/temperature deviation remain unavailable without required comparable inputs. Sleep interval is not asleep time; estimated manual asleep needs explicit minutes awake, efficiency needs actual compatible in-bed coverage.

Data is device-local, no auth/backend/RLS/remote health sync. SQLite uses application sandbox/device protection, not newly added database encryption. v10 is additive with repair sentinel and retains existing weights/training/meals/sleep plans. Eight new Recovery tables and their exact PK/FK relationships, transactions, deletion and rollback consequences are documented in docs/recovery-progress.md. Imported deletion waits for active sync, clears imported samples/cursors/raw sleep cache/derived data and retains questionnaires/revisions/weight; disconnect alone retains everything and does not revoke OS permission. Existing timezone-free weight history follows current device timezone; native/questionnaire records preserve assigned dates and timezone metadata/fallback basis.

Optional device notification delivery is deferred; the in-app due notice works in code. Native build identifiers, Android privacy/rationale destination, retention/security release decisions and physical-device acceptance remain open. Android expired change tokens can require explicit older-history reimport; native sleep's retained stage cache requires long-history profiling.

## Preserved user work and coordination

Do not stage/reset the pre-existing .cursor/caps-obsidian deletions, .cursor/rules/general-rules.mdc edits, caps-vault/00-Index.md deletion, untracked Index.md/.obsidian, Project History.md edits or 15 November Vault Backfill Handoff edits. This task leaves them intact. Root updated only relevant canonical Home/persistence/architecture notes, crosswalk/handoff navigation and established Feature Tree files. Scratch work and local bundle output are under work/; they are not a release.

## Next actions in order

1. Set actual iOS bundle ID/Android package name using the product's release setup, provide the Android permission-rationale/privacy-policy destination, and decide retention/security requirements. No identifiers or external accounts were invented.
2. Build fresh native development clients; follow docs/recovery-native-setup.md on physical iOS/Android. Verify real subtype/provenance, partial/denied/revoked permission, multiple sources, backfill/late edit/deletion, disconnect/delete/reconnect and offline failures.
3. Exercise questionnaire and charts on devices: missing vs0, first/second DST occurrences, unusual sleep/wake dates and travel, midnight/resume, previous-day edits, unsaved X/Cancel/Back/tab/sidebar guards, save failure/draft recovery, legends/timeframes/date cursor, small widths/large text/screen reader and scroll/gesture arbitration.
4. Profile years of actual history; optimize raw sleep-cache recomputation/storage if needed. Optional configured device reminders can be added later with timezone/completion-aware suppression.
5. Keep ORI absent until a separately approved, versioned transformation/weights model and independent longitudinal validation exist. Update canonical notes/tree only with actual evidence.

## Final review follow-up completed

Commit 80b09ff fixes sleep recovery-day assignment from the wake-ending source zone and uses actual Health Connect native UTC offsets after travel. Fixed-offset arithmetic avoids assuming Hermes Intl supports offset names; it does not invent an IANA location. Kotlin source confirmed native sleep start/end offsets are exposed even though omitted from the installed TS sleep interface. Source session wake boundary is retained without manufacturing asleep/in-bed minutes. Recovery and health fixtures, targeted lint and integrated TypeScript passed. Native setup/canonical notes and the Architecture health-service version are updated. The final Android/iOS Metro/Hermes export after this fix passed (1358/1435 modules). Physical-device acceptance remains unverified.
