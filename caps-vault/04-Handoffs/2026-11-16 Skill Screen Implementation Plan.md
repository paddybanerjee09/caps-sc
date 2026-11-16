# Skill screen implementation plan

2026-11-16 10:31 -05:00 (America/Toronto). Executed [[2026-11-16 Skill Screen Planning Prompt]] on `main` at `e2f4360`. Built 2026-11-16 on `main` at `45648a2` (`80f1155` for the tables and estimator, `45648a2` for the screens). Device exercise of the screens was not run in that session.

The planning prompt described effort with RIR. This plan uses **RPE (rate of perceived exertion)** everywhere that prompt used RIR. The three effort bands and their calorie multipliers are unchanged. Only the scale name and the parenthetical ranges change, using the usual strength correspondence where RPE 10 means no reps left:

| Band stored | Shown as | Prompt's RIR band | Work-MET multiplier |
| --- | --- | --- | --- |
| `easy` | Easy (RPE 6 or below) | Easy (4+ RIR) | 0.80 |
| `moderate` | Moderate (RPE 7–8) | Moderate (2–3 RIR) | 1.00 |
| `hard` | Hard (RPE 9–10) | Hard (0–1 RIR) | 1.10 |

RPE here is a required perceived-effort proxy for timed skill work. It is not the optional 1–10 number Strength stores on a set, and it is not Conditioning's optional integer target RPE. One band is required in Duration and in Rounds. The builder explains the control as rate of perceived exertion.

## What the notes and the source disagree on

Checked `caps-vault/Index.md`, [[Skills Training]], [[Strength]], [[Conditioning]], [[Data and Persistence]], `.cursor/rules/ui-style-guide.mdc`, `.cursor/rules/calendar-session-state.mdc`, `.cursor/rules/navigation-and-overlays.mdc`, `docs/feature-tree/data/skill.js`, and the source at `e2f4360`.

- [[Skills Training]] and the Skill Feature Tree are right: `SkillTrainingScreen` is a centered title, route `skill`, and schema version 8 has no skill tables. This plan does not treat that as already built.
- The README and the Feature Tree still describe fatigue, nutrition timing, and recovery estimates, plus organizing Strength and Conditioning around skill work. This release logs sessions and stores a calorie estimate. It does not schedule the other tabs or score fatigue.
- `MonthlyTimelineComponent` fills a marker only when `MonthEvent.status === "logged"`, and the row under the grid then prints the word "Logged". A Skill row has to show title, focus, and logged time while keeping the filled marker. That needs one optional field on the shared event. Strength and Conditioning leave it unset.
- Strength writes the template change in the same transaction as the log, and turning the save switch off archives the template at log time. The Skill prompt keeps template save, template removal, and logging as separate actions. Follow the prompt.
- Conditioning sessions have a singleton `conditioning_owner` and a sync status because they upload. Strength sessions have neither. Skill logs in this release stay on the device and follow Strength: no owner table and no sync status. One local database is the scope. A later sync pass can add an owner without changing the snapshot columns.
- `getLatestWeightKg` returns the newest weight log with no time cutoff. Athlete Information shows that same latest log. A backdated Skill session needs the newest `weight_logs` row whose timeline `start_at` is at or before the chosen end time. If none exists, use 75 kg and label it as the reference weight. Do not substitute the profile value when the only logs are after the end time.
- Home already has timeline kind `skill` and paints it with `timelineCategories.skill` (green, boxing-glove). The Home quick-log tile does not open a screen. `DayTimeline` places a block on every local day the interval overlaps, and non-meal labels use the category name. This release writes the timeline row and leaves Home navigation and labelling alone. A session that crosses midnight is one Skill calendar event on the end date, and Home may draw it on both local days.

## 1. Domain modules

Add these files under `src/skill/`. Keep them free of React and SQLite so `scripts/verify-skill.mjs` can import them the way `scripts/verify-strength.mjs` imports Strength.

### `src/skill/catalog.ts`

One editable table, `SKILL_CATALOG`, version constant `skill-energy-v1`. Fifteen stable keys. General activities are stretching, rope skipping, and shadowboxing. They never count as a combat discipline.

