import type { SQLiteDatabase } from "expo-sqlite";
import { createStrengthTemplate, getStrengthSessionByTimelineEntryId, getStrengthSessionsForRange, logCompletedStrengthSession, updateStrengthTemplate } from "../strengthRepository";
import type { StrengthExercise } from "../../types/strength";

const exercise: StrengthExercise = { exerciseId: "stable-1", name: "Back squat", 
  movementProfile: "unknown", movementProfileSource: "unknown", externalLoadKg: 100, sets: 3, reps: 5, rpe: 8, percent1RM: 75, notes: "Controlled" };
afterEach(() => jest.restoreAllMocks());
function harness() {
  const calls: { sql: string; params: unknown[] }[] = [];
  let insertId = 40;
  const tx = {
    runAsync: jest.fn(async (sql: string, params: unknown[] = []) => {
      calls.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
      if (sql.startsWith("UPDATE strength_session_templates")) return { changes: 1, lastInsertRowId: 0 };
      return { changes: 1, lastInsertRowId: ++insertId };
    }),
  } as unknown as SQLiteDatabase;
  const db = {
    runAsync: jest.fn(async () => { throw new Error("write escaped transaction"); }),
    withExclusiveTransactionAsync: jest.fn(async (callback: (value: SQLiteDatabase) => Promise<void>) => callback(tx)),
  } as unknown as SQLiteDatabase;
  return { db, calls };
}
describe("strength repository writes", () => {
  test("validates before opening a template transaction", async () => {
    const h = harness();
    await expect(createStrengthTemplate(h.db, { title: " ", exercises: [exercise] })).rejects.toThrow("Session title");
    expect(h.db.withExclusiveTransactionAsync).not.toHaveBeenCalled();
  });
  test("creates and updates templates with ordered duplicate exercises", async () => {
    const h = harness();
    const created = await createStrengthTemplate(h.db, { title: " Legs ", exercises: [exercise, exercise] });
    expect(created.title).toBe("Legs");
    expect(h.calls.filter(call => call.sql.startsWith("INSERT INTO strength_template_exercises")).map(call => call.params[1])).toEqual([0, 1]);
    h.calls.length = 0;
    await updateStrengthTemplate(h.db, 7, { title: "Legs 2", exercises: [exercise] });
    expect(h.calls.map(call => call.sql)).toEqual(expect.arrayContaining([expect.stringContaining("UPDATE strength_session_templates"), expect.stringContaining("DELETE FROM strength_template_exercises"), expect.stringContaining("INSERT INTO strength_template_exercises")]));
  });
  test("writes timeline, log, immutable exercise and score snapshots atomically", async () => {
    jest.spyOn(Date, "now").mockReturnValue(2_000_000);
    const h = harness();
    const id = await logCompletedStrengthSession(h.db, { title: "Strength", exercises: [exercise, { ...exercise, name: "Bench press" }], startAt: 1_000_000, sourceTemplateId: 7 });
    expect(id).toBe(41);
    expect(h.db.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
    expect(h.calls.map(call => call.sql)).toEqual(expect.arrayContaining([
      expect.stringContaining("INSERT INTO timeline_entries"), expect.stringContaining("INSERT INTO strength_logs"),
      expect.stringContaining("INSERT INTO strength_log_exercises"), expect.stringContaining("INSERT INTO strength_adaptation_scores"),
      expect.stringContaining("INSERT INTO strength_exercise_adaptation_scores"),
    ]));
    expect(h.calls.filter(call => call.sql.startsWith("INSERT INTO strength_log_exercises")).map(call => call.params[1])).toEqual([0, 1]);
    expect(h.calls.some(call => call.params.includes("https://"))).toBe(false);
  });
  test("rejects future session writes before a transaction", async () => {
    const h = harness();
    await expect(logCompletedStrengthSession(h.db, { title: "Strength", exercises: [exercise], startAt: Date.now() + 1000 })).rejects.toThrow("future");
    expect(h.db.withExclusiveTransactionAsync).not.toHaveBeenCalled();
  });
});
describe("strength repository queries", () => {
  const sessionRow = { timeline_entry_id: 3, title: "Snapshot", start_at: 100, source_template_id: 7,
    hypertrophy_score: 80, power_score: 20, endurance_score: 10, primary_adaptation: "hypertrophy", evidence_level: "full", scoring_model_version: "strength-v1.0.0" };
  const exerciseRow = { exercise_external_id: "stable-1", exercise_name: "Original squat", movement_profile: "non_explosive", movement_profile_source: "name-rule",
    external_load_kg: 100, sets: 3, reps: 5, rpe: 8, percent_1rm: 75, notes: null, intensity_source: "entered" };
  test("returns range metadata", async () => {
    const db = { getAllAsync: jest.fn(async () => [sessionRow]) } as unknown as SQLiteDatabase;
    await expect(getStrengthSessionsForRange(db, 0, 200)).resolves.toEqual([{ timelineEntryId: 3, title: "Snapshot", startAt: 100, primaryAdaptation: "hypertrophy", evidence: "full" }]);
  });
  test("hydrates historical details from immutable log rows", async () => {
    const db = {
      getFirstAsync: jest.fn(async () => sessionRow),
      getAllAsync: jest.fn(async (sql: string) => sql.includes("strength_log_exercises WHERE") ? [exerciseRow] : [{
        hard_sets: 3, total_repetitions: 15, volume_load_kg: 1500, percent_1rm_used: 75,
        hypertrophy_contribution: 80, power_contribution: 20, endurance_contribution: 10,
        evidence_level: "full", scoring_model_version: "strength-v1.0.0", intensity_source: "entered",
      }]),
    } as unknown as SQLiteDatabase;
    const session = await getStrengthSessionByTimelineEntryId(db, 3);
    expect(session?.exercises[0].name).toBe("Original squat");
    expect(session?.score.exercises[0].volumeLoadKg).toBe(1500);
  });
});
