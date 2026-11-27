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
  defaultStrengthSessionTime,
  draftFromTemplate,
  getStrengthTarget,
  matchSetToRepeat,
  projectTemplateDraft,
  resizeSets,
  saveWorkoutConsequence,
  setLoadMode,
  setStrengthTarget,
  tableField,
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
  STRENGTH_EMPHASIS_VERSION,
  emphasisFromDraft,
  emphasisHeadline,
  emphasisMarkerColor,
  estimateStrengthEmphasis,
  strengthQualityColors,
} from "../src/strength/emphasis.ts";
import { formatLoadAmount } from "../src/strength/units.ts";
import { migrateDatabase } from "../src/data/database.ts";
import { strengthMigrationSql } from "../src/data/strengthMigration.ts";
import {
  archiveStrengthTemplate,
  createCustomExercise,
  createStrengthTemplate,
  getStrengthSession,
  getStrengthTemplate,
  listSameLiftReferences,
  listStrengthExercises,
  listStrengthSessionsForDates,
  listStrengthTemplates,
  logStrengthSession,
  saveStrengthTemplate,
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

const searchFixture = [
  { id: "tokens", name: "Press", aliases: ["Upward"] },
  { id: "contains", name: "Single Press-Up", aliases: [] },
  { id: "alias", name: "Floor Exercise", aliases: ["Press Up"] },
  { id: "prefix-b", name: "Press-Up Set", aliases: [] },
  { id: "prefix-a", name: "Press-Up set", aliases: [] },
];
const rankedSearch = searchExercises(searchFixture, " PRESS__up ", 4);
assert.deepEqual(
  rankedSearch.matches.map((row) => row.id),
  ["prefix-a", "prefix-b", "alias", "contains"],
);
assert.equal(rankedSearch.total, 5);

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
const repeatedExercise = zeroRest.exercises[0];
const flagSet = {
  ...repeatedExercise.sets[0],
  followsRepeat: false,
  reps: 1,
  skipped: true,
  warmup: true,
};
const flagExercise = { ...repeatedExercise, sets: [flagSet, repeatedExercise.sets[1]] };
const restored = matchSetToRepeat(flagExercise, flagSet.id);
assert.deepEqual(restored.sets[0], {
  ...repeatedExercise.repeat,
  followsRepeat: true,
  id: flagSet.id,
  skipped: false,
  warmup: false,
});
const repsText = (set) => String(set.reps);
assert.equal(tableField([], repsText), "--");
assert.equal(tableField(restored.sets, repsText), "5");
assert.equal(tableField(flagExercise.sets, repsText), "Mixed");
for (const [reps, repRange] of [[1, "1-3"], [5, "3-5"], [8, "6-8"], [21, "20+"]]) {
  const { exercises } = benchDraft(0, { reps });
  assert.equal(getStrengthTarget(exercises[0]).repRange, repRange);
}

const overnight = benchDraft(0, { sets: 10, reps: 10, restSeconds: null });
const overnightSeconds = estimateDraftDurationSeconds(overnight.exercises);
assert.equal(overnightSeconds, 1110);
const endedAt = new Date(2026, 10, 15, 0, 10, 0, 0).getTime();
const startedAt = sessionStartMs(endedAt, overnightSeconds);
assert.equal(formatLocalDate(new Date(endedAt)), "2026-11-15");
assert.equal(formatLocalDate(new Date(startedAt)), "2026-11-14");

function emphasisFor(draft, references = new Map()) {
  return emphasisFromDraft(draft.exercises, references, draft.sessionMode);
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
assert.equal(validateStrengthDraft(assisted, "log", 1_000), null);
assert.match(validateStrengthDraft({ ...pullupDraft, endedAt: 5_000 }, "log", 1_000), /end time.*not in the future/);
assert.match(formatLoadAmount(100, "imperial"), /220\.5 lb/);
assert.equal(
  saveWorkoutConsequence({ ...pullupDraft, sourceTemplateId: "tpl", saveAsTemplate: false }),
  "Logging with this off removes the saved workout from your list, and the session you log still stays on your calendar.",
);

const fresh = new DatabaseSync(":memory:");
const db = adapterFor(fresh);
await migrateDatabase(db);
assert.equal(fresh.prepare("PRAGMA user_version").get().user_version, 12);
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
assert.equal(upgradeDb.prepare("PRAGMA user_version").get().user_version, 12);
assert.ok(upgradeDb.prepare("SELECT name FROM sqlite_master WHERE name = 'strength_sessions'").get());
assert.ok(upgradeDb.prepare("SELECT name FROM sqlite_master WHERE name = 'timeline_entries'").get());
assert.equal(
  upgradeDb.prepare("SELECT COUNT(*) AS count FROM strength_exercises").get().count,
  CATALOG_SEED.length,
);

const projected = projectTemplateDraft(fromSaved);
assert.equal(projected.exercises.length, 1);

const bench = findSeed("bench press");
const historyOptions = { now: 100_000, timeZone: "UTC" };
const referenceAt = async (cutoff) =>
  (await listSameLiftReferences(db, [bench.id, "", bench.id], cutoff)).get(bench.id);
await logStrengthSession(
  db,
  benchDraft(10_000, { sessionId: "history-a", loadKg: 150 }),
  historyOptions,
);
const tied = benchDraft(10_000, { sessionId: "history-z", loadKg: 100, sets: 4 });
const partial = updateExercise(tied, tied.exercises[0].id, (exercise) => ({
  ...exercise,
  sets: [
    { ...exercise.sets[0], warmup: true, loadKg: 160 },
    { ...exercise.sets[1], skipped: true, loadKg: 180 },
    exercise.sets[2],
    { ...exercise.sets[3], loadKg: 110, reps: 6, restSeconds: 0, rpe: 7 },
  ],
}));
const savedPartial = await logStrengthSession(
  db,
  { ...partial, saveAsTemplate: true },
  historyOptions,
);
const [[performed], [prescribed]] = await Promise.all([
  getStrengthSession(db, savedPartial.sessionId).then((record) => record.exercises),
  getStrengthTemplate(db, savedPartial.templateId).then((record) => record.exercises),
]);
assert.deepEqual(
  performed.sets.map(({ position, skipped, warmup }) => [position, skipped, warmup]),
  [[0, false, true], [1, true, false], [2, false, false], [3, false, false]],
);
assert.deepEqual(
  prescribed.sets.map(({ position, loadKg, reps, restSeconds, rpe }) => [position, loadKg, reps, restSeconds, rpe]),
  [[0, 100, 5, 120, null], [1, 110, 6, 0, 7]],
);
assert.equal(await referenceAt(10_000), undefined);
assert.deepEqual(await referenceAt(10_001), { kind: "load", kg: 110 });

let mixedModes = benchDraft(20_000, { sessionId: "history-mixed", sets: 1 });
mixedModes = updateExercise(mixedModes, mixedModes.exercises[0].id, (exercise) => ({
  ...exercise,
  sets: [{ ...exercise.sets[0], skipped: true }],
}));
mixedModes = addCatalogExercise(mixedModes, bench);
mixedModes = loaded(mixedModes, mixedModes.exercises[1], {
  mode: "assisted",
  assistanceKg: 30,
  reps: 5,
  sets: 2,
});
mixedModes = updateExercise(mixedModes, mixedModes.exercises[1].id, (exercise) =>
  updateSet(exercise, exercise.sets[1].id, (set) => ({ ...set, assistanceKg: 20 })),
);
mixedModes = addCatalogExercise(mixedModes, bench);
mixedModes = loaded(mixedModes, mixedModes.exercises[2], { loadKg: 200, reps: 5 });
await logStrengthSession(db, mixedModes, historyOptions);
const bodyweight = benchDraft(30_000, { sessionId: "history-no-load" });
await logStrengthSession(
  db,
  loaded(bodyweight, bodyweight.exercises[0], { mode: "bodyweight", reps: 10 }),
  historyOptions,
);
assert.deepEqual(await referenceAt(40_000), { kind: "assistance", kg: 20 });

// Missing load stays unknown; explicitly invalid entered values never reach SQLite.
const omittedLoad = addCatalogExercise({ ...createLogDraft(1_000), title: "Without load" }, findSeed("bench press"));
assert.equal(validateStrengthDraft(omittedLoad, "log", 1_000), null);
for (const invalid of [0, -1, NaN, Infinity]) {
  const invalidDraft = updateExercise(omittedLoad, omittedLoad.exercises[0].id, (exercise) =>
    updateSet(exercise, exercise.sets[0].id, (set) => ({ ...set, loadKg: invalid })));
  assert.ok(validateStrengthDraft(invalidDraft, "log", 1_000));
}
const unknownLoadFocus = emphasisFromDraft(omittedLoad.exercises, new Map([[omittedLoad.exercises[0].catalogExerciseId, { kind: "load", kg: 100 }]]));
assert.equal(unknownLoadFocus.qualities.strength.score, null);
const omittedLog = await logStrengthSession(db, { ...omittedLoad, saveAsTemplate: true }, { now: 1_000, timeZone: "UTC" });
const omittedRecord = await getStrengthSession(db, omittedLog.sessionId);
assert.equal(omittedRecord.exercises[0].sets[0].loadKg, null);
assert.equal(omittedRecord.exercises[0].sets[0].assistanceKg, null);
const omittedTemplate = await getStrengthTemplate(db, omittedLog.templateId);
assert.equal(omittedTemplate.exercises[0].sets[0].loadKg, null);
const retainedId = await saveStrengthTemplate(db, { ...omittedLoad, sourceTemplateId: omittedLog.templateId, title: "Updated reusable workout" });
assert.equal(retainedId, omittedLog.templateId);
assert.equal((await getStrengthTemplate(db, retainedId)).title, "Updated reusable workout");
assert.equal((await getStrengthSession(db, omittedLog.sessionId)).title, "Without load");
await archiveStrengthTemplate(db, omittedLog.templateId);
await archiveStrengthTemplate(db, omittedLog.templateId);
assert.ok(!(await listStrengthTemplates(db)).some((row) => row.id === omittedLog.templateId));
assert.ok((await getStrengthTemplate(db, omittedLog.templateId)).archivedAt != null);
assert.equal((await getStrengthSession(db, omittedLog.sessionId)).sourceTemplateId, omittedLog.templateId);
assert.equal((await getStrengthSession(db, omittedLog.sessionId)).exercises[0].sets[0].reps, 5);

// Reusing the same UI draft across Save/Unsave/Save must not reuse archived snapshot IDs.
const toggleDraft = addCatalogExercise({ ...createLogDraft(50_000), title: "Toggle workout" }, findSeed("bench press"));
const firstToggleId = await saveStrengthTemplate(db, toggleDraft);
await archiveStrengthTemplate(db, firstToggleId);
const secondToggleId = await saveStrengthTemplate(db, toggleDraft);
assert.notEqual(secondToggleId, firstToggleId);
const firstToggleSnapshot = await getStrengthTemplate(db, firstToggleId);
const secondToggleSnapshot = await getStrengthTemplate(db, secondToggleId);
assert.notEqual(firstToggleSnapshot.exercises[0].id, secondToggleSnapshot.exercises[0].id);
assert.notEqual(firstToggleSnapshot.exercises[0].sets[0].id, secondToggleSnapshot.exercises[0].sets[0].id);
const secondToggleDraft = { ...toggleDraft, sourceTemplateId: secondToggleId, saveAsTemplate: true };
const toggleLog = await logStrengthSession(db, secondToggleDraft, { now: 50_000, timeZone: "UTC" });
assert.equal(toggleLog.templateId, secondToggleId);
assert.equal((await getStrengthSession(db, toggleLog.sessionId)).exercises[0].id, toggleDraft.exercises[0].id);
const failingTemplateDb = { ...db, async runAsync(sql, params) {
  if (sql.includes("INSERT INTO strength_template_sets")) throw new Error("fail template write");
  return db.runAsync(sql, params);
} };
await assert.rejects(() => saveStrengthTemplate(failingTemplateDb, { ...secondToggleDraft, title: "Must roll back" }), /fail template write/);
assert.equal((await getStrengthTemplate(db, secondToggleId)).title, "Toggle workout");
assert.equal((await getStrengthTemplate(db, secondToggleId)).exercises[0].sets.length, 1);
assert.equal(await saveStrengthTemplate(db, { ...secondToggleDraft, title: "Retry saved" }), secondToggleId);
assert.equal((await getStrengthTemplate(db, secondToggleId)).title, "Retry saved");
assert.equal((await getStrengthSession(db, toggleLog.sessionId)).title, "Toggle workout");

// Explicit Save/Unsave workflows log their current draft without silently editing templates.
const explicitSourceId = await createStrengthTemplate(db, benchDraft(0, { title: "Explicit save source" }));
const explicitBefore = await getStrengthTemplate(db, explicitSourceId);
let explicitDraft = draftFromTemplate(explicitBefore, 70_000);
explicitDraft = { ...explicitDraft, title: "Edited log only" };
explicitDraft = updateExercise(explicitDraft, explicitDraft.exercises[0].id, (exercise) =>
  applyRepeat(exercise, { ...exercise.repeat, reps: 7 }));
const explicitLog = await logStrengthSession(db, explicitDraft, { now: 70_000, timeZone: "UTC", persistTemplate: false });
assert.equal(explicitLog.templateId, explicitSourceId);
assert.deepEqual(await getStrengthTemplate(db, explicitSourceId), explicitBefore);
assert.equal((await getStrengthSession(db, explicitLog.sessionId)).title, "Edited log only");
assert.equal((await getStrengthSession(db, explicitLog.sessionId)).exercises[0].sets[0].reps, 7);
const noArchiveDraft = { ...draftFromTemplate(explicitBefore, 80_000), saveAsTemplate: false };
await logStrengthSession(db, noArchiveDraft, { now: 80_000, timeZone: "UTC", persistTemplate: false });
assert.deepEqual(await getStrengthTemplate(db, explicitSourceId), explicitBefore);
const templateCountBeforeExplicitLog = (await listStrengthTemplates(db)).length;
for (const saveAsTemplate of [false, true]) {
  const explicitFreeDraft = { ...benchDraft(90_000), saveAsTemplate };
  const explicitFreeLog = await logStrengthSession(db, explicitFreeDraft, { now: 90_000, timeZone: "UTC", persistTemplate: false });
  assert.equal(explicitFreeLog.templateId, null);
  assert.equal((await listStrengthTemplates(db)).length, templateCountBeforeExplicitLog);
}

// Future workouts are grouped by their selected start and store targets without performed sets.
const plannedStart = new Date(2026, 10, 27, 23, 55).getTime();
const plannedOptions = {
  now: plannedStart - 60_000,
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  persistTemplate: false,
};
assert.equal(defaultStrengthSessionTime("planned", plannedStart + 41_000), plannedStart + 3_600_000);
const planned = addCatalogExercise(
  { ...createLogDraft(plannedStart, "future-strength", "planned"), title: "Overnight plan" },
  bench,
);
const plan = updateExercise(planned, planned.exercises[0].id, (exercise) =>
  setStrengthTarget(exercise, { sets: 3, repRange: "20+", rpe: 9, rir: 2, restSeconds: 120 }, "planned"),
);
assert.deepEqual(plan.exercises[0].sets, []);
assert.equal(validateStrengthDraft(plan, "log", plannedOptions.now), null);
assert.match(validateStrengthDraft(plan, "log", plannedStart), /start time in the future/);
assert.equal(emphasisFor(plan).workSets, 3);
assert.equal(emphasisFor(plan).qualities.muscular_endurance.supportingSets, 3);
const planWithRir = (rir) => updateExercise(plan, plan.exercises[0].id, (exercise) =>
  setStrengthTarget(exercise, { rir }, "planned"),
);
assert.equal(emphasisFor(planWithRir(0)).qualities.hypertrophy.score, emphasisFor(plan).qualities.hypertrophy.score);
assert.ok(emphasisFor(planWithRir(10)).qualities.hypertrophy.score < emphasisFor(plan).qualities.hypertrophy.score);
const plannedCount = fresh.prepare("SELECT COUNT(*) AS count FROM timeline_entries").get().count;
await assert.rejects(
  () => logStrengthSession(db, plan, { ...plannedOptions, beforeCommit: () => { throw new Error("plan rollback"); } }),
  /plan rollback/,
);
assert.equal(await getStrengthSession(db, plan.sessionId), null);
assert.equal(fresh.prepare("SELECT COUNT(*) AS count FROM timeline_entries").get().count, plannedCount);

const planWithStaleSets = updateExercise(plan, plan.exercises[0].id, (exercise) => ({
  ...exercise,
  sets: hypertrophy.exercises[0].sets,
}));
const savedPlan = await logStrengthSession(db, planWithStaleSets, plannedOptions);
const planRecord = await getStrengthSession(db, savedPlan.sessionId);
assert.equal(planRecord.status, "planned");
assert.equal(planRecord.startedAt, plannedStart);
assert.equal(planRecord.localDate, "2026-11-27");
assert.equal(planRecord.localEndDate, "2026-11-28");
assert.equal(planRecord.endedAt, plannedStart + planRecord.durationSeconds * 1_000);
assert.equal(planRecord.exercises[0].target.repRange, "20+");
assert.equal(planRecord.exercises[0].target.rir, 2);
assert.deepEqual(planRecord.exercises[0].sets, []);
assert.deepEqual(planRecord.emphasis, emphasisFor(plan));
assert.equal(fresh.prepare("SELECT status FROM timeline_entries WHERE id = ?").get(savedPlan.timelineEntryId).status, "planned");
const planDay = await listStrengthSessionsForDates(db, "2026-11-27", "2026-11-27");
assert.ok(planDay.some((row) => row.id === savedPlan.sessionId && row.status === "planned" && row.localDate === "2026-11-27"));
const afterPlanDay = await listStrengthSessionsForDates(db, "2026-11-28", "2026-11-28");
assert.ok(!afterPlanDay.some((row) => row.id === savedPlan.sessionId));
assert.equal((await logStrengthSession(db, plan, { ...plannedOptions, now: plannedStart + 1 })).alreadySaved, true);

// A saved prescription opens a completed draft with blank set inputs. Saving the template
// succeeds while those inputs are incomplete and serializes the targets alone.
const planTemplateId = await saveStrengthTemplate(db, plan);
const planTemplate = await getStrengthTemplate(db, planTemplateId);
const unfilled = draftFromTemplate(planTemplate, plannedStart, "completed-strength", "completed");
const exerciseId = unfilled.exercises[0].id;
assert.deepEqual(getStrengthTarget(unfilled.exercises[0]), plan.exercises[0].target);
assert.equal(unfilled.exercises[0].sets.length, 3);
assert.ok(unfilled.exercises[0].sets.every((set) => set.actual.reps === ""));
assert.match(validateStrengthDraft(unfilled, "log", plannedStart), /Enter 1 to 100 reps.*set 1/);
assert.equal(emphasisFor(unfilled).workSets, 0);
await assert.rejects(
  () => logStrengthSession(db, unfilled, { ...plannedOptions, now: plannedStart }),
  /Enter 1 to 100 reps/,
);
assert.equal(await getStrengthSession(db, unfilled.sessionId), null);
assert.equal(await saveStrengthTemplate(db, unfilled), planTemplateId);
assert.deepEqual((await getStrengthTemplate(db, planTemplateId)).exercises[0].sets, []);

const actualInputs = [
  { reps: "8", rpe: "7", rir: "2" },
  { reps: "7", rpe: "10", rir: "10+" },
  { reps: "6", rpe: "", rir: "0" },
];
const filled = updateExercise(unfilled, exerciseId, (exercise) => ({
  ...exercise,
  sets: exercise.sets.map((set, index) => ({ ...set, actual: actualInputs[index] })),
}));
for (const field of ["rpe", "rir"]) {
  const invalid = updateExercise(filled, exerciseId, (exercise) =>
    updateSet(exercise, exercise.sets[0].id, (set) => ({
      ...set,
      actual: { ...set.actual, [field]: "11" },
    })),
  );
  assert.match(validateStrengthDraft(invalid, "log", plannedStart), new RegExp(field.toUpperCase()));
}
const changedTargets = updateExercise(filled, exerciseId, (exercise) =>
  setStrengthTarget(exercise, { repRange: "1RM", rpe: 10, rir: 0, restSeconds: 30 }, "completed"),
);
assert.equal(validateStrengthDraft(filled, "log", plannedStart), null);
assert.deepEqual(emphasisFor(changedTargets), emphasisFor(filled));
assert.equal(emphasisFor(filled).qualities.muscular_endurance.score, null);
assert.equal(emphasisFor(filled).workSets, 3);
assert.ok(emphasisFor(filled).qualities.hypertrophy.score < emphasisFor(plan).qualities.hypertrophy.score);
assert.equal(
  emphasisFromDraft(changedTargets.exercises, new Map(), "planned").qualities.strength.score,
  90,
);
const savedCompleted = await logStrengthSession(db, filled, { ...plannedOptions, now: plannedStart });
const completed = await getStrengthSession(db, savedCompleted.sessionId);
assert.equal(completed.status, "completed");
assert.equal(completed.endedAt, plannedStart);
assert.equal(completed.emphasis.modelVersion, STRENGTH_EMPHASIS_VERSION);
assert.deepEqual(completed.emphasis, emphasisFor(filled));
assert.deepEqual(completed.exercises[0].sets.map(({ reps, rpe, rir }) => [reps, rpe, rir]), [
  [8, 7, 2],
  [7, 10, 10],
  [6, null, 0],
]);
assert.equal(fresh.prepare("SELECT status FROM timeline_entries WHERE id = ?").get(savedCompleted.timelineEntryId).status, "completed");
assert.deepEqual((await getStrengthTemplate(db, planTemplateId)).exercises[0].sets, []);

// Upgrade one completed v11 exercise and its stored v1 estimate without rewriting either.
const v11 = new DatabaseSync(":memory:");
v11.exec(`
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
  ${strengthMigrationSql}
  PRAGMA user_version = 11;
  INSERT INTO timeline_entries (id, kind, title, start_at, end_at, status, created_at, updated_at)
  VALUES (1, 'strength', 'Legacy workout', 0, 1000, 'completed', 1000, 1000);
`);
v11.prepare(`
  INSERT INTO strength_sessions (
    id, title, started_at, ended_at, local_end_date, timezone,
    duration_seconds, emphasis_json, emphasis_version, timeline_entry_id, created_at
  ) VALUES ('legacy', 'Legacy workout', 0, 1000, '1970-01-01', 'UTC', 1, ?, 'strength-emphasis-v1', 1, 1000)
`).run(JSON.stringify({ ...hypertrophyResult, modelVersion: "strength-emphasis-v1" }));
v11.exec(`
  INSERT INTO strength_session_exercises (
    id, session_id, position, name, equipment, muscle_groups_json, load_mode, unilateral, explosive_intent
  ) VALUES ('legacy-exercise', 'legacy', 0, 'Bench Press', 'Barbell', '[]', 'external', 0, 0);
  INSERT INTO strength_session_sets (id, session_exercise_id, position, load_kg, reps, rpe, skipped, warmup)
  VALUES ('legacy-set', 'legacy-exercise', 0, 100, 5, 8.5, 0, 0);
`);
const legacy = adapterFor(v11);
await assert.rejects(() => migrateDatabase({
  ...legacy,
  async execAsync(sql) {
    if (sql.includes("ALTER TABLE strength_session_exercises ADD COLUMN target_json")) {
      throw new Error("migration rollback");
    }
    return legacy.execAsync(sql);
  },
}), /migration rollback/);
assert.equal(v11.prepare("PRAGMA user_version").get().user_version, 11);
assert.ok(!v11.prepare("PRAGMA table_info(strength_sessions)").all().some((column) => column.name === "scheduled_local_date"));
await migrateDatabase(legacy);
await migrateDatabase(legacy);
assert.equal(v11.prepare("PRAGMA user_version").get().user_version, 12);
const legacySession = await getStrengthSession(legacy, "legacy");
assert.equal(legacySession.status, "completed");
assert.equal(legacySession.localDate, "1970-01-01");
assert.equal(legacySession.emphasis.modelVersion, "strength-emphasis-v1");
const [legacySet] = legacySession.exercises[0].sets;
assert.deepEqual([legacySet.loadKg, legacySet.reps, legacySet.rpe, legacySet.rir ?? null], [100, 5, 8.5, null]);

console.log("strength checks passed");