| Key | Name | Discipline | Base MET |
| --- | --- | --- | --- |
| `stretching` | Stretching / Generic Warm-Up | `general` | 2.3 |
| `skipping` | Skipping Rope | `general` | 11.0 |
| `shadowboxing` | Shadowboxing | `general` | 5.3 |
| `padwork-muay` | Padwork (Muay Thai/KB) | `muay_thai` | 9.3 |
| `partner-padwork-muay` | Partner Padwork (Muay Thai/KB) | `muay_thai` | 7.0 |
| `padwork-boxing` | Pad Work (Boxing) | `boxing` | 8.5 |
| `partner-padwork-boxing` | Partner Pad Work (Boxing) | `boxing` | 6.5 |
| `bag-muay` | Bag Work (Muay Thai/KB) | `muay_thai` | 8.5 |
| `bag-boxing` | Bag Work (Boxing) | `boxing` | 5.8 |
| `drilling-muay` | Technical Drilling (Muay Thai/KB) | `muay_thai` | 5.3 |
| `drilling-boxing` | Technical Drilling (Boxing) | `boxing` | 5.0 |
| `drilling-bjj` | Technical Drilling (BJJ/No-Gi) | `bjj` | 5.3 |

Mode activities store a MET per named mode instead of one number:

| Key | Name | Discipline | Modes and base MET |
| --- | --- | --- | --- |
| `sparring-muay` | Sparring (Muay Thai/KB) | `muay_thai` | Technical 5.3, Medium 8.5, Hard 10.3 |
| `sparring-boxing` | Sparring (Boxing) | `boxing` | Technical 5.5, Medium 7.8, Hard 10.0 |
| `rolling-bjj` | Rolling (BJJ/No-Gi) | `bjj` | Flow 5.3, Medium 7.8, Hard 10.3 |

The 10-minute, 75 kg, Moderate RPE table in the planning prompt is `round(75 × MET × 10 / 60)`. Lock those display values in as fixtures. MET values are the compendium anchors and CAPS proxies from that prompt. `skill-energy-v1` is the estimator version stored on every log.

### `src/skill/timing.ts`

Seconds only.

- Duration: `workSeconds = durationSeconds`, `restSeconds = 0`.
- Rounds: `workSeconds = rounds × secondsPerRound`, `restSeconds = (rounds − 1) × restBetweenRoundsSeconds`. Rest is only the time between rounds. One round with a configured rest stores that rest and contributes 0 rest seconds.
- Elapsed seconds are work plus rest.
- `startedAt = endedAt − elapsedSeconds × 1000`. An empty activity list has no elapsed time.

### `src/skill/energy.ts`

Pure function. Recovery MET is the constant 1.5 and is not multiplied by the RPE band.

`kcal = weightKg × ((baseMet × rpeMultiplier × workSeconds) + (1.5 × restSeconds)) / 3600`

Sum unrounded activity kcal, then round the session total for display with half-up `Math.round`. Card kcal may round each activity for the card label. The stored session total is the unrounded sum, so the session label is not the sum of the rounded card labels.

Fixture: five 3-minute rounds of Medium boxing sparring, Moderate RPE, 1 minute between rounds, 75 kg. Work 900 s, rest 240 s, base MET 7.8, multiplier 1. Result 153.75 kcal, shown as **154 kcal**, elapsed **19 min**, focus Boxing.

### `src/skill/focus.ts`

From the activities' disciplines, ignore `general`, then take the distinct combat disciplines:

- none, and the session has at least one activity: `general` → General Skill Work, `appColorPalette.turquoise` (`#14B8A6`)
- one: `muay_thai` → Muay Thai / Kickboxing, `orange` (`#F97316`); `boxing` → Boxing, `blue` (`#2563EB`); `bjj` → Brazilian Jiu-Jitsu / No-Gi, `purple` (`#A855F7`)
- two or more: `mixed` → Mixed Martial Arts Focus, `pink` (`#EC4899`)

A warm-up plus Boxing is Boxing. Muay Thai plus Boxing is mixed. Stretching, skipping, and shadowboxing alone are General Skill Work. Store the focus key on the session. The calendar reads that stored key. Colours come from `appColorPalette`, not from `theme.colors.tertiary`. Tertiary stays on Log, Save actions, and the Today marker.

### `src/skill/drafts.ts` and `src/skill/validation.ts`

