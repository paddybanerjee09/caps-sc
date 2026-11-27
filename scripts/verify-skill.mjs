import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

import { formatLocalDate } from "../src/conditioning/dates.ts";
import { skillMigrationSql } from "../src/data/skillMigration.ts";
import { strengthMigrationSql } from "../src/data/strengthMigration.ts";
import { activityFormValues, activityFromForm } from "../src/skill/activityForm.ts";
import { SKILL_ENERGY_VERSION } from "../src/skill/types.ts";
import { migrateDatabase } from "../src/data/database.ts";
import {
  archiveSkillTemplate,
  getSkillSession,
  getSkillTemplate,
  listSkillSessionsForDates,
  listSkillTemplates,
  logSkillSession,
  saveSkillTemplate,
} from "../src/data/skillRepository.ts";
import { addWeightLog } from "../src/data/timelineRepository.ts";
import {
  SKILL_CATALOG,
  activitiesForDiscipline,
  baseMetFor,
  moderateTenMinuteKcal,
} from "../src/skill/catalog.ts";
import {
  addCatalogActivity,
  createActivityDraft,
  createSkillDraft,
  draftFromTemplate,
  moveActivity,
  templateButtonLabel,
  templateFingerprint,
  updateActivity,
} from "../src/skill/drafts.ts";
import {
  activityEnergyKcal,
  displayKcal,
  estimateActivities,
  sumEnergyKcal,
  weightForEstimate,
} from "../src/skill/energy.ts";
import { focusFromDisciplines } from "../src/skill/focus.ts";
import { activityTiming, elapsedSeconds, sessionStartMs } from "../src/skill/timing.ts";
import { validateSkillDraft } from "../src/skill/validation.ts";

const TEN_MINUTE_KCAL = {
  2.3: 29,
  5: 63,
  5.3: 66,
  5.5: 69,
  5.8: 73,
  6.5: 81,
  7: 88,
  7.8: 98,
  8.5: 106,
  9.3: 116,
  10: 125,
  10.3: 129,
  11: 138,
};

for (const [met, kcal] of Object.entries(TEN_MINUTE_KCAL)) {
  assert.equal(moderateTenMinuteKcal(Number(met)), kcal, met);
}

assert.equal(SKILL_CATALOG.length, 15);
assert.deepEqual(
  activitiesForDiscipline("general").map((activity) => activity.key),
  ["stretching", "skipping", "shadowboxing"],
);
for (const activity of SKILL_CATALOG) {
  assert.ok(activity.name.trim().length <= 80, activity.key);
  if (activity.modes) {
    assert.equal(activity.baseMet, null, activity.key);
    for (const mode of activity.modes) {
      assert.equal(moderateTenMinuteKcal(mode.baseMet), TEN_MINUTE_KCAL[mode.baseMet]);
    }
  } else {
    assert.equal(moderateTenMinuteKcal(activity.baseMet), TEN_MINUTE_KCAL[activity.baseMet]);
  }
}

assert.equal(focusFromDisciplines([]), null);
assert.equal(focusFromDisciplines(["general"]), "general");
assert.equal(focusFromDisciplines(["general", "boxing"]), "boxing");
assert.equal(focusFromDisciplines(["muay_thai", "boxing"]), "mixed");
assert.equal(focusFromDisciplines(["general", "general"]), "general");
assert.equal(focusFromDisciplines(["bjj"]), "bjj");

function activity(key, patch = {}) {
  const draft = createActivityDraft(key, patch.id ?? key);
  assert.ok(draft, key);
  return { ...draft, ...patch, id: patch.id ?? key };
}

for (const definition of SKILL_CATALOG) {
  for (const timingMode of ["duration", "rounds"]) {
    let draft = createSkillDraft(1_000, `valid-${definition.key}-${timingMode}`);
    draft = { ...draft, title: definition.name };
    draft = addCatalogActivity(draft, definition.key);
    draft = updateActivity(draft, draft.activities[0].id, { timingMode });
    assert.equal(validateSkillDraft(draft, "template", 1_000), null, definition.key);
  }
}

