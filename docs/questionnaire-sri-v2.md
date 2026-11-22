# Questionnaire and SRI v2

The 22 November 2026 request replaces the original unanswered/quarter-hour questionnaire defaults and equal-weight SRI. This is a CAPS subjective composite, separate from biometric ORI and not a validated readiness percentage.

## Controls and navigation

Sleep uses two regular minute-resolution `LogTimeChanger` controls; the former sleep timeline is removed. Full timestamps, saved recovery-day timezone, future bounds, overnight/DST checks and repeated-hour alternatives remain. The calculated total is labeled **interval** when minutes awake are unknown, or **estimated** after subtracting explicitly reported awake minutes. A sleep interval is not silently stored/imported as measured asleep time.

Each rating is a full-width numbered/notched 0–10 line, with no visible +/- controls. New questionnaires start awakenings at 0 and all six other ratings at 5. Existing saved answers are retained. The awakening endpoint is 10+, stored as a lower bound; existing exact counts above 10 are not truncated when opening a form. Assistive increment/decrement actions remain on the adjustable slider.

Questionnaire history is a separate Home overlay screen using shared workflow chrome and a virtualized reverse-date list. Selecting a day opens its editor. Editor Back/hardware Back and successful save return to history; X exits the branch to Recovery. Dirty/save-pending guards remain. History reads active responses; revision audit records remain stored separately.

Full displayed dates use `22 Nov, 2026` through `src/utils/displayDate.ts`. Date keys, query bounds, sorted IDs and timestamps remain ISO in storage. Month/year axis ticks stay appropriately abbreviated; selected date values are readable full dates.

## SRI v2 formula

| Input | Weight | Higher-is-better transform |
| --- | ---: | --- |
| Sleep quality Q | 30% | Q/10 |
| Fatigue F | 25% | 1−F/10 |
| Soreness M | 20% | 1−M/10 |
| Stress T | 10% | 1−T/10 |
| Training motivation V | 5% | V/10 |
| Mood H | 5% | H/10 |
| Awakenings A | 5% | 1−min(A,10)/10 |

`SRI = round(100 × weighted sum)` with version `sri_v2`. Mood is now included and required for this version, with the explicitly requested neutral default 5. New neutral defaults with 0 awakenings produce 53. Best inputs yield 100 and worst yield 0. The previous example quality 7/fatigue 3/soreness 4/stress 2/motivation 8/awakening 1 is 73 under original v1; with neutral mood 5 it is 70 under v2. Weights and caps are versioned app choices, not empirically calibrated cutoffs.

SRI v1 remains supported for existing responses with `sriVersion:'sri_v1'` or no version field. Native health synchronization and cache rebuild do not rewrite their meaning. Saving/editing a response now records v2; historical originals remain in questionnaire revisions. Progress separates the series as **SRI (original)** and **SRI (weighted)** rather than averaging unlike model versions.

## SQLite and compatibility

There is no DDL migration; `user_version` remains 10. The relational structure is unchanged:

- `recovery_owner(id='device-local')` scopes local athlete data.
- `daily_questionnaires` retains composite PK(owner_id,local_date) and owner FK. Its existing `response_json` adds optional `sriVersion` and `awakeningsAtLeast`; all existing rating/sleep/status/revision fields remain.
- `questionnaire_revisions` retains PK(owner_id,local_date,revision) and the composite FK to active questionnaire with ON DELETE CASCADE. Each explicit save appends original inputs and version instead of overwriting earlier revisions.
- `recovery_snapshots` retains PK(owner_id,local_date) and its owner FK. Existing snapshot JSON now permits sri_v1/sri_v2, preserving derived score version; ORI stays separately versioned. A snapshot can exist for health-only days, so it is not a questionnaire child.

Save validation upgrades the candidate model to v2, checks fields/time/revision, writes active response and audit revision transactionally, then recalculates that day's snapshot. Drafts have no displayed/completed SRI. No weight, health observation, sync cursor or baseline schema changes. Current views read the original raw ratings; only the wellness chart transforms fatigue/soreness/stress to 10−value for display. There is no authenticated/cloud account change.

A 10+ selection stores numeric lower bound 10 and `awakeningsAtLeast:true`. Period awakenings means propagate a lower-bound marker and show `+`; they are not falsely presented as exact counts. Moving away from the endpoint clears the marker. Exact legacy counts retain their exact value. v2's awakening penalty saturates at 10, so its result is well-defined for 10+.

Downgrading code is not a supported automatic rollback: older versions may ignore the new JSON fields and misinterpret weights. Preserve raw records and audit history; use the explicit model-aware calculator/cache rebuild rather than dropping tables or lowering user_version. Full original schema relationships: `docs/recovery-progress.md`.

## Progress display policy

Choose graph is an anchored screen overlay with outside/selection/Back dismissal; it does not push chart content. Timeframe selection anchors to the current local week/month/year/lifetime. Only the period navigator has arrows. Date inspection uses chart gestures and accessibility adjustments.

The values below a plot are the legend: tap a row to hide/show its line; hidden values remain accessible so it can be re-enabled. Wellness plots invert problem scales and label higher-is-better. Fixed 0–10 axes tick every 2 and 0–100 every 10. Awakenings start 0; sleep duration starts 0 with a minimum 16-hour extent that expands for larger actual values. X labels dynamically size/thin to fit width and font scaling. Missing values/gaps, source/model isolation and measured/manual distinctions remain.

## Verification

Recovery fixtures exercise defaults, minute timestamps, exact weighted scores, boundaries, priorities, censored awakening penalty, transactional revision/version upgrades and unchanged v1 history on health recomputation. Date fixtures cover key/instant/month/year/leap/DST behavior across timezones. Progress fixtures cover axis steps/bounds, responsive labels, wellness inversions, lower-bound means and distinct SRI labels. Existing ORI, health, nutrition, conditioning, strength and skill checks remain applicable. Native visual/gesture/large-font/keyboard/history-flow acceptance remains a physical-device follow-up.
