import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

import { formatLocalDate } from "../src/conditioning/dates.ts";
import { searchExercises } from "../src/strength/catalog.ts";
import { CATALOG_SEED } from "../src/strength/catalogSeed.ts";
import {
  addCatalogExercise,
  applyRepeat,
  createLogDraft,
  customizeSet,
  draftFromTemplate,
  projectTemplateDraft,
  resizeSets,
  saveWorkoutConsequence,
  setLoadMode,
  updateExercise,
  updateSet,
  validateStrengthDraft,
} from "../src/strength/drafts.ts";
import {
  estimateDraftDurationSeconds,
  formatDurationSeconds,
  sessionStartMs,
} from "../src/strength/duration.ts";
import {
  PRIMARY_LEAD_MINIMUM,
  PRIMARY_SCORE_MINIMUM,
  emphasisFromDraft,
  emphasisHeadline,
  emphasisMarkerColor,
  estimateStrengthEmphasis,
  strengthQualityColors,
} from "../src/strength/emphasis.ts";
import { formatLoadAmount } from "../src/strength/units.ts";
import { migrateDatabase } from "../src/data/database.ts";
import {
  createCustomExercise,
  createStrengthTemplate,
  getStrengthSession,
  getStrengthTemplate,
  listStrengthExercises,
  listStrengthSessionsForDates,
  listStrengthTemplates,
  logStrengthSession,
} from "../src/data/strengthRepository.ts";
import { timelineCategories } from "../src/constants/timelineCategories.ts";
import { appColorPalette } from "../src/theme/theme.ts";

