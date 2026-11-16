---
aliases:
  - WeightLogModal
  - SleepLogModal
---

# Weight and Sleep Logging

Both filename-suffixed `Modal` components are inline cards in [[Home]]. They share `src/components/LogTimeChanger.tsx` for time entry. The November style guide calls for inline steppers and preset controls for these flows.

## Weight

- `src/components/WeightLogModal.tsx` opens from Quick Log or to edit a marker in [[Home Day Timeline]]. New logs are seeded by profile weight or a 70 kg default. The save path clamps the logged-at time to now. The edit flow can move the entry or delete it.
- `src/utils/weight.ts` converts display kg/lb. The canonical units are kilograms. Preserve original kg when the displayed rounded value was left unchanged during an edit.
- `logWeight`, `updateWeightLog`, and `deleteWeightLog` in `src/state/AppStateContext.tsx` refresh the latest weight from SQLite after mutation. This keeps Athlete Information and Home in agreement and prevents a retroactive older log from becoming the current profile weight by default.
- `src/data/timelineRepository.ts` owns transactional writes linking the `weight_logs` detail to its `timeline_entries` ID. See [[Data and Persistence]].

History runs from initial SQLite weight log `ea4cc2b`, canonical profile weight `5833c71`, retroactive logging `d09b356`, deletion and time picker `3232443`, and early UI pass `ea999da` to inline steppers/presets `67d99b6`.

## Sleep

- `src/components/SleepLogModal.tsx` anchors the form to the selected wake date. If the start minute is after the end minute, the start belongs to the preceding local day. Equal start and end times are rejected by the form.
- One-night mode writes a concrete `planned` sleep timeline range. Every-night mode instead replaces the effective date-range default in `sleep_schedules`. The read path projects overlapping virtual planned sleep blocks, with negative synthesized IDs, into the day strip. It suppresses overlapping default blocks when there is concrete sleep. The tree's “also writes/replaces” wording could imply both writes occur. The source code uses mutually exclusive branches.
- `getSleepScheduleForWakeDate`, `replaceSleepScheduleFromWakeDate`, and `disableSleepScheduleFromWakeDate` own schedule lookup, replacement, and termination. Retain prior schedule history before the effective wake date when changing a default.
- In `24a301f`, the one-night form and nightly projection share the same local wake-date calculation in `src/utils/sleep.ts`. Replacement and disable share the range-closing SQL in `timelineRepository.ts`. Replacement inserts the new open range inside the same transaction.

Sleep logging and its nightly default began in `859b4aa`. `67d99b6` moved the form inline. Tree IDs are `home:weight-log`, `home:sleep-log`, and their shared time control refs in [[Feature Tree Crosswalk]].
