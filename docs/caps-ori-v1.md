# CAPS Objective Recovery Index v1

`caps_ori_v1` is CAPS's own experimental 0–100 biometric index. It uses only valid measurements imported through Apple HealthKit or Android Health Connect. It imports no vendor readiness scores and uses no questionnaire answers, SRI, weight or training load. The user explicitly requested this model on 22 November 2026, superseding the initial specification's unconfigured-ORI default. The model is an engineering/product heuristic, not independently validated and not a percentage physiologically recovered.

## Eligibility and source policy

Require all three: HRV (40%), resting heart rate (30%), measured asleep duration (30%). Each needs today's valid reading and at least 14 distinct comparable days in the preceding 28 calendar days, excluding today. No partial-weight renormalization, manual sleep fallback or substitution of unavailable inputs. Coverage measures eligible configured weight; it is not statistical confidence. Missing/baseline-building days retain an em dash with the reason for each contributor.

Per metric, honor saved source preference; otherwise select the most recently observed eligible source identity in the preceding window, breaking ties by stable ID. Keep platform, source app/device, HRV subtype, unit and protocol separate. Select the latest daily reading from that identity; do not average devices. A newly selected source or HRV subtype must establish its own baseline. Exact source/subtype input identity is stored and separates chart series even if model version is unchanged. Acquisition times and interval ends must not be in the future.

## Explicit scoring choices

For each contributor compute personal mean and sample SD from comparable prior days. HRV RMSSD uses ln(ms); SDNN uses raw ms and an independent baseline. For model normalization use `d=(today-mean)/max(SD,noise_floor)`. Raw statistical Z remains unavailable for zero SD; the model's noise floor is an explicit scoring choice, not a replacement for a valid statistical Z.

Noise floors: RHR 2 bpm; lnRMSSD 0.1; SDNN max(1 ms,10% of baseline mean); sleep 30 minutes. These prevent tiny baseline variance from producing extreme penalties. They are not clinically validated thresholds.

With clamp(x)=min(100,max(0,x)):

- HRV score = clamp(100 − 25×max(0,−d) − 10×max(0,d−2)). Unusually high HRV is not automatically rewarded.
- RHR score = clamp(100 − 25×max(0,d) − 10×max(0,−d−2)). Unusually low resting HR is not automatically rewarded.
- Sleep score = clamp(min(100×min(asleep_minutes/480,1),100−25×max(0,−d))). Eight hours is the fixed v1 reference; long habitual short sleep does not automatically earn a perfect sleep score. This is not an individualized sleep-need estimator.
- ORI = round(0.40×HRV score + 0.30×RHR score + 0.30×Sleep score), only when all contributors are eligible.

Typical-baseline HRV/RHR and eight-hour sleep yield 100, meaning no model penalties, not proof of full physiological recovery. Weights, reference sleep, reference 100, penalties and floors are versioned product choices. The score does not diagnose illness, establish safe training intensity or measure muscle/tendon recovery. Respiratory rate, temperature and HRR remain separate marker cards in v1; they are not silently counted twice or represented as missing score inputs.

## Persistence and historical charts

No SQL DDL/schema version change. Existing `recovery_snapshots.snapshot_json` now contains numeric-or-null `ori`, `oriVersion`, and `oriDetails` (contributors, weights, actual input identities/values/units, baseline counts/raw Z, coverage and eligibility reasons). Its existing PK(owner_id,local_date) and local-owner FK remain. Sample and cursor storage is unchanged. Scores are derived from raw health records, not a new vendor or weight table.

Health upserts, corrections, upstream deletions and source changes recompute snapshots through the existing transactional repository. Questionnaire edits recalculate the same day's snapshot but cannot contribute to ORI. Reading legacy unconfigured snapshots upgrades derived cache values using retained measurements; it does not fabricate history. Recovery computes with the same pure model. Progress reads persisted results and partitions model/input identities; missing scores remain gaps and means never combine source/model identities. Deleting imported health data removes ORI eligibility while preserving questionnaires and weight.

Downgrading code does not undo JSON cache additions; old raw inputs remain. To disable the model, change its explicit configuration/version and rebuild derived snapshots; do not delete health/questionnaire records or lower SQLite user_version. No new authentication, cloud sync, permissions or native dependencies are introduced.

## Evidence and remaining validation

`verify:ori` exercises exact baseline100, monotonic unfavorable shifts, incomplete/short history, future data, unverified data, source/subtype separation, bounded outputs and Progress rendering. `verify:recovery` includes persisted numeric ORI and deletion invalidation. Existing Recovery, Progress and health verifiers and TypeScript pass; targeted ESLint is run for the changed files. Native-device/measurement-quality and prospective prediction validation remain open. Future calibration should use independent jump/grip/sprint outcomes and held-out dates, keeping subjective questionnaire components out of the objective score.
