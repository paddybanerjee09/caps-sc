---
aliases:
  - DayTimeline
---

# Home Day Timeline

`HomeScreen` queries `getTimelineEntriesForDay` from `src/data/timelineRepository.ts` through `scheduleIdleTask`. Bounds are local midnight to the next local midnight. The screen reloads on date changes, Nutrition's `dataRevision`, or global `timelineRevision`. Effect cleanup cancels pending work and advances the request ID so older SQLite results cannot replace newer ones.

`src/components/DayTimeline.tsx` presents a horizontal 24-hour strip of points and ranges. Weight markers reopen the matching [[Weight and Sleep Logging|weight card]]. Keep Home display colors tied to `src/constants/timelineCategories.ts`. Conditioning emphasis colors are scoped to Conditioning. Distinguish this Home strip from the monthly calendars in [[Conditioning]] and [[Strength]].

The SQLite repository joins weight details onto timeline rows, includes ranges crossing midnight, and combines concrete rows with virtual blocks generated from active sleep schedules. The repository checks the selected and following wake dates for overlapping sleep and suppresses virtual blocks when concrete sleep overlaps. See [[Data and Persistence]] for schema ownership and [[Weight and Sleep Logging]] for schedule semantics.

## History and evidence

- `fb6ae68` introduced the timeline repository, `ed60738` added the day strip, and `241f556` integrated meals.
- `e2c3e86` and `179a443` were the first Conditioning and Strength integrations. Strength's historical Home integration is not evidence of a current Strength authoring flow. Compare the current screen and [[Strength]] before changing strength data paths.
- `c8ddb63` introduced idle loading for Home and Nutrition. `0772f4e` wired refresh after Conditioning saves. `67d99b6` restyled the Home timeline card.
- See `home:day-timeline` and `architecture:schedule-idle-task` in [[Feature Tree Crosswalk]].
