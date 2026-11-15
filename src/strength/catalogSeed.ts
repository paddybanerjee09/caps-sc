import type { CatalogExercise, LoadMode } from "./types";

/**
 * Curated text-only pin of Free Exercise DB metadata.
 * Photos and instructions are excluded: image provenance is unverified
 * (https://github.com/yuhonas/free-exercise-db/issues/2).
 * Upstream ids are the public dataset's exercise ids, kept for provenance.
 */
export const FREE_EXERCISE_DB_REVISION = "curated-2026-11-15";

type SeedRow = readonly [
  string,
  string,
  string,
  string,
  string,
  string,
  LoadMode,
  0 | 1,
  0 | 1,
];

const rows: readonly SeedRow[] = [
  ["barbell-back-squat", "Barbell_Squat", "Barbell Back Squat", "barbell", "quadriceps|glutes", "squat|back squat", "external", 0, 0],
  ["barbell-front-squat", "Barbell_Front_Squat", "Barbell Front Squat", "barbell", "quadriceps", "front squat", "external", 0, 0],
  ["goblet-squat", "Goblet_Squat", "Goblet Squat", "dumbbell", "quadriceps|glutes", "goblet", "external", 0, 0],
  ["bulgarian-split-squat", "Dumbbell_Bulgarian_Split_Squat", "Bulgarian Split Squat", "dumbbell", "quadriceps|glutes", "rear-foot-elevated split squat|split squat", "external", 1, 0],
  ["walking-lunge", "Dumbbell_Walking_Lunge", "Walking Lunge", "dumbbell", "quadriceps|glutes", "lunge|lunges", "external", 1, 0],
  ["step-up", "Barbell_Step_Ups", "Step-Up", "dumbbell", "quadriceps|glutes", "step up|stepups", "external", 1, 0],
  ["leg-press", "Leg_Press", "Leg Press", "machine", "quadriceps|glutes", "leg press", "external", 0, 0],
  ["conventional-deadlift", "Barbell_Deadlift", "Conventional Deadlift", "barbell", "hamstrings|glutes|back", "deadlift|conventional deadlift", "external", 0, 0],
  ["romanian-deadlift", "Romanian_Deadlift", "Romanian Deadlift", "barbell", "hamstrings|glutes", "rdl|stiff leg deadlift", "external", 0, 0],
  ["sumo-deadlift", "Sumo_Deadlift", "Sumo Deadlift", "barbell", "glutes|quadriceps", "sumo", "external", 0, 0],
  ["trap-bar-deadlift", "Trap_Bar_Deadlift", "Trap Bar Deadlift", "trap bar", "quadriceps|glutes", "hex bar deadlift|trap bar", "external", 0, 0],
  ["hip-thrust", "Barbell_Hip_Thrust", "Barbell Hip Thrust", "barbell", "glutes", "hip thrust", "external", 0, 0],
  ["good-morning", "Good_Morning", "Good Morning", "barbell", "hamstrings|back", "good morning", "external", 0, 0],
  ["nordic-curl", "Nordic_Hamstring_Curl", "Nordic Curl", "body only", "hamstrings", "nordic hamstring curl", "bodyweight", 0, 0],
  ["kettlebell-swing", "Kettlebell_Swing", "Kettlebell Swing", "kettlebell", "glutes|hamstrings", "swing|russian swing", "external", 0, 1],
  ["bench-press", "Barbell_Bench_Press_-_Medium_Grip", "Bench Press", "barbell", "chest|triceps", "bench|barbell bench press", "external", 0, 0],
  ["incline-bench-press", "Barbell_Incline_Bench_Press_-_Medium_Grip", "Incline Bench Press", "barbell", "chest|shoulders", "incline bench", "external", 0, 0],
  ["dumbbell-bench-press", "Dumbbell_Bench_Press", "Dumbbell Bench Press", "dumbbell", "chest", "db bench", "external", 0, 0],
  ["floor-press", "Barbell_Floor_Press", "Floor Press", "barbell", "chest|triceps", "floor press", "external", 0, 0],
  ["close-grip-bench", "Close-Grip_Barbell_Bench_Press", "Close-Grip Bench Press", "barbell", "triceps|chest", "close grip bench|cgbp", "external", 0, 0],
  ["overhead-press", "Standing_Military_Press", "Overhead Press", "barbell", "shoulders", "ohp|military press|shoulder press", "external", 0, 0],
  ["dumbbell-shoulder-press", "Dumbbell_Shoulder_Press", "Dumbbell Shoulder Press", "dumbbell", "shoulders", "seated dumbbell press", "external", 0, 0],
  ["push-press", "Push_Press", "Push Press", "barbell", "shoulders", "push press", "external", 0, 1],
  ["lateral-raise", "Side_Lateral_Raise", "Lateral Raise", "dumbbell", "shoulders", "side raise|lateral raises", "external", 0, 0],
  ["dip", "Dips_-_Chest_Version", "Dip", "body only", "chest|triceps", "dips|chest dip", "bodyweight", 0, 0],
  ["push-up", "Pushups", "Push-Up", "body only", "chest|triceps", "pushup|push up|press-up", "bodyweight", 0, 0],
  ["pull-up", "Pullups", "Pull-Up", "body only", "lats", "pullup|pull up|weighted pull-up", "bodyweight", 0, 0],
  ["chin-up", "Chin-Up", "Chin-Up", "body only", "lats|biceps", "chinup|chin up", "bodyweight", 0, 0],
  ["assisted-pull-up", "Assisted_Pull-up", "Assisted Pull-Up", "machine", "lats", "assisted pullup|assisted pull up", "assisted", 0, 0],
  ["lat-pulldown", "Wide-Grip_Lat_Pulldown", "Lat Pulldown", "cable", "lats", "pulldown|lat pull down", "external", 0, 0],
  ["barbell-row", "Bent_Over_Barbell_Row", "Barbell Row", "barbell", "back", "bent over row|pendlay row", "external", 0, 0],
  ["one-arm-row", "One-Arm_Dumbbell_Row", "One-Arm Dumbbell Row", "dumbbell", "back", "single-arm row|dumbbell row", "external", 1, 0],
  ["seated-cable-row", "Seated_Cable_Rows", "Seated Cable Row", "cable", "back", "cable row", "external", 0, 0],
  ["face-pull", "Face_Pull", "Face Pull", "cable", "shoulders", "facepull", "external", 0, 0],
  ["inverted-row", "Inverted_Row", "Inverted Row", "body only", "back", "australian pull-up|bodyweight row", "bodyweight", 0, 0],
  ["farmer-carry", "Farmers_Walk", "Farmer Carry", "dumbbell", "forearms|traps", "farmers walk|farmer's carry|farmer walk", "external", 0, 0],
  ["suitcase-carry", "Suitcase_Carry", "Suitcase Carry", "dumbbell", "core|forearms", "suitcase walk", "external", 1, 0],
  ["power-clean", "Power_Clean", "Power Clean", "barbell", "full body", "clean|power clean", "external", 0, 1],
  ["hang-power-clean", "Hang_Clean", "Hang Power Clean", "barbell", "full body", "hang clean", "external", 0, 1],
  ["power-snatch", "Power_Snatch", "Power Snatch", "barbell", "full body", "snatch", "external", 0, 1],
  ["push-jerk", "Push_Jerk", "Push Jerk", "barbell", "shoulders", "jerk", "external", 0, 1],
  ["kettlebell-snatch", "Kettlebell_Snatch", "Kettlebell Snatch", "kettlebell", "full body", "kb snatch", "external", 1, 1],
  ["box-jump", "Box_Jump", "Box Jump", "body only", "quadriceps", "box jumps|jump onto box", "bodyweight", 0, 1],
  ["broad-jump", "Broad_Jump", "Broad Jump", "body only", "quadriceps|glutes", "standing long jump", "bodyweight", 0, 1],
  ["medicine-ball-throw", "Medicine_Ball_Chest_Pass", "Medicine Ball Throw", "medicine ball", "shoulders|core", "med ball throw|med ball slam", "external", 0, 1],
  ["thruster", "Thruster", "Thruster", "barbell", "quadriceps|shoulders", "thrusters", "external", 0, 0],
  ["barbell-curl", "Barbell_Curl", "Barbell Curl", "barbell", "biceps", "curl|curls", "external", 0, 0],
  ["hammer-curl", "Hammer_Curls", "Hammer Curl", "dumbbell", "biceps|forearms", "hammer curls", "external", 0, 0],
  ["triceps-pushdown", "Triceps_Pushdown", "Triceps Pushdown", "cable", "triceps", "pressdown|pushdown", "external", 0, 0],
  ["skull-crusher", "Lying_Triceps_Press", "Skull Crusher", "barbell", "triceps", "lying triceps extension", "external", 0, 0],
  ["air-squat", "Bodyweight_Squat", "Air Squat", "body only", "quadriceps", "bodyweight squat|air squats", "bodyweight", 0, 0],
  ["pistol-squat", "Pistol_Squat", "Pistol Squat", "body only", "quadriceps", "single-leg squat", "bodyweight", 1, 0],
  ["muscle-up", "Muscle_Up", "Muscle-Up", "body only", "lats|chest", "muscle up", "bodyweight", 0, 0],
  ["hanging-leg-raise", "Hanging_Leg_Raise", "Hanging Leg Raise", "body only", "core", "leg raise", "bodyweight", 0, 0],
  ["back-extension", "Hyperextensions_Back_Extensions", "Back Extension", "body only", "back|glutes", "hyperextension", "bodyweight", 0, 0],
  ["standing-calf-raise", "Standing_Calf_Raises", "Standing Calf Raise", "machine", "calves", "calf raise|calf raises", "external", 0, 0],
];

function splitList(value: string) {
  return value
    .split("|")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export const CATALOG_SEED: readonly CatalogExercise[] = rows.map((row) => ({
  aliases: splitList(row[5]),
  defaultLoadMode: row[6],
  defaultUnilateral: row[7] === 1,
  equipment: row[3],
  id: `fedb.${row[0]}`,
  muscleGroups: splitList(row[4]),
  name: row[2],
  source: "free_exercise_db",
  sourceRevision: FREE_EXERCISE_DB_REVISION,
  suggestsExplosive: row[8] === 1,
  upstreamId: row[1],
}));
