import {
  evaluateConditioningProtocol,
  getConditioningEndAt,
  parseConditioningProtocolDraft,
} from "../conditioningProtocol";

describe("conditioning protocol calculations", () => {
  it("calculates a continuous session", () => {
    const result = evaluateConditioningProtocol({
      type: "continuous",
      durationSeconds: 1_800,
      distanceMeters: 5_000,
    });

    expect(result).toEqual({
      ok: true,
      protocol: {
        type: "continuous",
        durationSeconds: 1_800,
        distanceMeters: 5_000,
      },
      metrics: {
        protocolType: "continuous",
        totalBouts: 1,
        workBoutSeconds: [1_800],
        totalWorkSeconds: 1_800,
        totalRestSeconds: 0,
        totalSessionSeconds: 1_800,
        totalDistanceMeters: 5_000,
        averageWorkBoutSeconds: 1_800,
        workToRestRatio: null,
        estimatedWorkDuration: false,
      },
    });
  });

  it("calculates work and scheduled rest for time intervals", () => {
    const result = evaluateConditioningProtocol({
      type: "intervals",
      work: { mode: "time", durationSeconds: 30 },
      restBetweenIntervalsSeconds: 15,
      intervalCount: 4,
      roundCount: 2,
      restBetweenRoundsSeconds: 60,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.metrics).toMatchObject({
      totalBouts: 8,
      totalWorkSeconds: 240,
      totalRestSeconds: 150,
      totalSessionSeconds: 390,
      averageWorkBoutSeconds: 30,
      workToRestRatio: 1.6,
      estimatedWorkDuration: false,
    });
    expect(result.metrics.workBoutSeconds).toEqual(Array(8).fill(30));
  });

  it("derives distance-interval work from elapsed time after rest", () => {
    const result = evaluateConditioningProtocol({
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
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.metrics).toMatchObject({
      totalBouts: 8,
      totalWorkSeconds: 630,
      totalRestSeconds: 270,
      totalSessionSeconds: 900,
      totalDistanceMeters: 3_200,
      averageWorkBoutSeconds: 78.75,
      estimatedWorkDuration: true,
    });
    expect(result.metrics.workBoutSeconds).toEqual(Array(8).fill(78.75));
  });

  it("keeps a legacy elapsed total exact across fractional interval work", () => {
    const result = evaluateConditioningProtocol({
      type: "intervals",
      work: {
        mode: "distance",
        distanceMeters: 100,
        durationSeconds: 1 / 49,
        provenance: "legacy-derived",
        legacyTotalDurationSeconds: 1,
      },
      restBetweenIntervalsSeconds: 0,
      intervalCount: 49,
      roundCount: 1,
      restBetweenRoundsSeconds: 0,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.metrics.totalWorkSeconds).toBe(1);
    expect(result.metrics.totalSessionSeconds).toBe(1);
  });

  it("calculates explicit distance work per interval", () => {
    const result = evaluateConditioningProtocol({
      type: "intervals",
      work: {
        mode: "distance",
        distanceMeters: 400,
        durationSeconds: 75,
        provenance: "explicit",
      },
      restBetweenIntervalsSeconds: 30,
      intervalCount: 4,
      roundCount: 2,
      restBetweenRoundsSeconds: 90,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.metrics).toMatchObject({
      protocolType: "intervals",
      totalBouts: 8,
      totalWorkSeconds: 600,
      totalRestSeconds: 270,
      totalSessionSeconds: 870,
      totalDistanceMeters: 3_200,
      averageWorkBoutSeconds: 75,
      estimatedWorkDuration: false,
    });
  });

  it("records distance intervals without inventing work duration", () => {
    const result = evaluateConditioningProtocol({
      type: "intervals",
      work: {
        mode: "distance",
        distanceMeters: 400,
        provenance: "distance-only",
      },
      restBetweenIntervalsSeconds: 30,
      intervalCount: 4,
      roundCount: 2,
      restBetweenRoundsSeconds: 90,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.metrics).toMatchObject({
      totalBouts: 8,
      totalWorkSeconds: 0,
      totalRestSeconds: 270,
      totalSessionSeconds: 270,
      totalDistanceMeters: 3_200,
      averageWorkBoutSeconds: 0,
      workBoutSeconds: [],
      workToRestRatio: null,
      estimatedWorkDuration: false,
    });
  });

  it("calculates circuit work and rest across rounds", () => {
    const result = evaluateConditioningProtocol({
      type: "circuit",
      stations: [
        { name: "Bike", position: 0, workSeconds: 40 },
        { name: "Carry", position: 1, workSeconds: 20 },
      ],
      restBetweenStationsSeconds: 10,
      roundCount: 3,
      restBetweenRoundsSeconds: 60,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.metrics).toMatchObject({
      totalBouts: 6,
      workBoutSeconds: [40, 20, 40, 20, 40, 20],
      totalWorkSeconds: 180,
      totalRestSeconds: 150,
      totalSessionSeconds: 330,
      averageWorkBoutSeconds: 30,
      estimatedWorkDuration: false,
    });
  });
});

describe("conditioning protocol validation", () => {
  it("parses valid numeric draft values and permits blank distance", () => {
    const result = parseConditioningProtocolDraft({
      type: "continuous",
      durationSecondsInput: " 600 ",
      distanceMetersInput: " ",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.protocol).toEqual({
      type: "continuous",
      durationSeconds: 600,
      distanceMeters: null,
    });
  });

  it("maps a legacy time-interval draft to the canonical interval model", () => {
    const result = parseConditioningProtocolDraft({
      type: "time_intervals",
      workSecondsInput: "30",
      restBetweenRepetitionsSecondsInput: "15",
      repetitionsPerSetInput: "4",
      setCountInput: "2",
      restBetweenSetsSecondsInput: "60",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.protocol).toEqual({
      type: "intervals",
      work: { mode: "time", durationSeconds: 30 },
      restBetweenIntervalsSeconds: 15,
      intervalCount: 4,
      roundCount: 2,
      restBetweenRoundsSeconds: 60,
    });
  });

  it("preserves elapsed-time provenance when mapping a legacy distance draft", () => {
    const result = parseConditioningProtocolDraft({
      type: "distance_intervals",
      workDistanceMetersInput: "400",
      elapsedDurationSecondsInput: "900",
      restBetweenRepetitionsSecondsInput: "30",
      repetitionsPerSetInput: "4",
      setCountInput: "2",
      restBetweenSetsSecondsInput: "90",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.protocol).toEqual({
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
    });
    expect(result.metrics.estimatedWorkDuration).toBe(true);
  });

  it("reports every invalid field in a draft", () => {
    const result = parseConditioningProtocolDraft({
      type: "time_intervals",
      workSecondsInput: "0",
      restBetweenRepetitionsSecondsInput: "-1",
      repetitionsPerSetInput: "1.5",
      setCountInput: "51",
      restBetweenSetsSecondsInput: "invalid",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.issues.map(({ field }) => field)).toEqual([
      "workSeconds",
      "restBetweenRepetitionsSeconds",
      "repetitionsPerSet",
      "setCount",
      "restBetweenSetsSeconds",
    ]);
  });

  it("rejects a complete interval session longer than 24 hours", () => {
    const result = evaluateConditioningProtocol({
      type: "intervals",
      work: { mode: "time", durationSeconds: 43_201 },
      restBetweenIntervalsSeconds: 0,
      intervalCount: 2,
      roundCount: 1,
      restBetweenRoundsSeconds: 0,
    });

    expect(result).toEqual({
      ok: false,
      issues: [
        {
          field: "totalSessionSeconds",
          message: "The complete session cannot be longer than 24 hours.",
        },
      ],
    });
  });

  it("rejects distance intervals when scheduled rest consumes elapsed time", () => {
    const result = parseConditioningProtocolDraft({
      type: "distance_intervals",
      workDistanceMetersInput: "200",
      elapsedDurationSecondsInput: "120",
      restBetweenRepetitionsSecondsInput: "60",
      repetitionsPerSetInput: "3",
      setCountInput: "1",
      restBetweenSetsSecondsInput: "0",
    });

    expect(result).toEqual({
      ok: false,
      issues: [
        {
          field: "elapsedDurationSeconds",
          message: "Elapsed duration must be longer than all scheduled rest.",
        },
      ],
    });
  });

  it("rejects out-of-order circuit station positions", () => {
    const result = evaluateConditioningProtocol({
      type: "circuit",
      stations: [{ name: "Bike", position: 1, workSeconds: 30 }],
      restBetweenStationsSeconds: 0,
      roundCount: 1,
      restBetweenRoundsSeconds: 0,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.issues).toContainEqual({
      field: "stations.0.position",
      message: "Circuit station positions must be continuous and ordered.",
    });
  });
});

describe("getConditioningEndAt", () => {
  it("adds a valid session duration to its start timestamp", () => {
    expect(getConditioningEndAt(1_000, 90)).toBe(91_000);
  });

  it("uses a one-millisecond timeline span when recorded duration is omitted", () => {
    expect(getConditioningEndAt(1_000, 0)).toBe(1_001);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    "returns null for invalid duration %s",
    (durationSeconds) => {
      expect(getConditioningEndAt(1_000, durationSeconds)).toBeNull();
    },
  );
});
