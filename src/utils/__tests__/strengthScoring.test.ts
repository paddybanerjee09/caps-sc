import type { StrengthExercise } from "../../types/strength";
import { scoreStrengthExercise, scoreStrengthSession } from "../strengthScoring";

function exercise(overrides: Partial<StrengthExercise> = {}): StrengthExercise {
  return { exerciseId: "x", name: "bench press", labelConfirmed: true, movementProfile: "non_explosive", movementProfileSource: "name-rule",
    externalLoadKg: 80, sets: 4, reps: 10, rpe: 9, percent1RM: 70, notes: null, ...overrides };
}
describe("strength scoring", () => {
  test.each([
    ["hypertrophy", exercise()],
    ["power", exercise({ name: "power clean", movementProfile: "explosive", externalLoadKg: 100, sets: 5, reps: 3, rpe: 7, percent1RM: 80 })],
    ["endurance", exercise({ externalLoadKg: 20, sets: 4, reps: 30, rpe: 8, percent1RM: 30 })],
  ] as const)("selects %s for a biased session", (expected, input) => {
    const result = scoreStrengthSession([input]);
    expect(result.status).toBe("scored");
    if (result.status === "scored") {
      expect(result.primaryAdaptation).toBe(expected);
      Object.values(result.scores).forEach(score => expect(score).toBeGreaterThanOrEqual(0));
      Object.values(result.scores).forEach(score => expect(score).toBeLessThanOrEqual(100));
    }
  });
  test("requires direct intensity and known profiles for full evidence", () => {
    const full = scoreStrengthSession([exercise()]);
    const limited = scoreStrengthSession([exercise({ name: "cable crossover", movementProfile: "unknown", movementProfileSource: "unknown", percent1RM: null, externalLoadKg: 0 })]);
    expect(full.status === "scored" && full.evidence).toBe("full");
    expect(limited.status === "scored" && limited.evidence).toBe("limited");
  });
  test("uses external load volume in weighted hypertrophy contributions", () => {
    const lowVolume = scoreStrengthExercise(exercise({ externalLoadKg: 20, sets: 3, reps: 10 }));
    const highVolume = scoreStrengthExercise(exercise({ externalLoadKg: 80, sets: 3, reps: 10 }));
    expect(lowVolume.volumeLoadKg).toBe(600);
    expect(highVolume.volumeLoadKg).toBe(2400);
    expect(highVolume.scores.hypertrophy).toBeGreaterThan(lowVolume.scores.hypertrophy);
  });
  test("is insufficient without exercises and breaks ties deterministically", () => {
    expect(scoreStrengthSession([]).status).toBe("insufficient");
    const first = scoreStrengthSession([exercise({ externalLoadKg: 0, reps: 500, rpe: 1, percent1RM: null })]);
    const second = scoreStrengthSession([exercise({ externalLoadKg: 0, reps: 500, rpe: 1, percent1RM: null })]);
    expect(first).toEqual(second);
  });
});
