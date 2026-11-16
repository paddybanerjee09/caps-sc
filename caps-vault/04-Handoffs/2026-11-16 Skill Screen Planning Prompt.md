# CAPS Skill screen planning prompt

## Prompt

Write a file-by-file implementation plan for the CAPS Skills Training tab. Use the shipped Strength and Conditioning flows as references. Read the CAPS agent protocol, the applicable UI and calendar rules, and [[Skills Training]], [[Strength]], and [[Conditioning]]. Inspect the current code and the Skill Feature Tree, then resolve any differences between the notes and the source. Deliver a plan with a build sequence, data and navigation decisions, and acceptance checks. Stop after the plan so the product decisions can be reviewed before implementation.

### Skills Training tab

- Keep the existing `skill` route and `SkillTrainingScreen` in `src/screens/SkillScreen.tsx`. Make `MonthlyTimelineComponent` the first content card. Follow `StrengthTrainingScreen.tsx` for parent-owned `MonthEvent` data and event-to-detail navigation, and `ConditioningScreen.tsx` for the inline saved-list interaction.
- Tapping a day selects it and shows every logged Skill session for that local date. Show an empty state on days without sessions. Each row shows title, focus, and logged time, and opens the corresponding `SkillSessionDetailScreen` by session ID. The detail shows the logged title, start/end, focus, elapsed time, calorie estimate, and ordered activities. Preserve the selected day and month when returning from detail. Reuse the calendar's filled markers and overflow count.
- Use fixed focus colours from `appColorPalette` in `src/theme/theme.ts`. Include a compact labelled legend. Use the focus name in each event row and its accessibility label so the colour is also conveyed in text. Keep the user's chosen tertiary accent for UI actions and the Today indicator.

| Session focus | CAPS tertiary palette token | Colour |
| --- | --- | --- |
| Muay Thai / Kickboxing | `orange` | Orange `#F97316` |
| Boxing | `blue` | Blue `#2563EB` |
| Brazilian Jiu-Jitsu / No-Gi | `purple` | Purple `#A855F7` |
| Mixed Martial Arts Focus | `pink` | Pink `#EC4899` |
| General Skill Work | `turquoise` | Turquoise `#14B8A6` |

Derive focus from the disciplines attached to valid activities. A single distinct discipline sets the session focus. Two or more give the session a mixed focus, meaning the session contains work from multiple arts. Stretching/warm-up, skipping, and shadowboxing are general activities. They can accompany any discipline and yield General Skill Work when they make up the whole session.

### Build Skill Session

- Below the calendar, **Build Skill Session** opens a fresh `SkillSessionBuilderScreen` through the existing custom stack pattern. Put the title text field and the existing `LogTimeChanger` above the activity timeline. Label the time field **Ends at**. Start with the current time on every new or saved-template opening. Derive start time by subtracting total elapsed time from the selected end time. Support backdating and reject future end times when logging. If a session crosses midnight, place it on the local date of the selected end time and preserve that date and timezone in the record.
- Use a vertical sequence of activity cards with an **Add activity** control at the end. Each card shows its activity name, elapsed time, settings, and estimated kcal. Allow editing, removal, and reordering, with accessible up/down controls. Update the session summary for **Focus**, **Estimated time**, and **Estimated calories** as the draft changes.
- Every activity supports **Duration** or **Rounds**. Duration takes a positive time and RIR. Rounds takes a positive integer count, positive work time per round, nonnegative rest between rounds, and RIR for the work portions. Use seconds internally and CAPS steppers and presets in the UI. Require one RIR selection in either mode, with **Easy (4+ RIR)**, **Moderate (2–3 RIR)**, and **Hard (0–1 RIR)** as the proposed input bands. Explain RIR as reps in reserve and use it as a rough perceived-effort proxy for timed skill work. For sparring and rolling, collect the named session mode as a separate input.
- Put **Cancel**, the save toggle, and **Log** in a fixed footer below the scrolling form. Back and Cancel use the same discard guard when the draft has unsaved changes.

### Saved Sessions and logging

- **Saved Sessions** opens an inline dropdown beneath the button, with a useful empty state. Selecting a row opens the same builder with its saved title and ordered activity settings filled in. Initialize the time picker to end at the current time and the toggle to **Saved**.
- A fresh draft starts at **Save**. Pressing it validates the title and activities and persists a reusable template, then displays **Saved**. Tapping **Saved** on a matching draft confirms removal from Saved Sessions, then displays **Unsaved** and leaves the builder contents available for logging or saving again. When a saved template is edited, display **Save** while there are changes to persist. That action updates the existing template and returns the toggle to **Saved**. Cancel discards pending edits. Completed template actions take effect when confirmed.
- **Log** validates the draft, writes a completed session once, and returns to its date on the calendar. The session owns a snapshot of the title, activity order and settings, time, focus, and calorie estimate. Templates remain reusable after logging. Editing or removing a template leaves earlier logs intact. Keep the draft open on a write failure and protect against duplicate logs from retries or repeated taps.
- Propose the smallest forward SQLite migration and repository that support these flows. Use stable IDs, ordered activity data, owner scoping consistent with Strength and Conditioning, and atomic writes for a log and its snapshot. Template data omits the log date/time. Inspect the existing timeline integration and spell out what the Skill calendar needs for this release.

### Activity catalog and placeholder calorie model

