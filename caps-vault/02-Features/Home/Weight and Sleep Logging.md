---
aliases:
  - WeightLogModal
  - SleepLogModal
---

# Weight and Sleep Logging

Weight uses a real app-wide modal. Sleep retains its dedicated screen overlay and shared WorkflowHeader/WorkflowFooter. Both reuse src/components/LogTimeChanger.tsx. The 23 November user correction explicitly supersedes the former weight screen-overlay convention; it does not change Sleep.

## Weight

- `src/components/WeightLogModal.tsx` opens from Home Quick Log, weight markers in [[Home Day Timeline]], and Athlete Information's Bodyweight tile. FormModal supplies compact native Modal presentation, safe areas, keyboard handling and Cancel/Save. History editing also retains Delete. No separate weight-entry screen or Athlete weight form remains.
- New entries initialize to the latest stored weight if present, otherwise an empty draft, and the current local timestamp. The date/time control lives inside the modal. Future/invalid dates and nonpositive/nonfinite weights cannot save; cancellation leaves storage unchanged.
- `src/utils/weight.ts` converts display kg/lb using existing conventions. Canonical units remain kilograms. An unchanged rounded prefill preserves the original exact kg for both new logs and edits; changing units alone does not rewrite history.
- One labeled decimal input accepts comma decimals and keeps invalid/empty drafts unsaved. Persistence failures retain the draft and an actionable error. A synchronous save/delete lock prevents double submission. Consumer refresh failures after commit cannot invite a duplicate insert.
- `logWeight`, `updateWeightLog`, and `deleteWeightLog` in `src/state/AppStateContext.tsx` refresh the latest weight and increment timelineRevision centrally. This updates Home, Progress and Athlete Information, and preserves newest-by-log-time semantics when an older log is added or edited.
- `src/data/timelineRepository.ts` owns transactional writes linking the `weight_logs` detail to its `timeline_entries` ID. See [[Data and Persistence]].
- scripts/verify-weight.mjs checks real SQLite precision/timestamps, backdating/latest projection, edit identity, cascade delete and injected transaction rollback. Device modal/keyboard/nested-time-picker acceptance is separate; see [[2026-11-23 UI Refactor Handoff]].

History runs from initial SQLite weight log `ea4cc2b`, canonical profile weight `5833c71`, retroactive logging `d09b356`, deletion and time picker `3232443`, and early UI pass `ea999da` to inline steppers/presets `67d99b6`.

## Sleep

- `src/components/SleepLogModal.tsx` anchors the form to the selected wake date. If the start minute is after the end minute, the start belongs to the preceding local day. Equal start and end times are rejected by the form.
- Bed and Wake each have a labeled compact clock/time trigger in the header's right area. Their modals can change the local day; the displayed wake date and saved schedule date follow that selection. The existing overnight minute-of-day and mutually exclusive one-night/nightly-default persistence logic remains intact. Cancel and Save stay in the fixed bottom bar.
- One-night mode writes a concrete `planned` sleep timeline range. Every-night mode instead replaces the effective date-range default in `sleep_schedules`. The read path projects overlapping virtual planned sleep blocks, with negative synthesized IDs, into the day strip. It suppresses overlapping default blocks when there is concrete sleep. The tree's “also writes/replaces” wording could imply both writes occur. The source code uses mutually exclusive branches.
- `getSleepScheduleForWakeDate`, `replaceSleepScheduleFromWakeDate`, and `disableSleepScheduleFromWakeDate` own schedule lookup, replacement, and termination. Retain prior schedule history before the effective wake date when changing a default.
- In `24a301f`, the one-night form and nightly projection share the same local wake-date calculation in `src/utils/sleep.ts`. Replacement and disable share the range-closing SQL in `timelineRepository.ts`. Replacement inserts the new open range inside the same transaction.

Sleep logging and its nightly default began in `859b4aa`. `67d99b6` moved the form inline. Tree IDs are `home:weight-log`, `home:sleep-log`, and their shared time control refs in [[Feature Tree Crosswalk]].