`SkillDraft` holds `sessionId`, `sourceTemplateId`, `templateLink` (`new`, `linked`, or `detached`), `title`, `endedAt`, and ordered activities. Each activity has its own id, catalog key, timing mode, duration or rounds fields, `rpeBand`, and `sessionMode` when the catalog entry has modes.

Proposed defaults when a card is added, so a tap can log without typing numbers: Duration 3:00 and Moderate RPE; Rounds 3 × 3:00 with 1:00 rest and Moderate RPE; sparring and rolling start on Medium. Steppers can move every number, including rest to 0.

Validation for a template: trimmed title of 1–80 characters, at least one activity, at most 24, positive duration or positive rounds and positive work seconds, nonnegative rest, one RPE band, and a mode when the activity defines modes. Validation for a log adds a finite end time that is not after the commit clock, and a valid IANA timezone. Reject a future end time again at commit. `LogTimeChanger` clamping is not the only check.

Template equality ignores `endedAt`, `sessionId`, and calorie output. It compares title, order, catalog key, timing fields, RPE band, and session mode. Discard dirtiness also includes `endedAt`, compared with the snapshot taken when the builder opened. A successful template save replaces that snapshot so Cancel does not warn about work already stored.

## 2. SQLite

Schema version goes from 8 to **9** in `src/data/database.ts`. Put the DDL in `src/data/skillMigration.ts` and run it when `user_version < 9` or `skill_sessions` is missing, on the same recovery path Strength uses for `strength_sessions`. Then set `user_version` to 9. Leave the nutrition and strength DDL on their existing guards.

There is no skill owner table. Templates and sessions live in the one local database, as Strength templates and sessions do.

### `skill_templates`

Reusable headers. No date, time, focus, weight, or calorie columns.

| Column | Role |
| --- | --- |
| `id` | Text primary key, created with `createId()` |
| `title` | 1–80 trimmed characters |
| `created_at`, `updated_at` | Integer epoch ms |
| `archived_at` | Null while listed. Removal sets it. The row stays so old logs can keep the id |

Index `(archived_at, title, id)` for the saved list.

### `skill_template_activities`

Ordered settings only.

| Column | Role |
| --- | --- |
| `id` | Text primary key |
| `template_id` | Foreign key to `skill_templates(id)` `ON DELETE CASCADE` |
| `position` | Integer ≥ 0, unique with `template_id` |
| `activity_key` | Catalog key |
| `name` | Name copied at save time |
| `discipline` | `general`, `muay_thai`, `boxing`, or `bjj` |
| `timing_mode` | `duration` or `rounds` |
| `duration_seconds` | Positive in duration mode, otherwise null |
| `rounds`, `seconds_per_round` | Positive in rounds mode, otherwise null |
| `rest_between_rounds_seconds` | ≥ 0 in rounds mode, otherwise null. Zero is stored, not null |
| `rpe_band` | `easy`, `moderate`, or `hard` |
| `session_mode` | `technical`, `medium`, `hard`, or `flow` when the activity has modes, otherwise null |

### `skill_sessions`

One completed log. The id is the builder's `sessionId`, so a retry inserts once.

| Column | Role |
| --- | --- |
| `id` | Text primary key |
| `title` | Snapshot |
| `started_at`, `ended_at` | Integer epoch ms, `started_at <= ended_at` |
| `local_end_date` | `YYYY-MM-DD` from the device-local end instant. This is the calendar day, including when start was the previous local date |
| `timezone` | IANA zone captured at commit |
| `source_template_id` | Nullable text. No cascade into this table. Archiving or editing the template does not rewrite the log |
| `elapsed_seconds` | Integer work plus rest |
| `focus` | `muay_thai`, `boxing`, `bjj`, `mixed`, or `general` |
| `energy_kcal` | Unrounded session sum |
| `weight_kg` | Positive kilograms used by the estimator |
| `weight_basis` | `logged` or `reference` |
| `estimator_version` | `skill-energy-v1` |
| `timeline_entry_id` | Unique foreign key to `timeline_entries(id)` |
| `created_at` | Integer epoch ms |

Index `(local_end_date, ended_at, id)`.

### `skill_session_activities`

