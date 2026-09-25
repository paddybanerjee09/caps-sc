import { formatExerciseDbTitle } from "../exerciseDbFormatting";

describe("formatExerciseDbTitle", () => {
  test("capitalizes words and preserves hyphens", () => {
    expect(formatExerciseDbTitle("bench press")).toBe("Bench Press");
    expect(formatExerciseDbTitle("  barbell-bench-press  ")).toBe("Barbell-Bench-Press");
  });

  test("handles apostrophes within words", () => {
    expect(formatExerciseDbTitle("farmer's walk")).toBe("Farmer's Walk");
  });

  test("maps provider acronyms", () => {
    expect(formatExerciseDbTitle("ez bar curl")).toBe("EZ Bar Curl");
    expect(formatExerciseDbTitle("trx row")).toBe("TRX Row");
    expect(formatExerciseDbTitle("romanian rdl")).toBe("Romanian RDL");
    expect(formatExerciseDbTitle("hiit circuit")).toBe("HIIT Circuit");
  });

  test("preserves numbers", () => {
    expect(formatExerciseDbTitle("45 degree leg press")).toBe("45 Degree Leg Press");
  });

  test("returns empty string for blank input", () => {
    expect(formatExerciseDbTitle("   ")).toBe("");
  });
});