const oneRound = activity("sparring-boxing", {
  timingMode: "rounds",
  rounds: 1,
  secondsPerRound: 180,
  restBetweenRoundsSeconds: 60,
  sessionMode: "medium",
});
assert.deepEqual(activityTiming(oneRound), {
  workSeconds: 180,
  restSeconds: 0,
  elapsedSeconds: 180,
});
const zeroRest = activity("bag-boxing", {
  timingMode: "rounds",
  rounds: 3,
  secondsPerRound: 60,
  restBetweenRoundsSeconds: 0,
});
assert.equal(activityTiming(zeroRest).restSeconds, 0);
const durationOnly = activity("shadowboxing", { timingMode: "duration", durationSeconds: 90 });
assert.equal(activityTiming(durationOnly).restSeconds, 0);

const boxingRounds = activity("sparring-boxing", {
  timingMode: "rounds",
  rounds: 5,
  secondsPerRound: 180,
  restBetweenRoundsSeconds: 60,
  sessionMode: "medium",
  rpeBand: "moderate",
});
assert.deepEqual(activityTiming(boxingRounds), {
  workSeconds: 900,
  restSeconds: 240,
  elapsedSeconds: 1140,
});
const moderate = activityEnergyKcal({
  baseMet: 7.8,
  restSeconds: 240,
  rpeBand: "moderate",
  weightKg: 75,
  workSeconds: 900,
});
assert.equal(moderate, 153.75);
assert.equal(displayKcal(moderate), 154);
assert.equal(elapsedSeconds([boxingRounds]), 1140);
const easy = activityEnergyKcal({
  baseMet: 7.8,
  restSeconds: 240,
  rpeBand: "easy",
  weightKg: 75,
  workSeconds: 900,
});
const hard = activityEnergyKcal({
  baseMet: 7.8,
  restSeconds: 240,
  rpeBand: "hard",
  weightKg: 75,
  workSeconds: 900,
});
assert.ok(Math.abs(easy - 124.5) < 1e-9);
assert.ok(Math.abs(hard - 168.375) < 1e-9);
assert.equal(baseMetFor("sparring-boxing", "technical"), 5.5);
assert.equal(baseMetFor("sparring-boxing", "medium"), 7.8);
assert.equal(baseMetFor("sparring-boxing", "hard"), 10);
const technical = estimateActivities(
  [{ ...boxingRounds, sessionMode: "technical" }],
  75,
)[0];
assert.equal(technical.baseMet, 5.5);
assert.equal(technical.rpeMultiplier, 1);
assert.equal(estimateActivities([boxingRounds], 75)[0].rpeMultiplier, 1);
assert.equal(estimateActivities([{ ...boxingRounds, rpeBand: "hard" }], 75)[0].rpeMultiplier, 1.1);

const end = new Date(2026, 10, 16, 0, 10, 0, 0).getTime();
const started = sessionStartMs(end, 19 * 60);
assert.equal(formatLocalDate(new Date(end)), "2026-11-16");
assert.equal(formatLocalDate(new Date(started)), "2026-11-15");

const blank = createSkillDraft(1_000, "blank");
assert.equal(validateSkillDraft(blank, "log", 1_000, "UTC"), "Enter a session title.");
let titled = { ...blank, title: "Pads" };
assert.equal(validateSkillDraft(titled, "log", 1_000, "UTC"), "Add at least one activity.");
titled = addCatalogActivity(titled, "padwork-boxing");
assert.equal(validateSkillDraft({ ...titled, endedAt: 5_000 }, "log", 1_000, "UTC"), "Choose an end time that is not in the future.");
assert.equal(validateSkillDraft(titled, "log", 1_000, "Not/AZone"), "The timezone on this device is not valid.");
assert.equal(validateSkillDraft(titled, "template", 1_000), null);
assert.equal(weightForEstimate(null).basis, "reference");
assert.equal(weightForEstimate(null).kg, 75);
assert.equal(weightForEstimate(82.5).basis, "logged");

let ordered = createSkillDraft(1_000, "order");
ordered = { ...ordered, title: "Order" };
ordered = addCatalogActivity(ordered, "skipping");
ordered = addCatalogActivity(ordered, "bag-muay");
const first = ordered.activities[0].id;
const second = ordered.activities[1].id;
ordered = moveActivity(ordered, first, 1);
assert.deepEqual(
  ordered.activities.map((item) => item.id),
  [second, first],
);
assert.equal(templateButtonLabel(ordered, null), "Save");
const savedPrint = templateFingerprint(ordered);
const linked = { ...ordered, templateLink: "linked", sourceTemplateId: "tpl" };
assert.equal(templateButtonLabel(linked, savedPrint), "Saved");
assert.equal(templateButtonLabel({ ...linked, title: "Edited" }, savedPrint), "Save");
assert.equal(templateButtonLabel({ ...linked, templateLink: "detached" }, savedPrint), "Unsaved");

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