The log's own copy of order and settings, plus the numbers used for that estimate: `work_seconds`, `rest_seconds`, `base_met`, `rpe_multiplier`, and unrounded `energy_kcal`. Same timing and RPE columns as the template child. Foreign key to `skill_sessions(id)` `ON DELETE CASCADE`. Unique `(session_id, position)`.

### Writes in `src/data/skillRepository.ts`

- `listSkillSessionsForDates(start, end)` reads sessions whose `local_end_date` falls in the visible grid, the same window Strength builds from `buildMonthGrid`.
- `getSkillSession` loads the header and activities ordered by `position`.
- `listSkillTemplates` returns unarchived rows. `getSkillTemplate` returns one, including archived, so the builder can tell the user it is gone.
- `saveSkillTemplate` inserts or replaces activities in one transaction. Replace deletes the child rows and inserts the current order. It does not write a timeline row.
- `archiveSkillTemplate` sets `archived_at` inside a transaction. Sessions remain.
- `logSkillSession` is a separate transaction from template saves. If `id` already exists, return `{ alreadySaved: true }` and write nothing. Otherwise insert the timeline row with `kind: "skill"`, `status: "completed"`, `startAt = startedAt`, `endAt = endedAt`, and the session title; insert the session; insert activity snapshots. `withTransactionAsync` wraps all three. A thrown error rolls the timeline row back with the session. The draft stays open with the same `sessionId`.
- Weight lookup is a new `getWeightKgAtOrBefore(db, endedAt)` in `src/data/timelineRepository.ts`. Join `weight_logs` to `timeline_entries`, keep `kind = 'weight'` and `start_at <= endedAt`, order by `start_at DESC, id DESC`, limit 1. Leave `getLatestWeightKg` as it is.

Logging does not create, update, or archive a template. The caller bumps `timelineRevision` through `bumpTimeline()` only after commit, and bumps the Skill workspace revision so the hub reloads.

## 3. Calendar contract

`src/components/monthGrid.ts`: add optional `detail?: string` to `MonthEvent`.

`src/components/MonthlyTimelineComponent.tsx`: when `detail` is present, the selected-day row prints `detail` under the title, and the row accessibility label is `${title}, ${detail}`. Status stays `logged`, so the marker stays filled and the day cell still says "N logged". Absent `detail` keeps today's "Logged" / "Planned" text for Strength and Conditioning. Overflow stays `events.length - 3` from `MAX_DAY_MARKERS`. The component still does not query any feature table. The parent passes events.

Skill events:

- `id`: session id
- `title`: logged title
- `status`: `logged`
- `localDate`: `local_end_date`
- `color`: palette colour for the stored focus
- `detail`: `${focusName} · ${clock}` using the local end time, with the focus name in the string so the colour is also text

`src/screens/SkillScreen.tsx` owns month, selected date, and the event array, following `StrengthTrainingScreen`. The first content block is `MonthlyTimelineComponent`. Empty copy: "No skill session logged". Tapping a row calls `workspace.openDetail(event.id)`. Popping detail does not change the month or the selected day, because that state stays on the mounted hub under the stack.

Directly under the calendar, a screen-local legend card lists the five focus names with a swatch of the palette colour. It is not inside the shared calendar, so Strength and Conditioning do not gain a Skill legend. Swatches are the same hex in light and dark. Labels use theme text.

Below that, a primary **Build Skill Session** button (`minHeight: 52`, tertiary, `readableTextColor`) opens a fresh draft: empty activities, current end time, `templateLink: "new"`, new `sessionId`.

**Saved Sessions** is the next button. It is the one control on this tab that pushes content down, matching Conditioning's saved expander and the navigation rule. 220 ms `Easing.out(Easing.cubic)` with `ReduceMotion.System`. Expanded and empty: "No saved sessions." A row shows the template title and opens the builder with copied activities, new activity ids, a new `sessionId`, `templateLink: "linked"`, the toggle label **Saved**, and end time set to now. Use one vertical `FlatList` for the hub, with the calendar, legend, and buttons in the header and saved rows as the list data while open. Do not put a vertical list inside a vertical `ScrollView`.

After a successful log, the workspace records the session's `local_end_date`. The hub selects that day and moves the visible month to it, then reloads.

## 4. Stack and builder

Mirror Strength's custom stack. Do not add a navigation library.

