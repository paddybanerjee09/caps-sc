# CAPS — Recovery & Progress System

> **Agent-ready implementation specification**
> Scope: Home screen **Recovery** and **Progress** sections for CAPS (React Native + Expo + TypeScript).
> Status: implementation plan; inspect existing repository architecture before modifying code.
> Source of recovery mathematics: companion file `Pasted markdown(2).md` / **CAPS — Recovery Monitoring Mathematics**. Keep that reference with this specification.

## 0. Agent instructions and non-negotiable constraints

Implement the Recovery and Progress features within the existing CAPS application. **Inspect current Home/Recovery/Progress navigation, components, database schema, chart library, authentication, and state/data-fetching conventions before writing new architecture.** Reuse existing components and patterns where possible; do not create duplicate navigation or weight databases. Break implementation into reviewable, testable milestones.

**Scientific constraint:** No universally validated formula converts this collection of physiological measures into a true 0–100 *percentage physiologically recovered*. Calculations such as lnRMSSD, personal means/SDs/Z-scores, sleep efficiency, and 60-second heart-rate recovery are established. A weighted composite **ORI is experimental until separately defined, calibrated, and validated**. Label any provisional output **Experimental Objective Recovery Index**; never claim “80 = 80% recovered.” In an MVP without an approved scoring model, display `—` for ORI while showing objective individual markers and deviations. Likewise, the custom SRI defined below is an app-defined subjective wellness composite, not the validated Hooper Index.

**Data integrity:** Never infer missing physiological measurements. An unavailable metric must display an em dash `—`, **not zero**; preserve source, units, subtype, acquisition time, and quality. Never silently mix HRV RMSSD with SDNN, HRR from unmatched testing protocols, or wearable and manual measurements as if equivalent. Preserve missing-day gaps on line charts.

**Scope priorities:** first reliable daily data collection and questionnaires; then native health import and objective calculations; then all charts. Any dependencies (e.g. native Expo build, data permissions, backend migrations) should be documented and surfaced rather than faked.

---

## 1. Functional overview and navigation

The current Home screen contains a segmented navigation for **Home / Recovery / Progress**. **Reuse that same component** to switch sections. New Recovery and Progress functionality must feel integrated with existing CAPS UI.

- **Recovery** is a daily snapshot: latest eligible readings assigned to the current local recovery day, SRI, experimental ORI when supported, and the morning questionnaire completion state.
- **Progress** is historical analysis across five chart categories: Body Weight, Recovery Indices, Cardiac Trends, Sleep Trends, and Fatigue Trends.
- Share the daily recovery data pipeline between them; charted values come from the same persisted records used on the Recovery screen.

Recovery day = user's local calendar date of waking, assigning the principal overnight sleep session to its wake date. Persist timezone and timestamp information to handle travel, midnight rollover, DST, and sleep outside conventional hours. Calendar day changes must reset only the *current day's questionnaire completion indicator*, not delete previous answers.

### Recovery daily lifecycle

1. Detect current local day on app launch, resume, timezone change, and when the date changes.
2. Synchronize permitted HealthKit / Health Connect observations as supported; import manual questionnaires and existing CAPS measurements.
3. Normalize, validate, deduplicate, and resolve sources.
4. Compute latest daily biometrics, baseline calculations, SRI, and optional experimental ORI.
5. Persist current versioned daily recovery snapshot and update chart queries.
6. Recompute affected days if late health samples, corrected questionnaires, or deleted records arrive.

The app should update on app open, foreground/resume, manual refresh, and permitted health-data update events. Never assume real-time background updates are guaranteed.

---

## 2. Recovery top section — biometric summary

Present a compact, legible grid of today's metrics, with clear source and measurement time where available. Preferably group related readings (cardiac, sleep, additional physiological measures) without hiding key data.

