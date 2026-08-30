import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

// Replace this before running. The user must already exist in Supabase Auth.
const TEST_USER_ID = "REPLACE_WITH_EXISTING_TEST_USER_UUID";
const DAYS_OF_HISTORY = 120;
const SEED_MARKER = "[seed-test-history]";

console.warn(`
WARNING: This script uses SUPABASE_SERVICE_ROLE_KEY, bypasses RLS, and writes
directly to the database. Run it only against a disposable test account and
never against production data. It removes only rows previously created by this
script for TEST_USER_ID before inserting a fresh dataset.
`);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (TEST_USER_ID === "REPLACE_WITH_EXISTING_TEST_USER_UUID") {
  throw new Error("Set TEST_USER_ID at the top of scripts/seed-test-history.mjs first.");
}

if (process.env.ALLOW_TEST_DATA_SEED !== "true") {
  throw new Error("Set ALLOW_TEST_DATA_SEED=true in .env.local to confirm this write.");
}

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.",
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

function createRandom(seed = 20260830) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const random = createRandom();
const randomInt = (minimum, maximum) =>
  Math.floor(random() * (maximum - minimum + 1)) + minimum;
const randomBetween = (minimum, maximum) => random() * (maximum - minimum) + minimum;
const roundTo = (value, step) => Math.round(value / step) * step;

function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function todayAtNoon() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
}

function exerciseMatches(exercise, aliases) {
  const name = exercise.name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return aliases.some((alias) => name.includes(alias.replace(/[^a-z0-9]/g, "")));
}

const exerciseDefinitions = [
  { key: "bench", aliases: ["bench press", "barbell bench"], bodyweight: false, start: 40, end: 55 },
  { key: "squat", aliases: ["back squat", "barbell squat", "squat"], bodyweight: false, start: 50, end: 70 },
  { key: "deadlift", aliases: ["deadlift"], bodyweight: false, start: 60, end: 85 },
  { key: "row", aliases: ["barbell row", "cable row", "seated row", "row"], bodyweight: false, start: 35, end: 48 },
  { key: "pulldown", aliases: ["lat pulldown", "pulldown"], bodyweight: false, start: 32, end: 45 },
  { key: "pullup", aliases: ["pull up", "pullup"], bodyweight: true, start: 5, end: 10 },
  { key: "pushup", aliases: ["push up", "pushup"], bodyweight: true, start: 7, end: 12 },
  { key: "dip", aliases: ["dip"], bodyweight: true, start: 6, end: 11 },
];

function buildBodyWeightLogs(startDate, endDate) {
  const logs = [];
  let cursor = new Date(startDate);
  const totalDays = Math.max(1, Math.round((endDate - startDate) / 86_400_000));

  while (cursor <= endDate) {
    const progress = Math.min(1, Math.round((cursor - startDate) / 86_400_000) / totalDays);
    const baseline = 78.4 - 4 * progress;
    logs.push({
      user_id: TEST_USER_ID,
      logged_at: isoDate(cursor),
      weight_kg: Number((baseline + randomBetween(-0.3, 0.3)).toFixed(1)),
    });
    cursor = addDays(cursor, randomInt(1, 3));
  }

  return logs;
}

function buildSessionDates(startDate, endDate) {
  const gapDays = new Set([
    ...Array.from({ length: 7 }, (_, index) => 39 + index),
    ...Array.from({ length: 6 }, (_, index) => 83 + index),
  ]);
  const dates = [];
  let weekStart = new Date(startDate);
  let weekIndex = 0;

  while (weekStart <= endDate) {
    const available = Array.from({ length: 7 }, (_, dayOffset) => ({
      date: addDays(weekStart, dayOffset),
      dayIndex: weekIndex * 7 + dayOffset,
    })).filter(({ date, dayIndex }) => date <= endDate && !gapDays.has(dayIndex));
    const sessionCount = Math.min(available.length, randomInt(3, 5));
    available.sort(() => random() - 0.5);
    dates.push(...available.slice(0, sessionCount).map(({ date }) => date));
    weekStart = addDays(weekStart, 7);
    weekIndex += 1;
  }

  return dates.sort((a, b) => a - b);
}

