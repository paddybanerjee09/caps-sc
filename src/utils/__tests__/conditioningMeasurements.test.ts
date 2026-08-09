import {
  calculatePaceSeconds,
  convertDistanceToMeters,
  convertMetersToDistance,
  elapsedDurationPartsToSeconds,
  formatDistanceInput,
  formatElapsedDuration,
  formatPace,
} from "../conditioningMeasurements";

describe("conditioning measurements", () => {
  test("formats elapsed durations and rejects invalid values", () => {
    expect(formatElapsedDuration(null)).toBe("--:--:--");
    expect(formatElapsedDuration(Number.NaN)).toBe("--:--:--");
    expect(formatElapsedDuration(-1)).toBe("--:--:--");
    expect(formatElapsedDuration(0)).toBe("00:00:00");
    expect(formatElapsedDuration(65)).toBe("00:01:05");
    expect(formatElapsedDuration(3661.6)).toBe("01:01:02");
    expect(formatElapsedDuration(86400)).toBe("24:00:00");
    expect(formatElapsedDuration(86401)).toBe("--:--:--");
  });

  test("parses only valid duration parts within the maximum", () => {
    expect(elapsedDurationPartsToSeconds("01", "02", "03")).toBe(3723);
    expect(elapsedDurationPartsToSeconds("24", "00", "00")).toBe(86400);
    expect(elapsedDurationPartsToSeconds("24", "00", "01")).toBeNull();
    expect(elapsedDurationPartsToSeconds("00", "60", "00")).toBeNull();
    expect(elapsedDurationPartsToSeconds("x", "00", "00")).toBeNull();
    expect(elapsedDurationPartsToSeconds("00", "01", "01", 60)).toBeNull();
  });

  test("uses exact metric and imperial conversion constants", () => {
    expect(convertDistanceToMeters(1, "metric")).toBe(1000);
    expect(convertDistanceToMeters(1, "imperial")).toBe(1609.344);
    expect(convertMetersToDistance(1609.344, "imperial")).toBe(1);
  });

  test("formats distance inputs with no more than three decimal places", () => {
    expect(formatDistanceInput(1234, "metric")).toBe("1.234");
    expect(formatDistanceInput(1609.344, "imperial")).toBe("1");
    expect(formatDistanceInput(5000, "metric")).toBe("5");
    expect(formatDistanceInput(null, "metric")).toBe("");
  });

  test("calculates and formats pace in the selected unit", () => {
    expect(calculatePaceSeconds(1501, 5000, "metric")).toBe(300);
    expect(formatPace(1501, 5000, "metric")).toBe("5:00 min/km");
    expect(formatPace(480, 1609.344, "imperial")).toBe("8:00 min/mi");
    expect(formatPace(0, 1000, "metric")).toBe("\u2014 min/km");
    expect(formatPace(60, 0, "imperial")).toBe("\u2014 min/mi");
  });
});