| Metric | Display | Preferred origin | Critical notes |
|---|---|---|---|
| Resting Heart Rate (RHR) | bpm | HealthKit / Health Connect | Use daily *resting* HR, not arbitrary HR reading |
| HRV | ms, subtype shown | HealthKit / Health Connect | SDNN ≠ RMSSD; preserve type/source; only apply lnRMSSD to RMSSD |
| 60s Heart Rate Recovery (HRR60) | bpm drop | Compatible platform or standardized HR test | Optional/sparse; only show comparable post-exercise test results |
| Subjective Recovery Index (SRI) | 0–100 | Morning questionnaire | Only after all required questionnaire inputs are present |
| Sleep Duration | h/min | Wearable, fallback manual estimate | Distinguish asleep duration from mere time in bed |
| Sleep/Wake Times | localized HH:MM | Wearable or questionnaire | Preserve actual dates/timezones and show selected source |
| Sleep Efficiency | % | Wearable sleep segmentation | time asleep ÷ time in bed ×100; omit if insufficient data |
| Respiratory Rate | breaths/min | Compatible wearable | Show unavailable if absent |
| Skin Temperature Deviation | °C relative to personal baseline | Compatible wearable or derived from comparable temperature samples | Do not conflate absolute temperature with deviation |
| Experimental Objective Recovery Index (ORI) | 0–100 or `—` | Calculation engine | Show model version, contributor coverage, experimental label |

**Card states:** `loading`, `available`, `unavailable`, `insufficient_baseline`, `stale`, and `sync_error`. Show `—` for unavailable raw value; a measured value may still display when its baseline score is unavailable. Display historical/stale readings only with explicit date, never as today's values. Avoid treating lack of a HealthKit sample as definitive evidence of denied permission.

---

## 3. Native biometric integration

### 3.1 Architecture

Use an internal platform-agnostic **Health Adapter** exposing equivalent normalized measurement interfaces. On iOS read from **Apple HealthKit**; on Android read from **Health Connect**. Devices/apps (Apple Watch, Oura, Fitbit and others) must first contribute data to those platforms; platform support does **not** guarantee a given device provides a metric. Do not assume direct Oura/Fitbit API access exists.

Suggested technology to evaluate (verify against current project Expo SDK and maintenance state): iOS `@kingstinct/react-native-healthkit`, Android `react-native-health-connect`, or an adequately complete maintained unified bridge. Native integration requires an **Expo development build / native configuration**, not standard Expo Go. Preserve existing native setup and build profiles.

### 3.2 Metric mapping (verify concrete APIs before coding)

| Internal field | iOS HealthKit | Android Health Connect |
|---|---|---|
| RHR | resting heart rate quantity | `RestingHeartRateRecord` |
| HRV | HRV SDNN quantity (common HealthKit exposure) | `HeartRateVariabilityRmssdRecord` |
| HRR60 | one-minute recovery reading when available, otherwise standardized HR samples | no guaranteed universal direct HRR record; calculate only with valid timed HR samples/protocol |
| Sleep sessions/stages | sleep analysis records | `SleepSessionRecord` and sleep stages |
| Respiratory rate | respiratory rate quantity | `RespiratoryRateRecord` |
| Skin/wrist temperature | compatible wrist/skin-temperature records where available | `SkinTemperatureRecord` where supported |

Implementation must verify device/platform/version support and request **only needed read permissions**. Record separate availability/permission capability for each field. Health Connect has specific constraints on historical reads and background access; request extra permissions only if necessary and supported. HealthKit may not expose read denial in a distinguishable way; display unavailable rather than confidently diagnosing why.

### 3.3 Synchronization, normalization, source resolution

- Implement first-import/backfill within authorization and platform history limits; then incremental sync using native change tracking/cursors/anchors where supported.
- Persist platform sample IDs and/or robust fingerprints to deduplicate repeat syncs and avoid multiplying measures when multiple manufacturers/apps write overlapping values.
- Convert to canonical units in storage, while preserving original metadata. Use the user's selected kg/lb display preference only at presentation/query boundaries.
- Store sample acquisition time, insertion time, platform, device/app/source, subtype, sample interval, quality, timezone/day assignment, and standardized HRR protocol when relevant.
- Define a user-selectable/preferred source per metric; avoid blindly averaging heterogeneous devices or overlapping sleep sessions.
- Reconcile edited or deleted upstream data and recalculate impacted day snapshots/aggregates.
- Display last successful sync and useful errors; support offline operation and retries.
- Be explicit when HealthKit/Connect has no suitable reading, an unsupported record type, or an unapproved model input.

---

## 4. Daily morning questionnaire

### 4.1 Completion and notification behavior

Persist **one active questionnaire response per user per local day**, with revision support and statuses `not_started`, `in_progress`, `completed`. On each new day, today's indicator is incomplete until today's answer is submitted; previous days stay stored. Show persistent in-app notice/dot on the Recovery navigation or Recovery dashboard until completion, then show completion timestamp and an **Edit** action. Home may show a nonintrusive prompt too.

