import type { ConditioningProtocol } from "../../types/conditioning";
import { getConditioningProtocolSummary } from "../ConditioningSessions";

jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock(
  "@expo/vector-icons/MaterialCommunityIcons",
  () => "MaterialCommunityIcons",
);
jest.mock("expo-sqlite", () => ({ useSQLiteContext: jest.fn() }));

describe("getConditioningProtocolSummary", () => {
  test("formats continuous distance in the preferred unit", () => {
    const protocol: ConditioningProtocol = {
      type: "continuous",
      durationSeconds: 1500,
      distanceMeters: 1609.344,
    };

    expect(getConditioningProtocolSummary(protocol, "metric")).toBe(
      "Continuous · 25m · 1.609 km",
    );
    expect(getConditioningProtocolSummary(protocol, "imperial")).toBe(
      "Continuous · 25m · 1 mi",
    );
  });

  test("describes time work, interval structure, and both rests", () => {
    const protocol: ConditioningProtocol = {
      type: "intervals",
      work: { mode: "time", durationSeconds: 30 },
      restBetweenIntervalsSeconds: 10,
      intervalCount: 4,
      roundCount: 2,
      restBetweenRoundsSeconds: 60,
    };

    expect(getConditioningProtocolSummary(protocol, "metric")).toBe(
      "Intervals · Time work: 30s per interval · 4 intervals × 2 rounds · rests: 10s between intervals, 1m between rounds · 6m total",
    );
  });

  test("shows preferred-unit distance work and explicit timing", () => {
    const protocol: ConditioningProtocol = {
      type: "intervals",
      work: {
        mode: "distance",
        distanceMeters: 1609.344,
        durationSeconds: 480,
        provenance: "explicit",
      },
      restBetweenIntervalsSeconds: 30,
      intervalCount: 2,
      roundCount: 1,
      restBetweenRoundsSeconds: 0,
    };

    expect(getConditioningProtocolSummary(protocol, "imperial")).toBe(
      "Intervals · Distance work: 5280 ft per interval · 2 intervals × 1 round · rests: 30s between intervals, 0s between rounds",
    );
  });

  test("omits legacy duration from the distance summary", () => {
    const protocol: ConditioningProtocol = {
      type: "intervals",
      work: {
        mode: "distance",
        distanceMeters: 400,
        durationSeconds: 95,
        provenance: "legacy-derived",
        legacyTotalDurationSeconds: 690,
      },
      restBetweenIntervalsSeconds: 15,
      intervalCount: 3,
      roundCount: 2,
      restBetweenRoundsSeconds: 60,
    };

    expect(getConditioningProtocolSummary(protocol, "metric")).toBe(
      "Intervals · Distance work: 400 m per interval · 3 intervals × 2 rounds · rests: 15s between intervals, 1m between rounds",
    );
  });
});