Use the proposed base METs below at Moderate RIR. The 2024 Adult Compendium supplies reference entries for stretching, rope skipping, boxing bag work, sparring, simulated rounds, and martial arts practice. The remaining values are CAPS estimates using the closest listed activity as a proxy. The no-gi study provides context for live rolling intensity, and the three rolling mode values are provisional CAPS choices. [Conditioning Exercise](https://pacompendium.com/conditioning-exercise/) · [Sports](https://pacompendium.com/sports/) · [No-gi sparring study](https://doi.org/10.1371/journal.pone.0259027)

| Activity | Discipline | Base MET by mode, where applicable | Basis | Approx. kcal for 10 work min at 75 kg and Moderate RIR |
| --- | --- | ---: | --- | ---: |
| Stretching / Generic Warm-Up | General | 2.3 | Mild stretching as the default for the combined block | 29 |
| Skipping Rope | General | 11.0 | General rope skipping | 138 |
| Shadowboxing | General | 5.3 | Slower martial arts practice proxy | 66 |
| Padwork (Muay Thai/KB) | Muay Thai/KB | 9.3 | Simulated boxing round proxy | 116 |
| Partner Padwork (Muay Thai/KB) | Muay Thai/KB | 7.0 | Reduced padwork proxy for alternating striking and holding | 88 |
| Pad Work (Boxing) | Boxing | 8.5 | Moderate-cadence boxing bag proxy | 106 |
| Partner Pad Work (Boxing) | Boxing | 6.5 | Reduced padwork proxy for alternating striking and holding | 81 |
| Bag Work (Muay Thai/KB) | Muay Thai/KB | 8.5 | Moderate-cadence boxing bag proxy | 106 |
| Bag Work (Boxing) | Boxing | 5.8 | General boxing bag work | 73 |
| Sparring (Muay Thai/KB) | Muay Thai/KB | Technical 5.3 / Medium 8.5 / Hard 10.3 | Slower through moderate martial arts practice proxies | 66 / 106 / 129 |
| Sparring (Boxing) | Boxing | Technical 5.5 / Medium 7.8 / Hard 10.0 | Anchored to the 7.8 boxing sparring entry | 69 / 98 / 125 |
| Rolling (BJJ/No-Gi) | BJJ/No-Gi | Flow 5.3 / Medium 7.8 / Hard 10.3 | Slower through moderate martial arts proxies, informed by live rolling research | 66 / 98 / 129 |
| Technical Drilling (Muay Thai/KB) | Muay Thai/KB | 5.3 | Slower martial arts practice proxy | 66 |
| Technical Drilling (Boxing) | Boxing | 5.0 | Slower practice and general bag work proxies | 63 |
| Technical Drilling (BJJ/No-Gi) | BJJ/No-Gi | 5.3 | Slower martial arts practice proxy | 66 |

Use one versioned, editable lookup table and a pure estimator. Use the latest valid recorded weight at or before the chosen end time if supported by the existing weight log. Otherwise use a 75 kg reference weight and indicate that basis alongside the estimate. Store the weight basis and estimator version with the logged estimate so later model or weight changes do not rewrite history.

- Duration mode uses `workSeconds = durationSeconds` and `restSeconds = 0`.
- Rounds mode uses `workSeconds = rounds × secondsPerRound` and `restSeconds = (rounds − 1) × restBetweenRoundsSeconds`. Rest is included only between rounds.
- Apply the RIR multiplier to the base work MET for the selected activity and mode. Use **0.80** for Easy, **1.00** for Moderate, and **1.10** for Hard. These are provisional CAPS constants. Use **1.5 MET** for recovery.
- Compute gross kcal for each activity as `weightKg × ((baseMET × rirMultiplier × workSeconds) + (1.5 × restSeconds)) / 3600`. Sum elapsed seconds and unrounded activity kcal across the session, then round for display. Label the number **Estimated calories**. [Compendium MET unit conversion](https://pacompendium.com/unite-conversions/)
- Example for verifying the calculation: five 3-minute rounds of Medium boxing sparring at Moderate RIR, with 1 minute between rounds and body mass of 75 kg, give 15 minutes of work and 4 minutes of rest. The estimate is `75 × (7.8 × 15 + 1.5 × 4) / 60 = 153.75 kcal`, displayed as **154 kcal** over **19 min** with **Boxing** focus.

### Acceptance checks

Cover the following in the implementation plan.

- On a day with two sessions, both rows open their own logged detail. Returning preserves the calendar selection. Check a no-entry day, overflow markers, and the legend in both themes.
- A general warm-up plus Boxing yields Boxing. Muay Thai plus Boxing yields Mixed Martial Arts Focus. General activities alone yield General Skill Work.
- All 15 activities support Duration and Rounds. Check one round with a nonzero configured rest, zero rest, both RIR and mode effects, and the worked calorie example.
- Save and reopen a template after app restart. Check activity order, a fresh end time, and the **Saved** state. Edit and save it, then toggle to **Unsaved** and confirm the previous logs still open.
- Log a backdated session crossing midnight, check date placement, and exercise invalid values and a failed write followed by retry. Include applicable type, migration, repository, and device interaction checks. Identify the vault and Feature Tree updates needed when implementation changes the recorded status.

## Planning handoff

- 2026-11-16 10:13 EST (America/Toronto), Codex, `main` at `e2f4360`. Read the active vault entry point `caps-vault/Index.md` during the in-progress index rename. Existing vault and Cursor changes predate this prompt.
- Verified the Skill placeholder, the calendar event colour and press contracts, `LogTimeChanger`, the app palette, and the Strength and Conditioning UI references in source. Researched the estimator anchors and supplied a reproducible worked example. Implementation and runtime verification are pending.
- Colour assignments, focus derivation, midnight placement, save semantics, RIR bands, MET proxies, and default weight are proposals for user review. “Technical Drolling” was interpreted as “Technical Drilling.”
- Next step is to use this prompt to produce the implementation plan. The Feature Tree already records Skill work as planned. Synchronization is unnecessary for this prompt. There is no active implementation ownership.