User can configure an optional morning *device notification*; suppress reminders once today's questionnaire is complete. Since wake time isn't reliably known in advance, use a configured reminder clock time unless an actual wake signal is available and authorized. Persist configuration and handle device timezone changes. Allow offline completion and eventual sync without losing input.

### 4.2 Reusable components

Create a **controlled horizontal integer rating slider** returning 0–10, configurable per field:

```ts
type RatingSliderProps = {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
  min?: number; // 0
  max?: number; // 10
  step?: number; // 1
  minLabel?: string;
  maxLabel?: string;
  disabled?: boolean;
};
```

Include current number, range/anchor labels, gesture support, accessibility values and non-gesture increment/decrement controls. **No default of zero for unanswered questions**.

Create a **24-hour dual-thumb time selector** with 15-minute increments for sleep onset and wake time. Support wrapping midnight, explicit calendar-date assignment, unusual sleep schedules and DST. Ensure end/start thumb behavior is accessible; a numeric/time-picker fallback is appropriate. Persist full datetime with timezone, not just `HH:mm` strings.

### 4.3 Fields and scales

| Field | Input | Anchors/notes |
|---|---|---|
| Sleep onset | 24h dual-point selector | 15-minute steps |
| Wake time | 24h dual-point selector | 15-minute steps |
| Number of awakenings | nonnegative integer | numeric stepper/input; no artificial 0–10 limit |
| Sleep quality | 0–10 slider | 0 terrible, 10 excellent |
| General fatigue | 0–10 slider | 0 none, 10 extreme |
| Muscle soreness | 0–10 slider | 0 none, 10 extreme |
| Mental stress | 0–10 slider | 0 none, 10 extreme |
| Training motivation | 0–10 slider | 0 none, 10 extremely motivated |
| Mood | **optional additional** 0–10 slider | 0 very poor, 10 excellent; needed for the Fatigue Trends chart |

Optionally ask approximate **minutes awake** or time-in-bed separately. The two sleep clock times only give a time interval, **not necessarily actual sleep duration**; count of awakenings cannot determine total time awake. Label questionnaire-derived sleep duration **estimated/manual** when appropriate. A wearable's estimates of asleep time and sleep efficiency remain source-specific.

Validate all fields; do not allow incomplete answers to create a supposedly complete SRI. Provide editing, save-in-progress, and clear confirmation upon submission.

---

## 5. Calculation specification

### 5.1 Subjective Recovery Index (SRI)

Implement a deterministic, versioned **CAPS-specific 0–100 subjective composite** of the six original requested questionnaire measures. It is **not** the same as the established Hooper Index, which uses four 1–7 problem scores summed to 4–28 (lower = better). Keep the true Hooper calculation separate if later implemented.

Let questionnaire values be `Q` sleep quality, `F` fatigue, `M` soreness, `T` stress, `V` motivation on 0–10, and `A` nonnegative number of awakenings. Convert to higher-is-better normalized values:

```text
Qn = Q / 10
Fn = 1 - F / 10
Mn = 1 - M / 10
Tn = 1 - T / 10
Vn = V / 10
An = 1 - min(A, 5) / 5
SRI = round(100 * (Qn + Fn + Mn + Tn + Vn + An) / 6)
```

The awakening cap of 5 and equal weights are **illustrative configurable scoring choices**, not validated cutoffs. Document them in the UI where relevant. Only calculate when the required six inputs are present and valid. Store formula version (e.g. `sri_v1`), original inputs and computed result. **Mood is not part of SRI v1**; use it in Fatigue Trends only. Ensure questionnaire edits recalculate SRI and historical aggregates.

### 5.2 Established objective mathematics

Implement the following from the companion recovery mathematics document:

**RMSSD from NN intervals**, if interval-level data are available:

\[
\mathrm{RMSSD}=\sqrt{\frac{1}{N-1}\sum_{i=1}^{N-1}(NN_{i+1}-NN_i)^2}
\]

**Log-transformed RMSSD**, where RMSSD in ms is positive:

\[
\mathrm{lnRMSSD}=\ln(\mathrm{RMSSD})
\]

**Personal baseline** calculated on a preceding, comparable reference window (initial configurable example: previous 28 days; exclude current day to avoid look-ahead bias):

\[
\mu=\frac{1}{n}\sum_{i=1}^n x_i,\qquad
s=\sqrt{\frac{\sum_{i=1}^n(x_i-\mu)^2}{n-1}},\qquad
z_t=\frac{x_t-\mu}{s}
\]

Require adequate valid observations; suppress Z-score if `s=0`, unavailable, or insufficient samples. Preserve baseline sample count and time window.