- `src/state/SkillWorkspaceContext.tsx` holds the stack, draft, confirm request, revision, hardware-back handler, and the pending calendar date.
- `src/screens/skill/SkillStack.tsx` covers the hub while a builder or detail entry is open, and mounts a screen-local confirm overlay. Reuse the confirm behaviour, not Conditioning's `ConfirmDialog` component.
- `src/App.tsx` wraps the navigator with `SkillWorkspaceProvider`.
- `src/navigation/AppNavigator.tsx` mounts `SkillStack` when `activeRoute === "skill"` and routes hardware back to the workspace first.

`src/screens/skill/SkillSessionBuilderScreen.tsx` is one scrolling form. Screen-local cards, steppers, and horizontal preset strips. The title is a `TextInput`. Everything else is taps.

Order inside the scroller:

1. Title card.
2. Time card. Label the control **Ends at**. Show the date, with the same kind of day chips Strength uses (today, yesterday, one day, seven days) so a long backdate is not fifteen-minute steps only. Expanding the control shows the existing `LogTimeChanger` with `maximumDate` set to the current time. Under it, show estimated elapsed time and the derived start clock. When the start date and end date differ, say the session starts the day before. The calendar day is still the end date.
3. Summary card: **Focus**, **Estimated time**, **Estimated calories**, and the weight basis ("logged" with the kilograms, or "75 kg reference"). Recompute as the draft changes. An empty draft has no focus and no calories.
4. Activity cards in order. Each shows name, elapsed time, the timing and RPE settings, the mode when it has one, and that activity's estimated kcal. Up and down controls reorder, with the ends disabled and labelled. Remove drops the card. Expanding the card edits it in place. No data-entry modal.
5. **Add activity** at the end. Discipline chips, then a horizontal strip of that discipline's activities, including a General chip. Tapping a name appends a card with the defaults above.

Numeric controls, all `minHeight` and `minWidth` 48, tabular numerals:

- Duration and work-per-round: ±15 seconds, presets 1, 3, 5, and 10 min.
- Rounds: ±1, presets 1, 3, 5, and 10.
- Rest between rounds: ±15 seconds, presets 0, 30, 60, and 90 seconds.
- RPE: three pills, one selected. Default Moderate.
- Sparring: Technical, Medium, Hard. Rolling: Flow, Medium, Hard. Default Medium. This mode is separate from the RPE band. A Technical round at Hard RPE uses the Technical MET times 1.10.

Footer, fixed above the safe area, in this order: **Cancel**, the template button, **Log**. Log is the primary button. Cancel is the quiet button. The template button is a secondary button whose label is the state, not a two-position switch:

- **Save** on a new draft, and on a linked draft whose template fields differ from the stored template. Pressing it validates the template and inserts or updates that template, then shows **Saved**.
- **Saved** when the linked draft's template fields match. Pressing it asks for confirmation, archives the template, switches the link to `detached`, and shows **Unsaved**. The activities stay. Cancel on the dialog leaves the template saved.
- **Unsaved** after that confirmation. Pressing it validates and inserts a new template id, then shows **Saved**. It does not restore the archived row.

Back, Cancel, and system Back share one discard confirm when the draft differs from the open snapshot. The copy says the session draft will be discarded. A saved template that was already written stays saved. Template removal and discard are the only Skill modals.

**Log** validates the log, calls `logSkillSession`, and on success plays `feedbackConfirm()`, bumps the timeline and the Skill revision, and returns to that end date. On failure the draft stays, `saving` clears, and the same `sessionId` is used for the retry. Ignore further Log taps while a write is in flight. An `alreadySaved` result closes as a success so a double tap cannot create a second timeline row.

## 5. Detail

`src/screens/skill/SkillSessionDetailScreen.tsx` loads by session id. Read-only card for the stored title, start, end, focus name, elapsed time, and **Estimated calories**, including the stored weight basis. Then the ordered activity snapshots: name, timing settings, RPE band, mode, and activity kcal. Colour the focus chip from the stored focus. Back pops the stack. Missing ids show a not-found line. Nothing on this screen recomputes MET from the current catalog or the current weight.

## 6. Files touched, in commit order

When implementation is approved, commit each step on its own. This planning revision is not one of those commits.