function noteForSession(progress, sessionIndex) {
  if (sessionIndex === 0) return `${SEED_MARKER} Starting the block.`;
  if (progress > 0.72 && progress < 0.79) return `${SEED_MARKER} Back after a busy week.`;
  const notes = ["Felt strong today.", "Kept it controlled.", "A little tired, still moved well."];
  return random() < 0.2 ? `${SEED_MARKER} ${notes[randomInt(0, notes.length - 1)]}` : SEED_MARKER;
}

function buildWorkoutLogs(sessionDates, selectedExercises, startDate) {
  const logs = [];
  const totalDays = Math.max(1, Math.round((sessionDates.at(-1) - startDate) / 86_400_000));

  sessionDates.forEach((date, sessionIndex) => {
    const progress = Math.min(1, Math.round((date - startDate) / 86_400_000) / totalDays);
    const offset = (sessionIndex * 2) % selectedExercises.length;
    const sessionExercises = Array.from({ length: 3 }, (_, index) =>
      selectedExercises[(offset + index) % selectedExercises.length],
    );

    for (const exercise of sessionExercises) {
      const sets = randomInt(3, 5);
      const baseReps = exercise.bodyweight
        ? exercise.start + (exercise.end - exercise.start) * progress
        : randomInt(6, 12);
      const reps = Math.max(
        exercise.bodyweight ? 4 : 6,
        Math.min(12, Math.round(baseReps + randomBetween(-1.25, 1.25))),
      );
      const weight = exercise.bodyweight
        ? null
        : Number(
            roundTo(
              Math.max(0, exercise.start + (exercise.end - exercise.start) * progress + randomBetween(-2, 2)),
              0.5,
            ).toFixed(1),
          );

      logs.push({
        user_id: TEST_USER_ID,
        exercise_id: exercise.id,
        logged_at: isoDate(date),
        weight_kg: weight,
        sets,
        reps,
        notes: noteForSession(progress, sessionIndex),
      });
    }
  });

  return logs;
}

async function main() {
  const { data: user, error: userError } = await supabase.auth.admin.getUserById(TEST_USER_ID);
  if (userError || !user.user) {
    throw new Error(`TEST_USER_ID does not refer to an existing Auth user: ${userError?.message ?? "not found"}`);
  }

  const { data: exercises, error: exercisesError } = await supabase
    .from("exercises")
    .select("id, name, is_bodyweight")
    .or(`user_id.is.null,user_id.eq.${TEST_USER_ID}`)
    .order("name");
  if (exercisesError) throw exercisesError;

  const selectedExercises = exerciseDefinitions
    .map((definition) => {
      const exercise = (exercises ?? []).find((item) => exerciseMatches(item, definition.aliases));
      return exercise ? { ...definition, id: exercise.id, name: exercise.name } : null;
    })
    .filter(Boolean);

  if (selectedExercises.length < 6) {
    const availableNames = (exercises ?? []).map((exercise) => exercise.name).join(", ");
    throw new Error(
      `Found only ${selectedExercises.length} suitable existing exercises; need at least 6. Available: ${availableNames}`,
    );
  }

  const today = todayAtNoon();
  const startDate = addDays(today, -(DAYS_OF_HISTORY - 1));
  const startIso = isoDate(startDate);
  const endIso = isoDate(today);
  const bodyWeightLogs = buildBodyWeightLogs(startDate, today);
  const workoutLogs = buildWorkoutLogs(buildSessionDates(startDate, today), selectedExercises, startDate);

  // A re-run is safe: only remove rows that this script previously marked.
  const { error: deleteWorkoutsError } = await supabase
    .from("workout_logs")
    .delete()
    .eq("user_id", TEST_USER_ID)
    .gte("logged_at", startIso)
    .lte("logged_at", endIso)
    .like("notes", `%${SEED_MARKER}%`);
  if (deleteWorkoutsError) throw deleteWorkoutsError;

  const { error: weightError } = await supabase
    .from("body_weight_logs")
    .upsert(bodyWeightLogs, { onConflict: "user_id,logged_at" });
  if (weightError) throw weightError;

  const { error: workoutError } = await supabase.from("workout_logs").insert(workoutLogs);
  if (workoutError) throw workoutError;

  console.log(
    `Seeded ${bodyWeightLogs.length} body-weight entries and ${workoutLogs.length} workout logs for ${user.user.email ?? TEST_USER_ID}.`,
  );
  console.log(`History covers ${startIso} through ${endIso} across ${selectedExercises.length} existing exercises.`);
}

main().catch((error) => {
  console.error("Seed failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