**Coefficient of variation** where appropriate:

\[
CV(\%)=100\frac{s}{\mu}
\]

Do not equate variation of raw RMSSD with lnRMSSD; do not use heuristic smallest-worthwhile-change rules as validated readiness cutoffs.

**One-minute HRR**, only when end-HR and 60-second-HR were obtained under a comparable exercise/position/recovery protocol:

\[
HRR_{60}=HR_{exercise\ end}-HR_{60\ seconds\ after}
\]

**Sleep measures:**

```text
sleep_interval = wake_datetime - sleep_onset_datetime
estimated_manual_asleep_time = sleep_interval - reported_minutes_awake (only if provided)
sleep_efficiency_percent = 100 * time_asleep / time_in_bed
```

Use genuine source-provided asleep/in-bed times when available. If insufficient information, efficiency is `—`; manual sleep interval is not automatically asleep time. For sleep timing regularity, compute within-person variability of onset/wake times with **midnight wraparound handled correctly** (e.g. unwrap around a habitual anchor rather than raw clock-time SD).

**Training load (future, distinct from objective recovery):** For daily load `L_t`, often sum of session minutes × session RPE in arbitrary units:

\[
E_t=E_{t-1}+\alpha_\tau(L_t-E_{t-1}),\quad \alpha_\tau=1-e^{-1/\tau}
\]
\[
CTL_t=CTL_{t-1}+\alpha_{42}(L_t-CTL_{t-1}),\quad
ATL_t=ATL_{t-1}+\alpha_7(L_t-ATL_{t-1}),\quad
TSB_t=CTL_t-ATL_t
\]

Document timestamp convention for morning readiness versus current-day load. **TSB is training-load balance, not a recovery percentage**. This is an extension, not required to block this feature.

### 5.3 Objective Recovery Index (ORI) — experimental interface

Implement objective inputs and baseline signals **now**, but allow ORI to remain `null`/`—` until a scientifically and product-approved transformation and weight set exists. The companion document only supports an *aggregation template*:

\[
ORI_t=\frac{\sum_{i\in A_t}w_i g_i(x_{i,t},B_i)}{\sum_{i\in A_t}w_i}
\]

- `A_t`: available quality-controlled inputs for that day's model.
- `B_i`: comparable personal baseline for metric `i`.
- `g_i`: explicit bounded 0–100 metric transformation (some metrics have target ranges/non-monotonic response).
- `w_i`: justified/calibrated nonnegative weight.

**Do not invent unspecified transforms or weights and present them as validated science.** Configure and version transforms/weights if ORI experimentation is deliberately enabled. Missing contributors must not be scored as perfect or poor. Optionally renormalize weights only under an explicit model missing-data policy, with required minimum contributors and documented consequences. Include input list, coverage, formula version, and experimental designation on cards/tooltips. Scores from different input sets may not be directly comparable.

Initial eligible signal candidates: RHR relative to baseline; **lnRMSSD** relative to matching RMSSD baseline; HRR60 only when a standardized test exists; valid sleep duration and efficiency; sleep timing/regularity; respiratory rate; appropriate skin temperature deviation. Do not require sparse HRR every day. Do not assume that higher HRV automatically means better recovery.

Validation before claims of predictive readiness: choose independent performance endpoints (e.g. next-day standardized jump, grip, sprint output), collect longitudinal device-consistent samples, fit only with prior data, evaluate on held-out dates/new athletes, report uncertainty, and avoid circular evaluation against inputs already used in the score.

---

## 6. Progress — charting system and shared controls

Implement five graph groups below with a single reusable design system. Every graph must support **Week, Month, Year, Lifetime**, changing the same existing-style segmented control used in the Home experience. Add previous/next period navigation where appropriate and per-chart legend toggles.

| Selection | Interval | X-axis | Default resolution |
|---|---|---|---|
| Week | current Mon–Sun | Mon Tue Wed Thu Fri Sat Sun | daily |
| Month | first to actual last day of calendar month | day 1–28/29/30/31; format ticks to avoid crowding | daily |
| Year | Jan–Dec of selected year | Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec | monthly aggregations |
| Lifetime | first record to today | adaptive month/year ticks | adaptive (daily for short spans, monthly/annual for long spans) |

Period navigation must handle leap years and local calendar boundaries. Show empty dates rather than shifting plotted data. Preserve date ordering. Do not connect across extended missing intervals as if observed values existed; the raw series is a **broken/discontinuous line graph**.