function sessionDraft(endedAt, sessionId, activities) {
  let draft = { ...createSkillDraft(endedAt, sessionId), title: "Tuesday skill" };
  for (const key of activities) {
    draft = addCatalogActivity(draft, key);
  }
  return draft;
}

const fresh = new DatabaseSync(":memory:");
const db = adapterFor(fresh);
await migrateDatabase(db);
assert.equal(fresh.prepare("PRAGMA user_version").get().user_version, 13);
assert.ok(fresh.prepare("SELECT name FROM sqlite_master WHERE name = 'skill_sessions'").get());
assert.ok(fresh.prepare("SELECT name FROM sqlite_master WHERE name = 'strength_sessions'").get());

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
  INSERT INTO nutrition_workspace (id) VALUES ('keep');
  PRAGMA user_version = 8;
`);
upgradeDb.exec(strengthMigrationSql);
const upgrade = adapterFor(upgradeDb);
await migrateDatabase(upgrade);
assert.equal(upgradeDb.prepare("PRAGMA user_version").get().user_version, 13);
assert.equal(upgradeDb.prepare("SELECT id FROM nutrition_workspace").get().id, "keep");
assert.ok(upgradeDb.prepare("SELECT name FROM sqlite_master WHERE name = 'strength_sessions'").get());
assert.ok(upgradeDb.prepare("SELECT name FROM sqlite_master WHERE name = 'skill_sessions'").get());

const now = 50_000;
let built = sessionDraft(now, "session-save", ["stretching", "padwork-boxing"]);
built = updateActivity(built, built.activities[1].id, {
  timingMode: "rounds",
  rounds: 4,
  secondsPerRound: 180,
  restBetweenRoundsSeconds: 45,
  rpeBand: "hard",
});
const templateId = await saveSkillTemplate(db, built, now);
const storedTemplate = await getSkillTemplate(db, templateId);
assert.ok(storedTemplate);
assert.deepEqual(
  storedTemplate.activities.map((item) => item.activityKey),
  ["stretching", "padwork-boxing"],
);
assert.equal(storedTemplate.activities[1].rpeBand, "hard");
assert.equal(storedTemplate.activities[1].restBetweenRoundsSeconds, 45);
assert.equal(storedTemplate.activities[1].timingMode, "rounds");
const reopened = draftFromTemplate(storedTemplate, now + 5_000, "session-reopen");
assert.equal(reopened.endedAt, now + 5_000);
assert.equal(reopened.templateLink, "linked");
assert.equal(templateFingerprint(reopened), templateFingerprint({ ...built, sourceTemplateId: templateId, templateLink: "linked" }));
assert.equal(templateButtonLabel(reopened, templateFingerprint(reopened)), "Saved");

const edited = { ...reopened, title: "Edited pads", templateLink: "linked" };
const sameId = await saveSkillTemplate(db, edited, now + 10);
assert.equal(sameId, templateId);
assert.equal((await getSkillTemplate(db, templateId)).title, "Edited pads");

const logged = await logSkillSession(db, { ...edited, sessionId: "logged-once", endedAt: now }, { now, timeZone: "UTC" });
assert.equal(logged.alreadySaved, false);
await archiveSkillTemplate(db, templateId, now + 20);
assert.equal((await listSkillTemplates(db)).length, 0);
const historical = await getSkillSession(db, "logged-once");
assert.ok(historical);
assert.equal(historical.activities[1].name, "Pad Work (Boxing)");
assert.equal(historical.activities[1].rpeBand, "hard");
assert.equal(historical.focus, "boxing");
assert.equal(historical.estimatorVersion, SKILL_ENERGY_VERSION);
assert.equal((await getSkillTemplate(db, templateId)).archivedAt, now + 20);

const exampleDraft = (() => {
  let draft = sessionDraft(now, "example", ["sparring-boxing"]);
  const id = draft.activities[0].id;
  draft = updateActivity(draft, id, {
    timingMode: "rounds",
    rounds: 5,
    secondsPerRound: 180,
    restBetweenRoundsSeconds: 60,
    sessionMode: "medium",
    rpeBand: "moderate",
  });
  return draft;
})();
const exampleLog = await logSkillSession(db, exampleDraft, { now, timeZone: "UTC" });
const exampleRow = await getSkillSession(db, exampleLog.sessionId);
assert.equal(exampleRow.energyKcal, 153.75);
assert.equal(exampleRow.elapsedSeconds, 1140);
assert.equal(exampleRow.focus, "boxing");
assert.equal(exampleRow.activities[0].restSeconds, 240);
assert.equal(exampleRow.weightBasis, "reference");
assert.equal(exampleRow.weightKg, 75);
assert.equal(sumEnergyKcal(exampleRow.activities), 153.75);

const singleRound = (() => {
  let draft = sessionDraft(now, "one-round", ["sparring-muay"]);
  return updateActivity(draft, draft.activities[0].id, {
    timingMode: "rounds",
    rounds: 1,
    secondsPerRound: 120,
    restBetweenRoundsSeconds: 90,
    sessionMode: "technical",
  });
})();
await logSkillSession(db, singleRound, { now, timeZone: "UTC" });
const singleRow = await getSkillSession(db, "one-round");
assert.equal(singleRow.activities[0].restBetweenRoundsSeconds, 90);
assert.equal(singleRow.activities[0].restSeconds, 0);

await addWeightLog(db, 80, 5_000);
await addWeightLog(db, 90, 40_000);
const beforeWeight = await logSkillSession(
  db,
  sessionDraft(4_000, "before-weight", ["shadowboxing"]),
  { now: 4_000, timeZone: "UTC" },
);
const atWeight = await logSkillSession(
  db,
  sessionDraft(6_000, "at-weight", ["shadowboxing"]),
  { now: 6_000, timeZone: "UTC" },
);
const afterLaterWeight = await logSkillSession(
  db,
  sessionDraft(6_000, "ignores-later-weight", ["bag-boxing"]),
  { now: 30_000, timeZone: "UTC" },
);
assert.equal((await getSkillSession(db, beforeWeight.sessionId)).weightBasis, "reference");
assert.equal((await getSkillSession(db, beforeWeight.sessionId)).weightKg, 75);
assert.equal((await getSkillSession(db, atWeight.sessionId)).weightBasis, "logged");
assert.equal((await getSkillSession(db, atWeight.sessionId)).weightKg, 80);
assert.equal((await getSkillSession(db, afterLaterWeight.sessionId)).weightKg, 80);

const day = formatLocalDate(new Date(now));
const secondLog = await logSkillSession(
  db,
  sessionDraft(now + 1_000, "same-day", ["drilling-bjj", "drilling-boxing"]),
  { now: now + 1_000, timeZone: "UTC" },
);
const listed = await listSkillSessionsForDates(db, day, day);
assert.ok(listed.some((row) => row.id === "same-day"));
assert.ok(listed.some((row) => row.id === exampleLog.sessionId));
assert.equal((await listSkillSessionsForDates(db, "1999-01-01", "1999-01-01")).length, 0);
assert.equal((await getSkillSession(db, secondLog.sessionId)).focus, "mixed");

await assert.rejects(
  () => logSkillSession(db, sessionDraft(now + 10_000, "future", ["skipping"]), { now, timeZone: "UTC" }),
  /future/,
);

const retryDraft = sessionDraft(now, "retry-me", ["skipping"]);
const skillRowsBeforeRetry = fresh
  .prepare("SELECT COUNT(*) AS count FROM timeline_entries WHERE kind = 'skill'")
  .get().count;
await assert.rejects(
  () =>
    logSkillSession(db, retryDraft, {
      now,
      timeZone: "UTC",
      beforeCommit() {
        throw new Error("disk full");
      },
    }),
  /disk full/,
);
assert.equal(await getSkillSession(db, "retry-me"), null);
assert.equal(
  fresh.prepare("SELECT COUNT(*) AS count FROM timeline_entries WHERE kind = 'skill'").get().count,
  skillRowsBeforeRetry,
);
const retried = await logSkillSession(db, retryDraft, { now, timeZone: "UTC" });
assert.equal(retried.alreadySaved, false);
const duplicate = await logSkillSession(db, retryDraft, { now, timeZone: "UTC" });
assert.equal(duplicate.alreadySaved, true);
assert.equal(duplicate.timelineEntryId, retried.timelineEntryId);
assert.equal(
  fresh.prepare("SELECT COUNT(*) AS count FROM skill_sessions WHERE id = 'retry-me'").get().count,
  1,
);

// v10 child-table migration preserves legacy identities and stored estimates.
const legacyDb = new DatabaseSync(":memory:");
const legacyAdapter = adapterFor(legacyDb);
await migrateDatabase(legacyAdapter);
legacyDb.exec("DROP TABLE skill_template_activities; DROP TABLE skill_session_activities;" + skillMigrationSql + "PRAGMA user_version = 10;");
legacyDb.exec(`
INSERT INTO skill_templates (id,title,created_at,updated_at) VALUES ('legacy-template','Legacy',1,1);
INSERT INTO skill_template_activities (id,template_id,position,activity_key,name,discipline,timing_mode,duration_seconds,rounds,seconds_per_round,rest_between_rounds_seconds,rpe_band,session_mode)
VALUES ('legacy-template-activity','legacy-template',0,'shadowboxing','Shadowboxing','general','duration',90,NULL,NULL,NULL,'hard',NULL);
INSERT INTO timeline_entries (id,kind,title,start_at,end_at,status,created_at,updated_at) VALUES (100,'skill','Legacy',1000,109000,'completed',1,1);
INSERT INTO skill_sessions (id,title,started_at,ended_at,local_end_date,timezone,source_template_id,elapsed_seconds,focus,energy_kcal,weight_kg,weight_basis,estimator_version,timeline_entry_id,created_at)
VALUES ('legacy-session','Legacy',1000,109000,'2026-11-24','UTC','legacy-template',108,'general',42.1234,75,'reference','skill-energy-v1',100,1);
INSERT INTO skill_session_activities (id,session_id,position,activity_key,name,discipline,timing_mode,duration_seconds,rounds,seconds_per_round,rest_between_rounds_seconds,rpe_band,session_mode,work_seconds,rest_seconds,base_met,rpe_multiplier,energy_kcal)
VALUES ('legacy-session-activity','legacy-session',0,'shadowboxing','Shadowboxing','general','rounds',NULL,2,45,18,'hard',NULL,90,18,5.3,1.1,42.1234);
`);
const legacyTemplateBefore = legacyDb.prepare("SELECT * FROM skill_template_activities").get();
const legacyActivityBefore = legacyDb.prepare("SELECT * FROM skill_session_activities").get();
const legacySessionBefore = legacyDb.prepare("SELECT * FROM skill_sessions").get();
const failingMigration = {
  ...legacyAdapter,
  async execAsync(sql) {
    legacyDb.exec(sql);
    if (sql.includes("CREATE TABLE skill_template_activities_v11")) throw new Error("migration interrupted");
  },
};
await assert.rejects(() => migrateDatabase(failingMigration), /migration interrupted/);
assert.equal(legacyDb.prepare("PRAGMA user_version").get().user_version, 10);
assert.ok(!legacyDb.prepare("PRAGMA table_info(skill_template_activities)").all().some((column) => column.name === "sets"));
assert.deepEqual(legacyDb.prepare("SELECT * FROM skill_session_activities").get(), legacyActivityBefore);
await migrateDatabase(legacyAdapter);
assert.equal(legacyDb.prepare("PRAGMA user_version").get().user_version, 13);
for (const [key,value] of Object.entries(legacyTemplateBefore)) assert.equal(legacyDb.prepare("SELECT * FROM skill_template_activities").get()[key], value);
for (const [key,value] of Object.entries(legacyActivityBefore)) assert.equal(legacyDb.prepare("SELECT * FROM skill_session_activities").get()[key], value);
assert.deepEqual(legacyDb.prepare("SELECT * FROM skill_sessions").get(), legacySessionBefore);
assert.deepEqual(legacyDb.prepare("PRAGMA foreign_key_check").all(), []);
const oldLog = await getSkillSession(legacyAdapter, "legacy-session");
assert.equal(oldLog.estimatorVersion, "skill-energy-v1");
assert.equal(oldLog.energyKcal, 42.1234);
assert.equal(oldLog.activities[0].id, "legacy-session-activity");
assert.equal((await getSkillTemplate(legacyAdapter, "legacy-template")).activities[0].timingMode, "duration");
// A prematurely advanced version still repairs an old child table, without rewriting the valid sibling.
legacyDb.exec("DELETE FROM skill_templates; DROP TABLE skill_template_activities;" + skillMigrationSql);
await migrateDatabase(legacyAdapter);
assert.ok(legacyDb.prepare("PRAGMA table_info(skill_template_activities)").all().some((column) => column.name === "sets"));
assert.equal((await getSkillSession(legacyAdapter, "legacy-session")).energyKcal, 42.1234);

const repsActivity = activity("drilling-boxing", { timingMode: "reps", sets: 3, reps: 10, rpe: 8, restBetweenSetsSeconds: null });
assert.deepEqual(activityTiming(repsActivity), { workSeconds: 90, restSeconds: 180, elapsedSeconds: 270 });
assert.equal(activityTiming({ ...repsActivity, restBetweenSetsSeconds: 0 }).elapsedSeconds, 90);
assert.equal(estimateActivities([{ ...repsActivity, rpe: 9 }],75)[0].rpeMultiplier, 1.1);
const repForm = { ...activityFormValues(repsActivity), sets: "4", reps: "12", rpe: "9", restBetweenSets: "0" };
const repResult = activityFromForm(repsActivity, repForm).activity;
assert.equal(repResult.sets,4);
assert.equal(repResult.reps,12);
assert.equal(repResult.rpe,9);
assert.equal(repResult.restBetweenSetsSeconds,0);
const roundsForm = { ...repForm, mode: "rounds", rounds:"5", work:"120", rest:"30" };
assert.equal(activityFromForm(repsActivity, roundsForm).activity.secondsPerRound,120);
const backToReps = activityFromForm(repsActivity,{ ...roundsForm, mode:"reps" }).activity;
assert.equal(backToReps.reps,12);
assert.equal(backToReps.sets,4);
assert.match(activityFromForm(repsActivity,{ ...repForm, sets:"" }).error,/Sets/);
assert.match(activityFromForm(repsActivity,{ ...repForm, reps:"101" }).error,/Reps/);
assert.match(activityFromForm(repsActivity,{ ...repForm, rpe:"11" }).error,/RPE/);
assert.equal(activityFromForm(repsActivity,{ ...repForm, rpe:"", restBetweenSets:"" }).activity.restBetweenSetsSeconds,null);
const oldDurationForm = activityFormValues(durationOnly);
assert.equal(oldDurationForm.mode,"rounds");
assert.equal(oldDurationForm.rounds,"1");
assert.equal(activityTiming(activityFromForm(durationOnly,oldDurationForm).activity).elapsedSeconds,90);

const repsDraft = { ...createSkillDraft(now,"reps-log"), title:"Reps practice", activities:[repsActivity] };
const repsTemplateId = await saveSkillTemplate(db,repsDraft,now);
const savedReps = await getSkillTemplate(db,repsTemplateId);
assert.equal(savedReps.activities[0].timingMode,"reps");
assert.equal(savedReps.activities[0].sets,3);
assert.equal(savedReps.activities[0].reps,10);
assert.equal(savedReps.activities[0].rpe,8);
assert.equal(savedReps.activities[0].restBetweenSetsSeconds,null);
const repsReopened = draftFromTemplate(savedReps,now,"reps-reopened");
assert.equal(templateFingerprint(repsReopened),templateFingerprint(repsDraft));
await assert.rejects(() => logSkillSession(db,repsReopened,{now,timeZone:"UTC",beforeCommit(){throw new Error("reps disk full");}}),/reps disk full/);
assert.equal(await getSkillSession(db,"reps-reopened"),null);
const repsLogged = await logSkillSession(db,repsReopened,{now,timeZone:"UTC"});
const repsLog = await getSkillSession(db,repsLogged.sessionId);
assert.equal(repsLog.estimatorVersion,SKILL_ENERGY_VERSION);
assert.equal(repsLog.elapsedSeconds,270);
assert.equal(repsLog.activities[0].workSeconds,90);
assert.equal(repsLog.activities[0].restSeconds,180);
assert.equal(repsLog.activities[0].sets,3);
assert.equal(repsLog.activities[0].rpe,8);
assert.equal((await logSkillSession(db,repsReopened,{now,timeZone:"UTC"})).alreadySaved,true);
await saveSkillTemplate(db,{...repsReopened,activities:[{...repsReopened.activities[0],reps:20}]},now);
assert.equal((await getSkillSession(db,repsLogged.sessionId)).activities[0].reps,10);
assert.equal((await getSkillTemplate(db,repsTemplateId)).activities[0].reps,20);
assert.deepEqual(fresh.prepare("PRAGMA foreign_key_check").all(),[]);
console.log("skill checks passed");
