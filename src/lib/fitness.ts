export type RangeKey = "1W" | "1M" | "3M" | "6M" | "1Y" | "YTD" | "ALL";

export type BodyPart = {
  id: string;
  name: string;
  sort_order: number;
};

export type Exercise = {
  id: string;
  body_part_id: string;
  name: string;
  user_id: string | null;
  is_bodyweight: boolean;
};

export type WorkoutLog = {
  id: string;
  user_id: string;
  exercise_id: string;
  logged_at: string;
  weight_kg: number | null;
  sets: number;
  reps: number;
  notes: string | null;
};

export type BodyWeightLog = {
  id: string;
  user_id: string;
  logged_at: string;
  weight_kg: number;
};

export type ChartPoint = {
  date: string;
  value: number;
};

export const RANGE_OPTIONS: RangeKey[] = [
  "1W",
  "1M",
  "3M",
  "6M",
  "1Y",
  "YTD",
  "ALL",
];

export function todayIso() {
  return localDateIso(new Date());
}

export function localDateIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getCalendarWeekBounds(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = start.getDay();
  start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day));

  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  return { start: localDateIso(start), end: localDateIso(end) };
}

export function getCalendarMonthBounds(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: localDateIso(start), end: localDateIso(end) };
}

export function totalTrainingVolume(
  logs: Iterable<Pick<WorkoutLog, "exercise_id" | "logged_at" | "weight_kg">>,
) {
  const loadByExerciseDay = new Map<string, number>();

  for (const log of logs) {
    const key = `${log.logged_at}:${log.exercise_id}`;
    const load = Number(log.weight_kg ?? 0);
    loadByExerciseDay.set(
      key,
      Math.max(loadByExerciseDay.get(key) ?? 0, load),
    );
  }

  let total = 0;
  for (const load of loadByExerciseDay.values()) total += load;
  return total;
}

export function distinctTrainingDays(
  logs: Iterable<Pick<WorkoutLog, "logged_at">>,
) {
  return distinctTrainingDates(logs).length;
}

export function distinctTrainingDates(
  logs: Iterable<Pick<WorkoutLog, "logged_at">>,
) {
  const days = new Set<string>();
  for (const log of logs) days.add(log.logged_at);
  return [...days].toSorted();
}

export type CurrentStreak = {
  days: number;
  isAtRisk: boolean;
};

// Only dates represented by workout_logs are training dates. A streak advances
// only when there is at least one logged workout on each consecutive calendar
// day; multiple workouts on the same date still count as one day.
const MAX_TRAINING_DATE_GAP = 1;

export function currentStreak(
  logs: Iterable<Pick<WorkoutLog, "logged_at">>,
  today = todayIso(),
): CurrentStreak {
  const trainingDates = distinctTrainingDates(logs).filter((date) => date <= today);
  const latestDate = trainingDates.at(-1);

  if (!latestDate) return { days: 0, isAtRisk: false };

  const gapFromToday = calendarDayDifference(today, latestDate);
  if (gapFromToday > MAX_TRAINING_DATE_GAP) return { days: 0, isAtRisk: false };

  let days = 1;
  for (let index = trainingDates.length - 1; index > 0; index -= 1) {
    const gap = calendarDayDifference(trainingDates[index], trainingDates[index - 1]);
    if (gap > MAX_TRAINING_DATE_GAP) break;
    days += 1;
  }

  return { days, isAtRisk: gapFromToday === MAX_TRAINING_DATE_GAP };
}

function calendarDayDifference(laterDate: string, earlierDate: string) {
  const toUtcTimestamp = (date: string) => {
    const [year, month, day] = date.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };

  return Math.round(
    (toUtcTimestamp(laterDate) - toUtcTimestamp(earlierDate)) / 86_400_000,
  );
}

export function formatVolume(volume: number) {
  if (!volume) return "-";
  return `${new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(volume)} kg`;
}

export function startForRange(range: RangeKey, now = new Date()) {
  if (range === "ALL") return null;
  const start = new Date(now);
  if (range === "YTD") start.setMonth(0, 1);
  if (range === "1W") start.setDate(now.getDate() - 6);
  const months = ({ "1M": 1, "3M": 3, "6M": 6, "1Y": 12 } as Partial<Record<RangeKey, number>>)[range];
  if (months) {
    start.setDate(1);
    start.setMonth(now.getMonth() - months);
    const lastDay = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    start.setDate(Math.min(now.getDate(), lastDay));
  }
  return localDateIso(start);
}

export function filterPoints(points: ChartPoint[], range: RangeKey) {
  const start = startForRange(range);
  return start ? points.filter((point) => point.date >= start) : points;
}

export function formatDate(date: string, compact = false) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    ...(compact ? {} : { year: "numeric" }),
  }).format(new Date(`${date}T12:00:00`));
}

export function initials(email?: string) {
  return (email?.slice(0, 2) || "FT").toUpperCase();
}



