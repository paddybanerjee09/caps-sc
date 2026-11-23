---
aliases:
  - HomeScreen
---

# Home

Home is the initial dashboard tab. `src/screens/HomeScreen.tsx` renders athlete telemetry, a Quick Log card, and Today / Recovery / Progress sections. The Today section has chevron day navigation and the [[Home Day Timeline]]. Recovery and Progress implement the requested [[Recovery and Progress|daily recovery and historical charts]], with automated checks and native acceptance limits documented. The Home Progress panel is distinct from the historical Progress tab that became Conditioning.

- Athlete telemetry reads `username`, `athleteProfile`, and `unitSettings` from `src/state/AppStateContext.tsx`. Its count comes from the displayed timeline entries, including the selected day when the user steps away from today. Athlete Information and Home share the same canonical profile weight.
- Quick Log offers Strength, Conditioning, Skill, Meal, Weight, and Sleep. The latter three have wired actions. Weight opens the app-wide [[Weight and Sleep Logging|WeightLogModal]]; Sleep retains its dedicated screen overlay. They remain mutually exclusive. Meal closes Quick Log and calls `openNewMeal(selectedDate)` to switch to [[Meal Composer and Saved Meals|the nutrition composer]]. The Strength, Conditioning, and Skill buttons have no handlers at the audited revision.
- Home owns its selected day through `homeDate` in `NutritionWorkspaceContext`. The workspace has a separate `diaryDate`. `openNewMeal(homeDate)` sets the diary date to that day when Home opens a draft. Stepping Home's day alone leaves the diary date in place.
- `SegmentedSelector` and `SlidingPanels` live in `src/components/nutrition/SegmentedSelector.tsx`. Keep animation on transform/opacity to avoid the layout feedback loop corrected in `ccc63a6`.

## History

- `e9ddbfb` → `f0f5834` moved the boilerplate Home tab from Expo Router to custom state navigation. `edd48ce`, `3d09c81`, and `2d78f4c` moved the screen into its own file, introduced the profile header, and established dashboard sections.
- `5904f45` added Quick Log. `efc880c` implemented an overlay to fix opening it shifting surrounding content. The Home tree still records this guardrail. At the audited revision, `quickLogMenuWrapper` is in normal flow with animated height and no absolute positioning. Verify this behavior in the running app before relying on the historical overlay description.
- `1d7f792` moved Meal Quick Log to the full-screen Nutrition workspace. `67d99b6` rebuilt Home around the telemetry card, Quick Log, inline forms, and stepped date controls.

Feature Tree source is `docs/feature-tree/data/home.js`. Begin with `home:home-screen`, `home:athlete-telemetry`, `home:quick-log`, or `home:home-sections` in [[Feature Tree Crosswalk]]. Shared shell and provider ownership are in [[App Architecture]]. Earlier branches are in [[Project History]].

## Layout update (20 November 2026)

Commit `548bbe5` renames the profile card to Athlete Information and Stature to Height. Age and Height now divide the stat row equally; the discipline count cell is removed. Quick Log has no parent gap when collapsed; the expanded grid has a 12px top gap matching the card bottom padding, with height calculated from two 92px rows, the 8px row gap and 12px top gap. This retains the current in-flow animation; the historical overlay discrepancy above is unchanged. Both main-screen titles now use `ScreenTitleCard`. Typecheck and targeted ESLint pass; device visual verification remains outstanding.

## Recovery and Progress (21 November 2026)

The existing Home selector is reused. Recovery has current-local-day completion notice, questionnaire overlay/drafts/history, actual-source biometric cards and native health connection controls. Progress has five source-aware chart groups. Inactive feature panels no longer impose their full content height on Today. Questionnaire route exits guard unsaved edits; previous-day edits preserve original timezone. See [[Recovery and Progress]] and [[2026-11-21 Recovery and Progress Handoff]].

## Compact copy (22 November 2026)

Main title is now title-only; absent age/height/weight use --. Recovery/questionnaire supporting paragraphs and status diagnostics are replaced with concise labels/requirements. Questionnaire history and health management remain accessible. Progress uses the graph dropdown and compact chart inspection. See [[Recovery and Progress]] / [[2026-11-22 Minimal UI Handoff]].

## Questionnaire history screen (22 November 2026)

Recovery now opens a separate QuestionnaireHistoryScreen instead of expanding rows inline. Historical editors return to history on Back/save; X exits the branch, and route/draft guards remain. Home date captions use the shared 22 Nov, 2026 formatter. Current weighted SRI/defaults and Progress interactions: [[Recovery and Progress]], [[2026-11-22 Questionnaire and Chart Controls Handoff]].

## Shared weight modal and intuitive dates (23 November 2026)

Home Quick Log and timeline weight edits use the same actual WeightLogModal as Athlete Information. Numeric -1d/+1d captions are removed; chevrons, selected-day formatting, Today action and query bounds remain. Age derives from stored DOB using src/utils/biometrics.ts, with legacy age only when DOB is absent. All weight mutations invalidate timelineRevision centrally. See [[2026-11-23 UI Refactor Handoff]].
