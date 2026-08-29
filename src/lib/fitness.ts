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
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function localDateIso(date: Date) {
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

export function currentStreak(
  logs: Iterable<Pick<WorkoutLog, "logged_at">>,
  today = todayIso(),
): CurrentStreak {
  const trainingDates = distinctTrainingDates(logs).filter((date) => date <= today);
  const latestDate = trainingDates.at(-1);

  if (!latestDate) return { days: 0, isAtRisk: false };

  const gapFromToday = calendarDayDifference(today, latestDate);
  if (gapFromToday >= 3) return { days: 0, isAtRisk: false };

  let days = 1;
  for (let index = trainingDates.length - 1; index > 0; index -= 1) {
    const gap = calendarDayDifference(trainingDates[index], trainingDates[index - 1]);
    if (gap > 2) break;
    days += 1;
  }

  return { days, isAtRisk: gapFromToday === 2 };
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

export function startForRange(range: RangeKey) {
  if (range === "ALL") return null;
  const now = new Date();
  const start = new Date(now);
  if (range === "YTD") start.setMonth(0, 1);
  if (range === "1W") start.setDate(now.getDate() - 7);
  if (range === "1M") start.setMonth(now.getMonth() - 1);
  if (range === "3M") start.setMonth(now.getMonth() - 3);
  if (range === "6M") start.setMonth(now.getMonth() - 6);
  if (range === "1Y") start.setFullYear(now.getFullYear() - 1);
  return start.toISOString().slice(0, 10);
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