function adapterFor(db) {
  return {
    async execAsync(sql) {
      db.exec(sql);
    },
    async getFirstAsync(sql, params = []) {
      return db.prepare(sql).get(...params) ?? null;
    },
    async getAllAsync(sql, params = []) {
      return db.prepare(sql).all(...params);
    },
    async runAsync(sql, params = []) {
      const result = db.prepare(sql).run(...params);
      return {
        changes: Number(result.changes),
        lastInsertRowId: Number(result.lastInsertRowid),
      };
    },
    async withTransactionAsync(task) {
      db.exec("BEGIN");
      try {
        await task();
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

function findSeed(query) {
  const result = searchExercises(CATALOG_SEED, query, 5);
  assert.ok(result.total > 0, query);
  return result.matches[0];
}

function loaded(draft, exercise, options) {
  return updateExercise(draft, exercise.id, (current) => {
    let next = options.mode ? setLoadMode(current, options.mode) : current;
    if (options.explosive != null) {
      next = { ...next, explosiveIntent: options.explosive };
    }
    next = applyRepeat(next, {
      assistanceKg: options.assistanceKg ?? null,
      loadKg: options.loadKg ?? null,
      reps: options.reps,
      restSeconds: options.restSeconds === undefined ? null : options.restSeconds,
      rpe: options.rpe === undefined ? null : options.rpe,
    });
    next = resizeSets(next, options.sets ?? 1);
    return next;
  });
}

function benchDraft(now, options = {}) {
  const exercise = findSeed("bench press");
  let draft = createLogDraft(now, options.sessionId);
  draft = { ...draft, title: options.title ?? "Bench day" };
  draft = addCatalogExercise(draft, exercise);
  const added = draft.exercises[0];
  return loaded(draft, added, {
    loadKg: options.loadKg ?? 100,
    reps: options.reps ?? 5,
    restSeconds: options.restSeconds === undefined ? 120 : options.restSeconds,
    rpe: options.rpe ?? null,
    sets: options.sets ?? 3,
    explosive: options.explosive ?? false,
  });
}

assert.equal(PRIMARY_SCORE_MINIMUM, 60);
assert.equal(PRIMARY_LEAD_MINIMUM, 15);
assert.equal(searchExercises(CATALOG_SEED, "rdl", 5).matches[0].name, "Romanian Deadlift");
assert.equal(searchExercises(CATALOG_SEED, "ohp", 5).matches[0].name, "Overhead Press");
assert.ok(searchExercises(CATALOG_SEED, "farmer", 5).matches.some((row) => row.name === "Farmer Carry"));
assert.ok(searchExercises(CATALOG_SEED, "pull up", 5).matches.some((row) => row.name === "Pull-Up"));
assert.ok(searchExercises(CATALOG_SEED, "power clean", 5).matches.some((row) => row.name === "Power Clean"));
assert.equal(findSeed("assisted pull").defaultLoadMode, "assisted");
assert.equal(findSeed("box jump").suggestsExplosive, true);
assert.equal(findSeed("pistol").defaultUnilateral, true);
assert.equal(searchExercises(CATALOG_SEED, "zzzz-not-a-lift", 12).total, 0);
assert.equal(searchExercises(CATALOG_SEED, "", 12).matches.length, 12);
assert.ok(searchExercises(CATALOG_SEED, "", 12).total > 12);

const zeroRest = benchDraft(0, { sets: 2, reps: 5, restSeconds: 0 });
assert.equal(estimateDraftDurationSeconds(zeroRest.exercises), 30);
const missingRest = benchDraft(0, { sets: 2, reps: 5, restSeconds: null });
assert.equal(estimateDraftDurationSeconds(missingRest.exercises), 120);
assert.equal(estimateDraftDurationSeconds([]), null);
assert.equal(formatDurationSeconds(90), "1m 30s");

const skipped = updateExercise(missingRest, missingRest.exercises[0].id, (exercise) =>
  updateSet(exercise, exercise.sets[0].id, (set) => ({ ...set, skipped: true })),
);
assert.equal(estimateDraftDurationSeconds(skipped.exercises), 15);

const overnight = benchDraft(0, { sets: 10, reps: 10, restSeconds: null });
const overnightSeconds = estimateDraftDurationSeconds(overnight.exercises);
assert.equal(overnightSeconds, 1110);
const endedAt = new Date(2026, 10, 15, 0, 10, 0, 0).getTime();
const startedAt = sessionStartMs(endedAt, overnightSeconds);
assert.equal(formatLocalDate(new Date(endedAt)), "2026-11-15");
assert.equal(formatLocalDate(new Date(startedAt)), "2026-11-14");

function emphasisFor(draft, references = new Map()) {
  return emphasisFromDraft(draft.exercises, references);
}

const noReference = benchDraft(0, { sets: 5, reps: 3, loadKg: 100 });
const unknownStrength = emphasisFor(noReference);
assert.equal(unknownStrength.qualities.strength.score, null);
assert.equal(unknownStrength.qualities.power.score, null);
assert.equal(unknownStrength.primary, null);
assert.equal(unknownStrength.tie, false);
assert.equal(emphasisHeadline(unknownStrength), "Not enough evidence");

const heavy = emphasisFor(noReference, new Map([[noReference.exercises[0].catalogExerciseId, { kg: 100, kind: "load" }]]));
assert.equal(heavy.qualities.strength.score, 90);
assert.equal(heavy.primary, "strength");
assert.equal(emphasisMarkerColor(heavy), strengthQualityColors.strength);

const hypertrophy = benchDraft(0, { sets: 10, reps: 10, loadKg: 60, rpe: 8 });
const hypertrophyResult = emphasisFor(hypertrophy);
assert.equal(hypertrophyResult.qualities.hypertrophy.score, 100);
assert.equal(hypertrophyResult.primary, "hypertrophy");
assert.equal(emphasisMarkerColor(hypertrophyResult), strengthQualityColors.hypertrophy);

const power = benchDraft(0, { sets: 5, reps: 3, loadKg: 60, explosive: true });
const powerResult = emphasisFor(power);
assert.equal(powerResult.qualities.power.score, 88);
assert.equal(powerResult.qualities.strength.score, null);
assert.equal(powerResult.primary, "power");
assert.equal(emphasisMarkerColor(powerResult), strengthQualityColors.power);

const endurance = benchDraft(0, { sets: 6, reps: 40, loadKg: 20, restSeconds: 30 });
const enduranceResult = emphasisFor(endurance);
assert.equal(enduranceResult.qualities.muscular_endurance.score, 95);
assert.equal(enduranceResult.qualities.hypertrophy.score, null);
assert.equal(enduranceResult.primary, "muscular_endurance");
assert.equal(emphasisMarkerColor(enduranceResult), strengthQualityColors.muscular_endurance);

const mixed = benchDraft(0, { sets: 5, reps: 3, loadKg: 100, explosive: true });
const mixedResult = emphasisFor(
  mixed,
  new Map([[mixed.exercises[0].catalogExerciseId, { kg: 100, kind: "load" }]]),
);
assert.equal(mixedResult.qualities.strength.score, 90);
assert.equal(mixedResult.qualities.power.score, 88);
assert.equal(mixedResult.primary, null);
assert.equal(mixedResult.tie, true);
assert.equal(emphasisHeadline(mixedResult), "Mixed focus");
assert.equal(emphasisMarkerColor(mixedResult), "#9EA4B0");

const lowVolume = benchDraft(0, { sets: 1, reps: 10, loadKg: 50 });
const lowVolumeResult = emphasisFor(lowVolume);
assert.equal(lowVolumeResult.qualities.hypertrophy.score, 40);
assert.equal(lowVolumeResult.primary, null);
assert.equal(lowVolumeResult.tie, false);

const skippedEvidence = updateExercise(heavy && noReference, noReference.exercises[0].id, (exercise) => {
  const customized = customizeSet(exercise, exercise.sets[0].id);
  return updateSet(customized, customized.sets[0].id, (set) => ({
    ...set,
    reps: 20,
    skipped: true,
  }));
});
const skippedResult = estimateStrengthEmphasis(
  skippedEvidence.exercises.map((exercise) => ({
    explosiveIntent: true,
    loadMode: exercise.loadMode,
    reference: { kg: 100, kind: "load" },
    sets: exercise.sets.map((set, index) =>
      index === 0 ? set : { ...set, warmup: index === 1 },
    ),
  })),
);
assert.equal(skippedResult.qualities.power.supportingSets < skippedResult.workSets + 2, true);
assert.ok(skippedResult.workSets < noReference.exercises[0].sets.length);

const blank = createLogDraft(1_000);
assert.equal(validateStrengthDraft(blank, "log", 1_000), "Enter a workout title.");
const pullupDraft = (() => {
  let draft = { ...createLogDraft(1_000), title: "Pull-ups" };
  draft = addCatalogExercise(draft, findSeed("pull-up"));
  return draft;
})();
assert.equal(validateStrengthDraft(pullupDraft, "log", 1_000), null);
const assisted = updateExercise(pullupDraft, pullupDraft.exercises[0].id, (exercise) =>
  setLoadMode(exercise, "assisted"),
);
assert.equal(validateStrengthDraft(assisted, "log", 1_000), "Enter assistance.");
assert.equal(validateStrengthDraft({ ...pullupDraft, endedAt: 5_000 }, "log", 1_000), "Choose an end time that is not in the future.");
assert.match(formatLoadAmount(100, "imperial"), /220\.5 lb/);
assert.equal(
  saveWorkoutConsequence({ ...pullupDraft, sourceTemplateId: "tpl", saveAsTemplate: false }),
  "Logging with this off removes the saved workout from your list, and the session you log still stays on your calendar.",
);

const fresh = new DatabaseSync(":memory:");
const db = adapterFor(fresh);
await migrateDatabase(db);
assert.equal(fresh.prepare("PRAGMA user_version").get().user_version, 8);
assert.equal(
  fresh.prepare("SELECT COUNT(*) AS count FROM strength_exercises").get().count,
  CATALOG_SEED.length,
);
const stored = await listStrengthExercises(db);
assert.equal(searchExercises(stored, "rdl", 3).matches[0].upstreamId, "Romanian_Deadlift");
await migrateDatabase(db);
assert.equal(
  fresh.prepare("SELECT COUNT(*) AS count FROM strength_exercises").get().count,
  CATALOG_SEED.length,
);

const custom = await createCustomExercise(db, " Sandbag carry ");
assert.equal(custom.name, "Sandbag carry");
assert.equal(custom.source, "custom");

const templateDraft = benchDraft(0, { title: "Saved bench" });
const templateId = await createStrengthTemplate(db, templateDraft);
assert.equal(fresh.prepare("SELECT COUNT(*) AS count FROM timeline_entries WHERE kind = 'strength'").get().count, 0);
assert.equal((await listStrengthTemplates(db)).length, 1);
const template = await getStrengthTemplate(db, templateId);
assert.equal(template.exercises[0].sets.length, 3);
assert.equal(template.exercises[0].sets[0].loadKg, 100);

const logNow = endedAt;
const fromSaved = draftFromTemplate(template, logNow);
assert.equal(fromSaved.saveAsTemplate, true);
assert.equal(fromSaved.sourceTemplateId, templateId);
const firstLog = await logStrengthSession(db, { ...fromSaved, saveAsTemplate: false }, { now: logNow + 1, timeZone: "UTC" });
assert.equal(firstLog.alreadySaved, false);
const session = await getStrengthSession(db, firstLog.sessionId);
assert.equal(session.localEndDate, "2026-11-15");
assert.equal(session.startedAt, sessionStartMs(logNow, session.durationSeconds));
assert.equal(formatLocalDate(new Date(session.startedAt)), "2026-11-15");
const overnightLog = await logStrengthSession(
  db,
  { ...overnight, endedAt: logNow, title: "Late squat" },
  { now: logNow + 1, timeZone: "UTC" },
);
const overnightSession = await getStrengthSession(db, overnightLog.sessionId);
assert.equal(overnightSession.localEndDate, "2026-11-15");
assert.equal(formatLocalDate(new Date(overnightSession.startedAt)), "2026-11-14");
assert.equal(overnightSession.durationSeconds, 1110);
assert.equal(session.exercises[0].name, "Bench Press");
assert.equal(session.timelineEntryId > 0, true);
assert.equal((await listStrengthTemplates(db)).length, 0);
const archived = await getStrengthTemplate(db, templateId);
assert.ok(archived.archivedAt);

fresh.prepare("UPDATE strength_exercises SET name = ? WHERE id = ?").run(
  "Renamed Bench",
  session.exercises[0].catalogExerciseId,
);
const reread = await getStrengthSession(db, session.id);
assert.equal(reread.exercises[0].name, "Bench Press");
fresh.prepare("DELETE FROM strength_templates WHERE id = ?").run(templateId);
assert.equal((await getStrengthSession(db, session.id)).sourceTemplateId, templateId);

const replay = await logStrengthSession(
  db,
  { ...fromSaved, saveAsTemplate: false, title: "Should not rewrite" },
  { now: logNow + 1, timeZone: "UTC" },
);
assert.equal(replay.alreadySaved, true);
assert.equal(fresh.prepare("SELECT COUNT(*) AS count FROM strength_sessions").get().count, 2);
assert.equal(fresh.prepare("SELECT COUNT(*) AS count FROM timeline_entries WHERE kind = 'strength'").get().count, 2);
assert.equal((await getStrengthSession(db, session.id)).title, "Saved bench");

const updateSource = await createStrengthTemplate(db, benchDraft(0, { title: "Update me", sessionId: "template-draft" }));
let updating = draftFromTemplate(await getStrengthTemplate(db, updateSource), logNow - 86_400_000);
updating = { ...updating, title: "Updated title", saveAsTemplate: true };
await logStrengthSession(db, updating, { now: logNow, timeZone: "UTC" });
assert.equal((await getStrengthTemplate(db, updateSource)).title, "Updated title");
assert.equal((await listStrengthTemplates(db)).some((row) => row.id === updateSource), true);

const rollbackTemplate = await createStrengthTemplate(
  db,
  benchDraft(0, { title: "Keep me", sessionId: "rollback-template" }),
);
const rollbackDraft = draftFromTemplate(await getStrengthTemplate(db, rollbackTemplate), logNow - 3_600_000);
await assert.rejects(
  () =>
    logStrengthSession(db, { ...rollbackDraft, saveAsTemplate: false }, {
      beforeCommit: () => {
        throw new Error("fail the write");
      },
      now: logNow,
      timeZone: "UTC",
    }),
  /fail the write/,
);
assert.equal((await getStrengthTemplate(db, rollbackTemplate)).archivedAt, null);
assert.equal(await getStrengthSession(db, rollbackDraft.sessionId), null);
const timelineCount = fresh.prepare("SELECT COUNT(*) AS count FROM timeline_entries WHERE kind = 'strength'").get().count;
await assert.rejects(
  () => logStrengthSession(db, { ...rollbackDraft, endedAt: logNow + 60_000 }, { now: logNow, timeZone: "UTC" }),
  /not in the future/,
);
assert.equal(
  fresh.prepare("SELECT COUNT(*) AS count FROM timeline_entries WHERE kind = 'strength'").get().count,
  timelineCount,
);

const month = await listStrengthSessionsForDates(db, "2026-11-01", "2026-11-30");
assert.ok(month.some((row) => row.localEndDate === "2026-11-15"));
assert.equal(timelineCategories.strength.color, appColorPalette.red);
assert.notEqual(strengthQualityColors.strength, timelineCategories.strength.color);
assert.notEqual(strengthQualityColors.hypertrophy, timelineCategories.strength.color);

const upgradeDb = new DatabaseSync(":memory:");
upgradeDb.exec(`
  CREATE TABLE timeline_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    start_at INTEGER NOT NULL,
    end_at INTEGER,
    status TEXT NOT NULL DEFAULT 'planned',
    notes TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE nutrition_workspace (id TEXT PRIMARY KEY);
  PRAGMA user_version = 7;
`);
const upgrade = adapterFor(upgradeDb);
await migrateDatabase(upgrade);
assert.equal(upgradeDb.prepare("PRAGMA user_version").get().user_version, 8);
assert.ok(upgradeDb.prepare("SELECT name FROM sqlite_master WHERE name = 'strength_sessions'").get());
assert.ok(upgradeDb.prepare("SELECT name FROM sqlite_master WHERE name = 'timeline_entries'").get());
assert.equal(
  upgradeDb.prepare("SELECT COUNT(*) AS count FROM strength_exercises").get().count,
  CATALOG_SEED.length,
);

const projected = projectTemplateDraft(fromSaved);
assert.equal(projected.exercises.length, 1);
console.log("strength checks passed");
