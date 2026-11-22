# CAPS-owned ORI v1 handoff

2026-11-22 00:05 EST (America/Toronto). Codex /root on main, starting8ab0de7. User explicitly requests own ORI from HealthKit/Health Connect, superseding initial unconfigured default. No delegation. Prior user vault/rules changes preserved.

Implemented src/recovery/objectiveRecovery.ts and integrated persisted snapshots, Recovery contributor/coverage card and source/model-partitioned Progress series. Types accept numeric ORI/version/details; legacy null cache upgrades from retained raw measurements. Removed obsolete always-null helper. New verify:ori and repository numeric/deletion regression. Full formula/source/eligibility/SQL JSON and rollback details: docs/caps-ori-v1.md; canonical [[Recovery and Progress]].

Version caps_ori_v1 uses HRV40/RHR30/measured-sleep30,14 comparable prior days per input, preceding28 days excluding today. No manual/questionnaire/vendor inputs, no missing-weight renormalization. Experimental product choices, not validated physiological recovery percentages. No DDL, native permissions or dependency changes. Existing snapshot PK/FK preserved; JSON adds provenance and model details. Raw records remain source of truth.

Verification: ORI unit/chart fixtures and Recovery numeric/deletion integration pass; existing Progress and health verifiers pass; integrated TypeScript passes. Targeted ESLint passed without warnings. Existing Feature Tree data is synchronized and valid (18 historical unmapped-commit warnings; new source commit mapped). Source commit: 1a2e0fb; documentation commit contains this note. Real sensor/on-device and prospective performance prediction validation not run.

Root owns all changed files, canonical note and established Feature Tree updates. Next: on-device real sample QA, prospective independent jump/grip/sprint validation and calibration; tune only under a new model version. Do not interpret score as medically validated readiness. See git log for source/documentation commits containing this note.
