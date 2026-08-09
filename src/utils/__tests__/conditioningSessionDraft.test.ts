import type { AthleteConditioningBaselines } from "../../types/conditioning";
import {
  analyzeConditioningSessionFormDraft,
  changeConditioningDistanceUnit,
  clearConditioningIntensity,
  createConditioningSessionFormDraftFromDefinition,
  createDefaultConditioningSessionFormDraft,
  getDistanceWorkDurationForDisplay,
  selectConditioningActivity,
  selectConditioningIntensityMethod,
  selectConditioningProtocolType,
  selectIntervalWorkMode,
  updateConditioningDistanceInput,
} from "../conditioningSessionDraft";

const baselines: AthleteConditioningBaselines = {
  maximumAerobicSpeedKph: 18,
  maximumHeartRateBpm: 200,
  thresholdPaceSecondsPerKm: 240,
};

describe("conditioning session form draft", () => {
  test("restores protocol branches and builds only the active Time interval branch", () => {
    let draft = createDefaultConditioningSessionFormDraft("metric");
    draft.continuous.durationSeconds = 1_800;
    draft.continuous.distance = updateConditioningDistanceInput(
      draft.continuous.distance,
      "5",
      "metric",
    );

    draft = selectConditioningProtocolType(draft, "intervals");
    draft.intervals.timeWorkDurationSeconds = 30;
    draft.intervals.intervalCountInput = "4";
    draft.intervals.roundCountInput = "2";
    draft.intervals.restBetweenIntervalsSeconds = 15;
    draft.intervals.restBetweenRoundsSeconds = 60;

    const intervalAnalysis = analyzeConditioningSessionFormDraft(
      draft,
      baselines,
    );
    expect(intervalAnalysis.ok).toBe(true);
    if (!intervalAnalysis.ok) return;
    expect(intervalAnalysis.protocol).toEqual({
      type: "intervals",
      work: { mode: "time", durationSeconds: 30 },
      restBetweenIntervalsSeconds: 15,
      intervalCount: 4,
      roundCount: 2,
      restBetweenRoundsSeconds: 60,
    });
    expect(intervalAnalysis.protocol).not.toHaveProperty("distanceMeters");

    draft = selectConditioningProtocolType(draft, "continuous");
    const continuousAnalysis = analyzeConditioningSessionFormDraft(
      draft,
      baselines,
    );
    expect(continuousAnalysis.ok).toBe(true);
    if (!continuousAnalysis.ok) return;
    expect(continuousAnalysis.protocol).toEqual({
      type: "continuous",
      durationSeconds: 1_800,
      distanceMeters: 5_000,
    });
  });

  test("restores Time and Distance work caches without adding distance duration", () => {
    let draft = createDefaultConditioningSessionFormDraft("metric");
    draft = selectConditioningProtocolType(draft, "intervals");
    draft.intervals.timeWorkDurationSeconds = 45;
    draft = selectIntervalWorkMode(draft, "distance");
    draft.intervals.distanceWork.distance = updateConditioningDistanceInput(
      draft.intervals.distanceWork.distance,
      "400",
      "metric",
    );

    const distanceAnalysis = analyzeConditioningSessionFormDraft(
      draft,
      baselines,
    );
    expect(distanceAnalysis.ok).toBe(true);
    if (!distanceAnalysis.ok) return;
    expect(distanceAnalysis.protocol).toEqual({
      type: "intervals",
      work: {
        mode: "distance",
        distanceMeters: 400,
        provenance: "distance-only",
      },
      restBetweenIntervalsSeconds: 0,
      intervalCount: 1,
      roundCount: 1,
      restBetweenRoundsSeconds: 0,
    });
    expect(distanceAnalysis.metrics.totalSessionSeconds).toBe(0);
    expect(distanceAnalysis.metrics.totalWorkSeconds).toBe(0);
    expect(distanceAnalysis.metrics.totalDistanceMeters).toBe(400);

    draft = selectIntervalWorkMode(draft, "time");
    const timeAnalysis = analyzeConditioningSessionFormDraft(draft, baselines);
    expect(timeAnalysis.ok).toBe(true);
    if (!timeAnalysis.ok) return;
    expect(timeAnalysis.protocol).toEqual({
      type: "intervals",
      work: { mode: "time", durationSeconds: 45 },
      restBetweenIntervalsSeconds: 0,
      intervalCount: 1,
      roundCount: 1,
      restBetweenRoundsSeconds: 0,
    });
  });

  test("reformats a unit change from canonical metres without reinterpreting text", () => {
    let draft = createDefaultConditioningSessionFormDraft("imperial");
    draft.continuous.durationSeconds = 480;
    draft.continuous.distance = updateConditioningDistanceInput(
      draft.continuous.distance,
      "1",
      "imperial",
    );

    expect(draft.continuous.distance.canonicalMeters).toBe(1609.344);
    draft = changeConditioningDistanceUnit(draft, "metric");
    expect(draft.continuous.distance.displayInput).toBe("1.609");
    expect(draft.continuous.distance.canonicalMeters).toBe(1609.344);

    const analysis = analyzeConditioningSessionFormDraft(draft, baselines);
    expect(analysis.ok).toBe(true);
    if (!analysis.ok || analysis.protocol.type !== "continuous") return;
    expect(analysis.protocol.distanceMeters).toBe(1609.344);
  });

  test("preserves untouched canonical metres and legacy elapsed provenance", () => {
    const draft = createConditioningSessionFormDraftFromDefinition(
      {
        title: "Legacy 400s",
        activity: "running",
        intensity: null,
        notes: null,
        protocol: {
          type: "intervals",
          work: {
            mode: "distance",
            distanceMeters: 402.336,
            durationSeconds: 78.75,
            provenance: "legacy-derived",
            legacyTotalDurationSeconds: 900,
          },
          restBetweenIntervalsSeconds: 30,
          intervalCount: 4,
          roundCount: 2,
          restBetweenRoundsSeconds: 90,
        },
      },
      "imperial",
    );

    expect(draft.intervals.distanceWork.distance.displayInput).toBe("1320");
    const analysis = analyzeConditioningSessionFormDraft(draft, baselines);
    expect(analysis.ok).toBe(true);
    if (
      !analysis.ok ||
      analysis.protocol.type !== "intervals" ||
      analysis.protocol.work.mode !== "distance" ||
      analysis.protocol.work.provenance !== "legacy-derived"
    ) {
      return;
    }
    expect(analysis.protocol.work.distanceMeters).toBe(402.336);
    expect(analysis.protocol.work.provenance).toBe("legacy-derived");
    expect(analysis.protocol.work.legacyTotalDurationSeconds).toBe(900);
    expect(analysis.metrics.totalSessionSeconds).toBe(900);
  });

  test("turns a committed legacy duration edit into explicit whole-second work", () => {
    const draft = createConditioningSessionFormDraftFromDefinition({
      title: "Legacy",
      activity: "running",
      intensity: null,
      notes: null,
      protocol: {
        type: "intervals",
        work: {
          mode: "distance",
          distanceMeters: 400,
          durationSeconds: 78.75,
          provenance: "legacy-derived",
          legacyTotalDurationSeconds: 900,
        },
        restBetweenIntervalsSeconds: 30,
        intervalCount: 4,
        roundCount: 2,
        restBetweenRoundsSeconds: 90,
      },
    });
    draft.intervals.distanceWork.durationDirty = true;
    draft.intervals.distanceWork.durationSeconds = 79;
    draft.intervals.distanceWork.provenance = "explicit";
    draft.intervals.distanceWork.legacyTotalDurationSeconds = undefined;

    const analysis = analyzeConditioningSessionFormDraft(draft, baselines);
    expect(analysis.ok).toBe(true);
    if (
      !analysis.ok ||
      analysis.protocol.type !== "intervals" ||
      analysis.protocol.work.mode !== "distance" ||
      analysis.protocol.work.provenance === "distance-only"
    ) {
      return;
    }
    expect(analysis.protocol.work).toEqual({
      mode: "distance",
      distanceMeters: 400,
      durationSeconds: 79,
      provenance: "explicit",
    });
    expect(analysis.metrics.totalSessionSeconds).toBe(902);
  });

  test("keeps legacy-derived work duration synchronized with structure edits", () => {
    const draft = createConditioningSessionFormDraftFromDefinition({
      title: "Legacy structure edit",
      activity: "running",
      intensity: null,
      notes: null,
      protocol: {
        type: "intervals",
        work: {
          mode: "distance",
          distanceMeters: 400,
          durationSeconds: 78.75,
          provenance: "legacy-derived",
          legacyTotalDurationSeconds: 900,
        },
        restBetweenIntervalsSeconds: 30,
        intervalCount: 4,
        roundCount: 2,
        restBetweenRoundsSeconds: 90,
      },
    });

    draft.intervals.intervalCountInput = "2";
    draft.intervals.restBetweenIntervalsSeconds = 15;
    expect(getDistanceWorkDurationForDisplay(draft.intervals)).toBe(195);

    const analysis = analyzeConditioningSessionFormDraft(draft, baselines);
    expect(analysis.ok).toBe(true);
    if (
      !analysis.ok ||
      analysis.protocol.type !== "intervals" ||
      analysis.protocol.work.mode !== "distance" ||
      analysis.protocol.work.provenance === "distance-only"
    ) {
      return;
    }
    expect(analysis.protocol.work.durationSeconds).toBe(195);
    expect(analysis.metrics.totalSessionSeconds).toBe(900);
  });

  test("ties Circuit activity to its cached station branch", () => {
    let draft = createDefaultConditioningSessionFormDraft();
    draft.circuit.stations = [
      { nameInput: "Bike", workSeconds: 40 },
      { nameInput: "Carry", workSeconds: 20 },
    ];
    draft.circuit.roundCountInput = "3";
    draft = selectConditioningActivity(draft, "circuit");

    const circuitAnalysis = analyzeConditioningSessionFormDraft(
      draft,
      baselines,
    );
    expect(circuitAnalysis.ok).toBe(true);
    if (!circuitAnalysis.ok) return;
    expect(circuitAnalysis.protocol.type).toBe("circuit");

    draft = selectConditioningActivity(draft, "running");
    expect(draft.activeProtocolType).toBe("continuous");
    draft = selectConditioningActivity(draft, "circuit");
    expect(draft.circuit.stations.map((station) => station.nameInput)).toEqual([
      "Bike",
      "Carry",
    ]);
  });

  test("normalizes a legacy Circuit activity mismatch only after explicit input", () => {
    let draft = createConditioningSessionFormDraftFromDefinition({
      title: "Legacy mismatch",
      activity: "circuit",
      intensity: null,
      notes: null,
      protocol: {
        type: "continuous",
        durationSeconds: 600,
        distanceMeters: null,
      },
    });

    expect(draft.activity).toBe("circuit");
    expect(draft.activeProtocolType).toBe("continuous");
    draft = selectConditioningProtocolType(draft, "intervals");
    expect(draft.activeProtocolType).toBe("circuit");
    expect(draft.lastNonCircuitProtocolType).toBe("intervals");
  });

  test("restores HR/RPE caches but emits only the active intensity", () => {
    let draft = createDefaultConditioningSessionFormDraft();
    draft.continuous.durationSeconds = 600;
    draft = selectConditioningIntensityMethod(draft, "heart_rate");
    draft.intensity.heartRateInput = "150";
    draft = selectConditioningIntensityMethod(draft, "rpe");
    draft.intensity.rpeInput = "7";
    draft = selectConditioningIntensityMethod(draft, "heart_rate");

    expect(draft.intensity.rpeInput).toBe("7");
    expect(draft.intensity.heartRateInput).toBe("150");
    const analysis = analyzeConditioningSessionFormDraft(draft, baselines);
    expect(analysis.ok).toBe(true);
    if (!analysis.ok) return;
    expect(analysis.intensity).toEqual({
      method: "heart_rate",
      valueBpm: 150,
    });

    draft = clearConditioningIntensity(draft);
    const cleared = analyzeConditioningSessionFormDraft(draft, baselines);
    expect(cleared.ok).toBe(true);
    if (cleared.ok) expect(cleared.intensity).toBeNull();
  });

  test("preserves legacy pace until HR or RPE explicitly replaces it", () => {
    let draft = createConditioningSessionFormDraftFromDefinition({
      title: "Legacy tempo",
      activity: "running",
      intensity: {
        method: "pace",
        paceSecondsPerKm: 245,
        reference: "threshold_pace",
      },
      notes: null,
      protocol: {
        type: "continuous",
        durationSeconds: 1_200,
        distanceMeters: 5_000,
      },
    });
    draft.titleInput = "Renamed";

    const preserved = analyzeConditioningSessionFormDraft(draft, baselines);
    expect(preserved.ok).toBe(true);
    if (!preserved.ok) return;
    expect(preserved.intensity).toEqual({
      method: "pace",
      paceSecondsPerKm: 245,
      reference: "threshold_pace",
    });

    draft = selectConditioningIntensityMethod(draft, "rpe");
    draft.intensity.rpeInput = "6";
    const replaced = analyzeConditioningSessionFormDraft(draft, baselines);
    expect(replaced.ok).toBe(true);
    if (!replaced.ok) return;
    expect(replaced.intensity).toEqual({ method: "rpe", value: 6 });
    expect(draft.intensity.legacyPace).toBeNull();
  });

  test("hydrates a saved heart-rate snapshot without requiring the current baseline", () => {
    const storedIntensity = {
      method: "heart_rate" as const,
      valueBpm: 168,
      maxHeartRateBpm: 194,
    };
    const draft = createConditioningSessionFormDraftFromDefinition(
      {
        title: "Historical threshold set",
        activity: "assault_bike",
        intensity: storedIntensity,
        notes: "Keep the original baseline",
        protocol: {
          type: "continuous",
          durationSeconds: 1_800,
          distanceMeters: 12_345.678,
        },
      },
      "imperial",
      storedIntensity,
    );

    expect(draft.continuous.distance.canonicalMeters).toBe(12_345.678);
    expect(draft.intensity.dirty).toBe(false);
    const analysis = analyzeConditioningSessionFormDraft(draft, {
      maximumAerobicSpeedKph: null,
      maximumHeartRateBpm: null,
      thresholdPaceSecondsPerKm: null,
    });

    expect(analysis.ok).toBe(true);
    if (!analysis.ok) return;
    expect(analysis.intensity).toEqual({
      method: "heart_rate",
      valueBpm: 168,
    });
    expect(analysis.snapshot).toEqual(storedIntensity);
    expect(analysis.protocol).toEqual({
      type: "continuous",
      durationSeconds: 1_800,
      distanceMeters: 12_345.678,
    });
  });

  test("recreates an edited Circuit draft from the unchanged stored record", () => {
    const storedDefinition = {
      title: "Original circuit",
      activity: "circuit" as const,
      intensity: null,
      notes: null,
      protocol: {
        type: "circuit" as const,
        roundCount: 3,
        restBetweenRoundsSeconds: 90,
        restBetweenStationsSeconds: 15,
        stations: [
          { name: "Sled", position: 0, workSeconds: 40 },
          { name: "Carry", position: 1, workSeconds: 30 },
        ],
      },
    };
    const abandonedDraft =
      createConditioningSessionFormDraftFromDefinition(storedDefinition);
    abandonedDraft.titleInput = "Unsaved title";
    abandonedDraft.circuit.stations[0].nameInput = "Unsaved station";
    abandonedDraft.circuit.stations.pop();

    const reopenedDraft =
      createConditioningSessionFormDraftFromDefinition(storedDefinition);
    expect(reopenedDraft.titleInput).toBe("Original circuit");
    expect(reopenedDraft.circuit.stations).toEqual([
      { nameInput: "Sled", workSeconds: 40 },
      { nameInput: "Carry", workSeconds: 30 },
    ]);
  });

  test("builds the locked hill sprint protocol with elevation and RPE", () => {
    let draft = createDefaultConditioningSessionFormDraft("metric");
    draft = selectConditioningActivity(draft, "hill_sprints");
    draft.intervals.distanceWork.distance = updateConditioningDistanceInput(
      draft.intervals.distanceWork.distance,
      "80",
      "metric",
    );
    draft.intervals.elevationGain = updateConditioningDistanceInput(
      draft.intervals.elevationGain,
      "12",
      "metric",
    );
    draft.intervals.intervalCountInput = "6";
    draft.intervals.restBetweenIntervalsSeconds = 90;
    draft.intensity.rpeInput = "9";

    const analysis = analyzeConditioningSessionFormDraft(draft, baselines);
    expect(analysis.ok).toBe(true);
    if (!analysis.ok) return;
    expect(analysis.intensity).toEqual({ method: "rpe", value: 9 });
    expect(analysis.protocol).toEqual({
      type: "intervals",
      work: {
        mode: "distance",
        distanceMeters: 80,
        elevationGainMeters: 12,
        provenance: "distance-only",
      },
      restBetweenIntervalsSeconds: 90,
      intervalCount: 6,
      roundCount: 1,
      restBetweenRoundsSeconds: 0,
    });
  });
});