1. `src/skill/catalog.ts`, `timing.ts`, `energy.ts`, `focus.ts`, `drafts.ts`, `validation.ts`, and the pure fixtures in `scripts/verify-skill.mjs`. Add `verify:skill` next to `verify:strength` in `package.json`.
2. `src/data/skillMigration.ts`, `src/data/skillRepository.ts`, the weight cutoff in `src/data/timelineRepository.ts`, `src/data/database.ts` version 9, and the migration, snapshot, rollback, and retry cases in the verify script.
3. Optional `detail` on `MonthEvent` and the calendar row. Strength and Conditioning fixtures or a quick render check should still show "Logged".
4. Workspace, `SkillStack`, `App.tsx`, and `AppNavigator.tsx`.
5. `src/screens/SkillScreen.tsx` hub: calendar, legend, build, saved expander.
6. `SkillSessionBuilderScreen.tsx`, then `SkillSessionDetailScreen.tsx`.
7. Vault notes and the Skill Feature Tree only after the behaviour is in source. Point shared calendar and `LogTimeChanger` at their architecture nodes. Add skill tables under the database tree. Move `skill-screen` off placeholder and replace the README-only planned node with the calendar, builder, saved sessions, catalog, and log tables.

Do not edit `StrengthTrainingScreen` except for the shared `MonthEvent` type it already consumes. Do not edit the Recovery or Progress placeholders. Do not wire the Home quick-log Skill tile in this release.

## 7. Acceptance checks

Run `npm run verify:skill`, `npm run verify:strength`, `npm run verify:conditioning`, `npm run typecheck`, and `npm run feature-tree -- --check` after the tree update. Report older failures separately.

Domain fixtures:

- Warm-up plus Boxing → Boxing. Muay Thai plus Boxing → Mixed Martial Arts Focus. General activities alone → General Skill Work.
- All 15 keys accept Duration and Rounds.
- One round with a nonzero rest stores the rest and adds 0 rest seconds. Zero rest stays 0. Duration rest is 0.
- Medium boxing sparring at Moderate RPE matches 153.75 kcal. The same rounds at Easy and Hard change only the 0.80 and 1.10 work multiplier. Technical versus Medium versus Hard mode changes the base MET with the RPE multiplier held constant.
- A session whose start is the previous local date stores the end date as `local_end_date`.

Repository fixtures, in-memory SQLite, following `scripts/verify-strength.mjs`:

- Version 8 database migrates to 9 and keeps strength and nutrition tables.
- Save a template, reopen it, and see order, RPE band, mode, and rest. The reopened draft's end time is the clock passed in, not a stored time. The link state is saved.
- Edit-save updates the same template id. Archive hides it from the list. A session logged from it still opens with the old snapshot.
- Log inserts one timeline row of kind `skill`. A second call with the same session id does not insert again. A thrown error inside the transaction leaves no session and no timeline row, and the next call with the same id succeeds.
- Future end time is rejected. Weight at or before the end time is `logged`. No earlier weight is `reference` at 75 kg even if a later weight log exists.
- Two sessions on one `local_end_date` both list. A day with none does not.

Device or emulator, light and dark:

- Two sessions on one day open two details. Back returns to the same day and month.
- A day with no sessions shows the empty line. A day with four sessions shows three filled markers and `+1`, and the list shows four rows. The legend shows all five names. Today uses tertiary. Focus dots use the palette.
- VoiceOver or TalkBack on a row hears the title and the focus name.
- Save, kill the app, reopen the saved row: order preserved, end time is now, label is Saved. Edit and Save, then Unsaved, and confirm an older log still opens.
- Log a backdated session that starts before midnight and ends after it. The Skill month shows it on the end date. Home may show the green Skills Training block on both days. That Home overlap is existing timeline behaviour.
- Invalid title, empty activities, and a failed write leave the builder up. Retry after the failure writes once.
- Build, save, and log use steppers and the horizontal activity strip. The only overlays are discard and remove-from-saved.

## Review before implementation

These are proposals, not shipped behaviour: the RPE range labels above, the 3:00 / 3×3:00 / 1:00 defaults, the 24-activity cap, the 75 kg reference, the MET proxies, the decision to skip an owner table, the optional calendar `detail` field, and immediate template saves that do not run inside the log transaction.

Feature Tree synchronization is not part of this planning revision. The tree already marks Skill as planned. [[Skills Training]] stays a placeholder until the first implementation commit.
