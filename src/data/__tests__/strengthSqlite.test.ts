import { migrateDatabase } from "../database";
import { createSqliteHarness } from "../testUtils/sqliteHarness";
import { createStrengthTemplate, updateStrengthTemplate, listStrengthTemplates, getStrengthTemplate,
  logCompletedStrengthSession, getStrengthSessionsForRange, getStrengthSessionByTimelineEntryId } from "../strengthRepository";
import { getTimelineEntriesForDay } from "../timelineRepository";
import type { StrengthExercise } from "../../types/strength";

const exercise: StrengthExercise = {
  exerciseId: "user-selected-id", name: "My bench press", labelConfirmed: true,
  movementProfile: "non_explosive", movementProfileSource: "name-rule",
  externalLoadKg: 40, sets: 3, reps: 10, rpe: 8, percent1RM: 65, notes: "Warmup done",
};
let h: ReturnType<typeof createSqliteHarness>;
beforeEach(async () => { h = createSqliteHarness(); await migrateDatabase(h.db); });
afterEach(() => h.close());

test("fresh migration creates a valid version 10 schema and upgrades v9 without losing existing records", async () => {
  expect(h.connection.prepare("PRAGMA user_version").get()).toEqual({ user_version: 10 });
  expect(h.connection.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  // Roll just the new empty tables back in this disposable test database to model v9.
  h.connection.exec(`DROP TABLE strength_exercise_adaptation_scores; DROP TABLE strength_adaptation_scores;
    DROP TABLE strength_log_exercises; DROP TABLE strength_logs;
    DROP TABLE strength_template_exercises; DROP TABLE strength_session_templates;
    PRAGMA user_version = 9;
    INSERT INTO timeline_entries (id, kind, title, start_at, status, created_at, updated_at)
    VALUES (99, 'meal', 'Existing meal', 100, 'completed', 100, 100);`);
  await migrateDatabase(h.db);
  expect(h.connection.prepare("SELECT title FROM timeline_entries WHERE id = 99").get()).toEqual({ title: "Existing meal" });
  expect(h.connection.prepare("PRAGMA user_version").get()).toEqual({ user_version: 10 });
  await migrateDatabase(h.db); // Reopening version 10 must be a no-op.
});

test("templates create no timeline entries; updates preserve identity and duplicate exercise order", async () => {
  const template = await createStrengthTemplate(h.db, { title: "  Upper  ", exercises: [exercise, { ...exercise, sets: 5 }] });
  expect(h.connection.prepare("SELECT * FROM timeline_entries").all()).toEqual([]);
  expect((await getStrengthTemplate(h.db, template.id))?.exercises.map(e => e.sets)).toEqual([3, 5]);
  await updateStrengthTemplate(h.db, template.id, { title: "Edited", exercises: [{ ...exercise, reps: 12 }] });
  const templates = await listStrengthTemplates(h.db);
  expect(templates).toHaveLength(1);
  expect(templates[0]).toMatchObject({ id: template.id, title: "Edited", exercises: [{ reps: 12 }] });
});

test("historical prescription and scores survive template changes and deletion", async () => {
  const template = await createStrengthTemplate(h.db, { title: "Upper", exercises: [exercise, exercise] });
  const id = await logCompletedStrengthSession(h.db, { ...template, startAt: 100, sourceTemplateId: template.id });
  const before = await getStrengthSessionByTimelineEntryId(h.db, id);
  await updateStrengthTemplate(h.db, template.id, { title: "Changed", exercises: [{ ...exercise, externalLoadKg: 500 }] });
  expect(await getStrengthSessionByTimelineEntryId(h.db, id)).toEqual(before);
  const row = h.connection.prepare("SELECT * FROM timeline_entries WHERE id = ?").get(id);
  expect(row).toMatchObject({ kind: "strength", title: "Upper", start_at: 100, end_at: null, status: "completed", notes: null });
  const stored = h.connection.prepare("SELECT * FROM strength_log_exercises WHERE timeline_entry_id = ?").all(id);
  expect(stored).toHaveLength(2);
  expect(stored[0]).toMatchObject({ body_parts_json: "[]", target_muscles_json: "[]", secondary_muscles_json: "[]", equipments_json: "[]" });
  h.connection.prepare("DELETE FROM strength_session_templates WHERE id = ?").run(template.id);
  expect(h.connection.prepare("SELECT * FROM strength_template_exercises").all()).toEqual([]);
  expect((await getStrengthSessionByTimelineEntryId(h.db, id))?.sourceTemplateId).toBeNull();
  h.connection.prepare("DELETE FROM timeline_entries WHERE id = ?").run(id);
  for (const table of ["strength_logs", "strength_log_exercises", "strength_adaptation_scores", "strength_exercise_adaptation_scores"])
    expect(h.connection.prepare(`SELECT * FROM ${table}`).all()).toEqual([]);
});

test("a late score-write failure rolls back the entire session; template update failure rolls back too", async () => {
  const template = await createStrengthTemplate(h.db, { title: "Upper", exercises: [exercise] });
  h.failOn(/INSERT INTO strength_exercise_adaptation_scores/);
  await expect(logCompletedStrengthSession(h.db, { ...template, startAt: 100 })).rejects.toThrow("Injected");
  expect(h.connection.prepare("SELECT * FROM timeline_entries").all()).toEqual([]);
  expect(h.connection.prepare("SELECT * FROM strength_logs").all()).toEqual([]);
  h.failOn(/INSERT INTO strength_template_exercises/);
  await expect(updateStrengthTemplate(h.db, template.id, { title: "Changed", exercises: [exercise] })).rejects.toThrow("Injected");
  expect(await getStrengthTemplate(h.db, template.id)).toEqual(template);
});

test("enforces foreign keys and constraints in SQLite", async () => {
  expect(() => h.connection.exec("INSERT INTO strength_logs (timeline_entry_id) VALUES (987)")).toThrow();
  const id = await logCompletedStrengthSession(h.db, { title: "Upper", exercises: [exercise], startAt: 100 });
  expect(() => h.connection.prepare("UPDATE strength_log_exercises SET external_load_kg = -1 WHERE timeline_entry_id = ?").run(id)).toThrow();
  expect(() => h.connection.prepare("UPDATE strength_log_exercises SET sets = 1.5 WHERE timeline_entry_id = ?").run(id)).toThrow();
  expect(() => h.connection.prepare("UPDATE strength_adaptation_scores SET power_score = 101 WHERE timeline_entry_id = ?").run(id)).toThrow();
});

test("range queries are start-inclusive/end-exclusive; day timeline retains every kind", async () => {
  const id = await logCompletedStrengthSession(h.db, { title: "Upper", exercises: [exercise], startAt: 100 });
  expect(await getStrengthSessionsForRange(h.db, 100, 101)).toHaveLength(1);
  expect(await getStrengthSessionsForRange(h.db, 0, 100)).toEqual([]);
  expect(await getStrengthSessionByTimelineEntryId(h.db, id + 1)).toBeNull();
  h.connection.exec(`INSERT INTO timeline_entries (kind, title, start_at, status, created_at, updated_at)
    VALUES ('meal', 'Lunch', 101, 'completed', 1, 1), ('skill', 'Practice', 102, 'completed', 1, 1),
    ('conditioning', 'Intervals', 103, 'completed', 1, 1), ('sleep', 'Nap', 104, 'completed', 1, 1),
    ('weight', 'Weight', 105, 'completed', 1, 1);`);
  const entries = await getTimelineEntriesForDay(h.db, 0, 1000);
  expect(entries.map(e => e.kind)).toEqual(["strength", "meal", "skill", "conditioning", "sleep", "weight"]);
  expect(entries[0].strength).toEqual({ primaryAdaptation: "hypertrophy", evidence: "full" });
  expect(entries[1].strength).toBeNull();
});