### 6.1 Chart component contract

Reuse current CAPS charting package if it can achieve the functionality; otherwise evaluate a maintained React Native chart solution (such as Victory Native) based on actual Expo/React Native compatibility, gestures, discontinuous lines, and synchronized axes. Hide library specifics behind components:

```text
ProgressTimeframeSelector
ProgressChartCard
ToggleableChartLegend
TimeSeriesLineChart
SynchronizedSubgraphGroup
MetricTooltip
ChartDataAggregator
ChartAxisController
```

Required chart behavior:

- Each legend variable toggles individually on/off **at the top**; persist visibility across timeframe changes.
- Crosshair/tap/drag/long press to inspect exact date, value, unit and source; show quality/coverage if relevant.
- Multiple subgraphs share selected date and horizontally aligned x-axis ticks/tooltips.
- Use **one Y-axis** for variables sharing a meaningful common scale; at most a carefully labeled two-axis view when justified; prefer vertically stacked synchronized subgraphs for three or more unrelated units.
- Optionally compare relative changes using an **explicitly labeled normalized/Z-score view**; never mix normalized and raw measures on an unlabeled axis.
- Missing observation = gap or no point; distinguish a true recorded zero from no data.
- Do not fabricate interpolated measurements. An optional visual line connection across a single missing day must be clearly distinguished from real recorded points.
- Adaptive y-axis ranges unless a fixed meaningful scale is specified; include units and accessible descriptions.
- Render understandable loading, empty and error states.

### 6.2 Time aggregation and provenance rules

Source observations must remain immutable/auditable when possible. Aggregated graph points are reproducible derived views. For period `P`, the simple mean of valid daily observations is:

\[
\overline{x}_P=\frac{\sum_{d\in D_P}x_d}{|D_P|}
\]

`D_P` contains only dates with valid comparable readings. Store or return `sampleCount`, `eligibleDayCount`, `coveragePercent`, `aggregationMethod` and, for experimental ORI, compatible model version/input coverage. Never average missing days as zero. When daily multiple observations exist, select an explicit per-metric rule and maintain it across periods. On Year/Lifetime charts, label monthly means as means rather than totals; average awakenings **per recorded night**, not monthly sum by default. Do not merge index values from incompatible algorithm versions without explicit user-visible designation.

---

## 7. Required chart groups

### 7.1 Body Weight Trends

**Source:** Existing CAPS weight database; no second weight store.
**Chart:** discontinuous time-series with toggleable **Daily Weight** and **7-day Average** lines.
**Y-axis:** bodyweight in athlete preference kg/lb; optional goal-weight reference line.

Daily Weight: if multiple readings on same local date, show **latest eligible weigh-in** (or honor existing CAPS established convention if different and document it). Missing date = no daily point.

Seven-day average: trailing **seven calendar days** including current day, averaging only valid daily weight values; expose sample count and identify partial coverage. Recommended minimum **four observed days** to display the average. Do not use seven most recent weigh-ins across an unlimited span.

\[
\overline{W}_{7,t}=\frac{\sum_{d\in D_t}W_d}{|D_t|},\quad D_t=\{\text{valid observations from }t-6\text{ through }t\}
\]

For Year/Lifetime, aggregate daily values into monthly means; handle 7-day series as a separate mean of eligible rolling-average values. Preserve displayed units and conversions.

### 7.2 Recovery Index Trends

**Series:** SRI and **Experimental ORI**, each independently toggleable.
**Chart:** discontinuous two-line chart with shared **fixed 0–100 Y-axis**.
**X-axis:** shared calendar-time selector.

Daily point only when requisite score was computed and persisted. ORI points may remain missing until a properly specified experimental model is enabled. Tooltip: date, value, score type, input coverage, model/formula version, and computation time. On Year/Lifetime, mean compatible valid daily scores and show number of contributing days versus eligible days. Do not equate numeric value to percent recovered.

### 7.3 Cardiac Trends

**Three vertically synchronized subgraphs** (separate Y-axes):

1. **HRV** — ms, type/source explicit (RMSSD vs SDNN separated), optional consistent rolling baseline and raw/lnRMSSD view only where suitable.
2. **RHR** — bpm, optional personal baseline/deviation.
3. **HRR60** — bpm drop, sparse standardized observations only; preserve exercise/post-exercise protocol.

Use one date cursor across panels. Optional baseline-deviation mode shows valid `z=(x−μ)/s` with units/labels reflecting standard-deviation units; do not present Z-score as raw HRV/RHR/HRR or recovery percentage. Reject incompatible HRV type mixing and unstandardized HRR comparisons.

### 7.4 Sleep Trends

**Four synchronized subgraphs**, each with its own Y-axis:

1. **Sleep Duration** (hours; optionally user's target line).
2. **Sleep Quality** (0–10 subjective questionnaire).
3. **Sleep Efficiency** (0–100%, measured/estimated only with eligible data).
4. **Nighttime Awakenings** (nonnegative count; manual and wearable data distinguished).

Optional fifth timing plot: bedtime and waking clock time by date; handle wraparound midnight and timezone changes. Prefer wearable-measured sleep duration for an objective sleep series and manual questionnaire as labeled fallback; allow source filters and preserve both records. Manual awakenings and wearable wake-stage detections are not equivalent measurements. Period means must use valid recorded nights, with coverage shown.

### 7.5 Fatigue Trends

**Purpose:** juxtapose subjective fatigue/wellness and recovery index trajectories. Prefer two vertically synchronized panels rather than mixing axes:

- **Panel A — questionnaire variables** on common 0–10 axis: Fatigue, Mood (optional questionnaire addition), Soreness, Mental Stress, Training Motivation. Show original scale directions (higher fatigue/stress is worse; higher mood/motivation better). Per-variable toggles at panel top.
- **Panel B — recovery indices** on 0–100 axis: SRI and Experimental ORI. Independently toggleable.

Share timeframe and selected date/crosshair across both. An optional normalized-comparison mode can express deviations from comparable personal baselines, explicitly labeled as standardized rather than raw units.

**Avoid circular interpretation:** SRI is computed partly from fatigue/soreness/stress/motivation; correlations between SRI and its input variables are partly mechanical, not independent evidence. Comparisons of questionnaire variables to objective metrics and later independently observed performance are more informative.

---

## 8. Backend and persistence

Inspect existing persistence strategy and authentication before adding tables. The following entities are **logical models**, not mandatory exact SQL naming:

| Entity | Required information |
|---|---|
| `health_connections` | user, platform, connected/read state, permission/capabilities, last successful sync |
| `health_measurements` | user, metric, numeric value/unit, measurement timestamp/interval, ingestion timestamp, source/device/app, external ID, subtype, protocol, quality |
| `sleep_sessions` | user, start/end datetimes, timezone, asleep minutes, in-bed minutes, awake minutes if available, stage/source metadata |
| `daily_questionnaires` | user, local date/timezone, sleep onset/wake, awakenings, ratings, status, completed/edited timestamps, revision |
| `recovery_snapshots` | user, local date, SRI, ORI nullable, algorithm versions, input set/coverage, computed timestamp |
| `metric_baselines` | user, metric/subtype/source/protocol, reference window, mean, SD, count, updated time |
| `chart_aggregates` | user, metric, period start/end/granularity, value, coverage/count, algorithm version |
| `notification_preferences` | user, reminder toggle/time/timezone |
| `sync_state` | user, source, cursor/anchor, last successful sync, error status |

Prefer idempotent sync upserts and user-scoped unique constraints, including `(user_id, local_date)` for active daily questionnaire identity (revision history separate). Chart aggregates may be computed on demand or cached with invalidation; raw records remain source of truth. Preserve the existing bodyweight entity as-is and query it.

Representative normalized measurement interface:

```ts
type HealthMeasurement = {
  id: string;
  userId: string;
  metricType: string;
  value: number;
  unit: string;
  measuredAt: string;          // ISO timestamp with resolvable time zone/UTC
  recordedAt: string;
  sourcePlatform: 'healthkit' | 'health_connect' | 'manual';
  sourceDevice?: string;
  sourceApp?: string;
  externalRecordId?: string;
  measurementMethod?: string;
  measurementSubtype?: string; // e.g. 'RMSSD' | 'SDNN'
  qualityStatus: 'valid' | 'invalid' | 'unverified';
};
```

Proposed feature-level organization, **adapt to repository**:

```text
src/features/
  recovery/
    components/
      BiometricCard.tsx
      RecoveryIndexCard.tsx
      RatingSlider.tsx
      SleepTimeRangeSlider.tsx
      MorningQuestionnaire.tsx
      QuestionnaireStatus.tsx
    services/
      recoveryService.ts
      questionnaireService.ts
      baselineService.ts
    calculations/
      subjectiveRecovery.ts
      objectiveRecovery.ts
      hrv.ts
      sleep.ts
  progress/
    components/
      ProgressTimeframeSelector.tsx
      ProgressChartCard.tsx
      ToggleableChartLegend.tsx
      TimeSeriesLineChart.tsx
      SynchronizedSubgraphGroup.tsx
    charts/
      BodyWeightChart.tsx
      RecoveryIndexChart.tsx
      CardiacTrendsChart.tsx
      SleepTrendsChart.tsx
      FatigueTrendsChart.tsx
    services/
      chartAggregation.ts
      progressService.ts
  health/
    adapters/
      appleHealthAdapter.ts
      healthConnectAdapter.ts
    services/
      healthSyncService.ts
      healthNormalization.ts
      sourceResolution.ts
    types/
      healthMetrics.ts
```

---

## 9. Security, privacy and failure handling

- Restrict requested permissions to actual feature needs; prefer read-only. Clearly describe each data category to user.
- Enforce per-user access controls in application and database/API queries; do not expose other athlete health records.
- Encrypt data in transit and at rest as appropriate to deployment; avoid leaking health records into generalized analytics, crash logs or marketing tools.
- Support disconnecting integrations, changing source preference, and deleting imported data/derived results without conflating these actions.
- Handle revoked permissions, unavailable sensors, partially imported historical data, delayed sync, duplicates, edits/deletions upstream, corrupted data, offline states, and new timezone without fabricating measurements.
- Use explicit validation of timestamps (including overnight), units, impossible readings, nonfinite calculations, and baseline count/variance.
- Consider retention policy and app-store health data policies before release.

---

## 10. Delivery phases and milestones

### Phase 1 — Manual Recovery MVP

- Inspect Home tab/navigation conventions and existing persistence.
- Implement Recovery view and biometric grid placeholder/empty states.
- Implement `RatingSlider`, dual-thumb 15-minute sleep selector and questionnaire validation.
- Implement questionnaire persistence, per-day completion indicator, editing, offline support and SRI v1.
- Optional configurable morning notification, with no repeat after completion.

**Acceptance:** manual flow works end-to-end and reliably stores/updates historical questionnaire data; no faux wearable values.

### Phase 2 — HealthKit / Health Connect

- Configure native modules, permissions and Expo development builds.
- Implement platform adapters, initial history read, incremental synchronization, normalization, source preference, deduplication, and deletion reconciliation.
- Wire objective measurement cards with provenance and missing-data states.

**Acceptance:** real physical iOS/Android devices show only actually available measurements; permission and sync failures are handled.

### Phase 3 — Objective engine

- Implement stored baselines, lnRMSSD for RMSSD, Z-scores, sleep measures and standardized HRR60.
- Implement recalculated/versioned daily snapshots and source coverage.
- Scaffold experimental ORI behind a separately approved transform/weights configuration; use `—` otherwise.

**Acceptance:** tests reproduce reference calculations; insufficient/heterogeneous inputs never produce misleading scores.

### Phase 4 — Progress charts

- Build reusable timeframe selector, line chart, legend toggles, date cursor, tooltip, subgraph synchronization, and aggregation layer.
- Implement all five chart categories with correct axes/timeframes, source labels, coverage, and gaps.

**Acceptance:** Week/Month/Year/Lifetime and legend toggles function correctly on every group; different units use separate synchronized panels.

### Phase 5 — Production testing and validation

- Integration-test both native platforms, multiple devices/sources, backfill, sync retries, revoked permissions, midnight/DST, and questionnaire edits.
- Verify data security, accessibility, performance with years of records, and chart aggregation correctness.
- Only explore ORI calibration with independent performance endpoints; mark research outputs experimental.

**Acceptance:** production-critical flows and reliability tests pass with documented restrictions.

---

## 11. Test plan and acceptance checklist

### Functional acceptance checklist

- [ ] Existing Home / Recovery / Progress segmented navigation is reused; no redundant navigation system.
- [ ] Recovery shows latest valid values, source/time and `—` for unavailable data.
- [ ] RHR, HRV, HRR, sleep, respiratory and temperature input handling preserves type/source and only shows actually supported measurements.
- [ ] HealthKit and Health Connect read supported real records on physical devices; permissions and sync error cases work.
- [ ] A new local day results in a fresh incomplete questionnaire status; previous days persist.
- [ ] In-app reminder is persistent until questionnaire completion; optional device reminder is user-configurable and completion-aware.
- [ ] Reusable 0–10 rating and 15-minute dual-point sleep-time controls are accessible and validated.
- [ ] Questionnaire distinguishes missing from zero and allows edits with recalculation.
- [ ] SRI exactly matches the versioned formula using six required inputs.
- [ ] Objective formulas match companion mathematical reference; HRV subtypes never merge.
- [ ] ORI is absent unless a documented experimental model is configured; any provisional ORI is labeled experimental and shows coverage/version.
- [ ] Body Weight plot shows daily weigh-ins and trailing calendar 7-day average with partial-coverage handling.
- [ ] Recovery plot shows SRI and experimental ORI on 0–100 with gaps where unavailable.
- [ ] Cardiac plot has synchronized HRV, RHR, HRR subgraphs, valid baselines and protocol constraints.
- [ ] Sleep plot has duration, quality, efficiency and awakenings with separate sensible axes and provenance.
- [ ] Fatigue plot shows fatigue, mood, soreness, stress, motivation alongside separately scaled indices.
- [ ] All charts have functional Week, Month, Year and Lifetime, correct calendar ticks and previous/next period navigation.
- [ ] Each chart's legend toggles individual variables; visibility persists when timeframe changes.
- [ ] Charts distinguish true zero from missing, preserve breaks, show precise tooltips, and communicate coverage.
- [ ] Year/Lifetime aggregation reports method, sample count and eligible-day coverage.
- [ ] Data is scoped securely to the authenticated athlete; deletion/disconnect works predictably.

### Essential automated edge-case tests

1. Sleep 23:00 → 07:00 next day; midnight crossing, optional awake-minutes subtraction, timezone/DST shifts.
2. Unanswered slider stays `null` rather than 0; valid all-zero scores remain accepted.
3. SRI sample: quality 7, fatigue 3, soreness 4, stress 2, motivation 8, awakenings 1 → normalized values `.7, .7, .6, .8, .8, .8` → **SRI = 73** after rounding (`440/6 ≈ 73.33`).
4. HRR example: 182 bpm at end, 140 bpm after 60s → **42 bpm**; reject unmatched test protocol.
5. RHR baseline 55 bpm, SD 3, today 61 bpm → **z = +2**; zero SD → no Z-score.
6. HRV SDNN received from HealthKit and RMSSD received from Health Connect must never be aggregated as identical.
7. Sleep efficiency missing if time-in-bed is missing; no invented 100% efficiency.
8. Missing 2–3 daily weights yields gaps; 7-day average uses observed days and shows partial coverage; minimum 4 valid days.
9. Data arriving after a previous day's snapshot triggers correct historical recalculation and cache invalidation.
10. One questionnaire per local day, editable, with completion reminder suppressed after submission.
11. Month end 28/29/30/31 days, year Jan–Dec, lifetime adaptive axis; absent dates aren't converted to zero.
12. Unavailable ORI with no configured model remains `—`, despite other measurements being present.
13. No historical mixing of different scoring model versions without explicit labeling.
14. Partial sync failure or revoked permissions does not wipe already valid records or represent stale data as today.

---

## 12. Optional future expansion

After completing this specification, consider connecting daily recovery to strength/Muay Thai/conditioning session type, volume, RPE load, nutrition intake, and independent performance outcomes. The established CTL/ATL/TSB model is suitable for tracking **training-load balance**, not literal percentage recovery. Later, investigate whether baseline deviations and questionnaires predict **measured performance** for real athletes rather than using subjective questionnaire inputs as circular proof of a recovery score.

---

## 13. Required agent deliverables and reporting

At the end of each phase, provide:

1. Files/components added or changed and how they integrate with existing CAPS patterns.
2. Database migration/schema changes and rollback/data retention consequences.
3. Native platform setup, required entitlements/permissions and actual on-device test steps.
4. Implemented calculations, coverage rules, version identifiers and scientific limitations.
5. Unit/integration tests run, results and outstanding blockers.
6. Any explicit decisions made where the spec leaves configurable behavior (e.g. minimum baseline observation count, preferred source precedence, ORI prototype enablement).

**Do not claim completion of native-device validation, health permissions, scoring-model validation, or data sync without actually testing them.**

### Source notes

Primary mathematical reference: **CAPS — Recovery Monitoring Mathematics**, provided alongside this plan (`Pasted markdown(2).md`). Its core conclusion governs this implementation: use established calculations for individual objective signals; a combined objective recovery/readiness number is experimental until independently validated. Platform/library choices and exact health-data APIs must be verified against the project's current Expo/OS versions during implementation.
